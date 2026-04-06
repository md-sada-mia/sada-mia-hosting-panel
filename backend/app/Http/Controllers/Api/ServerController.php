<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ShellService;
use Illuminate\Support\Facades\Log;

class ServerController extends Controller
{
    public function __construct(private ShellService $shell) {}

    public function serviceDetail(\Illuminate\Http\Request $request)
    {
        $type = $request->get('type');
        $cmd = match ($type) {
            'nginx' => 'sudo systemctl status nginx',
            'php' => 'sudo systemctl status php8.4-fpm',
            'pm2' => 'pm2 status',
            'pm2_service' => 'sudo systemctl status pm2-root.service',
            'queue' => 'sudo systemctl status sada-mia-queue.service',
            default => null,
        };

        if (!$cmd) {
            return response()->json(['error' => 'Invalid service type'], 400);
        }

        $statusResult = $this->shell->run($cmd);
        
        // Get Version
        $versionCmd = match ($type) {
            'nginx' => 'nginx -v 2>&1',
            'php' => 'php -v | head -n 1',
            'pm2', 'pm2_service' => 'pm2 -v',
            default => '',
        };
        $versionResult = $versionCmd ? $this->shell->run($versionCmd) : ['output' => ''];

        // Get logs
        $logCmd = match ($type) {
            'nginx' => 'sudo tail -n 50 /var/log/nginx/error.log',
            'php' => 'sudo journalctl -u php8.4-fpm -n 50 --no-pager',
            'pm2' => 'pm2 logs --lines 50 --no-colors --nostream',
            'pm2_service' => 'sudo journalctl -u pm2-root.service -n 50 --no-pager',
            'queue' => 'sudo journalctl -u sada-mia-queue.service -n 50 --no-pager',
            default => '',
        };

        $logsResult = $logCmd ? $this->shell->run($logCmd) : ['output' => ''];

        return response()->json([
            'service' => $type,
            'version' => trim($versionResult['output'] ?? ''),
            'status'  => $statusResult['output'],
            'logs'    => $logsResult['output'],
            'exit_code' => $statusResult['exit_code']
        ]);
    }

