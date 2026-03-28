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

    public function deployment()
    {
        return $this->hasOne(CustomerDeployment::class)->latest();
    }

    public function crmApiLogs()
    {
        return $this->hasMany(CrmApiLog::class);
    }

    public function deployments()
    {
        return $this->hasMany(CustomerDeployment::class);
    }
}
