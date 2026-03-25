<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use App\Models\PaymentTransaction;
use App\Services\SubscriptionService;
use App\Services\PaymentGatewayFactory;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PublicPortalController extends Controller
{
    public function __construct(
        private SubscriptionService   $subscriptionService,
        private PaymentGatewayFactory $gatewayFactory,
    ) {}

    public function info(Request $request)
    {
        $domain = $request->query('domain');

        $query = SubscriptionPlan::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('price');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $currentStatus = null;
        if ($domain) {
            $currentStatus = $this->subscriptionService->getStatusSummaryForDomain($domain);
        }

        return response()->json([
            'plans'            => $query->get(),
            'enabled_gateways' => $this->gatewayFactory->enabledGateways(),
            'system_enabled'   => $this->subscriptionService->isSubscriptionSystemEnabled(),
            'current'          => $currentStatus,
            'portal_name'      => Setting::get('app_name', 'Sada Mia Hosting'),
        ]);
    }

    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'domain'  => 'required|string',
            'plan_id' => 'required|exists:subscription_plans,id',
            'gateway' => 'required|in:bkash,nagad,sslcommerz',
        ]);

        $plan = SubscriptionPlan::find($validated['plan_id']);

        if (!$plan->is_active) {
            return response()->json(['message' => 'This plan is no longer available.'], 422);
        }

        $domain  = $validated['domain'];
        $txRef   = 'SUB-' . strtoupper(Str::random(12));
        $baseUrl = rtrim(Setting::get('payment_callback_base_url') ?: config('app.url'), '/');
        $gateway = $validated['gateway'];

        $transaction = PaymentTransaction::create([
            'domain'      => $domain,
            'plan_id'     => $plan->id,
            'gateway'     => $gateway,
            'amount'      => $plan->price,
            'status'      => 'pending',
            'gateway_ref' => $txRef,
        ]);

        try {
            $svc = $this->gatewayFactory->make($gateway);
            $callbackUrl = "{$baseUrl}/api/payment/{$gateway}/callback?tx_id={$transaction->id}";

            $result = match ($gateway) {
                'bkash'      => $svc->createPayment($txRef, $plan->price, $callbackUrl),
                'nagad'      => $svc->initiatePayment($txRef, $plan->price, $callbackUrl),
                'sslcommerz' => $svc->initiatePayment(
                    $txRef,
                    $plan->price,
                    "{$baseUrl}/api/payment/sslcommerz/success?tx_id={$transaction->id}",
                    "{$baseUrl}/api/payment/sslcommerz/fail?tx_id={$transaction->id}",
                    "{$baseUrl}/api/payment/sslcommerz/cancel?tx_id={$transaction->id}",
                ),
            };

            $paymentUrl = $result['payment_url'] ?? $result['callBackUrl'] ?? null;

            $transaction->update([
                'payment_url'  => $paymentUrl,
                'gateway_ref'  => $result['payment_id'] ?? $result['payment_ref_id'] ?? $result['session_key'] ?? $txRef,
                'raw_response' => $result['raw'] ?? $result,
            ]);

            return response()->json([
                'transaction_id' => $transaction->id,
                'payment_url'    => $paymentUrl,
                'gateway'        => $gateway,
            ]);
        } catch (\Exception $e) {
            $transaction->update(['status' => 'failed']);
            return response()->json(['message' => 'Payment initiation failed: ' . $e->getMessage()], 500);
        }
    }
}
