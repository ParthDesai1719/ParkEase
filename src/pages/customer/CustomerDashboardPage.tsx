import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ArrowRight,
  AlertTriangle,
  Sparkles,
  History,
  BookmarkCheck,
  Navigation,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  getCustomerDashboardOverview,
  toggleFacilityFavourite,
  getFacilityImageUrl,
  type CustomerBookingItem,
} from '@/api/customerParking.api';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQrBooking, setSelectedQrBooking] = useState<CustomerBookingItem | null>(null);
  const [selectedReceiptBooking, setSelectedReceiptBooking] =
    useState<CustomerBookingItem | null>(null);

  // Request browser geolocation for distance calculation on facilities
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
        // Geolocation denied or unavailable; proceed without user coords
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
  } = useQuery({
    queryKey: ['customer-dashboard', user?._id, userCoords.latitude, userCoords.longitude],
    queryFn: () => getCustomerDashboardOverview(userCoords),
    enabled: Boolean(user?._id),
    staleTime: 15_000,
  });

  // Silent live sync across socket events and background interval
  useLiveSync(() => {
    void refetch();
  });

  // Real-time updates via Socket.IO
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/customer/search?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/customer/search');
    }
  };

  // 1. LOADING STATE
  if (isLoading) {
    return (
      <div
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6"
        data-testid="customer-dashboard-loading"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // 2. ERROR STATE
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
              <Link to="/customer/search">Find Parking</Link>
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
    favouriteLocations,
    unreadNotificationCount,
  } = dashboard;

  const receiptConfirmation = selectedReceiptBooking
    ? buildReceiptConfirmationFromBooking(selectedReceiptBooking, user)
    : null;

  return (
    <div
      className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300"
      data-testid="customer-dashboard-page"
    >
      {/* 1. WELCOME & LIVE STATUS HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, {user?.fullName?.split(' ')[0] || 'Driver'} 👋
            </h1>
            {stats.activeBookingsCount > 0 && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-bold gap-1.5 py-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Session
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Find nearby parking, access your live QR pass, and manage bookings within 3 taps.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {unreadNotificationCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs gap-1.5 h-9 border-primary/40 bg-primary/5 text-primary"
            >
              <Link to="/customer/notifications">
                <Bell className="h-3.5 w-3.5 text-primary" />
                <span>{unreadNotificationCount} New</span>
              </Link>
            </Button>
          )}

          <Button
            size="sm"
            asChild
            className="text-xs font-bold gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Link to="/customer/search">
              <Search className="h-3.5 w-3.5" />
              Find Parking
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. ACTIVE BOOKING SPOTLIGHT (PRIMARY HERO IF ACTIVE) */}
      {activeBooking && (
        <Card
          className={cn(
            'overflow-hidden border-2 rounded-2xl shadow-sm transition-all',
            activeBooking.bookingStatus === 'Overstay'
              ? 'border-amber-500 bg-amber-500/5'
              : 'border-emerald-500 bg-emerald-500/5',
          )}
          data-testid="active-booking-card"
        >
          {/* Header Bar */}
          <div
            className={cn(
              'px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b',
              activeBooking.bookingStatus === 'Overstay'
                ? 'bg-amber-500/15 border-amber-500/30'
                : 'bg-emerald-500/15 border-emerald-500/30',
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span
                  className={cn(
                    'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                    activeBooking.bookingStatus === 'Overstay' ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex rounded-full h-3 w-3',
                    activeBooking.bookingStatus === 'Overstay' ? 'bg-amber-600' : 'bg-emerald-600',
                  )}
                />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Active Parking Session
              </span>
              <Badge
                className={cn(
                  'text-[10px] font-bold uppercase',
                  activeBooking.bookingStatus === 'Overstay'
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-600 text-white',
                )}
              >
                {activeBooking.bookingStatus}
              </Badge>
              <span className="font-mono text-xs font-bold text-muted-foreground hidden sm:inline">
                #{activeBooking.bookingReference}
              </span>
            </div>

            <Badge
              variant="outline"
              className={cn(
                'font-mono text-xs font-semibold px-2.5 py-1 bg-background border',
                activeBooking.bookingStatus === 'Overstay'
                  ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
              )}
            >
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              {activeBooking.bookingStatus === 'Overstay'
                ? `Overstay: ${activeBooking.overstay.overstayDurationMinutes}m (+₹${activeBooking.overstay.overstayCharge})`
                : formatRemainingDuration(activeBooking.remainingMinutes)}
            </Badge>
          </div>

          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-foreground tracking-tight">
                  {activeBooking.parkingName}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{activeBooking.parkingAddress}</span>
                </p>
              </div>

              {/* Bay Badge Spotlight */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-center rounded-xl bg-background border-2 border-emerald-500/40 px-4 py-2 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Assigned Bay
                  </span>
                  <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {activeBooking.currentSlot.slotNumber}
                  </span>
                </div>
                <div className="text-left space-y-0.5 text-xs">
                  <p className="font-bold text-foreground">{activeBooking.floor.floorName}</p>
                  <p className="text-muted-foreground">Zone {activeBooking.zone.zoneCode}</p>
                  <p className="font-mono font-bold text-foreground">
                    {activeBooking.vehicle.vehicleNumber} ({activeBooking.vehicle.vehicleType})
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Summary Pill Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Check-In
                </span>
                <span className="font-semibold text-foreground mt-0.5 block truncate">
                  {formatDateTime(activeBooking.scheduledEntryTime)}
                </span>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Scheduled Check-Out
                </span>
                <span className="font-semibold text-foreground mt-0.5 block truncate">
                  {formatDateTime(activeBooking.scheduledExitTime)}
                </span>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Grace Period
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {activeBooking.gracePeriodMinutes} mins included
                </span>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Total Paid
                </span>
                <span className="font-extrabold text-foreground text-sm mt-0.5 block">
                  ₹{activeBooking.totalAmount}
                </span>
              </div>
            </div>

            {/* 3-TAP DIRECT ACTIONS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-2.5">
                {activeBooking.canViewQr && (
                  <Button
                    size="sm"
                    className="gap-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={() => setSelectedQrBooking(activeBooking)}
                  >
                    <QrCode className="h-4 w-4" />
                    View QR Parking Pass
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs font-semibold bg-background"
                  onClick={() => navigate(`/customer/booking/${activeBooking.bookingId}`)}
                >
                  <Navigation className="h-3.5 w-3.5 text-primary" />
                  Navigate to Bay
                </Button>

                {activeBooking.canDownloadReceipt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs font-medium"
                    onClick={() => setSelectedReceiptBooking(activeBooking)}
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Receipt
                  </Button>
                )}
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs font-bold text-primary hover:text-primary/90"
                onClick={() => navigate(`/customer/booking/${activeBooking.bookingId}`)}
              >
                Booking Details &amp; Extend
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. FIND PARKING HERO (PRIMARY IF NO ACTIVE SESSION, OR COMPACT SEARCH BAR IF ACTIVE) */}
      {!activeBooking ? (
        <Card
          className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-background p-6 sm:p-8 shadow-sm"
          data-testid="no-active-booking-state"
        >
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 mr-1" />
                Find &amp; Book Parking
              </Badge>
              <span className="text-xs text-muted-foreground">Guaranteed spot in 3 taps</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Where would you like to park today?
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Search verified parking facilities with live 2D slot availability, EV charging bays,
                and instant QR gate entry.
              </p>
            </div>

            {/* Quick Search Bar */}
            <form onSubmit={handleSearchSubmit} className="pt-2">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter city, landmark, or facility name (e.g. Pune, Bandra)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-background border-border/80 text-xs sm:text-sm shadow-xs rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 px-6 font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl shadow-sm shrink-0"
                >
                  <Search className="h-4 w-4" />
                  Find Parking
                </Button>
              </div>
            </form>

            {/* Quick Vehicle Type Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
              <span className="text-muted-foreground text-[11px] font-semibold mr-1">
                Quick filter:
              </span>
              {['Car', 'Bike', 'SUV', 'EV'].map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 text-xs px-3 rounded-full bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                >
                  <Link
                    to={`/customer/search?${new URLSearchParams({
                      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
                      vehicleType: type,
                    }).toString()}`}
                  >
                    {type === 'EV' ? '⚡ EV Charging' : type}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        /* Compact Search Bar when Active Session is already taking Hero spot */
        <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
              <Compass className="h-4 w-4 text-primary shrink-0" />
              <Input
                type="text"
                placeholder="Planning another trip? Search nearby parking spots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 bg-muted/20 border-border/60 text-xs rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <Button
                type="submit"
                size="sm"
                className="h-9 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-4"
              >
                <Search className="h-3.5 w-3.5" />
                Find Parking
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* 4. UPCOMING RESERVATION PREVIEW (COMPACT) */}
      {upcomingBooking && (
        <Card
          className="border border-primary/30 bg-primary/5 rounded-2xl overflow-hidden shadow-2xs"
          data-testid="upcoming-booking-card"
        >
          <div className="px-5 py-3 border-b border-primary/20 flex flex-wrap items-center justify-between gap-2 bg-primary/10">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Next Upcoming Reservation
              </span>
              <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold">
                {upcomingBooking.bookingStatus}
              </Badge>
            </div>
            <span className="font-mono text-xs font-bold text-muted-foreground">
              #{upcomingBooking.bookingReference}
            </span>
          </div>

          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1 min-w-0">
              <h4 className="text-base font-extrabold text-foreground truncate">
                {upcomingBooking.parkingName}
              </h4>
              <p className="text-muted-foreground flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{upcomingBooking.parkingAddress}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Arrival: {formatDateTime(upcomingBooking.scheduledEntryTime)}
                </span>
                <span>&bull;</span>
                <span>
                  Bay <strong className="text-primary">{upcomingBooking.currentSlot.slotNumber}</strong> (
                  {upcomingBooking.floor.floorName})
                </span>
                <span>&bull;</span>
                <span className="font-mono">{upcomingBooking.vehicle.vehicleNumber}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {upcomingBooking.canViewQr && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground h-8.5"
                  onClick={() => setSelectedQrBooking(upcomingBooking)}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Entry Pass
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs font-semibold h-8.5"
                onClick={() => navigate(`/customer/booking/${upcomingBooking.bookingId}`)}
              >
                Details
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. 3-TAP QUICK ACTIONS SHORTCUTS */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Quick Actions (1-Tap Shortcuts)
        </h3>
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
          data-testid="quick-actions-card"
        >
          <Link
            to="/customer/search"
            className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/60 hover:shadow-sm flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                <Search className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                Find Parking
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Live 2D layouts &amp; slot booking
              </p>
            </div>
          </Link>

          <Link
            to="/customer/bookings"
            className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/60 hover:shadow-sm flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
                <BookmarkCheck className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                My Bookings
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.totalBookingsCount} total reservations
              </p>
            </div>
          </Link>

          <Link
            to="/customer/favourites"
            className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/60 hover:shadow-sm flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors shrink-0">
                <Heart className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                Saved Parking
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {favouriteLocations.length} favourite locations
              </p>
            </div>
          </Link>

          <Link
            to="/customer/profile"
            className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/60 hover:shadow-sm flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                <Car className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                My Vehicles
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.registeredVehiclesCount} registered vehicle(s)
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 6. RECENT ACTIVITY & SAVED LOCATIONS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* RECENT ACTIVITY (6 cols) */}
        <Card
          className="lg:col-span-6 border-border/80 bg-card rounded-2xl flex flex-col"
          data-testid="recent-activity-card"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-xs">
                Latest updates and lifecycle milestones
              </CardDescription>
            </div>
            <Link
              to="/customer/bookings"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
            >
              All Bookings &rarr;
            </Link>
          </CardHeader>

          <CardContent className="flex-1 space-y-2.5">
            {recentActivity.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-8 text-center space-y-2"
                data-testid="no-recent-activity-state"
              >
                <History className="h-7 w-7 text-muted-foreground/50 mx-auto" />
                <p className="text-xs font-bold text-foreground">No Recent Activity</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Updates like entry confirmations, payments, and completed visits will show here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 4).map((item) => (
                  <div
                    key={item._id}
                    onClick={() => navigate(`/customer/booking/${item.bookingId}`)}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 text-xs transition-all hover:border-primary/40 hover:bg-muted/25 cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {getTimelineBadge(item.eventType, item.eventCode)}
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.bookingReference}
                        </span>
                      </div>
                      <p className="font-bold text-foreground text-xs group-hover:text-primary transition-colors truncate">
                        {item.eventTitle}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary shrink-0" />
                        <span>{item.parkingName}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground block">
                        {formatDistanceToNow(new Date(item.eventTime), { addSuffix: true })}
                      </span>
                      <span className="text-[11px] font-semibold text-primary block">
                        View &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SAVED LOCATIONS (6 cols) */}
        <Card
          className="lg:col-span-6 border-border/80 bg-card rounded-2xl flex flex-col"
          data-testid="favourite-locations-card"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
                Saved Parking Spots
              </CardTitle>
              <CardDescription className="text-xs">
                Quick-book your preferred parking spots
              </CardDescription>
            </div>
            <Link
              to="/customer/favourites"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
            >
              Manage ({favouriteLocations.length}) &rarr;
            </Link>
          </CardHeader>

          <CardContent className="flex-1 space-y-2.5">
            {favouriteLocations.length === 0 ? (
              <div
                className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-8 text-center space-y-2.5"
                data-testid="no-favourites-state"
              >
                <Heart className="h-7 w-7 text-muted-foreground/50 mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-foreground">No Saved Parking Spots</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    Save parking facilities you visit often for one-tap booking and live slot checks.
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild className="text-xs h-8">
                  <Link to="/customer/search">Explore Facilities</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {favouriteLocations.slice(0, 3).map((lot) => {
                  const thumbUrl = getFacilityImageUrl(lot.parkingImages?.[0]);
                  const carRate = lot.pricing?.carHourlyRate || lot.hourlyRate;

                  return (
                    <div
                      key={lot._id}
                      className="rounded-xl border border-border/70 bg-card p-3 transition-all hover:border-primary/40 space-y-2"
                      data-testid={`favourite-lot-${lot._id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={lot.parkingName}
                              className="h-10 w-12 rounded-lg object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <MapPin className="h-4 w-4" />
                            </div>
                          )}

                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-xs font-bold text-foreground truncate">
                              {lot.parkingName}
                            </h4>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {lot.address}, {lot.city}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          title="Remove from Saved"
                          disabled={removeFavouriteMutation.isPending}
                          onClick={() => removeFavouriteMutation.mutate(lot._id)}
                        >
                          <HeartOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-semibold py-0',
                              lot.availableSlots > 0
                                ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                                : 'border-destructive/40 text-destructive bg-destructive/10',
                            )}
                          >
                            {lot.availableSlots} Free
                          </Badge>
                          <span className="font-bold text-foreground">₹{carRate}/hr</span>
                          {lot.distanceKm !== null && (
                            <span className="text-muted-foreground hidden sm:inline">
                              {lot.distanceKm.toFixed(1)} km
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button variant="ghost" size="sm" asChild className="h-7 text-xs px-2">
                            <Link to={`/customer/parking/${lot._id}`}>View</Link>
                          </Button>
                          <Button
                            size="sm"
                            asChild
                            className="h-7 text-xs font-semibold px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Link to={`/customer/parking/${lot._id}/book`}>Book Now</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR PASS MODAL */}
      <BookingQrPassDialog
        open={Boolean(selectedQrBooking)}
        onOpenChange={(open) => {
          if (!open) setSelectedQrBooking(null);
        }}
        booking={selectedQrBooking}
        onViewBookingDetails={(bookingId) => navigate(`/customer/booking/${bookingId}`)}
      />

      {/* RECEIPT MODAL */}
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
