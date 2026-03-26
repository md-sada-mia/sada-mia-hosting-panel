<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

/**
 * Called internally by Nginx auth_request to verify if a domain's subscription is active.
 *
 * Returns:
 *   200 OK           → subscription active, Nginx proceeds normally
 *   402 Payment Req  → subscription expired/inactive, Nginx serves the @expired error page
 */
class SubscriptionCheckController extends Controller
{
    public function __construct(private SubscriptionService $subscriptionService) {}

    public function check(Request $request)
    {
        $domain = $request->query('domain', $request->getHost());

        // Strip port if present (e.g. "example.com:443" → "example.com")
        $domain = strtolower(trim(explode(':', $domain)[0]));

        if ($this->subscriptionService->isActive($domain)) {
            return response()->noContent(200);
        }

        return response()->noContent(403);
    }
}
