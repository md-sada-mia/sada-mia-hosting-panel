<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ShellService;

class ServerController extends Controller
{
    public function __construct(private ShellService $shell) {}

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
                $result = $this->shell->run("sudo systemctl restart nginx");
                break;
            case 'php':
                $result = $this->shell->run("sudo systemctl restart php8.4-fpm");
                break;
            case 'pm2':
                $result = $this->shell->run("pm2 restart all");
                break;
            case 'reboot':
                $result = $this->shell->run("sudo shutdown -r +1");
                return response()->json([
                    'message' => 'System reboot scheduled in 1 minute.',
                    'status'  => 'success'
                ]);
            default:
                return response()->json(['error' => 'Invalid restart type'], 400);
        }

        if ($result['exit_code'] === 0) {
            return response()->json([
                'message' => ucfirst($type) . ' restarted successfully.',
                'status'  => 'success'
            ]);
        }

        return response()->json([
            'error'   => 'Failed to restart ' . $type,
            'details' => $result['output'],
            'status'  => 'error'
        ], 500);
    }
}
