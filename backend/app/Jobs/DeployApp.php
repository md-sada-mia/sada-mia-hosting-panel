<?php

namespace App\Jobs;

use App\Models\App;
use App\Models\Deployment;
use App\Services\DeploymentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DeployApp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes

    public function __construct(
        protected App $app,
        protected Deployment $deployment
    ) {}

    public function handle(DeploymentService $deploymentService): void
    {
        try {
            $deploymentService->runDeployment($this->app, $this->deployment);
        } catch (\Throwable $e) {
            Log::error('Background Deployment Failed', [
                'app_id' => $this->app->id,
                'deployment_id' => $this->deployment->id,
                'error' => $e->getMessage()
            ]);

            // The DeploymentService already handles model status updates
            $this->fail($e);
        }
    }
}
