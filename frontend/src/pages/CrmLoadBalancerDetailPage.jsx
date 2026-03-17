import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft, Network, Globe, Server, RefreshCw, Loader2, ExternalLink,
  Shield, AlertCircle, Info, Check, AlertTriangle, Zap, CheckCircle2,
  XCircle, Box, Clock, Copy, ChevronRight, Edit2
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

  // Domain edit state
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [isUpdatingDomain, setIsUpdatingDomain] = useState(false);

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
          <TabsTrigger value="loadbalancer" className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" /> Load Balancer
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
                  <div className="bg-black/30 rounded-xl p-3 font-mono text-xs text-primary/80 border border-white/5 max-h-28 overflow-y-auto whitespace-pre-wrap">
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
                    onClick={() => navigate('/domains')}
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
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/domains')}>
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

        {/* ────────────── LOAD BALANCER TAB ─────────────────────────────── */}
        <TabsContent value="loadbalancer" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="h-4 w-4 text-blue-400" /> {lb?.name}
                </CardTitle>
                <CardDescription>
                  Shared load balancer · Method: {lb?.deployment_info?.method || lb?.method || 'round_robin'}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate(`/load-balancers/${lb?.id}/manage`)}>
                <Network className="h-3.5 w-3.5 mr-2" /> Manage LB
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer's domain in this LB */}
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-2">
                  This Customer's Assigned Domain
                </p>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <span className="font-mono font-semibold text-sm">{deploymentDomain || '—'}</span>
                  {deploymentDomain && <CopyBtn value={deploymentDomain} />}
                </div>
              </div>

              {/* Backend apps */}
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-3">
                  Backend Applications ({lb?.apps?.length || 0})
                </p>
                {!lb?.apps || lb?.apps?.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-xl text-sm text-muted-foreground italic">
                    No backend apps attached to this load balancer yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {lb?.apps?.map(app => (
                      <div key={app.id} className="flex items-center justify-between p-3.5 rounded-xl border bg-card/50 hover:bg-accent/30 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Box className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{app.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{app.domain}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            app.status === 'running' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                          }`}>
                            {app.status}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/apps/${app.id}`)}
                            className="h-7 px-2 text-muted-foreground hover:text-primary"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* All domains on LB */}
              {lb?.domains && lb.domains.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-3">
                    All Domains on this Load Balancer ({lb.domains.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lb.domains.map((d, i) => (
                      <span key={i} className={`text-xs px-3 py-1 rounded-full border font-mono ${
                        d === deploymentDomain
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 font-bold'
                          : 'bg-muted/30 border-muted text-muted-foreground'
                      }`}>
                        {d === deploymentDomain && '★ '}{d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────────────── SSL TAB ────────────────────────────────────────── */}
        <TabsContent value="ssl" className="mt-6 space-y-4">
          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> SSL Overview
              </CardTitle>
              <CardDescription>
                SSL for load balancer domains is managed per backend application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-4">
                <div className="p-2 bg-primary/10 rounded-full h-fit">
                  <Info className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">How SSL works with Load Balancers</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    SSL certificates are managed on each backend app individually. The load balancer
                    transparently proxies HTTPS traffic to the secured backend apps. To enable SSL for
                    <strong> {deploymentDomain}</strong>, ensure all backend apps have SSL enabled.
                  </p>
                </div>
              </div>

              {/* Per-app SSL status */}
              {(!lb?.apps || lb?.apps?.length === 0) ? (
                <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No backend apps attached. SSL cannot be configured yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Backend App SSL Status</p>
                  {lb?.apps?.map(app => (
                    <div key={app.id} className="flex items-center justify-between p-3.5 rounded-xl border bg-card/50 hover:bg-accent/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <Box className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{app.name}</p>
                          <p className="text-[11px] text-muted-foreground">{app.domain}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {app.ssl_enabled ? (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <Shield className="h-3.5 w-3.5" /> HTTPS Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                            <AlertTriangle className="h-3.5 w-3.5" /> HTTP Only
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/apps/${app.id}`)}
                          className="h-8 text-xs text-muted-foreground hover:text-primary"
                        >
                          Manage SSL <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
