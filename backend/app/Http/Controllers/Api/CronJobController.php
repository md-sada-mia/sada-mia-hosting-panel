<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;

use App\Models\CronJob;
use App\Services\CronService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CronJobController extends Controller
{
    public function __construct(private CronService $cronService) {}

    public function index(): JsonResponse
    {
        return response()->json(CronJob::latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'command'     => 'required|string',
            'schedule'    => 'required|string', // Consider adding a regex for cron validation
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
        ]);

        $job = CronJob::create($validated);

        $this->cronService->syncToSystem();

        return response()->json($job, 201);
    }

    public function update(Request $request, CronJob $cronJob): JsonResponse
    {
        $validated = $request->validate([
            'command'     => 'string',
            'schedule'    => 'string',
            'description' => 'nullable|string',
            'is_active'   => 'boolean',
        ]);

        $cronJob->update($validated);

        $this->cronService->syncToSystem();

        return response()->json($cronJob);
    }

    public function destroy(CronJob $cronJob): JsonResponse
    {
        $cronJob->delete();

        $this->cronService->syncToSystem();

        return response()->json(null, 204);
    }

    public function toggle(CronJob $cronJob): JsonResponse
    {
        $cronJob->update(['is_active' => !$cronJob->is_active]);

        $this->cronService->syncToSystem();

        return response()->json($cronJob);
    }

    public function logs(CronJob $cronJob): JsonResponse
    {
        return response()->json($cronJob->logs()->limit(100)->get());
    }

    public function systemLogs(): JsonResponse
    {
        return response()->json(\App\Models\CronLog::whereNull('cron_job_id')->orderByDesc('created_at')->limit(100)->get());
    }
}
