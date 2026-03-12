import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Network, Plus, Trash2, RefreshCw, ChevronLeft, 
  Globe, Server, Layout, Settings2, Trash, Save,
  AlertCircle, Activity, Box, Database, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LoadBalancerManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lb, setLb] = useState(null);
  const [allApps, setAllApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Real-time editable states
  const [name, setName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [selectedAppToAdd, setSelectedAppToAdd] = useState('');

  useEffect(() => {
    fetchLB();
    fetchApps();
  }, [id]);

  const fetchLB = async () => {
    try {
      const { data } = await api.get(`/load-balancers/${id}`);
      setLb(data);
      setName(data.name);
    } catch (error) {
      toast.error('Failed to load load balancer');
      navigate('/load-balancers');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApps = async () => {
    try {
      const { data } = await api.get('/apps');
      setAllApps(data);
    } catch (error) {
      toast.error('Failed to load applications');
    }
  };

  const updateLB = async (payload) => {
    setIsSaving(true);
    try {
      const { data } = await api.put(`/load-balancers/${id}`, {
        ...payload,
        // Ensure we send the required fields if they aren't in payload
        name: payload.name || lb.name,
        method: payload.method || lb.method,
        domains: payload.domains || lb.domains,
        app_ids: payload.app_ids || lb.apps.map(a => a.id),
      });
      setLb(data);
      toast.success('Updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRename = () => {
    if (name.trim() === '' || name === lb.name) return;
    updateLB({ name: name.trim() });
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    
    setIsSaving(true);
    try {
      const { data } = await api.post(`/load-balancers/${id}/domains`, { domain: newDomain.trim() });
      setLb(data);
      setNewDomain('');
      toast.success('Domain added successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add domain');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDomain = async (domainToRemove) => {
    setIsSaving(true);
    try {
      const { data } = await api.delete(`/load-balancers/${id}/domains`, { data: { domain: domainToRemove } });
      setLb(data);
      toast.success('Domain removed successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove domain');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddApp = async () => {
    if (!selectedAppToAdd) return;
    
    setIsSaving(true);
    try {
      const { data } = await api.post(`/load-balancers/${id}/apps`, { app_id: selectedAppToAdd });
      setLb(data);
      setSelectedAppToAdd('');
      toast.success('App attached successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to attach app');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveApp = async (appId) => {
    setIsSaving(true);
    try {
      const { data } = await api.delete(`/load-balancers/${id}/apps/${appId}`);
      setLb(data);
      toast.success('App detached successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to detach app');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-transparent">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!lb) return null;

  const availableApps = allApps.filter(app => !lb.apps.some(lbApp => lbApp.id === app.id));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header with Navigation and Name Input */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/load-balancers')}
            className="rounded-full h-10 w-10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="relative flex-1 max-w-md group">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="text-2xl font-bold h-auto py-1 px-2 bg-transparent border-transparent hover:border-border focus:border-primary transition-all rounded shadow-none"
              placeholder="Load Balancer Name"
            />
            {isSaving && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* Top Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 bg-card/60 border rounded-xl px-5 py-2.5 shadow-sm">
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5 tracking-wider">Status</span>
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${lb.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${lb.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                {lb.status || 'pending'}
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5 tracking-wider">Total Apps</span>
              <span className="text-sm font-bold flex items-center justify-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-primary" />
                {lb.apps?.length || 0}
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5 tracking-wider">Domains</span>
              <span className="text-sm font-bold flex items-center justify-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                {lb.domains?.length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Domains Management */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-primary/10 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Entry Domains
                </CardTitle>
              </div>
              <CardDescription>
                Traffic to these domains will be balanced.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddDomain} className="flex gap-2">
                <Input
                  placeholder="e.g. lb.example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="bg-muted/30 h-10 border-white/5 focus:ring-1"
                />
                <Button type="submit" size="icon" disabled={isSaving || !newDomain.trim()} className="shrink-0 h-10 w-10">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {lb.domains?.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed text-muted-foreground italic text-sm">
                    No domains assigned
                  </div>
                ) : (
                  lb.domains?.map((domain, idx) => (
                    <div key={idx} className="group flex items-center justify-between p-3 rounded-xl border bg-card/50 hover:bg-accent/40 transition-all border-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                          <Globe className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium truncate">{domain}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled={isSaving}
                        onClick={() => handleRemoveDomain(domain)}
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Config Card */}
          <Card className="border-border/40 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Load Balancing Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={lb.method}
                onValueChange={(value) => updateLB({ method: value })}
              >
                <SelectTrigger className="w-full bg-muted/30 border-white/5">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin (Sequential)</SelectItem>
                  <SelectItem value="least_conn">Least Connections</SelectItem>
                  <SelectItem value="ip_hash">IP Hash (Sticky Sessions)</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed italic">
                {lb.method === 'round_robin' && "Distributes requests sequentially among all servers."}
                {lb.method === 'least_conn' && "Sends requests to the server with the fewest active connections."}
                {lb.method === 'ip_hash' && "Ensures a user is always served by the same backend app (IP sticky)."}
                {lb.method === 'random' && "Distributes requests randomly among all servers."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Apps Management */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-emerald-500/10 shadow-lg relative overflow-hidden">
            {/* Split Top Gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-emerald-500 opacity-20" />
            
            <CardHeader className="pb-4 sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b mb-1">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="h-5 w-5 text-emerald-500" />
                  Target Applications
                </CardTitle>
                <CardDescription>
                  Configure instances to handle the shared traffic.
                </CardDescription>
              </div>
              
              <div className="flex gap-2 min-w-[300px]">
                <Select
                  value={selectedAppToAdd}
                  onValueChange={setSelectedAppToAdd}
                >
                  <SelectTrigger className="flex-1 bg-muted/40 border-white/5">
                    <SelectValue placeholder="Select app to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableApps.map(app => (
                      <SelectItem key={app.id} value={app.id.toString()}>
                        {app.name} ({app.domain})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddApp} 
                  disabled={isSaving || !selectedAppToAdd}
                  className="bg-emerald-600 hover:bg-emerald-700 h-10 gap-2"
                >
                  <Plus className="h-4 w-4" /> 
                  <span className="hidden sm:inline">Add App</span>
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lb.apps?.map((app) => (
                  <div key={app.id} className="group flex flex-col p-4 rounded-xl border bg-card/50 hover:bg-accent/30 transition-all border-white/5 relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-500">
                          <Box className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm truncate">{app.name}</h4>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                            <Globe className="h-3 w-3" /> {app.domain}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                        app.status === 'running' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {app.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                      <div className="flex gap-4">
                         <div className="text-[10px]">
                            <span className="text-muted-foreground block">Type</span>
                            <span className="font-semibold capitalize">{app.type}</span>
                         </div>
                         <div className="text-[10px]">
                            <span className="text-muted-foreground block">Internal Port</span>
                            <span className="font-mono">{app.port || '80'}</span>
                         </div>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={isSaving}
                        onClick={() => handleRemoveApp(app.id)}
                        className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash className="h-3.5 w-3.5 mr-1.5" />
                        <span className="text-[10px] font-bold uppercase">Detach</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {lb.apps?.length === 0 && (
                <div className="text-center py-20 bg-muted/5 rounded-xl border border-dashed">
                  <Activity className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <h4 className="font-semibold text-muted-foreground">No target apps selected</h4>
                  <p className="text-sm text-muted-foreground/60">This load balancer needs at least one application to serve traffic.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integration Note */}
          <div className="p-4 rounded-xl border border-dashed border-primary/20 bg-primary/5 flex gap-4 items-start">
             <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
             <div className="text-xs text-muted-foreground leading-relaxed">
                <p className="font-bold text-primary mb-1 uppercase tracking-wider">Automated DNS Integration</p>
                When you add a subdomain to this load balancer, Sada Mia Panel automatically creates the necessary <b>A records</b> on your main hosting domain. Make sure your server's public IP is correctly pointed if using external DNS for the main domain.
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
