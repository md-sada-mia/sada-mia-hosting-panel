import { useAuth } from '@/lib/AuthContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Layers, Database, Clock, Settings, LogOut, Globe, Mail, FolderOpen, Network, Users } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { label: 'Dashboard',     path: '/',              icon: LayoutDashboard },
    { label: 'CRM',           path: '/crm',           icon: Users },
    { label: 'Applications',  path: '/apps',          icon: Layers },
    { label: 'Databases',     path: '/databases',     icon: Database },
    { label: 'DNS & Domains', path: '/domains',       icon: Globe },
    { label: 'Load Balancers',path: '/load-balancers',icon: Network },
    { label: 'Email',         path: '/email',         icon: Mail },
    { label: 'Cron Jobs',     path: '/cron-jobs',     icon: Clock },
    { label: 'File Manager',  path: '/files',         icon: FolderOpen },
    { label: 'Settings',      path: '/settings',      icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <span className="font-bold text-lg tracking-tight">Sada Mia Panel</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            
            if (item.external) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            }

            const isActive = location.pathname === item.path || 
                             (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground font-medium' 
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t mt-auto">
          <div className="mb-4 px-2">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{user.email}</p>
          </div>
          <button 
            onClick={logout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
