import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Save, X, Route, Activity } from 'lucide-react';

export default function BillableRoutesPage() {
  const [routes, setRoutes]     = useState([]);
  const [usageLogs, setLogs]    = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setTab]     = useState('routes'); // routes | logs
  const [editId, setEditId]     = useState(null);
  const [newRow, setNewRow]     = useState(null);
  const [editData, setEditData] = useState({});

  const fetchRoutes = async () => {
    try {
      const { data } = await api.get('/subscription/billable-routes');
      setRoutes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data } = await api.get('/subscription/usage-logs');
      setLogs(data.data ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRoutes();
    fetchLogs();
  }, []);

  const startEdit = (route) => {
    setEditId(route.id);
    setEditData({ path: route.path, charge_per_request: route.charge_per_request, description: route.description ?? '' });
  };

  const saveEdit = async (id) => {
    try {
      const { data } = await api.put(`/subscription/billable-routes/${id}`, editData);
      setRoutes(prev => prev.map(r => r.id === id ? data : r));
      setEditId(null);
      toast.success('Route updated.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update route.');
    }
  };

  const deleteRoute = async (id) => {
    if (!confirm('Delete this billable route?')) return;
    try {
      await api.delete(`/subscription/billable-routes/${id}`);
      setRoutes(prev => prev.filter(r => r.id !== id));
      toast.success('Route deleted.');
    } catch (e) {
      toast.error('Failed to delete route.');
    }
  };

  const toggleActive = async (route) => {
    try {
      const { data } = await api.put(`/subscription/billable-routes/${route.id}`, {
        is_active: !route.is_active,
      });
      setRoutes(prev => prev.map(r => r.id === route.id ? data : r));
    } catch (e) {
      toast.error('Failed to toggle route.');
    }
  };

  const createRoute = async () => {
    if (!newRow?.path || !newRow?.charge_per_request) {
      toast.error('Path and charge are required.');
      return;
    }
    try {
      const { data } = await api.post('/subscription/billable-routes', {
        path: newRow.path,
        charge_per_request: Number(newRow.charge_per_request),
        description: newRow.description ?? '',
        is_active: true,
      });
      setRoutes(prev => [data, ...prev]);
      setNewRow(null);
      toast.success('Billable route created.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create route.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billable Routes</h2>
          <p className="text-muted-foreground mt-1">
            Define request paths that charge credits per hit
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'routes' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('routes')}
          >
            <Route className="h-4 w-4 mr-1.5" /> Routes
          </Button>
          <Button
            variant={activeTab === 'logs' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab('logs')}
          >
            <Activity className="h-4 w-4 mr-1.5" /> Usage Logs
          </Button>
        </div>
      </div>

      {activeTab === 'routes' && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex justify-end">
              <Button size="sm" onClick={() => setNewRow({ path: '', charge_per_request: 1, description: '' })}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Route
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Credits / Request</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* New row inline */}
                {newRow !== null && (
                  <TableRow className="bg-primary/5">
                    <TableCell>
                      <Input
                        placeholder="invoice-create"
                        value={newRow.path}
                        onChange={e => setNewRow({ ...newRow, path: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" min={1}
                        value={newRow.charge_per_request}
                        onChange={e => setNewRow({ ...newRow, charge_per_request: e.target.value })}
                        className="h-8 w-24 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Optional description"
                        value={newRow.description}
                        onChange={e => setNewRow({ ...newRow, description: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" className="h-7 w-7" onClick={createRoute}>
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setNewRow(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {routes.length === 0 && !loading && newRow === null && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No billable routes defined yet.
                    </TableCell>
                  </TableRow>
                )}

                {routes.map((route) =>
                  editId === route.id ? (
                    <TableRow key={route.id} className="bg-muted/30">
                      <TableCell>
                        <Input
                          value={editData.path}
                          onChange={e => setEditData({ ...editData, path: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={1}
                          value={editData.charge_per_request}
                          onChange={e => setEditData({ ...editData, charge_per_request: e.target.value })}
                          className="h-8 w-24 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editData.description}
                          onChange={e => setEditData({ ...editData, description: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" className="h-7 w-7" onClick={() => saveEdit(route.id)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={route.id}>
                      <TableCell className="font-mono text-sm">/{route.path}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {route.charge_per_request} cr
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {route.description || '—'}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => toggleActive(route)}>
                          <Badge variant={route.is_active ? 'success' : 'secondary'}>
                            {route.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(route)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRoute(route.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Credits Charged</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No usage logs yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  usageLogs.map((log) => (
                    <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.domain || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-sm">/{log.path_hit}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-amber-400 border-amber-400/30">
                          -{log.credits_charged} cr
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
