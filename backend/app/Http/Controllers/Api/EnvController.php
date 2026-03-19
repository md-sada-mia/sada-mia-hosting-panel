<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App;
use Illuminate\Http\Request;

class EnvController extends Controller
{
    public function index(App $app)
    {
        return response()->json([
            'env_vars' => $app->env_vars ?? ''
        ]);
    }

    public function update(Request $request, App $app)
    {
        $request->validate([
            'env_vars' => 'required|string',
        ]);

        $app->update(['env_vars' => $request->env_vars]);

        return response()->json(['message' => 'Environment variables updated']);
    }
}
