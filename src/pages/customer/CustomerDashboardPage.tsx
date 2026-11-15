import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Calendar,
  Car,
  Clock,
  Compass,
  FileText,
  Heart,
  HeartOff,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  Bell,
  User,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BarChart3,
  History,
  BookmarkCheck,
  Navigation,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import {
  getCustomerDashboardOverview,
  toggleFacilityFavourite,
  getFacilityImageUrl,
  type CustomerBookingItem,
} from '@/api/customerParking.api';
import { markNotificationAsRead } from '@/api/notification.api';
import { BookingQrPassDialog } from '@/components/customer/booking/BookingQrPassDialog';
import { BookingConfirmationDialog } from '@/components/customer/booking/BookingConfirmationDialog';
import { buildReceiptConfirmationFromBooking } from '@/lib/bookingReceiptHelper';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

export const CustomerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [userCoords, setUserCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [selectedQrBooking, setSelectedQrBooking] = useState<CustomerBookingItem | null>(null);
  const [selectedReceiptBooking, setSelectedReceiptBooking] =
    useState<CustomerBookingItem | null>(null);

  // Request optional browser geolocation for distance calculation on favourite facilities
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        // Geolocation permission denied or unavailable; proceed without distance
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 },
    );
  }, []);

  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['customer-dashboard', user?._id, userCoords.latitude, userCoords.longitude],
    queryFn: () => getCustomerDashboardOverview(userCoords),
    enabled: Boolean(user?._id),
    staleTime: 15_000,
  });

  // Real-time reconciliation via Socket.IO (backend remains authoritative)
  useEffect(() => {
    if (!user?._id) return;
    const socket = getSocket();

    const handleRealtimeRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
    };

    socket.on('new_notification', handleRealtimeRefresh);
    socket.on('booking_updated', handleRealtimeRefresh);
    socket.on('slot_availability_updated', handleRealtimeRefresh);

    return () => {
      socket.off('new_notification', handleRealtimeRefresh);
      socket.off('booking_updated', handleRealtimeRefresh);
      socket.off('slot_availability_updated', handleRealtimeRefresh);
    };
  }, [user?._id, queryClient]);

  const removeFavouriteMutation = useMutation({
    mutationFn: (parkingLotId: string) => toggleFacilityFavourite(parkingLotId),
    onSuccess: () => {
      toast.success('Removed from favourite locations.');
      void queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-favourites'] });
    },
    onError: () => {
      toast.error('Failed to update favourite location. Please try again.');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
    },
    onError: () => {
      toast.error('Could not mark notification as read.');
    },
  });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const formatRemainingDuration = (mins: number | null) => {
    if (mins === null) return 'In progress';
    if (mins <= 0) return 'Grace period / Exiting soon';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m remaining`;
    if (h > 0) return `${h} hr${h > 1 ? 's' : ''} remaining`;
    return `${m} min remaining`;
  };

  const getTimelineBadge = (eventType: string, eventCode: string) => {
    if (eventCode === 'PAYMENT_SUCCESSFUL' || eventCode === 'BOOKING_CONFIRMED') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
          {eventType}
        </Badge>
      );
    }
    if (eventCode === 'BOOKING_COMPLETED') {
      return (
        <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[10px] font-bold">
          {eventType}
        </Badge>
      );
    }
    if (eventCode === 'OVERSTAY_DETECTED' || eventCode.includes('OVERSTAY')) {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold">
          {eventType}
        </Badge>
      );
    }
    if (
      eventCode === 'BOOKING_CANCELLED' ||
      eventCode === 'BOOKING_NO_SHOW' ||
      eventCode === 'PAYMENT_FAILED'
    ) {
      return (
        <Badge variant="destructive" className="text-[10px] font-bold">
          {eventType}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
        {eventType}
      </Badge>
    );
  };

  // 1. SKELETON LOADING STATE
  if (isLoading) {
    return (
      <div
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8"
        data-testid="customer-dashboard-loading"
      >
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-6">
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. API ERROR STATE WITH SAFE RETRY
  if (isError || !dashboard) {
    const errMsg =
      (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      (error instanceof Error ? error.message : 'Unable to load your dashboard data right now.');

    return (
      <div
        className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8"
        data-testid="customer-dashboard-error"
      >
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center space-y-4 rounded-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Could Not Load Dashboard</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">{errMsg}</p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button onClick={() => void refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry Loading
            </Button>
            <Button variant="outline" asChild>
              <Link to="/customer/search">Search Parking</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const {
    stats,
    activeBooking,
    upcomingBooking,
    recentActivity,
    activityChart,
    favouriteLocations,
    unreadNotifications,
    unreadNotificationCount,
  } = dashboard;

  const receiptConfirmation = selectedReceiptBooking
    ? buildReceiptConfirmationFromBooking(selectedReceiptBooking, user)
    : null;

  return (
    <div
      className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-7 animate-in fade-in-50 duration-300"
      data-testid="customer-dashboard-page"
    >
      {/* 1. EXECUTIVE HERO COMMAND BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-lg">
        {/* Decorative subtle grid & radial glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-orange-500/20 text-orange-300 hover:bg-orange-500/25 border border-orange-400/30 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5">
                <Sparkles className="h-3 w-3 mr-1 text-orange-400" />
                Smart Parking Command Center
              </Badge>
              {stats.activeBookingsCount > 0 ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold px-2.5 py-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                  {stats.activeBookingsCount} Live Session Active
                </Badge>
              ) : (
                <Badge className="bg-white/10 text-slate-300 border border-white/15 text-[11px] font-medium px-2.5 py-0.5">
                  Ready for Instant Reservation
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user?.fullName || 'Driver'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Manage your live parking passes, upcoming time-window reservations, verified Razorpay
              receipts, and saved parking facilities in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-1.5 text-xs bg-white/5 border-white/20 text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Sync Status
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 text-xs font-semibold bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <Link to="/customer/bookings">
                <BookmarkCheck className="h-3.5 w-3.5 text-orange-400" />
                My Bookings ({stats.totalBookingsCount})
              </Link>
            </Button>

            <Button
              size="sm"
              asChild
              className="gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-md"
            >
              <Link to="/customer/search">
                <Search className="h-3.5 w-3.5" />
                Find &amp; Book Parking
              </Link>
            </Button>
          </div>
        </div>

        {/* Integrated KPI Strip inside Hero */}
        <div className="relative mt-6 pt-6 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Active &amp; Upcoming
              </p>
              <p className="text-2xl font-extrabold text-white mt-0.5">
                {stats.activeBookingsCount + stats.upcomingBookingsCount}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                <span className="text-emerald-400 font-semibold">{stats.activeBookingsCount} live</span>
                {' • '}
                <span>{stats.upcomingBookingsCount} scheduled</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Completed Visits
              </p>
              <p className="text-2xl font-extrabold text-white mt-0.5">
                {stats.completedBookingsCount}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Total spent:{' '}
                <span className="text-orange-300 font-bold">
                  ₹{stats.totalSpentAmount.toLocaleString('en-IN')}
                </span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-300 shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Registered Vehicles
              </p>
              <p className="text-2xl font-extrabold text-white mt-0.5">
                {stats.registeredVehiclesCount}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {stats.registeredVehiclesCount > 0
                  ? 'Verified for instant entry'
                  : 'Add vehicle on booking'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
              <Car className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 backdrop-blur-xs flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Digital Receipts
              </p>
              <p className="text-2xl font-extrabold text-white mt-0.5">
                {stats.digitalReceiptsCount}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Official GST &amp; payment slips
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. QUICK NAVIGATION ACTION BAR */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        data-testid="quick-actions-card"
      >
        <Link
          to="/customer/search"
          className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                Search Parking
              </p>
              <p className="text-xs text-muted-foreground">
                Browse live 2D layouts &amp; EV bays
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>

        <Link
          to="/customer/bookings"
          className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
              <BookmarkCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                My Bookings
              </p>
              <p className="text-xs text-muted-foreground">
                QR passes, cancellations &amp; receipts
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>

        <Link
          to="/customer/profile"
          className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                Profile &amp; Vehicles
              </p>
              <p className="text-xs text-muted-foreground">
                Account info &amp; {stats.registeredVehiclesCount} saved vehicle(s)
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      </div>

      {/* 3. PRIORITY BOARDING-PASS CARDS: ACTIVE SESSION & UPCOMING RESERVATION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* A. ACTIVE PARKING SESSION PASS (6 cols) */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Parking Session
            </h2>
            {activeBooking && (
              <Link
                to="/customer/bookings?category=Active"
                className="text-xs font-semibold text-primary hover:underline"
              >
                All Active Sessions &rarr;
              </Link>
            )}
          </div>

          {activeBooking ? (
            <Card
              className={cn(
                'flex-1 overflow-hidden border-2 transition-all rounded-2xl shadow-xs',
                activeBooking.bookingStatus === 'Overstay'
                  ? 'border-amber-500/60 bg-card'
                  : 'border-emerald-500/50 bg-card',
              )}
              data-testid="active-booking-card"
            >
              {/* Top Ticket Header Bar */}
              <div
                className={cn(
                  'px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b',
                  activeBooking.bookingStatus === 'Overstay'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30',
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'text-[10px] uppercase font-bold',
                      activeBooking.bookingStatus === 'Overstay'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white',
                    )}
                  >
                    {activeBooking.bookingStatus}
                  </Badge>
                  <span className="font-mono text-xs font-extrabold text-foreground">
                    {activeBooking.bookingReference}
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className="font-mono text-xs font-semibold bg-background border-border"
                >
                  <Clock className="h-3 w-3 mr-1 text-emerald-600" />
                  {activeBooking.bookingStatus === 'Overstay'
                    ? `Overstay: ${activeBooking.overstay.overstayDurationMinutes}m (+₹${activeBooking.overstay.overstayCharge})`
                    : formatRemainingDuration(activeBooking.remainingMinutes)}
                </Badge>
              </div>

              <CardContent className="p-5 space-y-4 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-lg font-extrabold text-foreground truncate">
                      {activeBooking.parkingName}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{activeBooking.parkingAddress}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                      Bay
                    </span>
                    <span className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                      {activeBooking.currentSlot.slotNumber}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      Floor &amp; Zone
                    </span>
                    <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                      {activeBooking.floor.floorName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Zone {activeBooking.zone.zoneCode}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      Vehicle
                    </span>
                    <p className="text-xs font-extrabold text-foreground font-mono mt-0.5">
                      {activeBooking.vehicle.vehicleNumber}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {activeBooking.vehicle.vehicleType}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      Amount Paid
                    </span>
                    <p className="text-sm font-extrabold text-foreground mt-0.5">
                      ₹{activeBooking.totalAmount}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Grace: {activeBooking.gracePeriodMinutes}m
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/15 px-3.5 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                      Scheduled Check-In
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDateTime(activeBooking.scheduledEntryTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                      Scheduled Check-Out
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDateTime(activeBooking.scheduledExitTime)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeBooking.canViewQr && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setSelectedQrBooking(activeBooking)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        View QR Pass
                      </Button>
                    )}

                    {activeBooking.canDownloadReceipt && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs font-semibold"
                        onClick={() => setSelectedReceiptBooking(activeBooking)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Receipt
                      </Button>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs font-bold text-primary"
                    onClick={() => navigate(`/customer/booking/${activeBooking.bookingId}`)}
                  >
                    View Booking
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="flex-1 rounded-2xl border-dashed border-border/80 bg-card/60 p-6 flex flex-col items-center justify-center text-center space-y-3"
              data-testid="no-active-booking-state"
            >
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">No Active Parking Session</h3>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  You do not have a vehicle currently checked in. Once security scans your entry QR
                  pass at the gate, your live session timer and bay details appear here.
                </p>
              </div>
              <Button size="sm" variant="outline" asChild className="text-xs font-semibold">
                <Link to="/customer/search">Find Nearby Parking</Link>
              </Button>
            </Card>
          )}
        </div>

        {/* B. NEXT UPCOMING RESERVATION PASS (6 cols) */}
        <div className="lg:col-span-6 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Next Upcoming Reservation
            </h2>
            {upcomingBooking && (
              <Link
                to="/customer/bookings?category=Upcoming"
                className="text-xs font-semibold text-primary hover:underline"
              >
                All Upcoming ({stats.upcomingBookingsCount}) &rarr;
              </Link>
            )}
          </div>

          {upcomingBooking ? (
            <Card
              className="flex-1 overflow-hidden border-2 border-primary/30 bg-card rounded-2xl shadow-xs"
              data-testid="upcoming-booking-card"
            >
              {/* Top Ticket Header Bar */}
              <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold">
                    {upcomingBooking.bookingStatus}
                  </Badge>
                  <span className="font-mono text-xs font-extrabold text-foreground">
                    {upcomingBooking.bookingReference}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-primary/30 text-primary bg-background"
                >
                  Reserved Time-Window Pass
                </Badge>
              </div>

              <CardContent className="p-5 space-y-4 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-lg font-extrabold text-foreground truncate">
                      {upcomingBooking.parkingName}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{upcomingBooking.parkingAddress}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 rounded-xl bg-primary/10 border border-primary/30 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                      Assigned Bay
                    </span>
                    <span className="font-mono text-base font-extrabold text-primary">
                      {upcomingBooking.currentSlot.slotNumber}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      Floor &amp; Zone
                    </span>
                    <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                      {upcomingBooking.floor.floorName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Zone {upcomingBooking.zone.zoneCode}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      Vehicle
                    </span>
                    <p className="text-xs font-extrabold text-foreground font-mono mt-0.5">
                      {upcomingBooking.vehicle.vehicleNumber}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {upcomingBooking.vehicle.vehicleType}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      Booking Amount
                    </span>
                    <p className="text-sm font-extrabold text-foreground mt-0.5">
                      ₹{upcomingBooking.totalAmount}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {upcomingBooking.payment?.paymentStatus || 'PAID'}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/15 px-3.5 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                      Scheduled Arrival
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDateTime(upcomingBooking.scheduledEntryTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                      Scheduled Departure
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDateTime(upcomingBooking.scheduledExitTime)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div className="flex flex-wrap items-center gap-2">
                    {upcomingBooking.canViewQr && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs font-semibold"
                        onClick={() => setSelectedQrBooking(upcomingBooking)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Entry QR Pass
                      </Button>
                    )}

                    {upcomingBooking.canDownloadReceipt && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs font-semibold"
                        onClick={() => setSelectedReceiptBooking(upcomingBooking)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Receipt
                      </Button>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs font-bold text-primary"
                    onClick={() => navigate(`/customer/booking/${upcomingBooking.bookingId}`)}
                  >
                    View Booking
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="flex-1 rounded-2xl border-dashed border-border/80 bg-card/60 p-6 flex flex-col items-center justify-center text-center space-y-3"
              data-testid="no-upcoming-booking-state"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Calendar className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">No Upcoming Reservations</h3>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  Planning a trip? Reserve an official parking slot in advance to guarantee bay
                  availability upon arrival.
                </p>
              </div>
              <Button size="sm" asChild className="text-xs font-semibold">
                <Link to="/customer/search">Reserve a Slot</Link>
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* 4. ANALYTICS CHART & NOTIFICATIONS FEED */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* G. BOOKING ACTIVITY CHART (8 cols) */}
        <Card className="lg:col-span-8 border-border/80 bg-card rounded-2xl">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Booking Activity (Last 6 Months)
              </CardTitle>
              <CardDescription className="text-xs">
                Monthly breakdown of your confirmed, completed, and cancelled reservations
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                <span className="h-2.5 w-2.5 rounded-xs bg-orange-500" />
                Active / Upcoming
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                Completed
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-400" />
                Cancelled
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {activityChart.hasActivityData ? (
              <div className="h-64 w-full" data-testid="booking-activity-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activityChart.points}
                    margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '12px',
                      }}
                      formatter={(value, name) => {
                        if (name === 'completedBookings') return [value, 'Completed'];
                        if (name === 'activeOrUpcomingBookings')
                          return [value, 'Active / Upcoming'];
                        if (name === 'cancelledOrNoShowBookings')
                          return [value, 'Cancelled / No Show'];
                        return [value, String(name)];
                      }}
                    />
                    <Bar
                      dataKey="activeOrUpcomingBookings"
                      name="activeOrUpcomingBookings"
                      stackId="bookings"
                      fill="#f97316"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="completedBookings"
                      name="completedBookings"
                      stackId="bookings"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="cancelledOrNoShowBookings"
                      name="cancelledOrNoShowBookings"
                      stackId="bookings"
                      fill="#94a3b8"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="h-60 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/70 rounded-xl bg-muted/15 space-y-2"
                data-testid="empty-activity-chart"
              >
                <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold text-foreground">No Booking Activity Yet</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Once you complete your first reservation, your monthly booking volume and
                  utilization chart will be displayed here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* E. UNREAD NOTIFICATIONS FEED (4 cols) */}
        <Card
          className="lg:col-span-4 border-border/80 bg-card rounded-2xl flex flex-col"
          data-testid="notifications-preview-card"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-bold text-foreground">
                Live Alerts
              </CardTitle>
              {unreadNotificationCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] h-5 px-1.5 font-mono">
                  {unreadNotificationCount}
                </Badge>
              )}
            </div>
            <Link
              to="/customer/notifications"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View All
            </Link>
          </CardHeader>

          <CardContent className="flex-1 space-y-2.5 text-xs">
            {unreadNotifications.length === 0 ? (
              <div className="h-full min-h-[180px] rounded-xl border border-dashed border-border/70 p-6 flex flex-col items-center justify-center text-center text-muted-foreground space-y-1.5">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
                <p className="font-bold text-foreground text-xs">All Caught Up</p>
                <p className="text-[11px] max-w-[200px]">
                  You have no unread booking or payment alerts right now.
                </p>
              </div>
            ) : (
              unreadNotifications.slice(0, 3).map((notif) => (
                <div
                  key={notif._id}
                  className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5 transition-colors hover:bg-primary/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground text-xs leading-snug">
                      {notif.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(notif._id)}
                      className="text-[10px] font-semibold text-primary hover:underline shrink-0 cursor-pointer"
                    >
                      Mark read
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {notif.message}
                  </p>
                  <div className="flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground/80">
                    <span>
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </span>
                    {notif.bookingId && (
                      <Link
                        to={`/customer/booking/${notif.bookingId}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        View Booking &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. C. RECENT ACTIVITY TIMELINE & D. SAVED FAVOURITE LOCATIONS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* C. RECENT ACTIVITY TIMELINE (6 cols) */}
        <Card
          className="lg:col-span-6 border-border/80 bg-card rounded-2xl"
          data-testid="recent-activity-card"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Recent Booking Activity
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time lifecycle events from your reservations
              </CardDescription>
            </div>
            <Link
              to="/customer/bookings"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Booking History &rarr;
            </Link>
          </CardHeader>

          <CardContent>
            {recentActivity.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-8 text-center space-y-2"
                data-testid="no-recent-activity-state"
              >
                <History className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                <p className="text-sm font-semibold text-foreground">No Recent Activity</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Events such as Booking Created, Payment Successful, Entry Verified, Overstay, and
                  Booking Completed will appear here chronologically.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => navigate(`/customer/booking/${item.bookingId}`)}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 text-xs transition-all hover:border-primary/40 hover:bg-muted/25 cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getTimelineBadge(item.eventType, item.eventCode)}
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">
                          {item.bookingReference}
                        </span>
                      </div>
                      <p className="font-bold text-foreground text-xs group-hover:text-primary transition-colors">
                        {item.eventTitle}
                      </p>
                      {item.eventDescription && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {item.eventDescription}
                        </p>
                      )}
                      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary" />
                        {item.parkingName}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className="text-[10px] text-muted-foreground block">
                        {formatDistanceToNow(new Date(item.eventTime), { addSuffix: true })}
                      </span>
                      <span className="text-[10px] font-semibold text-primary block">
                        Details &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* D. FAVOURITE LOCATIONS (6 cols) */}
        <Card
          className="lg:col-span-6 border-border/80 bg-card rounded-2xl"
          data-testid="favourite-locations-card"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
                Saved Favourite Locations
              </CardTitle>
              <CardDescription className="text-xs">
                Quick-book your preferred parking facilities with live slot counts
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {favouriteLocations.length} Saved
            </Badge>
          </CardHeader>

          <CardContent>
            {favouriteLocations.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-8 text-center space-y-3"
                data-testid="no-favourites-state"
              >
                <Heart className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    No Favourite Locations Saved
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Save parking facilities from the Parking Details page for one-click access to
                    live availability and booking.
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild className="text-xs font-semibold">
                  <Link to="/customer/search">Explore Parking Facilities</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {favouriteLocations.map((lot) => {
                  const thumbUrl = getFacilityImageUrl(lot.parkingImages?.[0]);
                  const carRate = lot.pricing?.carHourlyRate || lot.hourlyRate;

                  return (
                    <div
                      key={lot._id}
                      className="rounded-xl border border-border/70 bg-card p-3.5 transition-all hover:border-primary/40 space-y-3"
                      data-testid={`favourite-lot-${lot._id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={lot.parkingName}
                              className="h-14 w-16 rounded-lg object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="h-14 w-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <MapPin className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0 space-y-0.5">
                            <h3 className="text-sm font-bold text-foreground truncate">
                              {lot.parkingName}
                            </h3>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {lot.address}, {lot.city}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-semibold',
                                  lot.availableSlots > 0
                                    ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                                    : 'border-destructive/40 text-destructive bg-destructive/10',
                                )}
                              >
                                {lot.availableSlots} / {lot.totalSlots} Slots Free
                              </Badge>

                              <span className="font-bold text-foreground">₹{carRate}/hr</span>

                              {lot.distanceKm !== null && (
                                <span className="text-muted-foreground flex items-center gap-0.5">
                                  <Navigation className="h-3 w-3 text-primary" />
                                  {lot.distanceKm.toFixed(1)} km
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          title="Remove from Favourites"
                          disabled={removeFavouriteMutation.isPending}
                          onClick={() => removeFavouriteMutation.mutate(lot._id)}
                        >
                          <HeartOff className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                        <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                          <Link to={`/customer/parking/${lot._id}`}>View Parking Details</Link>
                        </Button>
                        <Button size="sm" asChild className="h-8 text-xs font-semibold">
                          <Link to={`/customer/parking/${lot._id}/book`}>Book Now</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Pass Dialog */}
      <BookingQrPassDialog
        open={Boolean(selectedQrBooking)}
        onOpenChange={(open) => {
          if (!open) setSelectedQrBooking(null);
        }}
        booking={selectedQrBooking}
        onViewBookingDetails={(bookingId) => navigate(`/customer/booking/${bookingId}`)}
      />

      {/* Official Receipt Dialog */}
      {selectedReceiptBooking && receiptConfirmation && (
        <BookingConfirmationDialog
          open={Boolean(selectedReceiptBooking)}
          onOpenChange={(open) => {
            if (!open) setSelectedReceiptBooking(null);
          }}
          parkingLotId={selectedReceiptBooking.parkingLotId}
          confirmation={receiptConfirmation}
          onGoToDashboard={() => setSelectedReceiptBooking(null)}
          onBackToFacility={() => {
            const lotId = selectedReceiptBooking.parkingLotId;
            setSelectedReceiptBooking(null);
            navigate(`/customer/parking/${lotId}`);
          }}
        />
      )}
    </div>
  );
};

export default CustomerDashboardPage;
