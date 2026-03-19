<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GitHubService
{
    protected $clientId;
    protected $clientSecret;
    protected $redirectUri;

    public function __construct()
    {
        $this->clientId = Setting::get('github_client_id');
        $this->clientSecret = Setting::get('github_client_secret');

        // OAuth redirect should go to the frontend UI
        $panelUrl = Setting::get('panel_url', env('FRONTEND_URL', config('app.url')));
        $this->redirectUri = rtrim($panelUrl, '/') . '/github/callback';
    }

    public function getAuthUrl()
    {
        $baseUrl = 'https://github.com/login/oauth/authorize';
        $params = [
            'client_id' => $this->clientId,
            'redirect_uri' => $this->redirectUri,
            'scope' => 'repo,admin:repo_hook',
            'state' => csrf_token(),
            'prompt' => 'consent',
        ];

        return $baseUrl . '?' . http_build_query($params);
    }

    public function getAccessToken($code)
    {
        $response = Http::asJson()->acceptJson()->post('https://github.com/login/oauth/access_token', [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'code' => $code,
            'redirect_uri' => $this->redirectUri,
        ]);

        if ($response->successful()) {
            return $response->json('access_token');
        }

        Log::error('GitHub OAuth Failed', ['response' => $response->body()]);
        return null;
    }

    public function getUser($token)
    {
        $response = Http::withToken($token)->get('https://api.github.com/user');
        return $response->json();
    }

    public function listRepositories($token)
    {
        $response = Http::withToken($token)->get('https://api.github.com/user/repos', [
            'sort' => 'updated',
            'per_page' => 100,
        ]);

        return $response->json();
    }

    public function createWebhook($token, $fullName, $secret)
    {
        $webhookUrl = config('app.url') . '/api/github/webhook';

        $response = Http::withToken($token)->post("https://api.github.com/repos/{$fullName}/hooks", [
            'name' => 'web',
            'active' => true,
            'events' => ['push'],
            'config' => [
                'url' => $webhookUrl,
                'content_type' => 'json',
                'secret' => $secret,
                'insecure_ssl' => '0',
            ],
        ]);

        return $response->json();
    }

    public function getHooks($token, $fullName)
    {
        $response = Http::withToken($token)->get("https://api.github.com/repos/{$fullName}/hooks");
        return $response->json();
    }

    public function deleteWebhook($token, $fullName, $hookId)
    {
        $response = Http::withToken($token)->delete("https://api.github.com/repos/{$fullName}/hooks/{$hookId}");
        return $response->successful();
    }
}
