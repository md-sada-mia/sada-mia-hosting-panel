<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Database extends Model
{
    protected $fillable = [
        'app_id',
        'db_name',
        'db_user',
        'db_password',
        'status',
    ];

    protected $hidden = ['db_password'];

    public function app(): BelongsTo
    {
        return $this->belongsTo(App::class);
    }

    public function users(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(DatabaseUser::class)->withPivot('privileges');
    }
}
