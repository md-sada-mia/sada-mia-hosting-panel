import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Github, Lock, Settings, Globe, Network, ShieldCheck, Eye, EyeOff, Users, Layers, HelpCircle, ChevronRight, Info, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

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

  const [githubSaving, setGithubSaving] = useState(false);
  const [nameserverSaving, setNameserverSaving] = useState(false);
  const [crmSaving, setCrmSaving] = useState(false);
  const [initialGithubSettings, setInitialGithubSettings] = useState(null);
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
    crm_default_deployment_domain: '',
    panel_url: '',
    server_ip: '',
    ns_default_domain: '',
  });

  const [loadBalancers, setLoadBalancers] = useState([]);
  const [systemDomains, setSystemDomains] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings'); // Changed to GET as per original code
      setGithubSettings(data);
      setInitialGithubSettings(data); // Store initial settings
      
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
  const handleSwitchChange = (name, checked) => setGithubSettings(prev => ({ ...prev, [name]: checked })); // New handler for switches

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api.post('/auth/change-password', passwords);
      setMessage('Password updated successfully.');
      setPasswords({ current_password: '', password: '', password_confirmation: '' });
      toast.success('Password updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.password?.[0] || 'Failed to update password');
      toast.error(err.response?.data?.message || err.response?.data?.errors?.password?.[0] || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // --- TAB-SPECIFIC SAVE HANDLERS ---

  const handleSaveGithubTab = async (e) => {
    e.preventDefault();
    try {
      setGithubSaving(true);
      setError(''); // Clear previous errors
      setMessage(''); // Clear previous messages
      const { data } = await api.post('/settings', {
        github_client_id: githubSettings.github_client_id, // Use existing state names
        github_client_secret: githubSettings.github_client_secret, // Use existing state names
        github_webhook_secret: githubSettings.github_webhook_secret, // Add webhook secret
      });
      setGithubSettings(prev => ({
        ...prev,
        github_client_id: data.github_client_id,
        github_client_secret: data.github_client_secret,
        github_webhook_secret: data.github_webhook_secret,
      }));
      setInitialGithubSettings(data);
      toast.success('GitHub settings saved successfully');
      setMessage('GitHub settings saved successfully.');
    } catch (err) {
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join(', ')
        : err.response?.data?.message || 'Failed to save GitHub settings';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setGithubSaving(false);
    }
  };

  const handleSaveNameserverTab = async (e) => {
    e.preventDefault();
    try {
      setNameserverSaving(true);
      setError(''); // Clear previous errors
      setMessage(''); // Clear previous messages
      const { data } = await api.post('/settings', {
        dns_default_ns1: githubSettings.dns_default_ns1,
        dns_default_ns2: githubSettings.dns_default_ns2,
        dns_default_ns3: githubSettings.dns_default_ns3, // Include all NS fields
        dns_default_ns4: githubSettings.dns_default_ns4, // Include all NS fields
      });
      setGithubSettings(prev => ({
        ...prev,
        dns_default_ns1: data.dns_default_ns1,
        dns_default_ns2: data.dns_default_ns2,
        dns_default_ns3: data.dns_default_ns3,
        dns_default_ns4: data.dns_default_ns4,
      }));
      setInitialGithubSettings(data);
      toast.success('Nameserver settings saved successfully');
      setMessage('Nameserver settings saved successfully.');
    } catch (err) {
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join(', ')
        : err.response?.data?.message || 'Failed to save nameserver settings';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setNameserverSaving(false);
    }
  };

  const handleSaveCrmTab = async (e) => {
    e.preventDefault();
    try {
      setCrmSaving(true);
      setError(''); // Clear previous errors
      setMessage(''); // Clear previous messages
      const { data } = await api.post('/settings', {
        crm_creation_type: githubSettings.crm_creation_type,
        crm_default_lb_id: githubSettings.crm_default_lb_id,
        crm_default_deployment_domain: githubSettings.crm_default_deployment_domain,
      });
      setGithubSettings(prev => ({
        ...prev,
        crm_creation_type: data.crm_creation_type,
        crm_default_lb_id: data.crm_default_lb_id,
        crm_default_deployment_domain: data.crm_default_deployment_domain,
      }));
      setInitialGithubSettings(data);
      toast.success('CRM settings saved successfully');
      setMessage('CRM settings saved successfully.');
    } catch (err) {
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join(', ')
        : err.response?.data?.message || 'Failed to save CRM settings';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setCrmSaving(false);
    }
  };

  const handleSaveSystemTab = async (e) => { // Renamed from handleGithubSettingsUpdate
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { data } = await api.post('/settings', {
        panel_url: githubSettings.panel_url,
        server_ip: githubSettings.server_ip,
        ns_default_domain: githubSettings.ns_default_domain,
        panel_force_https: githubSettings.panel_force_https
      });

      // After saving text settings, invoke the force-https API specifically for the panel
      if (githubSettings.panel_force_https !== initialGithubSettings?.panel_force_https) {
        try {
          const httpsReq = await api.post('/panel/ssl/force-https', { enable: githubSettings.panel_force_https });
          if (!httpsReq.data.success) {
             throw new Error(httpsReq.data.message || 'Failed to apply Force HTTPS in Nginx');
          }
        } catch (httpsErr) {
          // Revert the setting visually and in the DB if the Nginx level application fails
          await api.post('/settings', { 
            panel_url: githubSettings.panel_url,
            server_ip: githubSettings.server_ip,
            ns_default_domain: githubSettings.ns_default_domain,
            panel_force_https: false 
          });
          setGithubSettings(prev => ({ ...prev, panel_force_https: false }));
          setInitialGithubSettings(prev => ({ ...prev, panel_force_https: false }));
          
          throw new Error(httpsErr.response?.data?.message || httpsErr.message || 'Failed to apply Force HTTPS to panel. Setting reverted.');
        }
      }

      setGithubSettings(prev => ({
        ...prev,
        panel_url: data.panel_url,
        server_ip: data.server_ip,
        ns_default_domain: data.ns_default_domain,
        panel_force_https: githubSettings.panel_force_https,
      }));
      setInitialGithubSettings(prev => ({ ...prev, ...data, panel_force_https: githubSettings.panel_force_https }));
      toast.success('System settings saved successfully');
      setMessage('System settings saved successfully.');
      fetchSettings();
    } catch (err) {
      const errorMsg = err.response?.data?.errors 
        ? Object.values(err.response?.data?.errors).flat().join(', ')
        : err.response?.data?.message || err.message || 'Failed to save system settings';
      setError(errorMsg);
      toast.error(errorMsg);
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
            <TabsTrigger 
              value="system" 
              className="justify-start px-4 py-2 hover:bg-muted data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Settings className="w-4 h-4 mr-2" />
              System Settings
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
              <form onSubmit={handleSaveGithubTab}>
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
              <form onSubmit={handleSaveNameserverTab}>
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
                  
                  <div className="grid gap-3 mb-6">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Default Nameserver Domain
                    </label>
                    <div className="space-y-2">
                      <Input 
                        name="ns_default_domain" 
                        value={githubSettings.ns_default_domain || ''} 
                        onChange={handleGithubChange} 
                        placeholder="e.g. hostinger.com" 
                        list="system-domains-list"
                      />
                      <datalist id="system-domains-list">
                        {systemDomains.map(d => (
                          <option key={d.id} value={d.domain} />
                        ))}
                      </datalist>
                      <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                        If nameservers are not manually set, they will be auto-generated using this domain (e.g. ns1.hostinger.com).
                      </p>
                    </div>
                  </div>

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

            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-bold">Nameserver Setup Guide</h3>
              </div>
              
              <div className="grid gap-4">
                {[
                  {
                    step: "01",
                    title: "Select your Primary Domain",
                    description: "Choose a domain you own to be your nameserver host (e.g., mydns.io).",
                    icon: Globe
                  },
                  {
                    step: "02",
                    title: "Get your Server IP",
                    description: "Your nameservers need to point to this server. You can find your IP address on the Dashboard or by running 'curl ifconfig.me' in your terminal.",
                    icon: Network
                  },
                  {
                    step: "03",
                    title: "Configure Glue Records",
                    description: "Go to your registrar and add 'Glue Records'. This pairs your hostname with your IP address at the registry level.",
                    details: ["ns1.host.com -> 1.2.3.4", "ns2.host.com -> 1.2.3.4"],
                    icon: ShieldCheck
                  },
                  {
                    step: "04",
                    title: "Register & Verify",
                    description: "Once Glue records are set, use a tool like 'dig +short NS yourdomain.com' to verify they are active globally.",
                    icon: Info
                  }
                ].map((item, idx) => (
                  <Card key={idx} className="overflow-hidden border-none bg-muted/30 hover:bg-muted/50 transition-colors">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center">
                        <div className="bg-primary/10 px-6 py-6 md:py-0 md:h-full flex items-center justify-center min-w-[80px]">
                          <span className="text-2xl font-black text-primary/40">{item.step}</span>
                        </div>
                        <div className="p-6 flex-1 flex items-start gap-4">
                          <div className="mt-1 p-2 rounded-lg bg-background border border-border">
                            <item.icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              {item.title}
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                            {item.details && (
                              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono">
                                {item.details.map((detail, i) => (
                                  <span key={i} className="bg-background border border-border px-1.5 py-0.5 rounded text-primary">
                                    {detail}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 ml-auto hidden md:block" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-primary">
                    <ShieldCheck className="h-4 w-4" /> Registrar Location
                  </h4>
                  <div className="text-[11px] text-muted-foreground leading-loose">
                    Glue records are usually found under:
                    <ul className="list-disc ml-4 mt-1 space-y-1">
                      <li><strong>Namecheap:</strong> Advanced DNS → Personal DNS Server</li>
                      <li><strong>GoDaddy:</strong> DNS → Host Names</li>
                      <li><strong>Cloudflare:</strong> DNS → Records → Custom Nameservers</li>
                    </ul>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-primary">
                    <Globe className="h-4 w-4" /> Verification Tip
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-loose">
                    After setting Glue records, it can take up to 24 hours to propagate. Check status using:
                    <code className="block mt-2 bg-background p-2 rounded text-[10px] border border-border">
                      whois yourdomain.com | grep "Name Server"
                    </code>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-center px-8">
                <p className="text-xs text-muted-foreground italic">
                  Need more help? Check out our <a href="https://www.namecheap.com/support/knowledgebase/article.aspx/768/10/how-do-i-register-personal-nameservers-for-my-domain/" target="_blank" className="text-primary font-medium hover:underline inline-flex items-center gap-0.5">full documentation <ExternalLink className="h-3 w-3" /></a>
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="crm" className="mt-0">
            <Card>
              <form onSubmit={handleSaveCrmTab}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    CRM Deployment Type
                  </CardTitle>
                  <CardDescription>
                    Choose how the CRM creates hosting resources for new customers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

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
                      Default Deployment Domain
                    </label>
                    <div className="max-w-md">
                      <Select 
                        value={githubSettings.crm_default_deployment_domain || ''} 
                        onValueChange={v => setGithubSettings({ ...githubSettings, crm_default_deployment_domain: v })}
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
                      This setting determines what happens when you click <strong>Deploy</strong> on a CRM customer. 
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

          <TabsContent value="system" className="mt-0">
            <Card>
              <form onSubmit={handleSaveSystemTab}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    System Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure core panel settings and external access URLs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  <div className="grid gap-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Control Panel Address
                    </label>
                    <div className="space-y-2">
                      <Input 
                        name="panel_url" 
                        value={githubSettings.panel_url || ''} 
                        onChange={handleGithubChange} 
                        placeholder="e.g. panel.yourdomain.com" 
                      />
                      <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                        This URL is used for GitHub OAuth redirects and other system links. 
                        <strong> Note:</strong> The panel port will be automatically appended if missing.
                      </p>
                    </div>
                  </div>

                    <div className="grid gap-3">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />
                        Server IP Address
                      </label>
                      <div className="space-y-2">
                        <Input 
                          name="server_ip" 
                          value={githubSettings.server_ip || ''} 
                          onChange={handleGithubChange} 
                          placeholder="e.g. 1.2.3.4" 
                        />
                        <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                          This IP address is used for all default DNS A records created by the panel.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 pt-4 border-t">
                      <div className="flex items-start justify-between">
                        <div>
                          <label className="text-sm font-semibold flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Force HTTPS for Control Panel
                          </label>
                          <p className="text-[11px] text-muted-foreground leading-relaxed italic mt-1 max-w-xl">
                            Redirects all HTTP traffic on port 8083 to HTTPS. <strong>Requires panel SSL to be active first.</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={githubSettings.panel_force_https}
                            onCheckedChange={(checked) => {
                              setGithubSettings(s => ({ ...s, panel_force_https: checked }));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 mt-2">
                      <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-primary">Important Recommendation</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          If you are using a domain name, make sure to update your GitHub App's <strong>Redirect URL</strong> 
                          to match this new address to avoid authentication issues.
                        </p>
                      </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t pt-6 mt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save System Settings'}
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
