<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App as AppModel;
use App\Models\Domain;
use App\Models\Deployment;
use App\Services\DeploymentService;
use App\Services\PM2Service;
use App\Services\NginxConfigService;
use App\Services\GitHubService;
use App\Services\DnsService;
use App\Services\SslService;
use App\Models\Setting;
use App\Jobs\DeployApp;
use App\Jobs\DeleteApp;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AppController extends Controller
{
    public function __construct(
        private DeploymentService $deploymentService,
        private PM2Service $pm2Service,
        private NginxConfigService $nginxService,
        private GitHubService $github,
        private \App\Services\DatabaseService $dbService,
        private DnsService $dnsService,
        private SslService $sslService
    ) {}

    public function index()
    {
        $apps = AppModel::with('latestDeployment')->get();
        return response()->json($apps);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'             => 'required|string|unique:apps,name',
            'type'             => 'required|in:nextjs,laravel,static',
            'domain'           => 'required|string|unique:apps,domain',
            'git_url'          => 'required|string',
            'branch'           => 'nullable|string',
            'github_full_name' => 'nullable|string',
            'github_id'        => 'nullable|integer',
            'auto_deploy'      => 'nullable|boolean',
            'env_vars'         => 'nullable|string',
            'auto_db_create'   => 'nullable|boolean',
        ]);

        $webhookSecret = null;
        if (!empty($validated['auto_deploy']) && !empty($validated['github_full_name'])) {
            $webhookSecret = Str::random(32);
        }

        $app = AppModel::create([
            'name'             => $validated['name'],
            'type'             => $validated['type'],
            'domain'           => $validated['domain'],
            'git_url'          => $validated['git_url'],
            'branch'           => $validated['branch'] ?? 'main',
            'status'           => 'idle',
            'github_full_name' => $validated['github_full_name'] ?? null,
            'github_id'        => $validated['github_id'] ?? null,
            'webhook_secret'   => $webhookSecret,
            'auto_deploy'      => $validated['auto_deploy'] ?? false,
        ]);

        // Parse and save bulk environment variables
        if (!empty($validated['env_vars'])) {
            $lines = explode("\n", $validated['env_vars']);
            foreach ($lines as $line) {
                if (trim($line) && str_contains($line, '=')) {
                    [$key, $value] = explode('=', $line, 2);
                    $app->envVariables()->create([
                        'key' => trim($key),
                        'value' => trim($value),
                    ]);
                }
            }
        }

        // Auto Database Creation for Laravel
        if ($app->type === 'laravel' && !empty($validated['auto_db_create'])) {
            try {
                $db = $this->dbService->createForApp($app);

                // Inject credentials into environment variables
                $envs = [
                    'DB_CONNECTION' => 'pgsql',
                    'DB_HOST'       => '127.0.0.1',
                    'DB_PORT'       => '5432',
                    'DB_DATABASE'   => $db->db_name,
                    'DB_USERNAME'   => $db->db_user,
                    'DB_PASSWORD'   => $db->db_password,
                ];

                foreach ($envs as $key => $value) {
                    $app->envVariables()->updateOrCreate(['key' => $key], ['value' => $value]);
                }
            } catch (\Exception $e) {
                // We log the error but don't fail the whole app creation
                \Illuminate\Support\Facades\Log::error("Auto DB creation failed for app {$app->id}: " . $e->getMessage());
            }
        }

        // If auto-deploy is enabled, create GitHub webhook
        if ($app->webhook_secret && $app->github_full_name) {
            $token = Setting::get('github_access_token');
            if ($token) {
                $this->github->createWebhook($token, $app->github_full_name, $app->webhook_secret);
            }
        }

        // Auto-create Domain record with default nameservers and records
        $this->dnsService->createManagedDomain($app->domain, $app->id);

        // If this is the first app, set it as the primary panel domain and update site address
        if (\App\Models\App::count() === 1) {
            $port = env('PANEL_PORT', '8083');
            Setting::set('panel_url', "http://{$app->domain}:{$port}");
        }

        return response()->json($app, 201);
    }

    public function toggleAutoDeploy(AppModel $app)
    {
        if (!$app->github_full_name) {
            return response()->json(['error' => 'Automatic deployment requires a GitHub repository.'], 422);
        }

        if (!$app->auto_deploy) {
            // Enabling
            $app->webhook_secret = Str::random(32);
            $token = Setting::get('github_access_token');
            if ($token) {
                $this->github->createWebhook($token, $app->github_full_name, $app->webhook_secret);
            }
        } else {
            // Disabling
            $app->webhook_secret = null;
        }

        $app->auto_deploy = !$app->auto_deploy;
        $app->save();

        return response()->json($app);
    }

    public function show(AppModel $app)
    {
        $app->load(['latestDeployment', 'databases', 'envVariables', 'domainRecord.dnsRecords']);

        // Add relevant global settings for the app dashboard
        $settings = [
            'server_ip' => \App\Models\Setting::get('server_ip'),
            'ns_default_domain' => \App\Models\Setting::get('ns_default_domain'),
            'dns_default_ns1' => \App\Models\Setting::get('dns_default_ns1'),
            'dns_default_ns2' => \App\Models\Setting::get('dns_default_ns2'),
            'dns_default_ns3' => \App\Models\Setting::get('dns_default_ns3'),
            'dns_default_ns4' => \App\Models\Setting::get('dns_default_ns4'),
        ];

        return response()->json(array_merge($app->toArray(), ['settings' => $settings]));
    }

    public function destroy(AppModel $app)
    {
        // Snapshot data for background job including relations
        $appData = $app->toArray();
        $appData['id'] = $app->id;
        $appData['databases'] = $app->databases->toArray();

        DeleteApp::dispatch($appData);

        $app->delete();
        return response()->json(['message' => 'App scheduled for deletion and cleanup']);
    }

    public function deploy(AppModel $app)
    {
        if ($app->status === 'deploying') {
            return response()->json(['error' => 'A deployment is already running'], 422);
        }

        $app->update(['status' => 'deploying']);

        $deployment = $this->deploymentService->createDeploymentRecord($app);

        DeployApp::dispatch($app, $deployment);

        return response()->json($deployment);
    }

    public function start(AppModel $app)
    {
        if ($app->type !== 'nextjs') {
            return response()->json(['message' => 'Start only applies to Next.js apps. Laravel/static are served by Nginx/PHP-FPM.']);
        }

        $result = $this->pm2Service->start($app);
        $app->update(['status' => $result['exit_code'] === 0 ? 'running' : 'error']);
        return response()->json(['exit_code' => $result['exit_code'], 'output' => $result['output']]);
    }

    public function stop(AppModel $app)
    {
        if ($app->type !== 'nextjs') {
            return response()->json(['message' => 'Stop only applies to Next.js apps.']);
        }

        $result = $this->pm2Service->stop($app);
        $app->update(['status' => $result['exit_code'] === 0 ? 'stopped' : 'error']);
        return response()->json(['exit_code' => $result['exit_code'], 'output' => $result['output']]);
    }

    public function restart(AppModel $app)
    {
        if ($app->type !== 'nextjs') {
            return response()->json(['message' => 'Restart only applies to Next.js apps.']);
        }

        $result = $this->pm2Service->restart($app);
        $app->update(['status' => $result['exit_code'] === 0 ? 'running' : 'error']);
        return response()->json(['exit_code' => $result['exit_code'], 'output' => $result['output']]);
    }

    public function logs(AppModel $app, Request $request)
    {
        $type = $request->query('type', 'app');

        if ($type === 'server-error') {
            if (!$app->domain) return response()->json(['logs' => 'No domain associated with this app.']);
            $logFile = "/var/log/nginx/{$app->domain}-error.log";
            $output = file_exists($logFile) ? shell_exec("tail -n 200 " . escapeshellarg($logFile) . " 2>&1") : 'No server error logs found.';
            return response()->json(['logs' => $output ?: 'Log file is empty or unreadable.']);
        }

        if ($type === 'server-access') {
            if (!$app->domain) return response()->json(['logs' => 'No domain associated with this app.']);
            $logFile = "/var/log/nginx/{$app->domain}-access.log";
            $output = file_exists($logFile) ? shell_exec("tail -n 200 " . escapeshellarg($logFile) . " 2>&1") : 'No server access logs found.';
            return response()->json(['logs' => $output ?: 'Log file is empty or unreadable.']);
        }

        if ($app->type === 'nextjs') {
            $logs = $this->pm2Service->logs($app, 200);
        } elseif ($app->type === 'laravel' && $app->deploy_path) {
            $logFile = "{$app->deploy_path}/storage/logs/laravel.log";
            $logs = file_exists($logFile) ? shell_exec("tail -n 200 " . escapeshellarg($logFile)) : 'No logs found.';
        } else {
            $logs = 'No runtime logs available for this app type.';
        }

        return response()->json(['logs' => $logs]);
    }

    public function deployments(AppModel $app)
    {
        return response()->json($app->deployments()->orderByDesc('created_at')->get());
    }

    public function hideGuidelines(AppModel $app)
    {
        $app->update(['hide_guidelines' => true]);
        return response()->json(['success' => true]);
    }

    public function setupSsl(AppModel $app)
    {
        $result = $this->sslService->setupSsl($app);
        return response()->json(array_merge($result, [
            'app' => $app->fresh()
        ]), $result['success'] ? 200 : 500);
    }

    public function removeSsl(AppModel $app)
    {
        $result = $this->sslService->removeSsl($app);
        return response()->json(array_merge($result, [
            'app' => $app->fresh()
        ]));
    }

    public function getSslDetails(AppModel $app)
    {
        $details = $this->sslService->getCertificateDetails($app);
        return response()->json($details);
    }

    public function setupPanelSsl(AppModel $app)
    {
        // Safety check: only allow if domain matches setting
        $panelDomain = Setting::get('ns_default_domain');
        if ($app->domain !== $panelDomain) {
            return response()->json(['success' => false, 'message' => "Panel domain mismatch. Expected: {$panelDomain}"], 403);
        }

        $result = $this->sslService->securePanel($app->domain);

        if ($result['success']) {
            // Automatically enable Force HTTPS if panel security was successful
            $this->sslService->togglePanelForceHttps(true);

            // Update panel url to HTTPS
            $port = env('PANEL_PORT', '8083');
            Setting::set('panel_url', "https://{$app->domain}:{$port}");
        }

        return response()->json($result, $result['success'] ? 200 : 500);
    }

    public function toggleForceHttps(AppModel $app)
    {
        if (!$app->ssl_enabled || $app->ssl_status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'SSL must be active before toggling Force HTTPS.',
            ], 422);
        }

        $enable = !$app->force_https;
        $result = $this->sslService->toggleForceHttps($app, $enable);

        return response()->json(array_merge($result, [
            'app' => $app->fresh(),
        ]), $result['success'] ? 200 : 500);
    }

    public function togglePanelForceHttps(Request $request)
    {
        $enable = (bool) $request->input('enable', true);
        $result = $this->sslService->togglePanelForceHttps($enable);
        return response()->json($result, $result['success'] ? 200 : 500);
    }

    public function crmLogs(AppModel $app)
    {
        $customer = \App\Models\Customer::where('resource_type', 'app')
            ->where('resource_id', $app->id)
            ->first();

        if (!$customer) {
            return response()->json([]);
        }

        $logs = $customer->crmApiLogs()->orderByDesc('created_at')->get();
        return response()->json($logs);
    }
}
