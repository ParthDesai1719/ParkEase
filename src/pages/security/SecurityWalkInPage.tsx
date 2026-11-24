import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  ArrowLeft,
  Building2,
  Car,
  Bike,
  Zap,
  Truck,
  Banknote,
  CheckCircle2,
  Printer,
  QrCode,
  RefreshCw,
  Layers,
  ShieldCheck,
  RotateCcw,
  Clock,
  PlusCircle,
  Download,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  securityApi,
  type SecurityAssignedFacility,
  type WalkInAvailableSlotsResult,
  type WalkInTariffResult,
  type WalkInBookingConfirmation,
  type WalkInExtensionQuoteResult,
  type ProcessWalkInExtensionResult,
  type ManualBookingItem,
} from '@/api/security.api';

const LOCAL_STORAGE_KEY = 'parkease_security_active_lot_id';

const VEHICLE_TYPES = [
  { id: 'Car', label: 'Car / Sedan', icon: Car, rateMul: 1.0 },
  { id: 'Bike', label: 'Motorbike / Scooter', icon: Bike, rateMul: 0.5 },
  { id: 'EV', label: 'Electric Vehicle', icon: Zap, rateMul: 1.0 },
  { id: 'SUV', label: 'SUV / Heavy', icon: Truck, rateMul: 1.2 },
] as const;

const QUICK_DURATIONS = [1, 2, 3, 4, 6, 8, 12, 24];

