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
        $lbs = LoadBalancer::with(['apps:id,name', 'domains:id,load_balancer_id,domain'])->orderBy('created_at', 'desc')->get();
        $lbs->transform(function ($lb) {
            $lbArray = $lb->toArray();
            $lbArray['domains'] = $lb->domains->pluck('domain')->toArray();
            return $lbArray;
        });
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
            }
            $this->processDomainsDNS($validated['domains']);
        }

        // Explicitly load relations so the Nginx config generator sees the new apps and domains
        $lb->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($lb);

        $lb->update(['status' => 'active']);

        $loaded = $lb->load(['apps:id,name', 'domains:id,load_balancer_id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();

        return response()->json($resp, 201);
    }

    public function show(LoadBalancer $loadBalancer): JsonResponse
    {
        $loaded = $loadBalancer->load(['apps:id,name', 'domains:id,load_balancer_id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();
        return response()->json($resp);
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
            }
            $this->processDomainsDNS($validated['domains']);
        }

        // Explicitly load relations so the Nginx config generator sees the updated apps and domains
        $loadBalancer->load(['apps', 'domains']);
        $this->nginxService->generateLoadBalancer($loadBalancer);
        $loadBalancer->update(['status' => 'active']);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains:id,load_balancer_id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();
        return response()->json($resp);
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
        $this->processDomainsDNS([$domain]);

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

    private function processDomainsDNS(array $domains): void
    {
        $serverIp = trim(shell_exec("hostname -I 2>/dev/null | awk '{print $1}'") ?? '');
        if (empty($serverIp) || $serverIp === '127.0.0.1') {
            $serverIp = request()->server('SERVER_ADDR') ?? '127.0.0.1';
        }

        foreach ($domains as $domainName) {
            // 1. Check if the domain itself is already a managed zone
            $managedDomain = Domain::where('domain', $domainName)->where('dns_managed', true)->first();

            if ($managedDomain) {
                if (!DnsRecord::where('domain_id', $managedDomain->id)->where('type', 'A')->where('name', '@')->exists()) {
                    DnsRecord::create([
                        'domain_id' => $managedDomain->id,
                        'type' => 'A',
                        'name' => '@',
                        'value' => $serverIp,
                        'ttl' => 3600
                    ]);
                    $this->dnsService->syncRecords($managedDomain);
                }
                continue;
            }

            // 2. Traversal for subdomains (e.g. lb1.test or lb1.mysite.com)
            $parts = explode('.', $domainName);
            if (count($parts) < 2) continue;

            $foundParent = false;
            // Loop from the most specific parent to the least (e.g. sub.myapp.com -> check myapp.com then com)
            for ($i = 1; $i < count($parts); $i++) {
                $subdomainParts = array_slice($parts, 0, $i);
                $parentParts = array_slice($parts, $i);

                $subdomain = implode('.', $subdomainParts);
                $parentDomainName = implode('.', $parentParts);

                $parentDomain = Domain::where('domain', $parentDomainName)
                    ->where('dns_managed', true)
                    ->first();

                if ($parentDomain) {
                    $exists = DnsRecord::where('domain_id', $parentDomain->id)
                        ->where('type', 'A')
                        ->where('name', $subdomain)
                        ->exists();

                    if (!$exists) {
                        DnsRecord::create([
                            'domain_id' => $parentDomain->id,
                            'type' => 'A',
                            'name' => $subdomain,
                            'value' => $serverIp,
                            'ttl' => 3600
                        ]);
                        $this->dnsService->syncRecords($parentDomain);
                    }
                    $foundParent = true;
                    break; // Stop climbing once we found the zone
                }
            }

            // 3. Consistency: If NOT a subdomain of an existing zone, create a NEW managed domain record
            if (!$foundParent) {
                $this->dnsService->createManagedDomain($domainName);
            }
        }
    }
}
