<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App;
use App\Models\Deployment;
use App\Services\DeploymentService;
use App\Services\PM2Service;
use App\Services\NginxConfigService;
use Illuminate\Http\Request;

class AppController extends Controller
{
    public function __construct(
        private DeploymentService $deploymentService,
        private PM2Service $pm2Service,
        private NginxConfigService $nginxService
    ) {}

    public function index()
    {
        $apps = App::with('latestDeployment')->get();
        return response()->json($apps);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'    => 'required|string|regex:/^[a-zA-Z0-9_-]+$/|unique:apps,name',
            'type'    => 'required|in:nextjs,laravel,static',
            'domain'  => 'required|string|unique:apps,domain',
            'git_url' => 'required|string',
            'branch'  => 'nullable|string',
        ]);

        $app = App::create([
            'name'    => $validated['name'],
            'type'    => $validated['type'],
            'domain'  => $validated['domain'],
            'git_url' => $validated['git_url'],
            'branch'  => $validated['branch'] ?? 'main',
            'status'  => 'idle',
        ]);

        return response()->json($app, 201);
    }

    public function show(App $app)
    {
        $app->load(['latestDeployment', 'databases', 'envVariables']);
        return response()->json($app);
    }

    public function destroy(App $app)
    {
        // Stop if running
        if ($app->type === 'nextjs') {
            $this->pm2Service->delete($app);
        }

        // Remove Nginx config
        $this->nginxService->remove($app);

        $app->delete();
        return response()->json(['message' => 'App deleted']);
    }

    public function deploy(App $app)
    {
        if ($app->status === 'deploying') {
            return response()->json(['error' => 'A deployment is already running'], 422);
        }

        $app->update(['status' => 'deploying']);
        $deployment = $this->deploymentService->deploy($app);

        return response()->json($deployment);
    }

    public function start(App $app)
    {
        if ($app->type !== 'nextjs') {
            return response()->json(['message' => 'Start only applies to Next.js apps. Laravel/static are served by Nginx/PHP-FPM.']);
        }

        $result = $this->pm2Service->start($app);
        $app->update(['status' => $result['exit_code'] === 0 ? 'running' : 'error']);
        return response()->json(['exit_code' => $result['exit_code'], 'output' => $result['output']]);
    }

    public function stop(App $app)
    {
        if ($app->type !== 'nextjs') {
            return response()->json(['message' => 'Stop only applies to Next.js apps.']);
        }

        $result = $this->pm2Service->stop($app);
        $app->update(['status' => $result['exit_code'] === 0 ? 'stopped' : 'error']);
        return response()->json(['exit_code' => $result['exit_code'], 'output' => $result['output']]);
    }

    public function restart(App $app)
    {
        if ($app->type !== 'nextjs') {
            return response()->json(['message' => 'Restart only applies to Next.js apps.']);
        }

        $result = $this->pm2Service->restart($app);
        $app->update(['status' => $result['exit_code'] === 0 ? 'running' : 'error']);
        return response()->json(['exit_code' => $result['exit_code'], 'output' => $result['output']]);
    }

    public function logs(App $app)
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

    public function deployments(App $app)
    {
        return response()->json($app->deployments()->orderByDesc('created_at')->get());
    }
}
