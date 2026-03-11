import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [passwords, setPasswords] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  const [githubSettings, setGithubSettings] = useState({
    github_client_id: '',
    github_client_secret: '',
    github_webhook_secret: '',
    github_connected: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setGithubSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const handleChange = (e) => setPasswords({ ...passwords, [e.target.name]: e.target.value });
  const handleGithubChange = (e) => setGithubSettings({ ...githubSettings, [e.target.name]: e.target.value });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api.post('/auth/change-password', passwords);
      setMessage('Password updated successfully.');
      setPasswords({ current_password: '', password: '', password_confirmation: '' });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.password?.[0] || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSettingsUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api.post('/settings', githubSettings);
      setMessage('GitHub settings updated successfully.');
      fetchSettings();
    } catch (err) {
      setError('Failed to update GitHub settings');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGithub = async () => {
    try {
      const { data } = await api.get('/github/redirect');
      window.location.href = data.url;
    } catch (err) {
      setError('Failed to initiate GitHub connection');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your panel account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Profile</CardTitle>
          <CardDescription>Your current panel administrator details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Name</label>
            <Input disabled value={user?.name || ''} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Email Address</label>
            <Input disabled value={user?.email || ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <form onSubmit={handleGithubSettingsUpdate}>
          <CardHeader>
            <CardTitle>GitHub Integration</CardTitle>
            <CardDescription>Configure your GitHub App credentials for automatic deployments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Client ID</label>
              <Input name="github_client_id" value={githubSettings.github_client_id || ''} onChange={handleGithubChange} placeholder="ov2..." />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Client Secret</label>
              <Input type="password" name="github_client_secret" value={githubSettings.github_client_secret || ''} onChange={handleGithubChange} placeholder="********" />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Global Webhook Secret</label>
              <Input type="password" name="github_webhook_secret" value={githubSettings.github_webhook_secret || ''} onChange={handleGithubChange} placeholder="********" />
              <p className="text-xs text-muted-foreground italic">Used as default secret for new apps.</p>
            </div>

            <div className="pt-4 flex items-center justify-between border-t mt-4">
              <div>
                <p className="text-sm font-medium">GitHub Connection</p>
                <p className="text-xs text-muted-foreground">
                  {githubSettings.github_connected ? 'Connected to GitHub account.' : 'Not connected yet.'}
                </p>
              </div>
              <Button type="button" variant={githubSettings.github_connected ? "outline" : "default"} onClick={handleConnectGithub}>
                {githubSettings.github_connected ? 'Reconnect GitHub' : 'Connect GitHub'}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6 mt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form onSubmit={handlePasswordChange}>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your panel login password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && <div className="text-sm font-medium text-success bg-success/10 p-3 rounded-md">{message}</div>}
            {error && <div className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">Current Password</label>
              <Input type="password" name="current_password" required value={passwords.current_password} onChange={handleChange} />
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">New Password</label>
                <Input type="password" name="password" required minLength={8} value={passwords.password} onChange={handleChange} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Confirm New Password</label>
                <Input type="password" name="password_confirmation" required minLength={8} value={passwords.password_confirmation} onChange={handleChange} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6 mt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
