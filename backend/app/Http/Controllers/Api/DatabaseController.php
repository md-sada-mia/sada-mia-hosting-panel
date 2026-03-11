<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Database;
use App\Services\ShellService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DatabaseController extends Controller
{
    public function __construct(private \App\Services\DatabaseService $dbService) {}

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

        try {
            $db = $this->dbService->createRaw($validated['db_name'], $validated['app_id'] ?? null);

            // Return with password specifically for the UI on create
            $data = $db->toArray();
            $data['db_password'] = $db->db_password;

            return response()->json($data, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function destroy(Database $database)
    {
        try {
            $this->dbService->delete($database);
            return response()->json(['message' => 'Database deleted']);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
