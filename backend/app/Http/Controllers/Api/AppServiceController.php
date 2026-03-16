<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App as AppModel;
use App\Models\AppService;
use App\Services\BackgroundServiceManager;
use Illuminate\Http\Request;

class AppServiceController extends Controller
{
    public function __construct(private BackgroundServiceManager $manager) {}

    /**
     * GET /apps/{app}/services
     * List all services for the app, syncing live PM2 status first.
     */
    public function index(AppModel $app)
    {
        $this->manager->syncStatus($app);
        return response()->json($app->services()->orderBy('recommended', 'desc')->orderBy('id')->get());
    }

    /**
     * POST /apps/{app}/services
     * Create a custom background service.
     */
    public function store(Request $request, AppModel $app)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:100',
            'command'     => 'required|string|max:1000',
            'description' => 'nullable|string|max:500',
            'type'        => 'nullable|in:php-worker,node-worker,custom',
        ]);

        $slug = \Illuminate\Support\Str::slug($validated['name']);

        $service = $app->services()->create([
            'name'        => $validated['name'],
            'slug'        => $slug,
            'type'        => $validated['type'] ?? 'custom',
            'command'     => $validated['command'],
            'description' => $validated['description'] ?? null,
            'recommended' => false,
            'enabled'     => true,
            'status'      => 'stopped',
        ]);

        return response()->json($service, 201);
    }

    /**
     * POST /apps/{app}/services/{service}/start
     */
    public function start(AppModel $app, AppService $service)
    {
        if (!$app->deploy_path) {
            return response()->json(['error' => 'App has not been deployed yet.'], 422);
        }

        $result = $this->manager->start($service);
        return response()->json([
            'exit_code' => $result['exit_code'],
            'output'    => $result['output'],
            'service'   => $service->fresh(),
        ]);
    }

    /**
     * POST /apps/{app}/services/{service}/stop
     */
    public function stop(AppModel $app, AppService $service)
    {
        $result = $this->manager->stop($service);
        return response()->json([
            'exit_code' => $result['exit_code'],
            'output'    => $result['output'],
            'service'   => $service->fresh(),
        ]);
    }

    /**
     * POST /apps/{app}/services/{service}/restart
     */
    public function restart(AppModel $app, AppService $service)
    {
        if (!$app->deploy_path) {
            return response()->json(['error' => 'App has not been deployed yet.'], 422);
        }

        $result = $this->manager->restart($service);
        return response()->json([
            'exit_code' => $result['exit_code'],
            'output'    => $result['output'],
            'service'   => $service->fresh(),
        ]);
    }

    /**
     * GET /apps/{app}/services/{service}/logs
     */
    public function logs(AppModel $app, AppService $service)
    {
        $lines = request()->integer('lines', 150);
        $logs  = $this->manager->logs($service, $lines);
        return response()->json(['logs' => $logs]);
    }

    /**
     * DELETE /apps/{app}/services/{service}
     */
    public function destroy(AppModel $app, AppService $service)
    {
        $this->manager->delete($service);
        $service->delete();
        return response()->json(['message' => 'Service removed']);
    }

    /**
     * POST /apps/{app}/services/install-recommended
     * Install recommended services for this app type (idempotent).
     */
    public function installRecommended(AppModel $app)
    {
        $this->manager->installRecommended($app);
        $this->manager->syncStatus($app);
        return response()->json($app->services()->orderBy('recommended', 'desc')->orderBy('id')->get());
    }

    /**
     * GET /apps/{app}/services/recommended
     * Returns recommended service definitions (not yet added) for the current app type.
     */
    public function recommended(AppModel $app)
    {
        $recs = BackgroundServiceManager::recommendedFor($app->type);
        return response()->json($recs);
    }
}
