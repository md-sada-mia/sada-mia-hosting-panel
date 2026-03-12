import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import {
  Play, Square, RotateCcw, Rocket, Trash2, Github, ExternalLink,
  RefreshCw, Globe, Plus, Server, Copy, Check, Database, Network,
  AlertTriangle, Shield, Loader2, FolderOpen, ChevronRight, Clock
} from 'lucide-react';

const stripAnsi = (str) => {
  if (!str) return '';
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

const recordTypeColor = {
  A: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  AAAA: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  CNAME: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  MX: 'bg-green-500/15 text-green-400 border-green-500/20',
  TXT: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  NS: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  SRV: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  CAA: 'bg-red-500/15 text-red-400 border-red-500/20',
};

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle} className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-white">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function NavCard({ icon: Icon, title, description, onClick, color = "primary" }) {
  const colorMap = {
    primary: "bg-primary/20 text-primary border-primary/20 hover:border-primary/50",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/20 hover:border-blue-500/50",
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/50",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/20 hover:border-purple-500/50",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/20 hover:border-amber-500/50",
  };

  return (
    <div 
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-card/40 p-4 transition-all hover:bg-accent/40 cursor-pointer ${colorMap[color] || colorMap.primary}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${colorMap[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">{title}</h3>
          <p className="text-[11px] text-muted-foreground truncate">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      {/* Subtle Glow Background */}
      <div className="absolute -right-4 -top-4 h-16 w-16 bg-primary/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export default function AppDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [logs, setLogs] = useState('');
  const [envVars, setEnvVars] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // DNS state
  const [domainData, setDomainData] = useState(null);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordForm, setRecordForm] = useState({ type: 'A', name: '@', value: '', ttl: 3600, priority: '' });
  const [addingRecord, setAddingRecord] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingAction, setPendingAction] = useState(null);

  const logEndRef = useRef(null);
  const deploymentsTopRef = useRef(null);

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

  const [settingUpDefaults, setSettingUpDefaults] = useState(false);

  const fetchDomain = async () => {
    setDnsLoading(true);
    try {
      const { data } = await api.get(`/apps/${id}/domain`);
      setDomainData(data);
    } catch { /* domain may not exist yet */ }
    finally { setDnsLoading(false); }
  };

  const handleSetupDefaults = async () => {
    setSettingUpDefaults(true);
    try {
      const { data } = await api.post(`/apps/${id}/domain/setup-defaults`);
      setDomainData(data);
      fetchApp();
      toast.success('Default DNS records created!');
    } catch {
      toast.error('Failed to set up default records');
    } finally {
      setSettingUpDefaults(false);
    }
  };

  useEffect(() => {
    fetchApp();
    loadDeployments();
    const interval = setInterval(() => {
      if (app?.status === 'deploying') {
        fetchApp();
        loadDeployments();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, app?.status]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [deployments]);

  useEffect(() => {
    if (activeTab === 'deployments' && deploymentsTopRef.current) {
      deploymentsTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeTab]);

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await api.delete(`/apps/${id}`);
        navigate('/apps');
        return;
      }
      await api.post(`/apps/${id}/${action}`);
      if (action === 'deploy') {
        setActiveTab('deployments');
        loadDeployments();
      }
      fetchApp();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = (action) => {
    setPendingAction(action);
  };

  const handleToggleAutoDeploy = async () => {
    setActionLoading(true);
    try {
      const { data } = await api.post(`/apps/${id}/toggle-auto-deploy`);
      setApp(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle auto-deploy');
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
    const envString = data.map(env => `${env.key}=${env.value}`).join('\n');
    setEnvVars(envString);
  };

  const saveEnv = async () => {
    setActionLoading(true);
    try {
      const variables = envVars.split('\n')
        .filter(line => line.trim() && line.includes('='))
        .map(line => {
          const [key, ...val] = line.split('=');
          return { key: key.trim(), value: val.join('=').trim() };
        });
      await api.put(`/apps/${id}/env`, { variables });
      toast.success('Environment variables saved!');
    } catch (err) {
      toast.error('Failed to save environment variables.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    setAddingRecord(true);
    try {
      await api.post(`/apps/${id}/domain/records`, recordForm);
      toast.success('DNS record added!');
      setRecordForm({ type: 'A', name: '@', value: '', ttl: 3600, priority: '' });
      setShowAddRecord(false);
      fetchDomain();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add record');
    } finally {
      setAddingRecord(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    setDeletingRecord(recordId);
    try {
      await api.delete(`/apps/${id}/domain/records/${recordId}`);
      toast.success('Record deleted');
      fetchDomain();
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeletingRecord(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(`/apps/${id}/domain/sync`);
      toast.success('DNS zone synced with BIND9!');
      fetchDomain();
    } catch {
      toast.error('Failed to sync DNS zone');
    } finally {
      setSyncing(false);
    }
  };

  const handleManageDatabase = async (dbId) => {
    try {
      const { data } = await api.get(`/databases/${dbId}/credentials`);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/adminer/';
      form.target = '_blank';
      const fields = {
        'auth[driver]': 'pgsql',
        'auth[server]': '127.0.0.1',
        'auth[username]': data.db_user,
        'auth[password]': data.db_password,
        'auth[db]': data.db_name,
      };
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (err) {
      toast.error('Failed to retrieve credentials for autologin');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!app) return null;

  const statusColor = app.status === 'running' ? 'bg-emerald-500' : app.status === 'deploying' ? 'bg-amber-500 animate-pulse' : app.status === 'error' ? 'bg-red-500' : 'bg-slate-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{app.name}</h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              app.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              app.status === 'deploying' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              app.status === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              'bg-slate-500/10 text-slate-400 border-slate-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
              {app.status}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <span className="capitalize border-r border-border pr-2">{app.type}</span>
            <a href={`http://${app.domain}`} target="_blank" rel="noreferrer" className="flex items-center hover:text-primary transition-colors">
              <Globe className="h-3.5 w-3.5 mr-1" />
              {app.domain}
              <ExternalLink className="ml-1 h-3 w-3" />
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
            <Button size="sm" variant="outline" onClick={() => navigate(`/files?path=/${app.domain}`)}>
              <FolderOpen className="mr-2 h-4 w-4" /> File Manager
            </Button>
            <Button
            size="sm"
            variant={app.status === 'error' ? 'destructive' : 'default'}
            onClick={() => handleAction('deploy')}
            disabled={actionLoading || app.status === 'deploying'}
          >
            {app.status === 'deploying'
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Rocket className="mr-2 h-4 w-4" />
            }
            {app.status === 'deploying' ? 'Deploying...' : app.status === 'error' ? 'Retry Deploy' : 'Deploy'}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleAction('delete')} disabled={actionLoading}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (v === 'deployments') loadDeployments();
        if (v === 'overview') fetchApp();
        if (v === 'logs') loadLogs();
        if (v === 'env') loadEnv();
        if (v === 'dns') fetchDomain();
      }}>
        <TabsList className="grid w-full grid-cols-5 md:w-auto md:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="env">Environment</TabsTrigger>
          <TabsTrigger value="dns" className="flex items-center gap-1.5">
            <Network className="h-3.5 w-3.5" /> DNS
          </TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────── */}
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
                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
                  <NavCard 
                    icon={FolderOpen}
                    title="File Manager"
                    description="Browse app files"
                    onClick={() => navigate(`/files?path=/${app.domain}`)}
                  />
                  
                  {app.databases?.length > 0 && (
                    <div className="sm:col-span-1 flex items-center justify-between p-4 rounded-xl border bg-card/40 hover:bg-accent/40 transition-all border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-500/20 p-2.5 rounded-xl text-blue-400">
                          <Database className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm truncate">{app.databases[0].db_name}</h4>
                          <div className="text-[11px] text-muted-foreground truncate">
                            User: <span className="font-mono">{app.databases[0].db_user}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={app.databases[0].status === 'active' ? 'success' : 'destructive'} className="text-[10px] h-5">
                          {app.databases[0].status}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-[11px] gap-1.5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => handleManageDatabase(app.databases[0].id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Manage
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Deployments ──────────────────────────────────────── */}
        <TabsContent value="deployments" className="mt-6">
          <div ref={deploymentsTopRef} />
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
                  {deployments.map((dep, idx) => (
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
                        {stripAnsi(dep.log_output) || 'No output recorded'}
                        <div ref={idx === 0 ? logEndRef : null} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Environment ──────────────────────────────────────── */}
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
                placeholder={`APP_ENV=production\nAPI_KEY=your-secret`}
              />
              <div className="mt-4 flex justify-end">
                <Button onClick={saveEnv} disabled={actionLoading}>Save .env Config</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── DNS Management ───────────────────────────────────── */}
        <TabsContent value="dns" className="mt-6 space-y-4">
          {(() => {
            const effectiveDomain = domainData ?? app.domain_record;
            if (dnsLoading) return (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            );
            if (!effectiveDomain) return (
              <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
                <CardContent className="flex items-start gap-4 py-6">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-400 text-sm">No Domain Linked</p>
                    <p className="text-xs text-muted-foreground mt-1">This app doesn't have a domain record yet. It should have been created automatically — try refreshing.</p>
                    <Button size="sm" className="mt-3" variant="outline" onClick={fetchDomain}>
                      <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
            return (
              <>
                {/* Domain Info Card */}
                <Card className="border-white/10 bg-white/[0.02]">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-base">{effectiveDomain.domain}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${effectiveDomain.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {effectiveDomain.status}
                          </span>
                          {effectiveDomain.dns_managed && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                              <Shield className="h-2.5 w-2.5" /> BIND9 Managed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="shrink-0">
                      {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                      Sync Zone
                    </Button>
                  </div>

                  {/* Nameservers */}
                  {(effectiveDomain.nameserver_1 || effectiveDomain.nameserver_2) && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Point Your Domain to These Nameservers</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].filter(n => effectiveDomain[`nameserver_${n}`]).map(n => (
                          <div key={n} className="flex items-center justify-between bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2">
                            <span className="text-xs text-muted-foreground mr-2">NS{n}</span>
                            <code className="text-xs font-mono text-white flex-1">{effectiveDomain[`nameserver_${n}`]}</code>
                            <CopyBtn value={effectiveDomain[`nameserver_${n}`]} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* DNS Records */}
              <Card className="border-white/10 bg-white/[0.02]">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" /> DNS Records
                    </CardTitle>
                    <CardDescription>{(effectiveDomain.dns_records || effectiveDomain.dnsRecords)?.length || 0} records</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddRecord(v => !v)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Record
                  </Button>
                </CardHeader>

                {showAddRecord && (
                  <div className="mx-6 mb-4 p-4 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <form onSubmit={handleAddRecord}>
                      <p className="text-sm font-semibold mb-3">New DNS Record</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">Type</label>
                          <select
                            value={recordForm.type}
                            onChange={e => setRecordForm(f => ({ ...f, type: e.target.value }))}
                            className="w-full h-9 text-sm rounded-md border border-white/10 bg-white/5 px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">Name</label>
                          <Input
                            value={recordForm.name}
                            onChange={e => setRecordForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="@ or subdomain"
                            className="h-9 text-sm bg-white/5 border-white/10"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-muted-foreground mb-1 block">Value</label>
                          <Input
                            value={recordForm.value}
                            onChange={e => setRecordForm(f => ({ ...f, value: e.target.value }))}
                            placeholder="IP, hostname, or text..."
                            className="h-9 text-sm bg-white/5 border-white/10"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">TTL (seconds)</label>
                          <Input
                            type="number"
                            value={recordForm.ttl}
                            onChange={e => setRecordForm(f => ({ ...f, ttl: parseInt(e.target.value) }))}
                            placeholder="3600"
                            className="h-9 text-sm bg-white/5 border-white/10"
                          />
                        </div>
                        {(recordForm.type === 'MX' || recordForm.type === 'SRV') && (
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Priority</label>
                            <Input
                              type="number"
                              value={recordForm.priority}
                              onChange={e => setRecordForm(f => ({ ...f, priority: e.target.value }))}
                              placeholder="10"
                              className="h-9 text-sm bg-white/5 border-white/10"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4 justify-end">
                        <Button size="sm" type="button" variant="ghost" onClick={() => setShowAddRecord(false)}>Cancel</Button>
                        <Button size="sm" type="submit" disabled={addingRecord}>
                          {addingRecord ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                          Add Record
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                <CardContent className="px-0 pb-0">
                  {(!(effectiveDomain.dns_records || effectiveDomain.dnsRecords) || (effectiveDomain.dns_records || effectiveDomain.dnsRecords).length === 0) ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Server className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium mb-1">No DNS records yet</p>
                      <p className="text-xs mb-4">Auto-create the essential records (A, CNAME, MX, SPF) for this domain</p>
                      <Button size="sm" onClick={handleSetupDefaults} disabled={settingUpDefaults} className="gap-1.5">
                        {settingUpDefaults ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Setup Default Records
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {/* Header */}
                      <div className="grid grid-cols-[80px_1fr_1fr_80px_40px] gap-3 px-6 py-2">
                        {['Type', 'Name', 'Value', 'TTL', ''].map(h => (
                          <span key={h} className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{h}</span>
                        ))}
                      </div>
                      {(effectiveDomain.dns_records || effectiveDomain.dnsRecords).map(record => (
                        <div key={record.id} className="grid grid-cols-[80px_1fr_1fr_80px_40px] gap-3 px-6 py-3 items-center hover:bg-white/[0.02] transition-colors group">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold border ${recordTypeColor[record.type] || 'bg-muted text-muted-foreground border-transparent'}`}>
                            {record.type}
                          </span>
                          <code className="text-sm font-mono text-white/80 truncate">{record.name}</code>
                          <div className="flex items-center gap-1 min-w-0">
                            <code className="text-sm font-mono text-muted-foreground truncate flex-1">{record.value}</code>
                            <CopyBtn value={record.value} />
                          </div>
                          <span className="text-xs text-muted-foreground">{record.ttl}s</span>
                          <button
                            onClick={() => handleDeleteRecord(record.id)}
                            disabled={deletingRecord === record.id}
                            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                          >
                            {deletingRecord === record.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
            );
          })()}
        </TabsContent>

        {/* ── Logs ─────────────────────────────────────────────── */}
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
      <ConfirmationDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={`${pendingAction?.charAt(0).toUpperCase() + pendingAction?.slice(1)} App`}
        description={`Are you sure you want to ${pendingAction} this app?`}
        confirmText={pendingAction === 'delete' ? 'Delete App' : pendingAction === 'deploy' ? 'Deploy now' : 'Confirm'}
        variant={pendingAction === 'delete' ? 'destructive' : 'default'}
        isLoading={actionLoading}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
