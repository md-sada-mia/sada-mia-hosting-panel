<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoadBalancerDomain extends Model
{
    protected $fillable = [
        'load_balancer_id',
        'domain',
        'ssl_status',
        'ssl_enabled',
        'ssl_last_check_at',
        'ssl_log',
        'force_https',
        'status',
    ];

    public function loadBalancer()
    {
        return $this->belongsTo(LoadBalancer::class);
    }
}
