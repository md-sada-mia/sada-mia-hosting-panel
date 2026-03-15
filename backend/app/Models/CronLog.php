<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CronLog extends Model
{
    protected $fillable = [
        'cron_job_id',
        'command_name',
        'status',
        'output',
        'duration',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'duration' => 'float',
    ];

    public function cronJob(): BelongsTo
    {
        return $this->belongsTo(CronJob::class);
    }
}
