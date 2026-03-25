<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillableRoute;
use App\Models\RequestUsageLog;
use Illuminate\Http\Request;

class BillableRouteController extends Controller
{
    /**
     * List all billable routes.
     */
    public function index()
    {
        return response()->json(
            BillableRoute::orderBy('is_active', 'desc')
                ->orderBy('path')
                ->get()
        );
    }

    /**
     * Create a new billable route.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'path'               => 'required|string|max:255',
            'charge_per_request' => 'required|integer|min:1',
            'description'        => 'nullable|string|max:500',
            'is_active'          => 'nullable|boolean',
        ]);

        $validated['path'] = BillableRoute::normalizePath($validated['path']);

        $route = BillableRoute::create($validated);

        return response()->json($route, 201);
    }

    /**
     * Update a billable route.
     */
    public function update(Request $request, BillableRoute $billableRoute)
    {
        $validated = $request->validate([
            'path'               => 'sometimes|string|max:255',
            'charge_per_request' => 'sometimes|integer|min:1',
            'description'        => 'nullable|string|max:500',
            'is_active'          => 'nullable|boolean',
        ]);

        if (isset($validated['path'])) {
            $validated['path'] = BillableRoute::normalizePath($validated['path']);
        }

        $billableRoute->update($validated);

        return response()->json($billableRoute->fresh());
    }

    /**
     * Delete a billable route.
     */
    public function destroy(BillableRoute $billableRoute)
    {
        $billableRoute->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * Get paginated request usage history.
     */
    public function usageLogs(Request $request)
    {
        $query = RequestUsageLog::with(['billableRoute'])
            ->orderByDesc('created_at');

        if ($request->filled('route_id')) {
            $query->where('billable_route_id', $request->route_id);
        }

        return response()->json($query->paginate(30));
    }
}
