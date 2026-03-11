import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Square, RotateCcw, Rocket, Trash2, Github, ExternalLink, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AppDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [logs, setLogs] = useState('');
  const [envVars, setEnvVars] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const logEndRef = useRef(null);

  const fetchApp = async () => {
    try {
      const { data } = await api.get(`/apps/${id}`);
      setApp(data);
    } catch (err) {
      if (err.response?.status === 404) navigate('/apps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApp();
    loadDeployments();
    const interval = setInterval(() => {
      // Refresh app data and deployments during deployment
      if (app?.status === 'deploying') {
        fetchApp();
        loadDeployments();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, app?.status]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [deployments]);

  const handleAction = async (action) => {
    if (!confirm(`Are you sure you want to ${action} this app?`)) return;
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await api.delete(`/apps/${id}`);
        navigate('/apps');
        return;
      }
      await api.post(`/apps/${id}/${action}`);
      if (action === 'deploy') {
        // Switch to deployments tab visually if we wanted, or just refresh
      }
      fetchApp();
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutoDeploy = async () => {
    setActionLoading(true);
    try {
      const { data } = await api.post(`/apps/${id}/toggle-auto-deploy`);
      setApp(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle auto-deploy');
    } finally {
      setActionLoading(false);
    }
  };

  const loadDeployments = async () => {
    const { data } = await api.get(`/apps/${id}/deployments`);
    setDeployments(data);
  };

  const loadLogs = async () => {
    const { data } = await api.get(`/apps/${id}/logs`);
    setLogs(data.logs);
  };

  const loadEnv = async () => {
    const { data } = await api.get(`/apps/${id}/env`);
    // Convert array to .env string format for easy editing
    const envString = data.map(env => `${env.key}=${env.value}`).join('\n');
    setEnvVars(envString);
  };

  const saveEnv = async () => {
    setActionLoading(true);
    try {
      // Parse string back to array
      const variables = envVars.split('\n')
        .filter(line => line.trim() && line.includes('='))
        .map(line => {
          const [key, ...val] = line.split('=');
          return { key: key.trim(), value: val.join('=').trim() };
        });
      
      await api.put(`/apps/${id}/env`, { variables });
      alert('Environment variables saved successfully.');
    } catch (err) {
      alert('Failed to save environment variables.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div>Loading app details...</div>;
  if (!app) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{app.name}</h2>
            <Badge variant={
              app.status === 'running' ? 'success' : 
              app.status === 'deploying' ? 'warning' : 'secondary'
            }>
              {app.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <span className="capitalize border-r border-border pr-2">{app.type}</span>
            <a href={`http://${app.domain}`} target="_blank" rel="noreferrer" className="flex items-center hover:text-primary">
              {app.domain} <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {app.type === 'nextjs' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleAction('start')} disabled={actionLoading || app.status === 'running'}>
                <Play className="mr-2 h-4 w-4" /> Start
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAction('stop')} disabled={actionLoading || app.status === 'stopped'}>
                <Square className="mr-2 h-4 w-4" /> Stop
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAction('restart')} disabled={actionLoading}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => handleAction('deploy')} disabled={actionLoading || app.status === 'deploying'}>
            <Rocket className={`mr-2 h-4 w-4 ${app.status === 'deploying' ? 'animate-bounce' : ''}`} /> 
            {app.status === 'deploying' ? 'Deploying...' : 'Deploy'}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleAction('delete')} disabled={actionLoading}>
             <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="deployments" onValueChange={(v) => {
        if (v === 'deployments') loadDeployments();
        if (v === 'overview') fetchApp();
        if (v === 'logs') loadLogs();
        if (v === 'env') loadEnv();
      }}>
        <TabsList className="grid w-full grid-cols-4 md:w-auto">
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="env">Environment</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Repository Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Git URL</span>
                  <div className="flex items-center gap-2 font-mono bg-muted/50 p-2 rounded">
                    <Github className="h-4 w-4" /> {app.git_url}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Branch</span>
                  <div className="font-mono bg-muted/50 p-2 rounded">{app.branch}</div>
                </div>
                {app.github_full_name && (
                  <div className="col-span-2 p-4 border rounded-md bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-background rounded-full border">
                        <Github className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">GitHub Repository</p>
                        <p className="text-xs text-muted-foreground">{app.github_full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-medium text-muted-foreground mr-2">
                        {app.auto_deploy ? 'Auto-deploy active' : 'Auto-deploy disabled'}
                      </span>
                      <Button 
                        size="sm" 
                        variant={app.auto_deploy ? "outline" : "default"}
                        onClick={handleToggleAutoDeploy}
                        disabled={actionLoading}
                      >
                        {app.auto_deploy ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground block mb-1">Deploy Path</span>
                  <div className="font-mono bg-muted/50 p-2 rounded text-xs">{app.deploy_path || 'Not deployed yet'}</div>
                </div>
                {app.type === 'nextjs' && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Internal Port</span>
                    <div className="font-mono bg-muted/50 p-2 rounded">{app.port || 'Will be assigned on deploy'}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Deployment History</CardTitle>
                <CardDescription>View recent deployment logs and statuses</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={loadDeployments}><RefreshCw className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No deployments found.</div>
              ) : (
                <div className="space-y-4">
                  {deployments.map(dep => (
                    <div key={dep.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={dep.status === 'success' ? 'success' : dep.status === 'failed' ? 'destructive' : 'warning'}>
                            {dep.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(dep.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="bg-black text-green-400 p-4 rounded-md font-mono text-xs overflow-y-auto max-h-64 whitespace-pre-wrap">
                        {dep.log_output || 'No output recorded'}
                        <div ref={logEndRef} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="env" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>Standard .env file format (KEY=VALUE). Injected during deployment.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea 
                value={envVars}
                onChange={(e) => setEnvVars(e.target.value)}
                className="w-full h-64 font-mono text-sm p-4 rounded-md border bg-muted/50 focus:ring-2 focus:ring-primary outline-none"
                placeholder="APP_ENV=production&#10;API_KEY=your-secret"
              />
              <div className="mt-4 flex justify-end">
                <Button onClick={saveEnv} disabled={actionLoading}>Save .env Config</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
             <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Application Logs</CardTitle>
              <Button size="sm" variant="ghost" onClick={loadLogs}><RefreshCw className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-gray-300 p-4 rounded-md font-mono text-xs overflow-y-auto h-96 whitespace-pre-wrap">
                {logs || 'No logs available.'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
