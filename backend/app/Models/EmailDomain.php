<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailDomain extends Model
{
    protected $fillable = [
        'domain_id',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(EmailAccount::class);
    }

    public function aliases(): HasMany
    {
        return $this->hasMany(EmailAlias::class);
    }
}
