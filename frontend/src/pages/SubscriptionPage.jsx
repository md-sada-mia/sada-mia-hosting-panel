import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  CreditCard, Zap, CheckCircle2, Star, RefreshCw, AlertCircle,
  TrendingUp, Coins, Clock, Settings, Package
} from 'lucide-react';

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(true);
  const [plans, setPlans]               = useState([]);
  const [current, setCurrent]           = useState(null);
  const [enabledGateways, setGateways]  = useState([]);
  const [systemEnabled, setSystemEnabled] = useState(false);
  const [planTab, setPlanTab]           = useState('flat_rate'); // flat_rate | request_credit

  const fetchData = async () => {
    try {
      const [plansRes, currentRes] = await Promise.all([
        api.get('/subscription/plans'),
        api.get('/subscription/current'),
      ]);
      setPlans(plansRes.data.plans || []);
      setGateways(plansRes.data.enabled_gateways || []);
      setSystemEnabled(plansRes.data.system_enabled ?? false);
      setCurrent(currentRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);



  const filteredPlans = plans.filter(p => p.type === planTab);

  const flatSub  = current?.flat_subscription;
  const creditSub = current?.credit_subscription;

  const daysLeft = (endsAt) => {
    if (!endsAt) return null;
    const diff = Math.ceil((new Date(endsAt) - Date.now()) / 86400000);
    return diff > 0 ? diff : 0;
  };

  const handleSubscribe = (plan) => {
    if (!enabledGateways.length) {
      toast.error('No payment gateways are enabled. Configure them in Settings.');
      return;
    }
    navigate('/payment', { state: { plan } });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading subscriptions…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Subscription System</h2>
          <p className="text-muted-foreground mt-1">Manage plans, credits, and system settings.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={systemEnabled ? "success" : "secondary"}>
             {systemEnabled ? 'System Active' : 'System Disabled'}
          </Badge>
          <Link to="/settings#system" className="text-[10px] text-muted-foreground hover:underscore">
             Configure in Settings
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link to="/subscription/plans-manage">
            <Package className="h-4 w-4 mr-2" />
            Manage Plans
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/subscription/gateways">
            <Settings className="w-4 h-4 mr-2" />
            Payment Gateways
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/subscription/billable-routes">
            <Zap className="w-4 h-4 mr-2" />
            Billable Routes
          </Link>
        </Button>
      </div>

      {!systemEnabled && (
        <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-3 border border-dashed">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Subscription System is Disabled</p>
            <p className="text-xs text-muted-foreground mt-1">All middleware checks are skipped. Users have full panel access without an active plan.</p>
          </div>
        </div>
      )}

      {/* Current Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Flat-rate */}
        <Card className={flatSub?.status === 'active' ? 'border-emerald-500/40 bg-emerald-500/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-emerald-400" />
              Active Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flatSub ? (
              <div className="space-y-1">
                <p className="text-xl font-bold">{flatSub.plan?.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {flatSub.ends_at
                    ? `${daysLeft(flatSub.ends_at)} days remaining`
                    : 'Lifetime / No expiry'}
                </div>
                <Badge variant="success" className="mt-1">Active</Badge>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No active plan</p>
            )}
          </CardContent>
        </Card>

        {/* Credits */}
        <Card className={creditSub ? 'border-violet-500/40 bg-violet-500/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4 text-violet-400" />
              Request Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditSub ? (
              <div className="space-y-1">
                <p className="text-xl font-bold">
                  {(current?.credit_balance ?? 0).toLocaleString()} credits
                </p>
                <p className="text-sm text-muted-foreground">{creditSub.plan?.name}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No credits purchased</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan tabs */}
      <div>
        <div className="flex gap-2 mb-6">
          <Button
            variant={planTab === 'flat_rate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPlanTab('flat_rate')}
          >
            <CreditCard className="h-4 w-4 mr-1.5" />
            Flat-Rate Plans
          </Button>
          <Button
            variant={planTab === 'request_credit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPlanTab('request_credit')}
          >
            <Zap className="h-4 w-4 mr-1.5" />
            Credit Packs
          </Button>
        </div>

        {filteredPlans.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-dashed">
            <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
            <p>No {planTab === 'flat_rate' ? 'flat-rate plans' : 'credit packs'} available.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlans.map((plan) => {
              const isCurrentPlan = flatSub?.plan?.id === plan.id;
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col transition-all ${
                    isCurrentPlan
                      ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                      : 'hover:border-primary/50'
                  }`}
                >
                  {isCurrentPlan && (
                    <span className="absolute -top-2.5 right-4 text-[11px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-medium">
                      Current Plan
                    </span>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 justify-between gap-4">
                    <div>
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className="text-3xl font-bold">
                          ৳{Number(plan.price).toLocaleString()}
                        </span>
                        {plan.billing_cycle && (
                          <span className="text-muted-foreground text-sm">
                            /{plan.billing_cycle === 'monthly' ? 'mo'
                               : plan.billing_cycle === 'yearly' ? 'yr'
                               : 'one-time'}
                          </span>
                        )}
                        {plan.type === 'request_credit' && plan.credit_amount && (
                          <span className="text-sm text-violet-400 ml-2">
                            = {plan.credit_amount.toLocaleString()} credits
                          </span>
                        )}
                      </div>

                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <ul className="space-y-1.5">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      variant={isCurrentPlan ? 'outline' : 'default'}
                      onClick={() => handleSubscribe(plan)}
                      disabled={!systemEnabled}
                    >
                      {isCurrentPlan ? 'Renew Plan' : plan.type === 'request_credit' ? 'Buy Credits' : 'Subscribe'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
