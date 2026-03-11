<?php

namespace App\Services;

use App\Models\App;

class PM2Service
{
    public function __construct(private ShellService $shell) {}

    public function start(App $app): array
    {
        $name = $app->domain;
        $path = $app->deploy_path;

        // Next.js uses `npm run start` bound to specific port
        $command = "PORT={$app->port} pm2 start npm --name \"{$name}\" -- run start";
        return $this->shell->run($command, $path);
    }

    public function stop(App $app): array
    {
        return $this->shell->run("pm2 stop \"{$app->domain}\"");
    }

    public function restart(App $app): array
    {
        return $this->shell->run("pm2 restart \"{$app->domain}\"");
    }

    public function delete(App $app): array
    {
        return $this->shell->run("pm2 delete \"{$app->domain}\"");
    }

    public function status(App $app): string
    {
        $result = $this->shell->run("pm2 jlist");
        if ($result['exit_code'] !== 0) {
            return 'unknown';
        }

        $processes = json_decode($result['output'], true) ?? [];
        foreach ($processes as $proc) {
            if ($proc['name'] === $app->domain) {
                return $proc['pm2_env']['status'] ?? 'unknown';
            }
        }
        return 'stopped';
    }

    public function logs(App $app, int $lines = 100): string
    {
        $result = $this->shell->run("pm2 logs \"{$app->domain}\" --nostream --lines {$lines}");
        return $result['output'];
    }

    public function save(): void
    {
        $this->shell->run("pm2 save");
    }
}
