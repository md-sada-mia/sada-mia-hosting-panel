<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SslCommercePaymentService
{
    private function cfg(string $key): ?string
    {
        return Setting::get("sslcommerz_{$key}");
    }

    private function baseUrl(): string
    {
        return rtrim($this->cfg('base_url') ?: 'https://sandbox.sslcommerz.com', '/');
    }

    /**
     * Initiate an SSL Commerce payment and return the gateway redirect URL.
     */
    public function initiatePayment(
        string $txId,
        float $amount,
        string $successUrl,
        string $failUrl,
        string $cancelUrl,
        array $customerInfo = []
    ): array {
        $payload = array_merge([
            'store_id'       => $this->cfg('store_id'),
            'store_passwd'   => $this->cfg('store_password'),
            'total_amount'   => number_format($amount, 2, '.', ''),
            'currency'       => 'BDT',
            'tran_id'        => $txId,
            'success_url'    => $successUrl,
            'fail_url'       => $failUrl,
            'cancel_url'     => $cancelUrl,
            'ipn_url'        => $successUrl, // reuse success endpoint or set separate IPN
            'product_name'   => 'Subscription Plan',
            'product_category' => 'Service',
            'product_profile'  => 'non-physical-goods',
        ], $customerInfo);

        $response = Http::asForm()->post(
            $this->baseUrl() . '/gwprocess/apiV4r',
            $payload
        );

        if (!$response->successful()) {
            Log::error('SSL Commerce initiate failed', ['body' => $response->body()]);
            throw new \RuntimeException('SSL Commerce initiation failed: ' . $response->body());
        }

        $data = $response->json();

        if (($data['status'] ?? '') !== 'SUCCESS') {
            throw new \RuntimeException('SSL Commerce initiation error: ' . ($data['failedreason'] ?? 'Unknown'));
        }

        return [
            'payment_url'   => $data['GatewayPageURL'],
            'session_key'   => $data['sessionkey'] ?? null,
            'raw'           => $data,
        ];
    }

    /**
     * Validate an IPN/callback hit by verifying the hash.
     * See: https://developer.sslcommerz.com/doc/v4/#ipn-validation
     */
    public function verifyIpn(array $data): bool
    {
        $receivedHash = $data['verify_sign'] ?? '';
        $receivedKey  = $data['verify_key']  ?? '';

        if (!$receivedHash || !$receivedKey) {
            return false;
        }

        $keys = explode(',', $receivedKey);
        $hashString = '';

        foreach ($keys as $key) {
            $hashString .= $data[$key] . '&';
        }

        $hashString .= $this->cfg('store_password');
        $expectedHash = md5($hashString);

        return hash_equals($expectedHash, $receivedHash);
    }

    /**
     * Validate a completed transaction via SSL Commerce order validation API.
     */
    public function validatePayment(string $tranId): array
    {
        $response = Http::get($this->baseUrl() . '/validator/api/validationserverAPI.php', [
            'val_id'       => $tranId,
            'store_id'     => $this->cfg('store_id'),
            'store_passwd' => $this->cfg('store_password'),
            'format'       => 'json',
        ]);

        if (!$response->successful()) {
            Log::error('SSL Commerce validation failed', ['tran_id' => $tranId]);
            throw new \RuntimeException('SSL Commerce validation failed');
        }

        return $response->json();
    }
}
