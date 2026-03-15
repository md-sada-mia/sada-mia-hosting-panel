import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Info, AlertTriangle, Shield, Rocket, Globe, Database, Terminal, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function GuidelinePage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const appId = id || searchParams.get('appId');
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [app, setApp] = useState(null);

    useEffect(() => {
        if (appId) {
            const fetchApp = async () => {
                try {
                    const { data } = await api.get(`/apps/${appId}`);
                    setApp(data);
                } catch (err) {
                    console.error('Failed to fetch app details', err);
                }
            };
            fetchApp();
        }
    }, [appId]);

    const handleHideGuideline = async () => {
        setLoading(true);
        try {
            await api.post(`/apps/${appId}/hide-guidelines`);
            toast.success("Guidelines acknowledged for this app.");
            navigate(`/apps/${appId}`);
        } catch (err) {
            toast.error("Failed to update preference.");
        } finally {
            setLoading(false);
        }
    };

    const normalizeDomain = (domain) => domain ? domain.replace(/\.$/, '').toLowerCase() : '';
    const isDefaultNsDomain = !!app?.domain && !!app?.settings?.ns_default_domain && 
                             normalizeDomain(app.domain) === normalizeDomain(app.settings.ns_default_domain);
    const nameservers = [
        app?.settings?.dns_default_ns1,
        app?.settings?.dns_default_ns2,
        app?.settings?.dns_default_ns3,
        app?.settings?.dns_default_ns4
    ].filter(Boolean);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Documentation & Guidelines</h2>
                    <p className="text-muted-foreground mt-1">
                        Best practices for managing your applications on Sada Mia Panel.
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Advanced DNS Setup (Conditional) */}
                {isDefaultNsDomain && (
                    <Card className="border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-500/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-400">
                                <Globe className="h-5 w-5" /> Own Name Server Setup
                            </CardTitle>
                            <CardDescription className="text-blue-400/70">
                                This domain is configured as your panel's default nameserver provider.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-blue-400" /> Required Child Nameservers
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Go to your domain registrar (e.g., Namecheap, Cloudflare) and add these "Child Nameservers" or "Glue Records":
                                    </p>
                                    <div className="bg-background/50 p-3 rounded-md border border-blue-500/20 font-mono text-xs space-y-1">
                                        {nameservers.map((ns, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span>{ns}</span>
                                                <span className="text-blue-400">{app?.settings?.server_ip}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Info className="h-4 w-4 text-blue-400" /> DNS Propagation Tips
                                    </h4>
                                    <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                                        <li>Child nameservers take longer to propagate than standard records.</li>
                                        <li>Verify your current Server IP: <Badge variant="outline" className="text-blue-400 border-blue-400/30">{app?.settings?.server_ip}</Badge></li>
                                        <li>Ensure port 53 (UDP/TCP) is open on your firewall.</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Core Guidelines */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" /> Core Operational Security
                        </CardTitle>
                        <CardDescription>Fundamental rules for maintaining a stable environment.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="p-4 rounded-lg bg-card border">
                                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-blue-400" /> DNS Management
                                </h4>
                                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                                    <li>Point your domain's NS records before deploying.</li>
                                    <li>Wait for propagation (up to 24h) for SSL to work.</li>
                                    <li>Use the DNS Sync button after adding complex records.</li>
                                </ul>
                            </div>
                            <div className="p-4 rounded-lg bg-card border">
                                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <Rocket className="h-4 w-4 text-orange-400" /> Deployment
                                </h4>
                                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                                    <li>Ensure your repository has a valid entry point.</li>
                                    <li>Always review error logs if a deployment fails.</li>
                                    <li>Auto-deploy triggers on every push to the selected branch.</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* UI/UX Principles */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-blue-400" /> Interface Navigation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex gap-4 items-start">
                            <div className="p-2 bg-blue-500/10 rounded-full shrink-0">
                                <Terminal className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Terminal Usage</p>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    The integrated terminal runs in a restricted shell for security. Use it for basic file operations, git commands, and process monitoring. Avoid high-resource operations.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="p-2 bg-emerald-500/10 rounded-full shrink-0">
                                <Database className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Database Management</p>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    Use the Adminer shortcut for quick edits. Remember to keep your environment variables in sync with your database credentials.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Warnings Section */}
                <div className="p-6 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-4">
                    <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
                    <div>
                        <h4 className="font-bold text-amber-500">Critical Warnings</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                            Deleting an app will permanently remove its files, DNS records, and Nginx configurations. Databases must be deleted separately for safety data retention.
                        </p>
                    </div>
                </div>
            </div>

            {appId && (
                <div className="pt-8 border-t flex flex-col items-center gap-4">
                    <div className="text-center">
                        <p className="text-sm font-medium">Have you read and understood these guidelines for <span className="text-primary">{app?.name || 'this app'}</span>?</p>
                        <p className="text-xs text-muted-foreground mt-1">Once acknowledged, these highlights will not be shown on the app overview anymore.</p>
                    </div>
                    <Button 
                        size="lg" 
                        onClick={handleHideGuideline} 
                        disabled={loading}
                        className="gap-2 px-8"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        I understand, don't show again
                    </Button>
                </div>
            )}
        </div>
    );
}
