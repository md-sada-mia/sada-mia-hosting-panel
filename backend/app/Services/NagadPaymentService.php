<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NagadPaymentService
{
    private function cfg(string $key): ?string
    {
        return Setting::get("nagad_{$key}");
    }

    private function baseUrl(): string
    {
        return rtrim($this->cfg('base_url') ?: 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0', '/');
    }

    /**
     * Sign data with the merchant private key (RSA PKCS#8).
     */
    private function sign(string $data): string
    {
        $privateKeyPem = "-----BEGIN PRIVATE KEY-----\n"
            . chunk_split($this->cfg('merchant_private_key') ?? '', 64, "\n")
            . "-----END PRIVATE KEY-----";

        $privateKey = openssl_pkey_get_private($privateKeyPem);
        if (!$privateKey) {
            throw new \RuntimeException('Nagad: invalid merchant private key in settings');
        }

        openssl_sign($data, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        return base64_encode($signature);
    }

    /**
     * Encrypt sensitive data with Nagad PG public key.
     */
    private function encrypt(string $data): string
    {
        $publicKeyPem = "-----BEGIN PUBLIC KEY-----\n"
            . chunk_split($this->cfg('pg_public_key') ?? '', 64, "\n")
            . "-----END PUBLIC KEY-----";

        $publicKey = openssl_pkey_get_public($publicKeyPem);
        if (!$publicKey) {
            throw new \RuntimeException('Nagad: invalid PG public key in settings');
        }

        openssl_public_encrypt($data, $encrypted, $publicKey, OPENSSL_PKCS1_PADDING);
        return base64_encode($encrypted);
    }

    /**
     * Initiate a Nagad payment and return the redirect URL.
     */
    public function initiatePayment(string $orderId, float $amount, string $callbackUrl): array
    {
        $merchantId = $this->cfg('merchant_id');
        $datetime   = now()->format('YmdHis');

        $sensitiveData = json_encode([
            'merchantId'     => $merchantId,
            'datetime'       => $datetime,
            'orderId'        => $orderId,
            'challenge'      => bin2hex(random_bytes(16)),
        ]);

        $initResponse = Http::withHeaders(['X-KM-IP-V4' => request()->ip()])
            ->post($this->baseUrl() . "/api/dfs/check-out/initialize/{$merchantId}/{$orderId}", [
                'accountNumber'  => $merchantId,
                'dateTime'       => $datetime,
                'sensitiveData'  => $this->encrypt($sensitiveData),
                'signature'      => $this->sign($sensitiveData),
            ]);

        if (!$initResponse->successful()) {
            Log::error('Nagad init failed', ['body' => $initResponse->body()]);
            throw new \RuntimeException('Nagad init failed: ' . $initResponse->body());
        }

        $initJson = $initResponse->json();
        $paymentRefId = $initJson['paymentReferenceId'] ?? null;
        $challenge    = $initJson['challenge'] ?? null;

        if (!$paymentRefId) {
            throw new \RuntimeException('Nagad: no paymentReferenceId in init response');
        }

        // Complete checkout
        $completeSensitive = json_encode([
            'merchantId'       => $merchantId,
            'orderId'          => $orderId,
            'amount'           => number_format($amount, 2, '.', ''),
            'currencyCode'     => '050',
            'challenge'        => $challenge,
        ]);

        $completeResponse = Http::post(
            $this->baseUrl() . "/api/dfs/check-out/complete/{$paymentRefId}",
            [
                'sensitiveData'   => $this->encrypt($completeSensitive),
                'signature'       => $this->sign($completeSensitive),
                'merchantCallbackURL' => $callbackUrl,
            ]
        );

        if (!$completeResponse->successful()) {
            Log::error('Nagad complete failed', ['body' => $completeResponse->body()]);
            throw new \RuntimeException('Nagad complete failed: ' . $completeResponse->body());
        }

        $data = $completeResponse->json();

        return [
            'payment_ref_id' => $paymentRefId,
            'payment_url'    => $data['callBackUrl'] ?? null,
            'raw'            => $data,
        ];
    }

    /**
     * Verify payment status for a given paymentRefId.
     */
    public function verifyPayment(string $paymentRefId): array
    {
        $merchantId = $this->cfg('merchant_id');

        $response = Http::get(
            $this->baseUrl() . "/api/dfs/verify/payment/{$paymentRefId}"
        );

        if (!$response->successful()) {
            Log::error('Nagad verify failed', ['body' => $response->body()]);
            throw new \RuntimeException('Nagad verify failed: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Refund a completed Nagad payment.
     */
    public function refund(string $paymentRefId, float $amount, string $orderId): array
    {
        $merchantId = $this->cfg('merchant_id');

        $sensitiveData = json_encode([
            'merchantId'       => $merchantId,
            'paymentReferenceId' => $paymentRefId,
            'refundAmount'     => number_format($amount, 2, '.', ''),
            'orderId'          => $orderId,
        ]);

        $response = Http::post(
            $this->baseUrl() . "/api/dfs/check-out/refund/{$merchantId}",
            [
                'sensitiveData' => $this->encrypt($sensitiveData),
                'signature'     => $this->sign($sensitiveData),
            ]
        );

        if (!$response->successful()) {
            Log::error('Nagad refund failed', ['body' => $response->body()]);
            throw new \RuntimeException('Nagad refund failed: ' . $response->body());
        }

        return $response->json();
    }
}
