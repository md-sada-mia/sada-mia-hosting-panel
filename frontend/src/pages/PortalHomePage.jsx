import { useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, Clock, Coins, Search, ShieldCheck, XCircle } from 'lucide-react';

export default function PortalHomePage() {
  const { domain, setDomain, portalInfo } = useOutletContext();
  const [inputDomain, setInputDomain] = useState(domain || '');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (inputDomain.trim()) {
      setDomain(inputDomain.trim());
      navigate(`/?domain=${inputDomain.trim()}`);
    }
  };

  const clearDomain = () => {
    setDomain('');
    setInputDomain('');
    navigate(`/`);
  };

  if (!domain) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-xl mx-auto space-y-8">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Globe className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Welcome to {portalInfo?.portal_name || 'Hosting Portal'}</h1>
          <p className="text-xl text-muted-foreground">
            Manage your app and CRM subscriptions here.
          </p>
        </div>

        <Card className="w-full shadow-lg border-primary/20 bg-background/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Enter your Domain</CardTitle>
            <p className="text-sm text-muted-foreground">
              To view your active subscriptions or pay for a package, please enter your app or CRM domain below.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-10 w-full"
                  placeholder="e.g., crm.yourcompany.com"
                  value={inputDomain}
                  onChange={(e) => setInputDomain(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-10 px-6">Continue</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = portalInfo?.current;
  const flatSubs = current?.flat_subscriptions || [];
  const creditSub = current?.credit_subscription;
  const systemEnabled = current?.system_enabled !== false;

  const daysLeft = (endsAt) => {
    if (!endsAt) return null;
    const diff = Math.ceil((new Date(endsAt) - Date.now()) / 86400000);
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Subscription Dashboard</h2>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span className="font-medium text-foreground">{domain}</span>
            <Button variant="ghost" size="sm" onClick={clearDomain} className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0">
              <XCircle className="h-3.5 w-3.5 mr-1" /> Change Domain
            </Button>
          </div>
        </div>
      </div>

      {!systemEnabled && (
        <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-3 border border-dashed">
          <p className="font-semibold text-sm">System Subscriptions Disabled</p>
        </div>
      )}

      {/* Current Status Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Flat-rate Plans */}
        <div className="space-y-4">
          {flatSubs.length > 0 ? (
            flatSubs.map((sub) => (
              <Card key={sub.id} className={`relative overflow-hidden ${sub.status === 'active' ? 'border-emerald-500/50 shadow-emerald-500/10' : ''}`}>
                {sub.status === 'active' && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />}
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className={`h-5 w-5 ${sub.status === 'active' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      Access Plan
                    </span>
                    {sub.status === 'active' && <Badge variant="success" className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-none">Active</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-2xl font-bold tracking-tight">{sub.plan?.name}</p>
                    <div className="flex items-center gap-2 text-sm text-foreground/80 bg-muted/40 p-2 rounded-md border border-border/50">
                      <Clock className="h-4 w-4 text-primary" />
                      {sub.ends_at
                        ? <span className="font-medium">{daysLeft(sub.ends_at)} days remaining</span>
                        : <span className="font-medium">Lifetime Access</span>}
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button asChild className="w-full shadow-sm" variant="outline">
                      <Link to={`/packages?domain=${domain}`}>
                        Renew or Upgrade Plan
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  Access Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-2">
                  <p className="text-muted-foreground mb-4">You do not have an active access plan for this domain.</p>
                </div>
                <div className="mt-6">
                  <Button asChild className="w-full shadow-sm" variant="default">
                    <Link to={`/packages?domain=${domain}`}>
                      View Packages
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Credits */}
        <Card className={`relative overflow-hidden ${creditSub ? 'border-violet-500/50 shadow-violet-500/10' : ''}`}>
          {creditSub && <div className="absolute top-0 left-0 w-1 h-full bg-violet-500" />}
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className={`h-5 w-5 ${creditSub ? 'text-violet-500' : 'text-muted-foreground'}`} />
              Request Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditSub ? (
              <div className="space-y-3">
                <p className="text-3xl font-bold tracking-tight text-violet-600 dark:text-violet-400">
                  {(current?.credit_balance ?? 0).toLocaleString()}
                </p>
                <p className="text-sm font-medium text-muted-foreground bg-muted/40 p-2 rounded-md border border-border/50">
                  Available for metered API usage
                </p>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-muted-foreground mb-4">No credits purchased. Required only if your CRM uses metered billing routes.</p>
              </div>
            )}
            
            <div className="mt-6">
              <Button asChild className="w-full shadow-sm" variant="outline">
                <Link to={`/packages?domain=${domain}&type=credits`}>
                  Buy More Credits
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
