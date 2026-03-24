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
        if ($app->force_https && $app->ssl_enabled && $this->hasCertificate($app->domain)) {
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
        if (!$app->ssl_enabled || !$this->hasCertificate($app->domain)) {
            return;
        }

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
            $port = 60000 + $app->id;
            $this->generateAppInternalConfig($app, $lb, $port);
            $upstreams[] = "    server 127.0.0.1:{$port};";
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

        if ($lbDomain->force_https && $lbDomain->ssl_enabled && $this->hasCertificate($domain)) {
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

        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function generateLoadBalancerSsl(\App\Models\LoadBalancer $lb, \App\Models\LoadBalancerDomain $lbDomain): void
    {
        \Illuminate\Support\Facades\Log::info("Generating Load Balancer SSL for domain: {$lbDomain->domain}. SSL Enabled: " . ($lbDomain->ssl_enabled ? 'Yes' : 'No'));

        if (!$lbDomain->ssl_enabled || !$this->hasCertificate($lbDomain->domain)) {
            \Illuminate\Support\Facades\Log::warning("Skipping Load Balancer SSL generation for {$lbDomain->domain}. Certificate exists: " . ($this->hasCertificate($lbDomain->domain) ? 'Yes' : 'No'));
            return;
        }

        $shell = app(ShellService::class);
        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $phpFpmSock = config('hosting.php_fpm_sock', '/var/run/php/php8.4-fpm.sock');
        $domain = $lbDomain->domain;

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

        $shell->run("sudo nginx -t && sudo nginx -s reload");
    }

    public function removeLoadBalancerSsl(string $domain): void
    {
        $shell = app(ShellService::class);
        $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$domain}-ssl");
        $shell->run("sudo rm -f /etc/nginx/sites-available/{$domain}-ssl");
        $shell->run("sudo nginx -s reload");
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

        // Remove individual app LB workers
        foreach ($lb->apps as $app) {
            if (!$app->port) {
                $port = 60000 + $app->id;
                $fileName = "lb{$lb->id}app{$app->id}port{$port}";
                $shell->run("sudo rm -f /etc/nginx/sites-enabled/{$fileName}");
                $shell->run("sudo rm -f /etc/nginx/sites-available/{$fileName}");
            }
        }

        $shell->run("sudo nginx -s reload");
    }

    public function generateAppInternalConfig(App $app, \App\Models\LoadBalancer $lb, int $port): void
    {
        // Use the specialized LB worker stub
        $stub = $this->getStub($app->type . '-lb');
        $config = $this->replacePlaceholders($stub, $app, $port);

        $sitesAvailable = '/etc/nginx/sites-available';
        $sitesEnabled   = '/etc/nginx/sites-enabled';
        $fileName       = "lb{$lb->id}app{$app->id}port{$port}";
        $configFile     = "{$sitesAvailable}/{$fileName}";
        $symlinkFile    = "{$sitesEnabled}/{$fileName}";

        $shell = app(ShellService::class);
        $escapedConfig = escapeshellarg($config);
        $shell->run("echo {$escapedConfig} | sudo tee {$configFile} > /dev/null");

        if (!file_exists($symlinkFile)) {
            $shell->run("sudo ln -sf {$configFile} {$symlinkFile}");
        }
    }

    private function getStub(string $type): string
    {
        $stubPath = resource_path("nginx-templates/{$type}.conf.stub");
        if (!file_exists($stubPath)) {
            throw new \RuntimeException("Nginx stub not found for type: {$type}");
        }
        return file_get_contents($stubPath);
    }

    private function replacePlaceholders(string $stub, App $app, ?int $internalPort = null): string
    {
        return str_replace(
            ['{{domain}}', '{{port}}', '{{deploy_path}}', '{{php_fpm_sock}}', '{{internal_port}}'],
            [
                $app->domain,
                $app->port ?: '80',
                $app->deploy_path,
                config('hosting.php_fpm_sock', '/var/run/php/php8.4-fpm.sock'),
                $internalPort ?? ''
            ],
            $stub
        );
    }

    /**
     * Check if a Let's Encrypt certificate exists for the given domain.
     */
    public function hasCertificate(string $domain): bool
    {
        $shell = app(ShellService::class);
        $domain = strtolower(trim($domain));
        $path = "/etc/letsencrypt/live/{$domain}/fullchain.pem";

        // Use ls instead of test -f for better visibility
        $result = $shell->run("sudo ls " . escapeshellarg($path));
        $exists = ($result['exit_code'] === 0);

        \Illuminate\Support\Facades\Log::info("Certificate check for {$domain}: " . ($exists ? 'EXISTS' : 'MISSING') . " (Path: {$path}, Code: {$result['exit_code']}, Output: " . trim($result['output']) . ")");

        return $exists;
    }
}
