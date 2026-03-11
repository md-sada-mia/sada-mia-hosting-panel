<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Domain extends Model
{
    protected $fillable = [
        'app_id',
        'domain',
        'nameserver_1',
        'nameserver_2',
        'nameserver_3',
        'nameserver_4',
        'status',
        'dns_managed',
        'notes',
    ];

    protected $casts = [
        'dns_managed' => 'boolean',
    ];

    public function app(): BelongsTo
    {
        return $this->belongsTo(App::class);
    }

    public function dnsRecords(): HasMany
    {
        return $this->hasMany(DnsRecord::class);
    }

    public function emailDomain(): HasOne
    {
        return $this->hasOne(EmailDomain::class);
    }
}
