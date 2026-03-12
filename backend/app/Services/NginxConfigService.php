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

    public function generateLoadBalancer(\App\Models\LoadBalancer $lb): void
    {
        $stub = $this->getStub('load_balancer');

        $domainsStr = $lb->domains->pluck('domain')->implode(' ');

        $upstreams = [];
        foreach ($lb->apps as $app) {
            if ($app->port) {
                $upstreams[] = "    server 127.0.0.1:{$app->port};";
            } else {
                // Determine port from internal Docker or Nginx IP/Port. 
                // Since this panel is bare-metal Nginx without docker right now (based on other configs), 
                // we can't easily proxy to another domain port 80 unless they resolve internally. 
                // Using 127.0.0.1 and asking the downstream server block to handle it.
                // Wait, if it's purely PHP-FPM, we could map it directly, but it's simpler to proxy to the app domain.
                $upstreams[] = "    server 127.0.0.1:80;"; // Or perhaps require Next.js apps with ports, but let's just proxy to the app's server domain name internally
                // $upstreams[] = "    server {$app->domain}:80;";
            }
        }

        // Let's proxy to the domain name of the app so its existing Nginx server block handles it, if it doesn't have a port.
        foreach ($upstreams as &$u) {
            $u = trim($u);
        }
        $upstreams = [];
        foreach ($lb->apps as $app) {
            if ($app->port) {
                $upstreams[] = "    server 127.0.0.1:{$app->port};";
            } else {
                $upstreams[] = "    server {$app->domain}:80;";
            }
        }

        $methodLine = '';
        if ($lb->method === 'least_conn') {
            $methodLine = 'least_conn;';
        } elseif ($lb->method === 'ip_hash') {
            $methodLine = 'ip_hash;';
        }

        $config = str_replace(
            ['{{lb_id}}', '{{method}}', '{{upstreams}}', '{{domains}}'],
            [
                $lb->id,
                $methodLine,
                implode("\n", $upstreams),
                $domainsStr
            ],
            $stub
        );

        $lbNameSafe = preg_replace('/[^a-zA-Z0-9_]/', '_', $lb->name);
        $confName = "lb_{$lbNameSafe}_{$lb->id}";

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $configFile     = "{$sitesAvailable}/{$confName}";
        $symlinkFile    = "{$sitesEnabled}/{$confName}";

        $shell = app(ShellService::class);
        $escapedConfig = escapeshellarg($config);
        $shell->run("echo {$escapedConfig} | sudo tee {$configFile} > /dev/null");

        if (!file_exists($symlinkFile)) {
            $shell->run("sudo ln -sf {$configFile} {$symlinkFile}");
        }

        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function removeLoadBalancer(\App\Models\LoadBalancer $lb): void
    {
        $lbNameSafe = preg_replace('/[^a-zA-Z0-9_]/', '_', $lb->name);
        $confName = "lb_{$lbNameSafe}_{$lb->id}";

        $shell = app(ShellService::class);
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$confName}");
        $shell->run("sudo rm -f /etc/nginx/sites-available/{$confName}");
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
