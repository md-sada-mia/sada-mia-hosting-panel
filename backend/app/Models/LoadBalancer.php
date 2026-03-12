<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoadBalancer extends Model
{
    protected $fillable = [
        'name',
        'method',
        'status',
    ];

    public function apps()
    {
        return $this->belongsToMany(App::class, 'load_balancer_apps');
    }

    public function domains()
    {
        return $this->hasMany(LoadBalancerDomain::class);
    }
}
