<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillableRoute extends Model
{
    protected $fillable = [
        'path',
        'charge_per_request',
        'description',
        'is_active',
    ];

    protected $casts = [
        'charge_per_request' => 'integer',
        'is_active'          => 'boolean',
    ];

    public function usageLogs()
    {
        return $this->hasMany(RequestUsageLog::class);
    }

    /**
     * Normalize a raw request path for matching.
     * Strips leading slash so both "/invoice-create" and "invoice-create" match.
     */
    public static function normalizePath(string $path): string
    {
        return ltrim($path, '/');
    }
}
