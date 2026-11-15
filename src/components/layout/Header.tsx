import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, User as UserIcon, FileText, Volume2, CalendarCheck, LayoutDashboard } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { getDashboardRoute, getRoleCode } from '@/components/auth/ProtectedRoute';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type AppNotification,
} from '@/api/notification.api';
import { playNotificationSound } from '@/lib/notificationSound';
import { getSocket } from '@/lib/socket';
import { getAvatarUrl } from '@/api/profile.api';

export interface HeaderProps {
  variant?: 'public' | 'auth' | 'authenticated' | 'auto';
  className?: string;
}

const publicNavItems = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Search Parking', href: '/customer/search' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact', href: '/contact' },
];

export const Header: React.FC<HeaderProps> = ({ variant = 'auto', className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const roleCode = getRoleCode(user);
  const dashboardRoute = getDashboardRoute(roleCode, user);

  // Determine active variant
  let activeVariant = variant;
  if (activeVariant === 'auto') {
    if (['/login', '/register'].includes(location.pathname)) {
      activeVariant = 'auth';
    } else if (isAuthenticated) {
      activeVariant = 'authenticated';
    } else {
      activeVariant = 'public';
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  // Notifications State & Real-Time Sync
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [recentNotifications, setRecentNotifications] = React.useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [isBellRinging, setIsBellRinging] = React.useState(false);
  const recentNotifIdsRef = React.useRef<Set<string>>(new Set());
  const ringTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBellRing = React.useCallback(() => {
    setIsBellRinging(false);
    requestAnimationFrame(() => {
      setIsBellRinging(true);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        setIsBellRinging(false);
      }, 1200);
    });
  }, []);

  const fetchNotifSummary = React.useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await fetchNotifications({ limit: 5 });
      setRecentNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent fallback
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    fetchNotifications({ limit: 5 })
      .then((data) => {
        if (isMounted) {
          setRecentNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {
        // silent fallback
      });

    const socket = getSocket();

    const joinRooms = () => {
      if (user?._id) {
        socket.emit('join_user', user._id);
        socket.emit('join_owner', user._id);
        if (roleCode === 'ADMIN') socket.emit('join_admin');
      }
    };

    joinRooms();
    socket.on('connect', joinRooms);

    const handleNewNotif = (notif: AppNotification) => {
      // Content-based and ID-based robust deduplication within a 6-second window
      const contentKey = `${(notif.title || '').trim()}::${(notif.message || '').trim()}`;
      const idKey = notif._id ? String(notif._id) : notif.notificationReference ? String(notif.notificationReference) : null;

      if (
        (idKey && recentNotifIdsRef.current.has(idKey)) ||
        recentNotifIdsRef.current.has(contentKey)
      ) {
        return;
      }

      if (idKey) recentNotifIdsRef.current.add(idKey);
      recentNotifIdsRef.current.add(contentKey);

      setTimeout(() => {
        if (idKey) recentNotifIdsRef.current.delete(idKey);
        recentNotifIdsRef.current.delete(contentKey);
      }, 6000);

      // Instantaneous audio bell chime & visual bell ring animation
      playNotificationSound();
      triggerBellRing();

      toast.info(notif.title || 'New Notification', {
        id: `notif-${contentKey}`,
        description: notif.message,
        action: notif.actionUrl
          ? {
              label: 'View',
              onClick: () => navigate(notif.actionUrl!),
            }
          : undefined,
      });
      void fetchNotifSummary();
    };

    socket.on('new_notification', handleNewNotif);
    socket.on('admin_notification', handleNewNotif);

    const onFocus = () => void fetchNotifSummary();
    window.addEventListener('focus', onFocus);

    return () => {
      isMounted = false;
      socket.off('connect', joinRooms);
      socket.off('new_notification', handleNewNotif);
      socket.off('admin_notification', handleNewNotif);
      window.removeEventListener('focus', onFocus);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    };
  }, [isAuthenticated, user?._id, roleCode, fetchNotifSummary, navigate, triggerBellRing]);

  // 1. Auth Header: Minimalist, clean, distraction-free
  if (activeVariant === 'auth') {
    return (
      <header
        data-slot="auth-header"
        className={cn(
          'flex w-full items-center justify-between border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur-md',
          className,
        )}
      >
        <Link to="/" className="flex items-center transition-opacity hover:opacity-90">
          <img
            src="/brand/logo-light.png"
            alt="ParkEase - Smart Parking Platform"
            className="h-8 w-auto object-contain sm:h-9 dark:hidden"
          />
          <img
            src="/brand/logo-dark.png"
            alt="ParkEase - Smart Parking Platform"
            className="hidden h-8 w-auto object-contain sm:h-9 dark:block"
          />
        </Link>
        <ThemeToggle />
      </header>
    );
  }

  // 2. Authenticated Header: Role-aware navigation and profile controls
  if (activeVariant === 'authenticated') {
    const initials = user?.fullName
      ? user.fullName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : 'U';

    const formatRoleName = (code?: string | null) => {
      switch (code) {
        case 'CUSTOMER':
          return 'Customer';
        case 'OWNER':
        case 'PARKING_OWNER':
          return 'Parking Owner';
        case 'SECURITY':
        case 'SECURITY_STAFF':
          return 'Security Staff';
        case 'ADMIN':
          return 'Administrator';
        default:
          return 'User';
      }
    };

    return (
      <header
        data-slot="authenticated-header"
        className={cn(
          'sticky top-0 z-40 flex w-full items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6',
          className,
        )}
      >
        <div className="flex items-center gap-6">
          <Link
            to={dashboardRoute}
            className="flex items-center transition-opacity hover:opacity-90"
          >
            <img
              src="/brand/logo-light.png"
              alt="ParkEase"
              className="h-8 w-auto object-contain sm:h-9 dark:hidden"
            />
            <img
              src="/brand/logo-dark.png"
              alt="ParkEase"
              className="hidden h-8 w-auto object-contain sm:h-9 dark:block"
            />
          </Link>

          {/* Quick Context Navigation */}
          <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
            <Link
              to={dashboardRoute}
              className={cn(
                'text-muted-foreground transition-colors hover:text-foreground',
                location.pathname === dashboardRoute && 'font-semibold text-primary',
              )}
            >
              Dashboard
            </Link>
            {roleCode === 'CUSTOMER' && (
              <>
                <Link
                  to="/customer/search"
                  className={cn(
                    'text-muted-foreground transition-colors hover:text-foreground',
                    location.pathname === '/customer/search' && 'font-semibold text-primary',
                  )}
                >
                  Search Parking
                </Link>
                <Link
                  to="/customer/bookings"
                  className={cn(
                    'text-muted-foreground transition-colors hover:text-foreground',
                    location.pathname.startsWith('/customer/booking') &&
                      'font-semibold text-primary',
                  )}
                >
                  My Bookings
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Authenticated Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {/* Notifications Dropdown */}
          <DropdownMenu open={isNotifOpen} onOpenChange={setIsNotifOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative cursor-pointer"
                aria-label="Notifications"
              >
                <Bell
                  className={cn(
                    'h-4 w-4 transition-transform',
                    isBellRinging && 'animate-bell-ring text-primary',
                  )}
                />
                {unreadCount > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground font-mono transition-transform',
                      isBellRinging
                        ? 'scale-125 ring-2 ring-primary/40 animate-pulse'
                        : 'animate-in zoom-in',
                    )}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 sm:w-96 p-0 shadow-lg rounded-xl" align="end">
              <div className="flex items-center justify-between p-3 border-b border-border/60 bg-muted/20">
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <Badge className="text-[10px] h-4 px-1.5 font-mono bg-primary">
                      {unreadCount} New
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playNotificationSound();
                      triggerBellRing();
                      toast.success('Ringing notification chime.');
                    }}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer transition-colors"
                    title="Test notification bell chime"
                  >
                    <Volume2 className="h-3 w-3" />
                    <span>Test Chime</span>
                  </button>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await markAllNotificationsAsRead();
                        setUnreadCount(0);
                        setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                        toast.success('Marked all as read.');
                      }}
                      className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
                {recentNotifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No recent notifications
                  </div>
                ) : (
                  recentNotifications.map((n) => (
                    <div
                      key={n._id}
                      className={`p-3 text-xs transition-colors hover:bg-muted/30 cursor-pointer flex items-start gap-2.5 ${
                        !n.isRead ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        setIsNotifOpen(false);
                        if (!n.isRead) void markNotificationAsRead(n._id);
                        navigate(
                          n.actionUrl ||
                            (roleCode === 'ADMIN'
                              ? '/admin/notifications'
                              : roleCode === 'OWNER' || roleCode === 'PARKING_OWNER'
                              ? '/owner/notifications'
                              : roleCode === 'CUSTOMER'
                              ? '/customer/notifications'
                              : '/notifications'),
                        );
                      }}
                    >
                      <div className="mt-0.5 shrink-0">
                        {!n.isRead ? (
                          <span className="block h-2 w-2 rounded-full bg-primary" />
                        ) : (
                          <span className="block h-2 w-2 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="font-semibold text-foreground truncate">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 pt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-border/60 bg-muted/10 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs font-semibold text-primary h-8 cursor-pointer"
                  onClick={() => {
                    setIsNotifOpen(false);
                    navigate(
                      roleCode === 'ADMIN'
                        ? '/admin/notifications'
                        : roleCode === 'OWNER' || roleCode === 'PARKING_OWNER'
                        ? '/owner/notifications'
                        : roleCode === 'CUSTOMER'
                        ? '/customer/notifications'
                        : '/notifications',
                    );
                  }}
                >
                  View all notifications &rarr;
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full p-0"
                aria-label="User profile menu"
              >
                <Avatar className="h-9 w-9 border border-border">
                  {user?.profileImage && (
                    <AvatarImage src={getAvatarUrl(user.profileImage)} alt={user.fullName || 'User'} />
                  )}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="truncate font-medium text-sm leading-none text-foreground">
                    {user?.fullName || 'ParkEase User'}
                  </p>
                  <p className="truncate text-xs leading-none text-muted-foreground">
                    {user?.email || user?.mobileNumber || ''}
                  </p>
                  <div className="pt-1">
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {formatRoleName(roleCode)}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(dashboardRoute)}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() =>
                  navigate(
                    roleCode === 'ADMIN'
                      ? '/admin/profile'
                      : roleCode === 'OWNER' || roleCode === 'PARKING_OWNER'
                      ? '/owner/profile'
                      : roleCode === 'SECURITY_STAFF' || roleCode === 'SECURITY'
                      ? '/security/profile'
                      : '/customer/profile',
                  )
                }
              >
                <UserIcon className="mr-2 h-4 w-4" />
                <span>My Profile</span>
              </DropdownMenuItem>
              {roleCode === 'CUSTOMER' && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => navigate('/customer/bookings')}
                >
                  <CalendarCheck className="mr-2 h-4 w-4" />
                  <span>My Bookings</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer flex items-center justify-between"
                onClick={() =>
                  navigate(
                    roleCode === 'ADMIN'
                      ? '/admin/notifications'
                      : roleCode === 'OWNER' || roleCode === 'PARKING_OWNER'
                      ? '/owner/notifications'
                      : roleCode === 'CUSTOMER'
                      ? '/customer/notifications'
                      : '/notifications',
                  )
                }
              >
                <div className="flex items-center">
                  <Bell className="mr-2 h-4 w-4" />
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <Badge className="text-[10px] h-4 px-1 font-mono">{unreadCount}</Badge>
                )}
              </DropdownMenuItem>
              {(roleCode === 'PARKING_OWNER' || roleCode === 'OWNER') && (
                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/owner/profile')}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Business Documents</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    );
  }

  // 3. Public Header: Comprehensive navigation, Login/Register buttons, Mobile Drawer
  return (
    <header
      data-slot="public-header"
      className={cn(
        'sticky top-0 z-40 flex w-full items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md transition-all sm:px-8',
        className,
      )}
    >
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center transition-opacity hover:opacity-90">
          <img
            src="/brand/logo-light.png"
            alt="ParkEase"
            className="h-8 w-auto object-contain sm:h-9 dark:hidden"
          />
          <img
            src="/brand/logo-dark.png"
            alt="ParkEase"
            className="hidden h-8 w-auto object-contain sm:h-9 dark:block"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-6 text-sm font-medium lg:flex">
          {publicNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'transition-colors hover:text-foreground',
                  isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Desktop Actions */}
      <div className="hidden items-center gap-3 lg:flex">
        <ThemeToggle />
        <Button variant="ghost" asChild>
          <Link to="/login">Login</Link>
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
          <Link to="/register">Register</Link>
        </Button>
      </div>

      {/* Mobile Drawer */}
      <div className="flex items-center gap-2 lg:hidden">
        <ThemeToggle />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-72 flex-col justify-between p-6">
            <div className="flex flex-col gap-6">
              <SheetHeader className="text-left">
                <SheetTitle>
                  <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center">
                    <img
                      src="/brand/logo-light.png"
                      alt="ParkEase"
                      className="h-8 w-auto object-contain dark:hidden"
                    />
                    <img
                      src="/brand/logo-dark.png"
                      alt="ParkEase"
                      className="hidden h-8 w-auto object-contain dark:block"
                    />
                  </Link>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-3">
                {publicNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent font-semibold text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex flex-col gap-2 pt-6 border-t border-border/60">
              <Button variant="outline" className="w-full" asChild>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  Login
                </Link>
              </Button>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                asChild
              >
                <Link to="/register" onClick={() => setMobileOpen(false)}>
                  Register
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
