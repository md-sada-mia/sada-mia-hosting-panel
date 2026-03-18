import { useState, useEffect, useRef } from 'react';
import { Search, Github, Rocket, Terminal, ChevronRight, CheckCircle2, AlertCircle, RotateCcw, Shield, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const stripAnsi = (str) => {
  if (!str) return '';
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

const slugify = (str) =>
  (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function CreateAppPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // New state for deployment tracking
  const [createdApp, setCreatedApp] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [domainMode, setDomainMode] = useState('subdomain'); // 'subdomain' or 'custom'
  const [isSubdomainEdited, setIsSubdomainEdited] = useState(false);
  const [defaultDomain, setDefaultDomain] = useState('');
  const [systemDomains, setSystemDomains] = useState([]);
  const logEndRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    type: 'nextjs',
    domain: '',
    git_url: '',
    branch: 'main',
    github_id: '',
    auto_deploy: false,
    env_vars: '',
    auto_db_create: true,
  });

  useEffect(() => {
    checkGithubConnection();
  }, []);

  useEffect(() => {
    let interval;
    if (createdApp && isDeploying) {
      interval = setInterval(fetchLogs, 3000);
    }
    return () => clearInterval(interval);
  }, [createdApp, isDeploying]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (domainMode === 'subdomain' && defaultDomain && !isSubdomainEdited) {
      setForm(prev => ({ ...prev, domain: slugify(prev.name) }));
    }
  }, [form.name, domainMode, defaultDomain, isSubdomainEdited]);

  const checkGithubConnection = async () => {
    try {
      const [{ data: settings }, { data: domains }] = await Promise.all([
        api.get('/settings'),
        api.get('/domains')
      ]);
      
      setIsConnected(settings.github_connected);
      setDefaultDomain(settings.crm_default_deployment_domain || domains[0]?.domain || '');
      setSystemDomains(domains.filter(d => d.dns_managed));
      
      // If no default domain is set and no domains available, default to custom mode
      if (!settings.crm_default_deployment_domain && domains.length === 0) {
        setDomainMode('custom');
      }

      if (settings.github_connected) {
        fetchRepos();
      }
    } catch (err) {
      console.error('Failed to check connection', err);
    }
  };

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const { data } = await api.get('/github/repositories');
      setRepos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch repositories', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchLogs = async () => {
    if (!createdApp) return;
    try {
      // Fetch fresh app data which includes latestDeployment
      const { data } = await api.get(`/apps/${createdApp.id}`);
      
      if (data.latest_deployment) {
        const rawLogs = data.latest_deployment.log_output || '';
        const cleanLogs = stripAnsi(rawLogs);
        setLogs(cleanLogs.split('\n'));
      }

      if (data.status !== 'deploying') {
        setIsDeploying(false);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleRepoSelect = (repo) => {
    setForm({
      ...form,
      git_url: repo.clone_url,
      github_full_name: repo.full_name,
      github_id: repo.id,
      name: form.name || repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      branch: repo.default_branch || 'main',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLogs(['Initiating application creation...']);

    try {
      const payload = {
        ...form,
        domain: (domainMode === 'subdomain' && defaultDomain) 
          ? `${form.domain}.${defaultDomain}` 
          : form.domain
      };
      const { data } = await api.post('/apps', payload);
      setCreatedApp(data);
      setLogs(prev => [...prev, `App "${data.name}" created successfully.`, 'Triggering initial deployment...']);
      
      // Start deployment
      setIsDeploying(true);
      await api.post(`/apps/${data.id}/deploy`);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create application');
      setLogs(prev => [...prev, `ERROR: ${err.response?.data?.message || 'Creation failed'}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Create Application</h2>
        <p className="text-muted-foreground mt-1">Configure and deploy your new project natively on this server.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Form */}
        <Card className={createdApp ? "opacity-70 pointer-events-none" : ""}>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Application Details
              </CardTitle>
              <CardDescription>Git repository and domain mapping.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              
              <div className="grid gap-2">
                <label className="text-sm font-medium">App Name</label>
                <Input 
                  required 
                  placeholder="my-awesome-app" 
                  name="name" 
                  value={form.name} 
                  onChange={handleChange} 
                  pattern="[a-zA-Z0-9_\-]+" 
                  title="Only alphanumeric, underscores, hyphens allowed"
                  disabled={loading || createdApp}
                />
                <p className="text-xs text-muted-foreground">Alphanumeric, underscores, hyphens allowed.</p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">App Type</label>
                <Select
                  name="type"
                  value={form.type}
                  onValueChange={(value) => setForm({ ...form, type: value })}
                  disabled={loading || createdApp}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nextjs">Next.js (Node.js/PM2)</SelectItem>
                    <SelectItem value="laravel">Laravel (PHP-FPM)</SelectItem>
                    <SelectItem value="static">Static HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Domain Name</label>
                  {defaultDomain && (
                    <div className="flex bg-muted/50 border rounded-lg p-1 scale-90 origin-right">
                      <button 
                        type="button" 
                        onClick={() => setDomainMode('subdomain')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${domainMode === 'subdomain' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                      >
                        Subdomain
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setDomainMode('custom')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${domainMode === 'custom' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                      >
                        Custom
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative group">
                  <div className={`flex items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all`}>
                    <div className="flex items-center px-3 text-muted-foreground bg-muted/20 border-r border-input">
                      <Globe className="h-4 w-4" />
                    </div>
                    <input
                      required
                      name="domain"
                      value={form.domain}
                      onChange={(e) => {
                        setForm({ ...form, domain: e.target.value });
                        if (domainMode === 'subdomain') setIsSubdomainEdited(true);
                      }}
                      disabled={loading || createdApp}
                      className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground/50"
                      placeholder={domainMode === 'subdomain' ? "prefix" : "app.example.com"}
                    />
                    {domainMode === 'subdomain' && (
                      <div className="flex items-center border-l border-input bg-muted/20">
                        <Select
                          value={defaultDomain}
                          onValueChange={setDefaultDomain}
                          disabled={loading || createdApp}
                        >
                          <SelectTrigger className="border-0 bg-transparent h-full px-3 py-0 focus:ring-0 rounded-none text-sm font-medium text-muted-foreground w-[160px]">
                            <SelectValue placeholder="domain.com" />
                          </SelectTrigger>
                          <SelectContent>
                            {systemDomains.map(d => (
                              <SelectItem key={d.id} value={d.domain}>.{d.domain}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {domainMode === 'subdomain' 
                    ? `Will be deployed as: ${form.domain || 'prefix'}.${defaultDomain}`
                    : "Enter the full domain name pointing to this server."}
                </p>
              </div>

              {isConnected && !createdApp && (
                <div className="grid gap-2 p-4 border rounded-md bg-muted/50 border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Github className="h-4 w-4 text-primary" />
                    <label className="text-sm font-medium">Select GitHub Repository</label>
                  </div>
                  {loadingRepos ? (
                    <div className="text-xs text-muted-foreground animate-pulse">Loading your repositories...</div>
                  ) : repos.length > 0 ? (
                    <Select
                      onValueChange={(value) => {
                        const repo = repos.find(r => r.id === parseInt(value));
                        if (repo) handleRepoSelect(repo);
                      }}
                      value={form.github_id ? form.github_id.toString() : ""}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="-- Choose a repository --" />
                      </SelectTrigger>
                      <SelectContent>
                        {repos.map(repo => (
                          <SelectItem key={repo.id} value={repo.id.toString()}>{repo.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs text-destructive">No repositories found.</div>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Git URL</label>
                  <Input 
                    required 
                    placeholder="https://..." 
                    name="git_url" 
                    value={form.git_url} 
                    onChange={handleChange} 
                    disabled={loading || createdApp}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Branch</label>
                  <Input 
                    required 
                    placeholder="main" 
                    name="branch" 
                    value={form.branch} 
                    onChange={handleChange} 
                    disabled={loading || createdApp}
                  />
                </div>
              </div>

              {form.github_full_name && !createdApp && (
                <div className="flex items-center gap-2 bg-primary/5 p-3 rounded-md border border-primary/10">
                  <input 
                    type="checkbox" 
                    id="auto_deploy" 
                    name="auto_deploy" 
                    checked={form.auto_deploy} 
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="auto_deploy" className="text-sm font-medium cursor-pointer">
                    Enable automatic deployment on push
                  </label>
                </div>
              )}

              {form.type === 'laravel' && !createdApp && (
                <div className="flex items-center gap-2 bg-blue-500/5 p-3 rounded-md border border-blue-500/10">
                  <input 
                    type="checkbox" 
                    id="auto_db_create" 
                    name="auto_db_create" 
                    checked={form.auto_db_create} 
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="auto_db_create" className="text-sm font-medium cursor-pointer">
                    Auto-create PostgreSQL database and user
                  </label>
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-medium">Environment Variables (Bulk)</label>
                <textarea 
                  name="env_vars"
                  placeholder={"APP_KEY=secret\nDB_PASS=password"}
                  value={form.env_vars}
                  onChange={handleChange}
                  disabled={loading || createdApp}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary outline-none font-mono"
                />
                <p className="text-xs text-muted-foreground">Standard .env format KEY=VALUE (one per line).</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 border-t pt-6 mt-2">
              {!createdApp && (
                <Button variant="outline" type="button" onClick={() => navigate('/apps')} disabled={loading}>Cancel</Button>
              )}
              <Button type="submit" disabled={loading || createdApp} className="min-w-[140px]">
                {loading ? 'Creating...' : 'Create & Deploy'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Right Column: Terminal Logs */}
        <div className="space-y-4">
          <Card className="bg-[#0f1115] border-[#1f2937] text-gray-300 overflow-hidden shadow-2xl">
            <CardHeader className="py-3 bg-[#1a1d23] border-b border-[#1f2937] flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono flex items-center gap-2 text-gray-400">
                <Terminal className="h-4 w-4" />
                Deployment Console
              </CardTitle>
              {isDeploying && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Live</span>
                </div>
              )}
              {!isDeploying && createdApp && (logs.some(l => l.includes('ERROR') || l.includes('failed'))) && (
                <Button 
                  size="xs" 
                  variant="outline" 
                  className="h-7 text-[10px] bg-red-950/30 border-red-900/50 hover:bg-red-900/50 text-red-400"
                  onClick={async () => {
                    setIsDeploying(true);
                    setError('');
                    try {
                      await api.post(`/apps/${createdApp.id}/deploy`);
                    } catch (err) {
                      setError('Retry failed');
                    }
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Retry Deployment
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[480px] overflow-y-auto p-4 font-mono text-xs leading-relaxed custom-scrollbar bg-black/40">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-50">
                    <Terminal className="h-10 w-10 mb-2" />
                    <p>Console waiting for initialization...</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((line, idx) => {
                      let color = 'text-gray-400';
                      if (line.includes('ERROR') || line.includes('failed')) color = 'text-red-400';
                      if (line.includes('success') || line.includes('Complete')) color = 'text-green-400';
                      if (line.includes('Initiating') || line.includes('Triggering')) color = 'text-blue-400';
                      
                      return (
                        <div key={idx} className={`${color} flex gap-2`}>
                          <span className="text-gray-700 opacity-50 select-none">[{idx + 1}]</span>
                          <span>{line}</span>
                        </div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {createdApp && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-success/10 border border-success/20 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-success">Application initialized!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can watch the logs above or head to the dashboard to manage environment variables.
                  </p>
                  <div className="mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/apps/${createdApp.id}/guidelines`)}
                      className="h-8 text-[11px] gap-1.5 border-success/20 text-success hover:bg-success/10"
                    >
                      <Shield className="h-3.5 w-3.5" /> View Guidelines
                    </Button>
                  </div>
                </div>
              </div>
              <Button onClick={() => navigate(`/apps/${createdApp.id}`)} className="w-full py-6 text-lg group">
                Go to Dashboard
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
