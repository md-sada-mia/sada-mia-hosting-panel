import { useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, Clock, Search, ShieldCheck, XCircle, History, ExternalLink, Coins } from 'lucide-react';

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
  const creditSubs = current?.credit_subscriptions || [];
  const recentTransactions = portalInfo?.recent_transactions || [];
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
            <a href={`http://${domain}`} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-primary transition-colors hover:underline">
              {domain}
            </a>
            <Button variant="ghost" size="sm" onClick={clearDomain} className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0">
              <XCircle className="h-3.5 w-3.5 mr-1" /> Change Domain
            </Button>
          </div>
        </div>
        <div className="hidden sm:block">
          <Button asChild variant="outline" className="gap-2 border-primary/20 hover:border-primary/50 text-primary hover:text-primary hover:bg-primary/5 transition-all shadow-sm">
            <a href={`http://${domain}`} target="_blank" rel="noopener noreferrer">
              Back to Website
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
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

          {/* Credits */}
          {creditSubs.length > 0 &&
            creditSubs.map((sub) => (
              <Card key={sub.id} className="relative overflow-hidden border-violet-500/50 shadow-violet-500/10">
                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-violet-500" />
                      Request Credits
                    </span>
                    <Badge variant="outline" className="text-violet-500 border-violet-500/30">Active</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-3xl font-bold tracking-tight text-violet-600 dark:text-violet-400">
                      {(sub.credit_balance ?? 0).toLocaleString()} <span className="text-sm font-medium text-muted-foreground tracking-normal">remaining</span>
                    </p>
                    <p className="text-sm font-medium text-foreground bg-muted/40 p-2 rounded-md border border-border/50">
                      Allocated from: {sub.plan?.name || 'Custom Credits'}
                    </p>
                  </div>
                  <div className="mt-6">
                    <Button asChild className="w-full shadow-sm" variant="outline">
                      <Link to={`/packages?domain=${domain}&type=credits`}>
                        Buy More Credits
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          }
        </div>

        {/* Recent Transactions */}
        <Card className="relative overflow-hidden h-fit shadow-md">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {recentTransactions.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] uppercase bg-muted/30 text-muted-foreground tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-background/50">
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors duration-150">
                        <td className="px-4 py-3.5 font-medium">{tx.plan?.name || 'N/A'}</td>
                        <td className="px-4 py-3.5 font-bold text-foreground">
                          {tx.currency === 'BDT' ? '৳' : (tx.currency + ' ')}{Number(tx.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge 
                            variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                            className="text-[10px]"
                          >
                            {tx.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground shrink-0 text-xs">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-10 text-center px-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-4">
                    <History className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">No recent transactions found.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
