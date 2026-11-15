import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  RefreshCw,
  Car,
  Clock,
  CreditCard,
  AlertTriangle,
  XCircle,
  FileText,
  User,
  ShieldAlert,
  Calendar,
  MapPin,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  ownerApi,
  type OwnerBookingDetailData,
} from '@/api/owner.api';
import { getSocket } from '@/lib/socket';
import { BookingConfirmationDialog } from '@/components/customer/booking/BookingConfirmationDialog';
import type { VerifyBookingPaymentResponse } from '@/api/customerParking.api';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

const OPERATIONAL_REASONS = [
  'Parking Closure',
  'Maintenance Work',
  'Emergency Evacuation',
  'Security Incident',
  'Operational Slot Reallocation',
  'Other Operational Reason',
];

export const OwnerBookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<OwnerBookingDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancellationCategory, setCancellationCategory] = useState<string>(OPERATIONAL_REASONS[0]);
  const [cancellationDetail, setCancellationDetail] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Extension Modal State
  const [showExtendModal, setShowExtendModal] = useState<boolean>(false);
  const [newExitTime, setNewExitTime] = useState<string>('');
  const [isExtending, setIsExtending] = useState<boolean>(false);

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Fetch Booking Detail
  const fetchBookingDetail = useCallback(
    async (showRefreshing = false) => {
      if (!id) return;
      try {
        if (showRefreshing) setIsRefreshing(true);
        else setIsLoading(true);

        const data = await ownerApi.getOwnerBookingById(id);
        setBooking(data);
      } catch (err: any) {
        toast.error('Failed to load booking details', {
          description: err?.message || 'Could not fetch booking information.',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    fetchBookingDetail();
  }, [fetchBookingDetail]);

  // Socket.IO Real-Time Listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBookingChanged = (data: any) => {
      if (data?.bookingId === id) {
        fetchBookingDetail(true);
      }
    };

    socket.on('booking_status_changed', handleBookingChanged);
    return () => {
      socket.off('booking_status_changed', handleBookingChanged);
    };
  }, [id, fetchBookingDetail]);

  // Operational Cancellation Handler
  const handleConfirmCancel = async () => {
    if (!booking) return;
    const finalReason = cancellationDetail.trim()
      ? `${cancellationCategory}: ${cancellationDetail.trim()}`
      : cancellationCategory;

    try {
      setIsCancelling(true);
      const updated = await ownerApi.cancelOwnerBooking(booking._id, { reason: finalReason });
      setBooking(updated);
      toast.success('Booking cancelled successfully', {
        description: `Booking ${booking.bookingReference} has been cancelled.`,
      });
      setShowCancelModal(false);
      setCancellationDetail('');
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
    if (!booking || !newExitTime) return;

    try {
      setIsExtending(true);
      const updated = await ownerApi.extendOwnerBooking(booking._id, {
        newScheduledExitTime: new Date(newExitTime).toISOString(),
      });
      setBooking(updated);
      toast.success('Booking extended successfully', {
        description: `Booking ${booking.bookingReference} has been extended.`,
      });
      setShowExtendModal(false);
      setNewExitTime('');
    } catch (err: any) {
      toast.error('Extension failed', {
        description: err?.message || 'Failed to extend the booking.',
      });
    } finally {
      setIsExtending(false);
    }
  };

  // Calculate Extension Preview
  const extensionPreview = useMemo(() => {
    if (!booking || !newExitTime) return null;
    const currentExit = new Date(booking.scheduledExitTime).getTime();
    const newExit = new Date(newExitTime).getTime();
    if (isNaN(newExit) || newExit <= currentExit) return null;

    const diffMinutes = Math.round((newExit - currentExit) / (1000 * 60));
    const hours = Math.ceil(diffMinutes / 60);
    const rate = booking.parkingRateAtBooking || 0;
    const charge = hours * rate;

    return { diffMinutes, hours, charge };
  }, [booking, newExitTime]);

  // Build Receipt for Confirmation Dialog
  const receiptConfirmationData = useMemo<VerifyBookingPaymentResponse | null>(() => {
    if (!booking) return null;
    const p = booking.payment;
    const paymentStatusNormalized =
      p?.paymentStatus === 'REFUNDED'
        ? 'REFUNDED'
        : p?.paymentStatus === 'SUCCESSFUL'
          ? 'SUCCESSFUL'
          : 'FAILED';

    return {
      bookingStatus:
        booking.bookingStatus === 'Cancelled' || booking.bookingStatus === 'No Show'
          ? 'Cancelled'
          : 'Confirmed',
      bookingReference: booking.bookingReference,
      bookingId: booking._id,
      qrCode: booking.qrCode || null,
      paymentReference: p?.paymentReference || 'N/A',
      paymentStatus: paymentStatusNormalized,
      transactionId: (booking.payments && booking.payments[0]?.transactionId) || p?.paymentReference || 'N/A',
      message: `Official receipt for booking ${booking.bookingReference}`,
      customerDetails: {
        fullName: booking.customer?.fullName || 'Valued Customer',
        email: booking.customer?.email || '',
        mobileNumber: booking.customer?.mobileNumber || '',
      },
      paymentDetails: {
        paymentReference: p?.paymentReference || 'N/A',
        paymentMethod: p?.paymentMethod || 'RAZORPAY',
        paymentStatus: paymentStatusNormalized,
        paymentDate: p?.paymentDate || booking.createdAt,
        razorpayOrderId: (booking.payments && booking.payments[0]?.gatewayOrderId) || 'N/A',
        razorpayPaymentId: (booking.payments && booking.payments[0]?.gatewayPaymentId) || 'N/A',
        paymentVerificationReference: (booking.payments && booking.payments[0]?.transactionId) || p?.paymentReference || 'N/A',
      },
      bookingDetails: {
        facilityName: booking.parkingLot?.parkingName || 'Parking Facility',
        address:
          typeof booking.parkingLot?.address === 'string'
            ? booking.parkingLot.address
            : '',
        floorName: booking.floor?.floorName || 'N/A',
        zoneName: booking.zone?.zoneName || 'N/A',
        zoneCode: booking.zone?.zoneCode || 'N/A',
        slotNumber: booking.slot?.slotNumber || 'N/A',
        slotLabel: booking.slot?.slotLabel || 'N/A',
        vehicleNumber: booking.vehicle?.vehicleNumber || 'N/A',
        vehicleType: booking.vehicle?.vehicleType || 'Car',
        vehicleBrand: booking.vehicle?.brand,
        vehicleModel: booking.vehicle?.model,
        bookingType: booking.bookingType,
        scheduledEntryTime: booking.scheduledEntryTime,
        scheduledExitTime: booking.scheduledExitTime,
        gracePeriodMinutes: 15,
        bookingDurationMinutes: booking.bookingDurationMinutes,
        parkingRateAtBooking: booking.parkingRateAtBooking,
        baseAmount: booking.baseAmount,
        taxes: 0,
        discountAmount: 0,
        additionalCharges: booking.additionalCharges,
        totalAmount: booking.totalAmount,
      },
    };
  }, [booking]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs px-2.5 py-0.5">Confirmed</Badge>;
      case 'Active':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs px-2.5 py-0.5">Active</Badge>;
      case 'Completed':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20 text-xs px-2.5 py-0.5">Completed</Badge>;
      case 'Cancelled':
        return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-xs px-2.5 py-0.5">Cancelled</Badge>;
      case 'No Show':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs px-2.5 py-0.5">No Show</Badge>;
      case 'Overstay':
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-xs px-2.5 py-0.5">Overstay</Badge>;
      case 'Pending Payment':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs px-2.5 py-0.5">Pending Payment</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold">Booking Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested booking does not exist or you do not have permission to view it.
        </p>
        <Button onClick={() => navigate('/owner/bookings')}>
          Back to Bookings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. Header with Breadcrumb & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/owner/bookings')}
            className="h-9 w-9 shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {booking.bookingReference}
              </h1>
              {getStatusBadge(booking.bookingStatus)}
              <Badge variant="outline" className="text-xs">
                {booking.bookingType === 'WALK_IN' ? 'Walk-in' : 'Online'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                By {booking.createdBy}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Booked on {new Date(booking.createdAt).toLocaleString()} • {booking.parkingLot?.parkingName}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBookingDetail(true)}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Extend Booking */}
          {booking.canExtend && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const current = new Date(booking.scheduledExitTime);
                current.setHours(current.getHours() + 1);
                const tzOffset = current.getTimezoneOffset() * 60000;
                const localISOTime = new Date(current.getTime() - tzOffset)
                  .toISOString()
                  .slice(0, 16);
                setNewExitTime(localISOTime);
                setShowExtendModal(true);
              }}
              className="gap-1.5 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
            >
              <Clock className="w-4 h-4" />
              Extend Booking
            </Button>
          )}

          {/* Operational Cancel */}
          {booking.canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCancellationCategory(OPERATIONAL_REASONS[0]);
                setCancellationDetail('');
                setShowCancelModal(true);
              }}
              className="gap-1.5 border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
            >
              <XCircle className="w-4 h-4" />
              Cancel Booking
            </Button>
          )}

          {/* Download Receipt */}
          {booking.canDownloadReceipt && (
            <Button
              size="sm"
              onClick={() => setShowReceiptModal(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileText className="w-4 h-4" />
              Official Receipt
            </Button>
          )}
        </div>
      </div>

      {/* 2. Overview 4-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Customer Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              <span>Customer Details</span>
              <User className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="font-semibold text-sm text-foreground">
              {booking.customer?.fullName || 'Walk-in Customer'}
            </div>
            <div>
              <span className="text-muted-foreground">Phone:</span>{' '}
              <span className="font-mono">{booking.customer?.mobileNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>{' '}
              <span className="truncate block">{booking.customer?.email || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              <span>Vehicle Details</span>
              <Car className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="font-semibold text-sm font-mono text-foreground">
              {booking.vehicle?.vehicleNumber || 'N/A'}
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{' '}
              <Badge variant="outline" className="text-[10px] ml-1">
                {booking.vehicle?.vehicleType || 'Car'}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Model:</span>{' '}
              <span>
                {booking.vehicle?.brand || ''} {booking.vehicle?.model || ''}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Parking Location Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              <span>Slot Assignment</span>
              <MapPin className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
              <span>Slot:</span>
              <span className="font-mono text-primary font-bold">
                {booking.slot?.slotNumber || '—'}
              </span>
              <span className="text-muted-foreground">({booking.slot?.slotLabel || 'Standard'})</span>
            </div>
            <div>
              <span className="text-muted-foreground">Floor:</span>{' '}
              <span>{booking.floor?.floorName || 'Floor 1'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Zone:</span>{' '}
              <span>{booking.zone?.zoneName || 'Zone A'} ({booking.zone?.zoneCode || 'A'})</span>
            </div>
          </CardContent>
        </Card>

        {/* Schedule & Timing Card */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              <span>Schedule & Duration</span>
              <Calendar className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <span className="text-muted-foreground">Entry:</span>{' '}
              <span className="font-medium text-foreground">
                {new Date(booking.scheduledEntryTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Exit:</span>{' '}
              <span className="font-medium text-foreground">
                {new Date(booking.scheduledExitTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Duration:</span>{' '}
              <span>{Math.round(booking.bookingDurationMinutes / 60)} hr(s) ({booking.bookingDurationMinutes}m)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Financial & Payment Breakdown */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Financial & Payment Breakdown
            </span>
            <Badge
              className={
                booking.payment?.paymentStatus === 'SUCCESSFUL'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : booking.payment?.paymentStatus === 'REFUNDED'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }
            >
              {booking.payment?.paymentStatus || 'Payment Pending'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/20 border border-border/40 text-xs">
            <div>
              <span className="text-muted-foreground block mb-1">Base Amount</span>
              <span className="text-base font-semibold text-foreground">₹{booking.baseAmount}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Additional Charges</span>
              <span className="text-base font-semibold text-amber-500">
                +₹{booking.additionalCharges}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Overstay Charges</span>
              <span className="text-base font-semibold text-purple-400">
                +₹{booking.overstayCharge || 0}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Total Amount</span>
              <span className="text-lg font-bold text-foreground">₹{booking.totalAmount}</span>
            </div>
          </div>

          {booking.refundAmount > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400 flex items-center justify-between">
              <span>Operational Refund Issued</span>
              <span className="font-bold text-sm">₹{booking.refundAmount}</span>
            </div>
          )}

          {/* Payment Transaction Details */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                Transaction Records
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] border-b">
                    <tr>
                      <th className="px-3 py-2">Payment Ref</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Transaction ID</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {booking.payments.map((p) => (
                      <tr key={p._id}>
                        <td className="px-3 py-2.5 font-mono font-medium">{p.paymentReference}</td>
                        <td className="px-3 py-2.5">{p.paymentMethod}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {p.paymentStatus}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground">
                          {p.transactionId || p.gatewayPaymentId || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">₹{p.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Overstay / Cancellation Notice Card if applicable */}
      {booking.cancellationReason && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-rose-500 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Operational Cancellation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-rose-400">
            <div>
              <span className="font-semibold text-foreground">Cancelled By:</span>{' '}
              {booking.cancellationBy || 'Parking Owner'}
            </div>
            <div>
              <span className="font-semibold text-foreground">Reason:</span>{' '}
              {booking.cancellationReason}
            </div>
            {booking.refundAmount > 0 && (
              <div>
                <span className="font-semibold text-foreground">Refund Processed:</span>{' '}
                ₹{booking.refundAmount}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. Auditable Booking Timeline */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Booking Timeline & Operational Audit Log
          </CardTitle>
          <CardDescription>
            Chronological audit log of significant lifecycle events for booking{' '}
            <span className="font-mono">{booking.bookingReference}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {booking.timeline && booking.timeline.length > 0 ? (
              booking.timeline.map((event, idx) => (
                <div key={event._id || idx} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {event.eventTitle || event.eventType}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {event.eventSource}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(event.eventTime).toLocaleString()}
                      </span>
                    </div>

                    {event.eventDescription && (
                      <p className="text-xs text-muted-foreground">
                        {event.eventDescription}
                      </p>
                    )}

                    {event.performedBy && (
                      <div className="text-[11px] text-muted-foreground">
                        Performed by:{' '}
                        <span className="font-medium text-foreground">
                          {event.performedBy.fullName}
                        </span>{' '}
                        {event.performedBy.role ? `(${event.performedBy.role})` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No timeline events recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: Operational Cancellation Dialog */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              Cancel Booking (Operational)
            </DialogTitle>
            <DialogDescription>
              Cancel booking{' '}
              <span className="font-mono font-semibold text-foreground">
                {booking.bookingReference}
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
              onClick={() => setShowCancelModal(false)}
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
      <Dialog open={showExtendModal} onOpenChange={setShowExtendModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5" />
              Extend Booking
            </DialogTitle>
            <DialogDescription>
              Extend reservation for{' '}
              <span className="font-mono font-semibold text-foreground">
                {booking.bookingReference}
              </span>
              . Slot availability will be validated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Scheduled Exit:</span>
                <span className="font-semibold text-foreground">
                  {new Date(booking.scheduledExitTime).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parking Rate:</span>
                <span className="font-semibold text-foreground">
                  ₹{booking.parkingRateAtBooking || 0}/hr
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
              onClick={() => setShowExtendModal(false)}
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
      {showReceiptModal && (
        <BookingConfirmationDialog
          open={showReceiptModal}
          onOpenChange={setShowReceiptModal}
          parkingLotId={booking.parkingLot?._id || ''}
          confirmation={receiptConfirmationData}
          onGoToDashboard={() => setShowReceiptModal(false)}
          onBackToFacility={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  );
};
