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
            ->where(function ($q) use ($domain) {
                $q->where('is_public', true);
                if ($domain) {
                    $q->orWhereHas('visibleDomains', function ($sq) use ($domain) {
                        $sq->where('domain', $domain);
                    });
                }
            })
            ->orderBy('sort_order')
            ->orderBy('price');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $currentStatus = null;
        $recentTransactions = [];
        if ($domain) {
            $currentStatus = $this->subscriptionService->getStatusSummaryForDomain($domain);
            $recentTransactions = PaymentTransaction::with('plan')
                ->where('domain', $domain)
                ->latest()
                ->limit(5)
                ->get();
        }

        return response()->json([
            'plans'               => $query->get(),
            'enabled_gateways'    => $this->gatewayFactory->enabledGateways(),
            'system_enabled'      => $this->subscriptionService->isSubscriptionSystemEnabled(),
            'current'             => $currentStatus,
            'recent_transactions' => $recentTransactions,
            'portal_name'         => Setting::get('panel_name', 'Sada Mia Hosting'),
            'portal_logo'         => Setting::get('panel_logo', null),
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
            $callbackUrl = "{$baseUrl}/payment/{$gateway}/callback?tx_id={$transaction->id}&domain=" . urlencode($domain);

            $result = match ($gateway) {
                'bkash'      => $svc->createPayment($txRef, $plan->price, $callbackUrl),
                'nagad'      => $svc->initiatePayment($txRef, $plan->price, $callbackUrl),
                'sslcommerz' => $svc->initiatePayment(
                    $txRef,
                    $plan->price,
                    "{$baseUrl}/payment/sslcommerz/success?tx_id={$transaction->id}&domain=" . urlencode($domain),
                    "{$baseUrl}/payment/sslcommerz/fail?tx_id={$transaction->id}&domain=" . urlencode($domain),
                    "{$baseUrl}/payment/sslcommerz/cancel?tx_id={$transaction->id}&domain=" . urlencode($domain),
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

    /**
     * Public: Fetch full payment result details for the result page.
     * No auth required — only returns safe, non-sensitive info.
     */
    public function paymentResult(Request $request, $txId)
    {
        $transaction = PaymentTransaction::with(['plan'])->find($txId);

        if (!$transaction) {
            return response()->json(['message' => 'Transaction not found.'], 404);
        }

        $domain = $transaction->domain;
        $plan   = $transaction->plan;

        // Load linked subscription if completed
        $subscription = null;
        if ($transaction->status === 'completed' && $domain) {
            $subscription = \App\Models\Subscription::with('plan')
                ->where('domain', $domain)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', $plan?->type ?? 'flat_rate'))
                ->latest()
                ->first();
        }

        return response()->json([
            'status'         => $transaction->status,
            'gateway'        => $transaction->gateway,
            'amount'         => $transaction->amount,
            'currency'       => $transaction->currency ?? 'BDT',
            'transaction_id' => $transaction->transaction_id,
            'gateway_ref'    => $transaction->gateway_ref,
            'created_at'     => $transaction->created_at,
            'domain'         => $domain,
            'plan'           => $plan ? [
                'id'             => $plan->id,
                'name'           => $plan->name,
                'type'           => $plan->type,
                'billing_cycle'  => $plan->billing_cycle,
                'price'          => $plan->price,
                'credit_amount'  => $plan->credit_amount,
                'features'       => $plan->features ?? [],
                'description'    => $plan->description,
            ] : null,
            'subscription'   => $subscription ? [
                'starts_at'      => $subscription->starts_at,
                'ends_at'        => $subscription->ends_at,
                'credit_balance' => $subscription->credit_balance,
                'status'         => $subscription->status,
            ] : null,
        ]);
    }
}
