<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json([
            'github_client_id' => Setting::get('github_client_id'),
            'github_client_secret' => Setting::get('github_client_secret') ? '********' : null,
            'github_webhook_secret' => Setting::get('github_webhook_secret') ? '********' : null,
            'github_connected' => (bool) Setting::get('github_access_token'),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'github_client_id' => 'nullable|string',
            'github_client_secret' => 'nullable|string',
            'github_webhook_secret' => 'nullable|string',
        ]);

        foreach ($validated as $key => $value) {
            if ($value !== null && $value !== '********') {
                Setting::set($key, $value);
            }
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }
}
