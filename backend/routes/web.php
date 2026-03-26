<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PaymentController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/subscription-expired', function (Illuminate\Http\Request $request) {
    return view('subscription-expired', ['domain' => $request->get('domain', $request->getHost())]);
});


// ── Payment Gateway Callbacks (Public, no /api prefix) ──────────────────────
Route::get('/payment/bkash/callback',      [PaymentController::class, 'bkashCallback']);
Route::get('/payment/nagad/callback',      [PaymentController::class, 'nagadCallback']);
Route::post('/payment/sslcommerz/ipn',     [PaymentController::class, 'sslIpn']);
Route::post('/payment/sslcommerz/success', [PaymentController::class, 'sslSuccess']);
Route::post('/payment/sslcommerz/fail',    [PaymentController::class, 'sslFail']);
Route::post('/payment/sslcommerz/cancel',  [PaymentController::class, 'sslCancel']);
