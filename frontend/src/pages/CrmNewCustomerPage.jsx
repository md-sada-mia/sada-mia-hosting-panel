import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Users, Building2, Mail, Phone, MapPin, StickyNote,
  Network, Layers, Plus, RefreshCw, Zap, Github, Terminal,
  ChevronRight, CheckCircle2, AlertCircle, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

const slugify = (str) =>
  (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const stripAnsi = (str) => {
  if (!str) return '';
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

export default function CrmNewCustomerPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  // ── Customer form ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', business_name: '', email: '', phone: '',
    address: '', notes: '', status: 'lead',
  });
  const [errors, setErrors] = useState({});

  // ── Settings + resource data ───────────────────────────────────────────────
  const [crmType, setCrmType] = useState('load_balancer');
  const [defaultDomain, setDefaultDomain] = useState('');
  const [loadBalancers, setLoadBalancers] = useState([]);
  const [apps, setApps] = useState([]);
  const [repos, setRepos] = useState([]);
  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [domainMode, setDomainMode] = useState('subdomain'); // 'subdomain' or 'custom'
  const [isSubdomainEdited, setIsSubdomainEdited] = useState(false);

  // ── Provision state ────────────────────────────────────────────────────────
  const [skipProvision, setSkipProvision] = useState(false);
  const [lbForm, setLbForm] = useState({ load_balancer_id: '', domain: '' });
  const [appMode, setAppMode] = useState('new');
  const [selectedAppId, setSelectedAppId] = useState('');
  const [appForm, setAppForm] = useState({
    type: 'nextjs', domain: '', git_url: '', branch: 'main',
    github_full_name: '', github_id: '', auto_deploy: false, env_vars: '', auto_db_create: true,
  });

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Deploy logs ────────────────────────────────────────────────────────────
  const [deployingApp, setDeployingApp] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [done, setDone] = useState(false);
  const [provisionedResource, setProvisionedResource] = useState(null);
  const logEndRef = useRef(null);

  useEffect(() => { fetchPrereqs(); }, []);

  useEffect(() => {
    let interval;
    if (deployingApp && isDeploying) interval = setInterval(pollDeployLogs, 3000);
    return () => clearInterval(interval);
  }, [deployingApp, isDeploying]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchPrereqs = async () => {
    try {
      const [settingsRes, lbRes, appsRes] = await Promise.all([
        api.get('/settings'), api.get('/load-balancers'), api.get('/apps'),
      ]);
      setCrmType(settingsRes.data.crm_creation_type || 'load_balancer');
      setDefaultDomain(settingsRes.data.crm_default_provision_domain || '');
      setIsGithubConnected(settingsRes.data.github_connected || false);
      setLoadBalancers(lbRes.data);
      setApps(appsRes.data);

      if (!id && settingsRes.data.crm_default_lb_id) {
        setLbForm(prev => ({ ...prev, load_balancer_id: String(settingsRes.data.crm_default_lb_id) }));
      }

      if (isEdit) {
        const { data: customer } = await api.get(`/customers/${id}`);
        setForm({
          name: customer.name || '',
          business_name: customer.business_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          notes: customer.notes || '',
          status: customer.status || 'lead',
        });
        if (customer.resource_type) {
          setSkipProvision(true); // Already provisioned
          setProvisionedResource(customer.resource);
        }
        setDomainMode('custom');
      }

      if (settingsRes.data.github_connected) {
        try {
          const { data } = await api.get('/github/repositories');
          setRepos(Array.isArray(data) ? data : []);
        } catch { /* silent */ }
      }
    } catch { 
      toast.error('Failed to load data');
    }
  };

  const pollDeployLogs = async () => {
    if (!deployingApp) return;
    try {
      const { data } = await api.get(`/apps/${deployingApp.id}`);
      if (data.latest_deployment?.log_output) {
        setLogs(stripAnsi(data.latest_deployment.log_output).split('\n'));
      }
      if (data.status !== 'deploying') {
        setIsDeploying(false);
        setDone(true);
      }
    } catch { /* silent */ }
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    
    if (!skipProvision) {
      if (crmType === 'load_balancer') {
        if (!lbForm.load_balancer_id) errs.load_balancer_id = 'Please select a load balancer';
        if (!lbForm.domain.trim()) errs.lb_domain = 'Domain is required';
      } else if (appMode === 'existing') {
        if (!selectedAppId) errs.selected_app_id = 'Please select an app';
      } else {
        if (!appForm.domain.trim()) errs.app_domain = 'Domain is required';
        if (!appForm.git_url.trim()) errs.git_url = 'Git URL is required';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      // 1. Create or Update customer
      let customer;
      if (isEdit) {
        const { data } = await api.put(`/customers/${id}`, form);
        customer = data;
      } else {
        const { data } = await api.post('/customers', form);
        customer = data;
      }

      // 2. Provision (if not skipped and not already provisioned)
      if (!skipProvision && !customer.resource_type) {
        let payload = {};
        if (crmType === 'load_balancer') {
          payload = { 
            ...lbForm, 
            domain: (domainMode === 'subdomain' && defaultDomain) 
              ? `${lbForm.domain}.${defaultDomain}` 
              : lbForm.domain 
          };
        } else if (appMode === 'existing') {
          payload = { app_id: selectedAppId };
        } else {
          payload = { 
            ...appForm, 
            domain: (domainMode === 'subdomain' && defaultDomain) 
              ? `${appForm.domain}.${defaultDomain}` 
              : appForm.domain 
          };
        }

        const { data: updated } = await api.post(`/customers/${customer.id}/provision`, payload);
        setProvisionedResource(updated.resource);

        if (crmType === 'app' && appMode === 'new' && updated.resource?.type === 'app') {
          setDeployingApp(updated.resource);
          setIsDeploying(true);
          setLogs(['App created. Triggering initial deployment...']);
          toast.success(isEdit ? 'Customer updated and app provisioned!' : 'Customer created and app provisioned!');
        } else {
          toast.success(isEdit ? 'Customer updated and resource provisioned!' : 'Customer created and resource provisioned!');
          setDone(true);
        }
      } else {
        toast.success(isEdit ? 'Customer updated successfully!' : 'Customer created successfully!');
        setDone(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} customer`);
    } finally {
      setSubmitting(false);
    }
  };

  const appName = slugify(form.business_name || form.name);

  useEffect(() => {
    if (!isEdit && domainMode === 'subdomain' && defaultDomain && !isSubdomainEdited) {
      const sub = appName;
      if (crmType === 'load_balancer') {
        setLbForm(prev => ({ ...prev, domain: sub }));
      } else {
        setAppForm(prev => ({ ...prev, domain: sub }));
      }
    }
  }, [appName, domainMode, defaultDomain, crmType, isEdit, isSubdomainEdited]);

  // ── After completion ───────────────────────────────────────────────────────
  if (done && !isDeploying) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-5">
        <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{isEdit ? 'Customer Updated!' : 'Customer Created!'}</h2>
          <p className="text-muted-foreground mt-1">
            {provisionedResource
              ? `${form.name} ${isEdit ? 'information has been updated' : 'has been added'} and a ${provisionedResource.type === 'load_balancer' ? 'load balancer domain' : 'app'} has been provisioned.`
              : `${form.name || 'Customer'} ${isEdit ? 'information has been updated' : 'has been added to your CRM'}.`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {provisionedResource && (
            <button
              onClick={() => provisionedResource.type === 'app'
                ? navigate(`/apps/${provisionedResource.id}`)
                : navigate(`/load-balancers/${provisionedResource.id}/manage`)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 border rounded-xl hover:bg-muted transition-colors text-sm font-medium"
            >
              View Resource <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => navigate('/crm')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all text-sm font-medium"
          >
            <Users className="h-4 w-4" /> Back to CRM
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/crm')}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit Customer' : 'New Customer'}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isEdit ? 'Update details or provision additional resources.' : 'Fill in customer details and optionally set up their hosting resource.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ── LEFT: Customer Details ─────────────────────────────────── */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Customer Information</h2>
                <p className="text-xs text-muted-foreground">Personal and contact details</p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full Name" required error={errors.name} icon={<Users className="h-4 w-4" />}>
                  <input
                    required
                    className={`form-input ${errors.name ? 'border-destructive' : ''}`}
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                  />
                </Field>
                <Field label="Business / Company" icon={<Building2 className="h-4 w-4" />}>
                  <input className="form-input" placeholder="Acme Ltd."
                    value={form.business_name}
                    onChange={e => setForm({ ...form, business_name: e.target.value })} />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email Address" icon={<Mail className="h-4 w-4" />} error={errors.email}>
                  <input type="email"
                    className={`form-input ${errors.email ? 'border-destructive' : ''}`}
                    placeholder="john@acme.com"
                    value={form.email}
                    onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }); }} />
                </Field>
                <Field label="Phone Number" icon={<Phone className="h-4 w-4" />}>
                  <input className="form-input" placeholder="+1 555 000 0000"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>

              <Field label="Customer Status">
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">🟡 Lead</SelectItem>
                    <SelectItem value="active">🟢 Active</SelectItem>
                    <SelectItem value="inactive">🔴 Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Address" icon={<MapPin className="h-4 w-4" />}>
                <input className="form-input" placeholder="123 Main St, City, Country"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })} />
              </Field>

              <Field label="Notes" icon={<StickyNote className="h-4 w-4" />}>
                <textarea
                  className="form-input min-h-[120px] resize-none"
                  placeholder="Project requirements, preferences, or any relevant notes..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {/* ── RIGHT: Sticky Provision Panel ─────────────────────────── */}
          <aside className="lg:sticky lg:top-6 space-y-4">
            <div className={`rounded-2xl border overflow-hidden ${
              skipProvision ? 'opacity-60' : ''
            } ${crmType === 'load_balancer' ? 'border-blue-500/20' : 'border-violet-500/20'}`}>
              {/* Panel header */}
              <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
                crmType === 'load_balancer' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-violet-500/5 border-violet-500/20'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${crmType === 'load_balancer' ? 'bg-blue-500/10' : 'bg-violet-500/10'}`}>
                    {crmType === 'load_balancer'
                      ? <Network className="h-4 w-4 text-blue-400" />
                      : <Layers className="h-4 w-4 text-violet-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {crmType === 'load_balancer' ? 'Load Balancer' : 'Application'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Provisioning (optional)</p>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    checked={skipProvision}
                    onChange={e => setSkipProvision(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary rounded"
                  />
                  Skip
                </label>
              </div>

              {/* Provision form body */}
              {!skipProvision && (
                <div className="p-5 bg-card space-y-4">
                  {crmType === 'load_balancer' ? (
                    <>
                      <Field label="Select Load Balancer" required error={errors.load_balancer_id}>
                        <Select value={lbForm.load_balancer_id} onValueChange={v => setLbForm({ ...lbForm, load_balancer_id: v })}>
                          <SelectTrigger className="bg-transparent">
                            <SelectValue placeholder="-- Choose load balancer --" />
                          </SelectTrigger>
                          <SelectContent>
                            {loadBalancers.map(lb => (
                              <SelectItem key={lb.id} value={String(lb.id)}>
                                {lb.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium">Domain Mode</label>
                        <div className="flex bg-muted rounded-lg p-0.5">
                          <button type="button" onClick={() => setDomainMode('subdomain')}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${domainMode === 'subdomain' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Subdomain</button>
                          <button type="button" onClick={() => setDomainMode('custom')}
                            className={`px-3 py-1 text-xs rounded-md transition-all ${domainMode === 'custom' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Custom</button>
                        </div>
                      </div>
                      <Field label={domainMode === 'subdomain' ? "Subdomain (Auto)" : "Custom Domain"} error={errors.lb_domain}>
                        <div className={`flex items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-primary/50 transition-all ${domainMode === 'subdomain' && defaultDomain ? 'bg-muted/30 cursor-not-allowed' : ''}`}>
                          <input
                            className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed"
                            placeholder={domainMode === 'subdomain' ? "Generated automatically..." : "customer.yourdomain.com"}
                            value={lbForm.domain}
                            onChange={e => {
                              setLbForm({ ...lbForm, domain: e.target.value });
                              if (domainMode === 'subdomain') setIsSubdomainEdited(true);
                            }}
                          />
                          {domainMode === 'subdomain' && defaultDomain && (
                            <div className="flex items-center px-3 border-l border-input bg-muted/20 select-none">
                              <span className="text-sm font-medium text-muted-foreground">.{defaultDomain}</span>
                            </div>
                          )}
                        </div>
                        {domainMode === 'subdomain' && defaultDomain && !lbForm.domain && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">Enter customer name to generate subdomain.</p>
                        )}
                      </Field>
                    </>
                  ) : (
                    <>
                      {/* App mode toggle */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'existing', label: 'Existing App', icon: <Layers className="h-3.5 w-3.5" /> },
                          { value: 'new', label: 'New App', icon: <Plus className="h-3.5 w-3.5" /> },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => setAppMode(opt.value)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                              appMode === opt.value
                                ? 'bg-primary/10 border-primary/40 text-primary'
                                : 'border-border hover:bg-muted text-muted-foreground'
                            }`}>
                            {opt.icon} {opt.label}
                          </button>
                        ))}
                      </div>

                      {appMode === 'existing' ? (
                        <Field label="Select App" required error={errors.selected_app_id}>
                          <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                            <SelectTrigger className="bg-transparent">
                              <SelectValue placeholder="-- Choose an existing app --" />
                            </SelectTrigger>
                            <SelectContent>
                              {apps.map(app => (
                                <SelectItem key={app.id} value={String(app.id)}>
                                  {app.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      ) : (
                        <div className="space-y-3">
                          <Field label="App Name (auto)">
                            <input className="form-input bg-muted/50 cursor-not-allowed text-xs" readOnly
                              value={appName || 'derived-from-customer-name'}
                              title="Automatically set from customer / business name" />
                          </Field>
                          <Field label="Type">
                            <Select value={appForm.type} onValueChange={v => setAppForm({ ...appForm, type: v })}>
                              <SelectTrigger className="bg-transparent"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nextjs">Next.js</SelectItem>
                                <SelectItem value="laravel">Laravel</SelectItem>
                                <SelectItem value="static">Static HTML</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium">Domain Mode</label>
                            <div className="flex bg-muted rounded-lg p-0.5">
                              <button type="button" onClick={() => setDomainMode('subdomain')}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${domainMode === 'subdomain' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Subdomain</button>
                              <button type="button" onClick={() => setDomainMode('custom')}
                                className={`px-3 py-1 text-xs rounded-md transition-all ${domainMode === 'custom' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Custom</button>
                            </div>
                          </div>
                          <Field label={domainMode === 'subdomain' ? "Subdomain (Auto)" : "Custom Domain"} required error={errors.app_domain}>
                            <div className={`flex items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-primary/50 transition-all ${domainMode === 'subdomain' && defaultDomain ? 'bg-muted/30 cursor-not-allowed' : ''}`}>
                              <input 
                                className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed"
                                placeholder={domainMode === 'subdomain' ? "Generated automatically..." : "app.customer.com"}
                                value={appForm.domain}
                                onChange={e => {
                                  setAppForm({ ...appForm, domain: e.target.value });
                                  if (domainMode === 'subdomain') setIsSubdomainEdited(true);
                                }} 
                              />
                              {domainMode === 'subdomain' && defaultDomain && (
                                <div className="flex items-center px-3 border-l border-input bg-muted/20 select-none">
                                  <span className="text-sm font-medium text-muted-foreground">.{defaultDomain}</span>
                                </div>
                              )}
                            </div>
                          </Field>

                          {isGithubConnected && repos.length > 0 && (
                            <Field label="GitHub Repository">
                              <Select
                                value={appForm.github_id ? String(appForm.github_id) : ''}
                                onValueChange={v => {
                                  const repo = repos.find(r => r.id === parseInt(v));
                                  if (repo) setAppForm({ ...appForm, git_url: repo.clone_url, github_full_name: repo.full_name, github_id: repo.id, branch: repo.default_branch || 'main' });
                                }}
                              >
                                <SelectTrigger className="bg-transparent">
                                  <SelectValue placeholder="-- Select repo (optional) --" />
                                </SelectTrigger>
                                <SelectContent>
                                  {repos.map(r => <SelectItem key={r.id} value={String(r.id)}>{r.full_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </Field>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Git URL *" required error={errors.git_url}>
                              <input className={`form-input text-xs ${errors.git_url ? 'border-destructive' : ''}`}
                                placeholder="https://github.com/..."
                                value={appForm.git_url}
                                onChange={e => setAppForm({ ...appForm, git_url: e.target.value })} />
                            </Field>
                            <Field label="Branch">
                              <input className="form-input text-xs" placeholder="main"
                                value={appForm.branch}
                                onChange={e => setAppForm({ ...appForm, branch: e.target.value })} />
                            </Field>
                          </div>

                          <div className="space-y-2">
                            {appForm.github_full_name && (
                              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer text-xs">
                                <input type="checkbox" checked={appForm.auto_deploy}
                                  onChange={e => setAppForm({ ...appForm, auto_deploy: e.target.checked })}
                                  className="h-3.5 w-3.5 accent-primary" />
                                Auto-deploy on push
                              </label>
                            )}
                            {appForm.type === 'laravel' && (
                              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 cursor-pointer text-xs">
                                <input type="checkbox" checked={appForm.auto_db_create}
                                  onChange={e => setAppForm({ ...appForm, auto_db_create: e.target.checked })}
                                  className="h-3.5 w-3.5 accent-primary" />
                                Auto-create PostgreSQL database
                              </label>
                            )}
                          </div>

                          <Field label="Env Variables">
                            <textarea className="form-input font-mono text-xs resize-none min-h-[80px]"
                              placeholder={"APP_KEY=...\nDB_HOST=..."}
                              value={appForm.env_vars}
                              onChange={e => setAppForm({ ...appForm, env_vars: e.target.value })} />
                          </Field>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {skipProvision && (
                <div className="px-5 py-4 bg-card">
                  <p className="text-xs text-muted-foreground">
                    Provisioning skipped. You can set this up anytime from the CRM customer list.
                  </p>
                </div>
              )}
            </div>

            {/* Deploy logs if deploying */}
            {(logs.length > 0 || isDeploying) && (
              <div className="bg-[#0f1115] border border-[#1f2937] rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[#1a1d23] border-b border-[#1f2937] flex items-center justify-between">
                  <span className="text-gray-400 text-xs font-mono flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Deployment Console
                  </span>
                  {isDeploying && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse inline-block" />
                      <span className="text-[10px] text-primary font-bold uppercase">Live</span>
                    </div>
                  )}
                </div>
                <div className="h-40 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
                  {logs.map((line, i) => {
                    let color = 'text-gray-400';
                    if (line.includes('ERROR') || line.includes('failed')) color = 'text-red-400';
                    if (line.includes('success') || line.includes('complete') || line.includes('Complete')) color = 'text-green-400';
                    if (line.includes('Initiat') || line.includes('Trigger') || line.includes('created')) color = 'text-blue-400';
                    return (
                      <div key={i} className={`${color} flex gap-2`}>
                        <span className="text-gray-700 select-none">[{i+1}]</span>
                        <span>{line}</span>
                      </div>
                    );
                  })}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button type="submit" disabled={submitting || isDeploying}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm">
                {submitting
                  ? <><RefreshCw className="h-4 w-4 animate-spin" /> {isEdit ? 'Saving...' : 'Creating...'}</>
                  : skipProvision || (isEdit && provisionedResource)
                    ? <><CheckCircle2 className="h-4 w-4" /> {isEdit ? 'Save Changes' : 'Create Customer'}</>
                    : <><Zap className="h-4 w-4" /> {isEdit ? 'Save & Provision' : 'Create & Provision'}</>
                }
              </button>
              <button type="button" onClick={() => navigate('/crm')}
                className="w-full py-2.5 border rounded-xl text-sm hover:bg-muted transition-colors text-muted-foreground">
                Cancel
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

// ── Shared field wrapper ───────────────────────────────────────────────────────
function Field({ label, required, icon, error, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium flex items-center gap-1.5 text-foreground/90">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
