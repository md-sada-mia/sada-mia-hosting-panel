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
            'crm_creation_type' => Setting::get('crm_creation_type', 'load_balancer'),
            'crm_default_lb_id' => Setting::get('crm_default_lb_id'),
            'crm_default_deployment_domain' => Setting::get('crm_default_deployment_domain'),
            'panel_url' => Setting::get('panel_url'),
            'server_ip' => Setting::get('server_ip'),
            'ns_default_domain' => Setting::get('ns_default_domain'),
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
            'crm_creation_type' => 'nullable|in:app,load_balancer',
            'crm_default_lb_id' => 'nullable|integer',
            'crm_default_deployment_domain' => 'nullable|string',
            'panel_url' => 'nullable|string',
            'server_ip' => 'nullable|ip',
            'ns_default_domain' => 'nullable|string',
        ]);

        if (isset($validated['panel_url']) && !empty($validated['panel_url'])) {
            $url = $validated['panel_url'];

            // Ensure protocol
            if (!preg_match("~^(?:f|ht)tps?://~i", $url)) {
                $url = "http://" . $url;
            }

            $parsed = parse_url($url);
            $port = env('PANEL_PORT', '8083');

            // If port is not in the URL, append it
            if (!isset($parsed['port']) && $port) {
                $url = rtrim($url, '/') . ':' . $port;
            }

            $validated['panel_url'] = $url;
        }

        foreach ($validated as $key => $value) {
            Setting::set($key, $value);
        }

        return response()->json(['message' => 'Settings updated successfully']);
    }
}
