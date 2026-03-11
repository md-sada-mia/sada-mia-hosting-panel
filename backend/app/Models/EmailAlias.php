<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailAlias extends Model
{
    protected $fillable = [
        'email_domain_id',
        'source',
        'destination',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function emailDomain(): BelongsTo
    {
        return $this->belongsTo(EmailDomain::class);
    }
}
