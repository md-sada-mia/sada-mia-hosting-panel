<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailAccount extends Model
{
    protected $fillable = [
        'email_domain_id',
        'username',
        'password_hash',
        'quota_mb',
        'active',
    ];

    protected $hidden = ['password_hash'];

    protected $casts = [
        'quota_mb' => 'integer',
        'active'   => 'boolean',
    ];

    public function emailDomain(): BelongsTo
    {
        return $this->belongsTo(EmailDomain::class);
    }

    /**
     * Returns the full email address e.g. user@domain.com
     */
    public function getFullEmailAttribute(): string
    {
        return $this->username . '@' . $this->emailDomain->domain->domain;
    }
}
