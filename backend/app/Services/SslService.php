<?php

namespace App\Services;

use App\Models\App;
use App\Models\LoadBalancerDomain;
use Illuminate\Support\Facades\Log;

class SslService
{
    public function __construct(
        private ShellService $shell,
        private NginxConfigService $nginxService
    ) {}

    /**
     * Setup SSL for an app or load balancer domain using Let's Encrypt / Certbot.
     */
    public function setupSsl(App|LoadBalancerDomain $model): array
    {
        if (config('app.env') === 'local') {
            $msg = "SSL requested for {$model->domain} but skipped due to local environment (APP_ENV=local).";
            Log::info($msg);
            $model->update([
                'ssl_status' => 'failed',
                'ssl_enabled' => false,
                'ssl_log' => $msg,
            ]);
            return ['success' => false, 'message' => $msg];
        }

        // Validate domain format for Let's Encrypt
        if ($model->domain === 'localhost' || !str_contains($model->domain, '.')) {
            $msg = "Cannot issue SSL for '{$model->domain}'. Let's Encrypt requires a valid domain name with at least one dot (e.g., example.com).";
            Log::warning($msg);
            $model->update([
                'ssl_status' => 'failed',
                'ssl_enabled' => false,
                'ssl_log' => $msg,
            ]);
            return ['success' => false, 'message' => $msg];
        }

        Log::info("Starting SSL setup for domain: {$model->domain}");
        $model->update(['ssl_status' => 'pending']);

        // Verify DNS record exists and points here before calling Certbot
        if (!$this->verifyDns($model->domain)) {
            $msg = "DNS verification failed for '{$model->domain}'. Ensure the domain points to this server's IP address and has propagated.";
            Log::warning($msg);
            $model->update([
                'ssl_status' => 'failed',
                'ssl_enabled' => false,
                'ssl_log' => $msg,
            ]);
            return ['success' => false, 'message' => $msg];
        }

        // Run certbot certonly --nginx (using the nginx plugin for challenge but not touching config)
        $command = "sudo certbot certonly --nginx -d " . escapeshellarg($model->domain) . " --non-interactive --agree-tos --register-unsafely-without-email";

        $result = $this->shell->run($command);
        $output = $result['output'] ?? '';

        if ($result['exit_code'] === 0 && (
            str_contains(strtolower($output), 'successfully received certificate') ||
            str_contains(strtolower($output), 'certificate is already active') ||
            str_contains(strtolower($output), 'congratulations') ||
            str_contains(strtolower($output), 'successfully enabled https')
        )) {
            $model->update([
                'ssl_status' => 'active',
                'ssl_enabled' => true,
                'ssl_last_check_at' => now(),
                'ssl_log' => $output,
            ]);

            // Generate the separate SSL config file
            if ($model instanceof App) {
                $this->nginxService->generateSsl($model);
                if ($model->force_https) {
                    $this->nginxService->generate($model); // Update HTTP for redirect
                }
            } else {
                // For LoadBalancerDomain, use the new simplified methods
                $this->nginxService->generateLoadBalancerSsl($model->loadBalancer, $model);
                if ($model->force_https) {
                    $this->nginxService->generateLoadBalancerDomain($model->loadBalancer, $model);
                }
            }

            Log::info("SSL successfully enabled for {$model->domain}");
            return ['success' => true, 'message' => "SSL enabled successfully."];
        }

        $model->update([
            'ssl_status' => 'failed',
            'ssl_enabled' => false,
            'ssl_log' => $output
        ]);
        Log::error("SSL setup failed for {$model->domain}. Exit code: {$result['exit_code']}. Output: " . $output);
        return ['success' => false, 'message' => "SSL setup failed. Check logs for details. (Code: {$result['exit_code']})", 'output' => $output];
    }

