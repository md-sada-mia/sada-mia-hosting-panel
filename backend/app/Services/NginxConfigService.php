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
                // PHP/Static apps load balanced via their unique internal Nginx port
                $internalPort = 60000 + $app->id;
                $upstreams[] = "    server 127.0.0.1:{$internalPort};";
            }
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
        $upstreamFile = "/etc/nginx/conf.d/lb_{$lb->id}_upstream.conf";
        $escapedUpstream = escapeshellarg($upstreamConfig);
        $shell->run("echo {$escapedUpstream} | sudo tee {$upstreamFile} > /dev/null");
    }

    public function generateLoadBalancerDomain(\App\Models\LoadBalancer $lb, \App\Models\LoadBalancerDomain $lbDomain): void
    {
        $domainStub = $this->getStub('load_balancer');
        $phpFpmSock = config('hosting.php_fpm_sock', '/var/run/php/php8.4-fpm.sock');
        $shell = app(ShellService::class);

        $domain = $lbDomain->domain;
        $domainConfig = str_replace(
            ['{{lb_id}}', '{{domain}}', '{{php_fpm_sock}}'],
            [
                $lb->id,
                $domain,
                $phpFpmSock
            ],
            $domainStub
        );

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $configFile     = "{$sitesAvailable}/{$domain}";
        $symlinkFile    = "{$sitesEnabled}/{$domain}";

        $escapedConfig = escapeshellarg($domainConfig);
        $shell->run("echo {$escapedConfig} | sudo tee {$configFile} > /dev/null");

        if (!file_exists($symlinkFile)) {
            $shell->run("sudo ln -sf {$configFile} {$symlinkFile}");
        }

        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function removeLoadBalancerDomain(string $domain): void
    {
        $shell = app(ShellService::class);
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$domain}");
        $shell->run("sudo rm -f /etc/nginx/sites-available/{$domain}");
        $shell->run("sudo nginx -s reload");
    }

    public function removeLoadBalancer(\App\Models\LoadBalancer $lb): void
    {
        $shell = app(ShellService::class);

        // Remove upstream config
        $shell->run("sudo rm -f /etc/nginx/conf.d/lb_{$lb->id}_upstream.conf");

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
        $internalPort = 60000 + $app->id;
        return str_replace(
            ['{{domain}}', '{{port}}', '{{internal_port}}', '{{deploy_path}}', '{{php_fpm_sock}}'],
            [
                $app->domain,
                $app->port,
                $internalPort,
                $app->deploy_path,
                config('hosting.php_fpm_sock', '/var/run/php/php8.4-fpm.sock'),
            ],
            $stub
        );
    }
}
