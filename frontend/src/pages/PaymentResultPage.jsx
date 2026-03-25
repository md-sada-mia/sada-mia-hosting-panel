import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RefreshCw, CreditCard, Loader2, Calendar, Package } from 'lucide-react';
import api from '@/lib/api';

const GATEWAY_LABELS = {
  bkash: 'bKash',
  nagad: 'Nagad',
  sslcommerz: 'SSL Commerce',
};

export default function PaymentResultPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const status    = params.get('status');   // 'success' | 'failed'
  const gateway   = params.get('gateway');
  const domain    = params.get('domain');

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);

  const isSuccess = status === 'success';
  const isPaymentDomain = window.location.hostname.startsWith('payment.');
  
  const dashboardUrl = isPaymentDomain 
    ? (domain ? `/?domain=${domain}` : `/`)
    : '/subscription';

  // Fetch updated subscription/balance status
  useEffect(() => {
    if (!isSuccess) {
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        const endpoint = isPaymentDomain && domain 
          ? `/public/portal/info?domain=${domain}`
          : `/subscription/current`;
        
        const response = await api.get(endpoint);
        const data = response.data;
        
        // For public portal, info returns { current: ... }
        // For /subscription/current, it returns status summary directly
        setDetails(data.current || data);
      } catch (err) {
        console.error('Failed to fetch subscription details:', err);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to ensure backend has finished processing (transaction -> activation)
    const t = setTimeout(fetchDetails, 1500);
    return () => clearTimeout(t);
  }, [isSuccess, isPaymentDomain, domain]);

  // Auto-redirect to dashboard after 10 seconds if success
  useEffect(() => {
    if (isSuccess && !loading) {
      const t = setTimeout(() => navigate(dashboardUrl), 10000);
      return () => clearTimeout(t);
    }
  }, [isSuccess, loading, navigate, dashboardUrl]);

  if (loading && isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center gap-6">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Activating Package…</h2>
          <p className="text-muted-foreground animate-pulse">Finalizing your subscription details. This won't take long.</p>
        </div>
      </div>
    );
  }

  const activePlan = details?.flat_subscription?.plan || details?.credit_subscription?.plan;
  const expiry = details?.flat_subscription?.ends_at;
  const balance = details?.credit_balance;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center gap-10 py-12 px-4 max-w-2xl mx-auto">
      <div
        className={`rounded-full p-8 transition-all duration-700 scale-100 animate-in zoom-in spin-in-12 ${
          isSuccess ? 'bg-emerald-500/10 ring-8 ring-emerald-500/5' : 'bg-red-500/10 ring-8 ring-red-500/5'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-24 w-24 text-emerald-500" />
        ) : (
          <XCircle className="h-24 w-24 text-red-500" />
        )}
      </div>

      <div className="space-y-4">
        <h1 className={`text-5xl font-black tracking-tighter ${isSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
          {isSuccess ? 'Success!' : 'Payment Failed'}
        </h1>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          {isSuccess
            ? `Your subscription via ${GATEWAY_LABELS[gateway] ?? gateway} is now active and ready to use.`
            : `We encountered an issue with your payment via ${GATEWAY_LABELS[gateway] ?? gateway}. Please try again.`}
        </p>
      </div>

      {isSuccess && details && (
        <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
          <div className="bg-card border-2 border-primary/10 rounded-2xl p-6 text-left space-y-5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <Package className="h-16 w-16" />
            </div>

            <div className="flex items-center gap-3 border-b border-primary/10 pb-4 mb-4">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-xl tracking-tight">{activePlan?.name ?? 'Subscription Active'}</h3>
            </div>
            
            <div className="space-y-3">
              {activePlan?.type === 'flat_rate' && expiry && (
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                  <span className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4" /> Next Billing / Expiry
                  </span>
                  <span className="font-bold">{new Date(expiry).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                </div>
              )}

              {balance !== undefined && (
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <span className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="h-4 w-4" /> Available Credits
                  </span>
                  <span className="font-black text-2xl text-primary">{balance.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            {domain && (
              <div className="text-xs text-center text-muted-foreground/60 pt-2 font-medium">
                Applied to: <span className="text-primary/70">{domain}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground italic">
             <RefreshCw className="h-3 w-3 animate-spin duration-[3000ms]" />
             <span>Redirecting to dashboard in a moment…</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Button 
          size="lg" 
          variant="default" 
          onClick={() => navigate(dashboardUrl)} 
          className="px-10 h-14 text-lg font-bold shadow-lg shadow-primary/20"
        >
          <CreditCard className="h-5 w-5 mr-3" />
          {isPaymentDomain ? 'Enter Dashboard' : 'View Account'}
        </Button>
        {!isSuccess && (
          <Button 
            size="lg" 
            variant="outline" 
            onClick={() => navigate(-1)} 
            className="px-10 h-14 text-lg font-bold"
          >
            <RefreshCw className="h-5 w-5 mr-3" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
