import { useState, useEffect, useRef } from 'react';
import { Search, Github, Rocket, Terminal, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const logEndRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    type: 'nextjs',
    domain: '',
    git_url: '',
    branch: 'main',
    github_full_name: '',
    github_id: '',
    auto_deploy: false,
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

  const checkGithubConnection = async () => {
    try {
      const { data } = await api.get('/settings');
      setIsConnected(data.github_connected);
      if (data.github_connected) {
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
      const { data } = await api.get(`/apps/${createdApp.id}/logs`);
      const logLines = data.logs.split('\n');
      setLogs(logLines);

      // Also check app status
      const appRes = await api.get(`/apps/${createdApp.id}`);
      if (appRes.data.status !== 'deploying') {
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
      const { data } = await api.post('/apps', form);
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
                  pattern="[a-zA-Z0-9_-]+" 
                  disabled={loading || createdApp}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">App Type</label>
                <select 
                  name="type" 
                  value={form.type} 
                  onChange={handleChange}
                  disabled={loading || createdApp}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="nextjs">Next.js (Node.js/PM2)</option>
                  <option value="laravel">Laravel (PHP-FPM)</option>
                  <option value="static">Static HTML</option>
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Domain Name</label>
                <Input 
                  required 
                  placeholder="app.example.com" 
                  name="domain" 
                  value={form.domain} 
                  onChange={handleChange} 
                  disabled={loading || createdApp}
                />
                <p className="text-xs text-muted-foreground">Points to your server IP.</p>
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
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                      onChange={(e) => {
                        const repo = repos.find(r => r.id === parseInt(e.target.value));
                        if (repo) handleRepoSelect(repo);
                      }}
                      value={form.github_id || ""}
                    >
                      <option value="">-- Choose a repository --</option>
                      {repos.map(repo => (
                        <option key={repo.id} value={repo.id}>{repo.full_name}</option>
                      ))}
                    </select>
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
