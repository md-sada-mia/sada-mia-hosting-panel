<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App as AppModel;
use App\Models\Deployment;
use App\Services\DeploymentService;
use App\Services\PM2Service;
use App\Services\NginxConfigService;
use App\Services\GitHubService;
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
        private GitHubService $github
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

        // If auto-deploy is enabled, create GitHub webhook
        if ($app->webhook_secret && $app->github_full_name) {
            $token = Setting::get('github_access_token');
            if ($token) {
                $this->github->createWebhook($token, $app->github_full_name, $app->webhook_secret);
            }
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
        $app->load(['latestDeployment', 'databases', 'envVariables']);
        return response()->json($app);
    }

    public function destroy(AppModel $app)
    {
        // Snapshot data for background job
        $appData = $app->toArray();
        $appData['id'] = $app->id;

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

    public function logs(AppModel $app)
    {
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
}
