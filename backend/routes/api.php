<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AppController;
use App\Http\Controllers\Api\EnvController;
use App\Http\Controllers\Api\DatabaseController;
use App\Http\Controllers\Api\ServerController;
use Illuminate\Support\Facades\Route;

// ── Auth (public) ─────────────────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login']);

// ── Protected routes ─────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // Apps
    Route::get('/apps', [AppController::class, 'index']);
    Route::post('/apps', [AppController::class, 'store']);
    Route::get('/apps/{app}', [AppController::class, 'show']);
    Route::delete('/apps/{app}', [AppController::class, 'destroy']);
    Route::post('/apps/{app}/deploy', [AppController::class, 'deploy']);
    Route::post('/apps/{app}/start', [AppController::class, 'start']);
    Route::post('/apps/{app}/stop', [AppController::class, 'stop']);
    Route::post('/apps/{app}/restart', [AppController::class, 'restart']);
    Route::get('/apps/{app}/logs', [AppController::class, 'logs']);
    Route::get('/apps/{app}/deployments', [AppController::class, 'deployments']);

    // Environment variables
    Route::get('/apps/{app}/env', [EnvController::class, 'index']);
    Route::put('/apps/{app}/env', [EnvController::class, 'update']);

    // Databases
    Route::get('/databases', [DatabaseController::class, 'index']);
    Route::post('/databases', [DatabaseController::class, 'store']);
    Route::delete('/databases/{database}', [DatabaseController::class, 'destroy']);

    // Server stats
    Route::get('/server/stats', [ServerController::class, 'stats']);
});
