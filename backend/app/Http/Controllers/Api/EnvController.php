<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App;
use Illuminate\Http\Request;

class EnvController extends Controller
{
    public function index(App $app)
    {
        $content = '';
        $envFile = $app->getEnvFilePath();
        if ($app->deploy_path && file_exists($envFile)) {
            $content = file_get_contents($envFile);
        }

        return response()->json([
            'env_vars' => $content
        ]);
    }

    public function update(Request $request, App $app)
    {
        $request->validate([
            'env_vars' => 'required|string',
        ]);

        if (!$app->deploy_path) {
            return response()->json(['error' => 'App is not deployed yet. Please deploy first.'], 422);
        }

        file_put_contents($app->getEnvFilePath(), $request->env_vars);

        return response()->json(['message' => 'Environment variables updated (disk)']);
    }
}
