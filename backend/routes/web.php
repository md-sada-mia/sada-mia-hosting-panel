<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PaymentController;

// ── API Documentation Portal ────────────────────────────────────────────────
Route::group(['domain' => 'api.{domain}', 'where' => ['domain' => '.*']], function () {
    Route::get('/', [\App\Http\Controllers\Api\ApiDocsController::class, 'indexWeb']);
});

// Global Fallback
Route::get('/', function () {
    return view('welcome');
});


// ── Payment Gateway Callbacks (Public, no /api prefix) ──────────────────────
Route::get('/payment/bkash/callback',      [PaymentController::class, 'bkashCallback']);
Route::get('/payment/nagad/callback',      [PaymentController::class, 'nagadCallback']);
Route::post('/payment/sslcommerz/ipn',     [PaymentController::class, 'sslIpn']);
    Route::post('/payment/sslcommerz/fail',    [PaymentController::class, 'sslFail']);
    Route::post('/payment/sslcommerz/cancel',  [PaymentController::class, 'sslCancel']);
