<?php

namespace App\Services;

use App\Models\User;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\PaymentTransaction;
use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
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
        return (bool) Setting::get('subscription_enabled', false);
    }

    /**
     * Cache key for user subscription status.
     */
    private function cacheKey(User $user): string
    {
        return "subscription_status_{$user->id}";
    }

    /**
     * Flush the 1-day cache for a user. Call on payment success / plan change.
     */
    public function invalidateCache(User $user): void
    {
        Cache::forget($this->cacheKey($user));
        // Also flush billable credit cache
        Cache::forget("subscription_credits_{$user->id}");
    }

    /**
     * Get the user's current active flat-rate subscription (cached 1 day).
     */
    public function getCurrentSubscription(User $user): ?Subscription
    {
        $cacheKey = $this->cacheKey($user);

        $data = Cache::remember($cacheKey, self::CACHE_TTL_MINUTES * 60, function () use ($user) {
            $sub = Subscription::with('plan')
                ->where('user_id', $user->id)
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
     * Check if user has an active flat-rate subscription.
     * If subscription system is off, always returns true.
     */
    public function isActive(User $user): bool
    {
        if (!$this->isSubscriptionSystemEnabled()) {
            return true;
        }

        $sub = $this->getCurrentSubscription($user);
        return $sub !== null && $sub->isActive();
    }

    /**
     * Get user's remaining request credits (from latest request_credit subscription).
     */
    public function getCredits(User $user): int
    {
        return Cache::remember("subscription_credits_{$user->id}", 30, function () use ($user) {
            $sub = Subscription::where('user_id', $user->id)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', 'request_credit'))
                ->orderByDesc('created_at')
                ->first();

            return $sub?->credit_balance ?? 0;
        });
    }

    /**
     * Deduct credits from the user's latest request_credit subscription.
     * Returns the new balance or -1 if insufficient.
     */
    public function deductCredits(User $user, int $amount): int
    {
        $sub = Subscription::where('user_id', $user->id)
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
        Cache::forget("subscription_credits_{$user->id}");

        return $sub->fresh()->credit_balance;
    }

    /**
     * Activate a subscription after successful payment.
     */
    public function activate(User $user, SubscriptionPlan $plan, PaymentTransaction $transaction): Subscription
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

            // Expire any existing active flat-rate subscription
            Subscription::where('user_id', $user->id)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', 'flat_rate'))
                ->update(['status' => 'expired']);

            $subscription = Subscription::create([
                'user_id'    => $user->id,
                'plan_id'    => $plan->id,
                'status'     => 'active',
                'starts_at'  => $starts,
                'ends_at'    => $ends,
            ]);
        } else {
            // Request credit: top up the latest active credit subscription or create new
            $existing = Subscription::where('user_id', $user->id)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', 'request_credit'))
                ->first();

            if ($existing) {
                $existing->increment('credit_balance', $plan->credit_amount ?? 0);
                $subscription = $existing;
            } else {
                $subscription = Subscription::create([
                    'user_id'        => $user->id,
                    'plan_id'        => $plan->id,
                    'status'         => 'active',
                    'credit_balance' => $plan->credit_amount ?? 0,
                ]);
            }
        }

        // Link transaction → subscription
        $transaction->update(['subscription_id' => $subscription->id]);

        $this->invalidateCache($user);

        return $subscription;
    }

    /**
     * Get summary of subscription status for API responses.
     */
    public function getStatusSummary(User $user): array
    {
        $systemEnabled = $this->isSubscriptionSystemEnabled();

        return [
            'system_enabled'     => $systemEnabled,
            'flat_rate_active'   => $systemEnabled ? $this->isActive($user) : null,
            'credit_balance'     => $this->getCredits($user),
            'flat_subscription'  => $this->getCurrentSubscription($user)?->load('plan'),
            'credit_subscription' => Subscription::with('plan')
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->whereHas('plan', fn($q) => $q->where('type', 'request_credit'))
                ->first(),
        ];
    }
}
