import { useState, useEffect } from 'react';
import { Search, Github } from 'lucide-react';
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

    try {
      const { data } = await api.post('/apps', form);
      // Navigate to app details right after creating
      navigate(`/apps/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Create Application</h2>
        <p className="text-muted-foreground mt-1">Deploy a new Next.js, Laravel, or Static app.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
            <CardDescription>Configure Git repository and domain settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">App Name (lowercase, no spaces)</label>
              <Input required placeholder="my-awesome-app" name="name" value={form.name} onChange={handleChange} pattern="[a-zA-Z0-9_-]+" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">App Type</label>
              <select 
                name="type" 
                value={form.type} 
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="nextjs">Next.js (Node.js/PM2)</option>
                <option value="laravel">Laravel (PHP-FPM)</option>
                <option value="static">Static HTML</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Domain Name</label>
              <Input required placeholder="app.example.com" name="domain" value={form.domain} onChange={handleChange} />
              <p className="text-xs text-muted-foreground">Ensure this domain points to your server IP.</p>
            </div>

            {isConnected && (
              <div className="grid gap-2 p-4 border rounded-md bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Github className="h-4 w-4" />
                  <label className="text-sm font-medium">Select GitHub Repository</label>
                </div>
                {loadingRepos ? (
                  <div className="text-xs text-muted-foreground animate-pulse">Loading your repositories...</div>
                ) : repos.length > 0 ? (
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  <div className="text-xs text-destructive">No repositories found or token expired.</div>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Git Repository URL</label>
                <Input required placeholder="https://github.com/user/repo.git" name="git_url" value={form.git_url} onChange={handleChange} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Branch</label>
                <Input required placeholder="main" name="branch" value={form.branch} onChange={handleChange} />
              </div>
            </div>

            {form.github_full_name && (
              <div className="flex items-center gap-2">
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
            <Button variant="outline" type="button" onClick={() => navigate('/apps')} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create App'}</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