    /**
     * Remove SSL for an app or load balancer domain.
     */
    public function removeSsl(App|LoadBalancerDomain $model): array
    {
        Log::info("Removing SSL for domain: {$model->domain}");

        $command = "sudo certbot delete --cert-name " . escapeshellarg($model->domain);
        $result = $this->shell->run($command);

        $model->update([
            'ssl_status' => 'none',
            'ssl_enabled' => false,
            'force_https' => false,
        ]);

        if ($model instanceof App) {
            $this->nginxService->removeSsl($model);
            $this->nginxService->generate($model); // Re-generate HTTP without redirect
        } else {
            $this->nginxService->removeLoadBalancerSsl($model->domain);
            $this->nginxService->generateLoadBalancerDomain($model->loadBalancer, $model);
        }

        return ['success' => true, 'message' => "SSL removed successfully."];
    }

    /**
     * Get certificate details including raw contents and metadata.
     */
    public function getCertificateDetails(App|LoadBalancerDomain $model): array
    {
        if (!$model->ssl_enabled && $model->ssl_status !== 'failed') {
            return [];
        }

        $domain = $model->domain;
        $basePath = "/etc/letsencrypt/live/{$domain}";

        // We need sudo to read these files
        $cert = $this->readSudoFile("{$basePath}/cert.pem");
        $key = $this->readSudoFile("{$basePath}/privkey.pem");
        $chain = $this->readSudoFile("{$basePath}/chain.pem");
        $fullchain = $this->readSudoFile("{$basePath}/fullchain.pem");

        if (!$cert) {
            return [];
        }

        // Parse metadata using openssl
        $metadata = $this->parseCertificate($cert);

        return [
            'cert' => $cert,
            'key' => $key,
            'chain' => $chain,
            'fullchain' => $fullchain,
            'metadata' => $metadata,
        ];
    }

    private function readSudoFile(string $path): ?string
    {
        $result = $this->shell->run("sudo cat " . escapeshellarg($path));
        return $result['exit_code'] === 0 ? $result['output'] : null;
    }

    private function parseCertificate(string $certContent): array
    {
        // Use temporary file to parse with openssl command
        $tmpFile = tempnam(sys_get_temp_dir(), 'cert_');
        file_put_contents($tmpFile, $certContent);

        try {
            $subject = $this->shell->run("openssl x509 -noout -subject -in " . escapeshellarg($tmpFile))['output'] ?? '';
            $issuer = $this->shell->run("openssl x509 -noout -issuer -in " . escapeshellarg($tmpFile))['output'] ?? '';
            $dates = $this->shell->run("openssl x509 -noout -dates -in " . escapeshellarg($tmpFile))['output'] ?? '';
            $fingerprint = $this->shell->run("openssl x509 -noout -fingerprint -in " . escapeshellarg($tmpFile))['output'] ?? '';

            // Clean up output
            $subject = trim(str_replace('subject=', '', $subject));
            $issuer = trim(str_replace('issuer=', '', $issuer));

            preg_match('/notBefore=(.*)/', $dates, $beforeMatch);
            preg_match('/notAfter=(.*)/', $dates, $afterMatch);

            $notBefore = isset($beforeMatch[1]) ? date('M d H:i:s Y T', strtotime($beforeMatch[1])) : '';
            $notAfter = isset($afterMatch[1]) ? date('M d H:i:s Y T', strtotime($afterMatch[1])) : '';

            return [
                'subject' => $subject,
                'issuer' => $issuer,
                'not_before' => $notBefore,
                'not_after' => $notAfter,
                'fingerprint' => trim(str_replace('SHA1 Fingerprint=', '', $fingerprint)),
            ];
        } finally {
            @unlink($tmpFile);
        }
    }

    /**
     * Run certbot renew to check/renew all certificates.
     */
    public function renewAll(): array
    {
        Log::info("Running Certbot renewal for all domains...");
        $result = $this->shell->run("sudo certbot renew --non-interactive");
        return $result;
    }

    /**
     * Sync the SSL status of an app or load balancer domain by checking its certificate file.
     */
    public function syncStatus(App|LoadBalancerDomain $model): void
    {
        if (!$model->ssl_enabled) return;

        $basePath = "/etc/letsencrypt/live/{$model->domain}";
        $cert = $this->readSudoFile("{$basePath}/cert.pem");

        if ($cert) {
            $model->update([
                'ssl_status' => 'active',
                'ssl_last_check_at' => now(),
            ]);
        } else {
            // If cert file is missing, it might have been deleted or expired
            $model->update([
                'ssl_status' => 'failed',
                'ssl_enabled' => false,
            ]);
        }
    }

