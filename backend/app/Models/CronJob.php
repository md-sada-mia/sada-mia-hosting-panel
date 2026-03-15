<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CronJob extends Model
{
    protected $fillable = [
        'command',
        'schedule',
        'description',
        'is_active',
        'last_run_at',
        'last_status',
        'last_output',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_run_at' => 'datetime',
    ];
    public function logs()
    {
        return $this->hasMany(CronLog::class)->orderByDesc('created_at');
    }
}
