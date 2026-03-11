import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Server, Github, ExternalLink } from 'lucide-react';

export default function AppsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchApps = async () => {
    try {
      const { data } = await api.get('/apps');
      setApps(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
    const interval = setInterval(fetchApps, 15000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running': return <Badge variant="success">Running</Badge>;
      case 'deploying': return <Badge variant="warning" className="animate-pulse">Deploying</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      case 'stopped': return <Badge variant="secondary">Stopped</Badge>;
      default: return <Badge variant="outline">Idle</Badge>;
    }
  };

  if (loading && apps.length === 0) {
    return <div className="flex h-64 items-center justify-center">Loading applications...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Applications</h2>
          <p className="text-muted-foreground mt-1">Manage your deployed applications</p>
        </div>
        <Button asChild>
          <Link to="/apps/create">
            <Plus className="mr-2 h-4 w-4" />
            New App
          </Link>
        </Button>
      </div>

      {apps.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-dashed">
          <Server className="h-12 w-12 mb-4 opacity-20" />
          <p>No applications deployed yet.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/apps/create">Create your first app</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link key={app.id} to={`/apps/${app.id}`} className="block transition-transform hover:-translate-y-1">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg line-clamp-1">{app.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground gap-2">
                        <span className="capitalize">{app.type}</span>
                        <span>•</span>
                        <a 
                          href={`http://${app.domain}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center hover:text-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {app.domain}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    {getStatusBadge(app.status)}
                    <span className="flex items-center text-muted-foreground text-xs" title={app.git_url}>
                      <Github className="mr-1 h-3 w-3" />
                      {app.branch}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
