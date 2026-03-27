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
  Shield, AlertTriangle, Clock, Copy, ChevronRight, RotateCcw, Trash2, ScrollText, Check, Info
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

  useEffect(() => {
    fetchDomain();
  }, [domainId]);

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
      </Tabs>
    </div>
  );
}
