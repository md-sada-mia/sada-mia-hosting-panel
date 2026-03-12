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
            'method' => 'required|in:round_robin,least_conn,ip_hash',
            'app_ids' => 'required|array|min:1',
            'app_ids.*' => 'exists:apps,id',
            'domains' => 'required|array|min:1',
            'domains.*' => 'string'
        ]);

        $lb = LoadBalancer::create([
            'name' => $validated['name'],
            'method' => $validated['method'],
            'status' => 'pending'
        ]);

        $lb->apps()->sync($validated['app_ids']);

        foreach ($validated['domains'] as $domain) {
            $lb->domains()->create(['domain' => $domain]);
        }

        $this->processDomainsDNS($validated['domains']);

        $this->nginxService->generateLoadBalancer($lb);

        $lb->update(['status' => 'active']);

        $loaded = $lb->load(['apps:id,name', 'domains:id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();

        return response()->json($resp, 201);
    }

    public function show(LoadBalancer $loadBalancer): JsonResponse
    {
        $loaded = $loadBalancer->load(['apps:id,name', 'domains:id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();
        return response()->json($resp);
    }

    public function update(Request $request, LoadBalancer $loadBalancer): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'string|unique:load_balancers,name,' . $loadBalancer->id,
            'method' => 'in:round_robin,least_conn,ip_hash',
            'app_ids' => 'array|min:1',
            'app_ids.*' => 'exists:apps,id',
            'domains' => 'array|min:1',
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

        $this->nginxService->generateLoadBalancer($loadBalancer);
        $loadBalancer->update(['status' => 'active']);

        $loaded = $loadBalancer->fresh()->load(['apps:id,name', 'domains:id,domain']);
        $resp = $loaded->toArray();
        $resp['domains'] = $loaded->domains->pluck('domain')->toArray();
        return response()->json($resp);
    }

    public function destroy(LoadBalancer $loadBalancer): JsonResponse
    {
        $this->nginxService->removeLoadBalancer($loadBalancer);
        $loadBalancer->delete();

        return response()->json(['message' => 'Load balancer deleted']);
    }

    private function processDomainsDNS(array $domains): void
    {
        $serverIp = trim(shell_exec("hostname -I 2>/dev/null | awk '{print $1}'") ?? '');
        if (empty($serverIp)) {
            $serverIp = '127.0.0.1';
        }

        foreach ($domains as $domainName) {
            // Auto create A record if subdomain of existing parent domain
            $parts = explode('.', $domainName);
            if (count($parts) > 2) {
                // Determine base domain by looping from most specific to least specific parent domain.
                for ($i = 0; $i < count($parts) - 2; $i++) {
                    $subdomainParts = array_slice($parts, 0, $i + 1);
                    $parentParts = array_slice($parts, $i + 1);

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
                        break; // Stop climbing up once we found the parent zone
                    }
                }
            }
        }
    }
}
