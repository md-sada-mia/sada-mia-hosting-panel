<?php

namespace App\Services;

use App\Models\App;
use App\Models\Deployment;

class DeploymentService
{
    public function __construct(
        private ShellService $shell,
        private PortAssignmentService $portService,
        private NginxConfigService $nginxService,
        private PM2Service $pm2Service,
    ) {}

    public function createDeploymentRecord(App $app): Deployment
    {
        return Deployment::create([
            'app_id'     => $app->id,
            'status'     => 'running',
            'started_at' => now(),
        ]);
    }

    public function runDeployment(App $app, Deployment $deployment): void
    {
        try {
            $this->executeDeployment($app, $deployment);
            $deployment->update(['status' => 'success', 'finished_at' => now()]);
            $app->update(['status' => 'running']);
        } catch (\Throwable $e) {
            $deployment->appendLog("\n[ERROR] " . $e->getMessage());
            $deployment->update(['status' => 'failed', 'finished_at' => now()]);
            $app->update(['status' => 'error']);
            throw $e;
        }
    }

    private function executeDeployment(App $app, Deployment $deployment): void
    {
        $basePath = config('hosting.apps_base_path', '/var/www/hosting-apps');
        $deployPath = "{$basePath}/{$app->name}";

        $log = function (string $line) use ($deployment) {
            $deployment->appendLog($line);
        };

        // === Step 1: Clone or pull ===
        $log("[1/6] Cloning / pulling repository...");
        if (is_dir("{$deployPath}/.git")) {
            $exitCode = $this->shell->stream("git pull origin {$app->branch}", $deployPath, $log);
        } else {
            @mkdir($deployPath, 0755, true);
            $exitCode = $this->shell->stream(
                "git clone --branch {$app->branch} --depth 1 {$app->git_url} {$deployPath}",
                $basePath,
                $log
            );
        }
        if ($exitCode !== 0) {
            throw new \RuntimeException("Git clone/pull failed with exit code {$exitCode}");
        }

        // Save deploy path
        $app->update(['deploy_path' => $deployPath]);

        // === Step 2: Write .env file ===
        $log("[2/6] Writing environment variables...");
        $this->writeEnvFile($app);

        // === Step 3: Install dependencies ===
        $log("[3/6] Installing dependencies...");
        if ($app->type === 'laravel') {
            $exitCode = $this->shell->stream(
                "composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev",
                $deployPath,
                $log,
                300
            );
        } else {
            $exitCode = $this->shell->stream("npm ci --production=false", $deployPath, $log, 300);
        }
        if ($exitCode !== 0) {
            throw new \RuntimeException("Dependency installation failed");
        }

        // === Step 4: Build ===
        $log("[4/6] Building project...");
        if ($app->type === 'nextjs') {
            $exitCode = $this->shell->stream("npm run build", $deployPath, $log, 600);
            if ($exitCode !== 0) {
                throw new \RuntimeException("Next.js build failed");
            }
        } elseif ($app->type === 'laravel') {
            $this->shell->stream("php artisan migrate --force", $deployPath, $log);
            $this->shell->stream("php artisan optimize", $deployPath, $log);
        }

        // === Step 5: Assign port (Next.js only) ===
        $log("[5/6] Configuring port and Nginx...");
        if ($app->type === 'nextjs') {
            if (!$app->port) {
                $port = $this->portService->assignPort();
                $app->update(['port' => $port]);
                $app->refresh();
            }
        }

        // === Step 6: Nginx config ===
        $this->nginxService->generate($app);

        // === Step 7: Start app ===
        $log("[6/6] Starting application...");
        if ($app->type === 'nextjs') {
            // Stop existing PM2 process if any
            $this->pm2Service->delete($app);
            $result = $this->pm2Service->start($app);
            if ($result['exit_code'] !== 0) {
                throw new \RuntimeException("PM2 start failed: " . $result['output']);
            }
            $this->pm2Service->save();
        }
        // For Laravel/static — PHP-FPM handles requests via Nginx, no extra process needed

        $log("✅ Deployment complete! Domain: {$app->domain}");
    }

    public function writeEnvFile(App $app): void
    {
        if (!$app->deploy_path) {
            return;
        }

        $envVars = $app->envVariables()->get();
        $lines = [];
        foreach ($envVars as $env) {
            $lines[] = "{$env->key}=" . escapeshellarg($env->value ?? '');
        }

        // For Next.js, add PORT
        if ($app->type === 'nextjs' && $app->port) {
            $lines[] = "PORT={$app->port}";
        }

        file_put_contents("{$app->deploy_path}/.env", implode("\n", $lines) . "\n");
    }
}
