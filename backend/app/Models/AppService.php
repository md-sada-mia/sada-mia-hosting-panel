<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppService extends Model
{
    protected $fillable = [
        'app_id',
        'name',
        'slug',
        'type',
        'command',
        'description',
        'recommended',
        'enabled',
        'status',
        'started_at',
    ];

    protected $casts = [
        'recommended' => 'boolean',
        'enabled'     => 'boolean',
        'started_at'  => 'datetime',
    ];

    public function app(): BelongsTo
    {
        return $this->belongsTo(App::class);
    }

    /**
     * Compute a unique PM2/systemd process name for this service.
     */
    public function getProcessName(): string
    {
        return "svc-{$this->app_id}-{$this->id}";
    }
}
