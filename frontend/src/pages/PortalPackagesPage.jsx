import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Zap, CheckCircle2, TrendingUp, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function PortalPackagesPage() {
  const { domain, portalInfo } = useOutletContext();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const initialType = urlParams.get('type') === 'credits' ? 'request_credit' : 'flat_rate';
  const [planTab, setPlanTab] = useState(initialType); // flat_rate | request_credit

  // If there's no domain provided, we can still show packages, but clicking Buy will redirect them to home to enter domain first
  
  const plans = portalInfo?.plans || [];
  const systemEnabled = portalInfo?.system_enabled !== false;
  const currentStatus = portalInfo?.current;
  const flatSub = currentStatus?.flat_subscription;

  const filteredPlans = plans.filter(p => p.type === planTab);

  const handleSubscribe = (plan) => {
    if (!domain) {
      navigate('/?error=domain_required');
      return;
    }
    
    if (!portalInfo?.enabled_gateways?.length) {
      alert('No payment gateways are currently enabled.');
      return;
    }

    // Reuse the exact same payment page, passing the plan and forcing context of domain
    // Actually, PaymentPage reads domain from URL or State?
    // Wait, the existing PaymentPage expects `plan` in `location.state`.
    navigate(`/payment?domain=${domain}`, { state: { plan } });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 border-b pb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Available Packages</h2>
          <p className="text-muted-foreground mt-1 text-lg">
            Choose the right subscription for your application.
          </p>
        </div>
      </div>

      <div>
        <div className="flex gap-3 mb-8 bg-muted/30 p-1.5 rounded-lg w-max border border-border/50">
          <Button
            variant={planTab === 'flat_rate' ? 'default' : 'ghost'}
            className={planTab === 'flat_rate' ? 'shadow-sm' : 'hover:bg-background/50'}
            onClick={() => setPlanTab('flat_rate')}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Access Plans
          </Button>
          <Button
            variant={planTab === 'request_credit' ? 'default' : 'ghost'}
            className={planTab === 'request_credit' ? 'shadow-sm' : 'hover:bg-background/50'}
            onClick={() => setPlanTab('request_credit')}
          >
            <Zap className="h-4 w-4 mr-2" />
            Metered Credits
          </Button>
        </div>

        {filteredPlans.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border-dashed bg-muted/10 shadow-none">
            <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg">No {planTab === 'flat_rate' ? 'access plans' : 'credit packs'} available currently.</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlans.map((plan) => {
              const isCurrentPlan = domain && flatSub?.plan?.id === plan.id;
              
              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col transition-all duration-200 overflow-hidden bg-background/50 backdrop-blur-sm ${
                    isCurrentPlan
                      ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/30 -translate-y-1'
                      : 'hover:border-primary/50 hover:shadow-lg hover:-translate-y-1'
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
                  )}
                  {isCurrentPlan && (
                    <span className="absolute top-3 right-4 text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
                      Current Plan
                    </span>
                  )}
                  <CardHeader className="pb-4 pt-6">
                    <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[40px]">{plan.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 justify-between gap-6">
                    <div>
                      <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-4xl font-extrabold tracking-tight">
                          ৳{Number(plan.price).toLocaleString()}
                        </span>
                        {plan.billing_cycle && (
                          <span className="text-muted-foreground font-medium">
                            /{plan.billing_cycle === 'monthly' ? 'mo'
                               : plan.billing_cycle === 'yearly' ? 'yr'
                               : 'one-time'}
                          </span>
                        )}
                        {plan.type === 'request_credit' && plan.credit_amount && (
                          <span className="text-sm font-semibold text-violet-500 ml-2 bg-violet-500/10 px-2 py-0.5 rounded-md">
                            = {plan.credit_amount.toLocaleString()} credits
                          </span>
                        )}
                      </div>

                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <ul className="space-y-3">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm font-medium text-foreground/80">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span className="leading-snug">{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <Button
                      size="lg"
                      className={`w-full font-bold shadow-md transition-all ${isCurrentPlan ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' : ''}`}
                      variant={isCurrentPlan ? 'default' : 'default'}
                      onClick={() => handleSubscribe(plan)}
                      disabled={!systemEnabled}
                    >
                      {isCurrentPlan ? 'Renew Plan' : plan.type === 'request_credit' ? 'Buy Credits' : 'Subscribe Now'}
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
