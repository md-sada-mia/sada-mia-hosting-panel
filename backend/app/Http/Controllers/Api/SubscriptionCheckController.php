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

        $app = \App\Models\App::where('domain', $domain)->first();
        if ($app && $app->status === 'deactivated') {
            return response()->noContent(403);
        }

        $deployment = \App\Models\CustomerDeployment::where('domain', $domain)
            ->orWhere('subdomain', $domain)
            ->first();
        if ($deployment && $deployment->status === 'deactivated') {
            return response()->noContent(403);
        }

        $lbDomain = \App\Models\LoadBalancerDomain::where('domain', $domain)->first();
        if ($lbDomain && $lbDomain->status === 'deactivated') {
            return response()->noContent(403);
        }

        if ($this->subscriptionService->isActive($domain)) {
            return response()->noContent(200);
        }

        return response()->noContent(403); // Change 403  for "Payment Required"
    }

    public function expirationInfo(Request $request)
    {
        $domainStr = $request->get('domain', $request->getHost());
        
        // Strip port if present
        // $domainStr = strtolower(trim(explode(':', $domainStr)[0]));

        $customer = null;

        // Try App
        $app = \App\Models\App::where('domain', $domainStr)->first();
        if ($app) {
            $customer = \App\Models\Customer::where('resource_type', 'app')
                ->where('resource_id', $app->id)
                ->first();
        }

        // Try Load Balancer if no customer yet
        if (!$customer) {
            $lb = \App\Models\LoadBalancer::where('domain', $domainStr)->first();
            if ($lb) {
                $customer = \App\Models\Customer::where('resource_type', 'load_balancer')
                    ->where('resource_id', $lb->id)
                    ->first();
            }
        }

        // Try Customer Deployment (CRM) if no customer yet
        if (!$customer) {
            $deployment = \App\Models\CustomerDeployment::where('domain', $domainStr)
                ->orWhere('subdomain', $domainStr)
                ->first();
            if ($deployment) {
                $customer = $deployment->customer;
            }
        }

        // Try LoadBalancerDomain directly if still no customer
        if (!$customer) {
            $lbDomain = \App\Models\LoadBalancerDomain::where('domain', $domainStr)->first();
        }

        $isDeactivated = false;
        if (isset($app) && $app->status === 'deactivated') {
            $isDeactivated = true;
        } elseif (isset($deployment) && $deployment->status === 'deactivated') {
            $isDeactivated = true;
        } elseif (isset($lbDomain) && $lbDomain->status === 'deactivated') {
            $isDeactivated = true;
        }

        $latestSub = \App\Models\Subscription::where('domain', $domainStr)
            ->whereHas('plan', fn($q) => $q->where('type', 'flat_rate'))
            ->orderByDesc('ends_at')
            ->first();

        $paymentUrl = \App\Models\Setting::get('payment_callback_base_url') ?: \App\Models\Setting::get('panel_url', 'http://127.0.0.1:8083');

        $data = [
            'domain' => $domainStr,
            'customer' => $customer,
            'is_deactivated' => $isDeactivated,
            'is_expired' => !$this->subscriptionService->isActive($domainStr) && !$isDeactivated,
            'expire_date' => $latestSub?->ends_at?->toIso8601String(),
            'notification_html' => $this->subscriptionService->generateNotificationHtml($domainStr, $isDeactivated, $paymentUrl),
            'payment_url' => $paymentUrl,
            'support_email' => \App\Models\Setting::get('support_email'),
            'support_whatsapp' => \App\Models\Setting::get('support_whatsapp'),
            'support_facebook' => \App\Models\Setting::get('support_facebook'),
            'support_mobile' => \App\Models\Setting::get('support_mobile'),
        ];

        if (str_starts_with($request->getHost(), 'api.')) {
            return response()->json($data);
        }

        return view('subscription-expired', $data);
    }
}
