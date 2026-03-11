<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App;
use Illuminate\Http\Request;

class EnvController extends Controller
{
    public function index(App $app)
    {
        // Return key-value pairs (values shown)
        $env = $app->envVariables()->get()->map(fn($e) => [
            'id'    => $e->id,
            'key'   => $e->key,
            'value' => $e->value,
        ]);

        return response()->json($env);
    }

    public function update(Request $request, App $app)
    {
        $request->validate([
            'variables'         => 'required|array',
            'variables.*.key'   => 'required|string|regex:/^[A-Z0-9_]+$/i',
            'variables.*.value' => 'nullable|string',
        ]);

        // Sync — replace all env vars for this app
        $app->envVariables()->delete();

        $now = now();
        $rows = collect($request->variables)->map(fn($v) => [
            'app_id'     => $app->id,
            'key'        => strtoupper($v['key']),
            'value'      => $v['value'] ?? '',
            'created_at' => $now,
            'updated_at' => $now,
        ])->toArray();

        \App\Models\EnvVariable::insert($rows);

        return response()->json(['message' => 'Environment variables updated']);
    }
}
