<?php

namespace App\Services;

use App\Models\App;
use App\Models\AppService;

/**
 * Manages background service processes for apps.
 * Uses PM2 to run arbitrary shell commands as named processes.
 */
class BackgroundServiceManager
{
    public function __construct(private ShellService $shell) {}

    // ─── Recommended services per app type ───────────────────────────────────

    /**
     * Returns an array of recommended service definitions for the given app type.
     * Each item: ['name', 'slug', 'type', 'command', 'description']
     */
    public static function recommendedFor(string $appType): array
    {
        return match ($appType) {
            'laravel' => [
                [
                    'name'        => 'Queue Worker',
                    'slug'        => 'queue-worker',
                    'type'        => 'php-worker',
                    'command'     => 'php artisan queue:work --sleep=3 --tries=3 --max-time=3600',
                    'description' => 'Processes queued jobs (emails, notifications, etc.)',
                    'recommended' => true,
                ],
                [
                    'name'        => 'Schedule Runner',
                    'slug'        => 'scheduler',
                    'type'        => 'php-worker',
                    'command'     => 'php artisan schedule:work',
                    'description' => 'Runs the Laravel task scheduler every minute',
                    'recommended' => true,
                ],
                [
                    'name'        => 'Horizon (Queue Dashboard)',
                    'slug'        => 'horizon',
                    'type'        => 'php-worker',
                    'command'     => 'php artisan horizon',
                    'description' => 'Redis-based queue monitoring dashboard (requires Horizon package)',
                    'recommended' => false,
                ],
            ],
            'nextjs' => [
                [
                    'name'        => 'Next.js App Server',
                    'slug'        => 'nextjs-server',
                    'type'        => 'node-worker',
                    'command'     => 'npm run start',
                    'description' => 'The primary Next.js production process (managed via PM2)',
                    'recommended' => true,
                ],
            ],
            default => [],
        };
    }

    // ─── Process management via PM2 ──────────────────────────────────────────

    public function start(AppService $service): array
    {
        $app     = $service->app;
        $pname   = $service->getProcessName();
        $cwd     = $app->deploy_path;
        $cmd     = $service->command;

        // First delete any stale process with same name
        $this->shell->run("pm2 delete \"{$pname}\" 2>/dev/null; true");

        $fullCmd = "pm2 start --name \"{$pname}\" sh -- -c " . escapeshellarg($cmd);
        $result  = $this->shell->run($fullCmd, $cwd);

        $this->shell->run("pm2 save");

        $status = $result['exit_code'] === 0 ? 'running' : 'failed';
        $service->update([
            'status'     => $status,
            'started_at' => $result['exit_code'] === 0 ? now() : null,
        ]);

        return $result;
    }

    public function stop(AppService $service): array
    {
        $pname  = $service->getProcessName();
        $result = $this->shell->run("pm2 stop \"{$pname}\"");

        $service->update(['status' => $result['exit_code'] === 0 ? 'stopped' : 'failed']);
        return $result;
    }

    public function restart(AppService $service): array
    {
        $pname  = $service->getProcessName();
        $result = $this->shell->run("pm2 restart \"{$pname}\"");

        $status = $result['exit_code'] === 0 ? 'running' : 'failed';
        $service->update(['status' => $status]);
        return $result;
    }

    public function delete(AppService $service): void
    {
        $pname = $service->getProcessName();
        $this->shell->run("pm2 delete \"{$pname}\" 2>/dev/null; true");
        $this->shell->run("pm2 save");
    }

    public function logs(AppService $service, int $lines = 150): string
    {
        $pname  = $service->getProcessName();
        $result = $this->shell->run("pm2 logs \"{$pname}\" --nostream --lines {$lines} 2>&1");
        return $result['output'] ?: '(no logs yet)';
    }

    /**
     * Sync live PM2 status into the DB records for an App's services.
     */
    public function syncStatus(App $app): void
    {
        $result = $this->shell->run("pm2 jlist");
        if ($result['exit_code'] !== 0) return;

        $processes = json_decode($result['output'], true) ?? [];
        $byName = collect($processes)->keyBy('name');

        foreach ($app->services as $service) {
            $pname  = $service->getProcessName();
            $proc   = $byName->get($pname);
            if ($proc) {
                $pm2Status = $proc['pm2_env']['status'] ?? 'unknown';
                // Map pm2 statuses to our enum
                $status = match ($pm2Status) {
                    'online'    => 'running',
                    'stopped'   => 'stopped',
                    'errored'   => 'failed',
                    'stopping'  => 'stopped',
                    default     => 'unknown',
                };
                $service->update(['status' => $status]);
            } else {
                // Not found in PM2 — mark as stopped/unknown only if it was expected to run
                if ($service->status === 'running') {
                    $service->update(['status' => 'stopped']);
                }
            }
        }
    }

    /**
     * Install all recommended services for an app (called post-deploy).
     * Only creates DB records; doesn't auto-start to give user control.
     */
    public function installRecommended(App $app): void
    {
        $recommendations = self::recommendedFor($app->type);

        foreach ($recommendations as $rec) {
            $exists = $app->services()->where('slug', $rec['slug'])->exists();
            if (!$exists) {
                $app->services()->create([
                    'name'        => $rec['name'],
                    'slug'        => $rec['slug'],
                    'type'        => $rec['type'],
                    'command'     => $rec['command'],
                    'description' => $rec['description'],
                    'recommended' => $rec['recommended'],
                    'enabled'     => true,
                    'status'      => 'stopped',
                ]);
            }
        }
    }
}
