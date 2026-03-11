<?php

namespace App\Jobs;

use App\Models\App;
use App\Models\Domain;
use App\Services\PM2Service;
use App\Services\NginxConfigService;
use App\Services\DnsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DeleteApp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        protected array $appData
    ) {}

    public function handle(PM2Service $pm2Service, NginxConfigService $nginxService, DnsService $dnsService): void
    {
        try {
            // We work with a temporary App model instance since the original might be deleted
            $app = new App($this->appData);
            $app->id = $this->appData['id'];

            if ($app->type === 'nextjs') {
                $pm2Service->delete($app);
            }

            $nginxService->remove($app);

            // Also remove the DNS zone for this app's domain
            $domain = Domain::where('app_id', $app->id)->first();
            if ($domain) {
                $dnsService->removeZone($domain);
                $domain->delete();
            }

            Log::info("Cleanup complete for app: {$app->name}");
        } catch (\Throwable $e) {
            Log::error("Cleanup failed for app: " . ($this->appData['name'] ?? 'unknown'), [
                'error' => $e->getMessage()
            ]);
        }
    }
}
