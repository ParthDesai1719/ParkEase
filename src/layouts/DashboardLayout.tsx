import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  ShieldCheck,
  Users,
  Layers,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  CalendarCheck,
  User as UserIcon,
  QrCode,
  UserPlus,
  FileText,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { getRoleCode } from '@/components/auth/ProtectedRoute';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number | undefined;
  exact?: boolean;
}

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const roleCode = getRoleCode(user);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isCustomer = roleCode === 'CUSTOMER';
  const isOwner = roleCode === 'OWNER' || roleCode === 'PARKING_OWNER';
  const isAdmin = roleCode === 'ADMIN';
  const isSecurity = roleCode === 'SECURITY_STAFF' || roleCode === 'SECURITY';
  const isLayoutDesigner = location.pathname.includes('/layout');

  // Navigation Items by Role (Notifications kept exclusively in Header)
  const customerNavItems: NavItem[] = [
    {
      label: 'Dashboard Overview',
      href: '/customer/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Search Parking',
      href: '/customer/search',
      icon: Search,
      exact: true,
    },
    {
      label: 'My Bookings',
      href: '/customer/bookings',
      icon: CalendarCheck,
    },
    {
      label: 'Profile & Vehicles',
      href: '/customer/profile',
      icon: UserIcon,
      exact: true,
    },
  ];

  const ownerNavItems: NavItem[] = [
    {
      label: 'Dashboard Overview',
      href: '/owner/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Parking Lots',
      href: '/owner/parking-lots',
      icon: Building2,
    },
    {
      label: 'Slot Management',
      href: '/owner/slots',
      icon: Grid3X3,
    },
    {
      label: 'Booking Management',
      href: '/owner/bookings',
      icon: CalendarCheck,
    },
    {
      label: 'Staff Management',
      href: '/owner/staff',
      icon: Users,
    },
    {
      label: 'Submit New Facility',
      href: '/owner/parking/submissions/new',
      icon: PlusCircle,
    },
    {
      label: 'Business Profile & Proofs',
      href: '/owner/profile',
      icon: ShieldCheck,
      badge: 'Verified',
    },
  ];

  const adminNavItems: NavItem[] = [
    {
      label: 'Governance Overview',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Owner Applications',
      href: '/admin/owners',
      icon: Users,
    },
    {
      label: 'Facility Submissions',
      href: '/admin/facilities',
      icon: Building2,
    },
    {
      label: 'Official Parking Lots',
      href: '/admin/parking-lots',
      icon: Layers,
    },
    {
      label: 'Admin Profile',
      href: '/admin/profile',
      icon: UserIcon,
      exact: true,
    },
  ];

  const securityNavItems: NavItem[] = [
    {
      label: 'Security Dashboard',
      href: '/security/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'QR Scanner',
      href: '/security/scan',
      icon: QrCode,
      exact: true,
    },
    {
      label: 'Manual Vehicle Lookup',
      href: '/security/manual-lookup',
      icon: Search,
      exact: true,
    },
    {
      label: 'Walk-in Booking',
      href: '/security/walk-in',
      icon: UserPlus,
      exact: true,
    },
    {
      label: 'Vehicle Movement Logs',
      href: '/security/movement-logs',
      icon: FileText,
      exact: true,
    },
    {
      label: 'Incident Reports',
      href: '/security/incidents',
      icon: AlertTriangle,
      exact: true,
    },
    {
      label: 'Notifications',
      href: '/security/notifications',
      icon: Bell,
      exact: true,
    },
    {
      label: 'Staff Profile & Post',
      href: '/security/profile',
      icon: UserIcon,
      exact: true,
    },
  ];

  const navItems = isCustomer
    ? customerNavItems
    : isOwner
    ? ownerNavItems
    : isAdmin
    ? adminNavItems
    : isSecurity
    ? securityNavItems
    : [];
  const hasSidebar = navItems.length > 0;

  const isLinkActive = (item: NavItem) => {
    if (item.exact) {
      return location.pathname === item.href;
    }
    return location.pathname.startsWith(item.href);
  };

  return (
    <div className={cn("min-h-screen bg-background flex flex-col text-foreground", isLayoutDesigner && "h-screen overflow-hidden")}>
      {/* 1. GLOBAL TOP AUTHENTICATED HEADER (Houses Notification Center & Profile) */}
      <Header variant="authenticated" />

      <div className={cn("flex-1 flex overflow-hidden", isLayoutDesigner && "h-[calc(100vh-4rem)]")}>
        {/* 2. SIDEBAR NAVIGATION (For Owner & Admin) */}
        {hasSidebar && (
          <>
            {/* Mobile Drawer Backdrop */}
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}

            {/* Sidebar Container */}
            <aside
              className={cn(
                'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border/70 bg-card/95 backdrop-blur-md pt-16 transition-all duration-300 lg:static lg:pt-0 lg:z-auto shadow-xs',
                isCollapsed ? 'lg:w-16' : 'lg:w-64',
                mobileSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0',
              )}
            >
              {/* Sidebar Header / Section Badge */}
              <div
                className={cn(
                  'border-b border-border/60 flex items-center transition-all',
                  isCollapsed ? 'p-2 justify-center' : 'p-4 justify-between',
                )}
              >
                {!isCollapsed && (
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {isCustomer
                        ? 'Customer Portal'
                        : isOwner
                        ? 'Parking Owner Portal'
                        : isSecurity
                        ? 'Security Staff Portal'
                        : 'Administration Portal'}
                    </span>
                    <p className="text-xs font-semibold text-foreground truncate max-w-[170px]">
                      {user?.fullName || 'Control Hub'}
                    </p>
                  </div>
                )}

                {/* Desktop Collapse / Expand Toggle Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'hidden lg:flex text-muted-foreground hover:text-foreground cursor-pointer transition-colors',
                    isCollapsed ? 'h-10 w-10 rounded-xl hover:bg-muted/80' : 'h-7 w-7',
                  )}
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>

                {/* Mobile Close Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation Links */}
              <nav className={cn('flex-1 overflow-y-auto space-y-1.5', isCollapsed ? 'p-2' : 'p-3')}>
                {navItems.map((item) => {
                  const active = isLinkActive(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={cn(
                        'transition-all duration-200 group relative',
                        isCollapsed
                          ? cn(
                              'h-11 w-11 mx-auto rounded-xl flex items-center justify-center',
                              active
                                ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/25'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
                            )
                          : cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium',
                              active
                                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                            ),
                      )}
                      title={item.label}
                    >
                      <Icon
                        className={cn(
                          'shrink-0 transition-transform duration-200 group-hover:scale-105',
                          isCollapsed ? 'h-5 w-5' : 'h-4 w-4',
                          active
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      />

                      {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}

                      {!isCollapsed && item.badge !== undefined && (
                        <Badge
                          variant={active ? 'secondary' : 'default'}
                          className={cn(
                            'text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center font-mono font-bold',
                            active
                              ? 'bg-primary-foreground text-primary'
                              : 'bg-primary text-primary-foreground',
                          )}
                        >
                          {item.badge}
                        </Badge>
                      )}

                      {/* Clean indicator dot in collapsed mode */}
                      {isCollapsed && item.badge !== undefined && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Sidebar Footer */}
              {!isCollapsed ? (
                <div className="p-3 border-t border-border/60 bg-muted/20">
                  <div className="p-2.5 rounded-lg bg-card border border-border/60 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Account Status:</span>
                      <span className="font-semibold text-emerald-600">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Role:</span>
                      <span className="font-mono text-muted-foreground">{roleCode || 'USER'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t border-border/60 flex items-center justify-center">
                  <div
                    className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"
                    title="Account Active"
                  />
                </div>
              )}
            </aside>
          </>
        )}

        {/* 3. MAIN CONTENT VIEW */}
        <div className={cn("flex-1 flex flex-col min-w-0", isLayoutDesigner ? "overflow-hidden h-full" : "overflow-y-auto")}>
          {/* Mobile Sidebar Trigger Bar (Only if hasSidebar) */}
          {hasSidebar && (
            <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-card/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                className="gap-2 text-xs"
              >
                <Menu className="h-4 w-4" />
                {isCustomer ? 'Customer Menu' : isOwner ? 'Owner Menu' : 'Admin Menu'}
              </Button>
              <span className="text-xs text-muted-foreground font-medium">
                {isCustomer
                  ? 'Smart Parking Portal'
                  : isOwner
                  ? 'Parking Owner Control'
                  : 'Admin Governance'}
              </span>
            </div>
          )}

          <main className={cn("flex-1 w-full", isLayoutDesigner ? "pb-0 h-full overflow-hidden" : "pb-16")}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;

