<?php

namespace App\Jobs;

use App\Models\App;
use App\Services\PM2Service;
use App\Services\NginxConfigService;
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

    public function handle(PM2Service $pm2Service, NginxConfigService $nginxService): void
    {
        try {
            // We work with a temporary App model instance since the original might be deleted
            $app = new App($this->appData);
            $app->id = $this->appData['id'];

            if ($app->type === 'nextjs') {
                $pm2Service->delete($app);
            }

            $nginxService->remove($app);

            Log::info("Cleanup complete for app: {$app->name}");
        } catch (\Throwable $e) {
            Log::error("Cleanup failed for app: " . ($this->appData['name'] ?? 'unknown'), [
                'error' => $e->getMessage()
            ]);
        }
    }
}
