<?php

namespace App\Services;

use App\Models\CronLog;
use Illuminate\Support\Facades\Log;

class CronLogService
{
    /**
     * Start logging a cron execution.
     */
    public function start(?int $cronJobId = null, ?string $commandName = null): CronLog
    {
        return CronLog::create([
            'cron_job_id' => $cronJobId,
            'command_name' => $commandName,
            'status' => 'running',
            'started_at' => now(),
        ]);
    }

    /**
     * Finish logging a cron execution.
     */
    public function finish(CronLog $log, string $status, ?string $output = null): void
    {
        $endedAt = now();
        $duration = round($endedAt->getTimestamp() - $log->started_at->getTimestamp(), 2);

        $log->update([
            'status' => $status,
            'output' => $output,
            'duration' => $duration,
            'ended_at' => $endedAt,
        ]);
    }
}
