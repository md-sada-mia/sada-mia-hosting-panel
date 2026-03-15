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

        if (($result['exit_code'] === 0) && (str_contains(strtolower($output), 'successfully received certificate') || str_contains(strtolower($output), 'certificate is already active'))) {
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
}
