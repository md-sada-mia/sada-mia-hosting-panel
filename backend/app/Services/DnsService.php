<?php

namespace App\Services;

use App\Models\Domain;
use App\Models\DnsRecord;

class DnsService
{
    protected ShellService $shell;
    protected string $zonesDir = '/etc/bind/zones';
    protected string $namedConf = '/etc/bind/named.conf.local';

    public function __construct(ShellService $shell)
    {
        $this->shell = $shell;
    }

    /**
     * Generate or regenerate a BIND9 zone file for the domain.
     */
    public function generateZone(Domain $domain): void
    {
        $zoneContent = $this->buildZoneContent($domain);
        $zoneFile    = "{$this->zonesDir}/db.{$domain->domain}";

        // Ensure zones directory exists
        $this->shell->run("sudo mkdir -p {$this->zonesDir}");

        // Write zone file
        $escaped = escapeshellarg($zoneContent);
        $this->shell->run("echo {$escaped} | sudo tee {$zoneFile} > /dev/null");

        // Ensure named.conf.local includes this zone
        $this->ensureNamedConfEntry($domain);

        // Validate and reload BIND9
        $this->reloadBind();

        $domain->update(['status' => 'active', 'dns_managed' => true]);
    }

    /**
     * Remove zone from BIND9.
     */
    public function removeZone(Domain $domain): void
    {
        $parent = $this->findParentDomain($domain->domain);

        if ($parent && !$domain->dns_managed) {
            // It was a subdomain managed via parent's A records
            DnsRecord::where('domain_id', $parent->id)
                ->where('app_id', $domain->app_id)
                ->delete();

            $this->generateZone($parent->fresh()->load('dnsRecords'));
            $domain->update(['status' => 'inactive']);
            return;
        }

        $zoneFile = "{$this->zonesDir}/db.{$domain->domain}";

        // Remove zone file
        $this->shell->run("sudo rm -f {$zoneFile}");

        // Remove from named.conf.local
        $this->removeNamedConfEntry($domain);

        $this->reloadBind();

        $domain->update(['status' => 'inactive', 'dns_managed' => false]);
    }

    /**
     * Re-run default record creation and regenerate zone file.
     * Useful when new infra-level records (like DKIM) are generated.
     */
    public function refreshEmailDnsRecords(Domain $domain): void
    {
        $this->createDefaultRecords($domain);
        $this->generateZone($domain->fresh()->load('dnsRecords'));
    }

    /**
     * Sync records (re-generate zone file from DB records).
     */
    public function syncRecords(Domain $domain): void
    {
        if ($domain->dns_managed) {
            $this->createDefaultRecords($domain);
            $this->generateZone($domain->fresh()->load('dnsRecords'));
        }
    }

    /**
     * Auto-create essential DNS records for a newly created domain.
     * Creates: A record (@), CNAME (www), MX (mail).
     */
    public function createDefaultRecords(Domain $domain): void
    {
        // Get server IP from settings
        $serverIp = \App\Models\Setting::get('server_ip', '127.0.0.1');

        $defaults = [
            ['type' => 'A',     'name' => '@',      'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'www',    'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'mail',         'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'webmail',      'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'autoconfig',   'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'autodiscover', 'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'ns1',          'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'ns2',          'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'ns3',          'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'ns4',          'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'MX',    'name' => '@',      'value' => 'mail.' . $domain->domain . '.', 'ttl' => 3600, 'priority' => 10],
            ['type' => 'TXT',   'name' => '@',      'value' => "v=spf1 a mx ip4:{$serverIp} ~all", 'ttl' => 3600, 'priority' => null],
            ['type' => 'TXT',   'name' => '_dmarc', 'value' => 'v=DMARC1; p=none; sp=none; aspf=r; adkim=r', 'ttl' => 3600, 'priority' => null],
        ];

        // Add 4 Nameservers as NS records in database
        $ns1 = \App\Models\Setting::get('dns_default_ns1', "ns1.{$domain->domain}.");
        $ns2 = \App\Models\Setting::get('dns_default_ns2', "ns2.{$domain->domain}.");
        $ns3 = \App\Models\Setting::get('dns_default_ns3', "ns3.{$domain->domain}.");
        $ns4 = \App\Models\Setting::get('dns_default_ns4', "ns4.{$domain->domain}.");

        $defaults[] = ['type' => 'NS', 'name' => '@', 'value' => $ns1, 'ttl' => 3600, 'priority' => null];
        $defaults[] = ['type' => 'NS', 'name' => '@', 'value' => $ns2, 'ttl' => 3600, 'priority' => null];
        $defaults[] = ['type' => 'NS', 'name' => '@', 'value' => $ns3, 'ttl' => 3600, 'priority' => null];
        $defaults[] = ['type' => 'NS', 'name' => '@', 'value' => $ns4, 'ttl' => 3600, 'priority' => null];

        // Try to add DKIM record if it exists on disk
        $dkimValue = $this->extractDkimValue($domain->domain);
        if ($dkimValue) {
            $defaults[] = ['type' => 'TXT', 'name' => 'default._domainkey', 'value' => $dkimValue, 'ttl' => 3600, 'priority' => null];
        }

        foreach ($defaults as $rec) {
            // Only create if not already present (idempotent)
            $query = DnsRecord::where('domain_id', $domain->id)
                ->where('type', $rec['type'])
                ->where('name', $rec['name']);

            if (in_array($rec['type'], ['NS', 'A', 'AAAA', 'TXT'])) {
                $query->where('value', $rec['value']);
            }

            if (!$query->exists()) {
                DnsRecord::create(array_merge($rec, ['domain_id' => $domain->id]));
            }
        }
    }

