<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Services\DnsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class DomainController extends Controller
{
    public function __construct(protected DnsService $dnsService) {}

    /**
     * GET /domains
     */
    public function index(): JsonResponse
    {
        $domains = Domain::with(['app:id,name', 'dnsRecords', 'emailDomain'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($domains);
    }

    /**
     * POST /domains
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain'       => 'required|string|unique:domains,domain',
            'app_id'       => 'nullable|exists:apps,id',
            'nameserver_1' => 'nullable|string|max:255',
            'nameserver_2' => 'nullable|string|max:255',
            'nameserver_3' => 'nullable|string|max:255',
            'nameserver_4' => 'nullable|string|max:255',
            'dns_managed'  => 'boolean',
            'notes'        => 'nullable|string',
        ]);

        $domain = Domain::create(array_merge($validated, ['status' => 'pending']));

        if ($domain->dns_managed) {
            try {
                $this->dnsService->generateZone($domain->fresh());
            } catch (\Throwable $e) {
                \Log::error("DNS zone generation failed for {$domain->domain}: " . $e->getMessage());
            }
        }

        return response()->json($domain->load(['app:id,name', 'dnsRecords']), 201);
    }

    /**
     * GET /domains/{domain}
     */
    public function show(Domain $domain): JsonResponse
    {
        return response()->json(
            $domain->load(['app:id,name', 'dnsRecords', 'emailDomain.accounts', 'emailDomain.aliases'])
        );
    }

    /**
     * PUT /domains/{domain}
     */
    public function update(Request $request, Domain $domain): JsonResponse
    {
        $validated = $request->validate([
            'nameserver_1' => 'nullable|string|max:255',
            'nameserver_2' => 'nullable|string|max:255',
            'nameserver_3' => 'nullable|string|max:255',
            'nameserver_4' => 'nullable|string|max:255',
            'status'       => 'nullable|in:active,pending,inactive',
            'dns_managed'  => 'boolean',
            'app_id'       => 'nullable|exists:apps,id',
            'notes'        => 'nullable|string',
        ]);

        $wasManagedBefore = $domain->dns_managed;
        $domain->update($validated);

        if ($domain->dns_managed && !$wasManagedBefore) {
            // Newly enabled DNS management
            $this->dnsService->generateZone($domain->fresh());
        } elseif (!$domain->dns_managed && $wasManagedBefore) {
            // Disabled DNS management
            $this->dnsService->removeZone($domain);
        }

        return response()->json($domain->fresh()->load(['app:id,name', 'dnsRecords']));
    }

    /**
     * DELETE /domains/{domain}
     */
    public function destroy(Domain $domain): JsonResponse
    {
        if ($domain->dns_managed) {
            try {
                $this->dnsService->removeZone($domain);
            } catch (\Throwable $e) {
                \Log::warning("Could not remove DNS zone for {$domain->domain}: " . $e->getMessage());
            }
        }

        $domain->delete();

        return response()->json(['message' => 'Domain deleted.']);
    }
}
