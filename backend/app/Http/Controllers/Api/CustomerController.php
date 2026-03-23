<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerDeployment;
use App\Models\App as AppModel;
use App\Models\LoadBalancer;
use App\Models\Setting;
use App\Models\Domain;
use App\Models\CrmApiLog;
use App\Services\DeploymentService;
use App\Services\DatabaseService;
use App\Services\DnsService;
use App\Services\GitHubService;
use App\Services\NginxConfigService;
use App\Services\CrmApiService;
use App\Services\SslService;
use App\Jobs\DeployApp;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
    public function __construct(
        private DeploymentService $deploymentService,
        private DatabaseService $dbService,
        private DnsService $dnsService,
        private GitHubService $github,
        private NginxConfigService $nginxService,
        private CrmApiService $crmApiService,
        private SslService $sslService,
    ) {}

    public function index()
    {
        $customers = Customer::orderBy('created_at', 'desc')->get();

        return response()->json($customers->map(function ($customer) {
            $data = $customer->toArray();
            $data['resource'] = $this->resolveResource($customer);
            return $data;
        }));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'          => 'required|string|max:255',
            'business_name' => 'nullable|string|max:255',
            'email'         => 'nullable|email|max:255',
            'phone'         => 'nullable|string|max:50',
            'address'       => 'nullable|string',
            'notes'         => 'nullable|string',
            'status'        => 'nullable|in:lead,active,inactive',
        ]);

        $customer = Customer::create($validated);
        $data = $customer->toArray();
        $data['resource'] = null;

        return response()->json($data, 201);
    }

    public function show(Customer $customer)
    {
        $data = $customer->toArray();
        $data['resource'] = $this->resolveResource($customer);
        return response()->json($data);
    }

    public function update(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'name'          => 'sometimes|required|string|max:255',
            'business_name' => 'nullable|string|max:255',
            'email'         => 'nullable|email|max:255',
            'phone'         => 'nullable|string|max:50',
            'address'       => 'nullable|string',
            'notes'         => 'nullable|string',
            'status'        => 'nullable|in:lead,active,inactive',
        ]);

        $customer->update($validated);
        $data = $customer->toArray();
        $data['resource'] = $this->resolveResource($customer);

        return response()->json($data);
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();
        return response()->json(['message' => 'Customer deleted']);
    }

    /**
     * Deploy a hosting resource (App or Load Balancer) for this customer.
     */
    public function deploy(Request $request, Customer $customer)
    {
        $crmType = Setting::get('crm_creation_type', 'load_balancer');

        if ($crmType === 'load_balancer') {
            return $this->deployLoadBalancer($request, $customer);
        }

        return $this->deployApp($request, $customer);
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private function deployLoadBalancer(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'load_balancer_id' => 'nullable|exists:load_balancers,id',
            'domain'           => 'required|string',
            // If creating a new LB:
            'lb_name'          => 'nullable|string',
            'lb_method'        => 'nullable|in:round_robin,least_conn,ip_hash,random',
            'domain_mode'      => 'nullable|string', // Support for tracking subdomain vs custom
        ]);

        if (!empty($validated['load_balancer_id'])) {
            // Link existing load balancer + attach domain
            $lb = LoadBalancer::findOrFail($validated['load_balancer_id']);

            if (!$lb->domains()->where('domain', $validated['domain'])->exists()) {
                $lbDomain = $lb->domains()->create([
                    'domain' => $validated['domain'],
                    'ssl_enabled' => true,
                    'force_https' => true,
                ]);

                $lb->load(['apps', 'domains']);
                $this->nginxService->generateLoadBalancer($lb);

                // Attempt SSL setup immediately for the newly attached domain
                $this->sslService->setupSsl($lbDomain);
            }
        } else {
            // Create new load balancer
            $lbName = $validated['lb_name'] ?? Str::slug($customer->business_name ?: $customer->name) . '-lb';
            $lb = LoadBalancer::create([
                'name'   => $lbName,
                'method' => $validated['lb_method'] ?? 'round_robin',
                'status' => 'pending',
            ]);
            $lbDomain = $lb->domains()->create([
                'domain' => $validated['domain'],
                'ssl_enabled' => true,
                'force_https' => true,
            ]);
            $lb->load(['apps', 'domains']);
            $this->nginxService->generateLoadBalancer($lb);

            // Attempt SSL setup immediately for Load Balancer domains
            $this->sslService->setupSsl($lbDomain);

            $lb->update(['status' => 'active']);
        }

        // Register DNS record (new/managed or subdomain under parent)
        $this->dnsService->createManagedDomain($validated['domain']);

        $customer->update([
            'resource_type' => 'load_balancer',
            'resource_id'   => $lb->id,
            'status'        => 'active',
        ]);

        // Save historical deployment record
        CustomerDeployment::create([
            'customer_id'      => $customer->id,
            'resource_type'    => 'load_balancer',
            'load_balancer_id' => $lb->id,
            'domain_mode'      => $validated['domain_mode'] ?? null,
            'domain'           => $validated['domain'],
        ]);

        // Trigger CRM API Call
        $this->crmApiService->execute($customer);

        $data = $customer->fresh()->toArray();
        $data['resource'] = $this->resolveResource($customer->fresh());

        return response()->json($data);
    }

    private function deployApp(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'app_id'           => 'nullable|exists:apps,id',  // existing app
            // New app fields:
            'type'             => 'nullable|in:nextjs,laravel,static',
            'domain'           => 'nullable|string',
            'git_url'          => 'nullable|string',
            'branch'           => 'nullable|string',
            'github_full_name' => 'nullable|string',
            'github_id'        => 'nullable|integer',
            'auto_deploy'      => 'nullable|boolean',
            'env_vars'         => 'nullable|string',
            'auto_db_create'   => 'nullable|boolean',
            'domain_mode'      => 'nullable|string',
        ]);

        $dbInfo = [];

        if (!empty($validated['app_id'])) {
            // Link existing app
            $app = AppModel::findOrFail($validated['app_id']);
        } else {
            // Create new app — name derived from customer name
            $baseName = Str::slug($customer->business_name ?: $customer->name);
            $appName  = $baseName;
            $counter  = 1;
            while (AppModel::where('name', $appName)->exists()) {
                $appName = $baseName . '-' . $counter++;
            }

            $webhookSecret = null;
            if (!empty($validated['auto_deploy']) && !empty($validated['github_full_name'])) {
                $webhookSecret = Str::random(32);
            }

            $app = AppModel::create([
                'name'             => $appName,
                'type'             => $validated['type'] ?? 'nextjs',
                'domain'           => $validated['domain'] ?? '',
                'git_url'          => $validated['git_url'] ?? '',
                'branch'           => $validated['branch'] ?? 'main',
                'status'           => 'idle',
                'github_full_name' => $validated['github_full_name'] ?? null,
                'github_id'        => $validated['github_id'] ?? null,
                'webhook_secret'   => $webhookSecret,
                'auto_deploy'      => $validated['auto_deploy'] ?? false,
                'ssl_enabled'      => true,
                'force_https'      => true,
            ]);

            // Parse bulk env vars
            if (!empty($validated['env_vars'])) {
                foreach (explode("\n", $validated['env_vars']) as $line) {
                    if (trim($line) && str_contains($line, '=')) {
                        [$key, $value] = explode('=', $line, 2);
                        $app->envVariables()->create(['key' => trim($key), 'value' => trim($value)]);
                    }
                }
            }

            // Auto DB for Laravel
            if ($app->type === 'laravel' && !empty($validated['auto_db_create'])) {
                try {
                    $db = $this->dbService->createForApp($app);
                    $envs = [
                        'DB_CONNECTION' => 'pgsql',
                        'DB_HOST' => '127.0.0.1',
                        'DB_PORT' => '5432',
                        'DB_DATABASE'   => $db->db_name,
                        'DB_USERNAME' => $db->db_user,
                        'DB_PASSWORD' => $db->db_password,
                    ];
                    foreach ($envs as $k => $v) {
                        $app->envVariables()->updateOrCreate(['key' => $k], ['value' => $v]);
                    }
                    $dbInfo = [
                        'db_name' => $db->db_name,
                        'db_user' => $db->db_user,
                        'db_password' => $db->db_password,
                    ];
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error("CRM Auto DB failed for app {$app->id}: " . $e->getMessage());
                }
            }

            // GitHub webhook
            if ($app->webhook_secret && $app->github_full_name) {
                $token = Setting::get('github_access_token');
                if ($token) {
                    $this->github->createWebhook($token, $app->github_full_name, $app->webhook_secret);
                }
            }

            // Auto create DNS
            if ($app->domain) {
                $this->dnsService->createManagedDomain($app->domain, $app->id);
            }

            // Trigger deployment
            if ($app->git_url) {
                $app->update(['status' => 'deploying']);
                $deployment = $this->deploymentService->createDeploymentRecord($app);
                DeployApp::dispatch($app, $deployment);
            }
        }

        $customer->update([
            'resource_type' => 'app',
            'resource_id'   => $app->id,
            'status'        => 'active',
        ]);

        // Save historical deployment record
        CustomerDeployment::create(array_merge([
            'customer_id'      => $customer->id,
            'resource_type'    => 'app',
            'app_id'           => $app->id,
            'domain_mode'      => $validated['domain_mode'] ?? null,
            'domain'           => $validated['domain'] ?? null,
            'app_type'         => $validated['type'] ?? 'nextjs',
            'existing_app'     => !empty($validated['app_id']),
            'git_url'          => $validated['git_url'] ?? null,
            'branch'           => $validated['branch'] ?? 'main',
            'github_full_name' => $validated['github_full_name'] ?? null,
            'github_id'        => $validated['github_id'] ?? null,
            'auto_deploy'      => $validated['auto_deploy'] ?? false,
            'env_vars'         => $validated['env_vars'] ?? null,
            'auto_db_create'   => $validated['auto_db_create'] ?? false,
        ], $dbInfo));

        // Trigger CRM API Call
        $this->crmApiService->execute($customer);

        $data = $customer->fresh()->toArray();
        $data['resource'] = $this->resolveResource($customer->fresh());

        return response()->json($data);
    }

    private function resolveResource(Customer $customer): ?array
    {
        if (!$customer->resource_type || !$customer->resource_id) {
            return null;
        }
        if ($customer->resource_type === 'app') {
            $app = AppModel::find($customer->resource_id);
            if (!$app) return null;

            $lastApiLog = CrmApiLog::where('customer_id', $customer->id)->latest()->first();
            $apiStatus = $lastApiLog ? [
                'status_code' => $lastApiLog->status_code,
                'response'    => $lastApiLog->response,
                'method'      => $lastApiLog->method,
                'url'         => $lastApiLog->url,
                'updated_at'  => $lastApiLog->updated_at,
            ] : null;

            return [
                'type' => 'app',
                'id' => $app->id,
                'name' => $app->name,
                'domain' => $app->domain,
                'status' => $app->status,
                'deployment_info' => $customer->deployment,
                'api_status' => $apiStatus
            ];
        }

        if ($customer->resource_type === 'load_balancer') {
            $lb = LoadBalancer::with('domains')->find($customer->resource_id);
            if (!$lb) return null;

            $lastApiLog = CrmApiLog::where('customer_id', $customer->id)->latest()->first();
            $apiStatus = $lastApiLog ? [
                'status_code' => $lastApiLog->status_code,
                'response'    => $lastApiLog->response,
                'method'      => $lastApiLog->method,
                'url'         => $lastApiLog->url,
                'updated_at'  => $lastApiLog->updated_at,
            ] : null;

            return [
                'type' => 'load_balancer',
                'id' => $lb->id,
                'name' => $lb->name,
                'domains' => $lb->domains,
                'status' => $lb->status,
                'deployment_info' => $customer->deployment,
                'api_status' => $apiStatus
            ];
        }

        return null;
    }

    public function updateDomain(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'domain' => 'required|string',
        ]);

        $newDomain = strtolower($validated['domain']);

        if (!$customer->resource_type) {
            return response()->json(['message' => 'No deployed resource to update'], 400);
        }

        return DB::transaction(function () use ($customer, $newDomain) {
            try {
                if ($customer->resource_type === 'app') {
                    $app = AppModel::findOrFail($customer->resource_id);
                    $oldDomain = $app->domain;

                    // Cleanup old DNS Zone
                    if ($oldDomain && strtolower($oldDomain) !== $newDomain) {
                        $oldDomainRecord = Domain::where('domain', strtolower($oldDomain))->first();
                        if ($oldDomainRecord) {
                            $this->dnsService->removeZone($oldDomainRecord);
                            $oldDomainRecord->delete();
                        }
                    }

                    $app->update(['domain' => $newDomain]);

                    // Sync Nginx & DNS
                    $this->nginxService->generate($app);
                    $this->dnsService->createManagedDomain($newDomain, $app->id);

                    // If SSL is enabled, attempt to provision it for the new domain
                    if ($app->ssl_enabled) {
                        $this->sslService->setupSsl($app);
                    }
                } elseif ($customer->resource_type === 'load_balancer') {
                    $lb = LoadBalancer::findOrFail($customer->resource_id);

                    // For a Load Balancer, we'll update the first associated domain for simplicity if it was tracked as a subdomain deployment
                    $trackedDeploymentDomain = $customer->deployment ? $customer->deployment->getOriginal('domain') : null;

                    if ($trackedDeploymentDomain && strtolower($trackedDeploymentDomain) !== $newDomain) {
                        // Cleanup old DNS Zone
                        $oldDomainRecord = Domain::where('domain', strtolower($trackedDeploymentDomain))->first();
                        if ($oldDomainRecord) {
                            $this->dnsService->removeZone($oldDomainRecord);
                            $oldDomainRecord->delete();
                        }

                        $domainRecord = $lb->domains()->where('domain', $trackedDeploymentDomain)->first();
                        if ($domainRecord) {
                            $domainRecord->update(['domain' => $newDomain]);
                        } else {
                            // Or attach it if it didn't exist
                            $lbDomain = $lb->domains()->create([
                                'domain' => $newDomain,
                                'ssl_enabled' => true,
                                'force_https' => true,
                            ]);
                            // Attempt SSL setup for the new domain
                            $this->sslService->setupSsl($lbDomain);
                        }
                    } else {
                        $lb->domains()->firstOrCreate(['domain' => $newDomain]);
                    }

                    // Sync Nginx & DNS
                    $this->nginxService->generateLoadBalancer($lb);
                    $this->dnsService->createManagedDomain($newDomain);
                }

                // 3. Update the CustomerDeployment Historical Record last
                if ($customer->deployment) {
                    $customer->deployment->update(['domain' => $newDomain]);
                }

                $data = $customer->fresh()->toArray();
                $data['resource'] = $this->resolveResource($customer->fresh());

                return response()->json([
                    'message' => 'Domain updated successfully',
                    'customer' => $data
                ]);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Failed to update domain for customer {$customer->id}: " . $e->getMessage());
                throw $e; // Re-throw to trigger rollback
            }
        });
    }
}
