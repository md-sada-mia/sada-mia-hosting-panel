import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Plus, Trash2, User, ArrowRightLeft, KeyRound, Loader2,
  Eye, EyeOff, Globe, Shield, Zap, Search, X, CheckCircle2,
  AlertTriangle, Copy, Check, MoreVertical, HardDrive, Users, Info
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import ConfirmationDialog from '@/components/ConfirmationDialog';

// ─── Avatar helper ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-700',
];
function avatarColor(name = '') {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

function Avatar({ name, size = 'md' }) {
  const sz = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center font-bold text-white flex-shrink-0 shadow-md`}>
      {(name?.[0] || '?').toUpperCase()}
    </div>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); }}
      className="transition-all text-muted-foreground hover:text-foreground">
      {done ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailPage() {
  const [emailDomains, setEmailDomains] = useState([]);
  const [allDomains, setAllDomains] = useState([]);
  const [selected, setSelected] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [activeTab, setActiveTab] = useState('accounts');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [showDomainDlg, setShowDomainDlg] = useState(false);
  const [showAccountDlg, setShowAccountDlg] = useState(false);
  const [showAliasDlg, setShowAliasDlg] = useState(false);
  const [showPwdDlg, setShowPwdDlg] = useState(null); // account obj
  const [showPwd, setShowPwd] = useState(false);

  // Forms
  const [domainForm, setDomainForm] = useState({ domain_id: '' });
  const [accountForm, setAccountForm] = useState({ username: '', password: '', quota_mb: 500 });
  const [aliasForm, setAliasForm] = useState({ source: '', destination: '' });
  const [pwdValue, setPwdValue] = useState('');

  const [deletingEd, setDeletingEd] = useState(null);
  const [deletingAcc, setDeletingAcc] = useState(null);
  const [deletingAlias, setDeletingAlias] = useState(null);
  const [edToRemove, setEdToRemove] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [edRes, dRes] = await Promise.all([api.get('/email/domains'), api.get('/domains')]);
      setEmailDomains(edRes.data);
      setAllDomains(dRes.data);
      if (edRes.data.length > 0 && !selected) setSelected(edRes.data[0]);
    } finally { setLoading(false); }
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!selected) return;
    try { const { data } = await api.get(`/email/domains/${selected.id}/accounts`); setAccounts(data); }
    catch { toast.error('Failed to load accounts'); }
  }, [selected]);

  const fetchAliases = useCallback(async () => {
    if (!selected) return;
    try { const { data } = await api.get(`/email/domains/${selected.id}/aliases`); setAliases(data); }
    catch { toast.error('Failed to load aliases'); }
  }, [selected]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { if (selected) { fetchAccounts(); fetchAliases(); } }, [selected, fetchAccounts, fetchAliases]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddDomain = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/email/domains', domainForm);
      await fetchAll();
      setSelected(emailDomains.find(x => x.domain_id === parseInt(domainForm.domain_id)) || emailDomains[emailDomains.length - 1]);
      setShowDomainDlg(false);
      setDomainForm({ domain_id: '' });
      toast.success('Email domain enabled!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleConfirmDeleteDomain = async () => {
    if (!edToRemove) return;
    const ed = edToRemove;
    setDeletingEd(ed.id);
    setEdToRemove(null);
    try {
      await api.delete(`/email/domains/${ed.id}`);
      const updated = emailDomains.filter(x => x.id !== ed.id);
      setEmailDomains(updated);
      if (selected?.id === ed.id) setSelected(updated[0] || null);
      toast.success('Email domain removed');
    } catch { toast.error('Failed'); }
    finally { setDeletingEd(null); }
  };

  const handleDeleteDomain = (ed) => {
    setEdToRemove(ed);
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post(`/email/domains/${selected.id}/accounts`, accountForm);
      setAccounts(prev => [...prev, data]);
      setShowAccountDlg(false);
      setAccountForm({ username: '', password: '', quota_mb: 500 });
      toast.success(`✓ ${data.username}@${selected.domain?.domain} created`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteAccount = async (acc) => {
    setDeletingAcc(acc.id);
    try {
      await api.delete(`/email/domains/${selected.id}/accounts/${acc.id}`);
      setAccounts(prev => prev.filter(a => a.id !== acc.id));
      toast.success('Account deleted');
    } catch { toast.error('Failed'); }
    finally { setDeletingAcc(null); }
  };

  const handleChangePassword = async () => {
    if (pwdValue.length < 8) { toast.error('Minimum 8 characters'); return; }
    setSaving(true);
    try {
      await api.put(`/email/domains/${selected.id}/accounts/${showPwdDlg.id}`, { password: pwdValue });
      toast.success('Password updated');
      setShowPwdDlg(null);
      setPwdValue('');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const handleAddAlias = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post(`/email/domains/${selected.id}/aliases`, aliasForm);
      setAliases(prev => [...prev, data]);
      setShowAliasDlg(false);
      setAliasForm({ source: '', destination: '' });
      toast.success('Alias created');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDeleteAlias = async (alias) => {
    setDeletingAlias(alias.id);
    try {
      await api.delete(`/email/domains/${selected.id}/aliases/${alias.id}`);
      setAliases(prev => prev.filter(a => a.id !== alias.id));
      toast.success('Alias deleted');
    } catch { toast.error('Failed'); }
    finally { setDeletingAlias(null); }
  };

  // Derived
  const usedIds = emailDomains.map(ed => ed.domain_id);
  const availableDomains = allDomains.filter(d => !usedIds.includes(d.id));
  const totalAccounts = emailDomains.reduce((a, ed) => a + (ed.accounts?.length || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Email Management
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Postfix + Dovecot virtual mailboxes — managed natively.
          </p>
        </div>
        <Button onClick={() => setShowDomainDlg(true)}
          className="gap-2 bg-primary/90 hover:bg-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all">
          <Plus className="h-4 w-4" /> Enable Email Domain
        </Button>
      </div>

      {/* Stats strip */}
      {emailDomains.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Email Domains', value: emailDomains.length, icon: Mail, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { label: 'Mailboxes', value: totalAccounts, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Active', value: emailDomains.filter(e => e.active).length, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex items-center gap-3 hover:bg-white/[0.05] transition-colors">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            <div className="absolute inset-1 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading email configuration...</p>
        </div>
      ) : emailDomains.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-5 py-20 rounded-xl border border-dashed border-white/10">
          <div className="relative">
            <div className="p-6 rounded-2xl bg-primary/10 shadow-xl shadow-primary/10">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <Plus className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold">No email domains yet</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm">
              Enable email hosting for your domains. Mailboxes are stored at <code className="text-primary text-xs">/var/mail/vhosts/</code>.
            </p>
          </div>
          <Button onClick={() => setShowDomainDlg(true)} className="gap-2 bg-primary/90 hover:bg-primary">
            <Plus className="h-4 w-4" /> Enable Your First Domain
          </Button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">

          {/* ── Left: Email domain list ──────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-1 mb-1">
              Email Domains
            </p>
            {emailDomains.map(ed => {
              const isActive = selected?.id === ed.id;
              const domainName = ed.domain?.domain || '—';
              return (
                <button key={ed.id} onClick={() => setSelected(ed)}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-200 group
                    ${isActive
                      ? 'border-primary/60 bg-primary/8 shadow-lg shadow-primary/10'
                      : 'border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isActive ? 'bg-primary/20' : 'bg-white/5'}`}>
                        <Mail className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{domainName}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ed.accounts?.length ?? 0} mailbox{(ed.accounts?.length ?? 0) !== 1 ? 'es' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium">
                        Active
                      </span>
                      <button onClick={e => { e.stopPropagation(); handleDeleteDomain(ed); }}
                        disabled={deletingEd === ed.id}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-all disabled:opacity-50">
                        {deletingEd === ed.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* SMTP hint & Connection Guide */}
                  {isActive && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Setup Guide</span>
                        <div className="group relative">
                          <Info className="h-3 w-3 text-primary opacity-60 hover:opacity-100 cursor-help" />
                          <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-white/10 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <p className="text-[11px] leading-relaxed text-white">
                              Use these settings to connect your email to apps like <strong>Outlook</strong>, <strong>Gmail</strong>, or your <strong>Phone</strong>.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { label: 'IMAP (Incoming)', val: `imap.${domainName}`, port: '993 (SSL)' },
                          { label: 'SMTP (Outgoing)', val: `smtp.${domainName}`, port: '587 (TLS)' },
                        ].map(h => (
                          <div key={h.label} className="group/item flex items-center justify-between text-[11px] bg-white/[0.03] rounded-lg px-3 py-2 border border-white/5 hover:border-primary/20 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-primary font-bold text-[9px] uppercase tracking-tighter">{h.label}</span>
                              <span className="font-mono text-white/80">{h.val}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-muted-foreground font-mono">{h.port}</span>
                              <CopyBtn text={h.val} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-muted-foreground italic px-1">
                        * Username is your full email address. Use SSL/TLS for security.
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Right: Accounts & Aliases ────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-muted-foreground">
                <Mail className="h-8 w-8 opacity-20" />
                <p className="text-sm">Select an email domain</p>
              </div>
            ) : (
              <>
                {/* Tab header */}
                <div className="flex items-center justify-between border-b border-white/8 px-1 bg-white/[0.02]">
                  <div className="flex">
                    {[
                      { key: 'accounts', label: 'Mailboxes', icon: User, count: accounts.length, hint: 'Real email accounts where messages are stored.' },
                      { key: 'aliases', label: 'Aliases', icon: ArrowRightLeft, count: aliases.length, hint: 'Addresses that just forward mail to another person.' },
                    ].map(t => (
                      <div key={t.key} className="group relative">
                        <button onClick={() => setActiveTab(t.key)}
                          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                            activeTab === t.key
                              ? 'border-primary text-primary'
                              : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}>
                          <t.icon className="h-3.5 w-3.5" />
                          {t.label}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            activeTab === t.key ? 'bg-primary/20 text-primary' : 'bg-white/10 text-muted-foreground'
                          }`}>{t.count}</span>
                        </button>
                        {/* Tab Hint */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 p-2 bg-slate-900 border border-white/10 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-[10px] text-white/80 text-center leading-tight">
                          {t.hint}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pr-4">
                    <Button size="sm" onClick={() => activeTab === 'accounts' ? setShowAccountDlg(true) : setShowAliasDlg(true)}
                      className="h-8 text-xs gap-1.5 bg-primary/80 hover:bg-primary shadow shadow-primary/20">
                      <Plus className="h-3.5 w-3.5" />
                      {activeTab === 'accounts' ? 'New Mailbox' : 'New Alias'}
                    </Button>
                  </div>
                </div>

                {/* Domain context bar */}
                <div className="px-5 py-2.5 bg-white/[0.015] border-b border-white/5 flex items-center gap-2">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Domain:</span>
                  <span className="text-[11px] font-mono text-primary font-medium">{selected.domain?.domain}</span>
                </div>

                {/* ─ Accounts tab ──────────────────────────────────────── */}
                {activeTab === 'accounts' && (
                  <div className="flex-1 overflow-y-auto" style={{ maxHeight: 440 }}>
                    {accounts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                        <div className="p-4 rounded-2xl bg-white/[0.03]">
                          <User className="h-7 w-7 opacity-30" />
                        </div>
                        <p className="text-sm">No mailboxes yet.</p>
                        <Button variant="ghost" size="sm" onClick={() => setShowAccountDlg(true)} className="gap-1.5 text-primary hover:text-primary">
                          <Plus className="h-3.5 w-3.5" /> Create first mailbox
                        </Button>
                      </div>
                    ) : (
                      accounts.map(acc => {
                        const email = acc.full_email || `${acc.username}@${selected.domain?.domain}`;
                        return (
                          <div key={acc.id} className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] group transition-colors">
                            <Avatar name={acc.username} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{email}</span>
                                <CopyBtn text={email} />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <HardDrive className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground">{acc.quota_mb} MB quota</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-medium ${acc.active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-muted-foreground'}`}>
                                  {acc.active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setShowPwdDlg(acc); setShowPwd(false); setPwdValue(''); }}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Change password">
                                <KeyRound className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDeleteAccount(acc)}
                                disabled={deletingAcc === acc.id}
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors disabled:opacity-50">
                                {deletingAcc === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ─ Aliases tab ───────────────────────────────────────── */}
                {activeTab === 'aliases' && (
                  <div className="flex-1 overflow-y-auto" style={{ maxHeight: 440 }}>
                    {aliases.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                        <div className="p-4 rounded-2xl bg-white/[0.03]">
                          <ArrowRightLeft className="h-7 w-7 opacity-30" />
                        </div>
                        <p className="text-sm">No aliases yet.</p>
                        <Button variant="ghost" size="sm" onClick={() => setShowAliasDlg(true)} className="gap-1.5 text-primary hover:text-primary">
                          <Plus className="h-3.5 w-3.5" /> Create first alias
                        </Button>
                      </div>
                    ) : (
                      aliases.map(alias => {
                        const src = `${alias.source}@${selected.domain?.domain}`;
                        return (
                          <div key={alias.id} className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] group transition-colors">
                            <div className="p-2 rounded-lg bg-white/5">
                              <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-medium text-primary">{src}</span>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <ArrowRightLeft className="h-3 w-3" />
                                </div>
                                <span className="font-mono text-sm text-muted-foreground">{alias.destination}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <CopyBtn text={src} />
                                <span className="text-[11px] text-muted-foreground">→ <CopyBtn text={alias.destination} /></span>
                              </div>
                            </div>
                            <button onClick={() => handleDeleteAlias(alias)}
                              disabled={deletingAlias === alias.id}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-all disabled:opacity-50">
                              {deletingAlias === alias.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Enable Email Domain Dialog ─────────────────────────────────────── */}
      <Dialog open={showDomainDlg} onOpenChange={setShowDomainDlg}>
        <DialogContent className="sm:max-w-sm border-white/10 bg-[#0f1017]">
          <form onSubmit={handleAddDomain}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Enable Email Domain</DialogTitle>
              <DialogDescription>Select a domain to activate Postfix/Dovecot mailhosting.</DialogDescription>
            </DialogHeader>
            <div className="py-5">
              {availableDomains.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">All domains already have email enabled. Add a new domain in DNS & Domains first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableDomains.map(d => (
                    <label key={d.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      domainForm.domain_id == d.id ? 'border-primary/60 bg-primary/8' : 'border-white/8 hover:border-white/15 bg-white/[0.02]'
                    }`}>
                      <input type="radio" name="domain" value={d.id} checked={domainForm.domain_id == d.id}
                        onChange={() => setDomainForm({ domain_id: d.id })} className="sr-only" />
                      <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 transition-all ${domainForm.domain_id == d.id ? 'border-primary bg-primary' : 'border-white/20'}`}>
                        {domainForm.domain_id == d.id && <div className="h-2 w-2 rounded-full bg-white mx-auto mt-0.5" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{d.domain}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{d.status}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowDomainDlg(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !domainForm.domain_id || availableDomains.length === 0} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Enable Email
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Account Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAccountDlg} onOpenChange={setShowAccountDlg}>
        <DialogContent className="sm:max-w-md border-white/10 bg-[#0f1017]">
          <form onSubmit={handleAddAccount}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> New Mailbox</DialogTitle>
              <DialogDescription>Create a new email account on <span className="font-mono text-primary">{selected?.domain?.domain}</span></DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Email Address</label>
                <div className="flex items-center rounded-lg border border-white/10 overflow-hidden focus-within:border-primary/60 transition-colors">
                  <Input required placeholder="username" value={accountForm.username}
                    onChange={e => setAccountForm(f => ({...f, username: e.target.value}))}
                    className="border-0 rounded-none bg-white/[0.04] focus-visible:ring-0 flex-1" />
                  <span className="px-3 py-2 bg-white/[0.06] text-sm text-muted-foreground border-l border-white/10 font-mono whitespace-nowrap">
                    @{selected?.domain?.domain}
                  </span>
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Input required type={showPwd ? 'text' : 'password'} minLength={8}
                    placeholder="Min. 8 characters" value={accountForm.password}
                    onChange={e => setAccountForm(f => ({...f, password: e.target.value}))}
                    className="pr-10 bg-white/[0.04] border-white/10" />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium flex items-center justify-between">
                  <span>Storage Quota</span>
                  <span className="text-primary font-bold text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                    {accountForm.quota_mb >= 1024 ? `${(accountForm.quota_mb / 1024).toFixed(1)} GB` : `${accountForm.quota_mb} MB`}
                  </span>
                </label>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg space-y-3">
                  <input type="range" min="50" max="10240" step="50" value={accountForm.quota_mb}
                    onChange={e => setAccountForm(f => ({...f, quota_mb: parseInt(e.target.value)}))}
                    className="w-full h-2 rounded-lg appearance-none bg-white/10 accent-primary cursor-pointer transition-all hover:bg-white/20" />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>50MB</span><span>5GB</span><span>10GB</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic mt-0.5">
                  Small (500MB) is usually enough for normal users. Choose more for heavy business use.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAccountDlg(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Mailbox
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Change Password Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!showPwdDlg} onOpenChange={v => !v && setShowPwdDlg(null)}>
        <DialogContent className="sm:max-w-sm border-white/10 bg-[#0f1017]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Change Password</DialogTitle>
            <DialogDescription>
              Update password for <span className="font-mono text-primary">{showPwdDlg?.username}@{selected?.domain?.domain}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <div className="relative">
              <Input type={showPwd ? 'text' : 'password'} minLength={8}
                placeholder="New password (min 8 chars)" value={pwdValue}
                onChange={e => setPwdValue(e.target.value)}
                className="pr-10 bg-white/[0.04] border-white/10" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowPwdDlg(null); setPwdValue(''); }}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={saving || pwdValue.length < 8} className="gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Alias Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showAliasDlg} onOpenChange={setShowAliasDlg}>
        <DialogContent className="sm:max-w-md border-white/10 bg-[#0f1017]">
          <form onSubmit={handleAddAlias}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> New Alias</DialogTitle>
              <DialogDescription>Forward email from one address to another.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Source (forwarded from)</label>
                <div className="flex items-center rounded-lg border border-white/10 overflow-hidden focus-within:border-primary/60 transition-colors">
                  <Input required placeholder="admin" value={aliasForm.source}
                    onChange={e => setAliasForm(f => ({...f, source: e.target.value}))}
                    className="border-0 rounded-none bg-white/[0.04] focus-visible:ring-0" />
                  <span className="px-3 py-2 bg-white/[0.06] text-sm text-muted-foreground border-l border-white/10 font-mono whitespace-nowrap">
                    @{selected?.domain?.domain}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-center text-muted-foreground">
                <div className="flex-1 h-px bg-white/8" />
                <ArrowRightLeft className="h-4 w-4" />
                <div className="flex-1 h-px bg-white/8" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Destination (forward to)</label>
                <Input required type="email" placeholder="you@gmail.com" value={aliasForm.destination}
                  onChange={e => setAliasForm(f => ({...f, destination: e.target.value}))}
                  className="bg-white/[0.04] border-white/10" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAliasDlg(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create Alias
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={!!edToRemove}
        onOpenChange={(open) => !open && setEdToRemove(null)}
        title="Remove Email Domain"
        description={`Are you sure you want to remove email hosting for ${edToRemove?.domain?.domain}? All mailboxes and messages will be permanently deleted.`}
        confirmText="Remove Domain"
        variant="destructive"
        isLoading={!!deletingEd}
        onConfirm={handleConfirmDeleteDomain}
      />
    </div>
  );
}
