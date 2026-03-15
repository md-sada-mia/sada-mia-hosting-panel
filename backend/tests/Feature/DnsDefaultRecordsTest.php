<?php

namespace Tests\Feature;

use App\Models\Domain;
use App\Models\DnsRecord;
use App\Models\Setting;
use App\Services\DnsService;
use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class DnsDefaultRecordsTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_ns1_to_ns4_a_records_by_default()
    {
        $dnsService = app(DnsService::class);
        $domain = Domain::create([
            'domain' => 'example.com',
            'status' => 'pending',
            'dns_managed' => true,
        ]);

        $dnsService->createDefaultRecords($domain);

        $this->assertDatabaseHas('dns_records', [
            'domain_id' => $domain->id,
            'type' => 'A',
            'name' => 'ns1',
        ]);
        $this->assertDatabaseHas('dns_records', [
            'domain_id' => $domain->id,
            'type' => 'A',
            'name' => 'ns2',
        ]);
        $this->assertDatabaseHas('dns_records', [
            'domain_id' => $domain->id,
            'type' => 'A',
            'name' => 'ns3',
        ]);
        $this->assertDatabaseHas('dns_records', [
            'domain_id' => $domain->id,
            'type' => 'A',
            'name' => 'ns4',
        ]);

        $this->assertDatabaseHas('dns_records', [
            'domain_id' => $domain->id,
            'type' => 'NS',
            'name' => '@',
        ]);
    }

    public function test_it_auto_sets_global_nameservers_on_first_managed_domain_creation()
    {
        $dnsService = app(DnsService::class);

        // Ensure settings are empty
        Setting::whereIn('key', ['dns_default_ns1', 'dns_default_ns2', 'dns_default_ns3', 'dns_default_ns4'])->delete();

        $dnsService->createManagedDomain('first-domain.com');

        $this->assertEquals('ns1.first-domain.com.', Setting::get('dns_default_ns1'));
        $this->assertEquals('ns2.first-domain.com.', Setting::get('dns_default_ns2'));
        $this->assertEquals('ns3.first-domain.com.', Setting::get('dns_default_ns3'));
        $this->assertEquals('ns4.first-domain.com.', Setting::get('dns_default_ns4'));
    }

    public function test_it_uses_dns_default_domain_for_auto_initialization()
    {
        $dnsService = app(DnsService::class);

        // Ensure settings are empty
        Setting::whereIn('key', ['dns_default_ns1', 'dns_default_ns2', 'dns_default_ns3', 'dns_default_ns4'])->delete();
        Setting::set('ns_default_domain', 'global-ns.net');

        $dnsService->createManagedDomain('my-app.com');

        $this->assertEquals('ns3.global-ns.net.', Setting::get('dns_default_ns3'));
        $this->assertEquals('ns4.global-ns.net.', Setting::get('dns_default_ns4'));
    }

    public function test_it_falls_back_to_app_domain_if_ns_default_domain_is_empty_string()
    {
        $dnsService = app(DnsService::class);

        Setting::whereIn('key', ['dns_default_ns1', 'dns_default_ns2'])->delete();
        Setting::set('ns_default_domain', ''); // Exists but empty

        $dnsService->createManagedDomain('fallback.com');

        $this->assertEquals('ns1.fallback.com.', Setting::get('dns_default_ns1'));
        $this->assertEquals('ns2.fallback.com.', Setting::get('dns_default_ns2'));
    }

    public function test_zone_content_includes_four_nameservers()
    {
        $dnsService = app(DnsService::class);

        Setting::set('dns_default_ns1', 'ns1.mypanel.com.');
        Setting::set('dns_default_ns2', 'ns2.mypanel.com.');
        Setting::set('dns_default_ns3', 'ns3.mypanel.com.');
        Setting::set('dns_default_ns4', 'ns4.mypanel.com.');

        $domain = Domain::create([
            'domain' => 'test-zone.com',
            'status' => 'active',
            'dns_managed' => true,
        ]);

        $dnsService->createDefaultRecords($domain);

        $reflection = new \ReflectionClass(DnsService::class);
        $method = $reflection->getMethod('buildZoneContent');
        $method->setAccessible(true);

        $content = $method->invoke($dnsService, $domain);

        // Should not have TTL in NS records (e.g., "@ 3600 IN NS")
        $this->assertStringNotContainsString('3600 IN NS', $content);
        $this->assertStringContainsString("@ IN NS ns1.mypanel.com.\n", $content);
        $this->assertStringContainsString("@ IN NS ns2.mypanel.com.\n", $content);
        $this->assertStringContainsString("@ IN NS ns3.mypanel.com.\n", $content);
        $this->assertStringContainsString("@ IN NS ns4.mypanel.com.\n", $content);

        // Check placement: NS records should be after the SOA block and before A records
        $soaEndPos = strpos($content, 'Minimum TTL');
        $nsPos = strpos($content, '@ IN NS');
        $aPos = strpos($content, '3600 IN A');

        $this->assertGreaterThan($soaEndPos, $nsPos, 'NS records should be after SOA');
        $this->assertGreaterThan($nsPos, $aPos, 'A records should be after NS records');
    }
    public function test_it_does_not_create_ns_a_records_if_another_domain_is_set_as_default()
    {
        $dnsService = app(DnsService::class);

        Setting::set('ns_default_domain', 'primary.com');

        $domain = Domain::create([
            'domain' => 'secondary.com',
            'status' => 'pending',
            'dns_managed' => true,
        ]);

        $dnsService->createDefaultRecords($domain);

        $this->assertDatabaseMissing('dns_records', [
            'domain_id' => $domain->id,
            'type' => 'A',
            'name' => 'ns1',
        ]);

        // Should still have NS records
        $this->assertDatabaseHas('dns_records', [
            'domain_id' => $domain->id,
            'type' => 'NS',
            'name' => '@',
        ]);
    }
}
