<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'name',
        'business_name',
        'email',
        'phone',
        'address',
        'notes',
        'status',
        'resource_type',
        'resource_id',
    ];

    public function resourceApp()
    {
        return $this->belongsTo(App::class, 'resource_id');
    }

    public function resourceLoadBalancer()
    {
        return $this->belongsTo(LoadBalancer::class, 'resource_id');
    }
}
