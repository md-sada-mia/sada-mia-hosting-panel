<?php

namespace App\Services;

use App\Models\App;

class NginxConfigService
{
    public function generate(App $app): void
    {
        $stub = $this->getStub($app->type);
        $config = $this->replacePlaceholders($stub, $app);

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $configFile     = "{$sitesAvailable}/{$app->domain}";
        $symlinkFile    = "{$sitesEnabled}/{$app->domain}";

        // Write config via shell (needs sudo)
        $shell = app(ShellService::class);

        // Write using tee (sudo)
        $escapedConfig = escapeshellarg($config);
        $shell->run("echo {$escapedConfig} | sudo tee {$configFile} > /dev/null");

        // Create symlink if not created
        if (!file_exists($symlinkFile)) {
            $shell->run("sudo ln -sf {$configFile} {$symlinkFile}");
        }

        // Nginx config test + reload
        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function remove(App $app): void
    {
        $shell = app(ShellService::class);
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$app->domain}");
        $shell->run("sudo rm -f /etc/nginx/sites-available/{$app->domain}");
        $shell->run("sudo nginx -s reload");
    }

    private function getStub(string $type): string
    {
        $stubPath = resource_path("nginx-templates/{$type}.conf.stub");
        if (!file_exists($stubPath)) {
            throw new \RuntimeException("Nginx stub not found for type: {$type}");
        }
        return file_get_contents($stubPath);
    }

    private function replacePlaceholders(string $stub, App $app): string
    {
        return str_replace(
            ['{{domain}}', '{{port}}', '{{deploy_path}}', '{{php_fpm_sock}}'],
            [
                $app->domain,
                $app->port,
                $app->deploy_path,
                config('hosting.php_fpm_sock', '/var/run/php/php8.4-fpm.sock'),
            ],
            $stub
        );
    }
}
