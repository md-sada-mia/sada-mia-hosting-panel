import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Zap, CheckCircle2, Star, RefreshCw,
  TrendingUp, Coins, Settings, Package,
  DollarSign, Activity, History, ArrowRight
} from 'lucide-react';

export default function SubscriptionPage() {
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState(null);
  const [systemEnabled, setSystemEnabled] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/subscription/stats');
      setStats(data);
      
      const { data: config } = await api.get('/subscription/plans');
      setSystemEnabled(config.system_enabled);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load merchant statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading merchant dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overall subscription and revenue overview.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={systemEnabled ? "success" : "secondary"}>
             {systemEnabled ? 'System Active' : 'System Disabled'}
          </Badge>
          <Link to="/settings#system" className="text-[10px] text-muted-foreground hover:underline">
             Configure in Settings
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳{Number(stats?.total_revenue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime earnings from all gateways</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_flat_rate || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">End-users with current flat-rate plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Float Credits</CardTitle>
            <Coins className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(stats?.total_credits_held || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total request credits held by domains</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Transactions
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="text-xs" disabled>
            View All <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Gateway</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats?.recent_transactions?.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{tx.domain || 'Panel Admin'}</td>
                    <td className="px-4 py-3">{tx.plan?.name || 'N/A'}</td>
                    <td className="px-4 py-3 font-bold">৳{Number(tx.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{tx.gateway}</td>
                    <td className="px-4 py-3">
                      <Badge 
                        variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                        className="text-[10px]"
                      >
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground shrink-0">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!stats?.recent_transactions?.length && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground italic">
                      No recent transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-muted/20 p-6 rounded-xl border border-dashed text-center space-y-2">
        <TrendingUp className="h-8 w-8 mx-auto text-primary/40" />
        <h3 className="font-semibold">Public Portal Active</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your end-users and agencies can subscribe to plans directly at your public portal. 
          Use the <strong>Settings</strong> page to configure the portal domain and gateway credentials.
        </p>
      </div>
    </div>
  );
}
