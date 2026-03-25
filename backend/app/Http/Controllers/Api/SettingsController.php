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
            'panel_domain_alert_dismissed' => (bool) Setting::get('panel_domain_alert_dismissed', false),
            'panel_force_https' => (bool) Setting::get('panel_force_https', false),
            'crm_api_enabled' => (bool) Setting::get('crm_api_enabled', false),
            'crm_api_url' => Setting::get('crm_api_url'),
            'crm_api_method' => Setting::get('crm_api_method', 'POST'),
            'crm_api_payload_template' => Setting::get('crm_api_payload_template', "{\n  \"id\": \"{id}\",\n  \"name\": \"{name}\",\n  \"email\": \"{email}\",\n  \"domain\": \"{domain}\",\n  \"status\": \"{status}\"\n}"),
            'crm_api_auth_enabled' => (bool) Setting::get('crm_api_auth_enabled', false),
            'crm_api_auth_url' => Setting::get('crm_api_auth_url'),
            'crm_api_auth_payload' => Setting::get('crm_api_auth_payload', "{\n  \"username\": \"admin\",\n  \"password\": \"password\"\n}"),
            'crm_api_auth_token_key' => Setting::get('crm_api_auth_token_key', 'access_token'),
            'crm_api_auth_token_type' => Setting::get('crm_api_auth_token_type', 'Bearer'),

            // ── Subscription & Payment Settings ──────────────────────────────
            'subscription_enabled'           => (bool) Setting::get('subscription_enabled', false),
            'payment_callback_base_url'      => Setting::get('payment_callback_base_url'),

            // bKash
            'bkash_enabled'                  => (bool) Setting::get('bkash_enabled', false),
            'bkash_base_url'                 => Setting::get('bkash_base_url', 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
            'bkash_app_key'                  => Setting::get('bkash_app_key'),
            'bkash_app_secret'               => Setting::get('bkash_app_secret') ? '**hidden**' : null,
            'bkash_username'                 => Setting::get('bkash_username'),
            'bkash_sandbox'                  => (bool) Setting::get('bkash_sandbox', true),

            // Nagad
            'nagad_enabled'                  => (bool) Setting::get('nagad_enabled', false),
            'nagad_base_url'                 => Setting::get('nagad_base_url', 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0'),
            'nagad_merchant_id'              => Setting::get('nagad_merchant_id'),
            'nagad_sandbox'                  => (bool) Setting::get('nagad_sandbox', true),

            // SSL Commerce
            'sslcommerz_enabled'             => (bool) Setting::get('sslcommerz_enabled', false),
            'sslcommerz_base_url'            => Setting::get('sslcommerz_base_url', 'https://sandbox.sslcommerz.com'),
            'sslcommerz_store_id'            => Setting::get('sslcommerz_store_id'),
            'sslcommerz_sandbox'             => (bool) Setting::get('sslcommerz_sandbox', true),
            'sslcommerz_sandbox'             => (bool) Setting::get('sslcommerz_sandbox', true),

            // Branding
            'gateway_logo_url'               => Setting::get('gateway_logo_url'),
        ]);
    }

    public function uploadLogo(Request $request)
    {
        $request->validate([
            'logo' => 'required|image|max:2048',
        ]);

        $file = $request->file('logo');
        $filename = 'gateway_logo.' . $file->getClientOriginalExtension();

        // Save to backend/public/logos
        $file->move(public_path('logos'), $filename);

        $url = url('/logos/' . $filename);
        Setting::set('gateway_logo_url', $url);

        return response()->json(['url' => $url, 'message' => 'Logo uploaded successfully.']);
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
            'panel_domain_alert_dismissed' => 'nullable|boolean',
            'panel_force_https' => 'nullable|boolean',
            'crm_api_enabled' => 'nullable|boolean',
            'crm_api_url' => 'nullable|string',
            'crm_api_method' => 'nullable|string',
            'crm_api_payload_template' => 'nullable|string',
            'crm_api_auth_enabled' => 'nullable|boolean',
            'crm_api_auth_url' => 'nullable|string',
            'crm_api_auth_payload' => 'nullable|string',
            'crm_api_auth_token_key'      => 'nullable|string',
            'crm_api_auth_token_type'     => 'nullable|string',

            // Subscription & Payment
            'subscription_enabled'        => 'nullable|boolean',
            'payment_callback_base_url'   => 'nullable|string',

            // bKash
            'bkash_enabled'               => 'nullable|boolean',
            'bkash_base_url'              => 'nullable|string',
            'bkash_app_key'               => 'nullable|string',
            'bkash_app_secret'            => 'nullable|string',
            'bkash_username'              => 'nullable|string',
            'bkash_password'              => 'nullable|string',
            'bkash_sandbox'               => 'nullable|boolean',

            // Nagad
            'nagad_enabled'               => 'nullable|boolean',
            'nagad_base_url'              => 'nullable|string',
            'nagad_merchant_id'           => 'nullable|string',
            'nagad_merchant_private_key'  => 'nullable|string',
            'nagad_pg_public_key'         => 'nullable|string',
            'nagad_sandbox'               => 'nullable|boolean',

            // SSL Commerce
            'sslcommerz_enabled'          => 'nullable|boolean',
            'sslcommerz_base_url'         => 'nullable|string',
            'sslcommerz_store_id'         => 'nullable|string',
            'sslcommerz_store_password'   => 'nullable|string',
            'sslcommerz_sandbox'          => 'nullable|boolean',
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
