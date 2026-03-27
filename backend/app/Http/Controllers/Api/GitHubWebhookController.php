<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\App;
use App\Services\DeploymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GitHubWebhookController extends Controller
{
    public function handle(Request $request, DeploymentService $deploymentService)
    {
        $signature = $request->header('X-Hub-Signature-256');
        $payload = $request->getContent();

        // Find the app by GitHub full name
        $repoFullName = $request->input('repository.full_name');
        $app = App::where('github_full_name', $repoFullName)->where('auto_deploy', true)->first();

        if (!$app) {
            return response()->json(['message' => 'No matching app with auto-deploy enabled'], 200);
        }

        // Verify signature
        if ($app->webhook_secret) {
            $computedSignature = 'sha256=' . hash_hmac('sha256', $payload, $app->webhook_secret);
            if (!hash_equals($signature, $computedSignature)) {
                Log::warning('GitHub Webhook Signature Mismatch', ['app' => $app->name]);
                return response()->json(['message' => 'Invalid signature'], 403);
            }
        }

        // Check branch
        $ref = $request->input('ref'); // e.g., refs/heads/main
        $branch = str_replace('refs/heads/', '', $ref);

        if ($branch !== $app->branch) {
            return response()->json(['message' => "Ignoring push to branch {$branch}"], 200);
        }

        Log::info("GitHub Auto-Deploy Triggered", ['app' => $app->name, 'repo' => $repoFullName]);

        // Trigger deployment
        $app->update(['status' => 'deploying']);
        $deployment = $deploymentService->createDeploymentRecord($app);
        \App\Jobs\DeployApp::dispatch($app, $deployment);

        return response()->json(['message' => 'Deployment triggered'], 202);
    }
}
