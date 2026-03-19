<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class App extends Model
{
    protected $fillable = [
        'name',
        'type',
        'domain',
        'git_url',
        'branch',
        'deploy_path',
        'port',
        'status',
        'php_version',
        'github_full_name',
        'github_id',
        'webhook_secret',
        'auto_deploy',
        'hide_guidelines',
        'ssl_status',
        'ssl_enabled',
        'ssl_last_check_at',
        'ssl_log',
        'force_https',
    ];

    protected $casts = [
        'port' => 'integer',
        'auto_deploy' => 'boolean',
        'hide_guidelines' => 'boolean',
        'ssl_enabled' => 'boolean',
        'force_https' => 'boolean',
        'ssl_last_check_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::created(function (App $app) {
            app(\App\Services\BackgroundServiceManager::class)->installRecommended($app);
        });
    }

    public function deployments(): HasMany
    {
        return $this->hasMany(Deployment::class);
    }

    public function databases(): HasMany
    {
        return $this->hasMany(Database::class);
    }

    public function envVariables(): HasMany
    {
        return $this->hasMany(EnvVariable::class);
    }

    public function domainRecord(): HasOne
    {
        return $this->hasOne(\App\Models\Domain::class);
    }

    public function latestDeployment()
    {
        return $this->hasOne(Deployment::class)->latestOfMany();
    }

    public function loadBalancers()
    {
        return $this->belongsToMany(\App\Models\LoadBalancer::class, 'load_balancer_apps');
    }

    public function services()
    {
        return $this->hasMany(\App\Models\AppService::class);
    }
}
