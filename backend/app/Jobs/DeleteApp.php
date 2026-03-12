<?php

namespace App\Jobs;

use App\Models\App;
use App\Models\Domain;
use App\Services\PM2Service;
use App\Services\NginxConfigService;
use App\Services\DnsService;
use App\Services\DatabaseService;
use App\Services\GitHubService;
use App\Services\EmailService;
use App\Models\EmailDomain;
use App\Models\Setting;
use App\Services\ShellService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DeleteApp implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        protected array $appData
    ) {}

    public function handle(
        PM2Service $pm2Service,
        NginxConfigService $nginxService,
        DnsService $dnsService,
        EmailService $emailService
    ): void {
        try {
            // We work with a temporary App model instance since the original might be deleted
            $app = new App($this->appData);
            $app->id = $this->appData['id'];

            if ($app->type === 'nextjs') {
                $pm2Service->delete($app);
            }

            $nginxService->remove($app);

            // Also remove the DNS zone for this app's domain
            $domain = Domain::where('app_id', $app->id)->first();
            if ($domain) {
                // Cleanup Email
                $emailDomain = EmailDomain::where('domain_id', $domain->id)->first();
                if ($emailDomain) {
                    $emailService->removeDomain($emailDomain);
                }

                $dnsService->removeZone($domain);
                $domain->delete();
            }

            // Cleanup Filesystem
            if (!empty($this->appData['deploy_path'])) {
                $shell = app(ShellService::class);
                $shell->run("sudo rm -rf " . escapeshellarg($this->appData['deploy_path']));
            }

            // Cleanup Databases
            $dbService = app(DatabaseService::class);
            if (!empty($this->appData['databases'])) {
                foreach ($this->appData['databases'] as $dbData) {
                    $db = \App\Models\Database::find($dbData['id']);
                    if ($db) {
                        $dbService->delete($db);
                    }
                }
            }

            // Cleanup GitHub Webhook
            if (!empty($this->appData['github_full_name']) && !empty($this->appData['webhook_secret'])) {
                $githubService = app(GitHubService::class);
                $token = Setting::get('github_access_token');
                if ($token) {
                    $hooks = $githubService->getHooks($token, $this->appData['github_full_name']);
                    if (is_array($hooks)) {
                        $webhookUrl = config('app.url') . '/api/github/webhook';
                        foreach ($hooks as $hook) {
                            if (isset($hook['config']['url']) && $hook['config']['url'] === $webhookUrl) {
                                $githubService->deleteWebhook($token, $this->appData['github_full_name'], $hook['id']);
                            }
                        }
                    }
                }
            }

            Log::info("Cleanup complete for app: {$app->name}");
        } catch (\Throwable $e) {
            Log::error("Cleanup failed for app: " . ($this->appData['name'] ?? 'unknown'), [
                'error' => $e->getMessage()
            ]);
        }
    }
}