    /**
     * Secure the panel port (8083) using an existing domain certificate.
     */
    public function securePanel(string $domain): array
    {
        $basePath = "/etc/letsencrypt/live/{$domain}";
        $fullchain = "{$basePath}/fullchain.pem";
        $privkey = "{$basePath}/privkey.pem";

        // Check if certificate exists (using ls via sudo)
        $result = $this->shell->run("sudo ls " . escapeshellarg($fullchain));
        if ($result['exit_code'] !== 0) {
            return [
                'success' => false,
                'message' => "SSL certificate for {$domain} not found in {$basePath}. (Code: {$result['exit_code']}, Output: " . trim($result['output']) . ")"
            ];
        }

        $panelConfigPath = '/etc/nginx/sites-available/sada-mia-panel';
        $currentConfig = $this->readSudoFile($panelConfigPath);

        if (!$currentConfig) {
            return ['success' => false, 'message' => "Panel Nginx configuration not found at {$panelConfigPath}"];
        }

        // Add SSL directives if not present
        if (!str_contains($currentConfig, 'ssl_certificate')) {
            $sslCertDirectives = "\n" .
                "    ssl_certificate {$fullchain};\n" .
                "    ssl_certificate_key {$privkey};\n" .
                "    include /etc/letsencrypt/options-ssl-nginx.conf;\n" .
                "    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n";

            $forceHttps = \App\Models\Setting::get('panel_force_https') === '1';
            if ($forceHttps) {
                $sslCertDirectives .= "\n    # BEGIN FORCE HTTPS\n" .
                    "    error_page 497 301 https://\$host:8083\$request_uri;\n" .
                    "    # END FORCE HTTPS\n";
            }

            $newConfig = $currentConfig;

            // Update first IPv4 listen to include ssl
            $newConfig = preg_replace('/listen\s+8083(\s+default_server)?\s*;/', 'listen 8083$1 ssl;', $newConfig, 1);
            // Update first IPv6 listen to include ssl
            $newConfig = preg_replace('/listen\s+\[::\]:8083(\s+default_server)?\s*;/', 'listen [::]:8083$1 ssl;', $newConfig, 1);

            // Append certificate directives after the first listen directive
            $newConfig = preg_replace('/listen\s+8083(\s+default_server)?\s+ssl\s*;/', "listen 8083$1 ssl;" . $sslCertDirectives, $newConfig, 1);

            // Save back
            $escapedConfig = escapeshellarg($newConfig);
            $this->shell->run("echo {$escapedConfig} | sudo tee {$panelConfigPath} > /dev/null");

            // Test Nginx configuration
            $test = $this->shell->run("sudo nginx -t");
            if ($test['exit_code'] !== 0) {
                // Rollback if failed
                $escapedOriginal = escapeshellarg($currentConfig);
                $this->shell->run("echo {$escapedOriginal} | sudo tee {$panelConfigPath} > /dev/null");
                return [
                    'success' => false,
                    'message' => "Nginx configuration test failed. Rollback applied. Error: " . trim($test['output'])
                ];
            }

            $this->shell->run("sudo nginx -s reload");

            return ['success' => true, 'message' => "Panel secured with SSL for {$domain}"];
        }

        return ['success' => true, 'message' => "Panel is already secured."];
    }

    /**
     * Enable or disable Force HTTPS (HTTP→HTTPS redirect) for an app or load balancer domain.
     * Uses clearly-delimited comment markers so the block can be added/removed safely.
     */
    public function toggleForceHttps(App|LoadBalancerDomain $model, bool $enable): array
    {
        if ($enable && $model->ssl_status !== 'active') {
            return ['success' => false, 'message' => 'SSL must be active before enabling Force HTTPS.'];
        }

        $model->update(['force_https' => $enable]);

        if ($model instanceof App) {
            $this->nginxService->generate($model);
        } else {
            $this->nginxService->generateLoadBalancerDomain($model->loadBalancer, $model);
        }

        return [
            'success' => true,
            'message' => $enable ? 'Force HTTPS enabled.' : 'Force HTTPS disabled.',
            'force_https' => $enable,
        ];
    }

