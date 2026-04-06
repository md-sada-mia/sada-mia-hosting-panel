import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Activity, Terminal as TerminalIcon, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function Pm2ServicePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get('/server/service-detail', { params: { type: 'pm2_service' } });
      setData(data);
    } catch (err) {
      toast.error('Failed to load PM2 service status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">PM2 Host Service</h2>
          <p className="text-muted-foreground mt-1">Detailed status for the system-wide PM2 process manager.</p>
        </div>
        <Button onClick={fetchStatus} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              Service Status (systemctl)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-[#0c0c0c] text-amber-400 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-white/10 shadow-inner max-h-[400px] overflow-y-auto">
              {data?.status || 'No status information available.'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-500">
              <Activity className="h-4 w-4" />
              System Logs (Last 50 Lines)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-[#0c0c0c] text-amber-300/80 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-white/10 shadow-inner max-h-[500px] overflow-y-auto">
              {data?.logs || 'No log entries found.'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
