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
     * Grant a fresh bKash access token (no cache).
     */
    private function fetchFreshToken(): string
    {
        $response = Http::withHeaders([
            'username'     => $this->cfg('username'),
            'password'     => $this->cfg('password'),
            'Content-Type' => 'application/json',
        ])->post($this->baseUrl() . '/tokenized/checkout/token/grant', [
            'app_key'    => $this->cfg('app_key'),
            'app_secret' => $this->cfg('app_secret'),
        ]);

        if (!$response->successful() || !$response->json('id_token')) {
            Log::error('bKash token grant failed', ['body' => $response->body()]);
            throw new \RuntimeException('bKash token grant failed: ' . $response->body());
        }

        return $response->json('id_token');
    }

    /**
     * Get / refresh the bKash tokenized grant token (cached ~55 min).
     */
    public function getToken(): string
    {
        return Cache::remember('bkash_access_token', 3300, function () {
            return $this->fetchFreshToken();
        });
    }

    /**
     * Bust the cached token and request a new one.
     */
    private function refreshToken(): string
    {
        Cache::forget('bkash_access_token');
        $token = $this->fetchFreshToken();
        Cache::put('bkash_access_token', $token, 3300);
        return $token;
    }

    /**
     * Build and send a create-payment request with the given token.
     */
    private function doCreatePayment(string $token, string $txId, float $amount, string $callbackUrl): \Illuminate\Http\Client\Response
    {
        return Http::withHeaders([
            'Authorization' => $token,
            'X-APP-Key'     => $this->cfg('app_key'),
            'Content-Type'  => 'application/json',
        ])->post($this->baseUrl() . '/tokenized/checkout/create', [
            'mode'                  => '0011',
            'payerReference'        => 'panel_user',
            'callbackURL'           => $callbackUrl,
            'amount'                => number_format($amount, 2, '.', ''),
            'currency'              => 'BDT',
            'intent'                => 'sale',
            'merchantInvoiceNumber' => $txId,
        ]);
    }

    /**
     * Create a bKash payment and return the redirect URL.
     * Automatically retries once with a fresh token if the cached token is stale.
     */
    public function createPayment(string $txId, float $amount, string $callbackUrl): array
    {
        $token    = $this->getToken();
        $response = $this->doCreatePayment($token, $txId, $amount, $callbackUrl);

        // If call failed, the cached token may be stale – refresh and retry once.
        if (!$response->successful() || !$response->json('bkashURL')) {
            Log::warning('bKash create payment failed with cached token, refreshing token and retrying.', [
                'body' => $response->body(),
            ]);

            $token    = $this->refreshToken();
            $response = $this->doCreatePayment($token, $txId, $amount, $callbackUrl);

            if (!$response->successful() || !$response->json('bkashURL')) {
                Log::error('bKash create payment failed after token refresh', ['body' => $response->body()]);
                throw new \RuntimeException('bKash payment creation failed: ' . $response->body());
            }
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

    /**
     * Refund a completed bKash payment.
     */
    public function refund(string $paymentId, string $trxId, float $amount, string $reason = 'Customer request'): array
    {
        $token = $this->getToken();

        $response = Http::withHeaders([
            'Authorization' => $token,
            'X-APP-Key'     => $this->cfg('app_key'),
            'Content-Type'  => 'application/json',
        ])->post($this->baseUrl() . '/tokenized/checkout/payment/refund', [
            'paymentID'       => $paymentId,
            'amount'          => number_format($amount, 2, '.', ''),
            'trxID'           => $trxId,
            'sku'             => 'subscription',
            'reason'          => $reason,
        ]);

        if (!$response->successful()) {
            Log::error('bKash refund failed', ['body' => $response->body()]);
            throw new \RuntimeException('bKash refund failed: ' . $response->body());
        }

        return $response->json();
    }
}
