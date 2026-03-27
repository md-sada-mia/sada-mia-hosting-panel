<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'type',
        'price',
        'billing_cycle',
        'credit_amount',
        'features',
        'is_active',
        'is_public',
        'sort_order',
    ];

    protected $casts = [
        'features'      => 'array',
        'is_active'     => 'boolean',
        'is_public'     => 'boolean',
        'price'         => 'decimal:2',
        'credit_amount' => 'integer',
        'sort_order'    => 'integer',
    ];

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class, 'plan_id');
    }

    public function isFlatRate(): bool
    {
        return $this->type === 'flat_rate';
    }

    public function isRequestCredit(): bool
    {
        return $this->type === 'request_credit';
    }

    public function visibleDomains()
    {
        return $this->hasMany(PlanDomainVisibility::class, 'plan_id');
    }
}
