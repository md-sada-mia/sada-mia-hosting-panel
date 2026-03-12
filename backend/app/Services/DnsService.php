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
        $zoneFile = "{$this->zonesDir}/db.{$domain->domain}";

        // Remove zone file
        $this->shell->run("sudo rm -f {$zoneFile}");

        // Remove from named.conf.local
        $this->removeNamedConfEntry($domain);

        $this->reloadBind();

        $domain->update(['status' => 'inactive', 'dns_managed' => false]);
    }

    /**
     * Sync records (re-generate zone file from DB records).
     */
    public function syncRecords(Domain $domain): void
    {
        if ($domain->dns_managed) {
            $this->generateZone($domain);
        }
    }

    /**
     * Auto-create essential DNS records for a newly created domain.
     * Creates: A record (@), CNAME (www), MX (mail).
     */
    public function createDefaultRecords(Domain $domain): void
    {
        // Detect server IP
        $serverIp = trim(shell_exec("hostname -I 2>/dev/null | awk '{print $1}'") ?? '');
        if (empty($serverIp)) {
            $serverIp = '127.0.0.1';
        }

        $defaults = [
            ['type' => 'A',     'name' => '@',    'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'A',     'name' => 'www',  'value' => $serverIp, 'ttl' => 3600, 'priority' => null],
            ['type' => 'CNAME', 'name' => 'mail', 'value' => $domain->domain . '.', 'ttl' => 3600, 'priority' => null],
            ['type' => 'MX',    'name' => '@',    'value' => 'mail.' . $domain->domain . '.', 'ttl' => 3600, 'priority' => 10],
            ['type' => 'TXT',   'name' => '@',    'value' => 'v=spf1 a mx ~all', 'ttl' => 3600, 'priority' => null],
        ];

        foreach ($defaults as $rec) {
            // Only create if not already present (idempotent)
            $exists = DnsRecord::where('domain_id', $domain->id)
                ->where('type', $rec['type'])
                ->where('name', $rec['name'])
                ->exists();
            if (!$exists) {
                DnsRecord::create(array_merge($rec, ['domain_id' => $domain->id]));
            }
        }
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
        $serial      = now()->format('YmdHi');
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
        // Default NS records
        $lines[] = "@ IN NS ns1.{$zoneDomain}.";
        $lines[] = "@ IN NS ns2.{$zoneDomain}.";
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
}
