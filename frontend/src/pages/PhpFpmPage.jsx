import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Terminal as TerminalIcon, Database, Settings2, Save, Search, Puzzle, Activity, ToggleLeft, Cpu, HardDrive, Clock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function PhpFpmPage() {
  const [data, setData] = useState(null);
  const [extensions, setExtensions] = useState([]);
  const [modules, setModules] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
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
  const [toggling, setToggling] = useState(null);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [statusRes, configRes, modulesRes] = await Promise.all([
        api.get('/server/service-detail', { params: { type: 'php' } }),
        api.get('/server/php-config'),
        api.get('/server/php-modules')
      ]);
      setData(statusRes.data);
      setConfig(configRes.data.settings);
      setExtensions(configRes.data.extensions || []);
      setModules(modulesRes.data);
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
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleModule = async (moduleName, currentStatus) => {
    setToggling(moduleName);
    try {
      await api.post('/server/php-modules/toggle', {
        module: moduleName,
        enabled: !currentStatus
      });
      toast.success(`Module ${moduleName} ${!currentStatus ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle module');
    } finally {
      setToggling(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredExtensions = extensions.filter(ext => 
    ext.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredModules = modules.filter(mod => 
    mod.name.toLowerCase().includes(moduleSearchQuery.toLowerCase())
  );

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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-background/50 border border-white/5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <ToggleLeft className="h-4 w-4" />
            Module Toggles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
              <Card className="border-white/5 bg-white/[0.02]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                    <Settings2 className="h-4 w-4" />
                    Active Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Cpu className="h-3.5 w-3.5" />
                      Memory Limit
                    </div>
                    <span className="font-mono text-xs">{config.memory_limit}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <HardDrive className="h-3.5 w-3.5" />
                      Post / Upload Max
                    </div>
                    <span className="font-mono text-xs">{config.post_max_size} / {config.upload_max_filesize}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Exec / Input Time
                    </div>
                    <span className="font-mono text-xs">{config.max_execution_time}s / {config.max_input_time}s</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Display Errors
                    </div>
                    <Badge variant={config.display_errors === 'On' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-4">
                      {config.display_errors}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-sky-400">
                    <Puzzle className="h-4 w-4" />
                    Active Extensions ({extensions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Search active extensions..." 
                      className="pl-8 h-8 text-xs bg-[#0c0c0c]/50" 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-[400px] overflow-y-auto p-1 custom-scrollbar">
                    {filteredExtensions.length > 0 ? (
                      filteredExtensions.map(ext => (
                        <Badge key={ext} variant="secondary" className="font-mono text-[10px] px-1.5 py-0 bg-white/5 hover:bg-white/10 border-white/5">
                          {ext}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 w-full text-center">No matches found</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="config">
          <div className="max-w-2xl mx-auto">
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  PHP Global Settings
                </CardTitle>
                <CardDescription>
                  Manage common php.ini settings. Saving will restart the service.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSaveConfig}>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
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
                      <Label htmlFor="post_max_size">Post Max Size</Label>
                      <Input 
                        id="post_max_size" 
                        placeholder="e.g. 128M" 
                        value={config.post_max_size}
                        onChange={e => setConfig({...config, post_max_size: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
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
                      <Label>Display Errors</Label>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch 
                          checked={config.display_errors === 'On'}
                          onCheckedChange={checked => setConfig({...config, display_errors: checked ? 'On' : 'Off'})}
                        />
                        <span className="text-xs text-muted-foreground">{config.display_errors}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="max_execution_time">Max Exec Time (s)</Label>
                      <Input 
                        id="max_execution_time" 
                        type="number"
                        value={config.max_execution_time}
                        onChange={e => setConfig({...config, max_execution_time: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_input_time">Max Input Time (s)</Label>
                      <Input 
                        id="max_input_time" 
                        type="number"
                        value={config.max_input_time}
                        onChange={e => setConfig({...config, max_input_time: e.target.value})}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t border-white/5 pt-6 bg-white/[0.02]">
                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Apply Changes
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="modules">
          <Card className="border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Puzzle className="h-5 w-5 text-sky-400" />
                  Extensions Management
                </CardTitle>
                <CardDescription>
                  Enable or disable modular PHP extensions. Changes restart PHP-FPM.
                </CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search available modules..." 
                  className="pl-8" 
                  value={moduleSearchQuery}
                  onChange={e => setModuleSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredModules.map(mod => (
                  <div key={mod.name} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium font-mono">{mod.name}</span>
                      <span className={`text-[10px] ${mod.enabled ? 'text-green-500' : 'text-zinc-500'}`}>
                        {mod.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <Switch 
                      checked={mod.enabled}
                      disabled={toggling === mod.name}
                      onCheckedChange={() => handleToggleModule(mod.name, mod.enabled)}
                    />
                  </div>
                ))}
                {filteredModules.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No modules found matching "{moduleSearchQuery}"
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
