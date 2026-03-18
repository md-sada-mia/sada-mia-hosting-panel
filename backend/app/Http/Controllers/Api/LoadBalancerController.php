<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoadBalancer;
use App\Models\Domain;
use App\Models\DnsRecord;
use App\Services\NginxConfigService;
use App\Services\DnsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

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

        if (isset($validated['app_ids'])) {
            $loadBalancer->apps()->sync($validated['app_ids']);
        }

        if (isset($validated['domains'])) {
            $loadBalancer->domains()->delete();
            foreach ($validated['domains'] as $domain) {
                $loadBalancer->domains()->create(['domain' => $domain]);
                $this->dnsService->createManagedDomain($domain);
            }
        }

        // Explicitly load relations so the Nginx config generator sees the updated apps and domains
        $loadBalancer->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($loadBalancer);
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

        $loadBalancer->domains()->create(['domain' => $domain]);
        $this->dnsService->createManagedDomain($domain);

        $loadBalancer->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($loadBalancer);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains:id,load_balancer_id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();

        return response()->json($resp);
    }

    public function removeDomain(Request $request, LoadBalancer $loadBalancer): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string',
        ]);

        $domain = $validated['domain'];
        $loadBalancer->domains()->where('domain', $domain)->delete();

        $loadBalancer->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($loadBalancer);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains:id,load_balancer_id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();

        return response()->json($resp);
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

        $loadBalancer->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($loadBalancer);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains:id,load_balancer_id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();

        return response()->json($resp);
    }

    public function detachApp(Request $request, LoadBalancer $loadBalancer, \App\Models\App $app): JsonResponse
    {
        if ($loadBalancer->apps()->count() <= 1) {
            return response()->json(['message' => 'At least one app is required'], 422);
        }

        $loadBalancer->apps()->detach($app->id);

        $loadBalancer->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($loadBalancer);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains:id,load_balancer_id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();

        return response()->json($resp);
    }
}
