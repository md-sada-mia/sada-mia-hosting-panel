<?php

namespace App\Services;

use App\Models\Setting;

class PaymentGatewayFactory
{
    public function __construct(
        private BkashPaymentService      $bkash,
        private NagadPaymentService      $nagad,
        private SslCommercePaymentService $sslCommerz,
    ) {}

    /**
     * Resolve the requested gateway service.
     * Throws if the gateway is not enabled in settings.
     */
    public function make(string $gateway): BkashPaymentService|NagadPaymentService|SslCommercePaymentService
    {
        $settingKey = "{$gateway}_enabled";

        if (!(bool) Setting::get($settingKey, false)) {
            throw new \RuntimeException("Payment gateway '{$gateway}' is not enabled.");
        }

        return match ($gateway) {
            'bkash'      => $this->bkash,
            'nagad'      => $this->nagad,
            'sslcommerz' => $this->sslCommerz,
            default      => throw new \InvalidArgumentException("Unknown gateway: {$gateway}"),
        };
    }

    /**
     * Returns a list of all enabled gateways for the frontend.
     */
    public function enabledGateways(): array
    {
        $all = ['bkash', 'nagad', 'sslcommerz'];

        return array_values(array_filter($all, fn($g) => (bool) Setting::get("{$g}_enabled", false)));
    }
}
