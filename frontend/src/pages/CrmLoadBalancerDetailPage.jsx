import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Network, Globe, Server, RefreshCw, Loader2, ExternalLink,
  Shield, AlertCircle, Info, Check, AlertTriangle, Zap, CheckCircle2,
  XCircle, Box, Clock, Copy, ChevronRight, Edit2, RotateCcw, Trash2, FileText, ScrollText,
  CreditCard, Star, Calendar, TrendingUp, Coins, Plus, Square, Play, Package, Settings, Rocket
} from 'lucide-react';

const stripAnsi = (str) => {
  if (!str) return '';
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

// ── Copy Button ──────────────────────────────────────────────────────────────
function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Stat Cell ────────────────────────────────────────────────────────────────
function StatCell({ label, value, className = '' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">{label}</span>
      <span className={`text-sm font-semibold ${className}`}>{value || '—'}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CrmLoadBalancerDetailPage() {
  const { id: customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [domainRecord, setDomainRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [domainLoading, setDomainLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [parentDomain, setParentDomain] = useState(null);

  // Domain edit state
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [isUpdatingDomain, setIsUpdatingDomain] = useState(false);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslDetails, setSslDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Logs state
  const [logs, setLogs] = useState({ 'server-error': '', 'server-access': '' });
  const [logsLoading, setLogsLoading] = useState({ 'server-error': false, 'server-access': false });
  const [activeLogTab, setActiveLogTab] = useState('server-error');

  // Subscription state
  const [subData, setSubData] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState(false);
  const [activateForm, setActivateForm] = useState({ plan_id: '', custom_ends_at: '' });
  const [isVisibilityDialogOpen, setIsVisibilityDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [visiblePlanIds, setVisiblePlanIds] = useState([]);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  // Deployments state
  const [deployments, setDeployments] = useState([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showCrmLogs, setShowCrmLogs] = useState(false);
  const [crmLogs, setCrmLogs] = useState([]);
  const [crmLogsLoading, setCrmLogsLoading] = useState(false);

  // Derived state (Moved up to follow Rules of Hooks)
  const resource = customer?.resource;
  const deploymentDomain = resource?.deployment_info?.domain;
  const apiLogs = customer?.resource?.api_logs || {};
  const authStatus = apiLogs.auth;
  const syncStatus = apiLogs.sync;
  const lb = resource; // resource is the LB object for load_balancer type
  const domainMode = resource?.deployment_info?.domain_mode;
  
  // Predict if it's a subdomain if domain_mode is missing
  const isSubdomain = domainMode === 'subdomain' || (!domainMode && deploymentDomain && deploymentDomain.split('.').length > 2);

  // Find matching LB domain object
  const lbDomain = lb?.domains?.find(d => typeof d === 'object' && d.domain === deploymentDomain) || 
                  (typeof lb?.domains?.[0] === 'object' ? lb.domains[0] : null);

  useEffect(() => {
    if (activeTab === 'ssl' && lbDomain?.id) {
      fetchSslDetails();
    }
    if (activeTab === 'logs' && lbDomain?.id) {
      loadLogs(activeLogTab);
    }
    if (activeTab === 'deployments') {
      loadDeployments();
    }
  }, [activeTab, activeLogTab, lbDomain?.id]);

  useEffect(() => {
    let interval;
    const pollingRequired = isDeploying || (customer?.resource?.deployment_info?.status === 'deploying');
    
    if (pollingRequired) {
      interval = setInterval(() => {
        fetchCustomer(true);
        if (activeTab === 'deployments') loadDeployments(true);
      }, 3000);
    }
    
    // Logic to reset the local "isDeploying" state once the backend status is no longer 'deploying'
    if (isDeploying && customer?.resource?.deployment_info?.status && customer?.resource?.deployment_info?.status !== 'deploying') {
      setIsDeploying(false);
    }
    
    return () => clearInterval(interval);
  }, [isDeploying, customer?.resource?.deployment_info?.status, activeTab]);

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  useEffect(() => {
    if (subData?.domain) fetchVisibility(subData.domain);
  }, [subData?.domain]);

  const fetchVisibility = async (domain) => {
    setVisibilityLoading(true);
    try {
      const { data } = await api.get(`/subscription/domain-plans/${domain}`);
      setVisiblePlanIds(data || []);
    } catch {
      toast.error('Failed to load visibility settings');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    setSubLoading(true);
    try {
      const { data } = await api.get(`/customers/${customerId}/subscriptions`);
      setSubData(data);
    } catch {
      toast.error('Failed to load subscriptions');
    } finally {
      setSubLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const { data } = await api.get('/subscription/admin-plans');
      setPlans(data);
    } catch {
      toast.error('Failed to load plans');
    }
  };

  const handleActivateSubscription = async (e) => {
    e.preventDefault();
    if (!activateForm.plan_id) return toast.error('Please select a plan');
    setActivatingPlan(true);
    try {
      await api.post(`/customers/${customerId}/subscriptions/activate`, activateForm);
      toast.success('Subscription activated successfully!');
      setIsActivateOpen(false);
      setActivateForm({ plan_id: '', custom_ends_at: '' });
      fetchSubscriptions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to activate subscription');
    } finally {
      setActivatingPlan(false);
    }
  };

  const handleToggleSuspend = async () => {
    setActionLoading(true);
    try {
      const { data } = await api.post(`/customers/${customerId}/toggle-suspend`);
      toast.success(data.message);
      fetchCustomer(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle suspension');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchCustomer = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data } = await api.get(`/customers/${customerId}`);
      setCustomer(data);
      if (data.resource?.deployment_info?.domain) {
        fetchDomainRecord(data.resource.deployment_info.domain);
        fetchParentDomain(data.resource.deployment_info.domain);
      }
    } catch {
      toast.error('Failed to load customer resource');
      navigate('/crm');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDomainRecord = async (domainName) => {
    setDomainLoading(true);
    try {
      const { data } = await api.get('/domains');
      const match = data.find(d => d.domain?.toLowerCase() === domainName?.toLowerCase());
      setDomainRecord(match || null);
    } catch { /* silent */ } finally {
      setDomainLoading(false);
    }
  };

  const fetchParentDomain = async (domainName) => {
    try {
      const { data } = await api.get(`/domains/find-parent?domain=${domainName}`);
      setParentDomain(data);
    } catch {
      setParentDomain(null);
    }
  };

  const handleSetupSsl = async () => {
    if (!lbDomain) return;
    setSslLoading(true);
    try {
      const { data } = await api.post(`/load-balancers/domains/${lbDomain.id}/ssl/setup`);
      toast.success(data.message || 'SSL setup initiated!');
      fetchCustomer();
    } catch (err) {
      toast.error(err.response?.data?.message || 'SSL setup failed.');
      fetchCustomer();
    } finally {
      setSslLoading(false);
    }
  };

  const handleRemoveSsl = async () => {
    if (!lbDomain) return;
    setSslLoading(true);
    try {
      const { data } = await api.post(`/load-balancers/domains/${lbDomain.id}/ssl/remove`);
      toast.success(data.message || 'SSL removed!');
      fetchCustomer();
    } catch (err) {
      toast.error('Failed to remove SSL');
      fetchCustomer();
    } finally {
      setSslLoading(false);
    }
  };

  const fetchDeployments = async (silent = false) => {
    if (!silent) setDeploymentsLoading(true);
    try {
      const { data } = await api.get(`/customers/${customerId}/deployments`);
      setDeployments(data);
    } catch {
      toast.error('Failed to load deployment history');
    } finally {
      setDeploymentsLoading(false);
    }
  };

  const loadDeployments = (silent = false) => fetchDeployments(silent);

  const fetchCrmLogs = async () => {
    setCrmLogsLoading(true);
    try {
      const { data } = await api.get(`/customers/${customerId}/crm-logs`);
      setCrmLogs(data);
    } catch {
      toast.error('Failed to load CRM API logs');
    } finally {
      setCrmLogsLoading(false);
    }
  };

  const handleRedeploy = async () => {
    if (isDeploying) return;
    setActionLoading(true);
    try {
      await api.post(`/customers/${customerId}/deploy`, {
        load_balancer_id: lb?.id,
        domain: deploymentDomain,
        domain_mode: domainMode
      });
      setIsDeploying(true);
      setActiveTab('deployments');
      toast.success('Redeployment initiated!');
      fetchCustomer(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate redeploy');
    } finally {
      setActionLoading(false);
    }
  };


  const loadLogs = async (type = 'server-error', force = false) => {
    if (!lbDomain?.id) return;
    if (!force && logs[type]) return;

    setLogsLoading(prev => ({ ...prev, [type]: true }));
    try {
      const { data } = await api.get(`/load-balancers/domains/${lbDomain.id}/logs?type=${type}`);
      setLogs(prev => ({ ...prev, [type]: data.logs }));
    } catch {
      toast.error(`Failed to load ${type} logs`);
    } finally {
      setLogsLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleUpdateDomain = async () => {
    if (!newDomain.trim()) return toast.error('Domain cannot be empty');
    setIsUpdatingDomain(true);
    try {
      const { data } = await api.put(`/customers/${customerId}/domain`, { domain: newDomain.trim() });
      setCustomer(data.customer);
      setIsEditingDomain(false);
      toast.success('Domain updated');
      if (data.customer?.resource?.deployment_info?.domain) {
        fetchDomainRecord(data.customer.resource.deployment_info.domain);
        fetchParentDomain(data.customer.resource.deployment_info.domain);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update domain');
    } finally {
      setIsUpdatingDomain(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!customer) return null;


  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/crm')}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Network className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {deploymentDomain || 'Load Balancer Resource'}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {customer.name}
                  {customer.business_name && ` · ${customer.business_name}`}
                  {lb?.name && ` · via ${lb.name}`}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                (customer?.resource?.deployment_info?.status === 'deactivated' || lb?.status === 'deactivated')
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : (lb?.status === 'active' || lb?.status === 'running' || lb?.status === 'idle')
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  (customer?.resource?.deployment_info?.status === 'deactivated' || lb?.status === 'deactivated')
                    ? 'bg-rose-500'
                    : (lb?.status === 'active' || lb?.status === 'running' || lb?.status === 'idle')
                    ? 'bg-emerald-500'
                    : 'bg-amber-500 animate-pulse'
                }`} />
                {(customer?.resource?.deployment_info?.status === 'deactivated' || lb?.status === 'deactivated') 
                  ? 'stopped' 
                  : ((lb?.status === 'active' || lb?.status === 'running' || lb?.status === 'idle') ? 'running' : (lb?.status || 'pending'))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchCustomer}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {deploymentDomain && (
            <a href={`http://${deploymentDomain}`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" /> Open Site
              </Button>
            </a>
          )}
          <Button
            size="sm"
            variant={(customer?.resource?.deployment_info?.status === 'failed' || customer?.resource?.deployment_info?.status === 'error') ? 'destructive' : 'default'}
            onClick={handleRedeploy}
            disabled={actionLoading || isDeploying || customer?.resource?.deployment_info?.status === 'deploying'}
          >
            {isDeploying || customer?.resource?.deployment_info?.status === 'deploying'
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Rocket className="mr-2 h-4 w-4" />
            }
            {(isDeploying || customer?.resource?.deployment_info?.status === 'deploying') 
               ? 'Deploying...' 
               : (customer?.resource?.deployment_info?.status === 'failed' ? 'Retry Deploy' : 'Redeploy')
            }
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/crm/edit/${customerId}`)}>
            <Edit2 className="h-4 w-4 mr-2" /> Edit Customer
          </Button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (v === 'logs' && lbDomain?.id) loadLogs(activeLogTab);
        if (v === 'subscription' && !subData) {
          fetchSubscriptions();
          fetchPlans();
        }
      }}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deployments" className="flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5" /> Deployments
          </TabsTrigger>
          <TabsTrigger value="dns" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> DNS
          </TabsTrigger>
          <TabsTrigger value="ssl" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> SSL
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5">
            <ScrollText className="h-3.5 w-3.5" /> Logs
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Subscription
          </TabsTrigger>
        </TabsList>

        {/* ────────────── OVERVIEW TAB ───────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">

          {/* Domain Info Card */}
          <Card className="border-blue-500/20 bg-blue-500/[0.02]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" /> Assigned Domain
                </CardTitle>
                {deploymentDomain && (
                  <a href={`http://${deploymentDomain}`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded hover:bg-muted">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Domain value + edit */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-blue-500/10">
                {isEditingDomain ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={newDomain}
                      onChange={e => setNewDomain(e.target.value)}
                      placeholder="subdomain.example.com"
                      className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleUpdateDomain} disabled={isUpdatingDomain}>
                      {isUpdatingDomain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingDomain(false)} disabled={isUpdatingDomain}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-mono font-bold text-foreground">
                        {deploymentDomain || <span className="text-muted-foreground italic text-sm">No domain configured</span>}
                      </span>
                      {deploymentDomain && <CopyBtn value={deploymentDomain} />}
                    </div>
                    {(domainMode === 'subdomain' || domainMode === 'custom') && (
                      <Button size="sm" variant="ghost" onClick={() => { setNewDomain(deploymentDomain || ''); setIsEditingDomain(true); }}>
                        <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Deployment snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCell label="Domain Mode" value={domainMode || '—'} />
                <StatCell label="Load Balancer" value={lb?.name} />
                <StatCell label="LB Status" value={(lb?.status === 'active' || lb?.status === 'running' || lb?.status === 'idle') ? 'running' : lb?.status}
                  className={(lb?.status === 'active' || lb?.status === 'running' || lb?.status === 'idle') ? 'text-emerald-400' : 'text-amber-400'} />
                <StatCell label="Customer Status" value={customer.status}
                  className={customer.status === 'active' ? 'text-emerald-400' : customer.status === 'lead' ? 'text-amber-400' : 'text-rose-400'} />
              </div>
            </CardContent>
          </Card>

          {/* CRM API Status */}
          {(authStatus || syncStatus) ? (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> CRM Integration Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                  {/* Authentication Section */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                         <Shield className="h-3 w-3" /> Authentication
                      </h4>
                      {authStatus && (
                        <Badge variant={authStatus.status_code >= 200 && authStatus.status_code < 300 ? 'success' : 'destructive'} className="text-[9px] h-4">
                          {authStatus.status_code}
                        </Badge>
                      )}
                    </div>
                    {authStatus ? (
                      <div className="space-y-3">
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                           <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-tighter">Response Body</p>
                           <div className="font-mono text-[10px] text-primary/70 break-all max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                             {authStatus.response}
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(authStatus.updated_at).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-[10px] text-muted-foreground italic border border-dashed rounded-lg border-white/5">
                        No authentication logged.
                      </div>
                    )}
                  </div>

                  {/* Synchronization Section */}
                  <div className="p-6 space-y-4 bg-white/[0.01]">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                         <RefreshCw className="h-3 w-3" /> Synchronization
                      </h4>
                      {syncStatus && (
                        <Badge variant={syncStatus.status_code >= 200 && syncStatus.status_code < 300 ? 'success' : 'destructive'} className="text-[9px] h-4">
                          {syncStatus.status_code}
                        </Badge>
                      )}
                    </div>
                    {syncStatus ? (
                      <div className="space-y-3">
                        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                           <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-tighter">Main API Response</p>
                           <div className="font-mono text-[10px] text-primary/70 break-all max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                             {syncStatus.response}
                           </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(syncStatus.updated_at).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-[10px] text-muted-foreground italic border border-dashed rounded-lg border-white/5">
                        No sync attempt logged.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-4 rounded-xl border border-dashed text-center text-sm text-muted-foreground italic">
              No CRM API calls recorded yet.
            </div>
          )}
        </TabsContent>

        {/* ────────────── DEPLOYMENTS TAB ────────────────────────────────── */}
        <TabsContent value="deployments" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Deployment History</CardTitle>
                <CardDescription>View historical synchronization and setup logs</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-2 border-primary/20 hover:bg-primary/10"
                  onClick={() => {
                    setShowCrmLogs(true);
                    fetchCrmLogs();
                  }}
                >
                  <ScrollText className="h-4 w-4 text-primary" /> View API Logs
                </Button>
                <Button size="sm" variant="ghost" onClick={() => loadDeployments()} disabled={deploymentsLoading}>
                  <RefreshCw className={`h-4 w-4 ${deploymentsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deploymentsLoading && deployments.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : deployments.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 border border-dashed rounded-xl">
                  No deployments found.
                </div>
              ) : (
                <div className="space-y-6">
                  {deployments.map((dep, idx) => (
                    <div key={dep.id} className="group relative border border-white/5 bg-white/[0.02] rounded-xl overflow-hidden transition-all hover:bg-white/[0.04]">
                      <div className="p-4 bg-muted/20 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge variant={
                            dep.status === 'success' ? 'success' : 
                            dep.status === 'failed' || dep.status === 'error' ? 'destructive' : 
                            'warning'
                          } className="px-2 py-0.5 font-mono text-[10px] uppercase">
                            {dep.status}
                          </Badge>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground" title={new Date(dep.created_at).toLocaleString()}>
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(dep.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-background/50 px-2 py-1 rounded-lg border border-white/5">
                           <Globe className="h-3 w-3 text-blue-400" />
                           <span className="text-[10px] font-mono text-muted-foreground">{dep.domain}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-black/40 font-mono text-[11px] text-emerald-400/90 whitespace-pre-wrap max-h-[500px] overflow-y-auto custom-scrollbar">
                        {stripAnsi(dep.log_output) || 'No logs recorded for this deployment.'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────── DNS TAB ────────────────────────────────────────── */}
        <TabsContent value="dns" className="mt-6 space-y-4">
          {domainLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (!domainRecord && isSubdomain) || (domainRecord && !domainRecord.dns_managed) ? (
            <div className="flex-1 p-8 rounded-2xl border border-white/5 bg-white/[0.01]">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5">
                  <Shield className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">DNS Management Policy</h3>
                  <p className="text-[11px] text-blue-400 font-medium uppercase tracking-wider mt-0.5">Subdomain Configuration</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm text-gray-300 leading-relaxed font-medium">
                    This domain is managed under a parent DNS zone.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    To maintain a lean and efficient configuration, the system automatically aggregates subdomain records under their respective primary domains.
                  </p>
                </div>

                <div className="bg-white/[0.03] rounded-xl p-5 border border-white/5 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                    <Info className="h-3.5 w-3.5 text-blue-400" />
                    Key Implementation Details
                  </div>
                  <ul className="space-y-3">
                    {[
                      { title: "Centralized Control", desc: "All DNS records for this app are stored within the parent domain's record set." },
                      { title: "Automatic Sync", desc: "Base A records are automatically managed; changes to the parent zone safely include this app." },
                      { title: "Custom Records", desc: "If you need additional CNAME or TXT records, please add them directly to the parent domain." }
                    ].map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/40 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-white/90">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-normal">{item.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-500/30 text-xs font-medium h-9"
                    onClick={() => navigate(`/domains${parentDomain ? `?q=${parentDomain.domain}` : ''}`)}
                  >
                    Go to Domains Panel <ChevronRight className="h-3 w-3 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          ) : !domainRecord ? (
            <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-start gap-4 py-6">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-400 text-sm">No Domain Record Found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The domain <strong>{deploymentDomain}</strong> is not found in the DNS panel.
                    It may be managed under a parent domain or set up externally.
                  </p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/domains${parentDomain ? `?q=${parentDomain.domain}` : ''}`)}>
                    <Globe className="h-3.5 w-3.5 mr-2" /> Open DNS Panel <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Domain Info */}
              <Card className="border-white/10 bg-white/[0.02]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-base">{domainRecord.domain}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                          domainRecord.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {domainRecord.status}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/domains')}>
                      Manage in DNS Panel <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* DNS Records */}
              <Card className="border-white/10 bg-white/[0.02]">
                <CardHeader>
                  <CardTitle className="text-sm">DNS Records</CardTitle>
                  <CardDescription>{domainRecord.dns_records?.length || 0} records</CardDescription>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  {(!domainRecord.dns_records || domainRecord.dns_records.length === 0) ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">No DNS records found.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      <div className="grid grid-cols-[80px_1fr_1fr_80px] gap-3 px-6 py-2">
                        {['Type', 'Name', 'Value', 'TTL'].map(h => (
                          <span key={h} className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{h}</span>
                        ))}
                      </div>
                      {domainRecord.dns_records.map(record => (
                        <div key={record.id} className="grid grid-cols-[80px_1fr_1fr_80px] gap-3 px-6 py-3 items-center hover:bg-white/[0.02] transition-colors">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                            record.type === 'A' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            record.type === 'CNAME' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            record.type === 'MX' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                            record.type === 'TXT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-muted text-muted-foreground border-transparent'
                          }`}>
                            {record.type}
                          </span>
                          <code className="text-sm font-mono text-white/80 truncate">{record.name}</code>
                          <div className="flex items-center gap-1 min-w-0">
                            <code className="text-sm font-mono text-muted-foreground truncate flex-1">{record.value}</code>
                            <CopyBtn value={record.value} />
                          </div>
                          <span className="text-xs text-muted-foreground">{record.ttl}s</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ────────────── SSL TAB ────────────────────────────────────────── */}
        <TabsContent value="ssl" className="mt-6 space-y-4">
          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> SSL Management (Let's Encrypt)
                  </CardTitle>
                  <CardDescription>Secure this domain with an automatic SSL certificate</CardDescription>
                </div>
                {lbDomain && (
                  <Badge variant={
                    lbDomain.ssl_status === 'active' ? 'success' :
                    lbDomain.ssl_status === 'pending' ? 'warning' :
                    lbDomain.ssl_status === 'failed' ? 'destructive' : 'secondary'
                  }>
                    <span className={`h-1.5 w-1.5 rounded-full mr-2 ${
                      lbDomain.ssl_status === 'active' ? 'bg-emerald-500' :
                      lbDomain.ssl_status === 'pending' ? 'bg-amber-500 animate-pulse' :
                      lbDomain.ssl_status === 'failed' ? 'bg-red-500' : 'bg-slate-500'
                    }`} />
                    {lbDomain.ssl_status?.toUpperCase() || 'NONE'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-4">
                <div className="p-2 bg-primary/10 rounded-full h-fit">
                  <Info className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">Important Prerequisites</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    1. Ensure your domain <strong>{deploymentDomain}</strong> is pointing to this server's IP.<br />
                    2. DNS propagation can take some time. If it fails, wait and try again.<br />
                    3. Let's Encrypt has rate limits. Avoid repeated failed attempts.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">SSL Status</span>
                  <div className="flex items-center gap-2">
                    {lbDomain?.ssl_enabled ? (
                      <span className="text-emerald-400 flex items-center gap-1.5 text-sm font-semibold">
                        <Check className="h-4 w-4" /> Secure (HTTPS Enabled)
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1.5 text-sm font-semibold">
                        <AlertTriangle className="h-4 w-4" /> Not Secure (HTTP Only)
                      </span>
                    )}
                  </div>
                </div>
                {lbDomain?.ssl_last_check_at && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Last Sync</span>
                    <div className="text-sm text-foreground flex items-center gap-2 font-mono">
                      <Clock className="h-3.5 w-3.5" /> {new Date(lbDomain.ssl_last_check_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 flex flex-wrap gap-3">
                {lbDomain && !lbDomain.ssl_enabled ? (
                  <Button 
                    onClick={handleSetupSsl} 
                    disabled={sslLoading || lbDomain.ssl_status === 'pending'}
                    className="gap-2"
                  >
                    {sslLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Setup SSL Certificate
                  </Button>
                ) : lbDomain && (
                  <>
                    <Button 
                      onClick={handleSetupSsl} 
                      disabled={sslLoading || lbDomain.ssl_status === 'pending'}
                      variant="outline"
                      className="gap-2"
                    >
                      {sslLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Re-issue Certificate
                    </Button>
                    <Button 
                      onClick={handleRemoveSsl} 
                      disabled={sslLoading}
                      variant="destructive"
                      className="gap-2"
                    >
                      {sslLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Remove SSL
                    </Button>
                  </>
                )}
              </div>

              {!!lbDomain?.ssl_enabled && (
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                         <Shield className="h-4 w-4 text-primary" /> Force HTTPS
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed italic mt-1 max-w-xl">
                        Redirects all HTTP traffic for this domain to HTTPS.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Switch
                         checked={lbDomain.force_https}
                         onCheckedChange={async (checked) => {
                           try {
                             setSslLoading(true);
                             await api.post(`/load-balancers/domains/${lbDomain.id}/ssl/force-https`);
                             fetchCustomer();
                           } catch (err) {
                             toast.error(err.response?.data?.message || 'Failed to toggle Force HTTPS');
                           } finally {
                             setSslLoading(false);
                           }
                         }}
                         disabled={sslLoading}
                       />
                    </div>
                  </div>
                </div>
              )}

              {!!(sslLoading || lbDomain?.ssl_log) && (
                <div className="space-y-3 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                      {sslLoading ? 'Operation in Progress...' : 'Last SSL Operation Log'}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5">Certbot Output</Badge>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto min-h-[100px] flex flex-col">
                    {sslLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-3 text-primary/60 animate-pulse">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-xs font-medium">Provisioning Let's Encrypt certificate... This may take up to a minute.</p>
                      </div>
                    ) : (
                      lbDomain?.ssl_log
                    )}
                  </div>
                </div>
              )}

              {sslDetails && Object.keys(sslDetails).length > 0 && (
                <div className="space-y-6 pt-6 border-t border-white/5 animate-in fade-in duration-500">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                       <FileText className="h-4 w-4 text-primary" /> Certificate Details
                    </h4>
                    <p className="text-xs text-muted-foreground">Detailed information and raw PEM data for the installed certificate.</p>
                  </div>

                  {sslDetails.metadata && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                      <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Subject</span>
                          <span className="text-sm font-medium text-foreground truncate" title={sslDetails.metadata.subject}>{sslDetails.metadata.subject}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Issuer</span>
                          <span className="text-sm font-medium text-foreground truncate" title={sslDetails.metadata.issuer}>{sslDetails.metadata.issuer}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Signature Algorithm</span>
                          <span className="text-sm font-mono text-foreground">sha256WithRSAEncryption</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Valid From</span>
                          <span className="text-sm font-medium text-foreground">{sslDetails.metadata.not_before}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Valid Until</span>
                          <span className="text-sm font-medium text-foreground">{sslDetails.metadata.not_after}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Fingerprint (SHA1)</span>
                          <span className="text-[11px] font-mono text-muted-foreground truncate" title={sslDetails.metadata.fingerprint}>{sslDetails.metadata.fingerprint}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────── LOGS TAB ───────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-6">
          {!lbDomain ? (
            <div className="p-8 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
              No domain configured — logs are not available.
            </div>
          ) : (
            <Card>
              <Tabs value={activeLogTab} onValueChange={setActiveLogTab} className="w-full">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-base">Server Logs</CardTitle>
                    <TabsList className="h-8 p-1 bg-white/[0.05] border border-white/10 rounded-lg">
                      <TabsTrigger
                        value="server-error"
                        className="h-6 px-3 rounded-md data-[state=active]:bg-red-500/10 data-[state=active]:border data-[state=active]:border-red-500/20 data-[state=active]:text-red-400"
                      >
                        Server Errors
                      </TabsTrigger>
                      <TabsTrigger
                        value="server-access"
                        className="h-6 px-3 rounded-md data-[state=active]:bg-emerald-500/10 data-[state=active]:border data-[state=active]:border-emerald-500/20 data-[state=active]:text-emerald-400"
                      >
                        Server Access
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <button
                    onClick={() => loadLogs(activeLogTab, true)}
                    disabled={logsLoading[activeLogTab]}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-white/10 hover:text-white text-muted-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${logsLoading[activeLogTab] ? 'animate-spin' : ''}`} />
                  </button>
                </CardHeader>
                <CardContent>
                  {['server-error', 'server-access'].map(tab => (
                    <TabsContent key={tab} value={tab} className="mt-0">
                      <div className="bg-black p-4 rounded-md font-mono text-xs overflow-y-auto h-96 leading-relaxed">
                        {logsLoading[tab] && !logs[tab] ? (
                          <div className="flex items-center justify-center h-full text-white/50">
                            <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading logs...
                          </div>
                        ) : logs[tab] ? (
                          logs[tab].split('\n').map((line, i) => (
                            <div
                              key={`${tab}-${i}`}
                              className={`whitespace-pre-wrap break-words ${
                                tab === 'server-error' ? 'text-red-400 font-medium' : 'text-emerald-400'
                              }`}
                            >
                              {line || ' '}
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-300">No logs available.</span>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </CardContent>
              </Tabs>
            </Card>
          )}
        </TabsContent>

        {/* ────────────── SUBSCRIPTION TAB ───────────────────────────────── */}
        <TabsContent value="subscription" className="mt-6 space-y-5">
          {subLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !subData ? (
            <div className="p-8 rounded-xl border border-dashed text-center text-sm text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Click the tab to load subscription info.</p>
            </div>
          ) : !subData.domain ? (
            <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-start gap-4 py-6">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-400 text-sm">No Domain Configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This customer has no deployed domain yet. Deploy an app or load balancer domain first.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Domain Context Badge - Full Width Top */}
              <div className="flex items-center gap-3 px-4 py-3 bg-card border rounded-xl">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium text-muted-foreground italic">Domain:</span>
                  <span className="font-mono text-sm font-extrabold text-foreground bg-muted/50 px-3 py-1 rounded-lg border border-white/5 truncate shadow-sm">
                    {subData.domain}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchSubscriptions} 
                  className="h-9 gap-2 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">Sync Info</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Side: Summary, Plans, Transactions */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Active Plans',
                        value: subData.subscriptions.filter(s => s.is_active).length,
                        icon: Star,
                        color: 'text-emerald-400',
                        bg: 'bg-emerald-500/10',
                      },
                      {
                        label: 'Total Subscriptions',
                        value: subData.subscriptions.length,
                        icon: CreditCard,
                        color: 'text-primary',
                        bg: 'bg-primary/10',
                      },
                      {
                        label: 'Transactions',
                        value: subData.transactions.length,
                        icon: TrendingUp,
                        color: 'text-violet-400',
                        bg: 'bg-violet-500/10',
                      },
                    ].map(stat => (
                      <div key={stat.label} className="flex items-center gap-3 bg-card border rounded-xl p-4">
                        <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                          <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subscriptions Table */}
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" /> Subscription Plans
                      </CardTitle>
                      <Dialog open={isActivateOpen} onOpenChange={(open) => {
                        setIsActivateOpen(open);
                        if (open && plans.length === 0) fetchPlans();
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10">
                            <Plus className="h-3.5 w-3.5" /> Activate Plan
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Activate Subscription</DialogTitle>
                            <DialogDescription>Manually assign a plan to {subData.domain}</DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleActivateSubscription} className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Select Plan</label>
                              <Select
                                value={activateForm.plan_id}
                                onValueChange={(val) => setActivateForm({ ...activateForm, plan_id: val })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a subscription plan" />
                                </SelectTrigger>
                                <SelectContent>
                                  {plans.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>
                                      {p.name} — {p.type === 'flat_rate' ? `${p.billing_cycle}` : `${p.credit_amount} credits`} ({p.price > 0 ? `$${p.price}` : 'Free'})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Custom Expiry Date <span className="text-muted-foreground font-normal">(Optional)</span></label>
                              <Input
                                type="date"
                                value={activateForm.custom_ends_at}
                                onChange={(e) => setActivateForm({ ...activateForm, custom_ends_at: e.target.value })}
                                placeholder="Leave empty for default"
                              />
                              <p className="text-xs text-muted-foreground">Overrides the default billing cycle duration if set.</p>
                            </div>
                            <DialogFooter className="mt-6">
                              <Button type="button" variant="ghost" onClick={() => setIsActivateOpen(false)}>Cancel</Button>
                              <Button type="submit" disabled={activatingPlan || !activateForm.plan_id}>
                                {activatingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Activate
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent className="p-0">
                      {subData.subscriptions.length === 0 ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">No subscriptions found for this domain.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                              <tr>
                                <th className="px-5 py-3 text-left font-medium">Plan</th>
                                <th className="px-5 py-3 text-left font-medium">Type</th>
                                <th className="px-5 py-3 text-left font-medium">Status</th>
                                <th className="px-5 py-3 text-left font-medium">Period / Credits</th>
                                <th className="px-5 py-3 text-left font-medium">Subscribed On</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {subData.subscriptions.map(sub => (
                                <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-5 py-3">
                                    <p className="font-semibold text-foreground">{sub.plan?.name || '—'}</p>
                                    {sub.plan?.price && (
                                      <p className="text-xs text-muted-foreground">${sub.plan.price}</p>
                                    )}
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                      sub.is_credit_type
                                        ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                      {sub.is_credit_type ? 'Credit' : 'Flat Rate'}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                      sub.is_active
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : sub.status === 'cancelled'
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                      {sub.is_active ? 'Active' : sub.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-xs">
                                    {sub.is_credit_type ? (
                                      <div className="flex items-center gap-1.5">
                                        <Coins className="h-3.5 w-3.5 text-violet-400" />
                                        <span className="font-semibold">{sub.credit_balance ?? 0}</span>
                                        <span className="text-muted-foreground">credits remaining</span>
                                      </div>
                                    ) : (
                                      <div className="space-y-0.5">
                                        {sub.starts_at && <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(sub.starts_at).toLocaleDateString()}</p>}
                                        {sub.ends_at && (
                                          <p className={`flex items-center gap-1 ${new Date(sub.ends_at) < new Date() ? 'text-rose-400' : 'text-muted-foreground'}`}>
                                            → {new Date(sub.ends_at).toLocaleDateString()}
                                          </p>
                                        )}
                                        {!sub.ends_at && <p className="text-muted-foreground italic">Lifetime</p>}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-5 py-3 text-xs text-muted-foreground">
                                    {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Transactions Table */}
                  {subData.transactions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-violet-400" /> Recent Transactions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                              <tr>
                                <th className="px-5 py-3 text-left font-medium">Plan</th>
                                <th className="px-5 py-3 text-left font-medium">Amount</th>
                                <th className="px-5 py-3 text-left font-medium">Gateway</th>
                                <th className="px-5 py-3 text-left font-medium">Status</th>
                                <th className="px-5 py-3 text-left font-medium">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {subData.transactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-5 py-3">
                                    <p className="font-medium">{tx.plan?.name || '—'}</p>
                                    {tx.gateway_ref && (
                                      <p className="text-[10px] font-mono text-muted-foreground">{tx.gateway_ref}</p>
                                    )}
                                  </td>
                                  <td className="px-5 py-3 font-semibold">${tx.amount}</td>
                                  <td className="px-5 py-3">
                                    <span className="capitalize text-xs bg-muted px-2 py-0.5 rounded font-medium">{tx.gateway}</span>
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                      tx.status === 'completed'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : tx.status === 'failed'
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                      {tx.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 text-xs text-muted-foreground">
                                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Side: DNS, Suspension, Visibility */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Service Suspension */}
                  <Card className="border-red-500/20 bg-red-500/5 transition-all">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                          <Shield className="h-4 w-4" />
                        </div>
                        <h4 className="font-semibold text-sm text-foreground">Service Suspension</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        Manually suspend or reactivate this domain. When suspended, visitors will see a "Service Deactivated" page.
                      </p>
                      <Button
                        type="button"
                        variant={customer?.resource?.deployment_info?.status === 'deactivated' ? "outline" : "destructive"}
                        onClick={(e) => { e.preventDefault(); handleToggleSuspend(); }}
                        disabled={actionLoading}
                        className="w-full text-xs h-9"
                      >
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : 
                          (customer?.resource?.deployment_info?.status === 'deactivated' ? <Play className="h-3.5 w-3.5 mr-2" /> : <Square className="h-3.5 w-3.5 mr-2" />)
                        }
                        {customer?.resource?.deployment_info?.status === 'deactivated' ? 'Reactivate Service' : 'Suspend Service'}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Custom Plan Visibility */}
                  <Card className="border-blue-500/10 bg-blue-500/[0.02]">
                    <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xs flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-blue-400" /> Package Visibility
                        </CardTitle>
                        <CardDescription className="text-[10px]">Private packages visible for this domain.</CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5"
                          onClick={() => fetchVisibility(subData.domain)}
                        >
                          <RefreshCw className={`h-3 w-3 ${visibilityLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[11px] gap-1.5 border-white/10 hover:bg-white/5 hover:text-white px-2" 
                          onClick={() => setIsVisibilityDialogOpen(true)}
                        >
                          <Settings className="h-3.5 w-3.5" /> Manage
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-0 space-y-4">
                      {plans.filter(p => !p.is_public && p.is_active && visiblePlanIds.includes(p.id)).length === 0 ? (
                        <div className="text-center py-6 space-y-3 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                          <p className="text-[10px] text-muted-foreground italic">No custom packages selected.</p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[11px] gap-1.5 border-dashed border-blue-500/30 text-blue-400 hover:bg-blue-500/10" 
                            onClick={() => setIsVisibilityDialogOpen(true)}
                          >
                            <Plus className="h-3 w-3" /> Select Packages
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {plans.filter(p => !p.is_public && p.is_active && visiblePlanIds.includes(p.id)).map(plan => (
                            <div key={plan.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg border border-blue-500/20 bg-blue-500/10 shadow-sm shadow-blue-500/5">
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="text-[11px] font-semibold truncate text-blue-300">{plan.name}</span>
                                <span className="text-[9px] text-muted-foreground truncate">৳{parseFloat(plan.price).toLocaleString()} • {plan.type === 'flat_rate' ? plan.billing_cycle : `${plan.credit_amount}c`}</span>
                              </div>
                              <Badge variant="success" className="h-3.5 text-[8px] px-1.5 shrink-0 bg-blue-500/20 text-blue-400 border-blue-500/30">Visible</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Visibility Selection Dialog */}
                <Dialog open={isVisibilityDialogOpen} onOpenChange={setIsVisibilityDialogOpen}>
                  <DialogContent className="max-w-md bg-zinc-950 border-white/10">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-400" /> Manage Package Visibility
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        Select the private (non-public) plans you want to offer to this specific domain/customer.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                      {plans.filter(p => !p.is_public && p.is_active).length === 0 ? (
                        <div className="text-center py-8 border border-dashed rounded-xl bg-white/[0.02]">
                          <Package className="h-8 w-8 mx-auto text-muted-foreground/20 mb-3" />
                          <p className="text-sm text-muted-foreground">No private plans found.</p>
                          <Button size="sm" variant="link" className="text-blue-400" onClick={() => { setIsVisibilityDialogOpen(false); navigate('/subscription/plans-manage'); }}>
                            Create Private Plan <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {plans.filter(p => !p.is_public && p.is_active).map(plan => {
                            const isVisible = visiblePlanIds.includes(plan.id);
                            return (
                              <div 
                                key={plan.id} 
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                  isVisible ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20' : 'bg-white/[0.03] border-white/5 opacity-70 hover:opacity-100 hover:border-white/10'
                                }`}
                              >
                                <div className="min-w-0 font-sans">
                                  <p className={`text-sm font-semibold ${isVisible ? 'text-blue-300' : 'text-foreground'}`}>{plan.name}</p>
                                  <p className="text-xs text-muted-foreground">৳{parseFloat(plan.price).toLocaleString()} • {plan.type === 'flat_rate' ? plan.billing_cycle : `${plan.credit_amount}c`}</p>
                                </div>
                                <Switch 
                                  checked={isVisible}
                                  onCheckedChange={async (checked) => {
                                    const newIds = checked 
                                      ? [...visiblePlanIds, plan.id]
                                      : visiblePlanIds.filter(id => id !== plan.id);
                                    
                                    // Call API immediately as per existing pattern
                                    try {
                                      await api.post(`/subscription/domain-plans/${subData.domain}`, { plan_ids: newIds });
                                      setVisiblePlanIds(newIds);
                                      toast.success(`${plan.name} visibility ${checked ? 'enabled' : 'disabled'}`);
                                    } catch {
                                      toast.error('Failed to update visibility');
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <DialogFooter className="border-t border-white/5 pt-4">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setIsVisibilityDialogOpen(false)}>Done</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* CRM API Logs Modal */}
      <ConfirmationDialog
        open={showCrmLogs}
        onOpenChange={setShowCrmLogs}
        title="CRM API Integration Logs"
        description="History of external CRM API calls for this synchronization process."
        onConfirm={() => setShowCrmLogs(false)}
        confirmText="Close"
        showCancel={false}
        maxWidth="sm:max-w-3xl lg:max-w-4xl"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {crmLogsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : crmLogs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl border-white/5 bg-white/[0.02]">
              <p className="text-sm text-muted-foreground font-medium">No CRM API calls found.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {crmLogs.map((log) => (
                <div key={log.id} className="border border-white/5 bg-white/[0.02] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={log.status_code >= 200 && log.status_code < 300 ? 'success' : 'destructive'}>
                        {log.status_code}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">{log.method}</Badge>
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-sm">{log.url}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                     <div className="bg-black/40 p-2 rounded border border-white/5 text-[10px] whitespace-pre-wrap overflow-x-auto max-h-32 mb-1">{log.payload}</div>
                     <div className={`bg-black/40 p-2 rounded border border-white/5 text-[10px] whitespace-pre-wrap overflow-x-auto max-h-32 mb-1 ${log.status_code >= 400 ? 'text-red-400' : 'text-emerald-400'}`}>{log.response}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ConfirmationDialog>
    </div>
  );
}

