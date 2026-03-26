import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, XCircle, RefreshCw, CreditCard,
  Calendar, Package, Globe, Zap, Hash, ArrowRight, Home,
  CalendarCheck, ShieldCheck, Star, Clock
} from 'lucide-react';
import api from '@/lib/api';

const GATEWAY_LABELS = {
  bkash:      'bKash',
  nagad:      'Nagad',
  sslcommerz: 'SSL Commerce',
};

const GATEWAY_COLORS = {
  bkash:      'bg-pink-500/10 text-pink-500 border-pink-500/20',
  nagad:      'bg-orange-500/10 text-orange-500 border-orange-500/20',
  sslcommerz: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

function InfoRow({ icon: Icon, label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 gap-4">
      <span className="flex items-center gap-2.5 text-sm text-muted-foreground shrink-0 font-medium">
        <Icon className="h-4 w-4 opacity-70" />
        {label}
      </span>
      <span className={`text-sm font-semibold text-right break-all ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

export default function PaymentResultPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const status     = params.get('status');   // 'success' | 'failed'
  const gateway    = params.get('gateway');
  const domain     = params.get('domain');
  const txId       = params.get('tx_id');

  const [loading, setLoading]   = useState(true);
  const [details, setDetails]   = useState(null);

  const isSuccess      = status === 'success';
  const isPaymentDomain = window.location.hostname.startsWith('payment.');

  const dashboardUrl = isPaymentDomain
    ? (domain ? `/?domain=${domain}` : `/`)
    : '/subscription';

  const packagesUrl = isPaymentDomain
    ? (domain ? `/packages?domain=${domain}` : `/packages`)
    : '/subscription';

  // Fetch transaction details
  const fetchDetails = useCallback(async () => {
    if (!txId) { setLoading(false); return; }
    try {
      const res  = await api.get(`/public/payment/result/${txId}`);
      setDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch payment result details:', err);
    } finally {
      setLoading(false);
    }
  }, [txId]);

  useEffect(() => {
    // Small delay so backend finishes activating subscription
    const t = setTimeout(fetchDetails, isSuccess ? 1500 : 0);
    return () => clearTimeout(t);
  }, [fetchDetails, isSuccess]);

  // Loading spinner
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center gap-6">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">
            {isSuccess ? 'Activating Your Plan…' : 'Loading Details…'}
          </h2>
          <p className="text-muted-foreground">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  // Pull data from API response (fallback to URL params)
  const txDomain      = details?.domain || domain;
  const plan          = details?.plan;
  const subscription  = details?.subscription;
  const txAmount      = details?.amount;
  const txCurrency    = details?.currency || 'BDT';
  const txRef         = details?.transaction_id || details?.gateway_ref;
  const txGateway     = details?.gateway || gateway;
  const paidAt        = details?.created_at ? new Date(details.created_at) : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] py-12 px-4">
      <div className="w-full max-w-lg space-y-8">

        {/* ── Status Icon ─────────────────────────────── */}
        <div className="flex flex-col items-center text-center gap-4">
          <div
            className={`rounded-full p-6 animate-in zoom-in duration-500 ${
              isSuccess
                ? 'bg-emerald-500/10 ring-8 ring-emerald-500/5 shadow-2xl shadow-emerald-500/10'
                : 'bg-red-500/10 ring-8 ring-red-500/5 shadow-2xl shadow-red-500/10'
            }`}
          >
            {isSuccess
              ? <CheckCircle2 className="h-20 w-20 text-emerald-500" />
              : <XCircle     className="h-20 w-20 text-red-500" />
            }
          </div>

          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
            <h1 className={`text-4xl font-black tracking-tighter ${isSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
              {isSuccess ? 'Payment Successful!' : 'Payment Failed'}
            </h1>
            <p className="text-muted-foreground text-base max-w-sm mx-auto">
              {isSuccess
                ? `Your payment via ${GATEWAY_LABELS[txGateway] ?? txGateway} was processed successfully.`
                : `We couldn't process your payment via ${GATEWAY_LABELS[txGateway] ?? txGateway}. Please try again.`
              }
            </p>
            {txGateway && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${GATEWAY_COLORS[txGateway] ?? 'bg-muted text-muted-foreground border-border'}`}>
                {GATEWAY_LABELS[txGateway] ?? txGateway}
              </span>
            )}
          </div>
        </div>

        {/* ── Details Card ─────────────────────────────── */}
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200 fill-mode-both space-y-4">

          {/* Plan Info */}
          {plan && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              {/* Plan header */}
              <div className={`px-5 py-4 flex items-center gap-3 ${isSuccess ? 'bg-emerald-500/5 border-b border-emerald-500/10' : 'bg-muted/30 border-b border-border'}`}>
                <div className={`p-2 rounded-lg ${isSuccess ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base truncate">{plan.name}</h3>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wide shrink-0">
                      {plan.type === 'flat_rate' ? 'Flat Rate' : 'Credits'}
                    </Badge>
                  </div>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{plan.description}</p>
                  )}
                </div>
                {txAmount && (
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black">৳{Number(txAmount).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{txCurrency}</div>
                  </div>
                )}
              </div>

              {/* Info rows */}
              <div className="px-5 py-1">
                {txDomain && (
                  <InfoRow icon={Globe} label="Domain" value={txDomain} highlight />
                )}
                {plan.billing_cycle && (
                  <InfoRow
                    icon={Clock}
                    label="Billing Cycle"
                    value={plan.billing_cycle === 'monthly' ? 'Monthly' : plan.billing_cycle === 'yearly' ? 'Yearly' : 'One-time / Lifetime'}
                  />
                )}
                {plan.type === 'request_credit' && plan.credit_amount && (
                  <InfoRow
                    icon={Zap}
                    label="Credits Added"
                    value={`${Number(plan.credit_amount).toLocaleString()} credits`}
                    highlight
                  />
                )}
                {subscription?.credit_balance !== undefined && subscription.credit_balance > 0 && (
                  <InfoRow
                    icon={Star}
                    label="Available Balance"
                    value={`${Number(subscription.credit_balance).toLocaleString()} credits`}
                    highlight
                  />
                )}
                {subscription?.starts_at && (
                  <InfoRow
                    icon={CalendarCheck}
                    label="Activated On"
                    value={new Date(subscription.starts_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  />
                )}
                {subscription?.ends_at && (
                  <InfoRow
                    icon={Calendar}
                    label="Expires On"
                    value={new Date(subscription.ends_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    highlight
                  />
                )}
                {paidAt && (
                  <InfoRow
                    icon={Clock}
                    label="Payment Time"
                    value={paidAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  />
                )}
                {txRef && (
                  <InfoRow icon={Hash} label="Transaction ID" value={txRef} />
                )}
              </div>

              {/* Plan features */}
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <div className="px-5 pb-4 pt-2 border-t border-border/50">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Included Features
                  </p>
                  <ul className="grid grid-cols-1 gap-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {isSuccess && !plan && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl px-5 py-4 text-center">
              <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-emerald-600 font-medium">Your subscription has been activated successfully.</p>
            </div>
          )}
        </div>

        {/* ── Action Buttons ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in duration-500 delay-300 fill-mode-both">
          <Button
            size="lg"
            variant="default"
            onClick={() => navigate(dashboardUrl)}
            className={`flex-1 h-12 text-base font-bold shadow-lg ${isSuccess ? 'shadow-primary/20' : ''}`}
          >
            <Home className="h-5 w-5 mr-2" />
            {isPaymentDomain ? 'Go to Dashboard' : 'View Account'}
          </Button>
          {!isSuccess && (
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(packagesUrl)}
              className="flex-1 h-12 text-base font-bold"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Try Again
            </Button>
          )}
          {isSuccess && (
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(packagesUrl)}
              className="flex-1 h-12 text-base font-bold"
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              View Plans
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