    /**
     * Enable or disable Force HTTPS for the control panel (port 8083).
     */
    public function togglePanelForceHttps(bool $enable): array
    {
        $panelConfigPath = '/etc/nginx/sites-available/sada-mia-panel';
        $currentConfig = $this->readSudoFile($panelConfigPath);

        if (!$currentConfig) {
            return ['success' => false, 'message' => "Panel Nginx configuration not found at {$panelConfigPath}"];
        }

        if ($enable && !str_contains($currentConfig, 'ssl_certificate')) {
            return ['success' => false, 'message' => 'Panel SSL must be active before enabling Force HTTPS.'];
        }

        // Strip any existing force-https block
        $cleanConfig = $this->removeForceHttpsBlock($currentConfig);

        if ($enable) {
            $redirectDirective = "\n    # BEGIN FORCE HTTPS\n" .
                "    error_page 497 301 https://\$host:8083\$request_uri;\n" .
                "    # END FORCE HTTPS\n";

            // Insert inside the first server block, after the listen directives
            $newConfig = preg_replace(
                '/(listen\s+.*?8083.*?ssl\s*;)/s',
                "$1" . $redirectDirective,
                $cleanConfig,
                1
            );

            // If regex failed (e.g. ssl not found in listen but certs are there), fallback or error
            if ($newConfig === $cleanConfig) {
                // Try to insert after ssl_certificate instead
                $newConfig = preg_replace(
                    '/(ssl_certificate\s+.*?;)/s',
                    "$1" . $redirectDirective,
                    $cleanConfig,
                    1
                );
            }
        } else {
            $newConfig = $cleanConfig;
        }

        $escapedConfig = escapeshellarg($newConfig);
        $this->shell->run("echo {$escapedConfig} | sudo tee {$panelConfigPath} > /dev/null");

        $test = $this->shell->run("sudo nginx -t");
        if ($test['exit_code'] !== 0) {
            // Rollback
            $escapedOriginal = escapeshellarg($currentConfig);
            $this->shell->run("echo {$escapedOriginal} | sudo tee {$panelConfigPath} > /dev/null");
            return [
                'success' => false,
                'message' => "Nginx test failed. Rolled back. Error: " . trim($test['output'])
            ];
        }

        $this->shell->run("sudo nginx -s reload");

        \App\Models\Setting::set('panel_force_https', $enable ? '1' : '0');

        return [
            'success' => true,
            'message' => $enable ? 'Panel Force HTTPS enabled.' : 'Panel Force HTTPS disabled.',
            'panel_force_https' => $enable,
        ];
    }

    /**
     * Verify if the domain has a valid DNS record pointing to this server.
     */
    private function verifyDns(string $domain): bool
    {
        $serverIp = \App\Models\Setting::get('server_ip');
        if (!$serverIp) {
            // If server IP is not set, we can't reliably verify, so we skip and let certbot try
            return true;
        }

        // Try a few times with a small delay for local DNS propagation
        for ($i = 0; $i < 3; $i++) {
            $ips = array_merge(
                (array)@gethostbynamel($domain),
                // (array)@gethostbynamel("www.{$domain}") // Check WWW too if common
            );

            if (in_array($serverIp, $ips)) {
                return true;
            }

            if ($i < 2) sleep(2);
        }

        return false;
    }

    /**
     * Remove the # BEGIN FORCE HTTPS ... # END FORCE HTTPS block from a config string.
     */
    private function removeForceHttpsBlock(string $config): string
    {
        return preg_replace(
            '/\n?\s*# BEGIN FORCE HTTPS.*?# END FORCE HTTPS\n?/s',
            '',
            $config
        );
    }
}
