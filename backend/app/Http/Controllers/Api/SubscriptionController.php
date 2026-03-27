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
     * Admin: Get overall billing statistics.
     */
    public function adminStats(Request $request)
    {
        $from   = $request->query('from');
        $to     = $request->query('to');
        $domain = $request->query('domain');

        $revenueQuery = PaymentTransaction::where('status', 'completed');
        $txQuery      = PaymentTransaction::with('plan');
        $subQuery     = \App\Models\Subscription::where('status', 'active');

        if ($from) {
            $revenueQuery->whereDate('created_at', '>=', $from);
            $txQuery->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $revenueQuery->whereDate('created_at', '<=', $to);
            $txQuery->whereDate('created_at', '<=', $to);
        }

        $totalRevenue = $revenueQuery->sum('amount');

        // For active subscriptions, we usually look at the current state, 
        // but if filtering by date, we might want to see how many were active/created then.
        // However, user usually wants to see "Revenue in this period". 
        // I'll keep active counts as "current" unless the user asks for historical snapshots.

        $activeFlat   = \App\Models\Subscription::where('status', 'active')
            ->whereHas('plan', fn($q) => $q->where('type', 'flat_rate'))
            ->count();

        $totalCredits = (clone $subQuery)->whereHas('plan', fn($q) => $q->where('type', 'request_credit'))
            ->sum('credit_balance');

        return response()->json([
            'total_revenue'      => $totalRevenue,
            'active_flat_rate'   => $activeFlat,
            'total_credits_held' => $totalCredits,
            'recent_transactions' => $txQuery->latest()->limit(10)->get()
        ]);
    }

    /**
     * Admin: List all transactions (paginated + searchable).
     */
    public function transactions(Request $request)
    {
        $query = PaymentTransaction::with(['plan'])->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('domain', 'like', "%{$search}%")
                    ->orWhere('transaction_id', 'like', "%{$search}%")
                    ->orWhere('gateway_ref', 'like', "%{$search}%")
                    ->orWhereHas('plan', fn($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        if ($gateway = $request->query('gateway')) {
            $query->where('gateway', $gateway);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        return response()->json($query->paginate(20));
    }

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
            'is_public' => 'boolean',
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
            'is_public' => 'boolean',
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
            $callbackDomain = $request->input('domain'); // Optional domain to carry over
            $domainParam = $callbackDomain ? "&domain=" . urlencode($callbackDomain) : "";
            $callbackUrl = "{$baseUrl}/payment/{$gateway}/callback?tx_id={$transaction->id}{$domainParam}";

            $result = match ($gateway) {
                'bkash'      => $svc->createPayment($txRef, $plan->price, $callbackUrl),
                'nagad'      => $svc->initiatePayment($txRef, $plan->price, $callbackUrl),
                'sslcommerz' => $svc->initiatePayment(
                    $txRef,
                    $plan->price,
                    "{$baseUrl}/payment/sslcommerz/success?tx_id={$transaction->id}{$domainParam}",
                    "{$baseUrl}/payment/sslcommerz/fail?tx_id={$transaction->id}{$domainParam}",
                    "{$baseUrl}/payment/sslcommerz/cancel?tx_id={$transaction->id}{$domainParam}",
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

    /**
     * Admin: Get visible plans for a domain
     */
    public function getDomainVisiblePlans($domain)
    {
        $planIds = \App\Models\PlanDomainVisibility::where('domain', $domain)->pluck('plan_id');
        return response()->json($planIds);
    }

    /**
     * Admin: Update visible plans for a domain
     */
    public function updateDomainVisiblePlans(Request $request, $domain)
    {
        $request->validate([
            'plan_ids' => 'array',
            'plan_ids.*' => 'exists:subscription_plans,id',
        ]);

        \App\Models\PlanDomainVisibility::where('domain', $domain)->delete();

        if ($request->has('plan_ids')) {
            foreach ($request->plan_ids as $planId) {
                \App\Models\PlanDomainVisibility::create([
                    'plan_id' => $planId,
                    'domain' => $domain,
                ]);
            }
        }

        return response()->json(['message' => 'Visibility updated']);
    }
}
