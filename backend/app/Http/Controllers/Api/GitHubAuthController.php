<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\GitHubService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GitHubAuthController extends Controller
{
    protected $github;

    public function __construct(GitHubService $github)
    {
        $this->github = $github;
    }

    public function redirect()
    {
        return response()->json([
            'url' => $this->github->getAuthUrl()
        ]);
    }

    public function callback(Request $request)
    {
        $code = $request->input('code');

        if (!$code) {
            return response()->json(['error' => 'No code provided'], 400);
        }

        $token = $this->github->getAccessToken($code);

        if (!$token) {
            return response()->json(['error' => 'Failed to obtain access token'], 400);
        }

        // Store the token for the current user (in this simple panel, we can store it in settings or user extra data)
        // Since it's a single-user panel, let's just store it in settings for simplicity
        Setting::set('github_access_token', $token);

        $user = $this->github->getUser($token);

        return response()->json([
            'message' => 'Connected successfully',
            'github_user' => $user['login']
        ]);
    }

    public function repositories()
    {
        $token = Setting::get('github_access_token');

        if (!$token) {
            return response()->json(['error' => 'GitHub not connected'], 401);
        }

        $repos = $this->github->listRepositories($token);

        return response()->json($repos);
    }

    public function disconnect()
    {
        Setting::set('github_access_token', null);
        return response()->json(['message' => 'Disconnected successfully']);
    }
}
