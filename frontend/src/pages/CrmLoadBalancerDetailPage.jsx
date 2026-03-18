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
  ArrowLeft, Network, Globe, Server, RefreshCw, Loader2, ExternalLink,
  Shield, AlertCircle, Info, Check, AlertTriangle, Zap, CheckCircle2,
  XCircle, Box, Clock, Copy, ChevronRight, Edit2, RotateCcw, Trash2, FileText
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

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  const fetchCustomer = async () => {
    setIsLoading(true);
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

  const fetchSslDetails = async () => {
    if (!lbDomain || (!lbDomain.ssl_enabled && lbDomain.ssl_status !== 'failed')) return;
    setLoadingDetails(true);
    try {
      const { data } = await api.get(`/load-balancers/domains/${lbDomain.id}/ssl/details`);
      setSslDetails(data);
    } catch {
      setSslDetails(null);
    } finally {
      setLoadingDetails(false);
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

  const resource = customer.resource;
  const deploymentDomain = resource?.deployment_info?.domain;
  const apiStatus = resource?.api_status;
  const lb = resource; // resource is the LB object for load_balancer type
  const domainMode = resource?.deployment_info?.domain_mode;
  
  // Predict if it's a subdomain if domain_mode is missing
  const isSubdomain = domainMode === 'subdomain' || (!domainMode && deploymentDomain && deploymentDomain.split('.').length > 2);

  // Find matching LB domain object
  const lbDomain = lb?.domains?.find(d => typeof d === 'object' && d.domain === deploymentDomain) || 
                  (typeof lb?.domains?.[0] === 'object' ? lb.domains[0] : null);

  useEffect(() => {
    if (activeTab === 'ssl') {
      fetchSslDetails();
    }
  }, [activeTab, lbDomain?.id]);

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
                lb?.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${lb?.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                {lb?.status || 'pending'}
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
          <Button size="sm" variant="outline" onClick={() => navigate(`/crm/edit/${customerId}`)}>
            <Edit2 className="h-4 w-4 mr-2" /> Edit Customer
          </Button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="dns" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> DNS
          </TabsTrigger>
          <TabsTrigger value="ssl" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> SSL
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
                <StatCell label="LB Status" value={lb?.status}
                  className={lb?.status === 'active' ? 'text-emerald-400' : 'text-amber-400'} />
                <StatCell label="Customer Status" value={customer.status}
                  className={customer.status === 'active' ? 'text-emerald-400' : customer.status === 'lead' ? 'text-amber-400' : 'text-rose-400'} />
              </div>
            </CardContent>
          </Card>

          {/* CRM API Status */}
          {apiStatus ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> CRM API Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5">Result</p>
                    <div className="flex items-center gap-2">
                      {apiStatus.status_code >= 200 && apiStatus.status_code < 300 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className={`text-lg font-black ${apiStatus.status_code >= 200 && apiStatus.status_code < 300 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {apiStatus.status_code}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5">Method</p>
                    <span className="font-mono bg-muted px-2 py-1 rounded text-xs uppercase">{apiStatus.method}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5">Last Triggered</p>
                    <span className="text-xs flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(apiStatus.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2">Response Data</p>
                  <div className="bg-black/30 rounded-xl p-3 font-mono text-xs text-primary/80 border border-white/5 max-h-80 overflow-y-auto whitespace-pre-wrap">
                    {typeof apiStatus.response === 'string' ? apiStatus.response : JSON.stringify(apiStatus.response, null, 2)}
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

              {lbDomain?.ssl_enabled && (
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

              { (sslLoading || lbDomain?.ssl_log) && (
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
      </Tabs>
    </div>
  );
}
