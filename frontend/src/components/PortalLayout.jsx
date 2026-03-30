import { useState, useEffect } from 'react';
import { Outlet, useSearchParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Loader2, Globe } from 'lucide-react';

export default function PortalLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const domainParam = searchParams.get('domain');

  const [domain, setDomain] = useState(domainParam || '');
  const [portalInfo, setPortalInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync URL param if internal state changes
    if (domain && domain !== searchParams.get('domain')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('domain', domain);
      setSearchParams(newParams, { replace: true });
    }
  }, [domain, searchParams, setSearchParams]);

  useEffect(() => {
    // If no domain, we can still fetch info (it will just return plans without current status)
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const url = domain ? `/public/portal/info?domain=${domain}` : '/public/portal/info';
        const res = await api.get(url);
        setPortalInfo(res.data);
      } catch (err) {
        console.error('Failed to load portal info', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [domain]);

  if (loading && !portalInfo) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mr-3" />
        <span className="text-muted-foreground text-lg">Loading Portal...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4 md:px-8">
          <Link to={domain ? `/?domain=${domain}` : '/'} className="flex items-center gap-2">
            {portalInfo?.portal_logo ? (
              <img src={portalInfo.portal_logo} alt="Logo" className="h-6 w-auto object-contain flex-shrink-0" />
            ) : (
              <Globe className="h-6 w-6 text-primary flex-shrink-0" />
            )}
            <span className="font-bold text-lg tracking-tight">
              {portalInfo?.portal_name || 'Hosting Portal'}
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to={domain ? `/?domain=${domain}` : '/'} className="transition-colors hover:text-foreground/80 text-foreground/60">
              Home
            </Link>
            <Link to={domain ? `/packages?domain=${domain}` : '/packages'} className="transition-colors hover:text-foreground/80 text-foreground/60">
              Pricing Packages
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 md:px-8">
        <Outlet context={{ domain, setDomain, portalInfo }} />
      </main>

      {/* Footer */}
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row mx-auto px-4 md:px-8">
          <p className="text-sm text-muted-foreground leading-loose text-center md:text-left">
            Powered by {portalInfo?.portal_name || 'Sada Mia Hosting'}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
