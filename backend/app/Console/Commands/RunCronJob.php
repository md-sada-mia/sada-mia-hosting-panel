<?php

namespace App\Console\Commands;

use App\Models\CronJob;
use Illuminate\Console\Command;
use Symfony\Component\Process\Process;
use Illuminate\Support\Facades\Log;

class RunCronJob extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'cron:run {id}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run a specific cron job and capture its output';

    /**
     * Execute the console command.
     */
    public function handle(\App\Services\CronLogService $logService)
    {
        $id = $this->argument('id');
        $job = CronJob::find($id);

        if (!$job) {
            $this->error("Cron job with ID {$id} not found.");
            return 1;
        }

        if (!$job->is_active) {
            $this->warn("Cron job with ID {$id} is inactive. Skipping.");
            return 0;
        }

        $this->info("Starting cron job: {$job->description} ({$job->command})");

        $cronLog = $logService->start($job->id);
        $job->update(['last_status' => 'running']);

        $process = Process::fromShellCommandline($job->command);
        $process->setTimeout(3600); // 1 hour timeout

        $outputBuffer = "";

        try {
            $process->run(function ($type, $buffer) use (&$outputBuffer) {
                $outputBuffer .= $buffer;
            });

            $status = $process->isSuccessful() ? 'success' : 'failed';
            $logService->finish($cronLog, $status, $outputBuffer ?: ($status === 'failed' ? "Process exited with code " . $process->getExitCode() : ""));

            $job->update([
                'last_status' => $status,
                'last_run_at' => now(),
                'last_output' => $outputBuffer,
            ]);

            if ($status === 'success') {
                $this->info("Cron job completed successfully.");
            } else {
                $this->error("Cron job failed with exit code " . $process->getExitCode());
            }
        } catch (\Exception $e) {
            Log::error("Error executing cron job {$id}: " . $e->getMessage());
            $logService->finish($cronLog, 'failed', "Exception occurred: " . $e->getMessage());
            $job->update([
                'last_status' => 'failed',
                'last_run_at' => now(),
                'last_output' => "Exceptions occurred: " . $e->getMessage(),
            ]);
            return 1;
        }

        return 0;
    }
}
