import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Building2,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Info,
  Volume2,
  ChevronRight,
  Inbox,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getRoleCode, getDashboardRoute } from '@/components/auth/ProtectedRoute';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  type AppNotification,
} from '@/api/notification.api';
import { playNotificationSound } from '@/lib/notificationSound';
import { useLiveSync } from '@/hooks/useLiveSync';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const roleCode = getRoleCode(user);
  const dashboardRoute = getDashboardRoute(roleCode, user);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsRefreshing] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedType, setSelectedType] = useState<string>('All');

  // Confirmation dialogs
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadNotifications = useCallback(
    async (isManual = false) => {
      try {
        if (isManual) setIsRefreshing(true);
        const isReadParam = activeTab === 'all' ? undefined : activeTab === 'read';
        const data = await fetchNotifications({
          isRead: isReadParam,
          type: selectedType === 'All' ? undefined : selectedType,
          page: 1,
          limit: 50,
        });

        setNotifications(data.notifications);
        setTotal(data.total);
        setUnreadCount(data.unreadCount);
        if (isManual) {
          toast.success('Notifications refreshed.');
        }
      } catch (err: unknown) {
        if (isManual) {
          const msg = err instanceof Error ? err.message : 'Failed to load notifications.';
          toast.error(msg);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab, selectedType],
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Live real-time notification sync without ghost reload
  useLiveSync(() => {
    void loadNotifications(false);
  }, {
    events: ['new_notification', 'admin_notification'],
  });

  // Real-time socket listener
  useEffect(() => {
    if (!user?._id) return;

    const socket = getSocket();

    const joinRooms = () => {
      if (user?._id) {
        socket.emit('join_user', user._id);
        socket.emit('join_owner', user._id);
        const role = getRoleCode(user);
        if (role === 'ADMIN') {
          socket.emit('join_admin');
        }
      }
    };

    joinRooms();
    socket.on('connect', joinRooms);

    const handleNewNotification = () => {
      // Reload notifications list quietly; Header handles global chime and toast deduplication
      void loadNotifications();
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('admin_notification', handleNewNotification);

    const onFocus = () => {
      void loadNotifications();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      socket.off('connect', joinRooms);
      socket.off('new_notification', handleNewNotification);
      socket.off('admin_notification', handleNewNotification);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, navigate, loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      toast.success('Marked as read.');
    } catch {
      toast.error('Failed to mark as read.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Failed to mark all as read.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success('Notification removed.');
    } catch {
      toast.error('Failed to delete notification.');
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllNotifications();
      setNotifications([]);
      setTotal(0);
      setUnreadCount(0);
      setClearDialogOpen(false);
      toast.success('All notifications cleared.');
    } catch {
      toast.error('Failed to clear notifications.');
    } finally {
      setIsClearing(false);
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === 'Critical') return <AlertTriangle className="h-5 w-5 text-destructive" />;
    switch (type) {
      case 'Parking Facility':
        return <Building2 className="h-5 w-5 text-primary" />;
      case 'Parking Owner Registration':
        return <FileText className="h-5 w-5 text-indigo-500" />;
      case 'System':
        return <ShieldCheck className="h-5 w-5 text-blue-500" />;
      case 'Booking':
        return <Building2 className="h-5 w-5 text-emerald-500" />;
      default:
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'Parking Facility':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-sky-500/10 text-sky-600 border-sky-500/30">
            Parking Facility
          </Badge>
        );
      case 'Parking Owner Registration':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 border-indigo-500/30">
            Registration
          </Badge>
        );
      case 'Account':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            Account
          </Badge>
        );
      case 'System':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 border-amber-500/30">
            System
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-medium border-border/80">
            {type}
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return <Badge variant="destructive" className="text-[10px] uppercase font-bold">Critical</Badge>;
      case 'High':
        return <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px] font-semibold">High Priority</Badge>;
      case 'Low':
        return <Badge variant="outline" className="border-slate-500/30 text-slate-500 text-[10px]">Low</Badge>;
      default:
        return null;
    }
  };

  // Resolve deep-link URL for notifications (including booking metadata)
  const resolveTargetUrl = (item: AppNotification): string | null => {
    if (item.actionUrl) return item.actionUrl;
    const bId =
      item.bookingId ||
      (item.metadata?.bookingId as string | undefined) ||
      (item.metadata?.booking_id as string | undefined);
    if (bId) {
      if (roleCode === 'CUSTOMER') {
        return `/customer/booking/${bId}`;
      }
      if (roleCode === 'OWNER' || roleCode === 'PARKING_OWNER') {
        return `/owner/bookings/${bId}`;
      }
      if (roleCode === 'SECURITY') {
        return `/security/dashboard`;
      }
      if (roleCode === 'ADMIN') {
        return `/admin/operations`;
      }
    }
    return null;
  };

  // Chronological Grouping into Today, Yesterday, and Earlier
  const { todayGroup, yesterdayGroup, earlierGroup } = useMemo(() => {
    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const earlier: AppNotification[] = [];

    for (const item of notifications) {
      const d = parseISO(item.createdAt);
      if (isToday(d)) {
        today.push(item);
      } else if (isYesterday(d)) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    }

    return {
      todayGroup: today,
      yesterdayGroup: yesterday,
      earlierGroup: earlier,
    };
  }, [notifications]);

  const renderNotificationCard = (item: AppNotification) => {
    const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
    const exactDate = format(new Date(item.createdAt), 'PPP p');
    const targetUrl = resolveTargetUrl(item);

    return (
      <Card
        key={item._id}
        onClick={() => {
          if (targetUrl) {
            if (!item.isRead) void handleMarkAsRead(item._id);
            navigate(targetUrl);
          }
        }}
        className={`transition-all border ${
          targetUrl ? 'cursor-pointer hover:border-primary/60 hover:shadow-xs' : ''
        } ${
          !item.isRead
            ? 'border-primary/40 bg-primary/5 shadow-xs'
            : 'border-border/60 bg-card hover:border-border'
        }`}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            {/* Left Icon */}
            <div className="mt-0.5 shrink-0 rounded-lg p-2.5 bg-background border border-border/60 shadow-2xs">
              {getNotificationIcon(item.notificationType, item.priority)}
            </div>

            {/* Middle Content */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">
                  {item.title}
                </span>
                {!item.isRead && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" title="Unread notification" />
                )}
                {getCategoryBadge(item.notificationType)}
                {getPriorityBadge(item.priority)}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.message}
              </p>

              <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground/80 flex-wrap">
                <span title={exactDate}>{timeAgo}</span>
                <span>&bull;</span>
                <span className="font-mono text-[10px]">{item.notificationReference}</span>
                {targetUrl && (
                  <>
                    <span>&bull;</span>
                    <span className="text-primary font-medium flex items-center gap-0.5">
                      View Details &rarr;
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right Controls */}
            <div
              className="flex items-center gap-1.5 shrink-0 pt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Audio chime test on each card */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                onClick={() => {
                  playNotificationSound();
                  toast('🔔 Playing notification bell chime');
                }}
                title="Test notification sound chime"
              >
                <Volume2 className="h-4 w-4" />
              </Button>

              {targetUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs font-medium gap-1 px-3"
                  onClick={() => {
                    if (!item.isRead) void handleMarkAsRead(item._id);
                    navigate(targetUrl);
                  }}
                >
                  View
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}

              {!item.isRead && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => void handleMarkAsRead(item._id)}
                  title="Mark as read"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => void handleDelete(item._id)}
                title="Delete notification"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Link to={dashboardRoute}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </Button>
        <span className="text-muted-foreground/40">&bull;</span>
        <span className="text-xs text-muted-foreground font-medium">Notification Center</span>
      </div>

          {/* 1. HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs font-semibold gap-1.5">
                  <Bell className="h-3 w-3" />
                  Live Notification Center
                </Badge>
                {unreadCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                    {unreadCount} Unread
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Notifications &amp; Activity
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
                Stay updated with real-time system alerts, facility review timelines, approvals, and operational changes.
              </p>
            </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs gap-1.5 font-medium cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Mark All Read
            </Button>
          )}

          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
              className="text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* 2. FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs: All / Unread / Read */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'all' | 'unread' | 'read')}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="all" className="text-xs font-medium">
              All ({total})
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs font-medium gap-1.5">
              Unread
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary text-primary-foreground font-mono">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="read" className="text-xs font-medium">
              Read
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
          {['All', 'Parking Facility', 'Parking Owner Registration', 'Account', 'System'].map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType(type)}
              className="text-xs h-7 px-2.5 rounded-full shrink-0"
            >
              {type === 'All' ? 'All Types' : type}
            </Button>
          ))}
        </div>
      </div>

      {/* 3. NOTIFICATION LIST */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3 rounded-xl border border-border/60 bg-card">
          <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <Card className="border-border/60 bg-card text-center p-12">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground">
              No notifications to display
            </CardTitle>
            <CardDescription className="text-xs max-w-sm">
              {activeTab === 'unread'
                ? "You're all caught up! There are no unread notifications right now."
                : 'Any updates regarding your facility proposals, review statuses, or platform activity will appear here.'}
            </CardDescription>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* TODAY SECTION */}
          {todayGroup.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Today
                </span>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-semibold">
                  {todayGroup.length}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="space-y-3">
                {todayGroup.map((item) => renderNotificationCard(item))}
              </div>
            </div>
          )}

          {/* YESTERDAY SECTION */}
          {yesterdayGroup.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Yesterday
                </span>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground font-semibold">
                  {yesterdayGroup.length}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="space-y-3">
                {yesterdayGroup.map((item) => renderNotificationCard(item))}
              </div>
            </div>
          )}

          {/* EARLIER SECTION */}
          {earlierGroup.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Earlier
                </span>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground font-semibold">
                  {earlierGroup.length}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="space-y-3">
                {earlierGroup.map((item) => renderNotificationCard(item))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLEAR ALL CONFIRMATION DIALOG */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Clear All Notifications
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-2">
              Are you sure you want to delete all notifications? This action cannot be undone and will remove all in-app alerts from your history.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setClearDialogOpen(false)}
              disabled={isClearing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
              disabled={isClearing}
              className="text-xs font-semibold"
            >
              {isClearing ? 'Clearing...' : 'Yes, Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationsPage;
