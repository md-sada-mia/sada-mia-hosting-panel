<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;

class QueueController extends Controller
{
    /**
     * Get pending and failed jobs.
     */
    public function index()
    {
        $pendingJobs = DB::table('jobs')
            ->select('id', 'queue', 'payload', 'attempts', 'reserved_at', 'available_at', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($job) {
                return [
                    'id'          => $job->id,
                    'queue'       => $job->queue,
                    'payload'     => json_decode($job->payload, true),
                    'attempts'    => $job->attempts,
                    'is_reserved' => !is_null($job->reserved_at),
                    'created_at'  => date('Y-m-d H:i:s', $job->created_at),
                ];
            });

        $failedJobs = DB::table('failed_jobs')
            ->orderBy('failed_at', 'desc')
            ->get()
            ->map(function ($job) {
                return [
                    'id'        => $job->id,
                    'uuid'      => $job->uuid,
                    'queue'     => $job->queue,
                    'payload'   => json_decode($job->payload, true),
                    'failed_at' => $job->failed_at,
                    'exception' => $job->exception,
                ];
            });

        return response()->json([
            'pending' => $pendingJobs,
            'failed'  => $failedJobs,
        ]);
    }

    /**
     * Retry a failed job.
     */
    public function retry($id)
    {
        Artisan::call('queue:retry', ['id' => $id]);
        return response()->json(['message' => 'Job marked for retry.']);
    }

    /**
     * Cancel/Delete a pending job.
     */
    public function cancel($id)
    {
        DB::table('jobs')->where('id', $id)->delete();
        return response()->json(['message' => 'Pending job cancelled.']);
    }

    /**
     * Clear all failed jobs.
     */
    public function clear()
    {
        Artisan::call('queue:flush');
        return response()->json(['message' => 'All failed jobs cleared.']);
    }
}
