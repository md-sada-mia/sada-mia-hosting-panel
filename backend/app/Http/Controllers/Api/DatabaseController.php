<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Database;
use App\Services\ShellService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DatabaseController extends Controller
{
    public function __construct(private ShellService $shell) {}

    public function index()
    {
        return response()->json(Database::with('app:id,name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'db_name' => 'required|string|regex:/^[a-zA-Z0-9_]+$/|unique:databases,db_name',
            'app_id'  => 'nullable|exists:apps,id',
        ]);

        $dbName   = $validated['db_name'];
        $dbUser   = $dbName . '_user';
        $dbPass   = Str::random(24);

        // Create PostgreSQL role + database
        $cmds = [
            "sudo -u postgres psql -c \"CREATE USER \\\"{$dbUser}\\\" WITH ENCRYPTED PASSWORD '{$dbPass}';\"",
            "sudo -u postgres psql -c \"CREATE DATABASE \\\"{$dbName}\\\" OWNER \\\"{$dbUser}\\\";\"",
            "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE \\\"{$dbName}\\\" TO \\\"{$dbUser}\\\";\"",
        ];

        $error = null;
        foreach ($cmds as $cmd) {
            $result = $this->shell->run($cmd);
            if ($result['exit_code'] !== 0) {
                $error = $result['output'];
                break;
            }
        }

        if ($error) {
            return response()->json(['error' => 'Failed to create database: ' . $error], 500);
        }

        $db = Database::create([
            'app_id'      => $validated['app_id'] ?? null,
            'db_name'     => $dbName,
            'db_user'     => $dbUser,
            'db_password' => $dbPass,
            'status'      => 'active',
        ]);

        // Return the password only on creation
        return response()->json(array_merge($db->toArray(), ['db_password' => $dbPass]), 201);
    }

    public function destroy(Database $database)
    {
        $cmds = [
            "sudo -u postgres psql -c \"DROP DATABASE IF EXISTS \\\"{$database->db_name}\\\";\"",
            "sudo -u postgres psql -c \"DROP ROLE IF EXISTS \\\"{$database->db_user}\\\";\"",
        ];

        foreach ($cmds as $cmd) {
            $this->shell->run($cmd);
        }

        $database->delete();
        return response()->json(['message' => 'Database deleted']);
    }
}
