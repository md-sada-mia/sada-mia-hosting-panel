import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Plus, Trash2, Edit, RefreshCw, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LoadBalancersPage() {
  const navigate = useNavigate();
  const [loadBalancers, setLoadBalancers] = useState([]);
  const [apps, setApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [editingLb, setEditingLb] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    method: 'round_robin',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [lbRes, appsRes] = await Promise.all([
        api.get('/load-balancers'),
        api.get('/apps')
      ]);

      setLoadBalancers(lbRes.data);
      setApps(appsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (lb = null) => {
    if (lb) {
      setEditingLb(lb);
      setFormData({
        name: lb.name,
        method: lb.method,
      });
    } else {
      setEditingLb(null);
      setFormData({
        name: '',
        method: 'round_robin',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLb(null);
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        method: formData.method,
      };

      let res;
      if (editingLb) {
        res = await api.put(`/load-balancers/${editingLb.id}`, payload);
      } else {
        res = await api.post('/load-balancers', payload);
      }

      toast.success(`Load balancer ${editingLb ? 'updated' : 'created'} successfully`);
      handleCloseModal();
      if (!editingLb && res.data?.id) {
          navigate(`/load-balancers/${res.data.id}/manage`);
      } else {
          fetchData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to save load balancer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (lb) => {
    if (!confirm(`Are you sure you want to delete load balancer ${lb.name}?`)) return;

    setIsDeleting(lb.id);
    try {
      await api.delete(`/load-balancers/${lb.id}`);
      toast.success('Load balancer deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete load balancer');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Load Balancers</h1>
          <p className="text-muted-foreground mt-1">
            Distribute traffic across multiple applications using a single domain.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Load Balancer
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : loadBalancers.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-lg border border-dashed">
          <Network className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium">No Load Balancers</h3>
          <p className="text-muted-foreground mt-1 max-w-sm mx-auto mb-6">
            You haven't created any load balancers yet. Create one to distribute traffic among your apps.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors mx-auto"
          >
            <Plus className="h-4 w-4" />
            Create Load Balancer
          </button>
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium text-center">Apps</th>
                  <th className="px-6 py-4 font-medium text-center">Domains</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadBalancers.map((lb) => (
                  <tr key={lb.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {lb.name}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {lb.method === 'round_robin' ? 'Round Robin' : lb.method === 'least_conn' ? 'Least Connections' : 'IP Hash'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/5 text-emerald-500 border border-emerald-500/10 text-xs font-semibold">
                         {lb.apps?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/5 text-blue-400 border border-blue-500/10 text-xs font-semibold">
                         {lb.domains?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                        lb.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 
                        lb.status === 'error' ? 'bg-rose-500/10 text-rose-500' : 
                        'bg-amber-500/10 text-amber-400'
                      }`}>
                        {lb.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <a
                          href={`/load-balancers/${lb.id}/manage`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-all rounded-md text-xs font-semibold"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          Manage
                        </a>
                        <button
                          onClick={() => handleOpenModal(lb)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                          title="Quick Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lb)}
                          disabled={isDeleting === lb.id}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10 disabled:opacity-50"
                          title="Delete"
                        >
                          {isDeleting === lb.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-lg rounded-lg shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingLb ? 'Edit Load Balancer' : 'Create Load Balancer'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure traffic distribution across your applications.
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="lb-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g. Production LB"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Method</label>
                  <Select
                    value={formData.method}
                    onValueChange={(value) => setFormData({ ...formData, method: value })}
                  >
                    <SelectTrigger className="w-full bg-transparent">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_robin">Round Robin (Sequential)</SelectItem>
                      <SelectItem value="least_conn">Least Connections</SelectItem>
                      <SelectItem value="ip_hash">IP Hash (Sticky Sessions)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </form>
            </div>

            <div className="p-6 border-t bg-muted/20 flex justify-end gap-3 mt-auto">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="px-4 py-2 border rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="lb-form"
                disabled={isSubmitting || !formData.name}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Load Balancer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
