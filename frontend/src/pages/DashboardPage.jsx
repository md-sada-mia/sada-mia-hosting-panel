import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Server, Database, Layers, MemoryStick, Cpu } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/server/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to load server stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading server metrics...</div>;
  }

  const { ram, cpu, disk, pm2_procs, app_count, uptime } = stats || {};

  const diskPercent = disk ? Math.round((disk.used / disk.total) * 100) : 0;
  const diskTotalGb = disk ? Math.round(disk.total / 1024 / 1024 / 1024) : 0;
  const diskUsedGb = disk ? Math.round(disk.used / 1024 / 1024 / 1024) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Server overview and real-time metrics. Uptime: {uptime}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Memory */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ram?.percent}%</div>
            <p className="text-xs text-muted-foreground">
              {ram?.used_mb} MB / {ram?.total_mb} MB
            </p>
            <div className="w-full bg-secondary h-2 mt-3 rounded-full overflow-hidden">
              <div 
                className={`h-full ${ram?.percent > 85 ? 'bg-destructive' : 'bg-primary'}`} 
                style={{ width: `${ram?.percent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* CPU */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cpu?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Global CPU Load</p>
            <div className="w-full bg-secondary h-2 mt-3 rounded-full overflow-hidden">
              <div 
                className={`h-full ${cpu > 80 ? 'bg-destructive' : 'bg-primary'}`} 
                style={{ width: `${cpu}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Disk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Storage (/)</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diskPercent}%</div>
            <p className="text-xs text-muted-foreground">
              {diskUsedGb} GB / {diskTotalGb} GB
            </p>
            <div className="w-full bg-secondary h-2 mt-3 rounded-full overflow-hidden">
              <div 
                className={`h-full ${diskPercent > 90 ? 'bg-destructive' : 'bg-primary'}`} 
                style={{ width: `${diskPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Apps Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployed Apps</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{app_count}</div>
            <p className="text-xs text-muted-foreground">
              {pm2_procs} PM2 processes running
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
