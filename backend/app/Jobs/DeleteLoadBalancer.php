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
                    $dnsService->removeDomain($domainName);
                }
            }

            Log::info("Cleanup complete for load balancer: {$lb->name}");
        } catch (\Throwable $e) {
            Log::error("Cleanup failed for load balancer: " . ($this->lbData['name'] ?? 'unknown'), [
                'error' => $e->getMessage()
            ]);
        }
    }
}
