<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerDeployment extends Model
{
    protected $fillable = [
        'customer_id',
        'resource_type',
        'app_id',
        'load_balancer_id',
        'domain_mode',
        'domain',
        'subdomain',
        'app_type',
        'existing_app',
        'git_url',
        'branch',
        'github_full_name',
        'github_id',
        'auto_deploy',
        'env_vars',
        'auto_db_create',
        'db_name',
        'db_user',
        'db_password',
        'status',
    ];

    protected $casts = [
        'existing_app' => 'boolean',
        'auto_deploy' => 'boolean',
        'auto_db_create' => 'boolean',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
