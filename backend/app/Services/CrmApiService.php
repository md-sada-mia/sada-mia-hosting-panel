<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\Customer;
use App\Models\CrmApiLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CrmApiService
{
    public function execute(Customer $customer)
    {
        if (!Setting::get('crm_api_enabled')) {
            return;
        }

        $url = Setting::get('crm_api_url');
        $method = strtoupper(Setting::get('crm_api_method', 'POST'));
        $payloadTemplate = Setting::get('crm_api_payload_template', '');

        if (empty($url)) {
            return;
        }

        try {
            $headers = [];

            // 1. Handle Authentication if enabled
            if (Setting::get('crm_api_auth_enabled')) {
                $authUrl = Setting::get('crm_api_auth_url');
                $authPayloadTemplate = Setting::get('crm_api_auth_payload', '');
                $tokenKey = Setting::get('crm_api_auth_token_key', 'access_token');

                if ($authUrl) {
                    $authPayload = $this->replaceVariables($authPayloadTemplate, $customer);
                    $authPayloadArr = json_decode($authPayload, true) ?: [];

                    $authResponse = Http::post($authUrl, $authPayloadArr);

                    if ($authResponse->successful()) {
                        $token = $authResponse->json($tokenKey);
                        if ($token) {
                            $tokenType = Setting::get('crm_api_auth_token_type', 'Bearer');
                            $headers['Authorization'] = $tokenType . ' ' . $token;
                        }
                    } else {
                        Log::error("CRM API Auth failed for customer {$customer->id}: " . $authResponse->body());
                    }
                }
            }

            // 2. Prepare Main Payload
            $payload = $this->replaceVariables($payloadTemplate, $customer);
            $payloadArr = json_decode($payload, true) ?: [];

            // 3. Execute Main API Call
            $response = Http::withHeaders($headers)->send($method, $url, [
                'json' => $payloadArr
            ]);

            // 4. Log the result
            CrmApiLog::create([
                'customer_id' => $customer->id,
                'url'         => $url,
                'method'      => $method,
                'payload'     => $payload,
                'response'    => $response->body(),
                'status_code' => $response->status(),
            ]);
        } catch (\Exception $e) {
            Log::error("CRM API Call failed for customer {$customer->id}: " . $e->getMessage());

            CrmApiLog::create([
                'customer_id' => $customer->id,
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
        $resource = $customer->resolveResource($customer); // Assuming resolveResource is available or logic is replicated

        $variables = [
            '{id}'            => $customer->id,
            '{name}'          => $customer->name,
            '{business_name}' => $customer->business_name,
            '{email}'         => $customer->email,
            '{phone}'         => $customer->phone,
            '{address}'       => $customer->address,
            '{status}'        => $customer->status,
            '{domain}'        => $resource['domain'] ?? ($resource['domains'][0] ?? ''),
            '{resource_type}' => $customer->resource_type,
            '{resource_id}'   => $customer->resource_id,
        ];

        return str_replace(array_keys($variables), array_values($variables), $template);
    }
}
