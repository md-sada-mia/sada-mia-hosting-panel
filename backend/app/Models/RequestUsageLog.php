<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequestUsageLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'domain',
        'billable_route_id',
        'path_hit',
        'credits_charged',
        'created_at',
    ];

    protected $casts = [
        'credits_charged' => 'integer',
        'created_at'      => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function billableRoute()
    {
        return $this->belongsTo(BillableRoute::class);
    }
}
