<?php

namespace App\Services;

use App\Models\BillableRoute;
use App\Models\RequestUsageLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RequestBillingService
{
    public function __construct(
        private SubscriptionService $subscriptionService
    ) {}

    /**
     * Find a matching active billable route for the given request path.
     * Accepts paths with or without leading slash, e.g.:
     *   /invoice-create  →  matches route path "invoice-create"
     *   invoice/create   →  matches route path "invoice/create"
     */
    public function matchRoute(string $path): ?BillableRoute
    {
        $normalized = BillableRoute::normalizePath($path);

        return BillableRoute::where('is_active', true)
            ->where('path', $normalized)
            ->first();
    }

    /**
     * Attempt to charge the domain for hitting a billable route.
     * Returns true on success, false if insufficient credits or route not found/inactive.
     */
    public function charge(string $domain, string $requestPath): bool
    {
        $route = $this->matchRoute($requestPath);

        if (!$route) {
            return true; // Not a billable route — allow
        }

        return DB::transaction(function () use ($domain, $route) {
            $newBalance = $this->subscriptionService->deductCredits($domain, $route->charge_per_request);

            if ($newBalance === -1) {
                return false; // Insufficient credits
            }

            RequestUsageLog::create([
                'domain'           => $domain,
                'billable_route_id' => $route->id,
                'path_hit'         => $route->path,
                'credits_charged'  => $route->charge_per_request,
                'created_at'       => now(),
            ]);

            return true;
        });
    }

    /**
     * Get paginated usage history for a domain.
     */
    public function getUsageHistory(string $domain, int $perPage = 20)
    {
        return RequestUsageLog::with('billableRoute')
            ->where('domain', $domain)
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }
}
