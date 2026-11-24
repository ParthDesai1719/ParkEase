import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  History,
  Layers,
  Lock,
  LogIn,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  XCircle,
  Ban,
  Loader2,
  Star,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getCustomerBookingDetails,
  cancelCustomerBooking,
  checkInCustomerBooking,
  type CustomerBookingItem,
} from '@/api/customerParking.api';
import { BookingQrPassDialog } from '@/components/customer/booking/BookingQrPassDialog';
import { BookingConfirmationDialog } from '@/components/customer/booking/BookingConfirmationDialog';
import { CustomerReviewModal } from '@/components/customer/CustomerReviewModal';
import { CustomerExtendBookingModal } from '@/components/customer/CustomerExtendBookingModal';
import { CustomerBayNavigationCard } from '@/components/customer/booking/CustomerBayNavigationCard';
import { buildReceiptConfirmationFromBooking } from '@/lib/bookingReceiptHelper';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

function formatDateTime(iso?: string | null): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRemainingDuration(minutes?: number | null): string {
  if (minutes === null || minutes === undefined) return 'N/A';
  if (minutes <= 0) return 'Window elapsed';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) return `${hrs}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export const CustomerBookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [qrDialogBooking, setQrDialogBooking] = useState<CustomerBookingItem | null>(null);
  const [receiptDialogBooking, setReceiptDialogBooking] = useState<CustomerBookingItem | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['customer-booking-detail', id],
    queryFn: () => getCustomerBookingDetails(id || ''),
    enabled: Boolean(id),
    retry: (failureCount, error: unknown) => {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 403 || err?.response?.status === 404) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const invalidateBookingQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['customer-booking-detail', id] });
    void queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['customer-dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['customer-dashboard-overview'] });
  };

  const cancelMutation = useMutation({
    mutationFn: () => cancelCustomerBooking(id || '', cancelReason.trim() || undefined),
    onSuccess: (data) => {
      toast.success(
        `Reservation ${data.bookingReference || ''} has been cancelled successfully.`,
      );
      setCancelModalOpen(false);
      setCancelReason('');
      invalidateBookingQueries();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to cancel reservation.');
    },
  });

  const checkInMutation = useMutation({
    mutationFn: () => checkInCustomerBooking(id || ''),
    onSuccess: () => {
      toast.success('Gate entry recorded successfully. Session is now Active.');
      invalidateBookingQueries();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to record entry.');
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-44 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const err = detailQuery.error as {
      response?: { status?: number; data?: { code?: string; message?: string } };
    };
    const status = err?.response?.status;
    const errorCode = err?.response?.data?.code;
    const errorMessage =
      err?.response?.data?.message || 'Unable to load booking details. Please try again.';

    if (status === 403 || errorCode === 'FORBIDDEN_BOOKING_ACCESS') {
      return (
        <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
          <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <Lock className="h-7 w-7" />
              </div>
              <Badge variant="destructive" className="mt-4 font-mono text-xs">
                403 ACCESS DENIED
              </Badge>
              <h1 className="mt-3 text-xl font-bold text-foreground">
                Unauthorized Booking Access
              </h1>
              <p className="mt-2 max-w-md text-xs text-muted-foreground leading-relaxed">
                {errorMessage || 'You do not have permission to view another customer’s booking.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="outline" size="sm" onClick={() => navigate('/customer/bookings')}>
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to My Bookings
                </Button>
                <Button size="sm" onClick={() => navigate('/customer/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (status === 404 || errorCode === 'BOOKING_NOT_FOUND' || errorCode === 'INVALID_BOOKING_ID') {
      return (
        <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
          <Card className="border-border/70 shadow-xs">
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-foreground">Booking Not Found</h1>
              <p className="mt-2 max-w-md text-xs text-muted-foreground">
                {errorMessage || 'The requested booking record does not exist.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-6"
                onClick={() => navigate('/customer/bookings')}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Return to My Bookings
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h1 className="mt-3 text-lg font-bold text-foreground">Failed to Load Booking</h1>
            <p className="mt-1.5 text-xs text-muted-foreground">{errorMessage}</p>
            <div className="mt-5 flex gap-2.5">
              <Button variant="outline" size="sm" onClick={() => navigate('/customer/bookings')}>
                Back to My Bookings
              </Button>
              <Button size="sm" onClick={() => void detailQuery.refetch()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { booking, timeline, receiptData } = detailQuery.data;
  const durationHours = Math.max(1, Math.ceil((booking.bookingDurationMinutes || 60) / 60));

  const getStatusBadgeClass = (status: CustomerBookingItem['bookingStatus']) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-primary/10 text-primary border-primary/25';
      case 'Active':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'Completed':
        return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30';
      case 'Cancelled':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30';
      case 'No Show':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'Overstay':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/customer/bookings')}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to My Bookings
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void detailQuery.refetch()}
            disabled={detailQuery.isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', detailQuery.isFetching && 'animate-spin')} />
            Refresh
          </Button>
          {booking.parkingLotId && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
              <Link to={`/customer/parking/${booking.parkingLotId}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                View Facility
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Header Banner Card */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-primary">
                  {booking.bookingReference}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[11px] font-bold uppercase',
                    getStatusBadgeClass(booking.bookingStatus),
                  )}
                >
                  {booking.bookingStatus === 'Confirmed'
                    ? 'Upcoming (Confirmed)'
                    : booking.bookingStatus}
                </Badge>
                {booking.payment && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px] font-semibold',
                      booking.payment.paymentStatus === 'SUCCESSFUL'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    )}
                  >
                    Payment: {booking.payment.paymentStatus}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                {booking.parkingName}
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  {booking.parkingAddress}
                  {booking.parkingCity ? `, ${booking.parkingCity}` : ''}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {booking.canViewQr && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                  onClick={() => setQrDialogBooking(booking)}
                >
                  <QrCode className="h-4 w-4" />
                  Open Gate QR Pass
                </Button>
              )}
              {booking.canDownloadReceipt && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold"
                  onClick={() => setReceiptDialogBooking(booking)}
                >
                  <FileText className="h-4 w-4 text-primary" />
                  Receipt & PDF
                </Button>
              )}
              {booking.bookingStatus === 'Confirmed' &&
                new Date().getTime() < new Date(booking.scheduledEntryTime).getTime() && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-semibold border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                    onClick={() => setCancelModalOpen(true)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancel Reservation
                  </Button>
                )}
            </div>
          </div>

          {/* Status-Specific Live Context Banner */}
          {(booking.bookingStatus === 'Active' || booking.bookingStatus === 'Overstay') && (
            <div
              className={cn(
                'mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4',
                booking.bookingStatus === 'Overstay'
                  ? 'border-destructive/40 bg-destructive/10'
                  : 'border-emerald-500/30 bg-emerald-500/10',
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    booking.bookingStatus === 'Overstay'
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  <Timer className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {booking.bookingStatus === 'Overstay'
                      ? 'Overstay Detected — Exceeded Scheduled Window'
                      : 'Active Parking Session in Progress'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {booking.bookingStatus === 'Overstay'
                      ? `Overstay Duration: ${booking.overstay.overstayDurationMinutes} mins • Additional Charge: ₹${booking.overstay.overstayCharge.toFixed(2)} (${booking.overstay.additionalChargePaymentStatus})`
                      : formatRemainingDuration(booking.remainingMinutes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {booking.bookingStatus === 'Active' && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setIsExtendModalOpen(true)}
                    className="h-8 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Extend Booking
                  </Button>
                )}
                <Badge
                  variant={booking.bookingStatus === 'Overstay' ? 'destructive' : 'secondary'}
                  className="font-mono text-xs"
                >
                  Slot {booking.currentSlot.slotNumber}
                </Badge>
              </div>
            </div>
          )}

          {booking.bookingStatus === 'Confirmed' && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Confirmed Time-Window Reservation
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Present your QR Pass at the entry gate during your scheduled entry window (
                    {formatDateTime(booking.scheduledEntryTime)}).
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={checkInMutation.isPending}
                  onClick={() => checkInMutation.mutate()}
                  className="h-8 text-xs gap-1.5 font-semibold border-primary/40 text-primary hover:bg-primary/10"
                >
                  {checkInMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LogIn className="h-3.5 w-3.5" />
                  )}
                  Simulate Gate Check-In
                </Button>
                {new Date().getTime() < new Date(booking.scheduledEntryTime).getTime() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCancelModalOpen(true)}
                    className="h-8 text-xs gap-1.5 font-semibold border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancel Reservation
                  </Button>
                )}
              </div>
            </div>
          )}

          {booking.bookingStatus === 'Completed' && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Parking Session Successfully Completed
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Vehicle checked out at {formatDateTime(booking.actualExitTime)}. Bay{' '}
                    {booking.currentSlot.slotNumber} has been released.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="text-xs h-8 gap-1.5 font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                >
                  <Star className="w-3.5 h-3.5 fill-white" />
                  <span>Rate & Review</span>
                </Button>
                <Badge
                  variant="outline"
                  className="border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10 text-xs font-mono font-bold"
                >
                  COMPLETED
                </Badge>
              </div>
            </div>
          )}

          {(booking.bookingStatus === 'Cancelled' || booking.bookingStatus === 'No Show') && (
            <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-rose-700 dark:text-rose-400">
                    {booking.bookingStatus === 'No Show'
                      ? 'Marked as No Show (Unattended Arrival Window)'
                      : 'Reservation Cancelled'}
                  </p>
                  {booking.cancellation?.cancellationReason && (
                    <p className="text-muted-foreground">
                      Reason:{' '}
                      <span className="font-medium text-foreground">
                        {booking.cancellation.cancellationReason}
                      </span>
                    </p>
                  )}
                  {booking.cancellation?.cancelledAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Recorded on {formatDateTime(booking.cancellation.cancelledAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Slot, Schedule, Vehicle, Timeline */}
        <div className="space-y-6 lg:col-span-2">
          {/* Slot & Schedule Details */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Layers className="h-4 w-4 text-primary" />
                Slot Assignment, Schedule & Vehicle
              </CardTitle>
              <CardDescription className="text-xs">
                Official slot location and reservation window details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Assigned Slot
                  </p>
                  <p className="mt-1 font-mono text-lg font-extrabold text-primary">
                    {booking.currentSlot.slotNumber}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {booking.floor.floorName} • Zone {booking.zone.zoneCode || booking.zone.zoneName}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Slot & Vehicle Type
                  </p>
                  <p className="mt-1 text-base font-bold text-foreground">
                    {booking.vehicle.vehicleType} Bay
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Slot Category: {booking.currentSlot.slotType}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Registered Vehicle
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-base font-bold text-foreground">
                    <Car className="h-4 w-4 text-primary" />
                    {booking.vehicle.vehicleNumber}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[booking.vehicle.vehicleBrand, booking.vehicle.vehicleModel]
                      .filter(Boolean)
                      .join(' ') || booking.vehicle.vehicleType}
                  </p>
                </div>
              </div>

              {/* Slot Reassignment Alert if Reassigned */}
              {booking.reassignment.slotReassignmentStatus === 'REASSIGNED' && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-2.5">
                    <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-amber-700 dark:text-amber-400">
                        Slot Reassignment Recorded
                      </p>
                      <p className="text-foreground">
                        Moved from{' '}
                        <span className="font-mono font-bold">
                          {booking.reassignment.originalSlotNumber ||
                            booking.originalSlot?.slotNumber ||
                            'Previous Slot'}
                        </span>{' '}
                        to{' '}
                        <span className="font-mono font-bold">
                          {booking.reassignment.currentSlotNumber}
                        </span>{' '}
                        on {formatDateTime(booking.reassignment.slotReassignedAt)}.
                      </p>
                      {booking.reassignment.slotReassignmentReason && (
                        <p className="text-[11px] text-muted-foreground">
                          Reason: {booking.reassignment.slotReassignmentReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Entry & Exit Windows */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    Scheduled Entry Time
                  </div>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {formatDateTime(booking.scheduledEntryTime)}
                  </p>
                  {booking.actualEntryTime && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Actual Gate Check-In: {formatDateTime(booking.actualEntryTime)}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 p-3.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Scheduled Exit Time ({durationHours}h duration)
                  </div>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    {formatDateTime(booking.scheduledExitTime)}
                  </p>
                  {booking.actualExitTime && (
                    <p className="mt-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                      Actual Gate Check-Out: {formatDateTime(booking.actualExitTime)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Turn-by-Turn Bay Navigation for Active / Reassigned Bookings */}
          {(booking.bookingStatus === 'Active' ||
            booking.bookingStatus === 'Overstay' ||
            booking.bookingStatus === 'Confirmed' ||
            booking.reassignment.slotReassignmentStatus === 'REASSIGNED') && (
            <CustomerBayNavigationCard booking={booking} />
          )}

          {/* Chronological Booking Timeline */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <History className="h-4 w-4 text-primary" />
                Booking Lifecycle Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Authoritative chronological audit log of events for {booking.bookingReference}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {timeline.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No timeline events recorded yet.
                </p>
              ) : (
                <ol className="relative ml-3 space-y-5 border-l border-border/80 pl-5">
                  {timeline.map((event) => (
                    <li key={event._id} className="relative">
                      <span className="absolute -left-[27px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-background" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-foreground">{event.eventTitle}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatDateTime(event.eventTime)}
                        </span>
                      </div>
                      {event.eventDescription && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {event.eventDescription}
                        </p>
                      )}
                      <Badge variant="secondary" className="mt-1.5 text-[9px] font-mono">
                        {event.eventSource}
                      </Badge>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Pricing, Payment & Refund Breakdown */}
        <div className="space-y-6">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <CreditCard className="h-4 w-4 text-primary" />
                Pricing & Payment Summary
              </CardTitle>
              <CardDescription className="text-xs">
                Verified breakdown from booking and payment records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-5 text-xs">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Parking Rate ({booking.vehicle.vehicleType})</span>
                  <span className="font-mono font-semibold text-foreground">
                    ₹{booking.parkingRateAtBooking}/hr
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Billable Duration</span>
                  <span className="font-mono font-semibold text-foreground">
                    {durationHours} {durationHours === 1 ? 'hr' : 'hrs'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Base Parking Amount</span>
                  <span className="font-mono font-semibold text-foreground">
                    ₹{booking.baseAmount.toFixed(2)}
                  </span>
                </div>
                {typeof booking.platformBookingFee === 'number' && booking.platformBookingFee > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Platform Booking Fee</span>
                    <span className="font-mono font-semibold text-primary">
                      ₹{booking.platformBookingFee.toFixed(2)}
                    </span>
                  </div>
                )}
                {booking.additionalCharges > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Additional Charges</span>
                    <span className="font-mono font-semibold text-foreground">
                      ₹{booking.additionalCharges.toFixed(2)}
                    </span>
                  </div>
                )}
                {booking.overstay.overstayCharge > 0 && (
                  <div className="flex items-center justify-between text-destructive">
                    <span>Overstay Charges ({booking.overstay.overstayDurationMinutes}m)</span>
                    <span className="font-mono font-bold">
                      ₹{booking.overstay.overstayCharge.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="border-t border-border/70 pt-3 flex items-center justify-between text-sm font-extrabold text-foreground">
                  <span>Total Amount</span>
                  <span className="font-mono text-base text-primary">
                    ₹{booking.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Record Info */}
              {booking.payment && (
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Payment Record
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {booking.payment.paymentMethod}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <p className="flex justify-between">
                      <span>Receipt Ref:</span>
                      <span className="font-mono text-foreground">
                        {booking.payment.paymentReference}
                      </span>
                    </p>
                    {booking.payment.transactionId && (
                      <p className="flex justify-between">
                        <span>Transaction ID:</span>
                        <span className="font-mono text-foreground truncate max-w-[150px]">
                          {booking.payment.transactionId}
                        </span>
                      </p>
                    )}
                    {booking.payment.paymentDate && (
                      <p className="flex justify-between">
                        <span>Paid At:</span>
                        <span className="text-foreground">
                          {formatDateTime(booking.payment.paymentDate)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Refund Record Info */}
              {booking.cancellation &&
                (booking.cancellation.refundAmount > 0 || booking.cancellation.refundStatus) && (
                  <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400">
                        Refund Summary
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {booking.cancellation.refundStatus || 'PROCESSED'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <p className="flex justify-between">
                        <span>
                          Refund Amount
                          {booking.cancellation.refundPercentage !== null
                            ? ` (${booking.cancellation.refundPercentage}%)`
                            : ''}
                          :
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          ₹{booking.cancellation.refundAmount.toFixed(2)}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

              {/* Security Verification Note */}
              <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/10 p-3 text-[11px] text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Booked on {formatDateTime(booking.createdAt)}. Verified under your customer
                  account.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR Pass Modal */}
      <BookingQrPassDialog
        open={Boolean(qrDialogBooking)}
        onOpenChange={(open) => {
          if (!open) setQrDialogBooking(null);
        }}
        booking={qrDialogBooking}
      />

      {/* Receipt Modal */}
      <BookingConfirmationDialog
        open={Boolean(receiptDialogBooking)}
        onOpenChange={(open) => {
          if (!open) setReceiptDialogBooking(null);
        }}
        parkingLotId={receiptDialogBooking?.parkingLotId || booking.parkingLotId}
        confirmation={
          receiptDialogBooking
            ? receiptData || buildReceiptConfirmationFromBooking(receiptDialogBooking, user)
            : null
        }
        onGoToDashboard={() => {
          setReceiptDialogBooking(null);
          navigate('/customer/dashboard');
        }}
        onBackToFacility={() => {
          const lotId = receiptDialogBooking?.parkingLotId || booking.parkingLotId;
          setReceiptDialogBooking(null);
          if (lotId) {
            navigate(`/customer/parking/${lotId}`);
          }
        }}
      />

      {/* Cancel Reservation Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">Cancel Parking Reservation</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to cancel booking{' '}
              <span className="font-mono font-bold text-foreground">
                {booking.bookingReference}
              </span>
              ? Your reserved slot will be released back to other drivers and eligible refunds
              processed.
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
              <p className="font-semibold">Refund Policy Note</p>
              <p className="mt-0.5">
                Cancellations completed prior to scheduled entry time qualify for full automated
                refund to the original payment channel.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
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

      {/* Review Modal for Completed Booking */}
      {booking && (
        <CustomerReviewModal
          open={isReviewModalOpen}
          onOpenChange={setIsReviewModalOpen}
          booking={{
            bookingId: booking.bookingId,
            bookingReference: booking.bookingReference,
            parkingName: booking.parkingName,
            parkingAddress: booking.parkingAddress,
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['customer-booking-detail', id] });
          }}
        />
      )}

      {/* Customer Extend Booking Modal */}
      {booking && (
        <CustomerExtendBookingModal
          isOpen={isExtendModalOpen}
          onClose={() => setIsExtendModalOpen(false)}
          booking={{
            id: booking.bookingId,
            bookingReference: booking.bookingReference,
            scheduledExitTime: booking.scheduledExitTime,
            parkingLotName: booking.parkingName,
            parkingRateAtBooking: booking.parkingRateAtBooking,
            vehicleNumber: booking.vehicle.vehicleNumber,
            slotNumber: booking.currentSlot.slotNumber,
          }}
          onSuccess={() => {
            invalidateBookingQueries();
          }}
        />
      )}
    </div>
  );
};

export default CustomerBookingDetailPage;
