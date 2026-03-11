<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
    ];

    protected $casts = [
        'port' => 'integer',
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

    public function latestDeployment()
    {
        return $this->hasOne(Deployment::class)->latestOfMany();
    }
}
