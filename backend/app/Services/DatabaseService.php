<?php

namespace App\Services;

use App\Models\App;
use App\Models\Database;
use Illuminate\Support\Str;

class DatabaseService
{
    public function __construct(private ShellService $shell) {}

    public function createForApp(App $app): Database
    {
        // Sanitize domain: remove non-alphanumeric, replace dots/dashes with underscores
        $prefix = preg_replace('/[^a-z0-9]/', '_', strtolower($app->domain));
        $prefix = trim($prefix, '_');

        $dbName = $prefix . '_db_' . Str::lower(Str::random(4));
        $dbUser = $prefix . '_u_' . Str::lower(Str::random(4));

        return $this->createRaw($dbName, $app->id, $dbUser);
    }

    public function createRaw(string $dbName, ?int $appId = null, ?string $dbUser = null): Database
    {
        $dbUser = $dbUser ?? ($dbName . '_u');
        $dbPass = Str::random(24);

        // Sanitize names for psql (though we generate them safely)
        $quotedDb = "\"" . str_replace("\"", "\"\"", $dbName) . "\"";
        $quotedUser = "\"" . str_replace("\"", "\"\"", $dbUser) . "\"";

        $cmds = [
            "sudo -u postgres psql -c \"CREATE USER {$quotedUser} WITH ENCRYPTED PASSWORD '{$dbPass}';\"",
            "sudo -u postgres psql -c \"CREATE DATABASE {$quotedDb} OWNER {$quotedUser};\"",
            "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE {$quotedDb} TO {$quotedUser};\"",
        ];

        foreach ($cmds as $cmd) {
            $result = $this->shell->run($cmd);
            if ($result['exit_code'] !== 0) {
                throw new \RuntimeException("Database creation failed: " . $result['output']);
            }
        }

        return Database::create([
            'app_id'      => $appId,
            'db_name'     => $dbName,
            'db_user'     => $dbUser,
            'db_password' => $dbPass,
            'status'      => 'active',
        ]);
    }

    public function delete(Database $database): void
    {
        $quotedDb = "\"" . str_replace("\"", "\"\"", $database->db_name) . "\"";
        $quotedUser = "\"" . str_replace("\"", "\"\"", $database->db_user) . "\"";

        $cmds = [
            "sudo -u postgres psql -c \"DROP DATABASE IF EXISTS {$quotedDb};\"",
            "sudo -u postgres psql -c \"DROP ROLE IF EXISTS {$quotedUser};\"",
        ];

        foreach ($cmds as $cmd) {
            $this->shell->run($cmd);
        }

        $database->delete();
    }
}
