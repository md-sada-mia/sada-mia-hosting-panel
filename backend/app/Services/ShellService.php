<?php

namespace App\Services;

use App\Models\App;
use Symfony\Component\Process\Process;

class ShellService
{
    /**
     * Run a shell command and return [exitCode, output].
     */
    public function run(string $command, string $cwd = '/', int $timeout = 300): array
    {
        $process = Process::fromShellCommandline($command, $cwd);
        $process->setTimeout($timeout);

        $output = '';
        $process->run(function ($type, $buffer) use (&$output) {
            $output .= $buffer;
        });

        return [
            'exit_code' => $process->getExitCode(),
            'output' => $output,
        ];
    }

    /**
     * Run a command, streaming line-by-line output via a callback.
     */
    public function stream(string $command, string $cwd = '/', callable $onLine = null, int $timeout = 600): int
    {
        $process = Process::fromShellCommandline($command, $cwd);
        $process->setTimeout($timeout);

        $process->run(function ($type, $buffer) use ($onLine) {
            if ($onLine) {
                $onLine($buffer);
            }
        });

        return $process->getExitCode();
    }
}
