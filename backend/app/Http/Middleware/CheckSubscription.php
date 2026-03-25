<?php

namespace App\Http\Middleware;

use App\Services\SubscriptionService;
use App\Services\RequestBillingService;
use App\Models\BillableRoute;
use Closure;
use Illuminate\Http\Request;

class CheckSubscription
{
    public function __construct(
        private SubscriptionService   $subscriptionService,
        private RequestBillingService $billingService,
    ) {}

    public function handle(Request $request, Closure $next, string $mode = 'flat_rate')
    {
        // If subscription system is disabled, always pass through
        if (!$this->subscriptionService->isSubscriptionSystemEnabled()) {
            return $next($request);
        }

        $domain = $request->query('domain') ?? $request->header('X-Domain');

        if (!$domain) {
            return response()->json(['message' => 'Domain identifier is required for subscription/billing checks.'], 400);
        }

        if ($mode === 'flat_rate') {
            // Check active flat-rate plan (cached 1 day)
            if (!$this->subscriptionService->isActive($domain)) {
                return response()->json([
                    'message'              => 'An active subscription is required for this domain.',
                    'subscription_expired' => true,
                ], 403);
            }
        }

        if ($mode === 'request_billing') {
            // Deduct credits for matching billable routes
            $path = BillableRoute::normalizePath($request->path());
            $charged = $this->billingService->charge($domain, $path);

            if (!$charged) {
                return response()->json([
                    'message'              => 'Insufficient request credits for this domain.',
                    'insufficient_credits' => true,
                    'credit_balance'       => $this->subscriptionService->getCredits($domain),
                ], 402);
            }
        }

        return $next($request);
    }
}
