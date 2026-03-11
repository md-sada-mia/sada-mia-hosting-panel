<?php

namespace App\Services;

use App\Models\CronJob;
use Illuminate\Support\Facades\Log;

class CronService
{
    /**
     * Sync all active cron jobs from the database to the system crontab for the www-data user.
     */
    public function syncToSystem(): void
    {
        try {
            $activeJobs = CronJob::where('is_active', true)->get();

            $crontabLines = [];
            $crontabLines[] = "# Sada Mia Hosting Panel - Managed Cron Jobs";
            $crontabLines[] = "# Last synced: " . now()->toDateTimeString();

            foreach ($activeJobs as $job) {
                // Use the wrapper command to capture output and status
                $basePath = base_path();
                $crontabLines[] = "{$job->schedule} php {$basePath}/artisan cron:run {$job->id} >> /dev/null 2>&1";
            }

            $crontabContent = implode("\n", $crontabLines) . "\n";

            // Write to a temporary file
            $tmpFile = tempnam(sys_get_temp_dir(), 'crontab');
            file_put_contents($tmpFile, $crontabContent);

            // Install the new crontab for the current user (which should be www-data when running via FPM or Queue)
            // Note: If running as root (during install), we should specify the user if needed, 
            // but usually this runs as the web user.
            $output = [];
            $exitCode = 0;
            exec("crontab " . escapeshellarg($tmpFile) . " 2>&1", $output, $exitCode);

            unlink($tmpFile);

            if ($exitCode !== 0) {
                Log::error("Failed to sync crontab: " . implode("\n", $output));
                throw new \RuntimeException("Failed to update system crontab");
            }

            Log::info("Crontab synced successfully with " . $activeJobs->count() . " jobs.");
        } catch (\Exception $e) {
            Log::error("Crontab sync error: " . $e->getMessage());
            throw $e;
        }
    }
}
