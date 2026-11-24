import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Search,
  Building2,
  Car,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { getOwnerParkingLots, type OfficialParkingLot } from '@/api/parkingLot.api';
import {
  ownerApi,
  type OwnerBookingItem,
  type OwnerBookingsSummary,
  type OwnerBookingsQueryParams,
} from '@/api/owner.api';
import { getSocket } from '@/lib/socket';
import { BookingConfirmationDialog } from '@/components/customer/booking/BookingConfirmationDialog';
import { useLiveSync } from '@/hooks/useLiveSync';
import type { VerifyBookingPaymentResponse } from '@/api/customerParking.api';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_TABS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending Payment', value: 'Pending Payment' },
  { label: 'Confirmed', value: 'Confirmed' },
  { label: 'Active', value: 'Active' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
  { label: 'No Show', value: 'No Show' },
  { label: 'Overstay', value: 'Overstay' },
];

const OPERATIONAL_REASONS = [
  'Parking Closure',
  'Maintenance Work',
  'Emergency Evacuation',
  'Security Incident',
  'Operational Slot Reallocation',
  'Other Operational Reason',
];

export const OwnerBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLotId = searchParams.get('lotId') || '';

  // Parking Facilities list
  const [parkingLots, setParkingLots] = useState<OfficialParkingLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>(initialLotId);
  const [isLoadingLots, setIsLoadingLots] = useState(true);

  // Bookings state
  const [bookings, setBookings] = useState<OwnerBookingItem[]>([]);
  const [summary, setSummary] = useState<OwnerBookingsSummary>({
    total: 0,
    pendingPayment: 0,
    confirmed: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    overstay: 0,
    totalRevenue: 0,
  });
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [, setIsRefreshing] = useState(false);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'ALL' | 'ONLINE' | 'WALK_IN'>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Modal states: Operational Cancellation
  const [cancelModalBooking, setCancelModalBooking] = useState<OwnerBookingItem | null>(null);
  const [cancellationCategory, setCancellationCategory] = useState<string>(OPERATIONAL_REASONS[0]);
  const [cancellationDetail, setCancellationDetail] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Modal states: Extension
  const [extendModalBooking, setExtendModalBooking] = useState<OwnerBookingItem | null>(null);
  const [newExitTime, setNewExitTime] = useState<string>('');
  const [isExtending, setIsExtending] = useState<boolean>(false);

  // Modal states: Receipt
  const [receiptBooking, setReceiptBooking] = useState<OwnerBookingItem | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Owner Facilities
  useEffect(() => {
    let isMounted = true;
    async function loadLots() {
      try {
        setIsLoadingLots(true);
        const res = await getOwnerParkingLots();
        const lots = res.data?.parkingLots || [];
        if (!isMounted) return;
        setParkingLots(lots);
        if (initialLotId && lots.some((l: OfficialParkingLot) => l._id === initialLotId)) {
          setSelectedLotId(initialLotId);
        }
      } catch (err: any) {
        if (!isMounted) return;
        toast.error('Failed to load parking facilities', {
          description: err?.message || 'Could not fetch your parking facilities.',
        });
      } finally {
        if (isMounted) setIsLoadingLots(false);
      }
    }
    loadLots();
    return () => {
      isMounted = false;
    };
  }, [initialLotId]);

  // Fetch Bookings from backend
  const fetchBookings = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) setIsRefreshing(true);
        else setIsLoadingBookings(true);

        const params: OwnerBookingsQueryParams = {
          parkingLotId: selectedLotId || undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          bookingType: bookingTypeFilter !== 'ALL' ? bookingTypeFilter : undefined,
          paymentStatus: paymentStatusFilter !== 'ALL' ? paymentStatusFilter : undefined,
          search: debouncedSearch.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page: currentPage,
          limit: pageSize,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        };

        const res = await ownerApi.getOwnerBookings(params);
        setBookings(res.bookings);
        setSummary(res.summary);
        setTotalPages(res.pages || 1);
        setTotalCount(res.total || 0);
      } catch (err: any) {
        toast.error('Failed to load bookings', {
          description: err?.message || 'An error occurred while fetching bookings.',
        });
      } finally {
        setIsLoadingBookings(false);
        setIsRefreshing(false);
      }
    },
    [
      selectedLotId,
      statusFilter,
      bookingTypeFilter,
      paymentStatusFilter,
      debouncedSearch,
      startDate,
      endDate,
      currentPage,
      pageSize,
    ],
  );

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useLiveSync(() => {
    void fetchBookings(true);
  });

  // Socket.IO Real-Time Listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBookingChanged = () => {
      fetchBookings(true);
    };

    socket.on('booking_status_changed', handleBookingChanged);
    return () => {
      socket.off('booking_status_changed', handleBookingChanged);
    };
  }, [fetchBookings]);

  // Handle Facility Change
  const handleFacilityChange = (lotId: string) => {
    const newLotId = lotId === 'ALL' ? '' : lotId;
    setSelectedLotId(newLotId);
    setCurrentPage(1);
    if (newLotId) {
      setSearchParams({ lotId: newLotId });
    } else {
      setSearchParams({});
    }
  };

  // Operational Cancellation Handler
  const handleConfirmCancel = async () => {
    if (!cancelModalBooking) return;
    const finalReason = cancellationDetail.trim()
      ? `${cancellationCategory}: ${cancellationDetail.trim()}`
      : cancellationCategory;

    try {
      setIsCancelling(true);
      await ownerApi.cancelOwnerBooking(cancelModalBooking._id, { reason: finalReason });
      toast.success('Booking cancelled successfully', {
        description: `Booking ${cancelModalBooking.bookingReference} has been cancelled.`,
      });
      setCancelModalBooking(null);
      setCancellationDetail('');
      fetchBookings(true);
    } catch (err: any) {
      toast.error('Cancellation failed', {
        description: err?.message || 'Failed to cancel the booking.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Extension Handler
  const handleConfirmExtend = async () => {
    if (!extendModalBooking || !newExitTime) return;

    try {
      setIsExtending(true);
      await ownerApi.extendOwnerBooking(extendModalBooking._id, {
        newScheduledExitTime: new Date(newExitTime).toISOString(),
      });
      toast.success('Booking extended successfully', {
        description: `Booking ${extendModalBooking.bookingReference} has been extended.`,
      });
      setExtendModalBooking(null);
      setNewExitTime('');
      fetchBookings(true);
    } catch (err: any) {
      toast.error('Extension failed', {
        description: err?.message || 'Failed to extend the booking.',
      });
    } finally {
      setIsExtending(false);
    }
  };

  // Calculate preview charge for extension
  const extensionPreview = useMemo(() => {
    if (!extendModalBooking || !newExitTime) return null;
    const currentExit = new Date(extendModalBooking.scheduledExitTime).getTime();
    const newExit = new Date(newExitTime).getTime();
    if (isNaN(newExit) || newExit <= currentExit) return null;

    const diffMinutes = Math.round((newExit - currentExit) / (1000 * 60));
    const hours = Math.ceil(diffMinutes / 60);
    const rate = extendModalBooking.parkingRateAtBooking || 0;
    const charge = hours * rate;

    return { diffMinutes, hours, charge };
  }, [extendModalBooking, newExitTime]);

  // Build Receipt for Confirmation Dialog
  const receiptConfirmationData = useMemo<VerifyBookingPaymentResponse | null>(() => {
    if (!receiptBooking) return null;
    const p = receiptBooking.payment;
    const paymentStatusNormalized =
      p?.paymentStatus === 'REFUNDED'
        ? 'REFUNDED'
        : p?.paymentStatus === 'SUCCESSFUL'
          ? 'SUCCESSFUL'
          : 'FAILED';

    return {
      bookingStatus:
        receiptBooking.bookingStatus === 'Cancelled' || receiptBooking.bookingStatus === 'No Show'
          ? 'Cancelled'
          : 'Confirmed',
      bookingReference: receiptBooking.bookingReference,
      bookingId: receiptBooking._id,
      qrCode: receiptBooking.qrCode || null,
      paymentReference: p?.paymentReference || 'N/A',
      paymentStatus: paymentStatusNormalized,
      transactionId: p?.paymentReference || 'N/A',
      message: `Official receipt for booking ${receiptBooking.bookingReference}`,
      customerDetails: {
        fullName: receiptBooking.customer?.fullName || 'Valued Customer',
        email: receiptBooking.customer?.email || '',
        mobileNumber: receiptBooking.customer?.mobileNumber || '',
      },
      paymentDetails: {
        paymentReference: p?.paymentReference || 'N/A',
        paymentMethod: p?.paymentMethod || 'RAZORPAY',
        paymentStatus: paymentStatusNormalized,
        paymentDate: p?.paymentDate || receiptBooking.createdAt,
        razorpayOrderId: 'N/A',
        razorpayPaymentId: 'N/A',
        paymentVerificationReference: p?.paymentReference || 'N/A',
      },
      bookingDetails: {
        facilityName: receiptBooking.parkingLot?.parkingName || 'Parking Facility',
        address:
          typeof receiptBooking.parkingLot?.address === 'string'
            ? receiptBooking.parkingLot.address
            : '',
        floorName: receiptBooking.floor?.floorName || 'N/A',
        zoneName: receiptBooking.zone?.zoneName || 'N/A',
        zoneCode: receiptBooking.zone?.zoneCode || 'N/A',
        slotNumber: receiptBooking.slot?.slotNumber || 'N/A',
        slotLabel: receiptBooking.slot?.slotLabel || 'N/A',
        vehicleNumber: receiptBooking.vehicle?.vehicleNumber || 'N/A',
        vehicleType: receiptBooking.vehicle?.vehicleType || 'Car',
        vehicleBrand: receiptBooking.vehicle?.brand,
        vehicleModel: receiptBooking.vehicle?.model,
        bookingType: receiptBooking.bookingType,
        scheduledEntryTime: receiptBooking.scheduledEntryTime,
        scheduledExitTime: receiptBooking.scheduledExitTime,
        gracePeriodMinutes: 15,
        bookingDurationMinutes: receiptBooking.bookingDurationMinutes,
        parkingRateAtBooking: receiptBooking.parkingRateAtBooking,
        baseAmount: receiptBooking.baseAmount,
        taxes: 0,
        discountAmount: 0,
        additionalCharges: receiptBooking.additionalCharges,
        totalAmount: receiptBooking.totalAmount,
      },
    };
  }, [receiptBooking]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Confirmed</Badge>;
      case 'Active':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>;
      case 'Completed':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Completed</Badge>;
      case 'Cancelled':
        return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20">Cancelled</Badge>;
      case 'No Show':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">No Show</Badge>;
      case 'Overstay':
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">Overstay</Badge>;
      case 'Pending Payment':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending Payment</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status?: string) => {
    if (!status) return <span className="text-muted-foreground text-xs">—</span>;
    switch (status) {
      case 'SUCCESSFUL':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Paid</Badge>;
      case 'REFUNDED':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">Refunded</Badge>;
      case 'CASH_REVERSAL_PENDING':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">Cash Reversal</Badge>;
      case 'PENDING':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Pending</Badge>;
      case 'FAILED':
        return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. Header & Facility Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Booking Management
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Monitor and manage customer online bookings and security walk-in operations
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Facility Switcher */}
          <div className="w-64">
            {isLoadingLots ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : (
              <Select value={selectedLotId || 'ALL'} onValueChange={handleFacilityChange}>
                <SelectTrigger className="w-full bg-card">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Facilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Facilities</SelectItem>
                  {parkingLots.map((lot) => (
                    <SelectItem key={lot._id} value={lot._id}>
                      {lot.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* 2. Stat Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Bookings</span>
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold mt-2">{summary.total}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.pendingPayment} pending payment
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Active Now</span>
              <Car className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-500 mt-2">{summary.active}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.confirmed} confirmed upcoming
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-300 mt-2">{summary.completed}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Successfully exited</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Cancelled / No-Show</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-500 mt-2">
              {summary.cancelled + summary.noShow}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.cancelled} cancelled, {summary.noShow} no-show
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50 col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Facility Revenue</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-500 mt-2">
              ₹{summary.totalRevenue.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Net (incl. non-refundable no-shows)</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          let count = 0;
          if (tab.value === 'ALL') count = summary.total;
          else if (tab.value === 'Pending Payment') count = summary.pendingPayment;
          else if (tab.value === 'Confirmed') count = summary.confirmed;
          else if (tab.value === 'Active') count = summary.active;
          else if (tab.value === 'Completed') count = summary.completed;
          else if (tab.value === 'Cancelled') count = summary.cancelled;
          else if (tab.value === 'No Show') count = summary.noShow;
          else if (tab.value === 'Overstay') count = summary.overstay;

          return (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Filter Toolbar */}
      <Card className="bg-card/40 border-border/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search reference, customer, vehicle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background"
              />
            </div>

            {/* Booking Type Filter */}
            <div>
              <Select
                value={bookingTypeFilter}
                onValueChange={(val: any) => {
                  setBookingTypeFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Booking Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="ONLINE">Online (Customer)</SelectItem>
                  <SelectItem value="WALK_IN">Walk-in (Security)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <Select
                value={paymentStatusFilter}
                onValueChange={(val: any) => {
                  setPaymentStatusFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Payment Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Payments</SelectItem>
                  <SelectItem value="SUCCESSFUL">Paid (Successful)</SelectItem>
                  <SelectItem value="PENDING">Payment Pending</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                  <SelectItem value="CASH_REVERSAL_PENDING">Cash Reversal Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground h-10"
                onClick={() => {
                  setStatusFilter('ALL');
                  setBookingTypeFilter('ALL');
                  setPaymentStatusFilter('ALL');
                  setSearchQuery('');
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Bookings Data Table */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold border-b">
              <tr>
                <th className="px-4 py-3.5">Booking ID</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Vehicle</th>
                <th className="px-4 py-3.5">Facility / Slot</th>
                <th className="px-4 py-3.5">Type & Creator</th>
                <th className="px-4 py-3.5">Payment</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Scheduled Exit</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoadingBookings ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={10} className="px-4 py-4">
                      <div className="h-6 bg-muted/60 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                      <CalendarCheck className="w-10 h-10 text-muted-foreground/40 mb-1" />
                      <p className="font-semibold text-foreground">No bookings found</p>
                      <p className="text-xs text-muted-foreground">
                        No bookings match the selected facility, filters, or search criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const canCancel =
                    booking.bookingStatus !== 'Cancelled' &&
                    booking.bookingStatus !== 'Completed';
                  const canExtend =
                    booking.bookingStatus === 'Confirmed' || booking.bookingStatus === 'Active';
                  const canReceipt =
                    Boolean(
                      booking.payment &&
                        (booking.payment.paymentStatus === 'SUCCESSFUL' ||
                          booking.payment.paymentStatus === 'REFUNDED'),
                    ) ||
                    booking.bookingStatus === 'Completed' ||
                    booking.bookingStatus === 'Active' ||
                    booking.bookingStatus === 'Confirmed';

                  return (
                    <tr
                      key={booking._id}
                      className="hover:bg-muted/30 transition-colors group text-xs sm:text-sm"
                    >
                      {/* Booking ID & Reference */}
                      <td className="px-4 py-3.5 font-medium">
                        <Link
                          to={`/owner/bookings/${booking._id}`}
                          className="text-primary hover:underline font-mono font-semibold"
                        >
                          {booking.bookingReference}
                        </Link>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(booking.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">
                          {booking.customer?.fullName || 'Walk-in Customer'}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                          {booking.customer?.mobileNumber || booking.customer?.email || '—'}
                        </div>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-semibold text-foreground">
                          {booking.vehicle?.vehicleNumber || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {booking.vehicle?.vehicleType || 'Car'}
                          {booking.vehicle?.brand ? ` • ${booking.vehicle.brand}` : ''}
                        </div>
                      </td>

                      {/* Facility / Slot */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground truncate max-w-[130px]">
                          {booking.parkingLot?.parkingName || 'Facility'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Slot: <span className="font-mono font-semibold text-foreground">{booking.slot?.slotNumber || '—'}</span>
                          {booking.floor?.floorName ? ` (${booking.floor.floorName})` : ''}
                        </div>
                      </td>

                      {/* Type & Created By */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {booking.bookingType === 'WALK_IN' ? 'Walk-in' : 'Online'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            By {booking.createdBy}
                          </span>
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-semibold">
                              {booking.payment?.paymentMethod === 'CASH' ? 'Cash' : 'Razorpay'}
                            </span>
                          </div>
                          <div>{getPaymentStatusBadge(booking.payment?.paymentStatus)}</div>
                        </div>
                      </td>

                      {/* Booking Status */}
                      <td className="px-4 py-3.5">
                        {getStatusBadge(booking.bookingStatus)}
                        {booking.overstayDetected && (
                          <div className="text-[10px] text-rose-500 font-semibold mt-1">
                            +{booking.overstayDurationMinutes}m overstay
                          </div>
                        )}
                      </td>

                      {/* Scheduled Exit */}
                      <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                        <div>{new Date(booking.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-[10px]">{new Date(booking.scheduledExitTime).toLocaleDateString()}</div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right font-medium">
                        <div className="font-semibold text-foreground">
                          ₹{booking.totalAmount.toLocaleString()}
                        </div>
                        {booking.additionalCharges > 0 && (
                          <div className="text-[10px] text-amber-500 font-normal">
                            +₹{booking.additionalCharges} extra
                          </div>
                        )}
                        {booking.refundAmount > 0 && (
                          <div className="text-[10px] text-blue-400 font-normal">
                            -₹{booking.refundAmount} ref.
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View details */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => navigate(`/owner/bookings/${booking._id}`)}
                            title="View Booking Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* Extend */}
                          {canExtend && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              onClick={() => {
                                setExtendModalBooking(booking);
                                // Default new exit time: current scheduled exit + 1 hour
                                const current = new Date(booking.scheduledExitTime);
                                current.setHours(current.getHours() + 1);
                                const tzOffset = current.getTimezoneOffset() * 60000;
                                const localISOTime = new Date(current.getTime() - tzOffset)
                                  .toISOString()
                                  .slice(0, 16);
                                setNewExitTime(localISOTime);
                              }}
                              title="Extend Booking"
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Cancel */}
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              onClick={() => {
                                setCancelModalBooking(booking);
                                setCancellationCategory(OPERATIONAL_REASONS[0]);
                                setCancellationDetail('');
                              }}
                              title="Cancel Booking (Operational)"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}

                          {/* Receipt */}
                          {canReceipt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => setReceiptBooking(booking)}
                              title="Download Official Receipt"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-3 text-xs text-muted-foreground bg-muted/10">
          <div>
            Showing{' '}
            <span className="font-semibold text-foreground">
              {bookings.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-foreground">
              {Math.min(currentPage * pageSize, totalCount)}
            </span>{' '}
            of <span className="font-semibold text-foreground">{totalCount}</span> bookings
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoadingBookings}
              className="h-8 px-2.5"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoadingBookings}
              className="h-8 px-2.5"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* MODAL 1: Operational Cancellation Dialog */}
      <Dialog
        open={Boolean(cancelModalBooking)}
        onOpenChange={(open) => {
          if (!open) setCancelModalBooking(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              Cancel Booking (Operational)
            </DialogTitle>
            <DialogDescription>
              Cancel booking{' '}
              <span className="font-mono font-semibold text-foreground">
                {cancelModalBooking?.bookingReference}
              </span>{' '}
              for legitimate facility operational reasons.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 space-y-1">
              <p className="font-semibold">Important Operational Notice:</p>
              <p>
                Owner cancellation is logged and audited. A mandatory reason is required.
                Eligible paid online bookings will have a refund initiated; walk-in cash payments
                will enter cash reversal status.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Operational Reason Category <span className="text-rose-500">*</span>
              </label>
              <Select
                value={cancellationCategory}
                onValueChange={(val) => setCancellationCategory(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Additional Operational Details
              </label>
              <Textarea
                placeholder="Provide specific notes or instructions regarding this cancellation..."
                value={cancellationDetail}
                onChange={(e) => setCancellationDetail(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCancelModalBooking(null)}
              disabled={isCancelling}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Booking Extension Dialog */}
      <Dialog
        open={Boolean(extendModalBooking)}
        onOpenChange={(open) => {
          if (!open) setExtendModalBooking(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5" />
              Extend Booking
            </DialogTitle>
            <DialogDescription>
              Extend reservation for{' '}
              <span className="font-mono font-semibold text-foreground">
                {extendModalBooking?.bookingReference}
              </span>
              . Slot availability will be validated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Scheduled Exit:</span>
                <span className="font-semibold text-foreground">
                  {extendModalBooking
                    ? new Date(extendModalBooking.scheduledExitTime).toLocaleString()
                    : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parking Rate:</span>
                <span className="font-semibold text-foreground">
                  ₹{extendModalBooking?.parkingRateAtBooking || 0}/hr
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                New Scheduled Exit Date & Time <span className="text-primary">*</span>
              </label>
              <Input
                type="datetime-local"
                value={newExitTime}
                onChange={(e) => setNewExitTime(e.target.value)}
                className="h-10"
              />
            </div>

            {extensionPreview && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extension Duration:</span>
                  <span className="font-semibold text-foreground">
                    {extensionPreview.hours} hr(s) ({extensionPreview.diffMinutes} mins)
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sm text-primary border-t pt-1.5">
                  <span>Additional Charge:</span>
                  <span>₹{extensionPreview.charge}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setExtendModalBooking(null)}
              disabled={isExtending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmExtend}
              disabled={isExtending || !extensionPreview}
            >
              {isExtending ? 'Extending...' : 'Confirm Extension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Official Receipt Confirmation Dialog */}
      {receiptBooking && (
        <BookingConfirmationDialog
          open={Boolean(receiptBooking)}
          onOpenChange={(open) => {
            if (!open) setReceiptBooking(null);
          }}
          parkingLotId={receiptBooking.parkingLot?._id || ''}
          confirmation={receiptConfirmationData}
          onGoToDashboard={() => setReceiptBooking(null)}
          onBackToFacility={() => setReceiptBooking(null)}
        />
      )}
    </div>
  );
};
