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
    ];

    protected $casts = [
        'port' => 'integer',
        'auto_deploy' => 'boolean',
    ];

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
}
