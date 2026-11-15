import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  CheckCircle2,
  QrCode,
  Download,
  Mail,
  ArrowRight,
  ShieldCheck,
  User,
  Calendar,
  CreditCard,
  Receipt,
  MapPin,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  emailCustomerBookingReceipt,
  type VerifyBookingPaymentResponse,
} from '@/api/customerParking.api';

interface BookingConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkingLotId: string;
  confirmation: VerifyBookingPaymentResponse | null;
  onGoToDashboard: () => void;
  onBackToFacility: () => void;
}

export const BookingConfirmationDialog: React.FC<BookingConfirmationDialogProps> = ({
  open,
  onOpenChange,
  parkingLotId,
  confirmation,
  onGoToDashboard,
  onBackToFacility,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isEmailingReceipt, setIsEmailingReceipt] = useState(false);

  const qrToken = confirmation?.qrCode ?? '';

  useEffect(() => {
    let isMounted = true;
    if (!qrToken) {
      return;
    }

    QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
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

  if (!confirmation) return null;

  const { bookingDetails, customerDetails, paymentDetails } = confirmation;
  const entryDate = new Date(bookingDetails.scheduledEntryTime);
  const exitDate = new Date(bookingDetails.scheduledExitTime);
  const paymentDate = paymentDetails?.paymentDate
    ? new Date(paymentDetails.paymentDate)
    : new Date();

  const formatDateTime = (d: Date) =>
    d.toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const hours = Math.floor(bookingDetails.bookingDurationMinutes / 60);
  const mins = bookingDetails.bookingDurationMinutes % 60;
  const durationLabel = `${hours > 0 ? `${hours} hr${hours > 1 ? 's' : ''}` : ''}${
    mins > 0 ? ` ${mins} min` : ''
  }`.trim();

  const taxes = bookingDetails.taxes ?? 0;
  const discountAmount = bookingDetails.discountAmount ?? 0;
  const bookingTypeLabel = bookingDetails.bookingType || 'ONLINE';

  const handleEmailReceipt = async () => {
    setIsEmailingReceipt(true);
    try {
      const res = await emailCustomerBookingReceipt({
        parkingLotId,
        bookingId: confirmation.bookingId,
      });
      toast.success(res.message || `Receipt sent to ${res.email}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not send receipt email right now. Please try again.';
      toast.error(message);
    } finally {
      setIsEmailingReceipt(false);
    }
  };

  const handleDownloadReceipt = () => {
    const printWindow = window.open('', '_blank', 'width=860,height=920');
    if (!printWindow) {
      toast.error('Please allow pop-ups in your browser to download the PDF receipt.');
      return;
    }

    const origin = window.location.origin;
    const documentLogoUrl = `${origin}/brand/document-logo.png`;
    const documentFooterUrl = `${origin}/brand/document-footer.png`;

    const qrImgHtml = qrDataUrl
      ? `<img src="${qrDataUrl}" alt="Booking QR Code" style="width:140px;height:140px;border:1px solid #cbd5e1;border-radius:10px;padding:6px;background:#ffffff;" />`
      : '';

    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ParkEase Receipt — ${confirmation.bookingReference}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 24px;
      line-height: 1.5;
    }
    .receipt-sheet {
      max-width: 780px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .receipt-header {
      background: #ffffff;
      padding: 20px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      border-bottom: 4px solid #1e3a8a;
    }
    .brand-logo-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .brand-logo-img {
      height: 58px;
      width: auto;
      object-fit: contain;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .receipt-title-box {
      text-align: right;
    }
    .status-pill {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .receipt-title {
      font-size: 13px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .receipt-id {
      font-family: monospace;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .receipt-body {
      padding: 22px 28px;
    }
    .qr-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      background: #f0fdf4;
      border: 1.5px dashed #10b981;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .qr-info h3 {
      font-size: 14px;
      font-weight: 800;
      color: #065f46;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .qr-token {
      display: inline-block;
      margin: 6px 0;
      padding: 6px 12px;
      background: #ffffff;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .qr-instruction {
      font-size: 13px;
      font-weight: 700;
      color: #047857;
    }
    .section-block {
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .section-header {
      background: #f8fafc;
      padding: 7px 14px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
    }
    .grid-table td {
      padding: 6.5px 14px;
      font-size: 12.5px;
      border-bottom: 1px solid #f1f5f9;
    }
    .grid-table tr:last-child td {
      border-bottom: none;
    }
    .grid-table td.label {
      color: #64748b;
      width: 42%;
    }
    .grid-table td.val {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .total-row td {
      background: #f0fdf4;
      font-size: 14px !important;
      font-weight: 800 !important;
      color: #065f46 !important;
      border-top: 1px solid #bbf7d0 !important;
    }
    .receipt-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11.5px;
      color: #475569;
    }
    .receipt-footer-text {
      padding: 14px 28px 10px 28px;
    }
    .receipt-footer-text p + p {
      margin-top: 3px;
    }
    .footer-banner-img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .receipt-sheet { box-shadow: none; border: 1px solid #cbd5e1; }
    }
  </style>
</head>
<body>
  <div class="receipt-sheet">
    <!-- 1. Official Branded Receipt Header (with parkease-document-logo.png) -->
    <div class="receipt-header">
      <div class="brand-logo-wrap">
        <img src="${documentLogoUrl}" alt="ParkEase — Smart Parking Made Simple" class="brand-logo-img" />
        <div class="brand-sub">Smart Parking Management &amp; Reservation System</div>
      </div>
      <div class="receipt-title-box">
        <span class="status-pill">${confirmation.paymentStatus}</span>
        <div class="receipt-title">Official Parking Booking &amp; Payment Receipt</div>
        <div class="receipt-id">${confirmation.bookingReference}</div>
      </div>
    </div>

    <div class="receipt-body">
      <!-- 7. QR Code Section -->
      <div class="qr-banner">
        <div class="qr-info">
          <h3>Digital Entry &amp; Exit QR Pass</h3>
          <div class="qr-token">${confirmation.qrCode || 'N/A'}</div>
          <div class="qr-instruction">Present this QR code at the parking entrance.</div>
          <div style="font-size:11.5px;color:#334155;margin-top:4px;">
            Assigned Bay: <strong>${bookingDetails.slotNumber}</strong> (${bookingDetails.floorName}, Zone ${bookingDetails.zoneCode})
          </div>
        </div>
        ${qrImgHtml}
      </div>

      <!-- 2. Customer Details -->
      <div class="section-block">
        <div class="section-header">Customer Details</div>
        <table class="grid-table">
          <tr>
            <td class="label">Customer Name</td>
            <td class="val">${customerDetails?.fullName || 'ParkEase Customer'}</td>
          </tr>
          <tr>
            <td class="label">Email Address</td>
            <td class="val">${customerDetails?.email || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">Mobile Number</td>
            <td class="val">${customerDetails?.mobileNumber || 'N/A'}</td>
          </tr>
        </table>
      </div>

      <!-- 3. Booking Details -->
      <div class="section-block">
        <div class="section-header">Booking Details</div>
        <table class="grid-table">
          <tr>
            <td class="label">Booking ID</td>
            <td class="val" style="font-family:monospace;">${confirmation.bookingReference}</td>
          </tr>
          <tr>
            <td class="label">Parking Name</td>
            <td class="val">${bookingDetails.facilityName}</td>
          </tr>
          <tr>
            <td class="label">Parking Address</td>
            <td class="val">${bookingDetails.address}</td>
          </tr>
          <tr>
            <td class="label">Slot Number</td>
            <td class="val">${bookingDetails.slotNumber} (${bookingDetails.floorName} • Zone ${bookingDetails.zoneCode})</td>
          </tr>
          <tr>
            <td class="label">Vehicle Number</td>
            <td class="val" style="font-family:monospace;">${bookingDetails.vehicleNumber}</td>
          </tr>
          <tr>
            <td class="label">Vehicle Type</td>
            <td class="val">${bookingDetails.vehicleType}${bookingDetails.vehicleBrand ? ` — ${bookingDetails.vehicleBrand} ${bookingDetails.vehicleModel || ''}` : ''}</td>
          </tr>
          <tr>
            <td class="label">Booking Type</td>
            <td class="val">${bookingTypeLabel}</td>
          </tr>
          <tr>
            <td class="label">Entry Time</td>
            <td class="val">${formatDateTime(entryDate)}</td>
          </tr>
          <tr>
            <td class="label">Exit Time</td>
            <td class="val">${formatDateTime(exitDate)}</td>
          </tr>
          <tr>
            <td class="label">Booking Duration</td>
            <td class="val">${durationLabel}</td>
          </tr>
        </table>
      </div>

      <!-- 4 & 5. Payment Details & Razorpay Payment Details -->
      <div class="section-block">
        <div class="section-header">Payment &amp; Razorpay Verification Details</div>
        <table class="grid-table">
          <tr>
            <td class="label">Payment ID</td>
            <td class="val" style="font-family:monospace;">${paymentDetails?.paymentReference || confirmation.paymentReference}</td>
          </tr>
          <tr>
            <td class="label">Payment Method</td>
            <td class="val">${paymentDetails?.paymentMethod || 'Razorpay'}</td>
          </tr>
          <tr>
            <td class="label">Payment Status</td>
            <td class="val" style="color:#059669;">${confirmation.paymentStatus}</td>
          </tr>
          <tr>
            <td class="label">Transaction Date</td>
            <td class="val">${formatDateTime(paymentDate)}</td>
          </tr>
          <tr>
            <td class="label">Razorpay Order ID</td>
            <td class="val" style="font-family:monospace;">${paymentDetails?.razorpayOrderId || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">Razorpay Payment ID</td>
            <td class="val" style="font-family:monospace;">${paymentDetails?.razorpayPaymentId || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">Payment Verification Reference</td>
            <td class="val" style="font-family:monospace;">${paymentDetails?.paymentVerificationReference || confirmation.transactionId || 'N/A'}</td>
          </tr>
        </table>
      </div>

      <!-- 6. Charges -->
      <div class="section-block">
        <div class="section-header">Charges Breakdown</div>
        <table class="grid-table">
          ${
            typeof bookingDetails.parkingRateAtBooking === 'number'
              ? `<tr>
            <td class="label">Hourly Rate Applied (${bookingDetails.vehicleType})</td>
            <td class="val">₹${bookingDetails.parkingRateAtBooking.toFixed(2)} / hr</td>
          </tr>`
              : ''
          }
          <tr>
            <td class="label">Parking Charges</td>
            <td class="val">₹${bookingDetails.baseAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">Taxes (Included / Applicable)</td>
            <td class="val">₹${taxes.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">Discounts</td>
            <td class="val">-₹${discountAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">Additional Charges</td>
            <td class="val">₹${bookingDetails.additionalCharges.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td class="label">Total Amount Paid</td>
            <td class="val">₹${bookingDetails.totalAmount.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- 8. Official Receipt Footer (with parkease-document-footer.png) -->
    <div class="receipt-footer">
      <div class="receipt-footer-text">
        <p style="font-weight:700;color:#0f172a;">Thank you for choosing ParkEase! Drive safely.</p>
        <p>Support Email: support@parkease.com &nbsp;|&nbsp; Website: www.parkease.com</p>
        <p>Terms &amp; Conditions: Please arrive within the ${bookingDetails.gracePeriodMinutes}-minute grace period. Overstay charges apply after the scheduled exit time.</p>
        <p style="color:#64748b;margin-top:4px;">&copy; ${new Date().getFullYear()} ParkEase Smart Parking Management &amp; Reservation System. All rights reserved.</p>
      </div>
      <img src="${documentFooterUrl}" alt="ParkEase Official Document Footer" class="footer-banner-img" />
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/80 bg-background">
        {/* 1. RECEIPT HEADER (ParkEase Official Document Logo Header per Section 27) */}
        <div className="shrink-0 bg-white dark:bg-slate-950 px-6 py-4 border-b-4 border-primary">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col items-start gap-1">
                <img
                  src="/brand/document-logo.png"
                  alt="ParkEase — Smart Parking Made Simple"
                  className="h-12 w-auto object-contain rounded-md bg-white px-2 py-1"
                />
                <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  Smart Parking Management &amp; Reservation System
                </DialogDescription>
              </div>

              <div className="text-left sm:text-right space-y-1">
                <div className="flex items-center sm:justify-end gap-2">
                  <Badge className="bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {confirmation.paymentStatus}
                  </Badge>
                </div>
                <DialogTitle className="block text-[11px] font-extrabold uppercase tracking-wider text-primary">
                  Official Parking Booking &amp; Payment Receipt
                </DialogTitle>
                <span className="block font-mono text-sm font-extrabold text-foreground">
                  {confirmation.bookingReference}
                </span>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* SCROLLABLE RECEIPT BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 7. QR CODE SECTION + ASSIGNED BAY SUMMARY */}
          <div className="rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
                Confirmed Parking Pass
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-2xl font-extrabold font-mono text-foreground">
                  Bay {bookingDetails.slotNumber}
                </span>
                <Badge variant="outline" className="text-xs font-semibold border-emerald-500/40">
                  {bookingDetails.floorName} • Zone {bookingDetails.zoneCode}
                </Badge>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-0 text-[11px] font-mono">
                  {bookingTypeLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                {bookingDetails.facilityName} — {bookingDetails.address}
              </p>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 pt-1">
                Present this QR code at the parking entrance.
              </p>
            </div>

            {confirmation.qrCode && (
              <div className="flex flex-col items-center bg-white p-3 rounded-xl border border-slate-200 shadow-xs shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code for ${confirmation.bookingReference}`}
                    className="h-28 w-28 object-contain"
                  />
                ) : (
                  <QrCode className="h-20 w-20 text-slate-900 p-2" />
                )}
                <span className="text-[10px] font-mono font-semibold text-slate-700 mt-1.5 max-w-[160px] truncate">
                  {confirmation.qrCode}
                </span>
              </div>
            )}
          </div>

          {/* 2. CUSTOMER DETAILS */}
          <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
            <div className="bg-muted/50 px-4 py-2 border-b border-border/70 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
              <User className="h-3.5 w-3.5 text-primary" />
              Customer Details
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card">
              <div>
                <span className="text-muted-foreground block text-[11px]">Customer Name</span>
                <span className="font-semibold text-foreground">
                  {customerDetails?.fullName || 'ParkEase Customer'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Email Address</span>
                <span className="font-semibold text-foreground break-all">
                  {customerDetails?.email || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Mobile Number</span>
                <span className="font-semibold text-foreground font-mono">
                  {customerDetails?.mobileNumber || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. BOOKING DETAILS */}
          <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
            <div className="bg-muted/50 px-4 py-2 border-b border-border/70 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Booking Details
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 bg-card">
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Booking ID</span>
                <span className="font-mono font-bold text-foreground">
                  {confirmation.bookingReference}
                </span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Booking Type</span>
                <span className="font-semibold text-foreground">{bookingTypeLabel}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Parking Name</span>
                <span className="font-semibold text-foreground">{bookingDetails.facilityName}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Slot Number</span>
                <span className="font-semibold text-foreground">
                  {bookingDetails.slotNumber} ({bookingDetails.floorName}, Zone{' '}
                  {bookingDetails.zoneCode})
                </span>
              </div>
              <div className="sm:col-span-2 flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Parking Address</span>
                <span className="font-medium text-foreground">{bookingDetails.address}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Vehicle Number</span>
                <span className="font-mono font-bold text-foreground">
                  {bookingDetails.vehicleNumber}
                </span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Vehicle Type</span>
                <span className="font-semibold text-foreground">
                  {bookingDetails.vehicleType}
                  {bookingDetails.vehicleBrand
                    ? ` (${bookingDetails.vehicleBrand} ${bookingDetails.vehicleModel || ''})`
                    : ''}
                </span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Entry Time</span>
                <span className="font-semibold text-foreground">{formatDateTime(entryDate)}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Exit Time</span>
                <span className="font-semibold text-foreground">{formatDateTime(exitDate)}</span>
              </div>
              <div className="sm:col-span-2 flex justify-between sm:block pt-1 border-t border-border/50">
                <span className="text-muted-foreground block text-[11px]">Booking Duration</span>
                <span className="font-bold text-primary">{durationLabel}</span>
              </div>
            </div>
          </div>

          {/* 4 & 5. PAYMENT DETAILS & RAZORPAY VERIFICATION DETAILS */}
          <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
            <div className="bg-muted/50 px-4 py-2 border-b border-border/70 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              Payment &amp; Razorpay Verification Details
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 bg-card">
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Payment ID</span>
                <span className="font-mono font-semibold text-foreground">
                  {paymentDetails?.paymentReference || confirmation.paymentReference}
                </span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Payment Method</span>
                <span className="font-semibold text-foreground">
                  {paymentDetails?.paymentMethod || 'Razorpay'}
                </span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Payment Status</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {confirmation.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Transaction Date</span>
                <span className="font-semibold text-foreground">{formatDateTime(paymentDate)}</span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Razorpay Order ID</span>
                <span className="font-mono text-foreground">
                  {paymentDetails?.razorpayOrderId || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground block text-[11px]">Razorpay Payment ID</span>
                <span className="font-mono text-foreground">
                  {paymentDetails?.razorpayPaymentId || 'N/A'}
                </span>
              </div>
              <div className="sm:col-span-2 flex justify-between sm:block pt-1 border-t border-border/50">
                <span className="text-muted-foreground block text-[11px]">
                  Payment Verification Reference
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {paymentDetails?.paymentVerificationReference ||
                    confirmation.transactionId ||
                    'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 6. CHARGES BREAKDOWN */}
          <div className="rounded-xl border border-border/80 overflow-hidden text-xs">
            <div className="bg-muted/50 px-4 py-2 border-b border-border/70 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
              <Receipt className="h-3.5 w-3.5 text-primary" />
              Charges Breakdown
            </div>
            <div className="p-3.5 space-y-2 bg-card">
              {typeof bookingDetails.parkingRateAtBooking === 'number' && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Hourly Rate Applied ({bookingDetails.vehicleType})
                  </span>
                  <span className="font-semibold text-foreground">
                    ₹{bookingDetails.parkingRateAtBooking.toFixed(2)}/hr
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Parking Charges</span>
                <span className="font-semibold text-foreground">
                  ₹{bookingDetails.baseAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taxes (if applicable)</span>
                <span className="font-semibold text-foreground">₹{taxes.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Discounts</span>
                <span className="font-semibold text-foreground">-₹{discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Additional Charges</span>
                <span className="font-semibold text-foreground">
                  ₹{bookingDetails.additionalCharges.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border font-bold text-sm text-emerald-600 dark:text-emerald-400">
                <span>Total Amount</span>
                <span>₹{bookingDetails.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Grace Period Notice */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2.5 text-xs">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">
                {bookingDetails.gracePeriodMinutes}-Minute Entry Grace Period Included
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Please arrive within {bookingDetails.gracePeriodMinutes} minutes of your scheduled
                check-in time. Overstay charges apply after your scheduled check-out time.
              </p>
            </div>
          </div>

          {/* 8. OFFICIAL RECEIPT FOOTER (with parkease-document-footer.png) */}
          <div className="rounded-xl bg-muted/30 border border-border/70 overflow-hidden text-center text-[11px] text-muted-foreground">
            <div className="p-3 space-y-1">
              <p className="font-semibold text-foreground">
                Thank you for choosing ParkEase! Drive safely.
              </p>
              <p>Support: support@parkease.com &nbsp;•&nbsp; Website: www.parkease.com</p>
              <p className="text-[10px]">
                &copy; {new Date().getFullYear()} ParkEase Smart Parking Management &amp;
                Reservation System. All rights reserved.
              </p>
            </div>
            <img
              src="/brand/document-footer.png"
              alt="ParkEase Official Document Footer"
              className="w-full h-auto object-cover block border-t border-border/60"
            />
          </div>
        </div>

        {/* STICKY PAGE 7 ACTION BUTTONS: Download Receipt, Email Receipt, Facility Details, View Booking */}
        <div className="shrink-0 bg-muted/30 px-6 py-3.5 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5 font-semibold bg-background"
              onClick={handleDownloadReceipt}
            >
              <Download className="h-3.5 w-3.5" />
              Download Receipt
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5 font-semibold bg-background"
              disabled={isEmailingReceipt}
              onClick={handleEmailReceipt}
            >
              {isEmailingReceipt ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              Email Receipt
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1 sm:flex-initial text-xs"
              onClick={onBackToFacility}
            >
              Facility Details
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5 font-semibold"
              onClick={onGoToDashboard}
            >
              View Booking
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
