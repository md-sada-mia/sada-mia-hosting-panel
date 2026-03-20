import QueueMonitor from '@/components/QueueMonitor';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function QueueMonitorPage() {
    const navigate = useNavigate();

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-2 mb-2">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-8 w-8 hover:bg-transparent" 
                    onClick={() => navigate('/')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Queue Monitor</h2>
                    <p className="text-muted-foreground">
                        Detailed overview of background jobs and system tasks.
                    </p>
                </div>
            </div>

            <QueueMonitor isDashboard={false} />
        </div>
    );
}