    /**
     * Consistently create a new managed Domain record with default NS and records.
     */
    public function createManagedDomain(string $domainName, ?int $appId = null): ?Domain
    {
        try {
            $parent = $this->findParentDomain($domainName);

            if ($parent) {
                // If it's a subdomain of a managed parent, we don't manage DNS separately
                $domain = Domain::create([
                    'domain'      => $domainName,
                    'app_id'      => $appId,
                    'status'      => 'active',
                    'dns_managed' => false, // Important: not managed as a separate zone
                ]);

                // Add A record to the parent domain
                // We need to extract the "name" for the A record relative to parent
                $hostname = str_replace('.' . $parent->domain, '', $domainName);

                $serverIp = \App\Models\Setting::get('server_ip', '127.0.0.1');

                // Create A record in parent's DNS records
                DnsRecord::create([
                    'domain_id' => $parent->id,
                    'app_id'    => $appId, // Track which app this record belongs to
                    'type'      => 'A',
                    'name'      => $hostname,
                    'value'     => $serverIp,
                    'ttl'       => 3600,
                ]);

                // Create www CNAME/A for the subdomain? User didn't ask but usually expected.
                // For now, let's stick to (a records) as requested.

                // Regenerate parent zone
                $this->generateZone($parent->fresh()->load('dnsRecords'));

                return $domain;
            }

            $ns = [
                'nameserver_1' => \App\Models\Setting::get('dns_default_ns1'),
                'nameserver_2' => \App\Models\Setting::get('dns_default_ns2'),
                'nameserver_3' => \App\Models\Setting::get('dns_default_ns3'),
                'nameserver_4' => \App\Models\Setting::get('dns_default_ns4'),
            ];

            // If ns_default_domain is empty, set it to the current domain
            if (!\App\Models\Setting::get('ns_default_domain')) {
                \App\Models\Setting::set('ns_default_domain', $domainName);
            }

            // If it's the first execution and no nameservers are set, auto-initialize from this domain or setting
            if (empty($ns['nameserver_1']) && empty($ns['nameserver_2'])) {
                $baseDomain = \App\Models\Setting::get('ns_default_domain');
                if (empty($baseDomain)) {
                    $baseDomain = $domainName;
                }
                $baseDomain = rtrim($baseDomain, '.');

                $ns['nameserver_1'] = "ns1.{$baseDomain}.";
                $ns['nameserver_2'] = "ns2.{$baseDomain}.";
                $ns['nameserver_3'] = "ns3.{$baseDomain}.";
                $ns['nameserver_4'] = "ns4.{$baseDomain}.";

                \App\Models\Setting::set('dns_default_ns1', $ns['nameserver_1']);
                \App\Models\Setting::set('dns_default_ns2', $ns['nameserver_2']);
                \App\Models\Setting::set('dns_default_ns3', $ns['nameserver_3']);
                \App\Models\Setting::set('dns_default_ns4', $ns['nameserver_4']);
            }

            $domain = Domain::create(array_merge([
                'domain'      => $domainName,
                'app_id'      => $appId,
                'status'      => 'active',
                'dns_managed' => true,
            ], array_filter($ns)));

            // Auto-create essential records (A, www, MX, etc.)
            $this->createDefaultRecords($domain);

            // Generate zone file
            $this->generateZone($domain->fresh()->load('dnsRecords'));

            return $domain;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Unified domain creation failed for {$domainName}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Find if a domain is a subdomain of an existing managed domain.
     */
    public function findParentDomain(string $domainName): ?Domain
    {
        $parts = explode('.', $domainName);

        // We need at least 3 parts for it to be a subdomain of something we might manage 
        // (e.g., sub.example.com has 3 parts)
        if (count($parts) < 3) {
            return null;
        }

        // Try progressively shorter suffixes
        // e.g., for a.b.c.com -> b.c.com, c.com
        for ($i = 1; $i < count($parts) - 1; $i++) {
            $candidate = implode('.', array_slice($parts, $i));
            $parent = Domain::where('domain', $candidate)
                ->where('dns_managed', true)
                ->first();

            if ($parent) {
                return $parent;
            }
        }

        return null;
    }

    /**
     * Check if BIND9 is installed.
     */
    public function isBindInstalled(): bool
    {
        $result = $this->runOutput('which named 2>/dev/null');
        return !empty(trim($result));
    }

    private function runOutput(string $cmd): string
    {
        return $this->shell->run($cmd)['output'] ?? '';
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────────

    private function buildZoneContent(Domain $domain): string
    {
        $records     = $domain->dnsRecords;
        $serial      = $this->generateNextSerial();
        $zoneDomain  = rtrim($domain->domain, '.');

        $lines = [];
        $lines[] = '$TTL 3600';
        $lines[] = "@ IN SOA ns1.{$zoneDomain}. admin.{$zoneDomain}. (";
        $lines[] = "    {$serial} ; Serial";
        $lines[] = "    3600       ; Refresh";
        $lines[] = "    1800       ; Retry";
        $lines[] = "    604800     ; Expire";
        $lines[] = "    86400 )    ; Minimum TTL";
        $lines[] = '';

        foreach ($records as $record) {
            $name  = $record->name === '@' ? '@' : rtrim($record->name, '.');
            $value = rtrim($record->value, '.');

            if ($record->type === 'TXT') {
                $value = '"' . $record->value . '"';
            } elseif (in_array($record->type, ['CNAME', 'MX', 'NS', 'PTR'])) {
                $value = rtrim($record->value, '.') . '.';
            }

            $priority = $record->priority ? "{$record->priority} " : '';
            $lines[]  = "{$name} {$record->ttl} IN {$record->type} {$priority}{$value}";
        }

        return implode("\n", $lines) . "\n";
    }

    private function ensureNamedConfEntry(Domain $domain): void
    {
        $zoneFile = "{$this->zonesDir}/db.{$domain->domain}";
        $entry    = <<<ENTRY

zone "{$domain->domain}" {
    type master;
    file "{$zoneFile}";
    allow-transfer { any; };
};
ENTRY;

        // Only add if not already present
        $result = $this->runOutput("sudo grep -q 'zone \"{$domain->domain}\"' {$this->namedConf} 2>/dev/null; echo \$?");
        if (trim($result) !== '0') {
            $escaped = escapeshellarg($entry);
            $this->shell->run("echo {$escaped} | sudo tee -a {$this->namedConf} > /dev/null");
        }
    }

    private function removeNamedConfEntry(Domain $domain): void
    {
        // Use perl to remove the zone block accurately, handling internal braces like allow-transfer { any; };
        $d = preg_quote($domain->domain, '/');
        // This regex matches "zone "domain" { ... };" including internal blocks
        $this->shell->run(
            "sudo perl -i -0pe 's/zone \"{$d}\" \\{.*?\\};\\n?//sg' {$this->namedConf} 2>/dev/null || true"
        );
    }

    private function reloadBind(): void
    {
        $this->shell->run('sudo named-checkconf 2>/dev/null && sudo systemctl reload bind9 2>/dev/null || true');
    }

    private function extractDkimValue(string $domainName): ?string
    {
        $file = "/etc/opendkim/keys/{$domainName}/default.txt";
        // Use sudo cat because of permissions
        $content = $this->runOutput("sudo cat {$file} 2>/dev/null");
        if (empty($content)) {
            return null;
        }

        // Parse: "v=DKIM1; k=rsa; p=MIIBIj..."
        // Typically it's across multiple lines with quotes
        if (preg_match('/\((.*?)\)/s', $content, $matches)) {
            $value = $matches[1];
            // Remove quotes and whitespace
            $value = str_replace(['"', "\n", "\t", ' '], '', $value);
            return $value;
        }

        return null;
    }

    /**
     * Generate the next SOA serial using YYYYMMDDNN format.
     */
    private function generateNextSerial(): string
    {
        $today = now()->format('Ymd');
        $lastSerial = \App\Models\Setting::get('dns_last_serial');

        if ($lastSerial && str_starts_with($lastSerial, $today)) {
            $nextSerial = (int)$lastSerial + 1;
        } else {
            $nextSerial = $today . '01';
        }

        \App\Models\Setting::set('dns_last_serial', (string)$nextSerial);

        return (string)$nextSerial;
    }
}
