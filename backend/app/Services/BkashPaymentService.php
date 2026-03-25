<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BkashPaymentService
{
    private function cfg(string $key): ?string
    {
        return Setting::get("bkash_{$key}");
    }

    private function baseUrl(): string
    {
        return rtrim($this->cfg('base_url') ?: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta', '/');
    }

    /**
     * Get / refresh the bKash tokenized grant token (cached ~59 min).
     */
    public function getToken(): string
    {
        return Cache::remember('bkash_access_token', 3540, function () {
            $response = Http::withHeaders([
                'username'     => $this->cfg('username'),
                'password'     => $this->cfg('password'),
                'Content-Type' => 'application/json',
            ])->post($this->baseUrl() . '/tokenized/checkout/token/grant', [
                'app_key'    => $this->cfg('app_key'),
                'app_secret' => $this->cfg('app_secret'),
            ]);

            if (!$response->successful()) {
                Log::error('bKash token grant failed', ['body' => $response->body()]);
                throw new \RuntimeException('bKash token grant failed: ' . $response->body());
            }

            return $response->json('id_token');
        });
    }

    /**
     * Create a bKash payment and return the redirect URL.
     */
    public function createPayment(string $txId, float $amount, string $callbackUrl): array
    {
        $token = $this->getToken();

        $response = Http::withHeaders([
            'Authorization' => $token,
            'X-APP-Key'     => $this->cfg('app_key'),
            'Content-Type'  => 'application/json',
        ])->post($this->baseUrl() . '/tokenized/checkout/create', [
            'mode'                => '0011',
            'payerReference'      => 'panel_user',
            'callbackURL'         => $callbackUrl,
            'amount'              => number_format($amount, 2, '.', ''),
            'currency'            => 'BDT',
            'intent'              => 'sale',
            'merchantInvoiceNumber' => $txId,
        ]);

        if (!$response->successful() || !$response->json('bkashURL')) {
            Log::error('bKash create payment failed', ['body' => $response->body()]);
            throw new \RuntimeException('bKash payment creation failed: ' . $response->body());
        }

        return [
            'payment_id'  => $response->json('paymentID'),
            'payment_url' => $response->json('bkashURL'),
            'status'      => $response->json('statusCode'),
            'raw'         => $response->json(),
        ];
    }

    /**
     * Execute (finalise) a bKash payment and return result.
     */
    public function executePayment(string $paymentId): array
    {
        $token = $this->getToken();

        $response = Http::withHeaders([
            'Authorization' => $token,
            'X-APP-Key'     => $this->cfg('app_key'),
            'Content-Type'  => 'application/json',
        ])->post($this->baseUrl() . '/tokenized/checkout/execute', [
            'paymentID' => $paymentId,
        ]);

        if (!$response->successful()) {
            Log::error('bKash execute payment failed', ['body' => $response->body()]);
            throw new \RuntimeException('bKash execute failed: ' . $response->body());
        }

        return $response->json();
    }
}
