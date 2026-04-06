import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Layers, Terminal as TerminalIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function NginxPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get('/server/service-detail', { params: { type: 'nginx' } });
      setData(data);
    } catch (err) {
      toast.error('Failed to load Nginx status');
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
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">Nginx Web Server</h2>
            {data?.version && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                {data.version}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Detailed status and error logs for Nginx.</p>
        </div>
        <Button onClick={fetchStatus} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TerminalIcon className="h-4 w-4 text-primary" />
              Service Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-[#0c0c0c] text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-white/10 shadow-inner max-h-[400px] overflow-y-auto">
              {data?.status || 'No status information available.'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-rose-400">
              <AlertCircle className="h-4 w-4" />
              Error Logs (Last 50 Lines)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-[#0c0c0c] text-rose-400/90 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-white/10 shadow-inner max-h-[500px] overflow-y-auto">
              {data?.logs || 'No log entries found.'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
