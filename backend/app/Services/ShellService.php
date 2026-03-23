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
        // Detect current system user and environment
        $currentUser = posix_getpwuid(posix_geteuid())['name'] ?? 'www-data';
        $homeDir = ($currentUser === 'www-data') ? '/var/www' : (getenv('HOME') ?: '/tmp');

        // Isolation: Use `env -i` to clear parent environment variables (like panel's DB_CONNECTION)
        // We explicitly pass only a safe subset of variables.
        $baseEnv = [
            'PATH' => getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin',
            'HOME' => $homeDir,
            'USER' => $currentUser,
            'LOGNAME' => $currentUser,
            'SHELL' => '/bin/bash',
            'LANG' => getenv('LANG') ?: 'en_US.UTF-8',
            'PM2_HOME' => $homeDir . '/.pm2',
            'NODE_ENV' => 'production',
            'NEXT_TELEMETRY_DISABLED' => '1',
            'NODE_OPTIONS' => '--dns-result-order=ipv4first',
            'XDG_CACHE_HOME' => $homeDir . '/.cache',
            'NPM_CONFIG_CACHE' => $homeDir . '/.npm',
            'GIT_TERMINAL_PROMPT' => '0',
        ];

        $envPrefix = 'env -i ';
        foreach ($baseEnv as $k => $v) {
            $envPrefix .= escapeshellarg($k) . '=' . escapeshellarg($v) . ' ';
        }

        $process = Process::fromShellCommandline($envPrefix . $command, $cwd);
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
    public function stream(string $command, string $cwd = '/', ?callable $onLine = null, int $timeout = 600): int
    {
        // Detect current system user and environment
        $currentUser = posix_getpwuid(posix_geteuid())['name'] ?? 'www-data';
        $homeDir = ($currentUser === 'www-data') ? '/var/www' : (getenv('HOME') ?: '/tmp');

        // Isolation: Use `env -i` to clear parent environment variables
        $baseEnv = [
            'PATH' => getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin',
            'HOME' => $homeDir,
            'USER' => $currentUser,
            'LOGNAME' => $currentUser,
            'SHELL' => '/bin/bash',
            'LANG' => getenv('LANG') ?: 'en_US.UTF-8',
            'PM2_HOME' => $homeDir . '/.pm2',
            'NODE_ENV' => 'production',
            'NEXT_TELEMETRY_DISABLED' => '1',
            'NODE_OPTIONS' => '--dns-result-order=ipv4first',
            'XDG_CACHE_HOME' => $homeDir . '/.cache',
            'NPM_CONFIG_CACHE' => $homeDir . '/.npm',
            'GIT_TERMINAL_PROMPT' => '0',
        ];

        $envPrefix = 'env -i ';
        foreach ($baseEnv as $k => $v) {
            $envPrefix .= escapeshellarg($k) . '=' . escapeshellarg($v) . ' ';
        }

        $process = Process::fromShellCommandline($envPrefix . $command, $cwd);
        $process->setTimeout($timeout);

        $process->run(function ($type, $buffer) use ($onLine) {
            if ($onLine) {
                $onLine($buffer);
            }
        });

        return $process->getExitCode();
    }
}
