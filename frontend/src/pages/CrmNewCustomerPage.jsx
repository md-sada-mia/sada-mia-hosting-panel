import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Users, Building2, Mail, Phone, MapPin, StickyNote,
  Network, Layers, Plus, RefreshCw, Zap, Github, Terminal,
  ChevronRight, CheckCircle2, AlertCircle, ExternalLink, Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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

  // ── Deployment state ────────────────────────────────────────────────────────
  const [skipDeployment, setSkipDeployment] = useState(false);
  const [appMode, setAppMode] = useState('new'); // 'existing' or 'new'
  const [selectedAppId, setSelectedAppId] = useState('');
  const [appForm, setAppForm] = useState({
    type: 'nextjs', domain: '', git_url: '', branch: 'main',
    github_full_name: '', github_id: '', auto_deploy: false, env_vars: '', auto_db_create: true,
  });
  const [lbForm, setLbForm] = useState({ load_balancer_id: '', domain: '' });
  const [deployedResource, setDeployedResource] = useState(null);

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Deploy logs ────────────────────────────────────────────────────────────
  const [deployingApp, setDeployingApp] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [done, setDone] = useState(false);
  const logEndRef = useRef(null);

  // Domain Editing State
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [newDomainValue, setNewDomainValue] = useState('');
  const [isUpdatingDomain, setIsUpdatingDomain] = useState(false);

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
      setDefaultDomain(settingsRes.data.crm_default_deployment_domain || '');
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
          setSkipDeployment(true); // Already deployed
          setDeployedResource(customer.resource);
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

  const updateDomain = async () => {
    if (!newDomainValue.trim()) {
      toast.error("Domain cannot be empty");
      return;
    }

    try {
      setIsUpdatingDomain(true);
      const { data } = await api.put(`/customers/${id}/domain`, { domain: newDomainValue.trim() });
      toast.success(data.message);
      setDeployedResource(data.customer.resource);
      setIsEditingDomain(false);
    } catch (error) {
      console.error('Update domain error:', error);
      toast.error(error.response?.data?.message || 'Failed to update domain');
    } finally {
      setIsUpdatingDomain(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    
    if (!skipDeployment) {
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

      // 2. Deploy (if not skipped and not already deployed)
      if (!skipDeployment && !customer.resource_type) {
        let payload = {};
        if (crmType === 'load_balancer') {
          payload = { 
            ...lbForm, 
            domain_mode: domainMode,
            domain: (domainMode === 'subdomain' && defaultDomain) 
              ? `${lbForm.domain}.${defaultDomain}` 
              : lbForm.domain 
          };
        } else if (appMode === 'existing') {
          payload = { app_id: selectedAppId, domain_mode: 'existing' };
        } else {
          payload = { 
            ...appForm, 
            domain_mode: domainMode,
            domain: (domainMode === 'subdomain' && defaultDomain) 
              ? `${appForm.domain}.${defaultDomain}` 
              : appForm.domain 
          };
        }

        const { data: updated } = await api.post(`/customers/${customer.id}/deploy`, payload);
        setDeployedResource(updated.resource);

        if (crmType === 'app' && appMode === 'new' && updated.resource?.type === 'app') {
          setDeployingApp(updated.resource);
          setIsDeploying(true);
          setLogs(['App created. Triggering initial deployment...']);
          toast.success(isEdit ? 'Customer updated and app deployed!' : 'Customer created and app deployed!');
        } else {
          toast.success(isEdit ? 'Customer updated and resource deployed!' : 'Customer created and resource deployed!');
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
            {deployedResource
              ? `${form.name} ${isEdit ? 'information has been updated' : 'has been added'} and a ${deployedResource.type === 'load_balancer' ? 'load balancer domain' : 'app'} has been deployed.`
              : `${form.name} ${isEdit ? 'information has been updated' : 'has been added'} successfully.`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {deployedResource && (
            <Button 
              variant="outline" 
              onClick={() => deployedResource.type === 'app'
              ? navigate(`/apps/${deployedResource.id}`)
              : navigate(`/load-balancers/${deployedResource.id}/manage`)}>
              Manage {deployedResource.type === 'app' ? 'App' : 'Load Balancer'}
            </Button>
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
            {isEdit ? 'Update details or deploy additional resources.' : 'Fill in customer details and optionally set up their hosting resource.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* ── LEFT: Customer Details ─────────────────────────────────── */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b flex items-center gap-3 bg-muted/20">
              <div className="p-2 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-foreground">Customer Information</h2>
                <p className="text-xs text-muted-foreground">Personal and contact details</p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full Name" required error={errors.name} icon={<Users className="h-4 w-4" />}>
                  <input
                    required
                    className={`form-input focus:ring-2 focus:ring-primary/20 ${errors.name ? 'border-destructive' : ''}`}
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                  />
                </Field>
                <Field label="Business / Company" icon={<Building2 className="h-4 w-4" />}>
                  <input className="form-input focus:ring-2 focus:ring-primary/20" placeholder="Acme Ltd."
                    value={form.business_name}
                    onChange={e => setForm({ ...form, business_name: e.target.value })} />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email Address" icon={<Mail className="h-4 w-4" />} error={errors.email}>
                  <input type="email"
                    className={`form-input focus:ring-2 focus:ring-primary/20 ${errors.email ? 'border-destructive' : ''}`}
                    placeholder="john@acme.com"
                    value={form.email}
                    onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }); }} />
                </Field>
                <Field label="Phone Number" icon={<Phone className="h-4 w-4" />}>
                  <input className="form-input focus:ring-2 focus:ring-primary/20" placeholder="+1 555 000 0000"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>

              <Field label="Customer Status">
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-transparent focus:ring-2 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">🟡 Lead</SelectItem>
                    <SelectItem value="active">🟢 Active</SelectItem>
                    <SelectItem value="inactive">🔴 Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Address" icon={<MapPin className="h-4 w-4" />}>
                <input className="form-input focus:ring-2 focus:ring-primary/20" placeholder="123 Main St, City, Country"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })} />
              </Field>

              <Field label="Notes" icon={<StickyNote className="h-4 w-4" />}>
                <textarea
                  className="form-input min-h-[120px] resize-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Project requirements, preferences, or any relevant notes..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
          </div>

      {/* ── RIGHT: Sticky Deployment Panel ─────────────────────────── */}
      <aside className="lg:sticky lg:top-6 space-y-4">
        {isEdit && deployedResource ? (
          <div className={`rounded-2xl border-2 overflow-hidden shadow-xl bg-card/50 backdrop-blur-sm ${
            deployedResource.type === 'load_balancer' ? 'border-blue-500/20' : 'border-violet-500/20'
          }`}>
            <div className={`px-5 py-5 border-b flex items-center justify-between gap-3 ${
              deployedResource.type === 'load_balancer' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-violet-500/5 border-violet-500/20'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl scale-110 ${deployedResource.type === 'load_balancer' ? 'bg-blue-500/10' : 'bg-violet-500/10'}`}>
                  {deployedResource.type === 'load_balancer'
                    ? <Network className="h-5 w-5 text-blue-400" />
                    : <Layers className="h-5 w-5 text-violet-400" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-foreground">
                    Active Deployment
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    {deployedResource.type === 'load_balancer' ? 'Load Balancer' : 'Application'}
                  </p>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                Deployed
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-muted/30 p-4 rounded-xl border border-dashed text-sm space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground uppercase tracking-wider font-bold">Name</span>
                  <span className="font-semibold">{deployedResource.name}</span>
                </div>
                <div className="flex justify-between items-start text-xs border-b border-muted/50 pb-2">
                  <span className="text-muted-foreground uppercase tracking-wider font-bold mt-1">Domain</span>
                  <div className="flex flex-col items-end gap-1 text-right">
                    {isEditingDomain ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input
                          type="text"
                          value={newDomainValue}
                          onChange={(e) => setNewDomainValue(e.target.value)}
                          placeholder="subdomain.example.com"
                          className="px-2 py-1 text-xs border rounded bg-background w-32 focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <button
                          onClick={updateDomain}
                          disabled={isUpdatingDomain}
                          className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {isUpdatingDomain ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Save"}
                        </button>
                        <button
                          onClick={() => setIsEditingDomain(false)}
                          disabled={isUpdatingDomain}
                          className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : deployedResource.deployment_info?.domain ? (
                      <div className="flex items-center gap-2 group">
                        <span className="font-medium bg-muted/50 px-2 py-0.5 rounded-md border">{deployedResource.deployment_info.domain}</span>
                        {(deployedResource.deployment_info.domain_mode === 'subdomain' || deployedResource.deployment_info.domain_mode === 'custom') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setNewDomainValue(deployedResource.deployment_info.domain);
                              setIsEditingDomain(true);
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                            title="Edit Domain"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ) : deployedResource.domain ? (
                      <span className="font-medium bg-muted/50 px-2 py-0.5 rounded-md border">{deployedResource.domain}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </div>
                </div>

                {/* Show detailed config if available */}
                {deployedResource.deployment_info && (
                  <div className="pt-1 flex flex-col gap-2">
                    <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 mb-1">Configuration snapshot</p>
                    
                    {deployedResource.deployment_info.domain_mode && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground uppercase tracking-wider font-bold">Domain Mode</span>
                        <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">{deployedResource.deployment_info.domain_mode}</span>
                      </div>
                    )}

                    {deployedResource.deployment_info.resource_type === 'app' && !deployedResource.deployment_info.existing_app && (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground uppercase tracking-wider font-bold">App Stack</span>
                          <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">{deployedResource.deployment_info.app_type}</span>
                        </div>
                        {deployedResource.deployment_info.github_full_name && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground uppercase tracking-wider font-bold">Repository</span>
                            <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Github className="h-3 w-3" /> {deployedResource.deployment_info.github_full_name}
                            </span>
                          </div>
                        )}
                        {deployedResource.deployment_info.branch && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground uppercase tracking-wider font-bold">Branch</span>
                            <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">{deployedResource.deployment_info.branch}</span>
                          </div>
                        )}
                      </>
                    )}

                    {deployedResource.deployment_info.existing_app && (
                       <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground uppercase tracking-wider font-bold">App Mode</span>
                        <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">Linked Existing</span>
                      </div>
                    )}

                    {deployedResource.deployment_info.db_name && (
                      <div className="mt-2 p-2 border border-primary/20 bg-primary/5 rounded-lg space-y-1">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Generated Database</p>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">Database</span>
                          <span className="font-mono font-medium">{deployedResource.deployment_info.db_name}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">Username</span>
                          <span className="font-mono font-medium">{deployedResource.deployment_info.db_user}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">Password</span>
                          <span className="font-mono font-medium text-xs">••••••••</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CRM API STATUS */}
                {deployedResource.api_status && (
                  <div className="pt-3 border-t space-y-2 mt-2">
                    <p className="text-[10px] uppercase font-black tracking-widest text-primary/70 flex items-center gap-1.5">
                      <Zap className="h-3 w-3" /> CRM API STATUS
                    </p>
                    <div className="bg-muted/50 p-3 rounded-lg border flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider">Result</span>
                        <div className="flex items-center gap-1.5">
                          {deployedResource.api_status.status_code >= 200 && deployedResource.api_status.status_code < 300 ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span className={`font-black ${deployedResource.api_status.status_code >= 200 && deployedResource.api_status.status_code < 300 ? 'text-emerald-500' : 'text-destructive'}`}>
                            {deployedResource.api_status.status_code}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider">Method</span>
                        <span className="font-mono bg-background px-1.5 py-0.5 rounded border text-[10px] uppercase">{deployedResource.api_status.method}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider">Response Data</span>
                        <div className="bg-background rounded border p-2 font-mono text-[10px] max-h-24 overflow-y-auto break-all whitespace-pre-wrap leading-relaxed shadow-inner">
                          {typeof deployedResource.api_status.response === 'string' 
                            ? deployedResource.api_status.response 
                            : JSON.stringify(deployedResource.api_status.response, null, 2)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground/60 italic pt-1">
                        <span>Last trigger:</span>
                        <span>{new Date(deployedResource.api_status.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <button type="button" 
                onClick={() => deployedResource.type === 'app' ? navigate(`/apps/${deployedResource.id}`) : navigate(`/load-balancers/${deployedResource.id}/manage`)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl font-bold text-sm transition-all hover:bg-primary/20">
                Manage {deployedResource.type === 'load_balancer' ? 'Load Balancer' : 'App'} <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className={`rounded-2xl border-2 overflow-hidden transition-all shadow-xl bg-card/50 backdrop-blur-sm ${
            skipDeployment ? 'opacity-60 grayscale-[0.5]' : ''
          } ${crmType === 'load_balancer' ? 'border-blue-500/20' : 'border-violet-500/20'}`}>
              
              <div className={`px-5 py-5 border-b flex items-center justify-between gap-3 ${
                crmType === 'load_balancer' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-violet-500/5 border-violet-500/20'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl scale-110 ${crmType === 'load_balancer' ? 'bg-blue-500/10' : 'bg-violet-500/10'}`}>
                    {crmType === 'load_balancer'
                      ? <Network className="h-5 w-5 text-blue-400" />
                      : <Layers className="h-5 w-5 text-violet-400" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-foreground">
                      {crmType === 'load_balancer' ? 'Load Balancer' : 'Application'}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Deployment</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-muted/40 px-3 py-1.5 rounded-full border">
                  <Switch 
                    id="skip-deployment"
                    checked={skipDeployment}
                    onCheckedChange={setSkipDeployment}
                  />
                  <Label htmlFor="skip-deployment" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground cursor-pointer">Skip</Label>
                </div>
              </div>

              {/* Deployment form body */}
              {!skipDeployment && (
                <div className="p-6 space-y-5">
                  {crmType === 'load_balancer' ? (
                    <>
                      <Field label="Select Target Load Balancer" required error={errors.load_balancer_id}>
                        <Select value={lbForm.load_balancer_id} onValueChange={v => setLbForm({ ...lbForm, load_balancer_id: v })}>
                          <SelectTrigger className="bg-background border-2">
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

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Domain Settings</label>
                            {domainMode === 'subdomain' && (
                              <p className="text-[10px] text-primary/70 font-medium italic animate-pulse-slow">Prefix is auto-generated from name</p>
                            )}
                          </div>
                          <div className="flex bg-muted/50 border rounded-lg p-1 scale-90 origin-right">
                            <button type="button" onClick={() => setDomainMode('subdomain')}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${domainMode === 'subdomain' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>Subdomain</button>
                            <button type="button" onClick={() => setDomainMode('custom')}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${domainMode === 'custom' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>Custom</button>
                          </div>
                        </div>

                        <div className={`group relative transition-all ${domainMode === 'subdomain' && !isSubdomainEdited ? 'opacity-90' : ''}`}>
                          <div className={`flex items-stretch overflow-hidden rounded-xl border-2 border-input bg-background focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary transition-all`}>
                            <input
                              className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm font-medium focus:outline-none placeholder:text-muted-foreground/50"
                              placeholder={domainMode === 'subdomain' ? "prefix" : "example.com"}
                              value={lbForm.domain}
                              onChange={e => {
                                setLbForm({ ...lbForm, domain: e.target.value });
                                if (domainMode === 'subdomain') setIsSubdomainEdited(true);
                              }}
                            />
                            {domainMode === 'subdomain' && defaultDomain && (
                              <div className="flex items-center px-4 border-l-2 border-dashed border-input bg-muted/20 select-none min-w-[120px] justify-center">
                                <span className="text-sm font-bold text-muted-foreground lowercase">.{defaultDomain}</span>
                              </div>
                            )}
                          </div>
                          {errors.lb_domain && <p className="text-xs text-destructive mt-1.5 font-medium ml-1 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.lb_domain}</p>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* App mode toggle */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { value: 'existing', label: 'Existing App', icon: <Layers className="h-4 w-4" /> },
                          { value: 'new', label: 'New App', icon: <Plus className="h-4 w-4" /> },
                        ].map(opt => (
                          <button key={opt.value} type="button" onClick={() => setAppMode(opt.value)}
                            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                              appMode === opt.value
                                ? 'bg-primary/5 border-primary text-primary shadow-sm shadow-primary/10'
                                : 'border-border bg-muted/5 hover:bg-muted text-muted-foreground'
                            }`}>
                            {opt.icon} {opt.label}
                          </button>
                        ))}
                      </div>

                      {appMode === 'existing' ? (
                        <Field label="Select Registered App" required error={errors.selected_app_id}>
                          <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                            <SelectTrigger className="bg-background border-2">
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
                        <div className="space-y-4">
                          <Field label="Application Name (auto-generated)">
                            <div className="relative group">
                              <input className="form-input bg-muted/40 cursor-not-allowed border-2 text-sm font-semibold opacity-70" readOnly
                                value={appName || 'customer-app-name'} />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <RefreshCw className="h-3 w-3 text-muted-foreground/50 animate-spin-slow" />
                              </div>
                            </div>
                          </Field>

                          <Field label="Application Stack">
                            <Select value={appForm.type} onValueChange={v => setAppForm({ ...appForm, type: v })}>
                              <SelectTrigger className="bg-background border-2 font-medium"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nextjs">Next.js</SelectItem>
                                <SelectItem value="laravel">Laravel</SelectItem>
                                <SelectItem value="static">Static HTML</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-0.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Domain Settings</label>
                                {domainMode === 'subdomain' && (
                                  <p className="text-[10px] text-primary/70 font-medium italic animate-pulse-slow">Prefix is auto-generated from name</p>
                                )}
                              </div>
                              <div className="flex bg-muted/50 border rounded-lg p-1 scale-90 origin-right">
                                <button type="button" onClick={() => setDomainMode('subdomain')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${domainMode === 'subdomain' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>Subdomain</button>
                                <button type="button" onClick={() => setDomainMode('custom')}
                                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${domainMode === 'custom' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>Custom</button>
                              </div>
                            </div>

                            <div className="relative group">
                              <div className={`flex items-stretch overflow-hidden rounded-xl border-2 border-input bg-background focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary transition-all`}>
                                <input 
                                  className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm font-medium focus:outline-none placeholder:text-muted-foreground/50"
                                  placeholder={domainMode === 'subdomain' ? "prefix" : "app.customer.com"}
                                  value={appForm.domain}
                                  onChange={e => {
                                    setAppForm({ ...appForm, domain: e.target.value });
                                    if (domainMode === 'subdomain') setIsSubdomainEdited(true);
                                  }} 
                                />
                                {domainMode === 'subdomain' && defaultDomain && (
                                  <div className="flex items-center px-4 border-l-2 border-dashed border-input bg-muted/20 select-none min-w-[120px] justify-center">
                                    <span className="text-sm font-bold text-muted-foreground lowercase">.{defaultDomain}</span>
                                  </div>
                                )}
                              </div>
                              {errors.app_domain && <p className="text-xs text-destructive mt-1.5 font-medium ml-1 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.app_domain}</p>}
                            </div>
                          </div>

                          {isGithubConnected && repos.length > 0 && (
                            <Field label="GitHub Integration (Optional)">
                              <Select
                                value={appForm.github_id ? String(appForm.github_id) : ''}
                                onValueChange={v => {
                                  const repo = repos.find(r => r.id === parseInt(v));
                                  if (repo) setAppForm({ ...appForm, git_url: repo.clone_url, github_full_name: repo.full_name, github_id: repo.id, branch: repo.default_branch || 'main' });
                                }}
                              >
                                <SelectTrigger className="bg-background border-2">
                                  <div className="flex items-center gap-2">
                                    <Github className="h-3.5 w-3.5" />
                                    <SelectValue placeholder="Link repository..." />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {repos.map(r => (
                                    <SelectItem key={r.id} value={String(r.id)}>{r.full_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          )}

                          <div className="grid gap-3">
                            <Field label="Repository Source URL" required error={errors.git_url}>
                              <input className={`form-input border-2 text-xs font-mono bg-muted/20 ${errors.git_url ? 'border-destructive' : ''}`}
                                placeholder="https://github.com/user/repo"
                                value={appForm.git_url}
                                onChange={e => setAppForm({ ...appForm, git_url: e.target.value })} />
                            </Field>
                            <Field label="Branch">
                              <input className="form-input border-2 text-xs font-mono bg-muted/20" placeholder="main"
                                value={appForm.branch}
                                onChange={e => setAppForm({ ...appForm, branch: e.target.value })} />
                            </Field>
                          </div>

                          <Field label="Environment Variables (Optional)">
                            <textarea
                              className="form-input min-h-[100px] resize-none border-2 text-xs font-mono bg-muted/20"
                              placeholder={"KEY=VALUE\nPORT=3000"}
                              value={appForm.env_vars}
                              onChange={e => setAppForm({ ...appForm, env_vars: e.target.value })}
                            />
                          </Field>

                          {appForm.type === 'laravel' && (
                            <div className="flex items-center justify-between p-3 rounded-xl border-2 bg-muted/10">
                              <div className="space-y-0.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-foreground">Auto Database</label>
                                <p className="text-[10px] text-muted-foreground">Create & link a PostgreSQL database</p>
                              </div>
                              <Switch 
                                checked={appForm.auto_db_create}
                                onCheckedChange={v => setAppForm({ ...appForm, auto_db_create: v })}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {isDeploying && (
                    <div className="mt-6 rounded-2xl border-2 border-primary/20 bg-[#0f1115] overflow-hidden shadow-2xl">
                      <div className="px-4 py-3 border-b border-primary/10 bg-primary/5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Terminal className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Deploy Output</span>
                        </div>
                        <div className="flex items-center gap-2 bg-primary/20 px-2 py-0.5 rounded-full">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <span className="text-[9px] text-primary font-bold uppercase tracking-widest">Live</span>
                        </div>
                      </div>
                      <div className="h-48 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed custom-scrollbar bg-black/40">
                        {logs.map((line, i) => {
                          let color = 'text-gray-400';
                          if (line.includes('ERROR') || line.includes('failed')) color = 'text-red-400';
                          if (line.includes('success') || line.includes('complete') || line.includes('Complete')) color = 'text-green-400';
                          if (line.includes('Initiat') || line.includes('Trigger') || line.includes('created')) color = 'text-blue-400';
                          return (
                            <div key={i} className={`${color} flex gap-2.5 mb-1 last:mb-0`}>
                              <span className="text-white/10 select-none font-bold min-w-[20px]">{i+1}</span>
                              <span className="break-all">{line}</span>
                            </div>
                          );
                        })}
                        <div ref={logEndRef} />
                      </div>
                    </div>
                  )}

              </div>
            )}

            {skipDeployment && (
              <div className="p-8 bg-card flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-3xl bg-orange-500/10 border-2 border-orange-500/20">
                  <AlertCircle className="h-10 w-10 text-orange-400 opacity-60" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Deployment Skipped</p>
                  <p className="text-[11px] text-muted-foreground mt-1 px-4">
                    No hosting resource will be created. You can deploy later from the CRM dashboard.
                  </p>
                </div>
                <button type="button" onClick={() => setSkipDeployment(false)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline transition-all">Enable Deployment</button>
              </div>
            )}
          </div>
        )}

        {/* Sidebar Action buttons */}
        <div className="pt-2 space-y-2">
          <button type="submit" disabled={submitting || isDeploying}
            className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:translate-y-[-2px] hover:shadow-lg hover:shadow-primary/20 active:translate-y-[0px] transition-all disabled:opacity-50 disabled:translate-y-0 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10 transition-all group-hover:h-2" />
            {submitting
              ? <><RefreshCw className="h-5 w-5 animate-spin" /> {isEdit ? 'Saving...' : 'Creating...'}</>
              : skipDeployment || (isEdit && deployedResource)
                ? <>{isEdit ? 'Update Details' : 'Create Customer'}</>
                : <><Zap className="h-5 w-5" /> {isEdit ? 'Save & Deploy' : 'Create & Deploy'}</>
            }
          </button>
          <button type="button" onClick={() => navigate('/crm')}
            className="w-full py-3.5 border-2 rounded-2xl text-xs font-bold hover:bg-muted/50 transition-all text-muted-foreground uppercase tracking-widest">
            Discard Changes
          </button>
        </div>

        {/* Support box */}
            <div className="p-5 rounded-2xl border bg-muted/30 border-dashed animate-pulse-slow">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1">Need Help?</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If you encounter any issues during deployment, please check the system connection in settings.
              </p>
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
          {icon && <span className="opacity-60">{icon}</span>}
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      </div>
      {children}
      {error && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive px-1.5 py-1 bg-destructive/10 rounded-md border border-destructive/20 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}
    </div>
  );
}
