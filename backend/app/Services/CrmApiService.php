<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\Customer;
use App\Models\CrmApiLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CrmApiService
{
    public function execute(Customer $customer, ?callable $logger = null)
    {
        $log = function (string $line) use ($logger) {
            if ($logger) $logger($line);
        };

        if (!Setting::get('crm_api_enabled')) {
            $log("CRM API is disabled in settings.");
            return;
        }

        $log("CRM API is enabled. Preparing request...");

        $url = Setting::get('crm_api_url');
        $method = strtoupper(Setting::get('crm_api_method', 'POST'));
        $payloadTemplate = Setting::get('crm_api_payload_template', '');

        if (empty($url)) {
            $log("[ERROR] CRM API URL is not configured.");
            return;
        }

        $log("CRM Target URL: {$url}");

        $payload = null;

        try {
            $headers = [];

            // 1. Handle Authentication if enabled
            if (Setting::get('crm_api_auth_enabled')) {
                $authUrl = Setting::get('crm_api_auth_url');
                $authPayloadTemplate = Setting::get('crm_api_auth_payload', '');
                $tokenKey = Setting::get('crm_api_auth_token_key', 'access_token');

                if ($authUrl) {
                    $log("Authenticating with CRM API at {$authUrl}...");
                    $payload = $this->replaceVariables($authPayloadTemplate, $customer);
                    $authPayloadArr = json_decode($payload, true) ?: [];
                    $log("Auth Payload: " . json_encode($authPayloadArr, JSON_PRETTY_PRINT));

                    $authResponse = Http::timeout(120)->post($authUrl, $authPayloadArr);

                    if ($authResponse->successful()) {
                        $log("Authentication successful.");
                        $log("Auth Response: " . $authResponse->body());
                        // Log the successful auth attempt
                        CrmApiLog::create([
                            'customer_id' => $customer->id,
                            'type'        => 'auth',
                            'url'         => $authUrl,
                            'method'      => 'POST',
                            'payload'     => $payload,
                            'response'    => $authResponse->body(),
                            'status_code' => $authResponse->status(),
                        ]);

                        $token = $authResponse->json($tokenKey);
                        if ($token) {
                            $tokenType = Setting::get('crm_api_auth_token_type', 'Bearer');
                            $headers['Authorization'] = $tokenType . ' ' . $token;
                        }
                    } else {
                        $log("[ERROR] CRM API Auth failed (Status: {$authResponse->status()})");
                        $log("Response: " . substr($authResponse->body(), 0, 500));
                        Log::error("CRM API Auth failed for customer {$customer->id}: " . $authResponse->body());

                        // Log the failed auth attempt
                        CrmApiLog::create([
                            'customer_id' => $customer->id,
                            'type'        => 'auth',
                            'url'         => $authUrl,
                            'method'      => 'POST',
                            'payload'     => $payload,
                            'response'    => $authResponse->body(),
                            'status_code' => $authResponse->status(),
                        ]);
                        return; // Stop if auth fails
                    }
                }
            }

            // 2. Prepare Main Payload
            $log("Preparing main CRM payload...");
            $payload = $this->replaceVariables($payloadTemplate, $customer);
            $payloadArr = json_decode($payload, true) ?: [];

            $log("Sending request to CRM API...");
            $log("URL: [{$method}] {$url}");
            $log("Payload: " . json_encode($payloadArr, JSON_PRETTY_PRINT));

            // 3. Execute Main API Call
            $response = Http::timeout(280)->withHeaders($headers)->send($method, $url, [
                'json' => $payloadArr
            ]);

            $log("CRM API Response (Status: {$response->status()}):");
            $log($response->body());

            // 4. Log the result
            CrmApiLog::create([
                'customer_id' => $customer->id,
                'type'        => 'sync',
                'url'         => $url,
                'method'      => $method,
                'payload'     => $payload,
                'response'    => $response->body(),
                'status_code' => $response->status(),
            ]);
        } catch (\Exception $e) {
            $log("[ERROR] CRM API Call failed: " . $e->getMessage());
            Log::error("CRM API Call failed for customer {$customer->id}: " . $e->getMessage());

            CrmApiLog::create([
                'customer_id' => $customer->id,
                'type'        => 'sync',
                'url'         => $url,
                'method'      => $method,
                'payload'     => $payload ?? null,
                'response'    => $e->getMessage(),
                'status_code' => 500,
            ]);
        }
    }

    private function replaceVariables($template, Customer $customer)
    {
        if (empty($template)) return '';

        // Fetch the latest deployment for this customer to ensure we use the info of the app being currently created/updated
        $deployment = $customer->deployment()->latest('id')->first();

        $domain = '';
        $resourceId = $customer->resource_id;
        $resourceType = $customer->resource_type;

        if ($deployment) {
            $domain = $deployment->domain;
            $resourceId = $deployment->app_id ?: $deployment->load_balancer_id;
            $resourceType = $deployment->resource_type;
        }

        $variables = [
            '{id}'            => $customer->id,
            '{customer_id}'   => $customer->id,
            '{name}'          => $customer->name,
            '{business_name}' => $customer->business_name,
            '{email}'         => $customer->email,
            '{phone}'         => $customer->phone,
            '{address}'       => $customer->address,
            '{status}'        => $customer->status,
            '{domain}'        => $domain,
            '{resource_type}' => $resourceType,
            '{resource_id}'   => $resourceId,
            '{app_id}'        => $deployment?->app_id ?? $resourceId,
            '{app_type}'      => $deployment?->app_type ?? '',
            '{git_url}'       => $deployment?->git_url ?? '',
            '{branch}'        => $deployment?->branch ?? '',
        ];

        return str_replace(array_keys($variables), array_values($variables), $template);
    }
}
