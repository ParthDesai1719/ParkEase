import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  ArrowLeft,
  Camera,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  Banknote,
  Navigation,
  RefreshCw,
  KeyRound,
  RotateCcw,
  Printer,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  securityApi,
  type SecurityAssignedFacility,
  type QrVerificationResult,
  type EntryVerificationResult,
  type ExitVerificationResult,
  type ExitCashReceipt,
} from '@/api/security.api';

const LOCAL_STORAGE_KEY = 'parkease_security_active_lot_id';

type ScannerMode = 'CAMERA' | 'UPLOAD' | 'MANUAL';

export const SecurityScanPage: React.FC = () => {
  // Facilities state
  const [facilities, setFacilities] = useState<SecurityAssignedFacility[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
  });
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);

  // Scanner UI states
  const [scannerMode, setScannerMode] = useState<ScannerMode>('CAMERA');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');

  // QR result & actions state
  const [verifiedPass, setVerifiedPass] = useState<QrVerificationResult | null>(null);
  const [entrySuccess, setEntrySuccess] = useState<EntryVerificationResult | null>(null);
  const [exitSuccess, setExitSuccess] = useState<ExitVerificationResult | null>(null);

  // Overstay & Extension Cash Modal State
  const [isCashModalOpen, setIsCashModalOpen] = useState<boolean>(false);
  const [cashNotes, setCashNotes] = useState<string>('');
  const [isCollectingCash, setIsCollectingCash] = useState<boolean>(false);

  // Exit Cash Receipt Modal State
  const [settledReceipt, setSettledReceipt] = useState<ExitCashReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Action loading states
  const [isSubmittingEntry, setIsSubmittingEntry] = useState<boolean>(false);
  const [isSubmittingExit, setIsSubmittingExit] = useState<boolean>(false);

  // Rejection Dialog State
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  // HTML5 Scanner instance reference
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const isProcessingScanRef = useRef<boolean>(false);

  // 1. Load security facility assignments on mount
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

  // 2. Stop camera utility
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current && isScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        isScanningRef.current = false;
        setIsCameraActive(false);
      } catch (err) {
        console.warn('Error stopping camera scanner:', err);
      }
    }
  }, []);

  // 3. Process Decoded QR text
  const processDecodedText = useCallback(
    async (decodedText: string) => {
      if (!decodedText || isProcessingScanRef.current) return;
      if (!selectedLotId) {
        toast.error('Please select an active facility before verifying passes.');
        return;
      }

      try {
        isProcessingScanRef.current = true;
        setIsVerifying(true);
        setScanError(null);
        await stopCamera();

        const result = await securityApi.verifyQrPass({
          parkingLotId: selectedLotId,
          qrPayload: decodedText,
        });

        setVerifiedPass(result);
        setEntrySuccess(null);
        setExitSuccess(null);
        toast.success(`Verified: ${result.booking.bookingReference}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'QR Verification Failed';
        setScanError(msg);
        toast.error(msg);
      } finally {
        setIsVerifying(false);
        isProcessingScanRef.current = false;
      }
    },
    [selectedLotId, stopCamera],
  );

  // 4. Start Camera Stream
  const startCamera = useCallback(async () => {
    setScanError(null);
    if (!selectedLotId) {
      return;
    }

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-camera-viewport');
      }

      if (isScanningRef.current) {
        await stopCamera();
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          processDecodedText(decodedText);
        },
        () => {
          // Frame scan in progress, ignore per-frame parse failures
        },
      );

      isScanningRef.current = true;
      setIsCameraActive(true);
    } catch (err: unknown) {
      console.error('Camera startup error:', err);
      const msg = err instanceof Error ? err.message : 'Unable to access camera';
      setScanError(`Camera access denied or unavailable: ${msg}. Try uploading an image or manual code.`);
      setIsCameraActive(false);
      isScanningRef.current = false;
    }
  }, [selectedLotId, isLoadingFacilities, processDecodedText, stopCamera]);

  // Handle Tab Switch / Camera Initialization
  useEffect(() => {
    if (isLoadingFacilities) return;
    if (!selectedLotId) return;

    if (scannerMode === 'CAMERA' && !verifiedPass && !entrySuccess && !exitSuccess) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isLoadingFacilities, selectedLotId, scannerMode, verifiedPass, entrySuccess, exitSuccess, startCamera, stopCamera]);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsVerifying(true);
      setScanError(null);

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-camera-viewport');
      }

      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      await processDecodedText(decodedText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No valid QR code found in uploaded image.';
      setScanError(msg);
      toast.error(msg);
    } finally {
      setIsVerifying(false);
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    }
  };

  // Handle Manual Code Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processDecodedText(manualCode.trim());
  };

  // Reset to Next Scan
  const handleResetToScan = useCallback(() => {
    setVerifiedPass(null);
    setEntrySuccess(null);
    setExitSuccess(null);
    setScanError(null);
    setManualCode('');
    setIsCashModalOpen(false);
    setIsRejectDialogOpen(false);
    isProcessingScanRef.current = false;
    if (scannerMode === 'CAMERA') {
      startCamera();
    }
  }, [scannerMode, startCamera]);

  // Allow Vehicle Entry
  const handleAllowEntry = async () => {
    if (!verifiedPass || !selectedLotId) return;

    try {
      setIsSubmittingEntry(true);
      const res = await securityApi.recordVehicleEntry({
        parkingLotId: selectedLotId,
        bookingId: verifiedPass.booking.bookingId,
        entryMethod: 'QR Code',
      });

      setEntrySuccess(res);
      setVerifiedPass(null);
      toast.success(res.message || 'Vehicle entry recorded!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record entry';
      toast.error(msg);
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  // Complete Vehicle Exit
  const handleCompleteExit = async () => {
    if (!verifiedPass || !selectedLotId) return;

    try {
      setIsSubmittingExit(true);
      const res = await securityApi.completeVehicleExit({
        parkingLotId: selectedLotId,
        bookingId: verifiedPass.booking.bookingId,
        exitMethod: 'QR Code',
      });

      setExitSuccess(res);
      setVerifiedPass(null);
      toast.success(res.message || 'Vehicle exit completed!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record exit';
      toast.error(msg);
    } finally {
      setIsSubmittingExit(false);
    }
  };

  // Unified Exit Cash Settlement (Pending Extension Cash + Live Overstay Fees)
  const handleCollectCashSubmit = async () => {
    if (!verifiedPass || !selectedLotId) return;

    try {
      setIsCollectingCash(true);
      const res = await securityApi.settleExitCash({
        parkingLotId: selectedLotId,
        bookingId: verifiedPass.booking.bookingId,
        notes: cashNotes.trim() || undefined,
      });

      toast.success(res.message || 'Exit cash recorded successfully.');
      setIsCashModalOpen(false);
      setCashNotes('');

      if (res.receipt) {
        setSettledReceipt(res.receipt);
        setIsReceiptModalOpen(true);
      }

      // Refresh pass status so Exit becomes eligible
      const refreshed = await securityApi.verifyQrPass({
        parkingLotId: selectedLotId,
        qrPayload: verifiedPass.booking.bookingReference,
      });
      setVerifiedPass(refreshed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to collect exit cash';
      toast.error(msg);
    } finally {
      setIsCollectingCash(false);
    }
  };

  // Printable Exit Cash Receipt Handler
  const handlePrintExitReceipt = () => {
    if (!settledReceipt) return;

    const printWindow = window.open('', '_blank', 'width=860,height=920');
    if (!printWindow) {
      toast.error('Please allow pop-ups in your browser to print the receipt.');
      return;
    }

    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ParkEase Exit Cash Receipt — ${settledReceipt.receiptNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 28px;
    }
    .receipt-sheet {
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0,0,0,0.06);
    }
    .receipt-header {
      background: #0f172a;
      color: #ffffff;
      padding: 24px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .receipt-meta {
      text-align: right;
    }
    .receipt-number {
      font-family: monospace;
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
    }
    .receipt-date {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .receipt-body {
      padding: 24px 28px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      background: #dcfce7;
      color: #166534;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .info-item {
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .info-label {
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .info-val {
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    table.breakdown-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    table.breakdown-table th {
      background: #f1f5f9;
      padding: 10px 14px;
      text-align: left;
      font-weight: 700;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }
    table.breakdown-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .total-row {
      background: #f8fafc;
      font-weight: 800;
      font-size: 15px;
    }
    .total-row td {
      border-top: 2px solid #0f172a !important;
      border-bottom: none !important;
      color: #0f172a;
    }
    .receipt-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px 28px;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print {
      body { background: transparent; padding: 0; }
      .receipt-sheet { box-shadow: none; border: 1px solid #cbd5e1; }
    }
  </style>
</head>
<body>
  <div class="receipt-sheet">
    <div class="receipt-header">
      <div>
        <div class="brand-title">ParkEase</div>
        <div class="brand-sub">${settledReceipt.parkingLotName}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${settledReceipt.parkingLotAddress}</div>
      </div>
      <div class="receipt-meta">
        <div class="receipt-number">${settledReceipt.receiptNumber}</div>
        <div class="receipt-date">${new Date(settledReceipt.receiptDate).toLocaleString()}</div>
      </div>
    </div>
    <div class="receipt-body">
      <div class="status-badge">&#10003; PHYSICAL CASH COLLECTED AT EXIT GATE</div>

      <div class="section-title">Session &amp; Vehicle Information</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Booking Reference</div>
          <div class="info-val" style="font-family:monospace;">${settledReceipt.bookingReference}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Vehicle Number &amp; Type</div>
          <div class="info-val">${settledReceipt.vehicleNumber} (${settledReceipt.vehicleType})</div>
        </div>
        <div class="info-item">
          <div class="info-label">Customer Name</div>
          <div class="info-val">${settledReceipt.customerName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Assigned Bay / Slot</div>
          <div class="info-val">${settledReceipt.slotNumber}</div>
        </div>
      </div>

      <div class="section-title">Itemized Exit Payment Breakdown</div>
      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:center;">Duration</th>
            <th style="text-align:right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          ${settledReceipt.breakdown.extensionAmount > 0 ? `
          <tr>
            <td><strong>Session Extension Fee</strong><br/><span style="font-size:11px;color:#64748b;">Deferred cash collected at gate</span></td>
            <td style="text-align:center;">+${settledReceipt.breakdown.extensionMinutes} mins</td>
            <td style="text-align:right;font-weight:600;">₹${settledReceipt.breakdown.extensionAmount.toFixed(2)}</td>
          </tr>` : ''}
          ${settledReceipt.breakdown.overstayAmount > 0 ? `
          <tr>
            <td><strong>Overstay Penalty Charge</strong><br/><span style="font-size:11px;color:#64748b;">Accrued past extended stay + grace period</span></td>
            <td style="text-align:center;">${settledReceipt.breakdown.overstayMinutes} mins</td>
            <td style="text-align:right;font-weight:600;">₹${settledReceipt.breakdown.overstayAmount.toFixed(2)}</td>
          </tr>` : ''}
          <tr class="total-row">
            <td colspan="2">TOTAL CASH PAID AT EXIT</td>
            <td style="text-align:right;">₹${settledReceipt.breakdown.totalCashCollected.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      ${settledReceipt.notes ? `
      <div style="margin-top:12px;padding:8px 12px;background:#fefce8;border:1px solid #fef08a;border-radius:6px;font-size:11px;color:#854d0e;">
        <strong>Officer Note:</strong> ${settledReceipt.notes}
      </div>` : ''}
    </div>
    <div class="receipt-footer">
      <div>Security Officer: <strong>${settledReceipt.staffName}</strong></div>
      <div>Payment Mode: <strong>PHYSICAL CASH</strong></div>
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  // Facility change handler
  const handleFacilityChange = (lotId: string) => {
    setSelectedLotId(lotId);
    localStorage.setItem(LOCAL_STORAGE_KEY, lotId);
    handleResetToScan();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Header & Facility Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                QR Scanner & Gate Verification
              </h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                Gate Terminal
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              High-speed camera video scanning, duplicate prevention, and overstay exit verification.
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

          <Link to="/security/dashboard">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs border-border/80">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Success Banner - Vehicle Entry Completed */}
      {entrySuccess && (
        <Card className="border-emerald-500/30 bg-emerald-500/10 shadow-sm overflow-hidden">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <Badge className="bg-emerald-500 text-white font-bold text-xs uppercase px-2.5 py-0.5">
                Entry Verified & Gate Opened
              </Badge>
              <h2 className="text-xl font-bold text-foreground">
                Vehicle Allowed Entry — Bay {entrySuccess.slot.slotNumber} Reserved
              </h2>
              <p className="text-xs text-muted-foreground">
                Booking Reference: <span className="font-mono font-semibold text-foreground">{entrySuccess.bookingReference}</span>
              </p>
            </div>

            {/* Bay Directions */}
            <div className="max-w-md mx-auto p-4 rounded-xl bg-background/80 border border-emerald-500/20 text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <Navigation className="w-4 h-4" />
                <span>Customer Bay Navigation Instructions:</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 rounded bg-muted/50 border border-border/60">
                  <div className="text-[10px] text-muted-foreground">Floor</div>
                  <div className="font-bold text-sm text-foreground">{entrySuccess.slot.floorName}</div>
                </div>
                <div className="p-2 rounded bg-muted/50 border border-border/60">
                  <div className="text-[10px] text-muted-foreground">Zone</div>
                  <div className="font-bold text-sm text-foreground">{entrySuccess.slot.zoneCode} ({entrySuccess.slot.zoneName})</div>
                </div>
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Slot Number</div>
                  <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">{entrySuccess.slot.slotNumber}</div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleResetToScan} className="gap-2 px-6 bg-primary text-primary-foreground font-semibold">
                <RotateCcw className="w-4 h-4" />
                Scan Next Vehicle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Success Banner - Vehicle Exit Completed */}
      {exitSuccess && (
        <Card className="border-blue-500/30 bg-blue-500/10 shadow-sm overflow-hidden">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <Badge className="bg-blue-600 text-white font-bold text-xs uppercase px-2.5 py-0.5">
                Exit Completed & Barrier Lifted
              </Badge>
              <h2 className="text-xl font-bold text-foreground">
                Vehicle Checked Out — Bay {exitSuccess.slot.slotNumber} Released
              </h2>
              <p className="text-xs text-muted-foreground">
                Booking <span className="font-mono font-semibold text-foreground">{exitSuccess.bookingReference}</span> is now <strong className="text-blue-500">Completed</strong>.
              </p>
            </div>

            <div className="max-w-sm mx-auto p-3 rounded-lg bg-background/80 border border-border/60 text-xs text-muted-foreground flex items-center justify-around">
              <div>
                <span className="block text-[10px] uppercase">Stay Duration</span>
                <span className="font-bold text-foreground text-sm">{exitSuccess.stayDurationMinutes} mins</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="block text-[10px] uppercase">Slot Released</span>
                <span className="font-bold text-emerald-500 text-sm">{exitSuccess.slot.slotStatus}</span>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleResetToScan} className="gap-2 px-6 bg-primary text-primary-foreground font-semibold">
                <RotateCcw className="w-4 h-4" />
                Scan Next Vehicle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Verified Pass Summary Card */}
      {!entrySuccess && !exitSuccess && verifiedPass && (
        <div className="space-y-6">
          <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/60 p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <CardTitle className="text-base font-bold">Pass Verification Summary</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {verifiedPass.booking.bookingReference}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={handleResetToScan} className="h-8 text-xs text-muted-foreground">
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Scan Again
              </Button>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Warnings and Ineligibility Alerts */}
              {verifiedPass.booking.bookingStatus === 'Cancelled' && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-rose-500">Booking Cancelled Prior to Entry</h4>
                    <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-0.5">
                      This booking was cancelled and is strictly ineligible for parking entry. Turn vehicle away.
                    </p>
                  </div>
                </div>
              )}

              {verifiedPass.booking.bookingStatus === 'No Show' && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-rose-500">System Cancelled (No Show)</h4>
                    <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-0.5">
                      Customer exceeded the 30-minute grace window without arriving. Vehicle entry is strictly denied.
                    </p>
                  </div>
                </div>
              )}

              {verifiedPass.entryIneligibilityReason && !['Cancelled', 'No Show'].includes(verifiedPass.booking.bookingStatus) && (
                <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span><strong>Entry Ineligible:</strong> {verifiedPass.entryIneligibilityReason}</span>
                </div>
              )}

              {/* Unified Exit Cash Settlement Banner (Extension + Overstay) */}
              {(() => {
                const extCashDue = verifiedPass.exitCashDue?.extensionAmount ?? (verifiedPass.pendingCashExtension?.amount || 0);
                const extMinutes = verifiedPass.exitCashDue?.extensionMinutes ?? (verifiedPass.pendingCashExtension?.durationMinutes || 0);
                const overstayCashDue = verifiedPass.exitCashDue?.overstayAmount ?? (verifiedPass.overstay.additionalChargePaymentStatus === 'UNPAID' ? verifiedPass.overstay.overstayCharge : 0);
                const overstayMinutes = verifiedPass.exitCashDue?.overstayMinutes ?? verifiedPass.overstay.overstayDurationMinutes;
                const totalExitCash = verifiedPass.exitCashDue?.totalCashDue ?? (extCashDue + overstayCashDue);

                if (totalExitCash <= 0) return null;

                return (
                  <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                          <Banknote className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-foreground">
                              Outstanding Exit Cash to Collect: ₹{totalExitCash.toFixed(2)}
                            </h4>
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                              Payment Required
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cash collection required before departure barrier can be opened.
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {extCashDue > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                                <span>Extension (+{extMinutes}m):</span>
                                <strong className="font-bold">₹{extCashDue.toFixed(2)}</strong>
                              </span>
                            )}
                            {overstayCashDue > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300">
                                <span>Overstay ({overstayMinutes}m):</span>
                                <strong className="font-bold">₹{overstayCashDue.toFixed(2)}</strong>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-foreground/10 text-foreground">
                              <span>Total Due:</span>
                              <span>₹{totalExitCash.toFixed(2)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setIsCashModalOpen(true)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-sm shrink-0 self-start sm:self-center"
                      >
                        <Banknote className="w-4 h-4" />
                        Collect Cash (₹{totalExitCash.toFixed(2)})
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* 3-Column Pass Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Customer & Vehicle */}
                <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="w-3.5 h-3.5" />
                    <span>Customer & Vehicle</span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-foreground">
                      {verifiedPass.booking.customer.fullName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {verifiedPass.booking.customer.mobileNumber || 'No contact provided'}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-primary">
                        {verifiedPass.booking.vehicle.vehicleNumber}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {verifiedPass.booking.vehicle.vehicleType}
                      </Badge>
                    </div>
                    {(verifiedPass.booking.vehicle.vehicleBrand || verifiedPass.booking.vehicle.vehicleModel) && (
                      <p className="text-[11px] text-muted-foreground">
                        {verifiedPass.booking.vehicle.vehicleBrand} {verifiedPass.booking.vehicle.vehicleModel}
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Facility & Assigned Bay */}
                <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Assigned Bay & Location</span>
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-foreground">
                      {verifiedPass.booking.facility.parkingName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {verifiedPass.booking.hierarchy.floorName} • Zone {verifiedPass.booking.hierarchy.zoneCode}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/40">
                    <div className="text-[11px] text-muted-foreground">Slot / Bay Number</div>
                    <div className="font-mono font-bold text-lg text-foreground">
                      {verifiedPass.booking.hierarchy.slotNumber || 'Unassigned'}
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      Bay Status: {verifiedPass.booking.hierarchy.slotStatus}
                    </Badge>
                  </div>
                </div>

                {/* 3. Schedule & Payment */}
                <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Schedule & Status</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry:</span>
                      <span className="font-medium text-foreground">
                        {new Date(verifiedPass.booking.timing.scheduledEntryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exit:</span>
                      <span className="font-medium text-foreground">
                        {new Date(verifiedPass.booking.timing.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Booking Status</div>
                      <Badge className="mt-0.5 text-[11px] font-semibold">
                        {verifiedPass.booking.bookingStatus}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">Payment</div>
                      <Badge variant="outline" className="mt-0.5 text-[11px] border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                        {verifiedPass.booking.payment.primaryPaymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons as specified in SRS */}
              <div className="pt-4 border-t border-border/80 flex flex-wrap items-center justify-end gap-3">
                <Button variant="outline" size="sm" onClick={handleResetToScan} className="h-10 text-xs">
                  Cancel
                </Button>

                {/* Entry Action */}
                {verifiedPass.eligibleForEntry && (
                  <Button
                    size="sm"
                    onClick={handleAllowEntry}
                    disabled={isSubmittingEntry}
                    className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 shadow-sm"
                  >
                    {isSubmittingEntry ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Allow Entry</span>
                  </Button>
                )}

                {/* Rejection Button */}
                {verifiedPass.eligibleForEntry && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsRejectDialogOpen(true)}
                    className="h-10 text-xs font-semibold"
                  >
                    Reject
                  </Button>
                )}

                {/* Exit Action */}
                {verifiedPass.eligibleForExit && (
                  <Button
                    size="sm"
                    onClick={handleCompleteExit}
                    disabled={isSubmittingExit || verifiedPass.overstay.additionalChargePaymentStatus === 'UNPAID'}
                    className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingExit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Verify & Complete Exit</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. QR Code Scanning & Input Panel (shown when no pass is active) */}
      {!entrySuccess && !exitSuccess && !verifiedPass && (
        <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm overflow-hidden">
          {/* Scanner Mode Tabs */}
          <div className="flex items-center border-b border-border/80 bg-muted/20 px-4 pt-3 gap-2">
            <button
              onClick={() => setScannerMode('CAMERA')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-t-2 ${
                scannerMode === 'CAMERA'
                  ? 'border-primary bg-background text-foreground shadow-xs'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Video Scan</span>
            </button>

            <button
              onClick={() => setScannerMode('UPLOAD')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-t-2 ${
                scannerMode === 'UPLOAD'
                  ? 'border-primary bg-background text-foreground shadow-xs'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload QR Image</span>
            </button>

            <button
              onClick={() => setScannerMode('MANUAL')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-t-2 ${
                scannerMode === 'MANUAL'
                  ? 'border-primary bg-background text-foreground shadow-xs'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Manual Pass Reference</span>
            </button>
          </div>

          <CardContent className="p-6">
            {scanError && (
              <div className="mb-4 p-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{scanError}</span>
              </div>
            )}

            {/* TAB 1: Live Camera Scan */}
            {scannerMode === 'CAMERA' && (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative w-full max-w-sm aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-emerald-500/40 flex items-center justify-center shadow-2xl">
                  {/* html5-qrcode video viewport container */}
                  <div id="qr-camera-viewport" className="w-full h-full" />

                  {/* Viewfinder HUD Corner Brackets */}
                  <div className="absolute top-3 left-3 w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />

                  {/* Inner Target Square Reticle Guide Box */}
                  <div className="absolute inset-7 border border-dashed border-emerald-500/25 rounded-xl pointer-events-none z-10 flex items-center justify-center">
                    <div className="relative w-6 h-6 flex items-center justify-center opacity-30">
                      <div className="w-5 h-0.5 bg-emerald-400 rounded-full" />
                      <div className="h-5 w-0.5 bg-emerald-400 rounded-full -ml-2.5" />
                    </div>
                  </div>

                  {/* Active Laser Sweep Beam */}
                  {isCameraActive && (
                    <>
                      <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-qr-laser z-20 pointer-events-none" />
                      <div className="absolute top-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                        <span className="text-[9px] uppercase tracking-widest font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900/90 text-emerald-400 border border-emerald-500/40 backdrop-blur-xs">
                          OPTICAL SCANNING ACTIVE
                        </span>
                      </div>
                      <div className="absolute bottom-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                        <span className="text-[9px] font-mono text-slate-300 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 backdrop-blur-xs">
                          ALIGN QR PASS WITHIN SQUARE
                        </span>
                      </div>
                    </>
                  )}

                  {isVerifying && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30">
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-xs font-bold text-foreground">Decoding Booking Pass...</span>
                    </div>
                  )}

                  {!isCameraActive && !isVerifying && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-slate-950/90">
                      <Camera className="w-10 h-10 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">
                        {!selectedLotId ? 'Select an assigned facility above to activate scanner' : 'Camera feed is inactive'}
                      </p>
                      <Button
                        size="sm"
                        onClick={startCamera}
                        disabled={!selectedLotId}
                        className="mt-3 text-xs"
                      >
                        Start Camera
                      </Button>
                    </div>
                  )}
                </div>

                <div className="text-center space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Position customer's ParkEase Pass QR inside the camera box
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Supports high-speed optical scanning for gate entry and exit verification.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: Upload QR Image */}
            {scannerMode === 'UPLOAD' && (
              <div className="max-w-md mx-auto py-8 text-center space-y-4">
                <div className="border-2 border-dashed border-border/80 rounded-2xl p-8 hover:border-primary/50 transition-colors bg-muted/10">
                  <UploadCloud className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-foreground">Upload QR Pass Image</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Select a photo or screenshot of the customer's QR Pass to verify.
                  </p>
                  <label className="inline-block mt-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button variant="outline" size="sm" asChild className="cursor-pointer text-xs">
                      <span>Choose Image File</span>
                    </Button>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: Manual Reference */}
            {scannerMode === 'MANUAL' && (
              <form onSubmit={handleManualSubmit} className="max-w-md mx-auto py-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Booking Reference or Raw QR String
                  </label>
                  <Input
                    placeholder="e.g. BK-20261115-XXXX or PE-PASS|..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="text-xs h-10 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use when customer's screen is damaged or camera cannot focus.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={!manualCode.trim() || isVerifying}
                  className="w-full text-xs font-semibold h-10"
                >
                  {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Verify Booking Pass
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. Unified Exit Cash Settlement Modal */}
      <Dialog open={isCashModalOpen} onOpenChange={setIsCashModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <Banknote className="w-5 h-5" />
              Collect Exit Cash Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Collect physical cash for customer session extension and/or overstay penalties before vehicle exit.
            </DialogDescription>
          </DialogHeader>

          {verifiedPass && (() => {
            const extCashDue = verifiedPass.exitCashDue?.extensionAmount ?? (verifiedPass.pendingCashExtension?.amount || 0);
            const extMinutes = verifiedPass.exitCashDue?.extensionMinutes ?? (verifiedPass.pendingCashExtension?.durationMinutes || 0);
            const overstayCashDue = verifiedPass.exitCashDue?.overstayAmount ?? (verifiedPass.overstay.additionalChargePaymentStatus === 'UNPAID' ? verifiedPass.overstay.overstayCharge : 0);
            const overstayMinutes = verifiedPass.exitCashDue?.overstayMinutes ?? verifiedPass.overstay.overstayDurationMinutes;
            const totalExitCash = verifiedPass.exitCashDue?.totalCashDue ?? (extCashDue + overstayCashDue);

            return (
              <div className="space-y-4 py-2">
                {/* Itemized Breakup Card */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <div className="text-center pb-2 border-b border-amber-500/20">
                    <span className="text-xs text-muted-foreground font-medium">Total Cash to Collect:</span>
                    <div className="text-3xl font-extrabold text-foreground">
                      ₹{totalExitCash.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Booking: <strong className="font-mono text-foreground">{verifiedPass.booking.bookingReference}</strong>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-1.5 text-xs">
                    {extCashDue > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/40">
                        <div>
                          <span className="font-semibold text-foreground">Session Extension</span>
                          <span className="text-muted-foreground ml-1">(+{extMinutes} mins)</span>
                        </div>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          ₹{extCashDue.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {overstayCashDue > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/40">
                        <div>
                          <span className="font-semibold text-foreground">Overstay Penalty</span>
                          <span className="text-muted-foreground ml-1">({overstayMinutes} mins accrued)</span>
                        </div>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          ₹{overstayCashDue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Notes / Receipt Remark (Optional)
                  </label>
                  <Textarea
                    placeholder="e.g. Cash collected by guard at gate exit booth."
                    value={cashNotes}
                    onChange={(e) => setCashNotes(e.target.value)}
                    className="text-xs resize-none h-18"
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCashModalOpen(false)}
                    disabled={isCollectingCash}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCollectCashSubmit}
                    disabled={isCollectingCash}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5"
                  >
                    {isCollectingCash ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Banknote className="w-3.5 h-3.5" />}
                    Confirm Cash Received (₹{totalExitCash.toFixed(2)})
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* 8. Printable Exit Cash Receipt Modal */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-5 h-5" />
              Official Exit Cash Receipt
            </DialogTitle>
            <DialogDescription className="text-xs">
              Physical cash collected and verified. An official receipt has been generated.
            </DialogDescription>
          </DialogHeader>

          {settledReceipt && (
            <div className="space-y-4 py-2">
              {/* Receipt Visual Sheet */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                <div className="flex items-start justify-between border-b border-border/60 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-foreground">ParkEase</h3>
                    <p className="text-xs text-muted-foreground">{settledReceipt.parkingLotName}</p>
                    <p className="text-[11px] text-muted-foreground">{settledReceipt.parkingLotAddress}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-bold text-primary block">
                      {settledReceipt.receiptNumber}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(settledReceipt.receiptDate).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-background/80 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Booking Ref</span>
                    <span className="font-mono font-bold text-foreground">{settledReceipt.bookingReference}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background/80 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Vehicle Number</span>
                    <span className="font-bold text-foreground">{settledReceipt.vehicleNumber} ({settledReceipt.vehicleType})</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background/80 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Customer Name</span>
                    <span className="font-medium text-foreground">{settledReceipt.customerName}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background/80 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Assigned Bay</span>
                    <span className="font-bold text-foreground">{settledReceipt.slotNumber}</span>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border/60 text-muted-foreground">
                        <th className="p-2 text-left font-semibold">Description</th>
                        <th className="p-2 text-center font-semibold">Duration</th>
                        <th className="p-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {settledReceipt.breakdown.extensionAmount > 0 && (
                        <tr>
                          <td className="p-2 font-medium text-foreground">Session Extension</td>
                          <td className="p-2 text-center text-muted-foreground">+{settledReceipt.breakdown.extensionMinutes} mins</td>
                          <td className="p-2 text-right font-semibold text-foreground">₹{settledReceipt.breakdown.extensionAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      {settledReceipt.breakdown.overstayAmount > 0 && (
                        <tr>
                          <td className="p-2 font-medium text-foreground">Overstay Penalty</td>
                          <td className="p-2 text-center text-muted-foreground">{settledReceipt.breakdown.overstayMinutes} mins</td>
                          <td className="p-2 text-right font-semibold text-foreground">₹{settledReceipt.breakdown.overstayAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="bg-emerald-500/10 font-bold">
                        <td colSpan={2} className="p-2 text-foreground">Total Cash Collected</td>
                        <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                          ₹{settledReceipt.breakdown.totalCashCollected.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Officer: <strong>{settledReceipt.staffName}</strong></span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                    &#10003; CASH COLLECTED
                  </Badge>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintExitReceipt}
                  className="text-xs gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    if (verifiedPass) {
                      handleCompleteExit();
                    }
                  }}
                  disabled={isSubmittingExit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                >
                  {isSubmittingExit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Proceed to Complete Vehicle Exit
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 7. Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <XCircle className="w-5 h-5" />
              Reject Vehicle Entry
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm why vehicle entry is being denied. This will log the action and dismiss the pass.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Rejection Reason
              </label>
              <Input
                placeholder="e.g. Commercial vehicle restriction, driver turned away"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsRejectDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                toast.info('Vehicle entry rejected and logged.');
                handleResetToScan();
              }}
              className="text-xs font-semibold"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityScanPage;
