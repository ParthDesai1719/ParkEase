import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar,
  Car,
  Clock,
  FileText,
  Filter,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  TimerOff,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/authStore';
import {
  getCustomerBookings,
  cancelCustomerBooking,
  type CustomerBookingCategory,
  type CustomerBookingItem,
} from '@/api/customerParking.api';
import { BookingQrPassDialog } from '@/components/customer/booking/BookingQrPassDialog';
import { BookingConfirmationDialog } from '@/components/customer/booking/BookingConfirmationDialog';
import { buildReceiptConfirmationFromBooking } from '@/lib/bookingReceiptHelper';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

const BOOKING_CATEGORIES: Array<{
  key: Exclude<CustomerBookingCategory, 'All'>;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    key: 'Upcoming',
    label: 'Upcoming',
    emptyTitle: 'No Upcoming Bookings',
    emptyDescription:
      'You have no upcoming confirmed reservations. Reserve a parking slot in advance to guarantee availability when you arrive.',
  },
  {
    key: 'Active',
    label: 'Active',
    emptyTitle: 'No Active Bookings',
    emptyDescription:
      'You do not have any ongoing parking sessions right now. Once Security Staff scans your entry QR pass, your session will appear here.',
  },
  {
    key: 'Completed',
    label: 'Completed',
    emptyTitle: 'No Completed Bookings',
    emptyDescription:
      'Your completed parking visits and historical payment receipts will be listed in this tab after checkout verification.',
  },
  {
    key: 'Cancelled',
    label: 'Cancelled',
    emptyTitle: 'No Cancelled Bookings',
    emptyDescription:
      'You have no cancelled reservations. Cancelled bookings and their refund details are recorded here.',
  },
  {
    key: 'No Show',
    label: 'No Show',
    emptyTitle: 'No No Show Bookings',
    emptyDescription:
      'Great track record! You have no reservations marked as No Show.',
  },
  {
    key: 'Overstay',
    label: 'Overstay',
    emptyTitle: 'No Overstay Bookings',
    emptyDescription:
      'You have no bookings currently in Overstay status. Exiting within your scheduled window or 15-minute grace period avoids overstay charges.',
  },
];

