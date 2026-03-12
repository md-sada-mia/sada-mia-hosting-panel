import { useState, useEffect } from 'react';
import { Network, Plus, Trash2, Edit, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function LoadBalancersPage() {
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
    domains: '', // comma separated string
    app_ids: [],
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
        domains: lb.domains ? lb.domains.join(', ') : '',
        app_ids: lb.apps.map(a => a.id),
      });
    } else {
      setEditingLb(null);
      setFormData({
        name: '',
        method: 'round_robin',
        domains: '',
        app_ids: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLb(null);
  };

  const toggleAppSelection = (appId) => {
    setFormData(prev => ({
      ...prev,
      app_ids: prev.app_ids.includes(appId)
        ? prev.app_ids.filter(id => id !== appId)
        : [...prev.app_ids, appId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.domains || formData.app_ids.length === 0) {
      toast.error('Name, domains, and at least one app are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        method: formData.method,
        domains: formData.domains.split(',').map(d => d.trim()).filter(Boolean),
        app_ids: formData.app_ids,
      };

      if (editingLb) {
        await api.put(`/load-balancers/${editingLb.id}`, payload);
      } else {
        await api.post('/load-balancers', payload);
      }

      toast.success(`Load balancer ${editingLb ? 'updated' : 'created'} successfully`);
      handleCloseModal();
      fetchData();
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
                  <th className="px-6 py-4 font-medium">Domains</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium">Apps</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadBalancers.map((lb) => (
                  <tr key={lb.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {lb.name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {lb.domains && lb.domains.map((d, i) => (
                          <span key={i} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lb.method === 'round_robin' ? 'Round Robin' : lb.method === 'least_conn' ? 'Least Connections' : 'IP Hash'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {lb.apps.map((a) => (
                          <span key={a.id} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(lb)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
                          title="Edit"
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
                  <label className="block text-sm font-medium mb-1">Domains (comma separated)</label>
                  <input
                    type="text"
                    required
                    value={formData.domains}
                    onChange={(e) => setFormData({ ...formData, domains: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g. app.example.com, www.example.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Traffic sent to these domains will be load balanced across the selected apps. Subdomains will auto-create DNS A records.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="round_robin">Round Robin (Sequential)</option>
                    <option value="least_conn">Least Connections</option>
                    <option value="ip_hash">IP Hash (Sticky Sessions)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Target Applications</label>
                  <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto bg-muted/20">
                    {apps.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">No apps available</p>
                    ) : (
                      apps.map(app => (
                        <label key={app.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer transition-colors border border-transparent hover:border-border">
                          <input
                            type="checkbox"
                            checked={formData.app_ids.includes(app.id)}
                            onChange={() => toggleAppSelection(app.id)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">{app.name}</p>
                            <p className="text-xs text-muted-foreground">{app.domain}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  {formData.app_ids.length === 0 && (
                    <p className="text-xs text-destructive mt-1">Please select at least one application.</p>
                  )}
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
                disabled={isSubmitting || formData.app_ids.length === 0}
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
