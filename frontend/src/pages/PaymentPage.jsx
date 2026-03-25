import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CreditCard, Loader2, ArrowLeft } from 'lucide-react';

const GATEWAY_META = {
  bkash: {
    label: 'bKash',
    color: '#E2136E',
    bgClass: 'bg-[#E2136E]/10 border-[#E2136E]/40 hover:border-[#E2136E]',
    textClass: 'text-[#E2136E]',
    emoji: '🔴',
  },
  nagad: {
    label: 'Nagad',
    color: '#F6821F',
    bgClass: 'bg-[#F6821F]/10 border-[#F6821F]/40 hover:border-[#F6821F]',
    textClass: 'text-[#F6821F]',
    emoji: '🟠',
  },
  sslcommerz: {
    label: 'SSL Commerce',
    color: '#2196F3',
    bgClass: 'bg-[#2196F3]/10 border-[#2196F3]/40 hover:border-[#2196F3]',
    textClass: 'text-[#2196F3]',
    emoji: '🔵',
  },
};

export default function PaymentPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const plan = state?.plan;

  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(false);

  // Gateways that are enabled (passed via location state or discovered via SubscriptionPage)
  // For resilience, we try all three; the backend will reject disabled ones anyway
  const gateways = Object.keys(GATEWAY_META);

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-4 text-muted-foreground">
        <p>No plan selected. Go back to Subscription.</p>
        <Button variant="outline" onClick={() => navigate('/subscription')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const handlePay = async () => {
    if (!selected) {
      toast.error('Please select a payment gateway.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/subscription/subscribe', {
        plan_id: plan.id,
        gateway: selected,
      });

      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        toast.error('No payment URL returned. Check gateway configuration.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment initiation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/subscription')}>
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

      {/* Gateway grid */}
      <div>
        <p className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
          Select Payment Method
        </p>
        <div className="grid grid-cols-1 gap-3">
          {gateways.map((gw) => {
            const meta = GATEWAY_META[gw];
            const isSelected = selected === gw;
            return (
              <button
                key={gw}
                onClick={() => setSelected(gw)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  isSelected
                    ? `${meta.bgClass} border-current ring-1 ring-offset-0`
                    : `border-border hover:border-muted-foreground/50 bg-card`
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
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handlePay}
        disabled={loading || !selected}
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
