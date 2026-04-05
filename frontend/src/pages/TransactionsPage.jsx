import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { History, Search, FilterX, ChevronLeft, ChevronRight, Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [refundReason, setRefundReason] = useState('Admin refund');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  // Read URL params
  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const gateway = searchParams.get('gateway') || '';

  const updateParam = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.set('page', '1'); // reset page on filter
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const params = { page };
        if (search) params.search = search;
        if (status) params.status = status;
        if (gateway) params.gateway = gateway;

        const res = await api.get('/subscription/transactions', { params });
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load transactions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [page, search, status, gateway]);

  const handleRefund = async () => {
    if (!selectedTx) return;
    setRefunding(true);
    try {
      const res = await api.post(`/subscription/transactions/${selectedTx.id}/refund`, {
        reason: refundReason
      });
      toast.success('Transaction refunded successfully');
      
      // Update local state
      setData(prev => ({
        ...prev,
        data: prev.data.map(tx => tx.id === selectedTx.id ? res.data.transaction : tx)
      }));
      
      setIsRefundModalOpen(false);
      setSelectedTx(null);
      setRefundReason('Admin refund');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process refund');
      console.error(err);
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground mt-1">
          Full history of payment transactions across all gateways.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Transaction Log
          </CardTitle>
          <CardDescription>
            Search by domain, transaction ID, or plan name. Filter by gateway and status.
          </CardDescription>

          <div className="flex flex-col sm:flex-row gap-3 mt-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search domain, transaction ID..."
                className="pl-9 h-10 w-full"
                value={search}
                onChange={(e) => updateParam('search', e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(val) => updateParam('status', val === 'all' ? '' : val)}>
              <SelectTrigger className="w-full sm:w-[150px] h-10">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={gateway} onValueChange={(val) => updateParam('gateway', val === 'all' ? '' : val)}>
              <SelectTrigger className="w-full sm:w-[150px] h-10">
                <SelectValue placeholder="All Gateways" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Gateways</SelectItem>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="sslcommerz">SSL Commerce</SelectItem>
              </SelectContent>
            </Select>
            {(search || status || gateway) && (
              <Button variant="ghost" className="h-10 px-3" onClick={clearFilters}>
                <FilterX className="h-4 w-4 mr-2" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3">Tx ID / Ref</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Gateway</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y relative min-h-[200px]">
                {loading && !data && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                      Loading transactions...
                    </td>
                  </tr>
                )}
                {!loading && data?.data?.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-muted-foreground italic">
                      No transactions found matching your criteria.
                    </td>
                  </tr>
                )}
                {data?.data?.map((tx) => (
                  <tr key={tx.id} className={`hover:bg-muted/30 ${loading ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {tx.transaction_id || tx.gateway_ref || '-'}
                    </td>
                    <td className="px-4 py-3 font-medium">{tx.domain || 'Panel Admin'}</td>
                    <td className="px-4 py-3">{tx.plan?.name || 'N/A'}</td>
                    <td className="px-4 py-3 capitalize">{tx.gateway}</td>
                    <td className="px-4 py-3 font-bold">
                      {tx.currency === 'BDT' ? '৳' : (tx.currency + ' ')}{Number(tx.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge 
                        variant={tx.status === 'completed' ? 'success' : tx.status === 'refunded' ? 'warning' : tx.status === 'pending' ? 'secondary' : 'destructive'}
                        className="text-[10px]"
                      >
                        {tx.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground shrink-0 text-xs">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.status === 'completed' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                          title="Issue Refund"
                          onClick={() => {
                            setSelectedTx(tx);
                            setIsRefundModalOpen(true);
                          }}
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {data.from} to {data.to} of {data.total} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.current_page === 1}
                  onClick={() => updateParam('page', data.current_page - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <div className="text-sm font-medium px-2">
                  Page {data.current_page} of {data.last_page}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.current_page === data.last_page}
                  onClick={() => updateParam('page', data.current_page + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Refund
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to refund this transaction? This will:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-mono">{selectedTx?.transaction_id || selectedTx?.gateway_ref}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold">{selectedTx?.currency} {selectedTx?.amount}</span>
              </div>
              <div className="flex justify-between border-t pt-2 border-dashed">
                <span className="text-muted-foreground">Effect:</span>
                <span className="text-orange-600 font-medium">Deactivate subscription / Deduct credits</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for refund</label>
              <Textarea 
                placeholder="Enter reason..." 
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsRefundModalOpen(false)} disabled={refunding}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRefund} 
              disabled={refunding}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {refunding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : 'Confirm Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
