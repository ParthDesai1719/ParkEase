import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  MapPin,
  Car,
  Calendar,
  ShieldCheck,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CustomerBookingItem } from '@/api/customerParking.api';

interface BookingQrPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: CustomerBookingItem | null;
  onViewBookingDetails?: (bookingId: string) => void;
}

export const BookingQrPassDialog: React.FC<BookingQrPassDialogProps> = ({
  open,
  onOpenChange,
  booking,
  onViewBookingDetails,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrToken = booking?.qrCode ?? '';

  useEffect(() => {
    let isMounted = true;
    if (!qrToken) {
      return;
    }

    QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (isMounted) setQrDataUrl('');
      });

    return () => {
      isMounted = false;
    };
  }, [qrToken]);

  if (!booking) return null;

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

  const isReassigned =
    booking.reassignment.slotReassignmentStatus === 'REASSIGNED' &&
    booking.originalSlot &&
    booking.originalSlot.slotNumber !== booking.currentSlot.slotNumber;

  const handleCopyToken = () => {
    if (!qrToken) return;
    void navigator.clipboard.writeText(qrToken);
    toast.success('QR pass token copied to clipboard.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/80 bg-background">
        {/* FIXED BRANDED PASS HEADER */}
        <div className="shrink-0 bg-slate-900 text-white px-5 py-4 border-b-4 border-primary">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <img
                  src="/brand/icon-dark.png"
                  alt="ParkEase"
                  className="h-7 w-7 object-contain shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-wider font-bold">
                  Digital Entry &amp; Exit Pass
                </Badge>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-xs border-emerald-400/50 text-emerald-300 bg-emerald-500/10"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {booking.bookingStatus}
              </Badge>
            </div>
            <DialogTitle className="text-base font-bold text-white mt-2 text-left leading-snug">
              {booking.parkingName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 flex items-center gap-1.5 text-left">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="truncate">{booking.parkingAddress}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* SCROLLABLE PASS BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* QR Image & Token */}
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-muted/20 p-4 text-center space-y-2.5">
            {qrDataUrl && qrToken ? (
              <img
                src={qrDataUrl}
                alt={`QR Code for ${booking.bookingReference}`}
                className="h-40 w-40 rounded-xl border border-slate-200 bg-white p-2 shadow-xs object-contain"
              />
            ) : (
              <div className="h-40 w-40 rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground">
                <QrCode className="h-12 w-12 opacity-40" />
              </div>
            )}

            <div className="space-y-1 w-full">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Booking Reference &amp; QR Token
              </p>
              <div className="inline-flex items-center gap-2 font-mono text-xs font-bold text-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                <span>{booking.bookingReference}</span>
                {qrToken && (
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    title="Copy QR token"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {qrToken && (
                <p className="font-mono text-[10px] text-muted-foreground truncate px-2">
                  Token: {qrToken}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Present this QR code to Security Staff at gate entry and exit</span>
            </div>
          </div>

          {/* Reassignment Alert if applicable */}
          {isReassigned && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                <span>Slot Reassigned (No Extra Charge)</span>
              </div>
              <p className="text-muted-foreground">
                Originally{' '}
                <span className="font-mono font-semibold">{booking.originalSlot?.slotNumber}</span>{' '}
                &rarr; Now assigned to{' '}
                <span className="font-mono font-bold text-foreground">
                  {booking.currentSlot.slotNumber}
                </span>
              </p>
            </div>
          )}

          {/* Slot & Vehicle Summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/70 bg-card p-3 space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Assigned Bay
              </span>
              <p className="text-base font-extrabold text-primary font-mono">
                {booking.currentSlot.slotNumber}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {booking.floor.floorName} &bull; Zone {booking.zone.zoneCode}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-3 space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Car className="h-3 w-3 text-primary" />
                Vehicle
              </span>
              <p className="text-sm font-extrabold text-foreground font-mono">
                {booking.vehicle.vehicleNumber}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {booking.vehicle.vehicleType}
                {booking.vehicle.vehicleBrand ? ` • ${booking.vehicle.vehicleBrand}` : ''}
              </p>
            </div>
          </div>

          {/* Schedule Details */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                Scheduled Entry
              </span>
              <span className="font-semibold text-foreground text-right">
                {formatDateTime(booking.scheduledEntryTime)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/50">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                Scheduled Exit
              </span>
              <span className="font-semibold text-foreground text-right">
                {formatDateTime(booking.scheduledExitTime)}
              </span>
            </div>
          </div>
        </div>

        {/* STICKY FOOTER ACTIONS */}
        <div className="shrink-0 bg-muted/30 border-t border-border/80 px-5 py-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground font-medium">
            Grace Period: <strong>{booking.gracePeriodMinutes} mins</strong>
          </span>
          <div className="flex items-center gap-2">
            {onViewBookingDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onViewBookingDetails(booking.bookingId);
                }}
              >
                Full Booking Details
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
