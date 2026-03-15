import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Plus, Trash2, Play, Square, Edit, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationDialog from '@/components/ConfirmationDialog';

export default function CronPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [isSystemView, setIsSystemView] = useState(false);
  const [formData, setFormData] = useState({
    command: '',
    schedule: '* * * * *',
    description: '',
  });

  useEffect(() => {
    fetchJobs();
    // Poll for status updates while on this page
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      // Don't set loading on poll
      const { data } = await api.get('/cron-jobs');
      setJobs(data);
    } catch (err) {
      toast.error('Failed to fetch cron jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (job) => {
    const updatedJobs = jobs.map(j => j.id === job.id ? { ...j, is_active: !j.is_active } : j);
    setJobs(updatedJobs);

    try {
      const { data } = await api.post(`/cron-jobs/${job.id}/toggle`);
      setJobs(jobs.map(j => j.id === job.id ? data : j));
      toast.success(`Job ${data.is_active ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setJobs(jobs);
      toast.error('Failed to toggle job status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/cron-jobs/${jobToDelete.id}`);
      setJobs(jobs.filter(j => j.id !== jobToDelete.id));
      toast.success('Cron job deleted');
      setJobToDelete(null);
    } catch (err) {
      toast.error('Failed to delete cron job');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = (job) => {
    setJobToDelete(job);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingJob) {
        const { data } = await api.put(`/cron-jobs/${editingJob.id}`, formData);
        setJobs(jobs.map(j => j.id === editingJob.id ? data : j));
        toast.success('Cron job updated');
      } else {
        const { data } = await api.post('/cron-jobs', formData);
        setJobs([data, ...jobs]);
        toast.success('Cron job created');
      }
      closeForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save cron job');
    } finally {
      setSubmitting(false);
    }
  };

  const openForm = (job = null) => {
    if (job) {
      setEditingJob(job);
      setFormData({
        command: job.command,
        schedule: job.schedule,
        description: job.description || '',
      });
    } else {
      setEditingJob(null);
      setFormData({ command: '', schedule: '* * * * *', description: '' });
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingJob(null);
  };

  const openLogs = async (job) => {
    setSelectedJob(job);
    setHistoryLogs([]);
    setSelectedExecution(null);
    setIsSystemView(false);
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      const { data } = await api.get(`/cron-jobs/${job.id}/logs`);
      setHistoryLogs(data);
      if (data.length > 0) setSelectedExecution(data[0]);
    } catch (err) {
      toast.error('Failed to fetch historical logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const openSystemLogs = async () => {
    setSelectedJob({ description: 'System Management Tasks' });
    setHistoryLogs([]);
    setSelectedExecution(null);
    setIsSystemView(true);
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      const { data } = await api.get('/cron-jobs/system-logs');
      setHistoryLogs(data);
      if (data.length > 0) setSelectedExecution(data[0]);
    } catch (err) {
      toast.error('Failed to fetch system logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 animate-pulse">Running</Badge>;
      case 'success': return <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 text-xs py-0 h-5">Success</Badge>;
      case 'failed': return <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20">Failed</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cron Jobs</h2>
          <p className="text-muted-foreground mt-1">Manage scheduled background tasks for your server.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openSystemLogs()} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            System Tasks
          </Button>
          <Button variant="outline" size="icon" onClick={() => { setLoading(true); fetchJobs(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => openForm()} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Cron Job
          </Button>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[525px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingJob ? 'Edit Cron Job' : 'Add New Cron Job'}</DialogTitle>
              <DialogDescription>
                Configure a command to run periodically on your server.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Description</label>
                <Input 
                  placeholder="e.g. Daily Database Backup" 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Command</label>
                <Input 
                  placeholder="php /var/www/script.php" 
                  required 
                  value={formData.command} 
                  onChange={e => setFormData({ ...formData, command: e.target.value })} 
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Schedule (Cron Expression)</label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: 'Every Min', value: '* * * * *' },
                      { label: '5 Mins', value: '*/5 * * * *' },
                      { label: 'Hourly', value: '0 * * * *' },
                      { label: 'Daily', value: '0 0 * * *' },
                      { label: 'Weekly', value: '0 0 * * 0' },
                    ].map(shortcut => (
                      <button
                        key={shortcut.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, schedule: shortcut.value })}
                        className="text-[10px] bg-secondary hover:bg-secondary/80 px-1.5 py-0.5 rounded transition-colors"
                      >
                        {shortcut.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input 
                  placeholder="* * * * *" 
                  required 
                  value={formData.schedule} 
                  onChange={e => setFormData({ ...formData, schedule: e.target.value })} 
                />
                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Format: minute hour day month day-of-week
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : (editingJob ? 'Update Job' : 'Create Job')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
          <div className="p-6 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                {isSystemView ? 'System Task History' : `Execution History: ${selectedJob?.description || 'Job'}`}
              </DialogTitle>
              <DialogDescription>
                Viewing historical records for scheduled tasks.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 flex overflow-hidden min-h-[400px]">
            {/* Sidebar with log list */}
            <div className="w-1/3 border-r overflow-auto bg-muted/20">
              {loadingLogs ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No records found.
                </div>
              ) : (
                <div className="divide-y">
                  {historyLogs.map((log) => (
                    <button
                      key={log.id}
                      onClick={() => setSelectedExecution(log)}
                      className={`w-full text-left p-3 hover:bg-muted transition-colors flex flex-col gap-1 ${selectedExecution?.id === log.id ? 'bg-muted border-l-2 border-primary' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground truncate">
                          {isSystemView ? log.command_name : `#${log.id}`}
                        </span>
                        <Badge variant={log.status === 'success' ? 'success' : 'destructive'} className="h-4 text-[9px] px-1 capitalize">
                          {log.status}
                        </Badge>
                      </div>
                      <span className="text-xs font-medium">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Duration: {log.duration}s
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content area with output */}
            <div className="flex-1 overflow-auto bg-slate-950 flex flex-col">
              {selectedExecution ? (
                <>
                  <div className="p-3 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px] bg-slate-900/50">
                    <span>{new Date(selectedExecution.started_at).toLocaleString()} — {selectedExecution.status.toUpperCase()}</span>
                    <span>{selectedExecution.duration}s</span>
                  </div>
                  <pre className="p-4 text-slate-50 font-mono text-sm whitespace-pre-wrap flex-1">
                    {selectedExecution.output || 'No output captured for this run.'}
                  </pre>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic">
                  Select a record to view details
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t bg-muted/20 flex justify-end">
            <Button variant="outline" onClick={() => setShowLogs(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No cron jobs found</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">
              You haven't created any scheduled tasks yet. Background tasks are great for backups, data cleanup, and periodic reporting.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => openForm()}>
              Create Your First Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Card key={job.id} className={`${job.is_active ? '' : 'opacity-60 bg-muted/30'} transition-all hover:shadow-md group overflow-hidden`}>
              {job.last_status === 'failed' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />}
              {job.last_status === 'success' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
              
              <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 flex gap-4">
                  <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${job.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-lg">{job.description || 'Unnamed Job'}</h3>
                      <Badge variant={job.is_active ? "success" : "secondary"} className="h-5">
                        {job.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {getStatusBadge(job.last_status)}
                    </div>
                    <code className="mt-2 block bg-muted p-2 rounded text-sm font-mono break-all border border-muted-foreground/10 group-hover:border-primary/20 transition-colors">
                      {job.command}
                    </code>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium bg-secondary/50 px-1.5 py-0.5 rounded text-[10px]">
                        <Clock className="w-3 h-3" /> {job.schedule}
                      </span>
                      {job.last_run_at && (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          Last run: {new Date(job.last_run_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 self-end md:self-center">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 hidden sm:flex mr-1" onClick={() => openLogs(job)}>
                    Logs
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggle(job)} title={job.is_active ? 'Disable' : 'Enable'}>
                    {job.is_active ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(job)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(job)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
                <Button variant="outline" size="sm" className="h-8 w-full sm:hidden mt-2" onClick={() => openLogs(job)}>
                  View Logs
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmationDialog
        open={!!jobToDelete}
        onOpenChange={(open) => !open && setJobToDelete(null)}
        title="Delete Cron Job"
        description={`Are you sure you want to delete the cron job "${jobToDelete?.description || jobToDelete?.command}"? This action cannot be undone.`}
        confirmText="Delete Job"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
