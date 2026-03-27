<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlanDomainVisibility extends Model
{
    protected $table = 'plan_domain_visibility';

    protected $fillable = [
        'plan_id',
        'domain',
    ];

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }
}