export const CustomerBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const initialCategoryParam = searchParams.get('category') as Exclude<
    CustomerBookingCategory,
    'All'
  > | null;
  const activeCategory: Exclude<CustomerBookingCategory, 'All'> =
    initialCategoryParam &&
    BOOKING_CATEGORIES.some((c) => c.key === initialCategoryParam)
      ? initialCategoryParam
      : 'Upcoming';

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 6;

  // Dialog states for QR, Receipt & Cancellation
  const [selectedQrBooking, setSelectedQrBooking] = useState<CustomerBookingItem | null>(null);
  const [selectedReceiptBooking, setSelectedReceiptBooking] =
    useState<CustomerBookingItem | null>(null);
  const [selectedCancelBooking, setSelectedCancelBooking] =
    useState<CustomerBookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelCustomerBooking(
        selectedCancelBooking?.bookingId || '',
        cancelReason.trim() || undefined,
      ),
    onSuccess: (res) => {
      toast.success(
        `Reservation ${res.bookingReference || ''} has been cancelled successfully.`,
      );
      setSelectedCancelBooking(null);
      setCancelReason('');
      void queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-dashboard-overview'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to cancel reservation.');
    },
  });

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'customer-bookings',
      user?._id,
      activeCategory,
      debouncedSearch,
      selectedFacilityId,
      dateFrom,
      dateTo,
      page,
      limit,
    ],
    queryFn: () =>
      getCustomerBookings({
        category: activeCategory,
        search: debouncedSearch || undefined,
        parkingLotId: selectedFacilityId !== 'All' ? selectedFacilityId : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      }),
    enabled: Boolean(user?._id),
    staleTime: 10_000,
  });

  // Real-time Socket.IO updates (reconciled with authoritative backend data)
  useEffect(() => {
    if (!user?._id) return;
    const socket = getSocket();

    const handleRealtimeBookingUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
    };

    socket.on('new_notification', handleRealtimeBookingUpdate);
    socket.on('booking_updated', handleRealtimeBookingUpdate);

    return () => {
      socket.off('new_notification', handleRealtimeBookingUpdate);
      socket.off('booking_updated', handleRealtimeBookingUpdate);
    };
  }, [user?._id, queryClient]);

  const handleCategoryChange = (newCategory: string) => {
    const cat = newCategory as Exclude<CustomerBookingCategory, 'All'>;
    setPage(1);
    setSearchParams({ category: cat });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedFacilityId('All');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    selectedFacilityId !== 'All' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const formatDateShort = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getStatusBadge = (status: CustomerBookingItem['bookingStatus']) => {
    switch (status) {
      case 'Confirmed':
        return (
          <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold">
            Confirmed (Upcoming)
          </Badge>
        );
      case 'Active':
        return (
          <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold">
            Active
          </Badge>
        );
      case 'Completed':
        return (
          <Badge className="bg-sky-600 text-white text-[10px] uppercase font-bold">
            Completed
          </Badge>
        );
      case 'Cancelled':
        return (
          <Badge variant="destructive" className="text-[10px] uppercase font-bold">
            Cancelled
          </Badge>
        );
      case 'No Show':
        return (
          <Badge className="bg-rose-600 text-white text-[10px] uppercase font-bold">
            No Show
          </Badge>
        );
      case 'Overstay':
        return (
          <Badge className="bg-amber-600 text-white text-[10px] uppercase font-bold">
            Overstay
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] uppercase font-bold">
            {status}
          </Badge>
        );
    }
  };

  const getPaymentBadge = (payment: CustomerBookingItem['payment']) => {
    if (!payment) {
      return (
        <Badge variant="outline" className="text-[10px] font-mono">
          UNPAID
        </Badge>
      );
    }
    if (payment.paymentStatus === 'SUCCESSFUL') {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] font-mono font-semibold"
        >
          PAID ({payment.paymentMethod})
        </Badge>
      );
    }
    if (payment.paymentStatus === 'REFUNDED') {
      return (
        <Badge
          variant="outline"
          className="border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10 text-[10px] font-mono font-semibold"
        >
          REFUNDED (₹{payment.refundAmount})
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-mono">
        {payment.paymentStatus}
      </Badge>
    );
  };

  const activeCategoryConfig =
    BOOKING_CATEGORIES.find((c) => c.key === activeCategory) ?? BOOKING_CATEGORIES[0]!;

  const receiptConfirmation = selectedReceiptBooking
    ? buildReceiptConfirmationFromBooking(selectedReceiptBooking, user)
    : null;

  return (
    <div
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300"
      data-testid="customer-my-bookings-page"
    >
      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Link to="/customer/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </Button>
        <span className="text-muted-foreground/40">&bull;</span>
        <span className="text-xs text-muted-foreground font-medium">My Bookings</span>
      </div>

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <Badge
            variant="outline"
            className="border-primary/30 text-primary bg-primary/5 font-semibold mb-1.5"
          >
            Reservation History &amp; Passes
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            My Bookings
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
            View and manage your upcoming, active, completed, cancelled, no-show, and overstay
            parking reservations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>

          <Button size="sm" asChild className="gap-1.5 text-xs font-semibold">
            <Link to="/customer/search">
              <Search className="h-3.5 w-3.5" />
              Book New Slot
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. CATEGORY TABS */}
      <Tabs
        value={activeCategory}
        onValueChange={handleCategoryChange}
        className="w-full"
        data-testid="booking-category-tabs"
      >
        <TabsList className="flex w-full h-auto flex-wrap justify-start gap-1.5 bg-muted/50 p-1.5 rounded-xl border border-border/60">
          {BOOKING_CATEGORIES.map((cat) => {
            const count = data?.categoryCounts?.[cat.key] ?? 0;
            return (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                data-testid={`tab-${cat.key.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all cursor-pointer"
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold',
                    activeCategory === cat.key
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background text-muted-foreground border border-border/60',
                  )}
                >
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* 3. SEARCH & FILTERS BAR */}
      <Card className="border-border/80 bg-card/80 shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
            {/* Search by Booking ID or Parking Name */}
            <div className="lg:col-span-4 space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Search Booking Reference or Facility
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="e.g. PB-2026... or Parking Name"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-9 text-xs"
                  data-testid="bookings-search-input"
                />
              </div>
            </div>

            {/* Facility Filter */}
            <div className="lg:col-span-3 space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3 text-primary" />
                Parking Facility
              </label>
              <Select
                value={selectedFacilityId}
                onValueChange={(val) => {
                  setSelectedFacilityId(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Facilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Parking Facilities</SelectItem>
                  {(data?.facilities ?? []).map((fac) => (
                    <SelectItem key={fac._id} value={fac._id}>
                      {fac.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="lg:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                From Date
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* Date To */}
            <div className="lg:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                To Date
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* Clear Filters */}
            <div className="lg:col-span-1 flex justify-end">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                  title="Clear filters"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. BOOKINGS CONTENT AREA */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="bookings-loading">
          {[1, 2, 3, 4].map((n) => (
            <Card key={n} className="border-border/80">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-60" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-28" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card
          className="border-destructive/30 bg-destructive/5 p-8 text-center space-y-4"
          data-testid="bookings-error"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Failed to Load Bookings</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Could not fetch your booking records. Please try again.'}
            </p>
          </div>
          <Button size="sm" onClick={() => void refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      ) : !data || data.bookings.length === 0 ? (
        /* CATEGORY-SPECIFIC EMPTY STATE */
        <Card
          className="border-dashed border-border/80 bg-card/50 p-10 text-center space-y-4"
          data-testid={`empty-state-${activeCategory.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {activeCategory === 'Upcoming' && <Calendar className="h-7 w-7" />}
            {activeCategory === 'Active' && <Clock className="h-7 w-7" />}
            {activeCategory === 'Completed' && <CheckCircle2 className="h-7 w-7" />}
            {activeCategory === 'Cancelled' && <XCircle className="h-7 w-7" />}
            {activeCategory === 'No Show' && <Ban className="h-7 w-7" />}
            {activeCategory === 'Overstay' && <TimerOff className="h-7 w-7" />}
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-foreground">
              {activeCategoryConfig.emptyTitle}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {hasActiveFilters
                ? `No ${activeCategory.toLowerCase()} bookings matched your current search or filter criteria.`
                : activeCategoryConfig.emptyDescription}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button size="sm" asChild className="gap-1.5 font-semibold">
                <Link to="/customer/search">
                  <Search className="h-3.5 w-3.5" />
                  Search Parking Lots
                </Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* BOOKING CARDS GRID */}
          <div
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
            data-testid="booking-cards-grid"
          >
            {data.bookings.map((booking) => {
              const isReassigned =
                booking.reassignment.slotReassignmentStatus === 'REASSIGNED' &&
                booking.originalSlot &&
                booking.originalSlot.slotNumber !== booking.currentSlot.slotNumber;

              return (
                <Card
                  key={booking.bookingId}
                  className={cn(
                    'flex flex-col justify-between border-border/80 bg-card transition-all hover:border-primary/40 shadow-2xs',
                    booking.bookingStatus === 'Overstay' && 'border-amber-500/50 bg-amber-500/5',
                    booking.bookingStatus === 'Active' && 'border-emerald-500/40',
                  )}
                  data-testid={`booking-card-${booking.bookingReference}`}
                >
                  <div>
                    <CardHeader className="pb-3 border-b border-border/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(booking.bookingStatus)}
                          <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border/70">
                            {booking.bookingReference}
                          </span>
                        </div>
                        {getPaymentBadge(booking.payment)}
                      </div>

                      <div className="pt-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <CardTitle className="text-base font-bold text-foreground truncate">
                            {booking.parkingName}
                          </CardTitle>
                          <CardDescription className="text-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{booking.parkingAddress}</span>
                          </CardDescription>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                            Total Amount
                          </span>
                          <span className="text-lg font-extrabold text-foreground">
                            ₹{booking.totalAmount}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-3.5 text-xs">
                      {/* Slot, Floor, Zone & Vehicle Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Slot / Floor / Zone
                          </span>
                          <p className="text-sm font-bold text-primary font-mono mt-0.5">
                            Bay {booking.currentSlot.slotNumber}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {booking.floor.floorName} &bull; {booking.zone.zoneName} (
                            {booking.zone.zoneCode})
                          </p>
                        </div>

                        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Car className="h-3 w-3 text-primary" />
                            Vehicle Details
                          </span>
                          <p className="text-sm font-bold text-foreground font-mono mt-0.5">
                            {booking.vehicle.vehicleNumber}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {booking.vehicle.vehicleType}
                            {booking.vehicle.vehicleBrand
                              ? ` • ${booking.vehicle.vehicleBrand} ${booking.vehicle.vehicleModel || ''}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      {/* Scheduled Entry & Exit Times */}
                      <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Scheduled Entry:
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatDateTime(booking.scheduledEntryTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            Scheduled Exit:
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatDateTime(booking.scheduledExitTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 text-muted-foreground">
                          <span>Booked on {formatDateShort(booking.createdAt)}</span>
                          <span>
                            Rate: ₹{booking.parkingRateAtBooking}/hr ({booking.bookingType})
                          </span>
                        </div>
                      </div>

                      {/* Overstay Specific Information */}
                      {booking.bookingStatus === 'Overstay' && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-amber-700 dark:text-amber-300">
                            <span className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Exceeded Permitted Exit / Grace Period
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-amber-500/40"
                            >
                              {booking.overstay.additionalChargePaymentStatus}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                            <div>
                              <span className="text-muted-foreground block">Grace Ended:</span>
                              <span className="font-semibold text-foreground">
                                {formatDateTime(booking.gracePeriodEndsAt)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">
                                Overstay &amp; Charge:
                              </span>
                              <span className="font-bold text-foreground">
                                {booking.overstay.overstayDurationMinutes} mins &bull; +₹
                                {booking.overstay.overstayCharge}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Slot Reassignment Information */}
                      {isReassigned && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-primary">
                            <span className="flex items-center gap-1.5">
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              Reassigned Due to Overstay Conflict
                            </span>
                            <span className="font-mono">
                              {booking.originalSlot?.slotNumber} &rarr;{' '}
                              {booking.currentSlot.slotNumber}
                            </span>
                          </div>
                          {booking.reassignment.slotReassignedAt && (
                            <p className="text-[10px] text-muted-foreground">
                              Reassigned at {formatDateTime(booking.reassignment.slotReassignedAt)}{' '}
                              with no additional charge.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Cancellation / No Show Information */}
                      {(booking.bookingStatus === 'Cancelled' ||
                        booking.bookingStatus === 'No Show') &&
                        booking.cancellation && (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 space-y-1 text-[11px]">
                            <div className="flex items-center justify-between font-semibold text-destructive">
                              <span>
                                {booking.bookingStatus === 'No Show'
                                  ? 'Marked as No Show'
                                  : `Cancelled by ${booking.cancellation.cancellationBy || 'Customer'}`}
                              </span>
                              {booking.cancellation.refundStatus && (
                                <span className="font-mono text-foreground">
                                  {booking.cancellation.refundStatus}
                                  {booking.cancellation.refundAmount > 0
                                    ? ` (₹${booking.cancellation.refundAmount})`
                                    : ''}
                                </span>
                              )}
                            </div>
                            {booking.cancellation.cancellationReason && (
                              <p className="text-muted-foreground line-clamp-2">
                                Reason: {booking.cancellation.cancellationReason}
                              </p>
                            )}
                          </div>
                        )}
                    </CardContent>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-6 py-3.5 border-t border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {booking.canViewQr && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 text-xs gap-1.5 font-semibold"
                          onClick={() => setSelectedQrBooking(booking)}
                          data-testid={`qr-btn-${booking.bookingReference}`}
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          QR Pass
                        </Button>
                      )}

                      {booking.canDownloadReceipt && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => setSelectedReceiptBooking(booking)}
                          data-testid={`receipt-btn-${booking.bookingReference}`}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Receipt
                        </Button>
                      )}

                      {booking.bookingStatus === 'Confirmed' &&
                        new Date().getTime() < new Date(booking.scheduledEntryTime).getTime() && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 font-semibold border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                            onClick={() => {
                              setSelectedCancelBooking(booking);
                              setCancelReason('');
                            }}
                            data-testid={`cancel-btn-${booking.bookingReference}`}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        )}
                    </div>

                    <Button
                      size="sm"
                      variant={booking.canViewQr ? 'outline' : 'default'}
                      className="h-8 text-xs gap-1.5 font-semibold ml-auto"
                      onClick={() => navigate(`/customer/booking/${booking.bookingId}`)}
                      data-testid={`view-details-btn-${booking.bookingReference}`}
                    >
                      View Details
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* 5. SERVER-SIDE PAGINATION */}
          {data.totalPages > 1 && (
            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/60"
              data-testid="bookings-pagination"
            >
              <p className="text-xs text-muted-foreground">
                Showing page <span className="font-bold text-foreground">{data.page}</span> of{' '}
                <span className="font-bold text-foreground">{data.totalPages}</span> ({data.total}{' '}
                total {activeCategory.toLowerCase()} bookings)
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>

                {Array.from({ length: data.totalPages }, (_, idx) => idx + 1).map((pNum) => (
                  <Button
                    key={pNum}
                    variant={pNum === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pNum)}
                    className="h-8 w-8 p-0 text-xs font-mono"
                  >
                    {pNum}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  className="h-8 gap-1 text-xs"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* QR Pass Modal */}
      <BookingQrPassDialog
        open={Boolean(selectedQrBooking)}
        onOpenChange={(open) => {
          if (!open) setSelectedQrBooking(null);
        }}
        booking={selectedQrBooking}
        onViewBookingDetails={(bookingId) => navigate(`/customer/booking/${bookingId}`)}
      />

      {/* Official Receipt Modal */}
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

      {/* Cancel Reservation Modal */}
      <Dialog
        open={Boolean(selectedCancelBooking)}
        onOpenChange={(open) => {
          if (!open) setSelectedCancelBooking(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">Cancel Parking Reservation</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to cancel reservation{' '}
              <span className="font-mono font-bold text-foreground">
                {selectedCancelBooking?.bookingReference}
              </span>
              ? Your reserved bay will be returned to the pool and full refund initiated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Cancellation (Optional)</Label>
              <Input
                placeholder="e.g. Change of plans, vehicle maintenance"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300">
              <p className="font-semibold">Automated Refund Policy</p>
              <p className="mt-0.5">
                Cancellations completed prior to scheduled entry time qualify for full automated
                refund to your original payment method.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedCancelBooking(null)}
              disabled={cancelMutation.isPending}
              className="text-xs"
            >
              Keep Reservation
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="text-xs gap-1.5"
            >
              {cancelMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerBookingsPage;
