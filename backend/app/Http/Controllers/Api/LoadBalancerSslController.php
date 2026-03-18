<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoadBalancerDomain;
use App\Services\SslService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class LoadBalancerSslController extends Controller
{
    public function __construct(
        private SslService $sslService
    ) {}

    /**
     * Setup SSL for a specific load balancer domain.
     */
    public function setup(LoadBalancerDomain $domain): JsonResponse
    {
        $result = $this->sslService->setupSsl($domain);

        return response()->json(array_merge($result, [
            'domain' => $domain->fresh()
        ]), $result['success'] ? 200 : 500);
    }

    /**
     * Remove SSL for a specific load balancer domain.
     */
    public function remove(LoadBalancerDomain $domain): JsonResponse
    {
        $result = $this->sslService->removeSsl($domain);

        return response()->json(array_merge($result, [
            'domain' => $domain->fresh()
        ]));
    }

    /**
     * Get SSL certificate details for a specific load balancer domain.
     */
    public function details(LoadBalancerDomain $domain): JsonResponse
    {
        $details = $this->sslService->getCertificateDetails($domain);
        return response()->json($details);
    }

    /**
     * Toggle Force HTTPS for a specific load balancer domain.
     */
    public function toggleForceHttps(LoadBalancerDomain $domain): JsonResponse
    {
        if (!$domain->ssl_enabled || $domain->ssl_status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'SSL must be active before toggling Force HTTPS.',
            ], 422);
        }

        $enable = !$domain->force_https;
        $result = $this->sslService->toggleForceHttps($domain, $enable);

        return response()->json(array_merge($result, [
            'domain' => $domain->fresh(),
        ]), $result['success'] ? 200 : 500);
    }
}
