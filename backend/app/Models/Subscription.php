<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Subscription extends Model
{
    protected $fillable = [
        'user_id',
        'domain',
        'plan_id',
        'status',
        'starts_at',
        'ends_at',
        'trial_ends_at',
        'credit_balance',
    ];

    protected $casts = [
        'starts_at'      => 'datetime',
        'ends_at'        => 'datetime',
        'trial_ends_at'  => 'datetime',
        'credit_balance' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    public function transactions()
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    /**
     * Whether this flat-rate subscription is currently active.
     */
    public function isActive(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }

        return true;
    }

    /**
     * Whether this is a request-credit subscription.
     */
    public function isCreditType(): bool
    {
        return $this->plan?->isRequestCredit() ?? false;
    }

    /**
     * Whether credit balance is available.
     */
    public function hasCredits(): bool
    {
        return $this->credit_balance > 0;
    }
}
