<?php

namespace App\Jobs;

use App\Models\LoadBalancer;
use App\Models\Domain;
use App\Models\DnsRecord;
use App\Services\NginxConfigService;
use App\Services\DnsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DeleteLoadBalancer implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        protected array $lbData
    ) {}

    public function handle(NginxConfigService $nginxService, DnsService $dnsService): void
    {
        try {
            // Reconstruct a temporary model for service consumption
            $lb = new LoadBalancer($this->lbData);
            $lb->id = $this->lbData['id'];

            // 1. Cleanup Nginx
            $nginxService->removeLoadBalancer($lb);

            // 2. Cleanup DNS Records for each domain
            if (!empty($this->lbData['domains'])) {
                foreach ($this->lbData['domains'] as $domainName) {
                    $this->cleanupDomainDNS($domainName, $dnsService);
                }
            }

            Log::info("Cleanup complete for load balancer: {$lb->name}");
        } catch (\Throwable $e) {
            Log::error("Cleanup failed for load balancer: " . ($this->lbData['name'] ?? 'unknown'), [
                'error' => $e->getMessage()
            ]);
        }
    }

    protected function cleanupDomainDNS(string $domainName, DnsService $dnsService): void
    {
        // 1. Check if it's a dedicated managed zone
        $managedDomain = Domain::where('domain', $domainName)->where('dns_managed', true)->first();
        if ($managedDomain) {
            // If it has no app_id, it might be a zone created by LB. 
            // We'll remove it if it's only serving LB records (which we are about to clear)
            // For simplicity and safety, we remove the zone if app_id is null.
            if ($managedDomain->app_id === null) {
                $dnsService->removeZone($managedDomain);
                $managedDomain->delete();
                return;
            }
        }

        // 2. If it's a record within a parent zone, remove the specific record
        $parts = explode('.', $domainName);
        if (count($parts) < 2) return;

        for ($i = 1; $i < count($parts); $i++) {
            $subdomainParts = array_slice($parts, 0, $i);
            $parentParts = array_slice($parts, $i);

            $subdomain = implode('.', $subdomainParts);
            $parentDomainName = implode('.', $parentParts);

            $parentDomain = Domain::where('domain', $parentDomainName)
                ->where('dns_managed', true)
                ->first();

            if ($parentDomain) {
                DnsRecord::where('domain_id', $parentDomain->id)
                    ->where('type', 'A')
                    ->where('name', $subdomain)
                    ->delete();

                $dnsService->syncRecords($parentDomain);
                break;
            }
        }
    }
}
