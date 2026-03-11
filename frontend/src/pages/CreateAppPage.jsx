import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CreateAppPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    type: 'nextjs',
    domain: '',
    git_url: '',
    branch: 'main',
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
