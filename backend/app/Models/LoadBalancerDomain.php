<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoadBalancerDomain extends Model
{
    protected $fillable = [
        'load_balancer_id',
        'domain',
    ];

    public function loadBalancer()
    {
        return $this->belongsTo(LoadBalancer::class);
    }
}
