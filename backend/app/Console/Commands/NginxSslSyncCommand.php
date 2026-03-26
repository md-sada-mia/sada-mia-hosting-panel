<?php

namespace App\Console\Commands;

use App\Models\App;
use App\Models\LoadBalancer;
use App\Services\NginxConfigService;
use Illuminate\Console\Command;

class NginxSslSyncCommand extends Command
{
    protected $signature   = 'app:nginx-ssl-sync';
    protected $description = 'Regenerate Nginx SSL configuration files for all apps using current stubs';

    public function handle(NginxConfigService $nginxService): int
    {
        // ── Regular Apps ──────────────────────────────────────────────────────
        $apps = App::where('ssl_enabled', true)->get();

        if ($apps->isEmpty()) {
            $this->info('No SSL-enabled apps found.');
        } else {
            $this->info("Found {$apps->count()} SSL-enabled apps. Regenerating SSL configs...");

            foreach ($apps as $app) {
                $this->info("  Syncing SSL for: {$app->domain}...");
                try {
                    $nginxService->generateSsl($app);
                    $this->info('    Done.');
                } catch (\Exception $e) {
                    $this->error("    Failed for {$app->domain}: " . $e->getMessage());
                }
            }
        }

        // ── Load-Balancer Domains ─────────────────────────────────────────────
        $lbs = LoadBalancer::with('domains')->get();

        foreach ($lbs as $lb) {
            foreach ($lb->domains as $lbDomain) {
                if (!$lbDomain->ssl_enabled) continue;

                $this->info("  Syncing SSL for LB domain: {$lbDomain->domain}...");
                try {
                    $nginxService->generateLoadBalancerSsl($lb, $lbDomain);
                    $this->info('    Done.');
                } catch (\Exception $e) {
                    $this->error("    Failed for {$lbDomain->domain}: " . $e->getMessage());
                }
            }
        }

        $this->info('Nginx SSL sync complete.');
        return 0;
    }
}
