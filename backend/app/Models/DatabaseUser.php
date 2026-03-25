<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class DatabaseUser extends Model
{
    protected $fillable = [
        'username',
        'password',
        'status',
    ];

    protected $hidden = [
        'password',
    ];

    public function databases(): BelongsToMany
    {
        return $this->belongsToMany(Database::class)->withPivot('privileges');
    }
}
