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
use App\Http\Controllers\Api\DomainController;
use App\Http\Controllers\Api\DnsRecordController;
use App\Http\Controllers\Api\EmailController;
use App\Http\Controllers\Api\FileManagerController;
use App\Http\Controllers\Api\TerminalController;
use App\Http\Controllers\Api\CustomerController;
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
    Route::post('/databases/{database}/password', [DatabaseController::class, 'updatePassword']);
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

    // CRM Customers
    Route::apiResource('customers', CustomerController::class);
    Route::post('/customers/{customer}/deploy', [CustomerController::class, 'deploy']);
    Route::put('/customers/{customer}/domain', [CustomerController::class, 'updateDomain']);

    // Load Balancers
    Route::apiResource('load-balancers', \App\Http\Controllers\Api\LoadBalancerController::class);
    Route::post('/load-balancers/{loadBalancer}/domains', [\App\Http\Controllers\Api\LoadBalancerController::class, 'addDomain']);
    Route::delete('/load-balancers/{loadBalancer}/domains', [\App\Http\Controllers\Api\LoadBalancerController::class, 'removeDomain']);
    Route::post('/load-balancers/{loadBalancer}/apps', [\App\Http\Controllers\Api\LoadBalancerController::class, 'attachApp']);
    Route::delete('/load-balancers/{loadBalancer}/apps/{app}', [\App\Http\Controllers\Api\LoadBalancerController::class, 'detachApp']);

    // Cron Jobs
    Route::get('/cron-jobs', [CronJobController::class, 'index']);
    Route::post('/cron-jobs', [CronJobController::class, 'store']);
    Route::put('/cron-jobs/{cronJob}', [CronJobController::class, 'update']);
    Route::delete('/cron-jobs/{cronJob}', [CronJobController::class, 'destroy']);
    Route::post('/cron-jobs/{cronJob}/toggle', [CronJobController::class, 'toggle']);

    // DNS Domains
    Route::get('/domains/find-parent', [DomainController::class, 'findParent']);
    Route::get('/domains', [DomainController::class, 'index']);
    Route::post('/domains', [DomainController::class, 'store']);
    Route::get('/domains/{domain}', [DomainController::class, 'show']);
    Route::put('/domains/{domain}', [DomainController::class, 'update']);
    Route::delete('/domains/{domain}', [DomainController::class, 'destroy']);

    // DNS Records (nested under domain)
    Route::get('/domains/{domain}/records', [DnsRecordController::class, 'index']);
    Route::post('/domains/{domain}/records', [DnsRecordController::class, 'store']);
    Route::put('/domains/{domain}/records/{record}', [DnsRecordController::class, 'update']);
    Route::delete('/domains/{domain}/records/{record}', [DnsRecordController::class, 'destroy']);

    // App-level DNS management (shortcut via app)
    Route::get('/apps/{app}/domain', function (\App\Models\App $app) {
        return response()->json($app->domainRecord?->load('dnsRecords'));
    });
    Route::post('/apps/{app}/domain/records', function (\App\Models\App $app, \Illuminate\Http\Request $request) {
        $domain = $app->domainRecord;
        if (!$domain) return response()->json(['message' => 'No domain linked to this app'], 404);
        $validated = $request->validate([
            'type' => 'required|in:A,AAAA,CNAME,MX,TXT,NS,SRV,CAA',
            'name' => 'required|string|max:255',
            'value' => 'required|string',
            'ttl' => 'nullable|integer|min:60',
            'priority' => 'nullable|integer',
        ]);
        $record = $domain->dnsRecords()->create($validated);
        app(\App\Services\DnsService::class)->syncRecords($domain->fresh()->load('dnsRecords'));
        return response()->json($record, 201);
    });
    Route::delete('/apps/{app}/domain/records/{record}', function (\App\Models\App $app, \App\Models\DnsRecord $record) {
        $domain = $app->domainRecord;
        if (!$domain || $record->domain_id !== $domain->id) abort(404);
        $record->delete();
        app(\App\Services\DnsService::class)->syncRecords($domain->fresh()->load('dnsRecords'));
        return response()->json(['message' => 'Deleted']);
    });
    Route::post('/apps/{app}/domain/sync', function (\App\Models\App $app) {
        $domain = $app->domainRecord;
        if (!$domain) return response()->json(['message' => 'No domain'], 404);
        app(\App\Services\DnsService::class)->generateZone($domain->fresh()->load('dnsRecords'));
        return response()->json(['message' => 'DNS zone synced']);
    });

    // Backfill default DNS records for existing domains
    Route::post('/apps/{app}/domain/setup-defaults', function (\App\Models\App $app) {
        $domain = $app->domainRecord;
        if (!$domain) return response()->json(['message' => 'No domain linked'], 404);
        $dnsService = app(\App\Services\DnsService::class);
        $dnsService->createDefaultRecords($domain);
        $dnsService->generateZone($domain->fresh()->load('dnsRecords'));
        return response()->json($domain->fresh()->load('dnsRecords'));
    });

    // Email Management
    Route::get('/email/domains', [EmailController::class, 'indexDomains']);
    Route::post('/email/domains', [EmailController::class, 'storeDomain']);
    Route::delete('/email/domains/{emailDomain}', [EmailController::class, 'destroyDomain']);

    Route::get('/email/domains/{emailDomain}/accounts', [EmailController::class, 'indexAccounts']);
    Route::post('/email/domains/{emailDomain}/accounts', [EmailController::class, 'storeAccount']);
    Route::put('/email/domains/{emailDomain}/accounts/{account}', [EmailController::class, 'updateAccount']);
    Route::delete('/email/domains/{emailDomain}/accounts/{account}', [EmailController::class, 'destroyAccount']);

    Route::get('/email/domains/{emailDomain}/aliases', [EmailController::class, 'indexAliases']);
    Route::post('/email/domains/{emailDomain}/aliases', [EmailController::class, 'storeAlias']);
    Route::delete('/email/domains/{emailDomain}/aliases/{alias}', [EmailController::class, 'destroyAlias']);

    // File Manager
    Route::get('/files', [FileManagerController::class, 'index']);
    Route::get('/files/content', [FileManagerController::class, 'show']);
    Route::get('/files/download', [FileManagerController::class, 'download']);
    Route::get('/files/search', [FileManagerController::class, 'search']);
    Route::post('/files', [FileManagerController::class, 'store']);
    Route::put('/files', [FileManagerController::class, 'update']);
    Route::delete('/files', [FileManagerController::class, 'destroy']);
    Route::post('/files/rename', [FileManagerController::class, 'rename']);
    Route::post('/files/copy', [FileManagerController::class, 'copy']);
    Route::post('/files/upload', [FileManagerController::class, 'upload']);
    Route::post('/files/chmod', [FileManagerController::class, 'chmod']);
    Route::post('/files/compress', [FileManagerController::class, 'compress']);
    Route::post('/files/extract', [FileManagerController::class, 'extract']);

    // Terminal Access
    Route::get('/terminal/info', [TerminalController::class, 'info']);
    Route::get('/terminal/autocomplete', [TerminalController::class, 'autocomplete']);
    Route::post('/terminal/execute', [TerminalController::class, 'execute']);
});


// GitHub Webhook (Public)
Route::post('/github/webhook', [GitHubWebhookController::class, 'handle']);
