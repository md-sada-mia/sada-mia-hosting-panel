import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Globe, Plus, Trash2, Server, Network, Copy, Check, ChevronRight,
  Settings2, RefreshCw, Shield, Loader2, Zap, AlertTriangle,
  Database, Search, X, Edit2, MoreVertical, ExternalLink,
  CheckCircle2, Clock, Info
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ─── Constants ───────────────────────────────────────────────────────────────

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'PTR', 'CAA'];

const TYPE_META = {
  A:     { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    dot: 'bg-blue-400' },
  AAAA:  { color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', dot: 'bg-violet-400' },
  CNAME: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  MX:    { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  TXT:   { color: 'bg-pink-500/15 text-pink-400 border-pink-500/30',    dot: 'bg-pink-400' },
  NS:    { color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',    dot: 'bg-cyan-400' },
  SRV:   { color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', dot: 'bg-indigo-400' },
  PTR:   { color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
  CAA:   { color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',    dot: 'bg-rose-400' },
};

const STATUS_META = {
  active:   { label: 'Active',   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  pending:  { label: 'Pending',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  inactive: { label: 'Inactive', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function CopyBtn({ text, className }) {
  const [done, setDone] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return (
    <button onClick={copy} className={`transition-all ${className}`} title="Copy">
      {done
        ? <Check className="h-3 w-3 text-emerald-400" />
        : <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />}
    </button>
  );
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { color: 'bg-muted', dot: 'bg-muted-foreground' };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${m.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {type}
    </span>
  );
}

function RecordRow({ record, onDelete, deleting }) {
  return (
    <div className="group flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      <TypeBadge type={record.type} />
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-4">
        <span className="text-sm font-medium truncate">{record.name}</span>
        <span className="text-sm text-muted-foreground font-mono truncate">{record.value}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {record.priority != null && (
          <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">P:{record.priority}</span>
        )}
        <span className="text-[10px] text-muted-foreground hidden sm:block">{record.ttl}s</span>
        <CopyBtn text={record.value} className="text-muted-foreground" />
        <button
          onClick={() => onDelete(record)}
          disabled={deleting === record.id}
          className="opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 disabled:opacity-50"
        >
          {deleting === record.id
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DomainsPage() {
  const [domains, setDomains] = useState([]);
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [deletingDom, setDeletingDom] = useState(null);
  const [deletingRec, setDeletingRec] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [search, setSearch] = useState(initialSearch);

  // Dialogs
  const [showRecordDlg, setShowRecordDlg] = useState(false);

  const [recordForm, setRecordForm] = useState({
    type: 'A', name: '@', value: '', ttl: 3600, priority: '',
  });
  const [saving, setSaving] = useState(false);
  const [parentDomain, setParentDomain] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const searchTimeout = useRef(null);
  const isFirstRun = useRef(true);

  const fetchDomains = useCallback(async (query = search, forceSelect = false) => {
    // Only show the big loader on initial load if we have nothing
    if (domains.length === 0) setLoading(true);
    
    try {
      const { data } = await api.get('/domains', { params: { q: query } });
      setDomains(data);
      
      // If no domain is selected yet, or we're forcing selection, try to find an exact match
      // We use a functional state update or we check against a ref if needed, 
      // but here we just want to avoid re-triggering fetchDomains when 'selected' changes.
      setSelected(prevSelected => {
        if ((!prevSelected || forceSelect) && data.length > 0) {
          let toSelect = data[0];
          if (query) {
            const exactMatch = data.find(d => d.domain.toLowerCase() === query.toLowerCase());
            if (exactMatch) toSelect = exactMatch;
            else {
              const partialMatch = data.find(d => d.domain.toLowerCase().includes(query.toLowerCase()));
              if (partialMatch) toSelect = partialMatch;
            }
          }
          return toSelect;
        }
        return prevSelected;
      });
    } finally {
      setLoading(false);
    }
  }, [search]); // Removed selected from dependencies

  const fetchRecords = useCallback(async (domainId) => {
    setLoadingRecs(true);
    try {
      const { data } = await api.get(`/domains/${domainId}/records`);
      setRecords(data);
    } finally {
      setLoadingRecs(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => { 
    fetchDomains(initialSearch); 
  }, []);

  // Watch search and fetch debounced
  useEffect(() => {
    // Skip on mount as fetchDomains(initialSearch) is handled above
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(() => {
      fetchDomains(search);
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, fetchDomains]);

  const fetchParentDomain = useCallback(async (domainName) => {
    try {
      const { data } = await api.get(`/domains/find-parent?domain=${domainName}`);
      setParentDomain(data);
    } catch {
      setParentDomain(null);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      fetchRecords(selected.id);
      if (!selected.dns_managed) {
        fetchParentDomain(selected.domain);
      } else {
        setParentDomain(null);
      }
    }
  }, [selected, fetchRecords, fetchParentDomain]);

  // ── Handlers ──────────────────────────────────────────────────────────────


  const handleDeleteDomain = async (d) => {
    setDeletingDom(d.id);
    try {
      await api.delete(`/domains/${d.id}`);
      const remaining = domains.filter(x => x.id !== d.id);
      setDomains(remaining);
      if (selected?.id === d.id) setSelected(remaining[0] || null);
      toast.success('Domain deleted');
    } catch {
      toast.error('Failed to delete domain');
    } finally {
      setDeletingDom(null);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...recordForm };
      if (!payload.priority) delete payload.priority;
      const { data } = await api.post(`/domains/${selected.id}/records`, payload);
      setRecords(prev => [...prev, data]);
      setShowRecordDlg(false);
      setRecordForm({ type: 'A', name: '@', value: '', ttl: 3600, priority: '' });
      toast.success('DNS record added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add record');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (rec) => {
    setDeletingRec(rec.id);
    try {
      await api.delete(`/domains/${selected.id}/records/${rec.id}`);
      setRecords(prev => prev.filter(r => r.id !== rec.id));
      toast.success('Record deleted');
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeletingRec(null);
    }
  };

  const handleSyncZone = async () => {
    if (!selected) return;
    setSyncing(true);
    try {
      const { data } = await api.post(`/domains/${selected.id}/sync`);
      setRecords(data.records || []);
      toast.success('DNS zone synthesized and synced!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sync DNS zone');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = domains;

  // ── Record type stats ─────────────────────────────────────────────────────

  const recTypeCounts = records.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            DNS &amp; Domains
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage nameservers, zone files, and DNS records.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      {domains.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Domains', value: domains.length, icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'BIND9 Managed', value: domains.filter(d => d.dns_managed).length, icon: Shield, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { label: 'Active', value: domains.filter(d => d.status === 'active').length, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-sm p-4 flex items-center gap-3 hover:bg-white/[0.05] transition-colors">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-5" style={{ minHeight: 520 }}>

        {/* ── Left: Domain list ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-9 h-9 bg-white/[0.04] border-white/10 focus:border-primary/60"
              placeholder="Search domains..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => {
                  setSearch('');
                  fetchDomains('', true); // Immediately fetch all and force select first
                }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: 520 }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="relative h-10 w-10">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                  <div className="absolute inset-1 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">Loading domains...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 border border-dashed border-white/10 rounded-xl text-muted-foreground">
                <Globe className="h-8 w-8 opacity-20" />
                <p className="text-sm">{search ? 'No matching domains' : 'No domains yet'}</p>
                {!search && (
                  <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                    Domains are automatically created when you create an app.
                  </p>
                )}
              </div>
            ) : (
              filtered.map(d => {
                const isActive = selected?.id === d.id;
                const sm = STATUS_META[d.status] || STATUS_META.pending;
                const ns = [d.nameserver_1, d.nameserver_2, d.nameserver_3, d.nameserver_4].filter(Boolean);
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className={`w-full text-left rounded-xl border p-4 transition-all duration-200 group cursor-pointer
                      ${isActive
                        ? 'border-primary/60 bg-primary/8 shadow-lg shadow-primary/10'
                        : 'border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${isActive ? 'bg-primary/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                          <Globe className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <span className="font-medium text-sm truncate">{d.domain}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {d.dns_managed && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-semibold border border-primary/25">
                            BIND9
                          </span>
                        )}
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md border ${sm.cls}`}>{sm.label}</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteDomain(d); }}
                          disabled={deletingDom === d.id}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-all disabled:opacity-50"
                        >
                          {deletingDom === d.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Nameservers */}
                    {ns.length > 0 && (
                      <div className="mt-3 space-y-1 pl-8">
                        {ns.map((n, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono group/ns">
                            <Network className="h-2.5 w-2.5 flex-shrink-0" />
                            <span className="truncate">{n}</span>
                            <CopyBtn text={n} className="opacity-0 group-hover/ns:opacity-100" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* App badge */}
                    {d.app && (
                      <div className="mt-2 pl-8 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Database className="h-2.5 w-2.5" /> {d.app.name}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: DNS records panel ────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/10 text-muted-foreground">
              <div className="p-4 rounded-full bg-white/[0.03]">
                <Server className="h-8 w-8 opacity-30" />
              </div>
              <p className="text-sm">Select a domain to manage DNS records</p>
            </div>
          ) : (
            <div className="flex flex-col h-full rounded-xl border border-white/10 overflow-hidden bg-white/[0.02] backdrop-blur-sm">

              {/* Panel Header */}
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/8 bg-white/[0.02]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/15">
                    <Settings2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{selected.domain}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {records.length} record{records.length !== 1 ? 's' : ''} ·{' '}
                      {selected.dns_managed ? (
                        <span className="text-primary">BIND9 zone managed</span>
                      ) : 'External DNS'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Record type summary pills */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Object.entries(recTypeCounts).slice(0, 4).map(([type, count]) => (
                      <span key={type} className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md border ${TYPE_META[type]?.color || 'bg-muted'}`}>
                        {type}:{count}
                      </span>
                    ))}
                  </div>
                  {selected.dns_managed && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground mr-1" onClick={() => fetchRecords(selected.id)}>
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingRecs ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/20 hover:bg-primary/5 mr-2" 
                        onClick={handleSyncZone} disabled={syncing}>
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync
                      </Button>
                      <Button size="sm" onClick={() => setShowRecordDlg(true)}
                        className="gap-1.5 bg-primary/90 hover:bg-primary text-xs shadow shadow-primary/20">
                        <Plus className="h-3.5 w-3.5" /> Add Record
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Nameserver info bar - Detailed Hint for Normal Users */}
              {selected.nameserver_1 && (
                <div className="px-5 py-3 bg-primary/5 border-b border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Registrar Configuration</span>
                    </div>
                    <div className="group relative">
                      <button className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 transition-colors">
                        <Info className="h-3 w-3" /> Why do I need this?
                      </button>
                      <div className="absolute top-full right-0 mt-2 w-72 p-4 bg-slate-900 border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                        <p className="text-xs leading-relaxed text-white/90">
                          To make your domain work with this server, you must log in to your domain registrar (where you bought the domain) and set these nameservers as the "Custom Nameservers".
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted-foreground mr-1">Set these at your registrar:</span>
                    {[selected.nameserver_1, selected.nameserver_2, selected.nameserver_3, selected.nameserver_4]
                      .filter(Boolean).map((ns, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] font-mono bg-white/5 text-foreground px-2 py-0.5 rounded border border-white/10 group/item">
                        {ns} <CopyBtn text={ns} className="text-muted-foreground opacity-40 group-hover/item:opacity-100" />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Records table */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: 440 }}>
                {/* Column headers */}
                <div className="flex items-center gap-3 px-5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 border-b border-white/5 bg-white/[0.015]">
                  <span className="w-16">Type</span>
                  <div className="flex-1 grid grid-cols-2 gap-x-4">
                    <span>Name</span>
                    <span>Value</span>
                  </div>
                  <span className="w-20 text-right">TTL / Actions</span>
                </div>

                {loadingRecs ? (
                  <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Fetching records...</span>
                  </div>
                ) : !selected.dns_managed ? (
                  <div className="p-8">
                    <div className="max-w-xl mx-auto space-y-8">
                      {/* Subdomain Management Policy Card */}
                      <div className="flex items-center gap-4">
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
                              { title: "Centralized Control", desc: "All DNS records for this subdomain are stored within the parent domain's record set." },
                              { title: "Automatic Sync", desc: "Base A records are automatically managed; changes to the parent zone safely include this subdomain." },
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

                        {parentDomain && (
                          <div className="flex items-center gap-3 pt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full border-blue-500/20 hover:bg-blue-500/10 hover:border-blue-500/30 text-xs font-medium h-9"
                              onClick={() => {
                                setSearch(parentDomain.domain);
                                fetchDomains(parentDomain.domain, true);
                              }}
                            >
                              Go to parent: <span className="text-primary ml-1">{parentDomain.domain}</span> <ChevronRight className="h-3 w-3 ml-2" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <div className="p-3 rounded-full bg-white/[0.03]">
                      <AlertTriangle className="h-6 w-6 opacity-40" />
                    </div>
                    <p className="text-sm">No DNS records yet.</p>
                    <Button variant="ghost" size="sm" onClick={() => setShowRecordDlg(true)} className="gap-1.5 text-primary hover:text-primary">
                      <Plus className="h-3.5 w-3.5" /> Add first record
                    </Button>
                  </div>
                ) : (
                  records.map(r => (
                    <RecordRow key={r.id} record={r} onDelete={handleDeleteRecord} deleting={deletingRec} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* ── Add Record Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showRecordDlg} onOpenChange={setShowRecordDlg}>
        <DialogContent className="sm:max-w-md border-white/10 bg-[#0f1017]">
          <form onSubmit={handleAddRecord}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" /> Add DNS Record
              </DialogTitle>
              <DialogDescription>Add a record to <span className="text-primary font-mono">{selected?.domain}</span></DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-5">
              {/* Type selector as visual buttons */}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Record Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {RECORD_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setRecordForm(f => ({...f, type: t}))}
                      className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        recordForm.type === t
                          ? `${TYPE_META[t]?.color || 'bg-primary/15 text-primary border-primary/30'} scale-105 shadow-sm`
                          : 'border-white/10 text-muted-foreground hover:border-white/25 bg-white/[0.03]'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Name</label>
                  <Input required placeholder="@ or subdomain" value={recordForm.name}
                    onChange={e => setRecordForm(f => ({...f, name: e.target.value}))}
                    className="bg-white/[0.04] border-white/10" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">TTL (seconds)</label>
                  <Input type="number" min="60" max="86400" value={recordForm.ttl}
                    onChange={e => setRecordForm(f => ({...f, ttl: e.target.value}))}
                    className="bg-white/[0.04] border-white/10" />
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Value</label>
                <Input required
                  placeholder={recordForm.type === 'A' ? '192.168.1.1' : recordForm.type === 'MX' ? 'mail.example.com' : 'value...'}
                  value={recordForm.value}
                  onChange={e => setRecordForm(f => ({...f, value: e.target.value}))}
                  className="bg-white/[0.04] border-white/10 font-mono text-sm" />
              </div>

              {['MX', 'SRV'].includes(recordForm.type) && (
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Priority</label>
                  <Input type="number" min="0" placeholder="10"
                    value={recordForm.priority}
                    onChange={e => setRecordForm(f => ({...f, priority: e.target.value}))}
                    className="bg-white/[0.04] border-white/10" />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowRecordDlg(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Save Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
