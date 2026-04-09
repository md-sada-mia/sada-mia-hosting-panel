<?php

namespace App\Services;

use App\Models\User;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\PaymentTransaction;
use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class SubscriptionService
{
    /** Cache TTL: 1 day in minutes */
    const CACHE_TTL_MINUTES = 1440;

    /**
     * Is the subscription system enabled globally?
     */
    public function isSubscriptionSystemEnabled(): bool
    {
        $val = Setting::get('subscription_enabled', false);
        return filter_var($val, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Cache key for domain subscription status.
     */
    private function cacheKey(string $domain): string
    {
        return "subscription_status_{$domain}";
    }

    /**
     * Flush the 1-day cache for a domain. Call on payment success / plan change.
     */
    public function invalidateCache(string $domain): void
    {
        Cache::forget($this->cacheKey($domain));
        // Also flush billable credit cache
        Cache::forget("subscription_credits_{$domain}");
    }

    /**
     * Get the domain's current active flat-rate subscription (cached 1 day).
     */
    public function getCurrentSubscription(string $domain): ?Subscription
    {
        $cacheKey = $this->cacheKey($domain);

        $data = Cache::remember($cacheKey, self::CACHE_TTL_MINUTES * 60, function () use ($domain) {
            $sub = Subscription::with('plan')
                ->where('domain', $domain)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', 'flat_rate'))
                ->latest()
                ->first();

            if (!$sub) return null;

            // Auto-expire if past ends_at
            if ($sub->ends_at && $sub->ends_at->isPast()) {
                $sub->update(['status' => 'expired']);
                return null;
            }

            return $sub;
        });

        return $data instanceof Subscription ? $data : null;
    }

    /**
     * Check if domain has an active flat-rate subscription.
     * If subscription system is off, always returns true.
     */
    public function isActive(string $domain): bool
    {
        if (!$this->isSubscriptionSystemEnabled()) {
            return true;
        }

        $sub = $this->getCurrentSubscription($domain);
        return $sub !== null && $sub->isActive();
    }

    /**
     * Get domain's remaining request credits (from latest request_credit subscription).
     */
    public function getCredits(string $domain): int
    {
        return Cache::remember("subscription_credits_{$domain}", 30, function () use ($domain) {
            $sub = Subscription::where('domain', $domain)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', 'request_credit'))
                ->orderByDesc('created_at')
                ->first();

            return $sub?->credit_balance ?? 0;
        });
    }

    /**
     * Deduct credits from the domain's latest request_credit subscription.
     * Returns the new balance or -1 if insufficient.
     */
    public function deductCredits(string $domain, int $amount): int
    {
        $sub = Subscription::where('domain', $domain)
            ->where('status', 'active')
            ->whereHas('plan', fn($q) => $q->where('type', 'request_credit'))
            ->orderByDesc('created_at')
            ->lockForUpdate()
            ->first();

        if (!$sub || $sub->credit_balance < $amount) {
            return -1;
        }

        $sub->decrement('credit_balance', $amount);

        // Flush short-lived credit cache
        Cache::forget("subscription_credits_{$domain}");

        return $sub->fresh()->credit_balance;
    }

    /**
     * Activate a subscription after successful payment.
     */
    public function activate(string $domain, SubscriptionPlan $plan, PaymentTransaction $transaction): Subscription
    {
        if ($plan->isFlatRate()) {
            // Calculate period
            $starts = Carbon::now();
            $ends = match ($plan->billing_cycle) {
                'monthly'  => $starts->copy()->addMonth(),
                'yearly'   => $starts->copy()->addYear(),
                'one_time' => null,
                default    => $starts->copy()->addMonth(),
            };

            // We no longer expire existing flat-rate subscriptions to support multiple concurrent plans.

            $subscription = Subscription::create([
                'domain'     => $domain,
                'plan_id'    => $plan->id,
                'status'     => 'active',
                'starts_at'  => $starts,
                'ends_at'    => $ends,
            ]);
        } else {
            // Request credit: always create a new subscription record
            $subscription = Subscription::create([
                'domain'         => $domain,
                'plan_id'        => $plan->id,
                'status'         => 'active',
                'credit_balance' => $plan->credit_amount ?? 0,
            ]);
        }

        // Link transaction → subscription
        $transaction->update(['subscription_id' => $subscription->id]);

        $this->invalidateCache($domain);

        return $subscription;
    }

    /**
     * Admin: Manually activate a subscription without payment.
     */
    public function activateManual(string $domain, SubscriptionPlan $plan, ?string $customEndsAt = null): Subscription
    {
        if ($plan->isFlatRate()) {
            $starts = Carbon::now();
            if ($customEndsAt) {
                $ends = Carbon::parse($customEndsAt);
            } else {
                $ends = match ($plan->billing_cycle) {
                    'monthly'  => $starts->copy()->addMonth(),
                    'yearly'   => $starts->copy()->addYear(),
                    'one_time' => null,
                    default    => $starts->copy()->addMonth(),
                };
            }

            $subscription = Subscription::create([
                'domain'    => $domain,
                'plan_id'   => $plan->id,
                'status'    => 'active',
                'starts_at' => $starts,
                'ends_at'   => $ends,
            ]);
        } else {
            $subscription = Subscription::create([
                'domain'         => $domain,
                'plan_id'        => $plan->id,
                'status'         => 'active',
                'credit_balance' => $plan->credit_amount ?? 0,
            ]);
        }

        $this->invalidateCache($domain);

        return $subscription;
    }

    /**
     * Compatibility for Admin Panel: Get summary for a user (uses panel domain as context).
     */
    public function getStatusSummary(User $user): array
    {
        // For the admin panel, we use the panel's own address as the domain context 
        // to show the user their "panel subscription" status.
        $domain = parse_url(Setting::get('panel_url', config('app.url')), PHP_URL_HOST) ?? 'localhost';
        return $this->getStatusSummaryForDomain($domain);
    }

    /**
     * Get summary of subscription status for API responses.
     */
    public function getStatusSummaryForDomain(string $domain): array
    {
        $systemEnabled = $this->isSubscriptionSystemEnabled();

        $flatSubs = Subscription::with('plan')
            ->where('domain', $domain)
            ->where('status', 'active')
            ->whereHas('plan', fn($q) => $q->where('type', 'flat_rate'))
            ->orderBy('ends_at', 'desc')
            ->get();

        return [
            'system_enabled'     => $systemEnabled,
            'flat_rate_active'   => $systemEnabled ? $this->isActive($domain) : null,
            'credit_balance'     => $this->getCredits($domain),
            'expire_date'        => $flatSubs->first()?->ends_at?->toIso8601String(),
            'notification_html'  => $systemEnabled ? $this->generateNotificationHtml($domain) : '',
            'flat_subscriptions' => $flatSubs,
            'credit_subscriptions' => Subscription::with('plan')
                ->where('domain', $domain)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', 'request_credit'))
                ->orderBy('created_at', 'desc')
                ->get(),
        ];
    }

    /**
     * Generate a styled HTML notification banner for the domain's subscription status.
     */
    public function generateNotificationHtml(string $domain, bool $isDeactivated = false): string
    {
        if (!$this->isSubscriptionSystemEnabled()) {
            return '';
        }

        $latestSub = Subscription::where('domain', $domain)
            ->whereHas('plan', fn($q) => $q->where('type', 'flat_rate'))
            ->orderByDesc('ends_at')
            ->first();

        $isActive = $this->isActive($domain);
        $expireDate = $latestSub?->ends_at;

        // Default colors (Success/Active)
        $bgColor = '#064e3b';
        $borderColor = '#059669';
        $textColor = '#d1fae5';

        if ($isDeactivated) {
            $bgColor = '#450a0a';
            $borderColor = '#dc2626';
            $textColor = '#fee2e2';
            $message = "Domain <strong>{$domain}</strong> has been deactivated. Please contact support.";
        } elseif (!$isActive) {
            $bgColor = '#450a0a';
            $borderColor = '#dc2626';
            $textColor = '#fee2e2';
            if ($expireDate) {
                $message = "Your subscription for <strong>{$domain}</strong> expired on <strong>" . $expireDate->format('M d, Y') . "</strong>. Please renew to avoid service interruption.";
            } else {
                $message = "No active subscription found for <strong>{$domain}</strong>.";
            }
        } else {
            $message = "Your subscription for <strong>{$domain}</strong> is active until <strong>" . ($expireDate ? $expireDate->format('M d, Y') : 'N/A') . "</strong>.";
        }

        return <<<HTML
<div class="subscription-notification" style="padding: 12px 16px; background-color: {$bgColor}; border: 1px solid {$borderColor}; color: {$textColor}; border-radius: 8px; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">
    <div style="flex-shrink: 0;">
        <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
    </div>
    <div>{$message}</div>
</div>
HTML;
    }

    /**
     * Revert or deactivate a subscription when a refund is processed.
     */
    public function refundSubscription(PaymentTransaction $transaction, string $reason = 'Refunded'): void
    {
        $subscription = $transaction->subscription;
        if (!$subscription) {
            return;
        }

        $plan = $transaction->plan;
        if ($plan->isFlatRate()) {
            // Flat rate: simply mark the subscription as refunded (deactivates it)
            $subscription->update(['status' => 'refunded']);
        } else {
            // Request credit: deduct the added credits
            $creditsToDeduct = $plan->credit_amount ?? 0;
            $currentBalance = $subscription->credit_balance;

            // Log if we're deducting more than they have (they spent some)
            if ($currentBalance < $creditsToDeduct) {
                Log::warning("Refunding metered subscription for domain {$subscription->domain}. " .
                    "Deducting {$creditsToDeduct} credits, but current balance is {$currentBalance}. Setting to 0.");
                $subscription->update([
                    'credit_balance' => 0,
                    'status' => 'refunded'
                ]);
            } else {
                $subscription->decrement('credit_balance', $creditsToDeduct);
                $subscription->update(['status' => 'refunded']);
            }
        }

        $this->invalidateCache($subscription->domain);
    }
}
