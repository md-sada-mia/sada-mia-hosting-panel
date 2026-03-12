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
            'github_client_secret' => Setting::get('github_client_secret'),
            'github_webhook_secret' => Setting::get('github_webhook_secret'),
            'github_connected' => (bool) Setting::get('github_access_token'),
            'dns_default_ns1' => Setting::get('dns_default_ns1'),
            'dns_default_ns2' => Setting::get('dns_default_ns2'),
            'dns_default_ns3' => Setting::get('dns_default_ns3'),
            'dns_default_ns4' => Setting::get('dns_default_ns4'),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'github_client_id' => 'nullable|string',
            'github_client_secret' => 'nullable|string',
            'github_webhook_secret' => 'nullable|string',
            'dns_default_ns1' => 'nullable|string',
            'dns_default_ns2' => 'nullable|string',
            'dns_default_ns3' => 'nullable|string',
            'dns_default_ns4' => 'nullable|string',
        ]);

        foreach ($validated as $key => $value) {
            Setting::set($key, $value);
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }
}
