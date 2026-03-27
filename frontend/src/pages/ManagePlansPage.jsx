import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit, Trash2, CheckCircle2, XCircle, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function ManagePlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState(initialFormState());
  const [saving, setSaving] = useState(false);

  function initialFormState() {
    return {
      name: '',
      type: 'flat_rate',
      description: '',
      price: '',
      billing_cycle: 'monthly',
      credit_amount: '',
      features: '',
      is_active: true,
      is_public: true,
      sort_order: 0
    };
  }

  const fetchPlans = async () => {
    try {
      const { data } = await api.get('/subscription/admin-plans');
      setPlans(data);
    } catch (err) {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleOpenDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
        price: plan.price.toString(),
        credit_amount: plan.credit_amount ? plan.credit_amount.toString() : '',
        sort_order: plan.sort_order.toString()
      });
    } else {
      setEditingPlan(null);
      setFormData(initialFormState());
    }
    setIsDialogOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        credit_amount: formData.type === 'request_credit' ? parseInt(formData.credit_amount || 0) : null,
        sort_order: parseInt(formData.sort_order || 0),
        features: formData.features.split(',').map(f => f.trim()).filter(f => f),
        billing_cycle: formData.type === 'flat_rate' ? formData.billing_cycle : null
      };

      if (editingPlan) {
        await api.put(`/subscription/admin-plans/${editingPlan.id}`, payload);
        toast.success('Plan updated');
      } else {
        await api.post('/subscription/admin-plans', payload);
        toast.success('Plan created');
      }
      
      setIsDialogOpen(false);
      fetchPlans();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save plan';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this plan? Active subscriptions might be affected.')) return;
    try {
      await api.delete(`/subscription/admin-plans/${id}`);
      toast.success('Plan deleted');
      fetchPlans();
    } catch (err) {
      toast.error('Failed to delete plan');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/subscription')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Manage Packages</h2>
            <p className="text-muted-foreground mt-1">Create and modify subscription plans and credit packs.</p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading plans...
                  </TableCell>
                </TableRow>
              ) : plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No plans created yet.
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-xs text-muted-foreground">{plan.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {plan.type.replace('_', ' ')}
                      </Badge>
                      {plan.type === 'request_credit' && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({plan.credit_amount} credits)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      ৳{Number(plan.price).toLocaleString()}
                      {plan.type === 'flat_rate' && plan.billing_cycle && (
                        <span className="text-xs text-muted-foreground"> /{plan.billing_cycle}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.is_active ? (
                        <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {plan.is_public ? (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">Public</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">Private</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(plan.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
              <DialogDescription>
                Configure the package pricing and limits.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan Name</label>
                  <Input name="name" value={formData.name} onChange={handleChange} required placeholder="e.g. Pro Monthly" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(val) => setFormData(p => ({ ...p, type: val }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat_rate">Flat-Rate License</SelectItem>
                      <SelectItem value="request_credit">Request Credits Pack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Input name="description" value={formData.description || ''} onChange={handleChange} placeholder="Short description of the plan" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price (৳)</label>
                  <Input name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} required />
                </div>
                
                {formData.type === 'flat_rate' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Billing Cycle</label>
                    <Select 
                      value={formData.billing_cycle} 
                      onValueChange={(val) => setFormData(p => ({ ...p, billing_cycle: val }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="lifetime">Lifetime (One-time)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Credits Amount</label>
                    <Input name="credit_amount" type="number" value={formData.credit_amount} onChange={handleChange} required />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex justify-between">
                  <span>Features List</span>
                  <span className="text-xs text-muted-foreground font-normal">Comma-separated</span>
                </label>
                <Input name="features" value={formData.features} onChange={handleChange} placeholder="e.g. Unlimited Apps, Premium Support, Free SSL" />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Active (Visible)</label>
                  <Switch 
                    checked={formData.is_active} 
                    onCheckedChange={(c) => setFormData(p => ({ ...p, is_active: c }))} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Public (Everyone)</label>
                  <Switch 
                    checked={formData.is_public} 
                    onCheckedChange={(c) => setFormData(p => ({ ...p, is_public: c }))} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort Order</label>
                  <Input name="sort_order" type="number" value={formData.sort_order} onChange={handleChange} placeholder="0" />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Plan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
