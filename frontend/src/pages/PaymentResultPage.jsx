import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, RefreshCw, CreditCard } from 'lucide-react';

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

  const isSuccess = status === 'success';
  const isPaymentDomain = window.location.hostname.startsWith('payment.');
  
  const dashboardUrl = isPaymentDomain 
    ? (domain ? `/?domain=${domain}` : `/`)
    : '/subscription';

  // Auto-redirect to subscription page after success
  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => navigate(dashboardUrl), 5000);
      return () => clearTimeout(t);
    }
  }, [isSuccess, navigate, dashboardUrl]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <div
        className={`rounded-full p-6 ${
          isSuccess ? 'bg-emerald-500/15' : 'bg-red-500/15'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        ) : (
          <XCircle className="h-16 w-16 text-red-500" />
        )}
      </div>

      <div className="space-y-2">
        <h2 className={`text-2xl font-bold ${isSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
          {isSuccess ? 'Payment Successful!' : 'Payment Failed'}
        </h2>
        <p className="text-muted-foreground">
          {isSuccess
            ? `Your subscription has been activated via ${GATEWAY_LABELS[gateway] ?? gateway}.`
            : `Your payment via ${GATEWAY_LABELS[gateway] ?? gateway} could not be completed.`}
        </p>
        {isSuccess && (
          <p className="text-sm text-muted-foreground">
            Redirecting to dashboard in 5 seconds…
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(dashboardUrl)}>
          <CreditCard className="h-4 w-4 mr-2" />
          {isPaymentDomain ? 'View Portal Dashboard' : 'View Subscription'}
        </Button>
        {!isSuccess && (
          <Button onClick={() => navigate(-1)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
