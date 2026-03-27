import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
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
} from "@/components/ui/dialog";
import {
  ArrowLeft, Network, Globe, Server, RefreshCw, Loader2, ExternalLink,
  Shield, AlertTriangle, Clock, Copy, ChevronRight, RotateCcw, Trash2, ScrollText, Check, Info,
  CreditCard, Star, Calendar, TrendingUp, Coins, Plus, Square, Play, Package, Settings
} from 'lucide-react';

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

export default function LoadBalancerDomainDetailPage() {
  const { lbId, domainId } = useParams();
  const navigate = useNavigate();

  const [domain, setDomain] = useState(null);
  const [domainRecord, setDomainRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [parentDomain, setParentDomain] = useState(null);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslDetails, setSslDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [domainLoading, setDomainLoading] = useState(false);

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
  const [actionLoading, setActionLoading] = useState(false);
  const [visiblePlanIds, setVisiblePlanIds] = useState([]);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [isVisibilityDialogOpen, setIsVisibilityDialogOpen] = useState(false);

  useEffect(() => {
    fetchDomain();
  }, [domainId]);

  useEffect(() => {
    if (activeTab === 'subscription' && !subData) {
      fetchSubscriptions();
      fetchPlans();
    }
    if (activeTab === 'subscription' && domain?.domain) {
      fetchVisibility(domain.domain);
    }
  }, [activeTab, domain?.domain]);

  const fetchSubscriptions = async () => {
    setSubLoading(true);
    try {
      const { data } = await api.get(`/load-balancers/domains/${domainId}/subscriptions`);
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

  const fetchVisibility = async (domainName) => {
    setVisibilityLoading(true);
    try {
      const { data } = await api.get(`/subscription/domain-plans/${domainName}`);
      setVisiblePlanIds(data || []);
    } catch {
      setVisibilityLoading(false);
    } finally {
      setVisibilityLoading(false);
    }
  };

  const handleActivateSubscription = async (e) => {
    e.preventDefault();
    if (!activateForm.plan_id) return toast.error('Please select a plan');
    setActivatingPlan(true);
    try {
      await api.post(`/load-balancers/domains/${domainId}/subscriptions/activate`, activateForm);
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
      const { data } = await api.post(`/load-balancers/domains/${domainId}/toggle-suspend`);
      toast.success(data.message);
      fetchDomain();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle suspension');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ssl' && domain?.id) {
       fetchSslDetails();
    }
    if (activeTab === 'logs' && domain?.id) {
       loadLogs(activeLogTab);
    }
    if (activeTab === 'dns' && domain?.domain) {
       fetchDomainRecord(domain.domain);
       fetchParentDomain(domain.domain);
    }
  }, [activeTab, activeLogTab, domain?.id]);

  const fetchDomain = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/load-balancers/domains/${domainId}`);
      setDomain(data);
    } catch {
      toast.error('Failed to load domain details');
      navigate(`/load-balancers/${lbId}/manage`);
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
    if (!domain) return;
    setSslLoading(true);
    try {
      const { data } = await api.post(`/load-balancers/domains/${domain.id}/ssl/setup`);
      toast.success(data.message || 'SSL setup initiated!');
      fetchDomain();
    } catch (err) {
      toast.error(err.response?.data?.message || 'SSL setup failed.');
      fetchDomain();
    } finally {
      setSslLoading(false);
    }
  };

  const handleRemoveSsl = async () => {
    if (!domain) return;
    setSslLoading(true);
    try {
      const { data } = await api.post(`/load-balancers/domains/${domain.id}/ssl/remove`);
      toast.success(data.message || 'SSL removed!');
      fetchDomain();
    } catch (err) {
      toast.error('Failed to remove SSL');
      fetchDomain();
    } finally {
      setSslLoading(false);
    }
  };

  const fetchSslDetails = async () => {
    if (!domain || (!domain.ssl_enabled && domain.ssl_status !== 'failed')) return;
    setLoadingDetails(true);
    try {
      const { data } = await api.get(`/load-balancers/domains/${domain.id}/ssl/details`);
      setSslDetails(data);
    } catch {
      setSslDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadLogs = async (type = 'server-error', force = false) => {
    if (!domain?.id) return;
    if (!force && logs[type]) return;

    setLogsLoading(prev => ({ ...prev, [type]: true }));
    try {
      const { data } = await api.get(`/load-balancers/domains/${domain.id}/logs?type=${type}`);
      setLogs(prev => ({ ...prev, [type]: data.logs }));
    } catch {
      toast.error(`Failed to load ${type} logs`);
    } finally {
      setLogsLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const isSubdomain = domain?.domain ? domain.domain.split('.').length > 2 : false;

  const subdomainPart = (domain?.domain && parentDomain?.domain && domain.domain.endsWith(`.${parentDomain.domain}`))
    ? domain.domain.slice(0, -(parentDomain.domain.length + 1))
    : null;

  const subdomainRecords = parentDomain?.dns_records?.filter(r => r.name === subdomainPart) || [];

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!domain) return null;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/load-balancers/${lbId}/manage`)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {domain.domain}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Load Balancer: {domain.load_balancer?.name || 'Loading...'}
                </p>
              </div>
              <Badge variant={domain.ssl_enabled ? 'success' : 'secondary'}>
                {domain.ssl_enabled ? 'Secure' : 'Not Secure'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchDomain}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <a href={`http://${domain.domain}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" /> Open Site
            </Button>
          </a>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
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
          <Card>
            <CardHeader pb-4>
               <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" /> Domain Summary
               </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCell label="Domain" value={domain.domain} />
                <StatCell label="SSL Status" value={domain.ssl_status || 'None'} 
                  className={domain.ssl_status === 'active' ? 'text-emerald-400' : 'text-amber-400'} />
                <StatCell label="Force HTTPS" value={domain.force_https ? 'Enabled' : 'Disabled'}
                  className={domain.force_https ? 'text-emerald-400' : 'text-muted-foreground'} />
                <StatCell label="Created" value={new Date(domain.created_at).toLocaleDateString()} />
              </div>
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
                      Go to Parent Zone <ChevronRight className="h-3 w-3 ml-2" />
                    </Button>
                  </div>

                  {subdomainRecords.length > 0 && (
                    <div className="pt-4 border-t border-white/5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Matching Records in Parent Zone
                      </div>
                      <div className="bg-black/20 rounded-xl overflow-hidden border border-white/5">
                        <div className="grid grid-cols-[60px_1fr_1fr_60px] gap-3 px-4 py-2 bg-white/5">
                          {['Type', 'Name', 'Value', 'TTL'].map(h => (
                            <span key={h} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">{h}</span>
                          ))}
                        </div>
                        <div className="divide-y divide-white/5">
                          {subdomainRecords.map(record => (
                            <div key={record.id} className="grid grid-cols-[60px_1fr_1fr_60px] gap-3 px-4 py-2.5 items-center hover:bg-white/[0.02] transition-colors">
                              <span className="text-[10px] font-bold text-blue-400">{record.type}</span>
                              <code className="text-[10px] font-mono text-white/70 truncate">{record.name}</code>
                              <code className="text-[10px] font-mono text-muted-foreground truncate">{record.value}</code>
                              <span className="text-[10px] text-muted-foreground">{record.ttl}s</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center">
                  <Globe className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <h4 className="font-semibold text-muted-foreground">DNS Managed Externally</h4>
                  <p className="text-sm text-muted-foreground/60 max-w-md mx-auto mt-1">
                    The domain <strong>{domain.domain}</strong> is not currently managed by our internal DNS system.
                  </p>
                </CardContent>
              </Card>
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
                <Badge variant={
                  domain.ssl_status === 'active' ? 'success' :
                  domain.ssl_status === 'pending' ? 'warning' :
                  domain.ssl_status === 'failed' ? 'destructive' : 'secondary'
                }>
                  {domain.ssl_status?.toUpperCase() || 'NONE'}
                </Badge>
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
                    1. Ensure your domain <strong>{domain.domain}</strong> is pointing to this server's IP.<br />
                    2. DNS propagation can take some time. If it fails, wait and try again.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">SSL Status</span>
                  <div className="flex items-center gap-2">
                    {domain.ssl_enabled ? (
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
                {domain.ssl_last_check_at && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Last Sync</span>
                    <div className="text-sm text-foreground flex items-center gap-2 font-mono">
                      <Clock className="h-3.5 w-3.5" /> {new Date(domain.ssl_last_check_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 flex flex-wrap gap-3">
                {!domain.ssl_enabled ? (
                  <Button 
                    onClick={handleSetupSsl} 
                    disabled={sslLoading || domain.ssl_status === 'pending'}
                    className="gap-2"
                  >
                    {sslLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Setup SSL Certificate
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleSetupSsl} 
                      disabled={sslLoading || domain.ssl_status === 'pending'}
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

              {!!domain.ssl_enabled && (
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
                         checked={domain.force_https}
                         onCheckedChange={async (checked) => {
                           try {
                             setSslLoading(true);
                             await api.post(`/load-balancers/domains/${domain.id}/ssl/force-https`);
                             fetchDomain();
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────── LOGS TAB ────────────────────────────────────────── */}
        <TabsContent value="logs" className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeLogTab === 'server-error' ? 'default' : 'outline'}
              onClick={() => setActiveLogTab('server-error')}
            >
              Error Logs
            </Button>
            <Button
              size="sm"
              variant={activeLogTab === 'server-access' ? 'default' : 'outline'}
              onClick={() => setActiveLogTab('server-access')}
            >
              Access Logs
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => loadLogs(activeLogTab, true)}
              disabled={logsLoading[activeLogTab]}
            >
              <RefreshCw className={`h-4 w-4 ${logsLoading[activeLogTab] ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <Card className="bg-black/40 border-white/5">
            <CardContent className="p-0">
               <pre className="p-4 font-mono text-xs overflow-auto max-h-[600px] whitespace-pre-wrap text-muted-foreground leading-relaxed">
                 {logs[activeLogTab] || (logsLoading[activeLogTab] ? 'Loading logs...' : 'No logs available.')}
               </pre>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ────────────── SUBSCRIPTION TAB ────────────────────────────────────────── */}
        <TabsContent value="subscription" className="mt-6">
          {subLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !subData ? (
             <div className="text-center py-10">
               <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
               <p className="text-muted-foreground">No subscription data found.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Side: Active Subscriptions & History */}
              <div className="lg:col-span-8 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="space-y-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-400" /> Active Subscriptions
                      </CardTitle>
                      <CardDescription className="text-xs">Current plans active for {subData.domain}</CardDescription>
                    </div>
                    <Button 
                      size="sm" 
                      className="h-8 bg-blue-600 hover:bg-blue-700 text-xs gap-1.5"
                      onClick={() => setIsActivateOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Activate Plan
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {subData.subscriptions.length === 0 ? (
                      <div className="p-10 text-center border-t border-dashed">
                        <p className="text-sm text-muted-foreground italic">No active subscriptions found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                            <tr>
                              <th className="px-5 py-3 text-left font-medium">Plan</th>
                              <th className="px-5 py-3 text-left font-medium">Type</th>
                              <th className="px-5 py-3 text-left font-medium">Status</th>
                              <th className="px-5 py-3 text-left font-medium">Usage/Expiry</th>
                              <th className="px-5 py-3 text-left font-medium">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {subData.subscriptions.map(sub => (
                              <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-5 py-3">
                                  <p className="font-semibold text-white">{sub.plan?.name || '—'}</p>
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
                                      <span className="text-muted-foreground">credits</span>
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
                                  <p className="font-medium text-white">{tx.plan?.name || '—'}</p>
                                  {tx.gateway_ref && (
                                    <p className="text-[10px] font-mono text-muted-foreground">{tx.gateway_ref}</p>
                                  )}
                                </td>
                                <td className="px-5 py-3 font-semibold text-white">${tx.amount}</td>
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

              {/* Right Side: Suspension & Visibility */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="border-red-500/20 bg-red-500/5">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                        <Shield className="h-4 w-4" />
                      </div>
                      <h4 className="font-semibold text-sm">Service Suspension</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                      Manually suspend or reactivate this domain. When suspended, visitors will see a "Service Deactivated" page.
                    </p>
                    <Button
                      type="button"
                      variant={domain?.status === 'deactivated' ? "outline" : "destructive"}
                      onClick={(e) => { e.preventDefault(); handleToggleSuspend(); }}
                      disabled={actionLoading}
                      className="w-full text-xs h-9"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : 
                        (domain?.status === 'deactivated' ? <Play className="h-3.5 w-3.5 mr-2" /> : <Square className="h-3.5 w-3.5 mr-2" />)
                      }
                      {domain?.status === 'deactivated' ? 'Reactivate Service' : 'Suspend Service'}
                    </Button>
                  </CardContent>
                </Card>

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
                      Select the private plans you want to offer to this specific domain.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    {plans.filter(p => !p.is_public && p.is_active).length === 0 ? (
                      <div className="text-center py-8 border border-dashed rounded-xl bg-white/[0.02]">
                        <Package className="h-8 w-8 mx-auto text-muted-foreground/20 mb-3" />
                        <p className="text-sm text-muted-foreground">No private plans found.</p>
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

              {/* Activate Dialog */}
              <Dialog open={isActivateOpen} onOpenChange={setIsActivateOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10">
                  <DialogHeader>
                    <DialogTitle>Activate Manual Plan</DialogTitle>
                    <DialogDescription>
                      Assign a specific subscription plan to {subData.domain} manually.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleActivateSubscription} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Plan</label>
                      <Select
                        value={activateForm.plan_id}
                        onValueChange={(v) => setActivateForm({ ...activateForm, plan_id: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a plan..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10">
                          {plans.map(plan => (
                            <SelectItem key={plan.id} value={plan.id.toString()}>
                              {plan.name} (${plan.price} / {plan.billing_cycle})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Custom End Date (Optional)</label>
                      <input
                        type="date"
                        className="w-full flex h-10 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={activateForm.custom_ends_at}
                        onChange={(e) => setActivateForm({ ...activateForm, custom_ends_at: e.target.value })}
                      />
                    </div>
                    <DialogFooter className="pt-4 border-t border-white/5 gap-2">
                      <Button type="button" variant="ghost" onClick={() => setIsActivateOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={activatingPlan} className="bg-blue-600 hover:bg-blue-700">
                        {activatingPlan ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Activate Plan
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
