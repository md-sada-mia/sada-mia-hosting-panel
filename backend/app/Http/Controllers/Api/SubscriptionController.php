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

class SubscriptionController extends Controller
{
    public function __construct(
        private SubscriptionService   $subscriptionService,
        private PaymentGatewayFactory $gatewayFactory,
    ) {}

    /**
     * List all active subscription plans.
     * Optionally filter by type: ?type=flat_rate|request_credit
     */
    public function plans(Request $request)
    {
        $query = SubscriptionPlan::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('price');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        return response()->json([
            'plans'            => $query->get(),
            'enabled_gateways' => $this->gatewayFactory->enabledGateways(),
            'system_enabled'   => $this->subscriptionService->isSubscriptionSystemEnabled(),
        ]);
    }

    /**
     * Admin: Get all plans including inactive ones
     */
    public function indexPlansAdmin()
    {
        return response()->json(SubscriptionPlan::orderBy('sort_order')->orderBy('price')->get());
    }

    /**
     * Admin: Create a new plan
     */
    public function storePlan(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:flat_rate,request_credit',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'billing_cycle' => 'nullable|in:monthly,yearly,lifetime',
            'credit_amount' => 'nullable|integer|min:0',
            'features' => 'nullable|array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        if (empty($validated['features'])) $validated['features'] = [];
        $validated['slug'] = Str::slug($validated['name']) . '-' . uniqid();

        $plan = SubscriptionPlan::create($validated);
        return response()->json($plan, 201);
    }

    /**
     * Admin: Update an existing plan
     */
    public function updatePlan(Request $request, SubscriptionPlan $plan)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:flat_rate,request_credit',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'billing_cycle' => 'nullable|in:monthly,yearly,lifetime',
            'credit_amount' => 'nullable|integer|min:0',
            'features' => 'nullable|array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        if (empty($validated['features'])) $validated['features'] = [];

        $plan->update($validated);
        return response()->json($plan);
    }

    /**
     * Admin: Delete a plan
     */
    public function destroyPlan(SubscriptionPlan $plan)
    {
        $plan->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Get current subscription status and credit balance.
     */
    public function current(Request $request)
    {
        return response()->json(
            $this->subscriptionService->getStatusSummary($request->user())
        );
    }

    /**
     * Initiate a subscription purchase and return gateway redirect URL.
     */
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'plan_id' => 'required|exists:subscription_plans,id',
            'gateway' => 'required|in:bkash,nagad,sslcommerz',
        ]);

        $plan = SubscriptionPlan::findOrFail($validated['plan_id']);

        if (!$plan->is_active) {
            return response()->json(['message' => 'This plan is no longer available.'], 422);
        }

        $user    = $request->user();
        $txRef   = 'SUB-' . strtoupper(Str::random(12));
        $baseUrl = rtrim(Setting::get('payment_callback_base_url') ?: config('app.url'), '/');
        $gateway = $validated['gateway'];

        // Create a pending transaction first
        $transaction = PaymentTransaction::create([
            'user_id'     => $user->id,
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

    /**
     * Cancel active flat-rate subscription.
     */
    public function cancel(Request $request)
    {
        $user = $request->user();
        $sub = $user->subscription;

        if (!$sub || !$sub->isActive()) {
            return response()->json(['message' => 'No active subscription to cancel.'], 422);
        }

        $sub->update(['status' => 'cancelled']);
        $this->subscriptionService->invalidateCache($user);

        return response()->json(['message' => 'Subscription cancelled.']);
    }
}
