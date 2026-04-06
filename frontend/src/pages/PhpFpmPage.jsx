import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, Terminal as TerminalIcon, Database, Settings2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function PhpFpmPage() {
  const [data, setData] = useState(null);
  const [config, setConfig] = useState({
    memory_limit: '',
    upload_max_filesize: '',
    post_max_size: '',
    max_execution_time: '',
    max_input_time: '',
    display_errors: 'Off'
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        api.get('/server/service-detail', { params: { type: 'php' } }),
        api.get('/server/php-config')
      ]);
      setData(statusRes.data);
      setConfig(configRes.data);
    } catch (err) {
      toast.error('Failed to load PHP data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/server/php-config', config);
      toast.success('PHP configuration updated and service restarted');
      fetchData(); // Refresh to show new status/uptime
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
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
            <h2 className="text-3xl font-bold tracking-tight">PHP 8.4 FPM</h2>
            {data?.version && (
              <Badge variant="secondary" className="bg-sky-500/10 text-sky-500 border-sky-500/20">
                {data.version}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Status, logs, and configuration for the PHP-FPM service.</p>
        </div>
        <Button onClick={fetchData} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-sky-500/20 bg-sky-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TerminalIcon className="h-4 w-4 text-sky-400" />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-[#0c0c0c] text-sky-400/90 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-white/10 shadow-inner max-h-[400px] overflow-y-auto">
                {data?.status || 'No status information available.'}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-sky-400">
                <Database className="h-4 w-4" />
                Journal Logs (Last 50 Lines)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-[#0c0c0c] text-sky-300/80 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-white/10 shadow-inner max-h-[500px] overflow-y-auto">
                {data?.logs || 'No log entries found.'}
              </pre>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                PHP Configuration
              </CardTitle>
              <CardDescription>
                Manage common php.ini settings. Saving will restart the service.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveConfig}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="memory_limit">Memory Limit</Label>
                  <Input 
                    id="memory_limit" 
                    placeholder="e.g. 256M" 
                    value={config.memory_limit}
                    onChange={e => setConfig({...config, memory_limit: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload_max_filesize">Max Upload Size</Label>
                  <Input 
                    id="upload_max_filesize" 
                    placeholder="e.g. 128M" 
                    value={config.upload_max_filesize}
                    onChange={e => setConfig({...config, upload_max_filesize: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post_max_size">Post Max Size</Label>
                  <Input 
                    id="post_max_size" 
                    placeholder="e.g. 128M" 
                    value={config.post_max_size}
                    onChange={e => setConfig({...config, post_max_size: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_execution_time">Exec Time (s)</Label>
                    <Input 
                      id="max_execution_time" 
                      type="number"
                      value={config.max_execution_time}
                      onChange={e => setConfig({...config, max_execution_time: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_input_time">Input Time (s)</Label>
                    <Input 
                      id="max_input_time" 
                      type="number"
                      value={config.max_input_time}
                      onChange={e => setConfig({...config, max_input_time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5">
                    <Label>Display Errors</Label>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Show PHP errors in browser
                    </p>
                  </div>
                  <Switch 
                    checked={config.display_errors === 'On'}
                    onCheckedChange={checked => setConfig({...config, display_errors: checked ? 'On' : 'Off'})}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
