<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Models\DnsRecord;
use App\Services\DnsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DnsRecordController extends Controller
{
    public function __construct(protected DnsService $dnsService) {}

    /**
     * GET /domains/{domain}/records
     */
    public function index(Domain $domain): JsonResponse
    {
        return response()->json($domain->dnsRecords()->orderBy('type')->orderBy('name')->get());
    }

    /**
     * POST /domains/{domain}/records
     */
    public function store(Request $request, Domain $domain): JsonResponse
    {
        $validated = $request->validate([
            'type'     => 'required|in:A,AAAA,CNAME,MX,TXT,NS,SRV,PTR,CAA',
            'name'     => 'required|string|max:255',
            'value'    => 'required|string',
            'ttl'      => 'integer|min:60|max:86400',
            'priority' => 'nullable|integer|min:0|max:65535',
        ]);

        $record = $domain->dnsRecords()->create($validated);

        $this->dnsService->syncRecords($domain);

        return response()->json($record, 201);
    }

    /**
     * PUT /domains/{domain}/records/{record}
     */
    public function update(Request $request, Domain $domain, DnsRecord $record): JsonResponse
    {
        $this->authorize($domain, $record);

        $validated = $request->validate([
            'type'     => 'in:A,AAAA,CNAME,MX,TXT,NS,SRV,PTR,CAA',
            'name'     => 'string|max:255',
            'value'    => 'string',
            'ttl'      => 'integer|min:60|max:86400',
            'priority' => 'nullable|integer|min:0|max:65535',
        ]);

        $record->update($validated);
        $this->dnsService->syncRecords($domain);

        return response()->json($record->fresh());
    }

    /**
     * DELETE /domains/{domain}/records/{record}
     */
    public function destroy(Domain $domain, DnsRecord $record): JsonResponse
    {
        $this->authorize($domain, $record);

        $record->delete();
        $this->dnsService->syncRecords($domain);

        return response()->json(['message' => 'Record deleted.']);
    }

    private function authorize(Domain $domain, DnsRecord $record): void
    {
        abort_if($record->domain_id !== $domain->id, 403, 'Record does not belong to this domain.');
    }
}
