<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoadBalancer;
use App\Models\LoadBalancerDomain;
use App\Models\Domain;
use App\Models\DnsRecord;
use App\Models\Subscription;
use App\Models\PaymentTransaction;
use App\Models\SubscriptionPlan;
use App\Services\NginxConfigService;
use App\Services\DnsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class LoadBalancerController extends Controller
{
    public function __construct(
        protected NginxConfigService $nginxService,
        protected DnsService $dnsService
    ) {}

    public function index(): JsonResponse
    {
        $lbs = LoadBalancer::with(['apps:id,name', 'domains'])->orderBy('created_at', 'desc')->get();
        return response()->json($lbs);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:load_balancers,name',
            'method' => 'required|in:round_robin,least_conn,ip_hash,random',
            'app_ids' => 'nullable|array',
            'app_ids.*' => 'exists:apps,id',
            'domains' => 'nullable|array',
            'domains.*' => 'string'
        ]);

        $lb = LoadBalancer::create([
            'name' => $validated['name'],
            'method' => $validated['method'],
            'status' => 'pending'
        ]);

        if (!empty($validated['app_ids'])) {
            $lb->apps()->sync($validated['app_ids']);
        }

        if (!empty($validated['domains'])) {
            foreach ($validated['domains'] as $domain) {
                $lb->domains()->create(['domain' => $domain]);
                $this->dnsService->createManagedDomain($domain);
            }
        }

        // Explicitly load relations so the Nginx config generator sees the new apps and domains
        $lb->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($lb);

        $lb->update(['status' => 'active']);

        $loaded = $lb->load(['apps:id,name', 'domains']);
        return response()->json($loaded, 201);
    }

    public function show(LoadBalancer $loadBalancer): JsonResponse
    {
        $loaded = $loadBalancer->load(['apps:id,name', 'domains']);
        return response()->json($loaded);
    }

    public function update(Request $request, LoadBalancer $loadBalancer): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'string|unique:load_balancers,name,' . $loadBalancer->id,
            'method' => 'in:round_robin,least_conn,ip_hash,random',
            'app_ids' => 'nullable|array',
            'app_ids.*' => 'exists:apps,id',
            'domains' => 'nullable|array',
            'domains.*' => 'string'
        ]);

        $updatable = [];
        if (isset($validated['name'])) $updatable['name'] = $validated['name'];
        if (isset($validated['method'])) $updatable['method'] = $validated['method'];

        if (!empty($updatable)) {
            $updatable['status'] = 'pending';
            $loadBalancer->update($updatable);
        }

        // 1. Handle Upstream Changes (Apps or Method)
        if (isset($validated['app_ids']) || isset($validated['method'])) {
            if (isset($validated['app_ids'])) {
                $loadBalancer->apps()->sync($validated['app_ids']);
            }
            $loadBalancer->load(['apps']);
            $this->nginxService->generateLoadBalancerUpstream($loadBalancer);
        }

        // 2. Handle Domain Changes Differentially
        if (isset($validated['domains'])) {
            $existingDomains = $loadBalancer->domains->pluck('domain')->toArray();
            $newDomains = $validated['domains'];

            // Domains to delete
            $toDelete = array_diff($existingDomains, $newDomains);
            foreach ($toDelete as $domainName) {
                $this->nginxService->removeLoadBalancerDomain($domainName);
                $loadBalancer->domains()->where('domain', $domainName)->delete();
            }

            // Domains to add
            $toAdd = array_diff($newDomains, $existingDomains);
            foreach ($toAdd as $domainName) {
                $lbDomain = $loadBalancer->domains()->create(['domain' => $domainName]);
                $this->dnsService->createManagedDomain($domainName);
                $this->nginxService->generateLoadBalancerDomain($loadBalancer, $lbDomain);
            }
        }

        $loadBalancer->update(['status' => 'active']);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains']);
        return response()->json($loaded);
    }

    public function destroy(LoadBalancer $loadBalancer): JsonResponse
    {
        // Snapshot data for background job
        $lbData = $loadBalancer->toArray();
        $lbData['id'] = $loadBalancer->id;
        $lbData['domains'] = $loadBalancer->domains->pluck('domain')->toArray();

        \App\Jobs\DeleteLoadBalancer::dispatch($lbData);

        $loadBalancer->delete();

        return response()->json(['message' => 'Load balancer scheduled for deletion and cleanup']);
    }

    public function addDomain(Request $request, LoadBalancer $loadBalancer): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string',
        ]);

        $domain = $validated['domain'];
        if ($loadBalancer->domains()->where('domain', $domain)->exists()) {
            return response()->json(['message' => 'Domain already exists'], 422);
        }

        $lbDomain = $loadBalancer->domains()->create(['domain' => $domain]);
        $this->dnsService->createManagedDomain($domain);

        $loadBalancer->load(['apps']);
        $this->nginxService->generateLoadBalancerDomain($loadBalancer, $lbDomain);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains']);
        return response()->json($loaded);
    }

    public function removeDomain(Request $request, LoadBalancer $loadBalancer): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string',
        ]);

        $domain = $validated['domain'];
        $loadBalancer->domains()->where('domain', $domain)->delete();
        $this->nginxService->removeLoadBalancerDomain($domain);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains']);
        return response()->json($loaded);
    }

    public function attachApp(Request $request, LoadBalancer $loadBalancer): JsonResponse
    {
        $validated = $request->validate([
            'app_id' => 'required|exists:apps,id',
        ]);

        $appId = $validated['app_id'];
        if ($loadBalancer->apps()->where('app_id', $appId)->exists()) {
            return response()->json(['message' => 'App already attached'], 422);
        }

        $loadBalancer->apps()->attach($appId);

        $loadBalancer->load(['apps:id,name', 'domains']);
        return response()->json($loadBalancer);
    }

    public function detachApp(Request $request, LoadBalancer $loadBalancer, \App\Models\App $app): JsonResponse
    {
        if ($loadBalancer->apps()->count() <= 1) {
            return response()->json(['message' => 'At least one app is required'], 422);
        }

        $loadBalancer->apps()->detach($app->id);

        $loadBalancer->load(['apps']);
        $this->nginxService->generateLoadBalancerUpstream($loadBalancer);

        $loadBalancer->load(['apps:id,name', 'domains']);
        return response()->json($loadBalancer);
    }

    public function showDomain(LoadBalancerDomain $domain): JsonResponse
    {
        return response()->json($domain->load('loadBalancer'));
    }

    public function domainLogs(LoadBalancerDomain $domain, Request $request): JsonResponse
    {
        $type = $request->query('type', 'server-error');

        if ($type === 'server-access') {
            $logFile = "/var/log/nginx/{$domain->domain}-access.log";
            $output = file_exists($logFile)
                ? shell_exec("tail -n 200 " . escapeshellarg($logFile) . " 2>&1")
                : 'No server access logs found.';
            return response()->json(['logs' => $output ?: 'Log file is empty or unreadable.']);
        }

        // Default: server-error
        $logFile = "/var/log/nginx/{$domain->domain}-error.log";
        $output = file_exists($logFile)
            ? shell_exec("tail -n 200 " . escapeshellarg($logFile) . " 2>&1")
            : 'No server error logs found.';
        return response()->json(['logs' => $output ?: 'Log file is empty or unreadable.']);
    }

    public function subscriptions(LoadBalancerDomain $domain): JsonResponse
    {
        $domainName = $domain->domain;

        $subscriptions = Subscription::with('plan')
            ->where('domain', $domainName)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($sub) => [
                'id'             => $sub->id,
                'plan'           => $sub->plan,
                'status'         => $sub->status,
                'starts_at'      => $sub->starts_at,
                'ends_at'        => $sub->ends_at,
                'credit_balance' => $sub->credit_balance,
                'is_active'      => $sub->isActive(),
                'is_credit_type' => $sub->isCreditType(),
                'created_at'     => $sub->created_at,
            ]);

        $transactions = PaymentTransaction::with('plan')
            ->where('domain', $domainName)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(fn($tx) => [
                'id'             => $tx->id,
                'plan'           => $tx->plan,
                'amount'         => $tx->amount,
                'status'         => $tx->status,
                'gateway'        => $tx->gateway,
                'gateway_ref'    => $tx->gateway_ref,
                'created_at'     => $tx->created_at,
            ]);

        return response()->json([
            'domain' => $domainName,
            'subscriptions' => $subscriptions,
            'transactions' => $transactions,
            'status' => $domain->status
        ]);
    }

    public function activateSubscription(Request $request, LoadBalancerDomain $domain): JsonResponse
    {
        $validated = $request->validate([
            'plan_id'        => 'required|exists:subscription_plans,id',
            'custom_ends_at' => 'nullable|date',
        ]);

        $domainName = $domain->domain;
        $plan = SubscriptionPlan::findOrFail($validated['plan_id']);
        $subscriptionService = app(\App\Services\SubscriptionService::class);

        $subscription = $subscriptionService->activateManual($domainName, $plan, $validated['custom_ends_at'] ?? null);

        PaymentTransaction::create([
            'user_id'         => $request->user()?->id,
            'subscription_id' => $subscription->id,
            'plan_id'         => $plan->id,
            'domain'          => $domainName,
            'gateway'         => 'manual',
            'amount'          => 0,
            'currency'        => 'USD',
            'status'          => 'completed',
            'transaction_id'  => 'MANUAL_' . Str::random(10),
        ]);

        return response()->json(['message' => 'Subscription activated successfully.', 'subscription' => $subscription]);
    }

    public function toggleSuspend(LoadBalancerDomain $domain): JsonResponse
    {
        if ($domain->status === 'deactivated') {
            $domain->update(['status' => 'active']);
            return response()->json(['message' => 'Service reactivated.', 'status' => 'active']);
        } else {
            $domain->update(['status' => 'deactivated']);
            return response()->json(['message' => 'Service suspended.', 'status' => 'deactivated']);
        }
    }
}
