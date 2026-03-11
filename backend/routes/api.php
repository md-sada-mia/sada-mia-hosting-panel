<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AppController;
use App\Http\Controllers\Api\EnvController;
use App\Http\Controllers\Api\DatabaseController;
use App\Http\Controllers\Api\ServerController;
use App\Http\Controllers\Api\GitHubAuthController;
use App\Http\Controllers\Api\GitHubWebhookController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\CronJobController;
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
    Route::post('/apps/{app}/toggle-auto-deploy', [AppController::class, 'toggleAutoDeploy']);

    // Environment variables
    Route::get('/apps/{app}/env', [EnvController::class, 'index']);
    Route::put('/apps/{app}/env', [EnvController::class, 'update']);

    // Databases
    Route::get('/databases', [DatabaseController::class, 'index']);
    Route::get('/databases/{database}/credentials', [DatabaseController::class, 'credentials']);
    Route::post('/databases', [DatabaseController::class, 'store']);
    Route::delete('/databases/{database}', [DatabaseController::class, 'destroy']);

    // Server stats
    Route::get('/server/stats', [ServerController::class, 'stats']);
    Route::post('/server/restart', [ServerController::class, 'restart']);

    // GitHub OAuth
    Route::get('/github/redirect', [GitHubAuthController::class, 'redirect']);
    Route::get('/github/callback', [GitHubAuthController::class, 'callback']);
    Route::get('/github/repositories', [GitHubAuthController::class, 'repositories']);

    // Settings
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::post('/settings', [SettingsController::class, 'update']);

    // Cron Jobs
    Route::get('/cron-jobs', [CronJobController::class, 'index']);
    Route::post('/cron-jobs', [CronJobController::class, 'store']);
    Route::put('/cron-jobs/{cronJob}', [CronJobController::class, 'update']);
    Route::delete('/cron-jobs/{cronJob}', [CronJobController::class, 'destroy']);
    Route::post('/cron-jobs/{cronJob}/toggle', [CronJobController::class, 'toggle']);
});

// GitHub Webhook (Public)
Route::post('/github/webhook', [GitHubWebhookController::class, 'handle']);
