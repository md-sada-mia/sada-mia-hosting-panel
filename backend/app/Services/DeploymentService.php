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

        $gitUrl = $app->git_url;

        // If this app is linked to the panel's GitHub integration, inject the token to allow cloning private repos
        if ($app->github_id || $app->github_full_name) {
            $token = \App\Models\Setting::get('github_access_token');
            if ($token && preg_match('#^https://github\.com/#', $gitUrl)) {
                $log("Authorized GitHub app detected. Injecting access token into clone URL...");
                // x-access-token is the standard username for GitHub Apps/OAuth tokens in URLs
                $gitUrl = preg_replace('#^https://github\.com/#', "https://x-access-token:{$token}@github.com/", $gitUrl);
            }
        }

        if (is_dir("{$deployPath}/.git")) {
            // Ensure remote URL has the token (or is updated if it changed)
            $this->shell->run("git -C " . escapeshellarg($deployPath) . " remote set-url origin " . escapeshellarg($gitUrl));
            $exitCode = $this->shell->stream("git pull origin " . escapeshellarg($app->branch), $deployPath, $log);
        } else {
            @mkdir($deployPath, 0755, true);
            $cloneCmd = "git clone --branch " . escapeshellarg($app->branch) . " --depth 1 " . escapeshellarg($gitUrl) . " " . escapeshellarg($deployPath);
            $exitCode = $this->shell->stream($cloneCmd, $basePath, $log);
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
            $log("Attempting clear-cut install (npm ci)...");
            $exitCode = $this->shell->stream("npm ci --production=false", $deployPath, $log, 300);

            if ($exitCode !== 0) {
                $log("[WARN] npm ci failed (likely unsynced lock file). Falling back to npm install...");
                $exitCode = $this->shell->stream("npm install --production=false --no-audit --no-fund", $deployPath, $log, 300);
            }
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
        $envFile = $app->getEnvFilePath();
        $envContent = file_get_contents($envFile);
        if (!str_contains($envContent, 'APP_KEY=base64:')) {
            // Ensure the placeholder exists, otherwise key:generate fails
            if (!str_contains($envContent, 'APP_KEY=')) {
                $log("Adding APP_KEY placeholder to " . basename($envFile) . "...");
                file_put_contents($envFile, $envContent . "\nAPP_KEY=\n");
            }

            $log("Generating new application key...");
            $result = $this->shell->run("php artisan key:generate --force", $deployPath);
            if ($result['exit_code'] !== 0) {
                $log("[WARN] Key generation failed: " . $result['output']);
            }
        }

        // Link storage
        $result = $this->shell->run("php artisan storage:link", $deployPath);
        if ($result['exit_code'] !== 0) {
            $log("[WARN] Storage link failed: " . $result['output']);
        }
    }

    public function writeEnvFile(App $app): void
    {
        if (!$app->deploy_path) {
            return;
        }

        $deployPath = $app->deploy_path;
        $envFile = $app->getEnvFilePath();
        $envFileName = basename($envFile);

        // 1. If the environment file doesn't exist, try to template it from an example file
        if (!file_exists($envFile)) {
            $templateFile = null;

            // Scan for example files using regex
            $files = is_dir($deployPath) ? scandir($deployPath) : [];
            $regex = '/^\.env\.(example|sample|demo|template|dist)$|^\.env-example$/i';
            $exampleFiles = preg_grep($regex, $files);

            if (!empty($exampleFiles)) {
                $templateFile = reset($exampleFiles);
            } else {
                // Fallback: search for any file containing ".env" except the target file itself
                $fallbackRegex = '/\.env/i';
                $fallbackFiles = preg_grep($fallbackRegex, $files);
                foreach ($fallbackFiles as $file) {
                    if ($file !== $envFileName) {
                        $templateFile = $file;
                        break;
                    }
                }
            }

            if ($templateFile && file_exists("{$deployPath}/{$templateFile}")) {
                $this->shell->run("cp " . escapeshellarg("{$deployPath}/{$templateFile}") . " " . escapeshellarg($envFile));
            }
        }

        // 2. Ensure mandatory and database variables using non-destructive regex
        if (file_exists($envFile)) {
            $content = file_get_contents($envFile);
            $varsToUpdate = [];

            if ($app->type === 'nextjs' && $app->port) {
                $varsToUpdate['PORT'] = $app->port;
            }
            if ($app->type === 'laravel') {
                $varsToUpdate['APP_KEY'] = ''; // Ensure placeholder exists if missing
            }

            // Inject Database credentials if any associated databases exist
            $db = $app->databases()->first();
            if ($db) {
                $varsToUpdate = array_merge($varsToUpdate, [
                    'DB_CONNECTION' => 'pgsql',
                    'DB_HOST'       => '127.0.0.1',
                    'DB_PORT'       => '5432',
                    'DB_DATABASE'   => $db->db_name,
                    'DB_USERNAME'   => $db->db_user,
                    'DB_PASSWORD'   => $db->db_password,
                ]);
            }

            if (!empty($varsToUpdate)) {
                $updated = false;
                foreach ($varsToUpdate as $key => $value) {
                    $pattern = "/^(\s*#?\s*)" . preg_quote($key, '/') . "=.*/m";
                    if (preg_match($pattern, $content)) {
                        $content = preg_replace($pattern, "{$key}={$value}", $content);
                        $updated = true;
                    } else {
                        // Key missing entirely. Append it.
                        $content .= (empty($content) || str_ends_with($content, "\n") ? "" : "\n") . "{$key}={$value}\n";
                        $updated = true;
                    }
                }

                if ($updated) {
                    file_put_contents($envFile, $content);
                }
            }
        }
    }
}
