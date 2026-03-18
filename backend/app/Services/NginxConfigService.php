<?php

namespace App\Services;

use App\Models\App;

class NginxConfigService
{
    public function generate(App $app): void
    {
        // Always use the base type stub (HTTP)
        $stub = $this->getStub($app->type);
        $config = $this->replacePlaceholders($stub, $app);

        // If force HTTPS is on, we might need to handle it differently.
        // But for now, let's keep the port 80 config as is, or with a redirect if force_https is on.
        if ($app->force_https && $app->ssl_enabled) {
            $config = "server {\n" .
                "    listen 80;\n" .
                "    server_name {$app->domain};\n" .
                "    return 301 https://\$host\$request_uri;\n" .
                "}\n";
        }

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $configFile     = "{$sitesAvailable}/{$app->domain}";
        $symlinkFile    = "{$sitesEnabled}/{$app->domain}";

        $shell = app(ShellService::class);
        $escapedConfig = escapeshellarg($config);
        $shell->run("echo {$escapedConfig} | sudo tee {$configFile} > /dev/null");

        if (!file_exists($symlinkFile)) {
            $shell->run("sudo ln -sf {$configFile} {$symlinkFile}");
        }

        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function generateSsl(App $app): void
    {
        if (!$app->ssl_enabled) return;

        $stub = $this->getStub($app->type . '-ssl');
        $config = $this->replacePlaceholders($stub, $app);

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $configFile     = "{$sitesAvailable}/{$app->domain}-ssl";
        $symlinkFile    = "{$sitesEnabled}/{$app->domain}-ssl";

        $shell = app(ShellService::class);
        $escapedConfig = escapeshellarg($config);
        $shell->run("echo {$escapedConfig} | sudo tee {$configFile} > /dev/null");

        if (!file_exists($symlinkFile)) {
            $shell->run("sudo ln -sf {$configFile} {$symlinkFile}");
        }

        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function removeSsl(App $app): void
    {
        $shell = app(ShellService::class);
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$app->domain}-ssl");
        $shell->run("sudo rm -f /etc/nginx/sites-available/{$app->domain}-ssl");
        $shell->run("sudo nginx -s reload");
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
        // 1. Generate Upstream config
        $this->generateLoadBalancerUpstream($lb);

        // 2. Generate individual Domain configs
        foreach ($lb->domains as $lbDomain) {
            $this->generateLoadBalancerDomain($lb, $lbDomain);
        }
    }

    public function generateLoadBalancerUpstream(\App\Models\LoadBalancer $lb): void
    {
        $upstreamStub = $this->getStub('load_balancer_upstream');

        $upstreams = [];
        foreach ($lb->apps as $app) {
            if ($app->port) {
                // Next.js apps running on their own port
                $upstreams[] = "    server 127.0.0.1:{$app->port};";
            } else {
                // PHP/Static apps load balanced via port 80
                $upstreams[] = "    server 127.0.0.1:80;";
            }
        }

        if (empty($upstreams)) {
            // Add a placeholder to prevent empty upstream block which causes Nginx to fail
            $upstreams[] = "    server 127.0.0.1:81 down; # Placeholder when no apps are attached";
        }

        $methodLine = '';
        if ($lb->method === 'least_conn') {
            $methodLine = 'least_conn;';
        } elseif ($lb->method === 'ip_hash') {
            $methodLine = 'ip_hash;';
        } elseif ($lb->method === 'random') {
            $methodLine = 'random;';
        }

        $upstreamConfig = str_replace(
            ['{{lb_id}}', '{{method}}', '{{upstreams}}'],
            [
                $lb->id,
                $methodLine,
                implode("\n", $upstreams),
            ],
            $upstreamStub
        );

        $shell = app(ShellService::class);
        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $upstreamFile   = "{$sitesAvailable}/lb_{$lb->id}_upstream";
        $symlinkFile    = "{$sitesEnabled}/lb_{$lb->id}_upstream";

        // Ensure directories exist (for fresh installs)
        $shell->run("sudo mkdir -p {$sitesAvailable} {$sitesEnabled}");

        $escapedUpstream = escapeshellarg($upstreamConfig);
        $shell->run("echo {$escapedUpstream} | sudo tee {$upstreamFile} > /dev/null");
        $shell->run("sudo ln -sf {$upstreamFile} {$symlinkFile}");
    }

    public function generateLoadBalancerDomain(\App\Models\LoadBalancer $lb, \App\Models\LoadBalancerDomain $lbDomain): void
    {
        $shell = app(ShellService::class);
        $this->generateLoadBalancerUpstream($lb);

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $phpFpmSock = config('hosting.php_fpm_sock', '/var/run/php/php8.4-fpm.sock');
        $domain = $lbDomain->domain;

        // 1. Generate HTTP Config
        $httpStub = $this->getStub('load_balancer');
        $httpConfig = str_replace(
            ['{{lb_id}}', '{{domain}}', '{{php_fpm_sock}}'],
            [$lb->id, $domain, $phpFpmSock],
            $httpStub
        );

        if ($lbDomain->force_https && $lbDomain->ssl_enabled) {
            $httpConfig = "server {\n" .
                "    listen 80;\n" .
                "    server_name {$domain};\n" .
                "    return 301 https://\$host\$request_uri;\n" .
                "}\n";
        }

        $httpFile = "{$sitesAvailable}/{$domain}";
        $httpSymlink = "{$sitesEnabled}/{$domain}";
        $escapedHttp = escapeshellarg($httpConfig);
        $shell->run("echo {$escapedHttp} | sudo tee {$httpFile} > /dev/null");
        if (!file_exists($httpSymlink)) {
            $shell->run("sudo ln -sf {$httpFile} {$httpSymlink}");
        }

        // 2. Generate SSL Config if enabled
        if ($lbDomain->ssl_enabled) {
            $sslStub = $this->getStub('load_balancer-ssl');
            $sslConfig = str_replace(
                ['{{lb_id}}', '{{domain}}', '{{php_fpm_sock}}'],
                [$lb->id, $domain, $phpFpmSock],
                $sslStub
            );

            $sslFile = "{$sitesAvailable}/{$domain}-ssl";
            $sslSymlink = "{$sitesEnabled}/{$domain}-ssl";
            $escapedSsl = escapeshellarg($sslConfig);
            $shell->run("echo {$escapedSsl} | sudo tee {$sslFile} > /dev/null");
            if (!file_exists($sslSymlink)) {
                $shell->run("sudo ln -sf {$sslFile} {$sslSymlink}");
            }
        } else {
            // Remove SSL config if disabled
            $shell->run("sudo rm -f {$sitesEnabled}/{$domain}-ssl");
            $shell->run("sudo rm -f {$sitesAvailable}/{$domain}-ssl");
        }

        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function removeLoadBalancerDomain(string $domain): void
    {
        $shell = app(ShellService::class);
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$domain}");
        $shell->run("sudo rm -f /etc/nginx/sites-available/{$domain}");
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$domain}-ssl");
        $shell->run("sudo rm -f /etc/nginx/sites-available/{$domain}-ssl");
        $shell->run("sudo nginx -s reload");
    }

    public function removeLoadBalancer(\App\Models\LoadBalancer $lb): void
    {
        $shell = app(ShellService::class);

        // Remove upstream config
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/lb_{$lb->id}_upstream");
        $shell->run("sudo rm -f /etc/nginx/sites-available/lb_{$lb->id}_upstream");

        // Remove domain configs
        foreach ($lb->domains as $lbDomain) {
            $this->removeLoadBalancerDomain($lbDomain->domain);
        }

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