    public function getPhpConfig()
    {
        $iniPath = '/etc/php/8.4/fpm/php.ini';
        if (!file_exists($iniPath)) {
            return response()->json(['error' => 'php.ini not found'], 404);
        }

        $content = file_get_contents($iniPath);
        
        $settings = [
            'memory_limit' => $this->getIniValue($content, 'memory_limit'),
            'upload_max_filesize' => $this->getIniValue($content, 'upload_max_filesize'),
            'post_max_size' => $this->getIniValue($content, 'post_max_size'),
            'max_execution_time' => $this->getIniValue($content, 'max_execution_time'),
            'max_input_time' => $this->getIniValue($content, 'max_input_time'),
            'display_errors' => $this->getIniValue($content, 'display_errors'),
        ];

        // Get Enabled PHP Extensions from conf.d
        $confDResult = $this->shell->run("ls -1 /etc/php/8.4/fpm/conf.d/");
        $enabledInConfD = [];
        if ($confDResult['exit_code'] === 0) {
            $files = explode("\n", $confDResult['output']);
            foreach ($files as $file) {
                $file = trim($file);
                if (empty($file)) continue;
                
                // Extract extension name (e.g., 20-curl.ini -> curl)
                $name = preg_replace('/^\d+-/', '', $file);
                $name = str_replace('.ini', '', $name);
                $enabledInConfD[] = strtolower($name);
            }
        }

        // Get all loaded PHP Modules
        $extResult = $this->shell->run("php -m");
        $extensions = [];
        if ($extResult['exit_code'] === 0) {
            $lines = explode("\n", $extResult['output']);
            $isModuleSection = false;
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '[PHP Modules]') {
                    $isModuleSection = true;
                    continue;
                }
                if ($line === '[Zend Modules]') {
                    $isModuleSection = false;
                    break;
                }
                if ($isModuleSection && !empty($line)) {
                    $lowerLine = strtolower($line);
                    // Only include if found in conf.d (handles modular ones)
                    // Or if it's a known non-core but compiled-in module if necessary
                    // But usually, common ones like mysqli, pdo, etc are in conf.d
                    if (in_array($lowerLine, $enabledInConfD)) {
                        $extensions[] = $line;
                    }
                }
            }
        }

        // Add Zend OPcache separately if enabled in conf.d
        if (in_array('opcache', $enabledInConfD)) {
            $extensions[] = 'Zend OPcache';
        }

        // Sort for cleaner UI
        sort($extensions);

        return response()->json([
            'settings' => $settings,
            'extensions' => $extensions
        ]);
    }

    private function getIniValue(string $content, string $key): string
    {
        preg_match("/^{$key}\s*=\s*(.*)$/m", $content, $matches);
        return trim($matches[1] ?? '');
    }

    public function updatePhpConfig(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'memory_limit' => 'required|string',
            'upload_max_filesize' => 'required|string',
            'post_max_size' => 'required|string',
            'max_execution_time' => 'required|numeric',
            'max_input_time' => 'required|numeric',
            'display_errors' => 'required|string|in:On,Off',
        ]);

        $iniPath = '/etc/php/8.4/fpm/php.ini';
        
        foreach ($validated as $key => $value) {
            $escapedValue = escapeshellarg($value);
            // Replace key = anything with key = value
            $cmd = "sudo sed -i \"s/^{$key}\s*=.*/{$key} = {$value}/\" {$iniPath}"; 
            // We use the value directly in the sed command, so we must be careful. 
            // Better to escape the value for sed.
            $sedValue = str_replace('/', '\/', $value);
            $cmd = "sudo sed -i \"s/^{$key}\s*=.*/{$key} = {$sedValue}/\" {$iniPath}";
            $this->shell->run($cmd);
        }

        // Restart PHP-FPM
        $this->shell->run("sudo systemctl restart php8.4-fpm");

        return response()->json(['message' => 'PHP Configuration updated successfully.']);
    }

    public function stats()
    {
        // RAM usage
        $memInfo = @file_get_contents('/proc/meminfo');
        $ram = $this->parseMemInfo($memInfo);

        // CPU usage (1-second sample)
        $cpu = $this->getCpuUsage();

        // Disk usage for /
        $disk = [
            'total' => disk_total_space('/'),
            'free'  => disk_free_space('/'),
            'used'  => disk_total_space('/') - disk_free_space('/'),
        ];

        // PM2 process count
        $pm2Result = $this->shell->run("pm2 jlist");
        $pm2Count  = 0;
        if ($pm2Result['exit_code'] === 0) {
            $procs = json_decode($pm2Result['output'], true) ?? [];
            $pm2Count = count($procs);
        }

        // App count from DB
        $appCount = \App\Models\App::count();

        return response()->json([
            'ram'       => $ram,
            'cpu'       => $cpu,
            'disk'      => $disk,
            'pm2_procs' => $pm2Count,
            'app_count' => $appCount,
            'uptime'    => $this->getUptime(),
        ]);
    }

    private function parseMemInfo(string $memInfo): array
    {
        preg_match('/MemTotal:\s+(\d+)/', $memInfo, $total);
        preg_match('/MemAvailable:\s+(\d+)/', $memInfo, $available);

        $totalKb     = (int)($total[1] ?? 0);
        $availableKb = (int)($available[1] ?? 0);
        $usedKb      = $totalKb - $availableKb;

        return [
            'total_mb' => round($totalKb / 1024, 1),
            'used_mb'  => round($usedKb / 1024, 1),
            'free_mb'  => round($availableKb / 1024, 1),
            'percent'  => $totalKb > 0 ? round($usedKb / $totalKb * 100, 1) : 0,
        ];
    }

    private function getCpuUsage(): float
    {
        $result = $this->shell->run("top -b -n1 | grep '%Cpu' | awk '{print $2}'");
        return (float)trim($result['output'] ?? '0');
    }

    private function getUptime(): string
    {
        $result = $this->shell->run("uptime -p");
        return trim($result['output'] ?? 'unknown');
    }

    public function restart(\Illuminate\Http\Request $request)
    {
        $type = $request->input('type');

        switch ($type) {
            case 'nginx':
                // Respond BEFORE restarting — nginx restart kills the connection,
                // so we schedule the command to run in the background after a short
                // delay, giving the HTTP response time to reach the browser first.
                $this->runAfterResponse("sudo systemctl restart nginx");
                return response()->json([
                    'message' => 'Nginx is restarting in the background.',
                    'status'  => 'success'
                ]);

            case 'php':
                $this->runAfterResponse("sudo systemctl restart php8.4-fpm");
                return response()->json([
                    'message' => 'PHP-FPM is restarting in the background.',
                    'status'  => 'success'
                ]);

            case 'pm2':
                $this->runAfterResponse("sudo /usr/bin/pm2 restart all");
                return response()->json([
                    'message' => 'All PM2 apps are restarting in the background.',
                    'status'  => 'success'
                ]);

            case 'pm2_service':
                $this->runAfterResponse("sudo /usr/bin/systemctl restart pm2-root.service");
                return response()->json([
                    'message' => 'PM2 service is restarting in the background.',
                    'status'  => 'success'
                ]);

            case 'queue':
                $this->runAfterResponse("sudo /usr/bin/systemctl restart sada-mia-queue.service");
                return response()->json([
                    'message' => 'Queue worker is restarting in the background.',
                    'status'  => 'success'
                ]);

            case 'reboot':
                $this->shell->run("sudo shutdown -r +1");
                return response()->json([
                    'message' => 'System reboot scheduled in 1 minute.',
                    'status'  => 'success'
                ]);

            default:
                return response()->json(['error' => 'Invalid restart type'], 400);
        }
    }

    /**
     * Schedule a shell command to run in the background after a short delay.
     * This allows the HTTP response to be fully sent before a service restart
     * drops the connection.
     */
    private function runAfterResponse(string $command): void
    {
        // Dispatch the command to run 2 seconds after this request finishes.
        // The `nohup ... &` detaches it from the PHP process entirely.
        $escaped = escapeshellarg($command);
        $bgCmd   = "nohup bash -c 'sleep 2 && {$command}' > /dev/null 2>&1 &";
        shell_exec($bgCmd);
    }
}
