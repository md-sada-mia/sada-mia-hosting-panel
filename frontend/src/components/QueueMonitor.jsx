import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCcw, Trash2, PlayCircle, Clock, AlertCircle, CheckCircle2, ExternalLink, Box } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function QueueMonitor({ isDashboard = false }) {
    const [jobs, setJobs] = useState({ pending: [], failed: [] });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchJobs = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const { data } = await api.get('/queue');
            setJobs(data);
        } catch (err) {
            console.error('Failed to fetch queue jobs', err);
            if (!silent) toast.error('Failed to load queue status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(() => fetchJobs(true), 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRetry = async (id) => {
        setActionLoading(`retry-${id}`);
        try {
            await api.post(`/queue/retry/${id}`);
            toast.success('Job marked for retry');
            fetchJobs(true);
        } catch (err) {
            toast.error('Failed to retry job');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async (id) => {
        setActionLoading(`cancel-${id}`);
        try {
            await api.delete(`/queue/cancel/${id}`);
            toast.success('Job cancelled');
            fetchJobs(true);
        } catch (err) {
            toast.error('Failed to cancel job');
        } finally {
            setActionLoading(null);
        }
    };

    const handleClear = async () => {
        setActionLoading('clear');
        try {
            await api.post('/queue/clear');
            toast.success('Failed jobs cleared');
            fetchJobs(true);
        } catch (err) {
            toast.error('Failed to clear jobs');
        } finally {
            setActionLoading(null);
        }
    };

    const displayFailed = isDashboard ? jobs.failed.slice(0, 2) : jobs.failed;
    const hasMoreFailed = isDashboard && jobs.failed.length > 2;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Queue Activity
                    </h3>
                    {isDashboard && (
                        <Link to="/queue" className="text-xs text-primary hover:underline flex items-center gap-1">
                            View All <ExternalLink className="h-3 w-3" />
                        </Link>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => fetchJobs()} disabled={loading} className="h-8 px-2">
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    {!isDashboard && jobs.failed.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={actionLoading === 'clear'} className="h-8 px-2 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear Failed
                        </Button>
                    )}
                </div>
            </div>

            <div className={`grid gap-4 ${isDashboard ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Pending Jobs */}
                <Card className="border-primary/10 bg-primary/5 shadow-none">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b border-primary/10">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                            Pending ({jobs.pending.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {jobs.pending.length === 0 ? (
                            <div className="py-10 flex flex-col items-center justify-center text-muted-foreground/60">
                                <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-xs">Queue is empty</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-primary/5 max-h-[400px] overflow-y-auto">
                                {jobs.pending.map((job) => (
                                    <div key={job.id} className="p-4 flex flex-col group bg-background/40 hover:bg-background/80 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-semibold truncate">{job.payload?.displayName || 'Unknown Job'}</span>
                                                    {job.is_reserved && (
                                                        <span className="animate-pulse text-[10px] font-bold text-blue-500 uppercase px-1.5 py-0.5 bg-blue-500/10 rounded">
                                                            Processing
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-tight">
                                                    <span>#{job.id}</span>
                                                    <span>•</span>
                                                    <span>Queue: {job.queue}</span>
                                                    <span>•</span>
                                                    <span>{job.created_at}</span>
                                                </div>
                                            </div>
                                            {!isDashboard && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleCancel(job.id)}
                                                    disabled={actionLoading === `cancel-${job.id}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        
                                        {!isDashboard && job.payload?.data && (
                                            <div className="mt-2 text-[10px] bg-muted/30 p-2 rounded border border-primary/5">
                                                <div className="font-semibold mb-1 flex items-center gap-1 opacity-50"><Box className="h-3 w-3" /> Payload Data:</div>
                                                <pre className="whitespace-pre-wrap break-all opacity-80">
                                                    {JSON.stringify(job.payload.data, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Failed Jobs */}
                <Card className="border-destructive/10 bg-destructive/5 shadow-none">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b border-destructive/10">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            Failed ({jobs.failed.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {jobs.failed.length === 0 ? (
                            <div className="py-10 flex flex-col items-center justify-center text-muted-foreground/60">
                                <Activity className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-xs">No failed jobs</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-destructive/5 max-h-[600px] overflow-y-auto">
                                {displayFailed.map((job) => (
                                    <div key={job.id} className="p-4 bg-background/40 hover:bg-background/80 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="min-w-0 flex-1">
                                                <span className="text-sm font-semibold truncate text-destructive">
                                                    {job.payload?.displayName || 'Unknown Job'}
                                                </span>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tabular-nums mt-0.5">
                                                    <span>#{job.id}</span>
                                                    <span>•</span>
                                                    <span>{job.failed_at}</span>
                                                </div>
                                            </div>
                                            {!isDashboard && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 px-3 text-xs" 
                                                    onClick={() => handleRetry(job.id)}
                                                    disabled={actionLoading === `retry-${job.id}`}
                                                >
                                                    <PlayCircle className="h-4 w-4 mr-2" />
                                                    Retry Job
                                                </Button>
                                            )}
                                        </div>
                                        
                                        <div className={`text-[11px] font-mono text-muted-foreground mb-3 p-3 bg-muted/40 rounded border border-destructive/5 overflow-x-auto whitespace-pre-wrap break-all ${isDashboard ? 'line-clamp-2' : ''}`}>
                                            {job.exception}
                                        </div>

                                        {!isDashboard && job.payload?.data && (
                                            <div className="text-[10px] bg-muted/20 p-2 rounded border border-destructive/5">
                                                <div className="font-semibold mb-1 flex items-center gap-1 opacity-50"><Box className="h-3 w-3" /> Failed Payload:</div>
                                                <pre className="whitespace-pre-wrap break-all opacity-80">
                                                    {JSON.stringify(job.payload.data, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {hasMoreFailed && (
                                    <Link to="/queue" className="block p-3 text-center text-xs text-muted-foreground hover:bg-background/20 transition-colors border-t border-destructive/5">
                                        Show all {jobs.failed.length} failed jobs...
                                    </Link>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
