<?php

namespace App\Console\Commands;

use App\Models\App;
use App\Services\SslService;
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
    public function handle(SslService $sslService)
    {
        $this->info('Starting SSL renewal process...');
        Log::info('Artisan: app:ssl-renew started.');

        $result = $sslService->renewAll();

        if ($result['exit_code'] === 0) {
            $this->info('Certbot renewal command executed successfully.');
            Log::info('Certbot renewal command output: ' . ($result['output'] ?? 'No output'));
        } else {
            $this->error('Certbot renewal command failed with exit code ' . $result['exit_code']);
            Log::error('Certbot renewal error: ' . ($result['output'] ?? 'Unknown error'));
        }

        // Sync all apps with enabled SSL to update their last check/expiry
        $apps = App::where('ssl_enabled', true)->get();
        foreach ($apps as $app) {
            $this->info("Syncing SSL status for {$app->domain}...");
            $sslService->syncStatus($app);
        }

        $this->info('SSL renewal process completed.');
        Log::info('Artisan: app:ssl-renew completed.');
    }
}
