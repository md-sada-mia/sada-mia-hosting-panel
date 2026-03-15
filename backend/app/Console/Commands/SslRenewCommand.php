<?php

namespace App\Console\Commands;

use App\Models\App;
use App\Services\SslService;
use App\Services\CronLogService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SslRenewCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:ssl-renew';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Renew all SSL certificates using Certbot and update database status';

    /**
     * Execute the console command.
     */
    public function handle(SslService $sslService, CronLogService $logService)
    {
        $this->info('Starting SSL renewal process...');
        Log::info('Artisan: app:ssl-renew started.');

        $cronLog = $logService->start(null, 'app:ssl-renew');

        try {
            $result = $sslService->renewAll();
            $output = $result['output'] ?? 'No output';

            if ($result['exit_code'] === 0) {
                $status = 'success';
                $this->info('Certbot renewal command executed successfully.');
                Log::info('Certbot renewal command output: ' . $output);
            } else {
                $status = 'failed';
                $this->error('Certbot renewal command failed with exit code ' . $result['exit_code']);
                Log::error('Certbot renewal error: ' . $output);
            }

            // Sync all apps with enabled SSL to update their last check/expiry
            $apps = App::where('ssl_enabled', true)->get();
            foreach ($apps as $app) {
                $this->info("Syncing SSL status for {$app->domain}...");
                $sslService->syncStatus($app);
            }

            $logService->finish($cronLog, $status, $output);
            $this->info('SSL renewal process completed.');
            Log::info('Artisan: app:ssl-renew completed.');
        } catch (\Exception $e) {
            $logService->finish($cronLog, 'failed', "Exception: " . $e->getMessage());
            throw $e;
        }
    }
}
