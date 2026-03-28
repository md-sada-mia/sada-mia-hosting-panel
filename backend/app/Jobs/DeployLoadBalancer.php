<?php

namespace App\Jobs;

use App\Models\Customer;
use App\Models\CustomerDeployment;
use App\Services\DeploymentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DeployLoadBalancer implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600;

    public function __construct(
        protected Customer $customer,
        protected CustomerDeployment $deployment
    ) {}

    public function handle(DeploymentService $deploymentService): void
    {
        try {
            $deploymentService->runLoadBalancerDeployment($this->customer, $this->deployment);
        } catch (\Throwable $e) {
            Log::error('Background LB Deployment Failed', [
                'customer_id' => $this->customer->id,
                'deployment_id' => $this->deployment->id,
                'error' => $e->getMessage()
            ]);

            $this->deployment->update(['status' => 'failed', 'finished_at' => now()]);
            $this->deployment->appendLog("\n[ERROR] " . $e->getMessage());

            $this->fail($e);
        }
    }
}
