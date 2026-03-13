import { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Edit2, Trash2, RefreshCw, ExternalLink,
  Phone, Mail, Building2, UserCheck, Target, TrendingUp, Network, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  lead:     { label: 'Lead',     color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  active:   { label: 'Active',   color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  inactive: { label: 'Inactive', color: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function CustomerAvatar({ name, size = 'md' }) {
  const initial = (name || '?')[0].toUpperCase();
  const colors = [
    'bg-violet-500/20 text-violet-400', 'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400',
    'bg-rose-500/20 text-rose-400', 'bg-cyan-500/20 text-cyan-400',
  ];
  const color = colors[initial.charCodeAt(0) % colors.length];
  const sz = size === 'lg' ? 'h-12 w-12 text-lg' : 'h-9 w-9 text-sm';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
      {initial}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CrmPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/customers');
      setCustomers(data);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCustomer = async (c) => {
    if (!confirm(`Delete customer "${c.name}"? This will not remove linked resources.`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      setCustomers(prev => prev.filter(x => x.id !== c.id));
      toast.success('Customer deleted');
    } catch {
      toast.error('Failed to delete customer');
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    leads: customers.filter(c => c.status === 'lead').length,
    provisioned: customers.filter(c => c.resource_type).length,
  };

  // ── Filtered customers ─────────────────────────────────────────────────────
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.name, c.business_name, c.email, c.phone].some(v => v?.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            CRM
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage customers and hosting resources from a central hub.
          </p>
        </div>
        <button
          onClick={() => navigate('/crm/new')}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all font-medium shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Total Customers"  value={stats.total}       color="bg-primary/10 text-primary" />
        <StatCard icon={UserCheck}  label="Active Clients"   value={stats.active}      color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={Target}     label="Leads"            value={stats.leads}       color="bg-amber-500/10 text-amber-400" />
        <StatCard icon={TrendingUp} label="Provisioned"      value={stats.provisioned} color="bg-violet-500/10 text-violet-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, business, email or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed text-sm">
          <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
          <h3 className="text-lg font-semibold">
            {search || statusFilter !== 'all' ? 'No customers match your search' : 'No customers yet'}
          </h3>
          <p className="text-muted-foreground mt-1">
            {search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Add your first customer to get started.'}
          </p>
          {!search && statusFilter === 'all' && (
            <button
              onClick={() => navigate('/crm/new')}
              className="mt-5 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-all mx-auto"
            >
              <Plus className="h-4 w-4" /> Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left font-medium">Customer</th>
                  <th className="px-6 py-4 text-left font-medium">Contact</th>
                  <th className="px-6 py-4 text-left font-medium">Status</th>
                  <th className="px-6 py-4 text-left font-medium">Linked Resource</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(customer => (
                  <tr key={customer.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={customer.name} />
                        <div>
                          <p className="font-semibold text-foreground leading-tight">{customer.name}</p>
                          {customer.business_name && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" /> {customer.business_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        {customer.email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-1">
                            <Mail className="h-3 w-3" /> {customer.email}
                          </p>
                        )}
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {customer.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${STATUS_CONFIG[customer.status]?.color || STATUS_CONFIG.lead.color}`}>
                        {STATUS_CONFIG[customer.status]?.label || 'Lead'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {customer.resource ? (
                        <div className="flex items-center gap-2">
                          {customer.resource_type === 'load_balancer' ? (
                            <div className="flex items-center gap-2">
                              <Network className="h-3.5 w-3.5 text-blue-400" />
                              <div>
                                <p className="text-xs font-medium">{customer.resource.name}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Layers className="h-3.5 w-3.5 text-violet-400" />
                              <div>
                                <p className="text-xs font-medium">{customer.resource.name}</p>
                                {customer.resource.domain && <p className="text-[10px] text-muted-foreground">{customer.resource.domain}</p>}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => customer.resource_type === 'app' ? navigate(`/apps/${customer.resource.id}`) : navigate(`/load-balancers/${customer.resource.id}/manage`)}
                            className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted ml-0.5"
                            title="View Resource"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Not provisioned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => navigate(`/crm/edit/${customer.id}`)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteCustomer(customer)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Total count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {customers.length} customers
        </p>
      )}
    </div>
  );
}
