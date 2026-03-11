<?php

namespace App\Services;

use App\Models\EmailDomain;
use App\Models\EmailAccount;
use App\Models\EmailAlias;

class EmailService
{
    protected ShellService $shell;

    // Postfix virtual map files
    protected string $virtualDomainsFile  = '/etc/postfix/virtual_mailbox_domains';
    protected string $virtualMailboxFile  = '/etc/postfix/virtual_mailbox_maps';
    protected string $virtualAliasFile    = '/etc/postfix/virtual_alias_maps';
    protected string $mailbaseDir         = '/var/mail/vhosts';

    // Dovecot users file (passdb + userdb)
    protected string $dovecotUsersFile    = '/etc/dovecot/users';

    public function __construct(ShellService $shell)
    {
        $this->shell = $shell;
    }

    // ─── Domain ──────────────────────────────────────────────────────────────────

    public function addDomain(EmailDomain $emailDomain): void
    {
        $domain = $emailDomain->domain->domain;

        // Create mail directory for domain
        $this->shell->run("sudo mkdir -p {$this->mailbaseDir}/{$domain}");
        $this->shell->run("sudo chown -R vmail:vmail {$this->mailbaseDir}/{$domain} 2>/dev/null || true");

        $this->appendLine($this->virtualDomainsFile, $domain);
        $this->postmapAndReload($this->virtualDomainsFile);
    }

    public function removeDomain(EmailDomain $emailDomain): void
    {
        $domain = $emailDomain->domain->domain;

        $this->removeLine($this->virtualDomainsFile, $domain);
        $this->postmapAndReload($this->virtualDomainsFile);

        // Remove maildir
        $this->shell->run("sudo rm -rf {$this->mailbaseDir}/{$domain}");
    }

    // ─── Account ─────────────────────────────────────────────────────────────────

    public function addAccount(EmailAccount $account): void
    {
        $domain  = $account->emailDomain->domain->domain;
        $user    = $account->username;
        $fullMail = "{$user}@{$domain}";

        // Create maildir
        $maildir = "{$this->mailbaseDir}/{$domain}/{$user}/";
        $this->shell->run("sudo mkdir -p {$maildir}");
        $this->shell->run("sudo chown -R vmail:vmail {$maildir} 2>/dev/null || true");

        // Postfix virtual_mailbox_maps  e.g. user@domain.com  domain.com/user/
        $this->appendLine($this->virtualMailboxFile, "{$fullMail}  {$domain}/{$user}/");
        $this->postmapAndReload($this->virtualMailboxFile);

        // Dovecot users file  e.g. user@domain.com:{PLAIN}password::::
        $hash = $this->hashPassword($account->password_hash);
        $this->appendLine($this->dovecotUsersFile, "{$fullMail}:{$hash}::::::userdb_quota_rule=*:bytes=" . ($account->quota_mb * 1024 * 1024));

        $this->reloadDovecot();
    }

    public function updateAccountPassword(EmailAccount $account, string $plainPassword): string
    {
        $domain    = $account->emailDomain->domain->domain;
        $fullMail  = "{$account->username}@{$domain}";
        $hash      = $this->hashPassword($plainPassword);

        // Remove old entry and re-add with new hash
        $this->removeDovecotUser($fullMail);
        $this->appendLine($this->dovecotUsersFile, "{$fullMail}:{$hash}::::::userdb_quota_rule=*:bytes=" . ($account->quota_mb * 1024 * 1024));
        $this->reloadDovecot();

        return $hash;
    }

    public function removeAccount(EmailAccount $account): void
    {
        $domain   = $account->emailDomain->domain->domain;
        $fullMail = "{$account->username}@{$domain}";

        $this->removeLine($this->virtualMailboxFile, $fullMail);
        $this->postmapAndReload($this->virtualMailboxFile);

        $this->removeDovecotUser($fullMail);
        $this->reloadDovecot();
    }

    // ─── Alias ───────────────────────────────────────────────────────────────────

    public function addAlias(EmailAlias $alias): void
    {
        $domain  = $alias->emailDomain->domain->domain;
        $source  = "{$alias->source}@{$domain}";

        $this->appendLine($this->virtualAliasFile, "{$source}  {$alias->destination}");
        $this->postmapAndReload($this->virtualAliasFile);
    }

    public function removeAlias(EmailAlias $alias): void
    {
        $domain = $alias->emailDomain->domain->domain;
        $source = "{$alias->source}@{$domain}";

        $this->removeLine($this->virtualAliasFile, $source);
        $this->postmapAndReload($this->virtualAliasFile);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    public function isPostfixInstalled(): bool
    {
        $result = $this->runOutput('which postfix 2>/dev/null');
        return !empty(trim($result));
    }

    private function runOutput(string $cmd): string
    {
        return $this->shell->run($cmd)['output'] ?? '';
    }

    private function hashPassword(string $password): string
    {
        // Try doveadm first (requires Dovecot installed)
        $hash = trim($this->runOutput("doveadm pw -s SHA512-CRYPT -p " . escapeshellarg($password) . " 2>/dev/null"));
        if (!empty($hash) && str_starts_with($hash, '{')) {
            return $hash;
        }
        // Fallback: store prefixed plain (not for production without Dovecot)
        return '{PLAIN}' . $password;
    }

    private function appendLine(string $file, string $line): void
    {
        // Ensure file exists
        $this->shell->run("sudo touch {$file}");
        // Only append if not already present
        $escaped = escapeshellarg($line);
        $check   = $this->runOutput("sudo grep -qF {$escaped} {$file} 2>/dev/null; echo \$?");
        if (trim($check) !== '0') {
            $this->shell->run("echo {$escaped} | sudo tee -a {$file} > /dev/null");
        }
    }

    private function removeLine(string $file, string $prefix): void
    {
        $escaped = escapeshellarg(preg_quote($prefix, '/'));
        $this->shell->run("sudo sed -i '/^{$escaped}/d' {$file} 2>/dev/null || true");
    }

    private function removeDovecotUser(string $fullMail): void
    {
        $escaped = escapeshellarg('^' . preg_quote($fullMail, '/') . ':');
        $this->shell->run("sudo sed -i '/{$escaped}/d' {$this->dovecotUsersFile} 2>/dev/null || true");
    }

    private function postmapAndReload(string $file): void
    {
        $this->shell->run("sudo postmap {$file} 2>/dev/null || true");
        $this->shell->run("sudo postfix reload 2>/dev/null || true");
    }

    private function reloadDovecot(): void
    {
        $this->shell->run("sudo systemctl reload dovecot 2>/dev/null || true");
    }
}
