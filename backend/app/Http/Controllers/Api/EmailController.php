<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Models\EmailDomain;
use App\Models\EmailAccount;
use App\Models\EmailAlias;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class EmailController extends Controller
{
    public function __construct(protected EmailService $emailService) {}

    // ─── Email Domains ────────────────────────────────────────────────────────────

    /**
     * GET /email/domains
     */
    public function indexDomains(): JsonResponse
    {
        $domains = EmailDomain::with(['domain:id,domain,status', 'accounts', 'aliases'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($domains);
    }

    /**
     * POST /email/domains
     * Body: { domain_id: <int> }
     */
    public function storeDomain(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain_id' => 'required|exists:domains,id|unique:email_domains,domain_id',
        ]);

        $emailDomain = EmailDomain::create($validated);
        $emailDomain->load('domain');

        try {
            $this->emailService->addDomain($emailDomain);
        } catch (\Throwable $e) {
            \Log::error("Failed to configure email domain: " . $e->getMessage());
        }

        return response()->json($emailDomain, 201);
    }

    /**
     * DELETE /email/domains/{emailDomain}
     */
    public function destroyDomain(EmailDomain $emailDomain): JsonResponse
    {
        $emailDomain->load('domain');
        try {
            $this->emailService->removeDomain($emailDomain);
        } catch (\Throwable $e) {
            \Log::warning("Could not remove email domain from Postfix: " . $e->getMessage());
        }
        $emailDomain->delete();
        return response()->json(['message' => 'Email domain removed.']);
    }

    // ─── Accounts ─────────────────────────────────────────────────────────────────

    /**
     * GET /email/domains/{emailDomain}/accounts
     */
    public function indexAccounts(EmailDomain $emailDomain): JsonResponse
    {
        return response()->json(
            $emailDomain->accounts()->get()->append('full_email')
        );
    }

    /**
     * POST /email/domains/{emailDomain}/accounts
     */
    public function storeAccount(Request $request, EmailDomain $emailDomain): JsonResponse
    {
        $validated = $request->validate([
            'username' => [
                'required',
                'string',
                'max:64',
                'alpha_dash',
                Rule::unique('email_accounts')->where('email_domain_id', $emailDomain->id)->ignore(null),
            ],
            'password' => 'required|string|min:8',
            'quota_mb' => 'integer|min:50|max:10240',
        ]);

        // We'll store the plain text temporarily to pass to the service for hashing
        $plainPassword = $validated['password'];

        $account = $emailDomain->accounts()->create([
            'username'      => $validated['username'],
            'password_hash' => 'pending', // Will be updated after hashing
            'quota_mb'      => $validated['quota_mb'] ?? 500,
        ]);

        $emailDomain->load('domain');
        try {
            $hash = $this->emailService->updateAccountPassword($account, $plainPassword);
            $account->update(['password_hash' => $hash]);

            $this->emailService->addAccount($account->fresh()->load('emailDomain.domain'));
        } catch (\Throwable $e) {
            \Log::error("Email account creation failed: " . $e->getMessage());
        }

        return response()->json($account->fresh()->append('full_email'), 201);
    }

    /**
     * PUT /email/domains/{emailDomain}/accounts/{account}
     */
    public function updateAccount(Request $request, EmailDomain $emailDomain, EmailAccount $account): JsonResponse
    {
        abort_if($account->email_domain_id !== $emailDomain->id, 403);

        $validated = $request->validate([
            'password' => 'nullable|string|min:8',
            'quota_mb' => 'nullable|integer|min:50|max:10240',
            'active'   => 'nullable|boolean',
        ]);

        if (!empty($validated['password'])) {
            $emailDomain->load('domain');
            $account->load('emailDomain.domain');
            try {
                $hash = $this->emailService->updateAccountPassword($account, $validated['password']);
                $account->update(['password_hash' => $hash]);
            } catch (\Throwable $e) {
                \Log::error("Password update failed: " . $e->getMessage());
            }
        }

        if (isset($validated['quota_mb'])) {
            $account->update(['quota_mb' => $validated['quota_mb']]);
        }
        if (isset($validated['active'])) {
            $account->update(['active' => $validated['active']]);
        }

        return response()->json($account->fresh()->append('full_email'));
    }

    /**
     * DELETE /email/domains/{emailDomain}/accounts/{account}
     */
    public function destroyAccount(EmailDomain $emailDomain, EmailAccount $account): JsonResponse
    {
        abort_if($account->email_domain_id !== $emailDomain->id, 403);
        $account->load('emailDomain.domain');
        try {
            $this->emailService->removeAccount($account);
        } catch (\Throwable $e) {
            \Log::warning("Could not remove account from Postfix/Dovecot: " . $e->getMessage());
        }
        $account->delete();
        return response()->json(['message' => 'Account deleted.']);
    }

    // ─── Aliases ──────────────────────────────────────────────────────────────────

    /**
     * GET /email/domains/{emailDomain}/aliases
     */
    public function indexAliases(EmailDomain $emailDomain): JsonResponse
    {
        return response()->json($emailDomain->aliases()->get());
    }

    /**
     * POST /email/domains/{emailDomain}/aliases
     */
    public function storeAlias(Request $request, EmailDomain $emailDomain): JsonResponse
    {
        $validated = $request->validate([
            'source'      => 'required|string|max:64',
            'destination' => 'required|email',
        ]);

        $alias = $emailDomain->aliases()->create($validated);
        $alias->load('emailDomain.domain');

        try {
            $this->emailService->addAlias($alias);
        } catch (\Throwable $e) {
            \Log::error("Alias creation failed: " . $e->getMessage());
        }

        return response()->json($alias, 201);
    }

    /**
     * DELETE /email/domains/{emailDomain}/aliases/{alias}
     */
    public function destroyAlias(EmailDomain $emailDomain, EmailAlias $alias): JsonResponse
    {
        abort_if($alias->email_domain_id !== $emailDomain->id, 403);
        $alias->load('emailDomain.domain');
        try {
            $this->emailService->removeAlias($alias);
        } catch (\Throwable $e) {
            \Log::warning("Could not remove alias: " . $e->getMessage());
        }
        $alias->delete();
        return response()->json(['message' => 'Alias deleted.']);
    }
}
