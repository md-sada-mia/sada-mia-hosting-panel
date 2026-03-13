import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Github, Lock, Settings, Globe, Network, ShieldCheck, Eye, EyeOff, Users, Layers } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  
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
    dns_default_ns1: '',
    dns_default_ns2: '',
    dns_default_ns3: '',
    dns_default_ns4: '',
    crm_creation_type: 'load_balancer',
    crm_default_lb_id: '',
    crm_default_provision_domain: '',
  });

  const [loadBalancers, setLoadBalancers] = useState([]);
  const [systemDomains, setSystemDomains] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setGithubSettings(data);
      
      const lbRes = await api.get('/load-balancers');
      setLoadBalancers(lbRes.data);

      const domainRes = await api.get('/domains');
      setSystemDomains(domainRes.data);
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
      setMessage('Settings updated successfully.');
      fetchSettings();
    } catch (err) {
      setError('Failed to update settings');
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
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account settings and integrations.</p>
      </div>

      <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-8" orientation="vertical">
        <aside className="md:w-64">
          <TabsList className="flex md:flex-col h-auto bg-transparent p-0 gap-1 overflow-x-auto md:overflow-x-visible">
            <TabsTrigger 
              value="profile" 
              className="justify-start px-4 py-2 hover:bg-muted data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <User className="w-4 h-4 mr-2" />
              Account Profile
            </TabsTrigger>
            <TabsTrigger 
              value="github" 
              className="justify-start px-4 py-2 hover:bg-muted data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Github className="w-4 h-4 mr-2" />
              GitHub Integration
            </TabsTrigger>
            <TabsTrigger 
              value="password" 
              className="justify-start px-4 py-2 hover:bg-muted data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Lock className="w-4 h-4 mr-2" />
              Change Password
            </TabsTrigger>
            <TabsTrigger 
              value="dns" 
              className="justify-start px-4 py-2 hover:bg-muted data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Globe className="w-4 h-4 mr-2" />
              Nameserver Basics
            </TabsTrigger>
            <TabsTrigger 
              value="crm" 
              className="justify-start px-4 py-2 hover:bg-muted data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Users className="w-4 h-4 mr-2" />
              CRM Settings
            </TabsTrigger>
          </TabsList>
        </aside>

        <div className="flex-1">
          <TabsContent value="profile" className="mt-0">
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
          </TabsContent>

          <TabsContent value="github" className="mt-0">
            <Card>
              <form onSubmit={handleGithubSettingsUpdate}>
                <CardHeader>
                  <CardTitle>GitHub Integration</CardTitle>
                  <CardDescription>Configure your GitHub App credentials for automatic deployments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {message && <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded-md">{message}</div>}
                  {error && <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
                  
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Client ID</label>
                    <Input name="github_client_id" value={githubSettings.github_client_id || ''} onChange={handleGithubChange} placeholder="ov2..." />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Client Secret</label>
                    <div className="relative">
                      <Input 
                        type={showClientSecret ? "text" : "password"} 
                        name="github_client_secret" 
                        value={githubSettings.github_client_secret || ''} 
                        onChange={handleGithubChange} 
                        placeholder="********" 
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Global Webhook Secret</label>
                    <div className="relative">
                      <Input 
                        type={showWebhookSecret ? "text" : "password"} 
                        name="github_webhook_secret" 
                        value={githubSettings.github_webhook_secret || ''} 
                        onChange={handleGithubChange} 
                        placeholder="********" 
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
          </TabsContent>

          <TabsContent value="password" className="mt-0">
            <Card>
              <form onSubmit={handlePasswordChange}>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your panel login password.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {message && <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded-md">{message}</div>}
                  {error && <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
                  
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
          </TabsContent>

          <TabsContent value="dns" className="mt-0">
            <Card>
              <form onSubmit={handleGithubSettingsUpdate}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-primary" />
                    Global Nameservers
                  </CardTitle>
                  <CardDescription>
                    These will be automatically assigned to all new domains you add.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {message && <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded-md">{message}</div>}
                  {error && <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="grid gap-2">
                        <label className="text-sm font-medium">Nameserver {n}</label>
                        <Input 
                          name={`dns_default_ns${n}`} 
                          value={githubSettings[`dns_default_ns${n}`] || ''} 
                          onChange={handleGithubChange} 
                          placeholder={`ns${n}.yourprimary.com`} 
                        />
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">Hostinger Style</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        By setting these here, you don't have to think about them when adding new domains. 
                        Simply set your primary domain's <strong>Glue Records</strong> once at your registrar, 
                        and then use these names for everything else!
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-6 mt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Defaults'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="crm" className="mt-0">
            <Card>
              <form onSubmit={handleGithubSettingsUpdate}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    CRM Provisioning Type
                  </CardTitle>
                  <CardDescription>
                    Choose how the CRM creates hosting resources for new customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {message && <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded-md">{message}</div>}
                  {error && <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { value: 'load_balancer', icon: Network, title: 'Load Balancer Domain', desc: 'Attach a domain to an existing load balancer for each customer.' },
                      { value: 'app',           icon: Layers,  title: 'Application',          desc: 'Create or link a standalone application for each customer.' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGithubSettings({ ...githubSettings, crm_creation_type: opt.value })}
                        className={`text-left p-5 rounded-xl border-2 transition-all ${
                          githubSettings.crm_creation_type === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-muted/40'
                        }`}
                      >
                        <opt.icon className={`h-6 w-6 mb-3 ${
                          githubSettings.crm_creation_type === opt.value ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <p className="font-semibold text-sm">{opt.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                        {githubSettings.crm_creation_type === opt.value && (
                          <span className="inline-block mt-2 px-2 py-0.5 bg-primary/15 text-primary text-[10px] font-semibold rounded-full uppercase tracking-wide">Selected</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {githubSettings.crm_creation_type === 'load_balancer' && (
                    <div className="pt-4 border-t space-y-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />
                        Default Load Balancer
                      </label>
                      <div className="max-w-md">
                        <Select 
                          value={githubSettings.crm_default_lb_id ? String(githubSettings.crm_default_lb_id) : ''} 
                          onValueChange={v => setGithubSettings({ ...githubSettings, crm_default_lb_id: v })}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="-- Select a default load balancer --" />
                          </SelectTrigger>
                          <SelectContent>
                            {loadBalancers.map(lb => (
                              <SelectItem key={lb.id} value={String(lb.id)}>{lb.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                          This load balancer will be pre-selected when you add a new customer in CRM.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Default Provisioning Domain
                    </label>
                    <div className="max-w-md">
                      <Select 
                        value={githubSettings.crm_default_provision_domain || ''} 
                        onValueChange={v => setGithubSettings({ ...githubSettings, crm_default_provision_domain: v })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="-- Select a domain from system --" />
                        </SelectTrigger>
                        <SelectContent>
                          {systemDomains.map(d => (
                            <SelectItem key={d.id} value={d.domain}>{d.domain}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                        New customers will be assigned a subdomain (e.g. <strong>business.yourhosting.com</strong>) using this domain.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
                    <ShieldCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This setting determines what happens when you click <strong>Provision</strong> on a CRM customer. 
                      You can change it at any time; existing customer resources are not affected.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-6 mt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save CRM Settings'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
