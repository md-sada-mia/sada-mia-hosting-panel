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

        // Sanitize names for psql
        $quotedDb = "\"" . str_replace("\"", "\"\"", $dbName) . "\"";
        $quotedUser = "\"" . str_replace("\"", "\"\"", $dbUser) . "\"";
        $dbPassEscaped = str_replace("'", "''", $dbPass);

        $cmds = [
            "sudo -u postgres psql -c " . escapeshellarg("CREATE USER {$quotedUser} WITH ENCRYPTED PASSWORD '{$dbPassEscaped}';"),
            "sudo -u postgres psql -c " . escapeshellarg("CREATE DATABASE {$quotedDb} OWNER {$quotedUser};"),
            "sudo -u postgres psql -c " . escapeshellarg("GRANT ALL PRIVILEGES ON DATABASE {$quotedDb} TO {$quotedUser};"),
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

    public function changePassword(Database $database, string $newPassword): void
    {
        $quotedUser = "\"" . str_replace("\"", "\"\"", $database->db_user) . "\"";
        $newPasswordEscaped = str_replace("'", "''", $newPassword);

        $cmd = "sudo -u postgres psql -c " . escapeshellarg("ALTER ROLE {$quotedUser} WITH ENCRYPTED PASSWORD '{$newPasswordEscaped}';");

        $result = $this->shell->run($cmd);
        if ($result['exit_code'] !== 0) {
            throw new \RuntimeException("Failed to change database password: " . $result['output']);
        }

        $database->update(['db_password' => $newPassword]);
    }

    public function delete(Database $database): void
    {
        $quotedDb = "\"" . str_replace("\"", "\"\"", $database->db_name) . "\"";
        $quotedUser = "\"" . str_replace("\"", "\"\"", $database->db_user) . "\"";

        $cmds = [
            "sudo -u postgres psql -c " . escapeshellarg("DROP DATABASE IF EXISTS {$quotedDb};"),
            "sudo -u postgres psql -c " . escapeshellarg("DROP ROLE IF EXISTS {$quotedUser};"),
        ];

        foreach ($cmds as $cmd) {
            $this->shell->run($cmd);
        }

        $database->delete();
    }

    public function createUser(string $username, string $password): \App\Models\DatabaseUser
    {
        $quotedUser = "\"" . str_replace("\"", "\"\"", $username) . "\"";
        $passwordEscaped = str_replace("'", "''", $password);

        $cmd = "sudo -u postgres psql -c " . escapeshellarg("CREATE USER {$quotedUser} WITH ENCRYPTED PASSWORD '{$passwordEscaped}';");

        $result = $this->shell->run($cmd);
        if ($result['exit_code'] !== 0) {
            throw new \RuntimeException("Failed to create database user: " . $result['output']);
        }

        return \App\Models\DatabaseUser::create([
            'username' => $username,
            'password' => $password,
            'status' => 'active',
        ]);
    }

    public function changeUserPassword(\App\Models\DatabaseUser $user, string $newPassword): void
    {
        $quotedUser = "\"" . str_replace("\"", "\"\"", $user->username) . "\"";
        $newPasswordEscaped = str_replace("'", "''", $newPassword);

        $cmd = "sudo -u postgres psql -c " . escapeshellarg("ALTER ROLE {$quotedUser} WITH ENCRYPTED PASSWORD '{$newPasswordEscaped}';");

        $result = $this->shell->run($cmd);
        if ($result['exit_code'] !== 0) {
            throw new \RuntimeException("Failed to change database user password: " . $result['output']);
        }

        $user->update(['password' => $newPassword]);
    }

    public function deleteUser(\App\Models\DatabaseUser $user): void
    {
        $quotedUser = "\"" . str_replace("\"", "\"\"", $user->username) . "\"";

        // First, drop role might fail if it has privileges, but we revoke privileges via DB first or DROP OWNED BY
        // A clean way is to REASSIGN OWNED BY postgres and DROP OWNED BY user before DROP ROLE
        $cmds = [
            "sudo -u postgres psql -c " . escapeshellarg("REASSIGN OWNED BY {$quotedUser} TO postgres;"),
            "sudo -u postgres psql -c " . escapeshellarg("DROP OWNED BY {$quotedUser};"),
            "sudo -u postgres psql -c " . escapeshellarg("DROP ROLE IF EXISTS {$quotedUser};")
        ];

        foreach ($cmds as $cmd) {
            $this->shell->run($cmd);
        }

        $user->delete();
    }

    public function syncUserPermissions(\App\Models\DatabaseUser $user, array $newDatabases): void
    {
        $newDatabaseIds = array_column($newDatabases, 'id');
        $newPermissionsMap = collect($newDatabases)->keyBy('id')->map(fn($item) => ['privileges' => $item['privileges']])->toArray();

        $currentDbRecords = $user->databases()->get();
        $currentDatabaseIds = $currentDbRecords->pluck('id')->toArray();
        $currentPermissionsMap = $currentDbRecords->keyBy('id')->map(fn($db) => $db->pivot->privileges)->toArray();

        $addedIds = array_diff($newDatabaseIds, $currentDatabaseIds);
        $removedIds = array_diff($currentDatabaseIds, $newDatabaseIds);
        $keptIds = array_intersect($newDatabaseIds, $currentDatabaseIds);

        $changedPrivilegeIds = [];
        foreach ($keptIds as $id) {
            if (($currentPermissionsMap[$id] ?? null) !== $newPermissionsMap[$id]['privileges']) {
                $changedPrivilegeIds[] = $id;
            }
        }

        $quotedUser = "\"" . str_replace("\"", "\"\"", $user->username) . "\"";

        $removedDbs = Database::whereIn('id', $removedIds)->get();
        foreach ($removedDbs as $db) {
            $quotedDb = "\"" . str_replace("\"", "\"\"", $db->db_name) . "\"";
            $quotedOwner = "\"" . str_replace("\"", "\"\"", $db->db_user) . "\"";

            $cmds = [
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM {$quotedUser};"),
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM {$quotedUser};"),
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public REVOKE ALL ON TABLES FROM {$quotedUser};"),
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {$quotedUser};"),
                "sudo -u postgres psql -c " . escapeshellarg("REVOKE ALL PRIVILEGES ON DATABASE {$quotedDb} FROM {$quotedUser};"),
            ];
            foreach ($cmds as $cmd) {
                $this->shell->run($cmd);
            }
        }

        $dbsToSetup = Database::whereIn('id', array_merge($addedIds, $changedPrivilegeIds))->get();
        foreach ($dbsToSetup as $db) {
            $privilege = $newPermissionsMap[$db->id]['privileges'] ?? 'read';
            $quotedDb = "\"" . str_replace("\"", "\"\"", $db->db_name) . "\"";
            $quotedOwner = "\"" . str_replace("\"", "\"\"", $db->db_user) . "\"";

            // Reset existing privileges in case of downgrade
            $cmds = [
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM {$quotedUser};"),
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM {$quotedUser};"),
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public REVOKE ALL ON TABLES FROM {$quotedUser};"),
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {$quotedUser};"),
                "sudo -u postgres psql -c " . escapeshellarg("REVOKE ALL PRIVILEGES ON DATABASE {$quotedDb} FROM {$quotedUser};"),
                "sudo -u postgres psql -c " . escapeshellarg("GRANT CONNECT ON DATABASE {$quotedDb} TO {$quotedUser};"),
                "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("GRANT USAGE ON SCHEMA public TO {$quotedUser};"),
            ];

            if ($privilege === 'all') {
                $cmds[] = "sudo -u postgres psql -c " . escapeshellarg("GRANT ALL PRIVILEGES ON DATABASE {$quotedDb} TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public GRANT ALL ON TABLES TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public GRANT ALL ON SEQUENCES TO {$quotedUser};");
            } elseif ($privilege === 'write') {
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO {$quotedUser};");
            } else { // read
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("GRANT SELECT ON ALL TABLES IN SCHEMA public TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public GRANT SELECT ON TABLES TO {$quotedUser};");
                $cmds[] = "sudo -u postgres psql -d {$quotedDb} -c " . escapeshellarg("ALTER DEFAULT PRIVILEGES FOR ROLE {$quotedOwner} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {$quotedUser};");
            }

            foreach ($cmds as $cmd) {
                $this->shell->run($cmd);
            }
        }

        $user->databases()->sync($newPermissionsMap);
    }
}
