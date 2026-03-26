import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Loader2, ArrowLeft, AlertCircle, X } from 'lucide-react';

const GATEWAY_META = {
  bkash: {
    label: 'bKash',
    bgClass: 'bg-[#E2136E]/10 border-[#E2136E]/40 hover:border-[#E2136E]',
    textClass: 'text-[#E2136E]',
    emoji: '🔴',
  },
  nagad: {
    label: 'Nagad',
    bgClass: 'bg-[#F6821F]/10 border-[#F6821F]/40 hover:border-[#F6821F]',
    textClass: 'text-[#F6821F]',
    emoji: '🟠',
  },
  sslcommerz: {
    label: 'SSL Commerce',
    bgClass: 'bg-[#2196F3]/10 border-[#2196F3]/40 hover:border-[#2196F3]',
    textClass: 'text-[#2196F3]',
    emoji: '🔵',
  },
};

/** Extracts the most informative error string from an Axios error response */
function extractErrorMessage(err) {
  const data = err.response?.data;
  if (!data) return err.message || 'Payment initiation failed.';

  // Try common error shapes
  if (typeof data === 'string') return data;
  if (data.message) {
    // Append nested error detail if present
    const detail = data.error || data.errors
      ? '\n\nDetails:\n' + (
          typeof data.error === 'string' ? data.error
          : typeof data.errors === 'string' ? data.errors
          : JSON.stringify(data.error ?? data.errors, null, 2)
        )
      : '';
    return data.message + detail;
  }
  return JSON.stringify(data, null, 2);
}

export default function PaymentPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const domain = searchParams.get('domain');
  const plan = state?.plan;

  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [gateways, setGateways] = useState([]);

  // Always fetch fresh enabled gateways from the API — navigation state can be stale
  useEffect(() => {
    const fetchGateways = async () => {
      try {
        const url = domain ? `/public/portal/info?domain=${domain}` : '/public/portal/info';
        const { data } = await api.get(url);
        const enabled = (data.enabled_gateways || []).filter((gw) => GATEWAY_META[gw]);
        setGateways(enabled);
        setSelected((prev) => {
          // Keep selection if still valid, else default to first enabled
          if (prev && enabled.includes(prev)) return prev;
          return enabled[0] ?? null;
        });
      } catch {
        // Keep whatever came from state as fallback
      }
    };
    fetchGateways();
  }, [domain]);

  // Auto-select first if gateways loaded from state and none selected yet
  useEffect(() => {
    if (!selected && gateways.length > 0) {
      setSelected(gateways[0]);
    }
  }, [gateways, selected]);


  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
        <p>No plan selected. Go back to Packages.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const handlePay = async () => {
    if (!selected) {
      setErrorMsg('Please select a payment gateway.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const isPaymentDomain = window.location.hostname.startsWith('payment.');
      let endpoint = '/subscription/subscribe';
      let payload = { plan_id: plan.id, gateway: selected };

      if (isPaymentDomain) {
        endpoint = '/public/portal/subscribe';
        payload.domain = domain;
      }

      const { data } = await api.post(endpoint, payload);

      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        setErrorMsg('No payment URL returned. Please check gateway configuration.');
      }
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Complete Payment</h2>
          <p className="text-sm text-muted-foreground">Choose your payment method</p>
        </div>
      </div>

      {/* Plan summary */}
      <Card className="bg-muted/30">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {plan.type === 'request_credit'
                  ? `${Number(plan.credit_amount).toLocaleString()} credits`
                  : plan.billing_cycle === 'monthly' ? 'Monthly subscription'
                  : plan.billing_cycle === 'yearly' ? 'Yearly subscription'
                  : 'One-time payment'}
              </p>
            </div>
            <span className="text-2xl font-bold">৳{Number(plan.price).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Gateway list — only enabled ones */}
      <div>
        <p className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
          Select Payment Method
        </p>

        {gateways.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg border-dashed">
            No payment gateways are currently enabled. Please contact support.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {gateways.map((gw) => {
              const meta = GATEWAY_META[gw];
              const isSelected = selected === gw;
              return (
                <button
                  key={gw}
                  onClick={() => { setSelected(gw); setErrorMsg(null); }}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                    isSelected
                      ? `${meta.bgClass} border-current ring-1 ring-offset-0`
                      : 'border-border hover:border-muted-foreground/50 bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.emoji}</span>
                    <div>
                      <p className={`font-semibold ${isSelected ? meta.textClass : ''}`}>
                        {meta.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mobile banking / Card payment
                      </p>
                    </div>
                    {isSelected && (
                      <span className={`ml-auto text-xs font-medium ${meta.textClass} bg-current/10 px-2 py-0.5 rounded-full`}>
                        Selected
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Full error display */}
      {errorMsg && (
        <div className="relative rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <pre className="whitespace-pre-wrap break-words font-sans leading-relaxed flex-1">
              {errorMsg}
            </pre>
          </div>
          <button
            className="absolute top-2 right-2 text-destructive/60 hover:text-destructive"
            onClick={() => setErrorMsg(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={handlePay}
        disabled={loading || !selected || gateways.length === 0}
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting…</>
        ) : (
          <><CreditCard className="h-4 w-4 mr-2" /> Pay ৳{Number(plan.price).toLocaleString()}</>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You will be redirected to the selected payment gateway to complete your payment securely.
      </p>
    </div>
  );
}

