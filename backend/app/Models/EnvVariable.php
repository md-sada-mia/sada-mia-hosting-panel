<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EnvVariable extends Model
{
    protected $fillable = ['app_id', 'key', 'value'];

    protected $hidden = ['value']; // masked by default, controller reveals as needed

    public function app(): BelongsTo
    {
        return $this->belongsTo(App::class);
    }
}
