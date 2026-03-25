<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DatabaseUser;
use App\Services\DatabaseService;
use Illuminate\Http\Request;

class DatabaseUserController extends Controller
{
    public function __construct(private DatabaseService $dbService) {}

    public function index()
    {
        return response()->json(DatabaseUser::with('databases:id,db_name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|string|regex:/^[a-zA-Z0-9_]+$/|unique:database_users,username|unique:databases,db_user',
            'password' => 'required|string|min:8',
            'global_privileges' => 'nullable|array',
            'global_privileges.*' => 'string|in:CREATEDB,CREATEROLE,SUPERUSER',
        ]);

        try {
            $user = $this->dbService->createUser($validated['username'], $validated['password'], $validated['global_privileges'] ?? []);

            $data = $user->toArray();
            $data['password'] = $user->password;

            return response()->json($data, 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function syncGlobalPrivileges(Request $request, DatabaseUser $user)
    {
        $validated = $request->validate([
            'global_privileges' => 'nullable|array',
            'global_privileges.*' => 'string|in:CREATEDB,CREATEROLE,SUPERUSER',
        ]);

        try {
            $this->dbService->syncGlobalPrivileges($user, $validated['global_privileges'] ?? []);
            return response()->json(['message' => 'Global privileges updated successfully', 'user' => $user->fresh()]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function updatePassword(Request $request, DatabaseUser $user)
    {
        $validated = $request->validate([
            'password' => 'required|string|min:8',
        ]);

        try {
            $this->dbService->changeUserPassword($user, $validated['password']);
            return response()->json(['message' => 'User password updated successfully']);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function destroy(DatabaseUser $user)
    {
        try {
            $this->dbService->deleteUser($user);
            return response()->json(['message' => 'User deleted']);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function syncPermissions(Request $request, DatabaseUser $user)
    {
        $validated = $request->validate([
            'databases' => 'array',
            'databases.*.id' => 'required|exists:databases,id',
            'databases.*.privileges' => 'required|string',
        ]);

        try {
            $this->dbService->syncUserPermissions($user, $validated['databases'] ?? []);
            return response()->json([
                'message' => 'Permissions synced successfully',
                'user' => $user->load('databases:id,db_name'),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
