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
        $activePhp = $this->getActivePhpVersion();
        $cmd = match ($type) {
            'nginx' => 'sudo systemctl status nginx',
            'php' => "sudo systemctl status php{$activePhp}-fpm",
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
            'php' => "sudo journalctl -u php{$activePhp}-fpm -n 50 --no-pager",
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

    private function getActivePhpVersion(): string
    {
        $panelNginx = '/etc/nginx/sites-available/sada-mia-panel';
        if (!file_exists($panelNginx)) return '8.4';

        $content = @file_get_contents($panelNginx);
        if (preg_match('/php(\d+\.\d+)-fpm.sock/', $content, $matches)) {
            return $matches[1];
        }
        return '8.4';
    }

    public function getPhpConfig()
    {
        $version = $this->getActivePhpVersion();
        $iniPath = "/etc/php/{$version}/fpm/php.ini";
        if (!file_exists($iniPath)) {
            return response()->json(['error' => "php.ini not found for version {$version}"], 404);
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
        $confDResult = $this->shell->run("ls -1 /etc/php/{$version}/fpm/conf.d/");
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
        $extResult = $this->shell->run("php{$version} -m");
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
                    if (in_array($lowerLine, $enabledInConfD)) {
                        $extensions[] = $line;
                    }
                }
            }
        }

        if (in_array('opcache', $enabledInConfD)) {
            $extensions[] = 'Zend OPcache';
        }
        sort($extensions);

        return response()->json([
            'settings' => $settings,
            'extensions' => $extensions,
            'active_version' => $version
        ]);
    }

    public function getPhpModules()
    {
        $version = $this->getActivePhpVersion();
        $modsAvailableDir = "/etc/php/{$version}/mods-available/";
        $confDDir = "/etc/php/{$version}/fpm/conf.d/";

        $availableResult = $this->shell->run("ls -1 {$modsAvailableDir}");
        $enabledResult = $this->shell->run("ls -1 {$confDDir}");

        $availableFiles = $availableResult['exit_code'] === 0 ? explode("\n", trim($availableResult['output'])) : [];
        $enabledFiles = $enabledResult['exit_code'] === 0 ? explode("\n", trim($enabledResult['output'])) : [];

        // Clean available names (e.g. curl.ini -> curl)
        $availableModules = [];
        foreach ($availableFiles as $file) {
            $file = trim($file);
            if (empty($file)) continue;
            $name = str_replace('.ini', '', $file);
            $availableModules[$name] = false;
        }

        // Check which ones are enabled
        foreach ($enabledFiles as $file) {
            $file = trim($file);
            if (empty($file)) continue;
            $name = preg_replace('/^\d+-/', '', $file);
            $name = str_replace('.ini', '', $name);
            if (isset($availableModules[$name])) {
                $availableModules[$name] = true;
            }
        }

        $result = [];
        foreach ($availableModules as $name => $enabled) {
            $result[] = [
                'name' => $name,
                'enabled' => $enabled
            ];
        }

        // Sort by name
        usort($result, function($a, $b) {
            return strcmp($a['name'], $b['name']);
        });

        return response()->json($result);
    }

    public function togglePhpModule(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'module' => 'required|string',
            'enabled' => 'required|boolean'
        ]);

        $version = $this->getActivePhpVersion();
        $module = $validated['module'];
        $action = $validated['enabled'] ? 'phpenmod' : 'phpdismod';

        // Run the command
        $cmd = "sudo {$action} -v {$version} -s fpm {$module}";
        $result = $this->shell->run($cmd);

        if ($result['exit_code'] !== 0) {
            return response()->json(['message' => 'Failed to toggle module: ' . $result['output']], 500);
        }

        // Restart PHP-FPM
        $this->shell->run("sudo systemctl restart php{$version}-fpm");

        return response()->json(['message' => "Module {$module} " . ($validated['enabled'] ? 'enabled' : 'disabled') . " successfully."]);
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

        $version = $this->getActivePhpVersion();
        $iniPath = "/etc/php/{$version}/fpm/php.ini";
        
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
        $this->shell->run("sudo systemctl restart php{$version}-fpm");

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
                $activePhp = $this->getActivePhpVersion();
                $this->runAfterResponse("sudo systemctl restart php{$activePhp}-fpm");
                return response()->json([
                    'message' => "PHP-FPM ({$activePhp}) is restarting in the background.",
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

    public function getPhpVersions()
    {
        $active = $this->getActivePhpVersion();
        
        $installedResult = $this->shell->run("ls -1 /etc/php/");
        $installed = [];
        if ($installedResult['exit_code'] === 0) {
            $dirs = explode("\n", trim($installedResult['output']));
            foreach ($dirs as $dir) {
                $dir = trim($dir);
                if (preg_match('/^\d+\.\d+$/', $dir)) {
                    // Double check if fpm binary exists to avoid ghost directories
                    if (file_exists("/usr/sbin/php-fpm{$dir}")) {
                        $installed[] = $dir;
                    }
                }
            }
        }

        // Always include active version even if binary check fails (unlikely)
        if (!empty($active) && !in_array($active, $installed)) {
            $installed[] = $active;
        }

        sort($installed);

        return response()->json([
            'active' => $active,
            'installed' => $installed
        ]);
    }

    public function installPhpVersion(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'version' => 'required|string|regex:/^\d+\.\d+$/'
        ]);

        $version = $validated['version'];
        
        // Background command using nohup to prevent timeout
        $installCmd = "sudo apt-get update && sudo apt-get install -y php{$version}-fpm php{$version}-cli php{$version}-mysql php{$version}-curl php{$version}-gd php{$version}-mbstring php{$version}-xml php{$version}-zip php{$version}-bcmath php{$version}-intl";
        $cmd = "({$installCmd}) && echo 'PHP_OPERATION_SUCCESS' || echo 'PHP_OPERATION_FAILED'";
        $bgCmd = "nohup bash -c '{$cmd}' > /tmp/php_install_{$version}.log 2>&1 &";
        shell_exec($bgCmd);

        return response()->json(['message' => "Installation of PHP {$version} started in background. Logs: /tmp/php_install_{$version}.log"]);
    }

    public function activatePhpVersion(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'version' => 'required|string|regex:/^\d+\.\d+$/'
        ]);

        $version = $validated['version'];
        $panelNginx = '/etc/nginx/sites-available/sada-mia-panel';

        if (!file_exists($panelNginx)) {
            return response()->json(['message' => 'Panel Nginx config not found.'], 404);
        }

        // Rewrite Nginx config and reload
        $cmd = "sudo sed -i \"s/php[0-9.]\+-fpm.sock/php{$version}-fpm.sock/g\" {$panelNginx}";
        $this->shell->run($cmd);
        $this->shell->run("sudo nginx -t && sudo nginx -s reload");

        return response()->json(['message' => "PHP {$version} activated for panel successfully."]);
    }

    public function uninstallPhpVersion(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'version' => 'required|string|regex:/^\d+\.\d+$/'
        ]);

        $version = $validated['version'];
        $active = $this->getActivePhpVersion();

        if ($version === $active) {
            return response()->json(['message' => 'Cannot uninstall the currently active PHP version.'], 422);
        }

        // Purge the PHP version packages
        $uninstallCmd = "sudo apt-get purge -y php{$version}* && sudo apt-get autoremove -y && sudo rm -rf /etc/php/{$version}";
        $cmd = "({$uninstallCmd}) && echo 'PHP_OPERATION_SUCCESS' || echo 'PHP_OPERATION_FAILED'";
        $bgCmd = "nohup bash -c '{$cmd}' > /tmp/php_uninstall_{$version}.log 2>&1 &";
        shell_exec($bgCmd);

        return response()->json(['message' => "Uninstallation of PHP {$version} started in background. Logs: /tmp/php_uninstall_{$version}.log"]);
    }

    public function getPhpOperationLog(\Illuminate\Http\Request $request)
    {
        $validated = $request->validate([
            'type' => 'required|in:install,uninstall',
            'version' => 'required|string|regex:/^\d+\.\d+$/'
        ]);

        $type = $validated['type'];
        $version = $validated['version'];
        $logFile = "/tmp/php_{$type}_{$version}.log";

        if (!file_exists($logFile)) {
            return response()->json(['log' => 'Waiting for log file to be created...', 'exists' => false]);
        }

        $result = $this->shell->run("tail -n 200 {$logFile}");
        $output = $result['output'];
        
        return response()->json([
            'log' => $output,
            'exists' => true,
            'completed' => strpos($output, 'PHP_OPERATION_SUCCESS') !== false || strpos($output, 'PHP_OPERATION_FAILED') !== false,
            'status' => strpos($output, 'PHP_OPERATION_SUCCESS') !== false ? 'success' : (strpos($output, 'PHP_OPERATION_FAILED') !== false ? 'failed' : 'running')
        ]);
    }
}
