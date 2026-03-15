<?php

namespace App\Services;

use App\Models\App;
use Illuminate\Support\Facades\Log;

class SslService
{
    public function __construct(
        private ShellService $shell
    ) {}

    /**
     * Setup SSL for an app using Let's Encrypt / Certbot.
     */
    public function setupSsl(App $app): array
    {
        if (config('app.env') === 'local') {
            $msg = "SSL requested for {$app->domain} but skipped due to local environment (APP_ENV=local).";
            Log::info($msg);
            $app->update([
                'ssl_status' => 'failed',
                'ssl_enabled' => false,
                'ssl_log' => $msg,
            ]);
            return ['success' => false, 'message' => $msg];
        }

        // Validate domain format for Let's Encrypt
        if ($app->domain === 'localhost' || !str_contains($app->domain, '.')) {
            $msg = "Cannot issue SSL for '{$app->domain}'. Let's Encrypt requires a valid domain name with at least one dot (e.g., example.com).";
            Log::warning($msg);
            $app->update([
                'ssl_status' => 'failed',
                'ssl_enabled' => false,
                'ssl_log' => $msg,
            ]);
            return ['success' => false, 'message' => $msg];
        }

        Log::info("Starting SSL setup for domain: {$app->domain}");
        $app->update(['ssl_status' => 'pending']);

        // Run certbot --nginx
        // --non-interactive: No prompts
        // --agree-tos: Agree to Terms of Service
        // --register-unsafely-without-email: Skip email registration for simplicity, 
        // fallback to a configured email if available in the future.
        $command = "sudo certbot --nginx -d " . escapeshellarg($app->domain) . " --non-interactive --agree-tos --register-unsafely-without-email";

        $result = $this->shell->run($command);
        $output = $result['output'] ?? '';

        if ($result['exit_code'] === 0 && (
            str_contains(strtolower($output), 'successfully received certificate') ||
            str_contains(strtolower($output), 'certificate is already active') ||
            str_contains(strtolower($output), 'congratulations') ||
            str_contains(strtolower($output), 'successfully enabled https')
        )) {
            $app->update([
                'ssl_status' => 'active',
                'ssl_enabled' => true,
                'ssl_last_check_at' => now(),
                'ssl_log' => $output,
            ]);
            Log::info("SSL successfully enabled for {$app->domain}");
            return ['success' => true, 'message' => "SSL enabled successfully."];
        }

        $app->update([
            'ssl_status' => 'failed',
            'ssl_log' => $output
        ]);
        Log::error("SSL setup failed for {$app->domain}. Exit code: {$result['exit_code']}. Output: " . $output);
        return ['success' => false, 'message' => "SSL setup failed. Check logs for details.", 'output' => $output];
    }

    /**
     * Remove SSL for an app.
     */
    public function removeSsl(App $app): array
    {
        Log::info("Removing SSL for domain: {$app->domain}");

        $command = "sudo certbot delete --cert-name " . escapeshellarg($app->domain);
        $result = $this->shell->run($command);

        $app->update([
            'ssl_status' => 'none',
            'ssl_enabled' => false,
        ]);


        return ['success' => true, 'message' => "SSL removed successfully."];
    }

    /**
     * Get certificate details including raw contents and metadata.
     */
    public function getCertificateDetails(App $app): array
    {
        if (!$app->ssl_enabled && $app->ssl_status !== 'failed') {
            return [];
        }

        $domain = $app->domain;
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
     * Sync the SSL status of an app by checking its certificate file.
     */
    public function syncStatus(App $app): void
    {
        if (!$app->ssl_enabled) return;

        $basePath = "/etc/letsencrypt/live/{$app->domain}";
        $cert = $this->readSudoFile("{$basePath}/cert.pem");

        if ($cert) {
            $app->update([
                'ssl_status' => 'active',
                'ssl_last_check_at' => now(),
            ]);
        } else {
            // If cert file is missing, it might have been deleted or expired
            $app->update([
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
            return ['success' => false, 'message' => "SSL certificate for {$domain} not found in {$basePath}"];
        }

        $panelConfigPath = '/etc/nginx/sites-available/sada-mia-panel';
        $currentConfig = $this->readSudoFile($panelConfigPath);

        if (!$currentConfig) {
            return ['success' => false, 'message' => "Panel Nginx configuration not found at {$panelConfigPath}"];
        }

        // Add SSL directives if not present
        if (!str_contains($currentConfig, 'ssl_certificate')) {
            $sslDirectives = "\n" .
                "    listen 8083 ssl;\n" .
                "    ssl_certificate {$fullchain};\n" .
                "    ssl_certificate_key {$privkey};\n" .
                "    include /etc/letsencrypt/options-ssl-nginx.conf;\n" .
                "    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;\n";

            // Insert after first listen 8083;
            $newConfig = preg_replace('/listen 8083;/', 'listen 8083;' . $sslDirectives, $currentConfig, 1);

            // Handle IPv6 if present
            $newConfig = preg_replace('/listen \[::\]:8083;/', 'listen [::]:8083 ssl;' . $sslDirectives, $newConfig, 1);

            // Save back
            $escapedConfig = escapeshellarg($newConfig);
            $this->shell->run("echo {$escapedConfig} | sudo tee {$panelConfigPath} > /dev/null");
            $this->shell->run("sudo nginx -t && sudo nginx -s reload");

            return ['success' => true, 'message' => "Panel secured with SSL for {$domain}"];
        }

        return ['success' => true, 'message' => "Panel is already secured."];
    }
}
