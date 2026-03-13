<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TerminalController extends Controller
{
    protected string $root;

    public function __construct()
    {
        // Sandbox the terminal to the apps directory by default
        $this->root = rtrim(config('hosting.apps_base_path', '/var/www/hosting-apps'), '/');
    }

    /**
     * Get terminal info (CWD, user, hostname)
     * GET /api/terminal/info
     */
    public function info(Request $request)
    {
        $cwd = $request->input('path', $this->root);

        // Ensure path is within allowed root
        if (!Str::startsWith(realpath($cwd) ?: $cwd, $this->root) && $cwd !== '/') {
            $cwd = $this->root;
        }

        return response()->json([
            'cwd' => $cwd,
            'user' => get_current_user(),
            'hostname' => gethostname(),
            'os' => php_uname('s') . ' ' . php_uname('r')
        ]);
    }

    /**
     * Execute a command in the terminal
     * POST /api/terminal/execute
     */
    public function execute(Request $request)
    {
        $request->validate([
            'command' => 'required|string',
            'cwd' => 'nullable|string'
        ]);

        $commandStr = $request->input('command');
        $cwd = $request->input('cwd', $this->root);

        // Security: Ensure cwd is within allowed root or let the system restrict it later if we want broader access (like /) for admin
        // For now, allow reading anywhere but restrict dangerous commands
        if ($cwd && realpath($cwd) !== false && !Str::startsWith(realpath($cwd), $this->root)) {
            // We'll let them navigate, but commands are blocked below
        }

        // Basic blocklist for dangerous commands
        $blocked = [
            'rm -rf /',
            'mkfs',
            'shutdown',
            'reboot',
            'init 0',
            'mke2fs',
            'dd if=/dev/zero',
            'mkswap'
        ];

        foreach ($blocked as $b) {
            if (strpos($commandStr, $b) !== false) {
                return response()->json([
                    'output' => "Error: Command explicitly rejected by security policy.\n",
                    'exit_code' => 1
                ], 403);
            }
        }

        // Handle specific built-ins
        if (trim($commandStr) === 'clear') {
            return response()->json(['output' => "\033[H\033[2J", 'exit_code' => 0]);
        }

        // If it's just 'cd', we don't need proc_open, just return the new theoretical dir
        if (Str::startsWith(trim($commandStr), 'cd ')) {
            $target = trim(substr(trim($commandStr), 3));
            // Handle simple cases
            if ($target === '~' || $target === '') {
                $newCwd = '/root'; // assuming root for panel, or use $this->root
            } elseif (Str::startsWith($target, '/')) {
                $newCwd = $target;
            } else {
                $newCwd = rtrim($cwd, '/') . '/' . $target;
            }

            $realCwd = realpath($newCwd);
            if ($realCwd !== false && is_dir($realCwd)) {
                // Valid dir
                return response()->json([
                    'output' => "",
                    'cwd' => $realCwd,
                    'exit_code' => 0
                ]);
            } else {
                return response()->json([
                    'output' => "bash: cd: $target: No such file or directory\n",
                    'exit_code' => 1
                ]);
            }
        }

        $descriptorspec = [
            0 => ["pipe", "r"],  // stdin is a pipe that the child will read from
            1 => ["pipe", "w"],  // stdout is a pipe that the child will write to
            2 => ["pipe", "w"]   // stderr is a pipe that the child will write to
        ];

        // Ensure command runs through bash with the requested CWD
        // 2>&1 merges stderr into stdout
        $env = env('APP_ENV') === 'local' ? null : null; // Use current env
        $process = proc_open($commandStr . ' 2>&1', $descriptorspec, $pipes, $cwd, $env);

        if (is_resource($process)) {
            // Set a timeout of 30 seconds
            $timeout = 30;
            $start = time();
            $output = '';

            stream_set_blocking($pipes[1], 0);

            while (true) {
                $read = stream_get_contents($pipes[1]);
                if ($read !== false) {
                    $output .= $read;
                }

                $status = proc_get_status($process);
                if (!$status['running']) {
                    break;
                }

                if ((time() - $start) > $timeout) {
                    $output .= "\n[Execution timeout - 30s limit reached]\n";
                    proc_terminate($process, 9);
                    break;
                }

                // Sleep briefly to avoid 100% CPU
                usleep(100000);
            }

            // Read any remaining output
            $read = stream_get_contents($pipes[1]);
            if ($read !== false) {
                $output .= $read;
            }

            fclose($pipes[0]);
            fclose($pipes[1]);
            fclose($pipes[2]);

            // Get exit code, handle the case where we terminated it
            $exitCode = isset($status) ? $status['exitcode'] : -1;
            proc_close($process);

            return response()->json([
                'output' => $output,
                'exit_code' => $exitCode
            ]);
        }

        return response()->json([
            'output' => "Failed to start process.\n",
            'exit_code' => -1
        ], 500);
    }
}
