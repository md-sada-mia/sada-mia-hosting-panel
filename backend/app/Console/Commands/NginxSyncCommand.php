<?php

namespace App\Console\Commands;

use App\Models\App;
use App\Services\NginxConfigService;
use Illuminate\Console\Command;

class NginxSyncCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:nginx-sync';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Regenerate Nginx configuration files for all apps using current stubs';

    /**
     * Execute the console command.
     */
    public function handle(NginxConfigService $nginxService)
    {
        $apps = App::all();

        if ($apps->isEmpty()) {
            $this->info("No apps found to sync.");
            return 0;
        }

        $this->info("Found " . $apps->count() . " apps. Regenerating configurations...");

        foreach ($apps as $app) {
            $this->info("Syncing Nginx for: {$app->domain}...");
            try {
                $nginxService->generate($app);
                $this->info("  Done.");
            } catch (\Exception $e) {
                $this->error("  Failed for {$app->domain}: " . $e->getMessage());
            }
        }

        $this->info("Nginx sync complete.");
        return 0;
    }
}
