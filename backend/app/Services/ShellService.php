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

        // Detect current system user to provide a better default HOME
        $currentUser = posix_getpwuid(posix_geteuid())['name'] ?? 'www-data';
        $homeDir = ($currentUser === 'www-data') ? '/var/www' : (getenv('HOME') ?: '/tmp');

        // Ensure HOME, PATH, and build variables are passed to the subprocess
        $process->setEnv([
            'HOME' => $homeDir,
            'PATH' => getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin',
            'PM2_HOME' => $homeDir . '/.pm2',
            'NODE_ENV' => 'production',
            'NEXT_TELEMETRY_DISABLED' => '1',
            'NODE_OPTIONS' => '--dns-result-order=ipv4first',
            'XDG_CACHE_HOME' => $homeDir . '/.cache',
            'NPM_CONFIG_CACHE' => $homeDir . '/.npm',
            'GIT_TERMINAL_PROMPT' => '0',
        ]);

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
    public function stream(string $command, string $cwd = '/', ?callable $onLine = null, int $timeout = 600): int
    {
        $process = Process::fromShellCommandline($command, $cwd);
        $process->setTimeout($timeout);

        // Detect current system user to provide a better default HOME
        $currentUser = posix_getpwuid(posix_geteuid())['name'] ?? 'www-data';
        $homeDir = ($currentUser === 'www-data') ? '/var/www' : (getenv('HOME') ?: '/tmp');

        // Ensure HOME, PATH, and build variables are passed to the subprocess
        $process->setEnv([
            'HOME' => $homeDir,
            'PATH' => getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin',
            'PM2_HOME' => $homeDir . '/.pm2',
            'NODE_ENV' => 'production',
            'NEXT_TELEMETRY_DISABLED' => '1',
            'NODE_OPTIONS' => '--dns-result-order=ipv4first',
            'XDG_CACHE_HOME' => $homeDir . '/.cache',
            'NPM_CONFIG_CACHE' => $homeDir . '/.npm',
            'GIT_TERMINAL_PROMPT' => '0',
        ]);

        $process->run(function ($type, $buffer) use ($onLine) {
            if ($onLine) {
                $onLine($buffer);
            }
        });

        return $process->getExitCode();
    }
}
