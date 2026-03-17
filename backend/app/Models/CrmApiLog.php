<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CrmApiLog extends Model
{
    protected $fillable = [
        'customer_id',
        'url',
        'method',
        'payload',
        'response',
        'status_code'
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
