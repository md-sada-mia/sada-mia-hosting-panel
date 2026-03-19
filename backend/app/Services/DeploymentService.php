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
        private DnsService $dnsService,
        private SslService $sslService,
        private BackgroundServiceManager $bgServiceManager,
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
        $deployPath = "{$basePath}/{$app->domain}";

        $log = function (string $line) use ($deployment) {
            $deployment->appendLog($line);
        };

        // === Step 1: Clone or pull ===
        $log("[1/6] Cloning / pulling repository...");

        // Fix: Mark directory as safe for git to avoid "dubious ownership" errors
        $this->shell->run("git config --global --add safe.directory " . escapeshellarg($deployPath));

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

        // Ensure www-data owns the files before we try to install dependencies (important for npm/composer)
        $currentUser = trim(shell_exec('whoami'));
        if ($currentUser !== 'www-data') {
            $this->shell->run("sudo chown -R www-data:www-data " . escapeshellarg($deployPath));
        }

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
            $errorMsg = ($app->type === 'laravel') ? "Composer installation failed" : "NPM dependency installation failed";
            throw new \RuntimeException("{$errorMsg} with exit code {$exitCode}. Check that /var/www/.npm is owned by www-data if this is an EACCES error.");
        }

        // === Step 4: Build & Bootstrap ===
        $log("[4/6] Building project and bootstrapping...");
        if ($app->type === 'nextjs') {
            $exitCode = $this->shell->stream("npm run build", $deployPath, $log, 600);
            if ($exitCode !== 0) {
                throw new \RuntimeException("Next.js build failed");
            }
        } elseif ($app->type === 'laravel') {
            $this->bootstrapLaravel($app, $deployPath, $log);
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

        // === Step 7: Finalize Permissions & Start ===
        $log("[6/6] Finalizing permissions and starting...");

        // Final recursive chown and permission fix to ensure www-data can write to everything
        // Optimization: Skip recursive chown if we are already running as www-data
        $currentUser = trim(shell_exec('whoami'));
        if ($currentUser !== 'www-data') {
            $this->shell->run("sudo chown -R www-data:www-data " . escapeshellarg($deployPath));
        }

        if ($app->type === 'laravel') {
            // Only chmod the directories that actually need it, faster than the whole tree
            $this->shell->run("sudo chmod -R 775 " . escapeshellarg("{$deployPath}/storage") . " " . escapeshellarg("{$deployPath}/bootstrap/cache"));
        }

        if ($app->type === 'nextjs') {
            // Stop existing PM2 process if any
            $this->pm2Service->delete($app);
            $result = $this->pm2Service->start($app);
            if ($result['exit_code'] !== 0) {
                throw new \RuntimeException("PM2 start failed: " . $result['output']);
            }
            $this->pm2Service->save();
        }

        $dnsOutput = $this->dnsService->reloadBind($app->domainRecord);
        $log($dnsOutput);

        // === Step 9: SSL Setup (New) ===
        if ($app->ssl_enabled) {
            $log("[SSL] Re-verifying SSL setup...");
            $sslResult = $this->sslService->setupSsl($app);
            $log($sslResult['message']);
        }

        // === Step 10: Install recommended background services ===
        $log("[BG] Registering recommended background services...");
        try {
            $this->bgServiceManager->installRecommended($app);
            $log("[BG] Background services registered. Start them from the Services tab.");
        } catch (\Throwable $e) {
            $log("[BG] Warning: could not register background services: " . $e->getMessage());
        }

        $log("✅ Deployment complete! Domain: {$app->domain}");
    }

    private function bootstrapLaravel(App $app, string $deployPath, \Closure $log): void
    {
        $log("Bootstrapping Laravel filesystem and environment...");

        // Ensure critical storage subdirectories exist
        $directories = [
            "{$deployPath}/storage/app/public",
            "{$deployPath}/storage/framework/cache",
            "{$deployPath}/storage/framework/sessions",
            "{$deployPath}/storage/framework/views",
            "{$deployPath}/storage/logs",
            "{$deployPath}/bootstrap/cache",
        ];

        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
        }

        // Generate APP_KEY if it's not already in the .env or if it's the default
        $envContent = file_get_contents("{$deployPath}/.env");
        if (!str_contains($envContent, 'APP_KEY=base64:')) {
            $log("Generating new application key...");
            $this->shell->run("php artisan key:generate --force", $deployPath);
        }

        // Link storage
        $this->shell->run("php artisan storage:link", $deployPath);
    }

    public function writeEnvFile(App $app): void
    {
        if (!$app->deploy_path) {
            return;
        }

        $content = $app->env_vars ?? '';
        $lines = explode("\n", $content);

        // For Next.js, ensure PORT is present
        if ($app->type === 'nextjs' && $app->port) {
            $hasPort = false;
            foreach ($lines as $line) {
                if (str_starts_with(trim($line), 'PORT=')) {
                    $hasPort = true;
                    break;
                }
            }
            if (!$hasPort) {
                $content .= ($content ? "\n" : "") . "PORT={$app->port}";
            }
        }

        file_put_contents("{$app->deploy_path}/.env", $content . "\n");
    }
}