function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDurationDisplay(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} ${h === 1 ? 'Hour' : 'Hours'}`;
  return `${h}h ${m}m (${hours} hrs)`;
}

export const SecurityWalkInPage: React.FC = () => {
  // Facility Context
  const [facilities, setFacilities] = useState<SecurityAssignedFacility[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
  });
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);

  // Form Fields
  const [customerName, setCustomerName] = useState<string>('');
  const [customerMobile, setCustomerMobile] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<string>('Car');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [entryTime, setEntryTime] = useState<string>(() => toDateTimeLocalString(new Date()));
  const [exitTime, setExitTime] = useState<string>(() => {
    const now = new Date();
    return toDateTimeLocalString(new Date(now.getTime() + 2 * 60 * 60 * 1000));
  });
  const [staffNotes, setStaffNotes] = useState<string>('');

  // Slot Selection Mode
  const [slotSelectionMode, setSlotSelectionMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [availableSlotsData, setAvailableSlotsData] = useState<WalkInAvailableSlotsResult | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);

  // Tariff State
  const [tariff, setTariff] = useState<WalkInTariffResult | null>(null);
  const [isLoadingTariff, setIsLoadingTariff] = useState<boolean>(false);

  // Cash Confirmation Gate
  const [cashConfirmed, setCashConfirmed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const user = useAuthStore((s) => s.user);

  // Success Confirmation State
  const [confirmedBooking, setConfirmedBooking] = useState<WalkInBookingConfirmation | null>(null);

  // Walk-in Mode: Register or Extend
  const [walkInMode, setWalkInMode] = useState<'REGISTER' | 'EXTEND'>('REGISTER');

  // Extension Flow State
  const [extSearchQuery, setExtSearchQuery] = useState('');
  const [isSearchingActive, setIsSearchingActive] = useState(false);
  const [activeWalkIns, setActiveWalkIns] = useState<ManualBookingItem[]>([]);
  const [selectedExtBooking, setSelectedExtBooking] = useState<ManualBookingItem | null>(null);
  const [extMinutes, setExtMinutes] = useState<number>(60);
  const [isCustomExt, setIsCustomExt] = useState(false);
  const [customExtInput, setCustomExtInput] = useState('60');
  const [extQuote, setExtQuote] = useState<WalkInExtensionQuoteResult | null>(null);
  const [isLoadingExtQuote, setIsLoadingExtQuote] = useState(false);
  const [extCashConfirmed, setExtCashConfirmed] = useState(false);
  const [staffExtNotes, setStaffExtNotes] = useState('');
  const [isSubmittingExt, setIsSubmittingExt] = useState(false);
  const [extResult, setExtResult] = useState<ProcessWalkInExtensionResult | null>(null);

  // Active facility detection & EV availability
  const activeFacility = facilities.find((f) => f.parkingLotId === selectedLotId);
  const isEvAvailable = Boolean(
    activeFacility &&
    ((activeFacility.totalEvSlots ?? 0) > 0 || activeFacility.amenities?.includes('EV Charging'))
  );

  useEffect(() => {
    if (vehicleType === 'EV' && !isEvAvailable) {
      setVehicleType('Car');
    }
  }, [vehicleType, isEvAvailable]);

  // Quick & Custom Duration Handlers
  const handleQuickDuration = (hrs: number) => {
    setDurationHours(hrs);
    const start = entryTime ? new Date(entryTime) : new Date();
    const end = new Date(start.getTime() + hrs * 60 * 60 * 1000);
    setExitTime(toDateTimeLocalString(end));
  };

  const handleEntryTimeChange = (val: string) => {
    setEntryTime(val);
    const start = new Date(val);
    const end = new Date(exitTime);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() > start.getTime()) {
      const diffHours = Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
      setDurationHours(Math.max(0.5, diffHours));
    } else if (!isNaN(start.getTime())) {
      const newEnd = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
      setExitTime(toDateTimeLocalString(newEnd));
    }
  };

  const handleExitTimeChange = (val: string) => {
    setExitTime(val);
    const start = new Date(entryTime);
    const end = new Date(val);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() > start.getTime()) {
      const diffHours = Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
      setDurationHours(Math.max(0.5, diffHours));
    }
  };

  // 1. Load Facilities
  useEffect(() => {
    let isMounted = true;
    async function loadFacilities() {
      try {
        setIsLoadingFacilities(true);
        const facs = await securityApi.getAssignedFacilities();
        if (!isMounted) return;
        setFacilities(facs);

        if (facs.length > 0) {
          const savedLotId = localStorage.getItem(LOCAL_STORAGE_KEY);
          const isValidSaved = savedLotId && facs.some((f) => f.parkingLotId === savedLotId);
          const initialId = isValidSaved ? savedLotId : facs[0].parkingLotId;
          setSelectedLotId(initialId);
          localStorage.setItem(LOCAL_STORAGE_KEY, initialId);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load assigned facilities';
        toast.error(msg);
      } finally {
        if (isMounted) setIsLoadingFacilities(false);
      }
    }

    loadFacilities();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Tariff
  const fetchTariff = useCallback(async () => {
    if (!selectedLotId) return;
    try {
      setIsLoadingTariff(true);
      const res = await securityApi.calculateWalkInTariff({
        parkingLotId: selectedLotId,
        vehicleType,
        durationHours,
        entryTime,
        exitTime,
      });
      setTariff(res);
    } catch (err: unknown) {
      console.warn('Tariff computation failed:', err);
    } finally {
      setIsLoadingTariff(false);
    }
  }, [selectedLotId, vehicleType, durationHours, entryTime, exitTime]);

  // 3. Fetch Available Slots
  const fetchAvailableSlots = useCallback(async () => {
    if (!selectedLotId) return;
    try {
      setIsLoadingSlots(true);
      const res = await securityApi.getWalkInAvailableSlots({
        parkingLotId: selectedLotId,
        vehicleType,
        durationHours,
        entryTime,
        exitTime,
      });
      setAvailableSlotsData(res);

      if (slotSelectionMode === 'AUTO') {
        setSelectedSlotId(res.recommendedSlot ? res.recommendedSlot.slotId : '');
      }
    } catch (err: unknown) {
      console.warn('Slot query failed:', err);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [selectedLotId, vehicleType, durationHours, entryTime, exitTime, slotSelectionMode]);

  // Trigger tariff & slot updates when parameters change
  useEffect(() => {
    if (selectedLotId && !isLoadingFacilities) {
      fetchTariff();
      fetchAvailableSlots();
      setCashConfirmed(false);
    }
  }, [selectedLotId, vehicleType, durationHours, entryTime, exitTime, isLoadingFacilities, fetchTariff, fetchAvailableSlots]);

  // Handle Facility Change
  const handleFacilityChange = (lotId: string) => {
    setSelectedLotId(lotId);
    localStorage.setItem(LOCAL_STORAGE_KEY, lotId);
    setConfirmedBooking(null);
    setSelectedSlotId('');
  };

  // Handle Create Booking Submission
  const handleCreateWalkInBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLotId) {
      toast.error('Please select an active parking facility.');
      return;
    }

    if (!customerName.trim() || customerName.trim().length < 2) {
      toast.error('Please enter a valid customer name (at least 2 characters).');
      return;
    }

    const cleanMobile = customerMobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      toast.error('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    const cleanPlate = vehicleNumber.replace(/[\s-]/g, '').toUpperCase();
    if (!cleanPlate || cleanPlate.length < 5) {
      toast.error('Please enter a valid vehicle registration number.');
      return;
    }

    if (slotSelectionMode === 'MANUAL' && !selectedSlotId) {
      toast.error('Please select a parking bay in manual selection mode.');
      return;
    }

    if (!tariff) {
      toast.error('Tariff not computed. Please refresh.');
      return;
    }

    if (!cashConfirmed) {
      toast.error('You must explicitly confirm physical cash collection before reserving the bay.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await securityApi.createWalkInBooking({
        parkingLotId: selectedLotId,
        customerName: customerName.trim(),
        customerMobile: cleanMobile,
        ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
        vehicleNumber: cleanPlate,
        vehicleType,
        durationHours,
        entryTime,
        exitTime,
        slotSelectionMode,
        ...(slotSelectionMode === 'MANUAL' ? { slotId: selectedSlotId } : {}),
        cashCollected: true,
        cashAmountCollected: tariff.totalAmount,
        ...(staffNotes.trim() ? { staffNotes: staffNotes.trim() } : {}),
      });

      setConfirmedBooking(res);
      toast.success(`Booking ${res.booking.bookingReference} confirmed! Bay ${res.slot.slotNumber} reserved.`);
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to create walk-in booking');
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to register another walk-in
  const handleResetForm = () => {
    const now = new Date();
    setConfirmedBooking(null);
    setCustomerName('');
    setCustomerMobile('');
    setCustomerEmail('');
    setVehicleNumber('');
    setDurationHours(2);
    setEntryTime(toDateTimeLocalString(now));
    setExitTime(toDateTimeLocalString(new Date(now.getTime() + 2 * 60 * 60 * 1000)));
    setStaffNotes('');
    setCashConfirmed(false);
    setSelectedSlotId('');
    fetchAvailableSlots();
  };

  // Trigger Isolated Official ParkEase Receipt Print / PDF Export
  const handlePrintReceipt = () => {
    if (!confirmedBooking) return;

    const printWindow = window.open('', '_blank', 'width=860,height=920');
    if (!printWindow) {
      toast.error('Please allow pop-ups in your browser to print or download the PDF receipt.');
      return;
    }

    const origin = window.location.origin;
    const documentLogoUrl = `${origin}/brand/document-logo.png`;
    const documentFooterUrl = `${origin}/brand/document-footer.png`;

    const formatDateTime = (isoDate?: string | Date | null) => {
      if (!isoDate) return 'N/A';
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    const entryFormatted = formatDateTime(
      confirmedBooking.booking.actualEntryTime || confirmedBooking.booking.scheduledEntryTime,
    );
    const exitFormatted = formatDateTime(confirmedBooking.booking.scheduledExitTime);
    const paymentFormatted = formatDateTime(
      confirmedBooking.payment.paymentDate || confirmedBooking.booking.createdAt,
    );

    const qrImgHtml = confirmedBooking.qrCodeDataUrl
      ? `<img src="${confirmedBooking.qrCodeDataUrl}" alt="Booking QR Pass" style="width:140px;height:140px;border:1px solid #cbd5e1;border-radius:10px;padding:6px;background:#ffffff;" />`
      : '';

    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ParkEase Walk-in Receipt — ${confirmedBooking.receiptNumber}</title>
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
    <div class="receipt-header">
      <div class="brand-logo-wrap">
        <img src="${documentLogoUrl}" alt="ParkEase — Smart Parking Made Simple" class="brand-logo-img" />
        <div class="brand-sub">Smart Parking Management &amp; Reservation System</div>
      </div>
      <div class="receipt-title-box">
        <span class="status-pill">${confirmedBooking.payment.paymentStatus} — CASH COLLECTED</span>
        <div class="receipt-title">Official Walk-in Parking Receipt &amp; Entry Pass</div>
        <div class="receipt-id">${confirmedBooking.receiptNumber}</div>
        <div style="font-family:monospace;font-size:11.5px;color:#64748b;margin-top:2px;">Booking Ref: ${confirmedBooking.booking.bookingReference}</div>
      </div>
    </div>

    <div class="receipt-body">
      <div class="qr-banner">
        <div class="qr-info">
          <h3>Digital Entry &amp; Exit QR Pass</h3>
          <div class="qr-token">${confirmedBooking.booking.bookingReference}</div>
          <div class="qr-instruction">Present this QR pass at the exit barrier upon departure.</div>
          <div style="font-size:12px;color:#334155;margin-top:4px;">
            Assigned Bay: <strong>${confirmedBooking.slot.slotNumber}</strong> (${confirmedBooking.slot.floorName}, Zone ${confirmedBooking.slot.zoneCode})
          </div>
        </div>
        ${qrImgHtml}
      </div>

      <div class="section-block">
        <div class="section-header">Customer Details</div>
        <table class="grid-table">
          <tr>
            <td class="label">Customer Name</td>
            <td class="val">${confirmedBooking.customer.fullName}</td>
          </tr>
          <tr>
            <td class="label">Mobile Number</td>
            <td class="val">${confirmedBooking.customer.mobileNumber}</td>
          </tr>
          <tr>
            <td class="label">Email Address</td>
            <td class="val">${confirmedBooking.customer.email || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label">Customer Category</td>
            <td class="val">Walk-in Motorist (Direct On-site Registration)</td>
          </tr>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">Booking &amp; Bay Allocation Details</div>
        <table class="grid-table">
          <tr>
            <td class="label">Booking ID</td>
            <td class="val" style="font-family:monospace;">${confirmedBooking.booking.bookingReference}</td>
          </tr>
          <tr>
            <td class="label">Parking Facility</td>
            <td class="val">${confirmedBooking.parkingLot.parkingName}</td>
          </tr>
          <tr>
            <td class="label">Facility Address</td>
            <td class="val">${confirmedBooking.parkingLot.address}, ${confirmedBooking.parkingLot.city}</td>
          </tr>
          <tr>
            <td class="label">Assigned Bay</td>
            <td class="val"><strong>Bay ${confirmedBooking.slot.slotNumber}</strong> (${confirmedBooking.slot.floorName} &bull; Zone ${confirmedBooking.slot.zoneCode})</td>
          </tr>
          <tr>
            <td class="label">Vehicle Number</td>
            <td class="val" style="font-family:monospace;font-weight:800;">${confirmedBooking.vehicle.vehicleNumber}</td>
          </tr>
          <tr>
            <td class="label">Vehicle Type</td>
            <td class="val">${confirmedBooking.vehicle.vehicleType}</td>
          </tr>
          <tr>
            <td class="label">Booking Type</td>
            <td class="val">Walk-in Direct Check-in</td>
          </tr>
          <tr>
            <td class="label">Check-in / Entry Time</td>
            <td class="val">${entryFormatted}</td>
          </tr>
          <tr>
            <td class="label">Expected Exit Time</td>
            <td class="val">${exitFormatted}</td>
          </tr>
          <tr>
            <td class="label">Booking Duration</td>
            <td class="val">${confirmedBooking.booking.durationHours} hr(s) (${confirmedBooking.booking.durationMinutes} mins)</td>
          </tr>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">Payment &amp; Security Verification Details</div>
        <table class="grid-table">
          <tr>
            <td class="label">Receipt Number</td>
            <td class="val" style="font-family:monospace;">${confirmedBooking.receiptNumber}</td>
          </tr>
          <tr>
            <td class="label">Payment Method</td>
            <td class="val">Cash (Physical Collection at Security Post)</td>
          </tr>
          <tr>
            <td class="label">Payment Status</td>
            <td class="val" style="color:#059669;font-weight:800;">${confirmedBooking.payment.paymentStatus} (Verified)</td>
          </tr>
          <tr>
            <td class="label">Gate Officer</td>
            <td class="val">${user?.fullName || 'Gate Security Officer'} (${user?.role || 'Security Staff'})</td>
          </tr>
          <tr>
            <td class="label">Payment Timestamp</td>
            <td class="val">${paymentFormatted}</td>
          </tr>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">Charges Breakdown</div>
        <table class="grid-table">
          <tr>
            <td class="label">Hourly Rate Applied (${confirmedBooking.vehicle.vehicleType})</td>
            <td class="val">₹${confirmedBooking.booking.hourlyRate.toFixed(2)} / hr</td>
          </tr>
          <tr>
            <td class="label">Parking Charges (${confirmedBooking.booking.durationHours} hrs)</td>
            <td class="val">₹${confirmedBooking.booking.totalAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">Taxes (Included in Tariff)</td>
            <td class="val">₹0.00</td>
          </tr>
          <tr class="total-row">
            <td class="label">Total Cash Collected</td>
            <td class="val">₹${confirmedBooking.booking.totalAmount.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="receipt-footer">
      <div class="receipt-footer-text">
        <p style="font-weight:700;color:#0f172a;">Thank you for choosing ParkEase! Drive safely.</p>
        <p>Support Email: support@parkease.com &nbsp;|&nbsp; Website: www.parkease.com</p>
        <p>Terms &amp; Conditions: Vehicle is authorized for parking until the expected exit time. Overstay charges apply after the scheduled window. Present this pass at the exit barrier upon departure.</p>
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

  const handleSearchActiveWalkIns = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedLotId) return;

    setIsSearchingActive(true);
    try {
      const res = await securityApi.searchManualBookings({
        parkingLotId: selectedLotId,
        query: extSearchQuery.trim() || undefined,
        status: 'Active',
      });
      const walkIns = res.bookings.filter((b) => b.bookingType === 'WALK_IN');
      setActiveWalkIns(walkIns);
      if (walkIns.length === 0) {
        toast.info('No active walk-in bookings found matching your search.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to search active walk-in bookings.');
    } finally {
      setIsSearchingActive(false);
    }
  };

  const fetchExtensionQuote = async (bookingId: string, minutes: number) => {
    if (!selectedLotId || minutes <= 0) return;
    setIsLoadingExtQuote(true);
    try {
      const q = await securityApi.getWalkInExtensionQuote({
        parkingLotId: selectedLotId,
        bookingId,
        additionalMinutes: minutes,
      });
      setExtQuote(q);
      if (!q.eligible) {
        toast.error(q.reason || 'This walk-in booking cannot be extended.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to calculate extension quote.');
      setExtQuote(null);
    } finally {
      setIsLoadingExtQuote(false);
    }
  };

  const handleSelectBookingForExtension = (item: ManualBookingItem) => {
    setSelectedExtBooking(item);
    setExtCashConfirmed(false);
    setStaffExtNotes('');
    setExtMinutes(60);
    setIsCustomExt(false);
    setCustomExtInput('60');
    fetchExtensionQuote(item.bookingId, 60);
  };

  const handleProcessWalkInExtension = async () => {
    if (!selectedLotId || !selectedExtBooking || !extQuote || !extQuote.eligible) return;

    if (!extCashConfirmed) {
      toast.error('You must explicitly confirm physical cash collection.');
      return;
    }

    setIsSubmittingExt(true);
    try {
      const res = await securityApi.processWalkInExtension({
        parkingLotId: selectedLotId,
        bookingId: selectedExtBooking.bookingId,
        additionalMinutes: extMinutes,
        amountCollected: extQuote.extensionCharge,
        confirmCashReceived: true,
        notes: staffExtNotes.trim() || undefined,
      });

      setExtResult(res);
      toast.success(res.message || 'Walk-in extension completed successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to extend walk-in booking.');
    } finally {
      setIsSubmittingExt(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Header & Terminal Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Walk-in Driver Registration
              </h1>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-semibold">
                Cash Desk
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              On-site driver registration, mandatory cash-first collection, automated bay allocation, and thermal pass generation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Facility Switcher */}
          {isLoadingFacilities ? (
            <Skeleton className="h-9 w-48 rounded-md" />
          ) : facilities.length > 0 ? (
            <div className="w-56">
              <Select value={selectedLotId} onValueChange={handleFacilityChange}>
                <SelectTrigger className="h-9 text-xs bg-card border-border/80">
                  <Building2 className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Select Facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((fac) => (
                    <SelectItem key={fac.parkingLotId} value={fac.parkingLotId} className="text-xs">
                      {fac.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge variant="destructive" className="text-xs">
              No Active Facility Assigned
            </Badge>
          )}

          <Link to="/security/scan">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-border/80">
              <QrCode className="w-3.5 h-3.5" />
              <span>Gate Scanner</span>
            </Button>
          </Link>

          <Link to="/security/dashboard">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-border/80">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3">
        <button
          type="button"
          onClick={() => {
            setWalkInMode('REGISTER');
            setExtResult(null);
          }}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
            walkInMode === 'REGISTER'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>New Walk-in Registration</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setWalkInMode('EXTEND');
            setConfirmedBooking(null);
          }}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
            walkInMode === 'EXTEND'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Process Walk-in Extension</span>
        </button>
      </div>

      {walkInMode === 'REGISTER' && (
        <>
          {/* 2. SUCCESS CONFIRMATION & RECEIPT VIEW */}
          {confirmedBooking ? (
        <div className="space-y-6">
          <Card className="border-emerald-500/40 bg-emerald-500/10 shadow-lg overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <Badge className="bg-emerald-600 text-white font-bold text-xs uppercase px-2.5 py-0.5">
                        Walk-in Booked & Bay Reserved
                      </Badge>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                        {confirmedBooking.receiptNumber}
                      </Badge>
                    </div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
                      Bay {confirmedBooking.slot.slotNumber} Reserved &bull; {confirmedBooking.vehicle.vehicleNumber}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Physical cash payment of <strong className="text-foreground font-bold">₹{confirmedBooking.payment.amount}</strong> was confirmed. Customer must scan the QR at the entry gate, then at the bay barrier to occupy the bay.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={handlePrintReceipt} variant="outline" size="sm" className="gap-2 text-xs h-9">
                    <Printer className="w-4 h-4" />
                    <span>Print Receipt</span>
                  </Button>
                  <Button onClick={handlePrintReceipt} variant="outline" size="sm" className="gap-2 text-xs h-9">
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </Button>
                  <Button
                    onClick={handleResetForm}
                    size="sm"
                    className="gap-2 text-xs h-9 bg-primary text-primary-foreground font-bold shadow-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Register Another Walk-in</span>
                  </Button>
                </div>
              </div>

              {/* Printable Ticket Card */}
              <div id="printable-receipt" className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-2xl bg-card border border-border/80 shadow-inner">
                {/* QR Pass Column */}
                <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-xl border border-border/60 text-center">
                  <img
                    src={confirmedBooking.qrCodeDataUrl}
                    alt="Booking QR Pass"
                    className="w-48 h-48 rounded-lg shadow-sm border border-border/80 bg-white p-2"
                  />
                  <div className="mt-3 font-mono font-bold text-xs text-foreground tracking-wide">
                    {confirmedBooking.booking.bookingReference}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Present this QR pass at the exit barrier upon departure
                  </p>
                </div>

                {/* Bay & Facility Column */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Allocated Parking Bay
                    </div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {confirmedBooking.slot.slotNumber}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {confirmedBooking.slot.floorName} &bull; Zone {confirmedBooking.slot.zoneCode}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Facility:</span>
                      <strong className="text-foreground">{confirmedBooking.parkingLot.parkingName}</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Customer:</span>
                      <strong className="text-foreground">{confirmedBooking.customer.fullName}</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Mobile:</span>
                      <strong className="text-foreground font-mono">{confirmedBooking.customer.mobileNumber}</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Vehicle:</span>
                      <strong className="text-foreground font-mono">{confirmedBooking.vehicle.vehicleNumber} ({confirmedBooking.vehicle.vehicleType})</strong>
                    </div>
                  </div>
                </div>

                {/* Timing & Payment Column */}
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-3 text-xs">
                    <div className="flex justify-between items-center border-b border-border/60 pb-2">
                      <span className="text-muted-foreground">Cash Paid:</span>
                      <strong className="text-lg font-black text-emerald-500">₹{confirmedBooking.payment.amount}</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Duration:</span>
                      <strong className="text-foreground">{confirmedBooking.booking.durationHours} Hours</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Entry Time:</span>
                      <strong className="text-foreground">
                        {new Date(confirmedBooking.booking.scheduledEntryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Valid Until:</span>
                      <strong className="text-foreground">
                        {new Date(confirmedBooking.booking.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Grace Period:</span>
                      <strong className="text-foreground">{confirmedBooking.booking.gracePeriodMinutes} mins</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Notice: Bay status is <strong>RESERVED</strong>. Customer must scan this QR at the entry gate and then at the bay barrier; keep it for exit clearance.
                    </span>
                  </div>
                </div>
              </div>

              {/* Reset Trigger */}
              <div className="mt-6 flex justify-end">
                <Button onClick={handleResetForm} variant="outline" className="gap-2 text-xs">
                  <RotateCcw className="w-4 h-4" />
                  <span>Register Another Walk-in Driver</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* 3. WALK-IN REGISTRATION FORM */
        <form onSubmit={handleCreateWalkInBooking} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: Registration Details & Bay Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Customer & Vehicle Information */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/80">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>Driver & Vehicle Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="custName" className="text-xs font-semibold">
                      Customer Name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="custName"
                      placeholder="e.g. Ramesh Patel"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="custMobile" className="text-xs font-semibold">
                      Mobile Number <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                        +91
                      </span>
                      <Input
                        id="custMobile"
                        placeholder="9876543210"
                        value={customerMobile}
                        onChange={(e) => setCustomerMobile(e.target.value)}
                        required
                        maxLength={10}
                        className="h-9 text-xs pl-10 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="vehNum" className="text-xs font-semibold">
                      Vehicle Registration Number <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="vehNum"
                      placeholder="e.g. MH02AB1234"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      required
                      className="h-9 text-xs font-mono uppercase tracking-wider"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="custEmail" className="text-xs font-semibold">
                      Email Address <span className="text-muted-foreground text-[10px]">(Optional for Receipt)</span>
                    </Label>
                    <Input
                      id="custEmail"
                      type="email"
                      placeholder="driver@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Vehicle Type Cards */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-semibold">Select Vehicle Type</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {VEHICLE_TYPES.map((vt) => {
                      const Icon = vt.icon;
                      const isEv = vt.id === 'EV';
                      const isAvailable = isEv ? isEvAvailable : true;
                      const isSelected = vehicleType === vt.id && isAvailable;

                      if (!isAvailable) {
                        return (
                          <button
                            key={vt.id}
                            type="button"
                            disabled
                            className="p-3 rounded-xl border border-dashed border-border/60 bg-muted/20 text-muted-foreground/40 cursor-not-allowed opacity-50 select-none pointer-events-none flex flex-col justify-between gap-2"
                          >
                            <Icon className="w-5 h-5 text-muted-foreground/40" />
                            <div>
                              <div className="font-bold text-xs text-muted-foreground">{vt.label}</div>
                              <div className="text-[10px] font-semibold text-rose-500">Not Available</div>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={vt.id}
                          type="button"
                          onClick={() => setVehicleType(vt.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                              : 'border-border/80 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div>
                            <div className="font-bold text-xs text-foreground">{vt.label}</div>
                            <div className="text-[10px] text-muted-foreground">Rate: {vt.rateMul}x</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Duration & Bay Allocation */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/80">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>Parking Duration & Slot Allocation</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Custom Time Range (From & To) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Custom Parking Interval (From & To)</Label>
                    <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30 bg-primary/5">
                      Duration: {formatDurationDisplay(durationHours)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/70">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="walkin-entry-time" className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          <span>Time From (Entry)</span>
                        </Label>
                        <button
                          type="button"
                          onClick={() => handleEntryTimeChange(toDateTimeLocalString(new Date()))}
                          className="text-[10px] text-primary hover:underline font-medium"
                        >
                          Set to Now
                        </button>
                      </div>
                      <Input
                        id="walkin-entry-time"
                        type="datetime-local"
                        value={entryTime}
                        onChange={(e) => handleEntryTimeChange(e.target.value)}
                        className="h-9 text-xs font-mono bg-card"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="walkin-exit-time" className="text-xs font-medium flex items-center gap-1.5 text-foreground">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Time To (Expected Exit)</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          +{formatDurationDisplay(durationHours)}
                        </span>
                      </div>
                      <Input
                        id="walkin-exit-time"
                        type="datetime-local"
                        value={exitTime}
                        onChange={(e) => handleExitTimeChange(e.target.value)}
                        className="h-9 text-xs font-mono bg-card"
                      />
                    </div>
                  </div>
                </div>

                {/* Duration Quick Selector */}
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Or Quick Duration Presets</Label>
                    <span className="text-xs text-muted-foreground">Clicking sets exit time automatically</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_DURATIONS.map((hrs) => (
                      <Button
                        key={hrs}
                        type="button"
                        variant={durationHours === hrs ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleQuickDuration(hrs)}
                        className="h-8 px-3 text-xs font-semibold"
                      >
                        {hrs}h
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Allocation Mode Selector: Auto vs Manual */}
                <div className="space-y-3 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Bay Allocation Method</Label>
                    <div className="inline-flex rounded-lg border border-border/80 p-0.5 bg-muted/20">
                      <button
                        type="button"
                        onClick={() => setSlotSelectionMode('AUTO')}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                          slotSelectionMode === 'AUTO'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Auto Assign
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlotSelectionMode('MANUAL')}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                          slotSelectionMode === 'MANUAL'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Manual Pick
                      </button>
                    </div>
                  </div>

                  {/* Mode A: Auto Assign Banner */}
                  {slotSelectionMode === 'AUTO' && (
                    <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>System Automated Bay Allocation</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {availableSlotsData?.recommendedSlot
                            ? `Optimal bay recommended: Bay ${availableSlotsData.recommendedSlot.slotNumber} (${availableSlotsData.recommendedSlot.floorName})`
                            : 'No bays available for this vehicle type.'}
                        </p>
                      </div>
                      {availableSlotsData?.recommendedSlot && (
                        <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-xs font-bold px-2.5 py-1">
                          {availableSlotsData.recommendedSlot.slotNumber}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Mode B: Manual Visual Slot Picker */}
                  {slotSelectionMode === 'MANUAL' && (
                    <div className="space-y-4 p-4 rounded-xl border border-border/80 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Available Bays ({availableSlotsData?.totalAvailableCount || 0} Open)
                        </span>
                        {isLoadingSlots && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      </div>

                      {availableSlotsData && availableSlotsData.groupedByFloor.length > 0 ? (
                        <div className="space-y-4">
                          {availableSlotsData.groupedByFloor.map((floor) => (
                            <div key={floor.floorId} className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                <Layers className="w-3.5 h-3.5" />
                                <span>{floor.floorName}</span>
                              </div>

                              {floor.zones.map((zone) => (
                                <div key={zone.zoneId} className="space-y-1.5 pl-4 border-l-2 border-border/60">
                                  <span className="text-[11px] text-muted-foreground font-semibold">
                                    Zone {zone.zoneCode} &bull; {zone.zoneName}
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {zone.slots.map((slot) => {
                                      const isPicked = selectedSlotId === slot.slotId;
                                      return (
                                        <button
                                          key={slot.slotId}
                                          type="button"
                                          onClick={() => setSelectedSlotId(slot.slotId)}
                                          className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                                            isPicked
                                              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/40'
                                              : 'border-border/80 bg-card hover:border-emerald-500/50 hover:text-emerald-500'
                                          }`}
                                        >
                                          {slot.slotNumber}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No vacant bays available for {vehicleType} for the requested {durationHours} hour window.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Optional Staff Notes */}
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="notes" className="text-xs font-semibold">
                    Operational Gate Notes <span className="text-muted-foreground text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="notes"
                    placeholder="e.g. VIP lane, customer paid with two 100rs notes, etc."
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Live Tariff Breakdown & Mandatory Cash-First Gate */}
          <div className="space-y-6">
            <Card className="border-border/80 shadow-sm sticky top-6">
              <CardHeader className="pb-3 border-b border-border/80">
                <CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-500" />
                    <span>Cash Payment & Tariff</span>
                  </div>
                  {isLoadingTariff && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Live Amount Box */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Total Cash to Collect
                  </span>
                  <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                    ₹{tariff?.totalAmount ?? 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Tariff: ₹{tariff?.hourlyRate ?? 0}/hr &times; {formatDurationDisplay(durationHours)}
                  </div>
                </div>

                {/* Tariff Breakdown Table */}
                <div className="space-y-2 text-xs border-y border-border/60 py-3">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Base Hourly Rate:</span>
                    <strong className="text-foreground">₹{tariff?.hourlyRate ?? 0}</strong>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Selected Vehicle:</span>
                    <strong className="text-foreground">{vehicleType}</strong>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Parking Duration:</span>
                    <strong className="text-foreground">{durationHours} Hours</strong>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Scheduled Exit:</span>
                    <strong className="text-foreground">
                      {tariff?.scheduledExitTime
                        ? new Date(tariff.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Exit Grace Period:</span>
                    <strong className="text-foreground">{tariff?.gracePeriodMinutes ?? 15} mins</strong>
                  </div>
                  {tariff && typeof tariff.platformBookingFee === 'number' && tariff.platformBookingFee > 0 && (
                    <div className="flex justify-between items-center text-primary font-bold">
                      <span>Platform Booking Fee:</span>
                      <strong>₹{tariff.platformBookingFee}</strong>
                    </div>
                  )}
                </div>

                {/* Mandatory Cash Confirmation Checkbox */}
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="cashConfirmCheck"
                      checked={cashConfirmed}
                      onChange={(e) => setCashConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-500 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="cashConfirmCheck" className="text-xs text-foreground leading-relaxed cursor-pointer font-medium select-none">
                      I physically confirmed and collected{' '}
                      <strong className="text-emerald-500 font-bold">₹{tariff?.totalAmount ?? 0} in CASH</strong> from the customer.
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground pl-6">
                    SRS Rule: No bay allocation or confirmation may proceed until cash has been verified in hand.
                  </p>
                </div>

                {/* Confirm and Reserve Button */}
                <Button
                  type="submit"
                  disabled={!cashConfirmed || isSubmitting || !selectedLotId || (slotSelectionMode === 'MANUAL' && !selectedSlotId)}
                  className="w-full h-11 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Confirming & Reserving Bay...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Cash & Reserve Bay</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      )}
        </>
      )}

      {walkInMode === 'EXTEND' && (
        <>
          {extResult ? (
            <Card className="border-emerald-500/40 bg-emerald-500/10 shadow-lg overflow-hidden">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white font-bold text-xs uppercase px-2.5 py-0.5">
                        Walk-in Extension Confirmed
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        Receipt: {extResult.receiptNumber}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                      Session Extended by {extResult.additionalMinutes} Minutes
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Booking Reference: <strong className="text-foreground font-mono">{extResult.bookingReference}</strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-background/80 border border-emerald-500/30 text-xs">
                  <div>
                    <span className="text-muted-foreground">Previous Exit Time</span>
                    <p className="font-bold text-foreground font-mono mt-0.5">
                      {new Date(extResult.previousExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">New Authorized Exit Time</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {new Date(extResult.newExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cash Collected</span>
                    <p className="font-bold text-foreground font-mono mt-0.5">
                      ₹{extResult.amountPaid.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    onClick={() => {
                      setExtResult(null);
                      setSelectedExtBooking(null);
                      setExtQuote(null);
                      setActiveWalkIns([]);
                      setExtSearchQuery('');
                    }}
                    variant="outline"
                    className="gap-2 text-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Process Another Extension</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Search Active Walk-in Bookings */}
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/80">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" />
                    <span>Find Active Walk-in Booking</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <form onSubmit={handleSearchActiveWalkIns} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={extSearchQuery}
                        onChange={(e) => setExtSearchQuery(e.target.value)}
                        placeholder="Search by Vehicle Number (e.g. GJ01AB1234) or Booking Reference..."
                        className="pl-9 h-10 text-xs sm:text-sm bg-background"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isSearchingActive}
                      className="h-10 px-5 text-xs font-semibold gap-2 shrink-0 cursor-pointer"
                    >
                      {isSearchingActive ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Find Booking
                    </Button>
                  </form>

                  {/* Matching Walk-in Bookings */}
                  {activeWalkIns.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Active Walk-in Vehicles ({activeWalkIns.length})
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeWalkIns.map((item) => {
                          const isSelected = selectedExtBooking?.bookingId === item.bookingId;
                          return (
                            <div
                              key={item.bookingId}
                              onClick={() => handleSelectBookingForExtension(item)}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border/80 bg-card hover:bg-muted/40'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono font-bold text-sm text-foreground">
                                  {item.vehicle.vehicleNumber}
                                </span>
                                <Badge className="bg-emerald-600 text-white text-[10px]">
                                  Bay {item.facility.slotNumber}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <p>Ref: <span className="font-mono text-foreground">{item.bookingReference}</span></p>
                                <p>Driver: <span className="text-foreground">{item.customer.fullName} ({item.customer.mobileNumber || 'N/A'})</span></p>
                                <p>Scheduled Exit: <span className="font-mono text-foreground font-semibold">{new Date(item.timing.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Extension Quote & Cash Collection Form */}
              {selectedExtBooking && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="border-border/80 shadow-sm">
                      <CardHeader className="pb-3 border-b border-border/80">
                        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <span>Select Extension Duration</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6 space-y-4">
                        <div className="grid grid-cols-4 gap-2">
                          {[30, 60, 120, 180].map((mins) => {
                            const isSel = !isCustomExt && extMinutes === mins;
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => {
                                  setIsCustomExt(false);
                                  setExtMinutes(mins);
                                  setCustomExtInput(mins.toString());
                                  fetchExtensionQuote(selectedExtBooking.bookingId, mins);
                                }}
                                className={`h-10 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                  isSel
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-background hover:bg-muted/60 border-border text-foreground'
                                }`}
                              >
                                {mins < 60 ? `${mins} Mins` : `${mins / 60} Hour${mins > 60 ? 's' : ''}`}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsCustomExt(true)}
                            className={`text-xs px-3 py-1.5 rounded-md border font-medium cursor-pointer ${
                              isCustomExt
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Custom Minutes:
                          </button>
                          {isCustomExt && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={15}
                                max={720}
                                step={15}
                                value={customExtInput}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setCustomExtInput(val);
                                  const num = parseInt(val, 10);
                                  if (!isNaN(num) && num >= 15 && num <= 720) {
                                    setExtMinutes(num);
                                    fetchExtensionQuote(selectedExtBooking.bookingId, num);
                                  }
                                }}
                                className="w-28 h-8 text-xs font-mono"
                              />
                              <span className="text-xs text-muted-foreground">mins</span>
                            </div>
                          )}
                        </div>

                        {/* Staff Notes */}
                        <div className="space-y-1.5 pt-2">
                          <Label className="text-xs font-medium text-foreground">
                            Security Staff Notes (Optional)
                          </Label>
                          <Input
                            value={staffExtNotes}
                            onChange={(e) => setStaffExtNotes(e.target.value)}
                            placeholder="e.g. Customer extended at gate desk; cash verified."
                            className="h-9 text-xs"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Summary & Cash Confirmation Card */}
                  <div className="space-y-6">
                    <Card className="border-border/80 shadow-md">
                      <CardHeader className="pb-3 border-b border-border/80 bg-muted/20">
                        <CardTitle className="text-sm font-bold text-foreground">
                          Extension Tariff & Cash Confirmation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        {isLoadingExtQuote ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
                            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                            Calculating tariff...
                          </div>
                        ) : extQuote ? (
                          <>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Current Exit:</span>
                                <span className="font-mono font-medium text-foreground">
                                  {new Date(extQuote.currentExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Proposed New Exit:</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {new Date(extQuote.proposedExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Hourly Rate:</span>
                                <span className="font-mono font-medium text-foreground">
                                  ₹{extQuote.ratePerHour}/hr
                                </span>
                              </div>
                              <div className="pt-2 border-t border-border/60 flex justify-between items-center">
                                <span className="font-bold text-foreground">Extension Cash Due:</span>
                                <span className="text-lg font-black text-primary font-mono">
                                  ₹{extQuote.extensionCharge.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Cash Confirmation Checkbox */}
                            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2">
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  id="extCashConfirmCheck"
                                  checked={extCashConfirmed}
                                  onChange={(e) => setExtCashConfirmed(e.target.checked)}
                                  className="mt-0.5 rounded border-amber-500 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                                />
                                <label
                                  htmlFor="extCashConfirmCheck"
                                  className="text-xs text-foreground leading-snug cursor-pointer font-medium select-none"
                                >
                                  I physically collected{' '}
                                  <strong className="text-emerald-600 font-bold">
                                    ₹{extQuote.extensionCharge.toFixed(2)} in CASH
                                  </strong>{' '}
                                  from the customer.
                                </label>
                              </div>
                            </div>

                            <Button
                              onClick={handleProcessWalkInExtension}
                              disabled={!extCashConfirmed || isSubmittingExt || !extQuote.eligible}
                              className="w-full h-11 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 cursor-pointer"
                            >
                              {isSubmittingExt ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Confirming Extension...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Confirm Cash & Extend Bay</span>
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground py-4 text-center">
                            Select a walk-in booking above to view tariff.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
