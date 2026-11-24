import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Building2,
  Search,
  Printer,
  Calendar,
  Car,
  User,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  MapPin,
  CreditCard,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  securityApi,
  type SecurityAssignedFacility,
  type MovementLogItem,
  type MovementLogDetailResult,
  type MovementType,
} from '@/api/security.api';
import { useLiveSync } from '@/hooks/useLiveSync';

const LOCAL_STORAGE_KEY = 'parkease_security_active_lot_id';

export const SecurityMovementLogsPage: React.FC = () => {
  // Current Authenticated User Context
  const user = useAuthStore((s) => s.user);

  // Facility Context
  const [facilities, setFacilities] = useState<SecurityAssignedFacility[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
  });
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);

  // Movement Logs Data
  const [logs, setLogs] = useState<MovementLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [summary, setSummary] = useState({
    total: 0,
    entries: 0,
    exits: 0,
    denied: 0,
    vehiclesInside: 0,
  });
  const [staffList, setStaffList] = useState<Array<{ staffId: string; staffName: string; employeeId: string | null }>>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const pageSize = 12;

  // Filters
  const [search, setSearch] = useState<string>('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selected Log for Detailed Modal Inspection
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<MovementLogDetailResult | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Export States
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  // 1. Fetch assigned facilities on mount
  useEffect(() => {
    let isMounted = true;
    async function loadFacilities() {
      setIsLoadingFacilities(true);
      try {
        const assigned = await securityApi.getAssignedFacilities();
        if (isMounted) {
          setFacilities(assigned);
          if (assigned.length > 0) {
            const currentSelected = localStorage.getItem(LOCAL_STORAGE_KEY);
            const exists = assigned.some((f) => f.parkingLotId === currentSelected);
            if (!exists || !currentSelected) {
              const defaultId = assigned[0].parkingLotId;
              setSelectedLotId(defaultId);
              localStorage.setItem(LOCAL_STORAGE_KEY, defaultId);
            }
          }
        }
      } catch (err: any) {
        toast.error('Failed to load assigned parking facilities.', {
          description: err.response?.data?.message || err.message,
        });
      } finally {
        if (isMounted) setIsLoadingFacilities(false);
      }
    }
    loadFacilities();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFacilityChange = (lotId: string) => {
    setSelectedLotId(lotId);
    localStorage.setItem(LOCAL_STORAGE_KEY, lotId);
    setCurrentPage(1);
  };

  const selectedFacility = useMemo(() => {
    return facilities.find((f) => f.parkingLotId === selectedLotId);
  }, [facilities, selectedLotId]);

  // 2. Query movement logs from backend
  const fetchMovementLogs = useCallback(
    async (pageToLoad: number = 1, isSilent = false) => {
      if (!selectedLotId) return;

      if (!isSilent) setIsLoadingLogs(true);
      try {
        const result = await securityApi.getMovementLogs({
          parkingLotId: selectedLotId,
          page: pageToLoad,
          limit: pageSize,
          search: search.trim() || undefined,
          movementType: movementTypeFilter !== 'ALL' ? movementTypeFilter : undefined,
          staffId: staffFilter !== 'ALL' ? staffFilter : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });

        setLogs(result.logs);
        setSummary(result.summary);
        setStaffList(result.facilityStaffList);
        setTotalPages(result.pagination.totalPages);
        setTotalCount(result.pagination.totalCount);
        setCurrentPage(result.pagination.currentPage);
      } catch (err: any) {
        if (!isSilent) {
          toast.error('Failed to load vehicle movement history.', {
            description: err.response?.data?.message || err.message,
          });
        }
      } finally {
        if (!isSilent) setIsLoadingLogs(false);
      }
    },
    [selectedLotId, search, movementTypeFilter, staffFilter, startDate, endDate, pageSize],
  );

  // Debounce search / filter triggers
  useEffect(() => {
    if (!selectedLotId) return;
    const timer = setTimeout(() => {
      fetchMovementLogs(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchMovementLogs, selectedLotId]);

  // Real-time silent background sync without ghost reload
  useLiveSync(() => {
    if (selectedLotId) void fetchMovementLogs(currentPage, true);
  }, { enabled: Boolean(selectedLotId) });

  // 3. Fetch Single Log Details for Modal
  const handleOpenDetail = async (logId: string) => {
    if (!selectedLotId) return;
    setSelectedLogId(logId);
    setIsLoadingDetail(true);
    setLogDetail(null);
    try {
      const detail = await securityApi.getMovementLogDetail(logId, selectedLotId);
      setLogDetail(detail);
    } catch (err: any) {
      toast.error('Failed to retrieve movement details.', {
        description: err.response?.data?.message || err.message,
      });
      setSelectedLogId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 4. Export CSV Action
  const handleExportCsv = async () => {
    if (!selectedLotId) return;
    setIsExportingCsv(true);
    try {
      const blob = await securityApi.exportMovementLogsCsv({
        parkingLotId: selectedLotId,
        search: search.trim() || undefined,
        movementType: movementTypeFilter !== 'ALL' ? movementTypeFilter : undefined,
        staffId: staffFilter !== 'ALL' ? staffFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `movement-ledger-${selectedLotId}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Movement ledger CSV exported successfully.');
    } catch (err: any) {
      toast.error('Failed to export CSV report.', {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Helper to format timestamps consistently matching Customer Module
  const formatPrintDateTime = (isoDate?: string | Date | null) => {
    if (!isoDate) return 'N/A';
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // 5. Export PDF Action (Isolated Branded Official Manifest Print Window matching Customer Module)
  const handleExportPdf = () => {
    if (!selectedFacility || logs.length === 0) {
      toast.error('No movement records available to export.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=920');
    if (!printWindow) {
      toast.error('Please allow pop-ups in your browser to download or print the PDF manifest.');
      return;
    }

    const origin = window.location.origin;
    const documentLogoUrl = `${origin}/brand/document-logo.png`;
    const documentFooterUrl = `${origin}/brand/document-footer.png`;

    const tableRowsHtml = logs
      .map((log, idx) => {
        const entryFormatted = formatPrintDateTime(log.entryTime);
        const exitFormatted = log.exitTime
          ? formatPrintDateTime(log.exitTime)
          : log.movementType === 'Entry'
            ? '<span style="color:#059669;font-weight:700;">Currently Inside</span>'
            : 'N/A';
        const typeBadgeStyle =
          log.movementType === 'Entry'
            ? 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
            : log.movementType === 'Exit'
              ? 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;'
              : 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;';

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const overstayLabel =
          log.overstayMinutes > 0
            ? `<div style="color:#dc2626;font-size:10px;font-weight:700;">+${log.overstayMinutes}m overstay</div>`
            : '';

        return `<tr style="background:${rowBg};">
          <td style="padding:7px 8px;font-size:11px;font-family:monospace;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0;">${log.movementReference}</td>
          <td style="padding:7px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">
            <div style="font-family:monospace;font-weight:800;color:#0f172a;">${log.vehicleNumber}</div>
            <div style="font-size:10px;color:#64748b;">${log.vehicleType}</div>
          </td>
          <td style="padding:7px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">
            <div style="font-weight:600;color:#0f172a;">${log.customerName}</div>
            <div style="font-size:10px;color:#64748b;font-family:monospace;">${log.customerMobile}</div>
          </td>
          <td style="padding:7px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#0f172a;">${log.slotNumber}</strong>
            <div style="font-size:10px;color:#64748b;">${log.floorName} • ${log.zoneCode}</div>
          </td>
          <td style="padding:7px 8px;text-align:center;border-bottom:1px solid #e2e8f0;">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;${typeBadgeStyle}">
              ${log.movementType.replace('_', ' ')}
            </span>
          </td>
          <td style="padding:7px 8px;font-size:10.5px;color:#334155;border-bottom:1px solid #e2e8f0;">
            <div>${entryFormatted}</div>
            <div style="font-size:10px;color:#64748b;">${log.verifiedByName || 'Gate Staff'} (${log.entryMethod})</div>
          </td>
          <td style="padding:7px 8px;font-size:10.5px;color:#334155;border-bottom:1px solid #e2e8f0;">
            <div>${exitFormatted}</div>
            ${log.exitVerifiedByName ? `<div style="font-size:10px;color:#64748b;">${log.exitVerifiedByName} (${log.exitMethod || 'Gate'})</div>` : ''}
          </td>
          <td style="padding:7px 8px;font-size:11px;font-family:monospace;color:#0f172a;border-bottom:1px solid #e2e8f0;">
            <div>${log.formattedDuration}</div>
            ${overstayLabel}
          </td>
        </tr>`;
      })
      .join('');

    const manifestHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ParkEase Movement Ledger — ${selectedFacility.parkingName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 24px;
      line-height: 1.4;
    }
    .report-sheet {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .report-header {
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
      height: 56px;
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
    .report-title-box {
      text-align: right;
    }
    .status-pill {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #93c5fd;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .report-title {
      font-size: 13px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .report-facility {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .report-body {
      padding: 20px 28px;
    }
    .meta-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
      margin-bottom: 3px;
    }
    .meta-val {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .table-container {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
    }
    .manifest-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .manifest-table thead tr {
      background: #1e3a8a;
      color: #ffffff;
    }
    .manifest-table th {
      padding: 8px 8px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-right: 1px solid rgba(255, 255, 255, 0.15);
    }
    .manifest-table th:last-child {
      border-right: none;
    }
    .report-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11px;
      color: #475569;
    }
    .report-footer-text {
      padding: 14px 28px 10px 28px;
    }
    .report-footer-text p + p {
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
      .report-sheet { box-shadow: none; border: 1px solid #cbd5e1; max-width: 100%; }
      .manifest-table th { background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="report-sheet">
    <div class="report-header">
      <div class="brand-logo-wrap">
        <img src="${documentLogoUrl}" alt="ParkEase — Smart Parking Made Simple" class="brand-logo-img" />
        <div class="brand-sub">Smart Parking Management &amp; Movement Audit Ledger</div>
      </div>
      <div class="report-title-box">
        <span class="status-pill">Gate Movement Ledger</span>
        <div class="report-title">Official Vehicle Movement Manifest</div>
        <div class="report-facility">${selectedFacility.parkingName}</div>
      </div>
    </div>

    <div class="report-body">
      <div class="meta-cards">
        <div class="meta-card">
          <div class="meta-label">Facility Details</div>
          <div class="meta-val">${selectedFacility.parkingName}</div>
          <div class="meta-sub">${selectedFacility.address || 'Assigned Facility'}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Ledger Scope &amp; Time</div>
          <div class="meta-val">${formatPrintDateTime(new Date())}</div>
          <div class="meta-sub">Type: ${movementTypeFilter} &bull; Page ${currentPage}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Security Auditor</div>
          <div class="meta-val">${user?.fullName || 'Gate Security Officer'}</div>
          <div class="meta-sub">${user?.role || 'Security Staff'} &bull; Gate Verified</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Activity Summary</div>
          <div class="meta-val">${logs.length} of ${totalCount} Movements</div>
          <div class="meta-sub">Inside: ${summary.vehiclesInside} &bull; Exits: ${summary.exits}</div>
        </div>
      </div>

      <div class="table-container">
        <table class="manifest-table">
          <thead>
            <tr>
              <th>Movement ID</th>
              <th>Vehicle</th>
              <th>Customer</th>
              <th>Bay</th>
              <th style="text-align:center;">Type</th>
              <th>Entry Time &amp; Staff</th>
              <th>Exit Time &amp; Staff</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <div class="report-footer">
      <div class="report-footer-text">
        <p style="font-weight:700;color:#0f172a;">Official Gate Movement Audit Report &bull; ParkEase Smart Parking Systems</p>
        <p>Support Email: support@parkease.com &nbsp;|&nbsp; Website: www.parkease.com</p>
        <p>This report contains authenticated gate movement records including license plates, check-in timestamps, bay allocations, and security officer verification.</p>
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
    printWindow.document.write(manifestHtml);
    printWindow.document.close();
  };

  // Helper to Print Single Movement Slip from Inspection Dialog
  const handlePrintSingleLog = (item: typeof logDetail) => {
    if (!item) return;

    const printWindow = window.open('', '_blank', 'width=860,height=920');
    if (!printWindow) {
      toast.error('Please allow pop-ups in your browser to print the movement verification slip.');
      return;
    }

    const origin = window.location.origin;
    const documentLogoUrl = `${origin}/brand/document-logo.png`;
    const documentFooterUrl = `${origin}/brand/document-footer.png`;

    const slipHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ParkEase Movement Slip — ${item.movementReference}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 24px;
      line-height: 1.5;
    }
    .slip-sheet {
      max-width: 780px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .slip-header {
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
      height: 56px;
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
    .slip-title-box {
      text-align: right;
    }
    .status-pill {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #93c5fd;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .slip-title {
      font-size: 13px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .slip-id {
      font-family: monospace;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .slip-body {
      padding: 22px 28px;
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
    .slip-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11.5px;
      color: #475569;
    }
    .slip-footer-text {
      padding: 14px 28px 10px 28px;
    }
    .footer-banner-img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .slip-sheet { box-shadow: none; border: 1px solid #cbd5e1; }
    }
  </style>
</head>
<body>
  <div class="slip-sheet">
    <div class="slip-header">
      <div class="brand-logo-wrap">
        <img src="${documentLogoUrl}" alt="ParkEase — Smart Parking Made Simple" class="brand-logo-img" />
        <div class="brand-sub">Smart Parking Management &amp; Reservation System</div>
      </div>
      <div class="slip-title-box">
        <span class="status-pill">${item.movementType.replace('_', ' ')}</span>
        <div class="slip-title">Vehicle Movement Verification Slip</div>
        <div class="slip-id">${item.movementReference}</div>
      </div>
    </div>

    <div class="slip-body">
      <div class="section-block">
        <div class="section-header">Vehicle &amp; Customer Profile</div>
        <table class="grid-table">
          <tr>
            <td class="label">Vehicle Registration Number</td>
            <td class="val" style="font-family:monospace;font-weight:800;">${item.vehicleNumber}</td>
          </tr>
          <tr>
            <td class="label">Vehicle Type</td>
            <td class="val">${item.vehicleType}</td>
          </tr>
          <tr>
            <td class="label">Motorist / Customer</td>
            <td class="val">${item.customerName}</td>
          </tr>
          <tr>
            <td class="label">Mobile Number</td>
            <td class="val" style="font-family:monospace;">${item.customerMobile}</td>
          </tr>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">Facility &amp; Bay Assignment</div>
        <table class="grid-table">
          <tr>
            <td class="label">Parking Facility</td>
            <td class="val">${item.parkingName}</td>
          </tr>
          <tr>
            <td class="label">Allocated Bay</td>
            <td class="val"><strong>Bay ${item.slotNumber}</strong> (${item.floorName} &bull; Zone ${item.zoneCode})</td>
          </tr>
          <tr>
            <td class="label">Booking Reference</td>
            <td class="val" style="font-family:monospace;">${item.bookingReference}</td>
          </tr>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">Gate Movement Timestamps &amp; Guard Attribution</div>
        <table class="grid-table">
          <tr>
            <td class="label">Entry Timestamp &amp; Method</td>
            <td class="val">${formatPrintDateTime(item.entryTime)} (${item.entryMethod})</td>
          </tr>
          <tr>
            <td class="label">Entry Verified By</td>
            <td class="val">${item.verifiedByName || 'Gate Security Officer'}</td>
          </tr>
          <tr>
            <td class="label">Exit Timestamp &amp; Method</td>
            <td class="val">${item.exitTime ? `${formatPrintDateTime(item.exitTime)} (${item.exitMethod || 'Gate'})` : 'Currently Inside'}</td>
          </tr>
          <tr>
            <td class="label">Exit Verified By</td>
            <td class="val">${item.exitVerifiedByName || 'Pending Departure'}</td>
          </tr>
          <tr>
            <td class="label">Stay Duration</td>
            <td class="val">${item.formattedDuration}</td>
          </tr>
          ${item.overstayMinutes > 0 ? `<tr><td class="label" style="color:#dc2626;">Overstay Recorded</td><td class="val" style="color:#dc2626;font-weight:800;">${item.overstayMinutes} minutes</td></tr>` : ''}
          ${item.remarks ? `<tr><td class="label">Gate Officer Remarks</td><td class="val">${item.remarks}</td></tr>` : ''}
        </table>
      </div>
    </div>

    <div class="slip-footer">
      <div class="slip-footer-text">
        <p style="font-weight:700;color:#0f172a;">Official Gate Verification Pass &bull; ParkEase Smart Parking Systems</p>
        <p>Support Email: support@parkease.com &nbsp;|&nbsp; Website: www.parkease.com</p>
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
    printWindow.document.write(slipHtml);
    printWindow.document.close();
  };

  // 6. Reset Filters
  const handleClearFilters = () => {
    setSearch('');
    setMovementTypeFilter('ALL');
    setStaffFilter('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    search || movementTypeFilter !== 'ALL' || staffFilter !== 'ALL' || startDate || endDate,
  );

  // Helper Badge Color
  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case 'Entry':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Entry</span>
          </Badge>
        );
      case 'Exit':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 text-[11px] font-semibold">
            <Clock className="w-3 h-3 text-blue-500" />
            <span>Exit</span>
          </Badge>
        );
      case 'Entry Denied':
        return (
          <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 gap-1 text-[11px] font-semibold">
            <XCircle className="w-3 h-3 text-red-500" />
            <span>Entry Denied</span>
          </Badge>
        );
      case 'Exit Denied':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Exit Denied</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            {type}
          </Badge>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Header & Terminal Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Vehicle Movement Logs
              </h1>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
                Ledger
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historical ledger of physical vehicle arrivals, departures, denied attempts, and stay durations.
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
                <SelectContent className="z-[250]">
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

      {/* 2. KPI Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Movements</p>
              <h3 className="text-2xl font-black tracking-tight text-foreground">{summary.total}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Vehicles Inside</p>
              <h3 className="text-2xl font-black tracking-tight text-emerald-500">{summary.vehiclesInside}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Completed Exits</p>
              <h3 className="text-2xl font-black tracking-tight text-blue-500">{summary.exits}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Denied Attempts</p>
              <h3 className="text-2xl font-black tracking-tight text-red-500">{summary.denied}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Filters, Search, & Export Toolbar */}
      <Card className="border-border/80 bg-card shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search plate, booking ID, customer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Movement Type Filter */}
            <div>
              <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Movement Type" />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  <SelectItem value="ALL" className="text-xs">All Movement Types</SelectItem>
                  <SelectItem value="Entry" className="text-xs">Entry (Active / Inside)</SelectItem>
                  <SelectItem value="Exit" className="text-xs">Exit (Completed)</SelectItem>
                  <SelectItem value="Entry Denied" className="text-xs">Entry Denied</SelectItem>
                  <SelectItem value="Exit Denied" className="text-xs">Exit Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Security Staff Filter */}
            <div>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Security Staff" />
                </SelectTrigger>
                <SelectContent className="z-[250]">
                  <SelectItem value="ALL" className="text-xs">All Staff Members</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.staffId} value={s.staffId} className="text-xs">
                      {s.staffName} {s.employeeId ? `(${s.employeeId})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions: Export Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={isExportingCsv || logs.length === 0}
                className="h-9 gap-1.5 text-xs flex-1 border-border/80"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isExportingCsv ? 'Exporting...' : 'CSV'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={logs.length === 0}
                className="h-9 gap-1.5 text-xs flex-1 border-border/80"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>PDF Report</span>
              </Button>
            </div>
          </div>

          {/* Date Range Sub-Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date Range:</span>
              </div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                Showing <strong className="text-foreground">{logs.length}</strong> of {totalCount} records
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Movement Logs Table */}
      <Card className="border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Movement ID</th>
                <th className="py-3 px-4">Vehicle Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Parking Facility</th>
                <th className="py-3 px-4">Slot</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4">Security Staff</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoadingLogs ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3.5 px-4 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                      <Search className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">No vehicle movements found</p>
                      <p className="text-xs text-muted-foreground">
                        {hasActiveFilters
                          ? 'Try adjusting or clearing your active search filters.'
                          : 'No physical vehicle movements have been recorded for this parking facility yet.'}
                      </p>
                    </div>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs">
                        Clear All Filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const entryFormatted = log.entryTime
                    ? new Date(log.entryTime).toLocaleDateString([], {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A';
                  const entryTimeFormatted = log.entryTime
                    ? new Date(log.entryTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  const exitTimeFormatted = log.exitTime
                    ? new Date(log.exitTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  return (
                    <tr key={log._id} className="hover:bg-muted/20 transition-colors">
                      {/* Movement ID */}
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {log.movementReference}
                      </td>

                      {/* Vehicle Number */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-foreground">{log.vehicleNumber}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {log.vehicleType} {log.vehicleBrand ? `• ${log.vehicleBrand}` : ''}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">{log.customerName}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{log.customerMobile}</div>
                      </td>

                      {/* Parking Lot */}
                      <td className="py-3 px-4 text-foreground font-medium">
                        {log.parkingName}
                      </td>

                      {/* Slot */}
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-mono font-bold text-xs bg-muted/40">
                          {log.slotNumber}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {log.floorName} • Zone {log.zoneCode}
                        </div>
                      </td>

                      {/* Movement Type */}
                      <td className="py-3 px-4">
                        {getMovementBadge(log.movementType)}
                      </td>

                      {/* Security Staff */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">
                          {log.movementType === 'Exit' && log.exitVerifiedByName
                            ? log.exitVerifiedByName
                            : log.verifiedByName || 'Gate Staff'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Method: {log.movementType === 'Exit' ? log.exitMethod || log.entryMethod : log.entryMethod}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4">
                        <div className="text-foreground">{entryFormatted}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {entryTimeFormatted}
                          {exitTimeFormatted ? ` → ${exitTimeFormatted}` : ''}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {log.formattedDuration}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(log._id)}
                          className="h-8 px-2.5 gap-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border/80 bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Page <strong className="text-foreground">{currentPage}</strong> of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMovementLogs(currentPage - 1)}
                disabled={currentPage <= 1 || isLoadingLogs}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMovementLogs(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoadingLogs}
                className="h-8 gap-1 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 5. Detailed Movement Inspection Dialog */}
      <Dialog open={Boolean(selectedLogId)} onOpenChange={(open) => !open && setSelectedLogId(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto z-[250]">
          <DialogHeader className="border-b border-border/80 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2 font-mono">
                  <span>{logDetail?.movementReference || 'Movement Log'}</span>
                  {logDetail && getMovementBadge(logDetail.movementType)}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Recorded physical vehicle entry and exit gate verification audit.
                </DialogDescription>
              </div>
              {logDetail && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handlePrintSingleLog(logDetail)}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 border-border/80"
                  >
                    <Printer className="w-3.5 h-3.5 text-primary" />
                    <span>Print Slip</span>
                  </Button>
                  <Badge variant="outline" className="font-mono text-xs">
                    Booking: {logDetail.bookingReference}
                  </Badge>
                </div>
              )}
            </div>
          </DialogHeader>

          {isLoadingDetail || !logDetail ? (
            <div className="py-12 space-y-4">
              <Skeleton className="h-6 w-3/4 mx-auto" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {/* Top Summary Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Vehicle Card */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <Car className="w-3.5 h-3.5 text-primary" />
                    <span>Vehicle Profile</span>
                  </div>
                  <div className="text-base font-black font-mono text-foreground">{logDetail.vehicleNumber}</div>
                  <div className="text-muted-foreground">
                    {logDetail.vehicleType}
                    {logDetail.vehicleBrand ? ` • ${logDetail.vehicleBrand}` : ''}
                    {logDetail.vehicleModel ? ` ${logDetail.vehicleModel}` : ''}
                  </div>
                </div>

                {/* Customer Card */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>Customer Details</span>
                  </div>
                  <div className="text-base font-bold text-foreground">{logDetail.customerName}</div>
                  <div className="font-mono text-muted-foreground">{logDetail.customerMobile}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{logDetail.customerEmail}</div>
                </div>

                {/* Location Card */}
                <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>Parking Location</span>
                  </div>
                  <div className="text-base font-black text-emerald-500 font-mono">
                    Bay {logDetail.slotNumber}
                  </div>
                  <div className="text-muted-foreground">{logDetail.parkingName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {logDetail.floorName} &bull; Zone {logDetail.zoneCode}
                  </div>
                </div>
              </div>

              {/* Movement Execution Details */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/80 space-y-3 text-xs">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Gate Movement Execution</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Entry Method:</span>
                    <strong className="text-foreground">{logDetail.entryMethod}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Entry Time:</span>
                    <strong className="text-foreground font-mono">
                      {new Date(logDetail.entryTime).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Entry Guard:</span>
                    <strong className="text-foreground">{logDetail.verifiedByName || 'Gate Staff'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Exit Method:</span>
                    <strong className="text-foreground">{logDetail.exitMethod || 'Pending Exit'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Exit Time:</span>
                    <strong className="text-foreground font-mono">
                      {logDetail.exitTime ? new Date(logDetail.exitTime).toLocaleString() : 'Currently Inside'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Exit Guard:</span>
                    <strong className="text-foreground">{logDetail.exitVerifiedByName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Stay Duration:</span>
                    <strong className="text-foreground font-mono">{logDetail.formattedDuration}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Overstay Minutes:</span>
                    <strong className={logDetail.overstayMinutes > 0 ? 'text-red-500 font-bold' : 'text-foreground'}>
                      {logDetail.overstayMinutes} mins
                    </strong>
                  </div>
                </div>

                {logDetail.remarks && (
                  <div className="mt-3 p-2.5 rounded-lg bg-background border border-border/60 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Remarks: </span>
                    {logDetail.remarks}
                  </div>
                )}
              </div>

              {/* Linked Booking & Payment Details */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/80 space-y-3 text-xs">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>Booking & Financial Ledger</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Booking Type:</span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {logDetail.booking.bookingType}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Booking Status:</span>
                    <Badge className="text-[10px] font-bold bg-primary/20 text-primary border-primary/30">
                      {logDetail.booking.bookingStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Paid:</span>
                    <strong className="text-emerald-500 font-bold text-sm">₹{logDetail.booking.totalAmount}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Overstay Fee:</span>
                    <strong className="text-foreground">₹{logDetail.booking.overstayCharge}</strong>
                  </div>
                </div>

                {/* Payments Table */}
                {logDetail.payments.length > 0 && (
                  <div className="mt-3 border border-border/60 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2 px-3">Payment Ref</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {logDetail.payments.map((p) => (
                          <tr key={p._id}>
                            <td className="py-2 px-3 font-mono">{p.paymentReference}</td>
                            <td className="py-2 px-3">{p.paymentType}</td>
                            <td className="py-2 px-3">{p.paymentMethod}</td>
                            <td className="py-2 px-3">
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
                                {p.paymentStatus}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-foreground">₹{p.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Booking Event Timeline */}
              {logDetail.timeline.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Booking Event Timeline</span>
                  </h4>
                  <div className="space-y-2 border-l-2 border-primary/30 pl-4 ml-2">
                    {logDetail.timeline.map((event) => (
                      <div key={event._id} className="relative text-xs space-y-0.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary absolute -left-[21px] top-1" />
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-foreground">{event.eventTitle || event.eventType}</strong>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(event.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{event.eventDescription}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Printable Manifest Layout (Only visible during native browser Ctrl+P fallback) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-manifest, #printable-manifest * {
            visibility: visible !important;
          }
          #printable-manifest {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            display: block !important;
          }
        }
      `}</style>
      <div id="printable-manifest" className="hidden print:block space-y-6 p-6 bg-white text-black text-xs">
        <div className="border-b pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black">ParkEase &bull; Vehicle Movement Manifest</h1>
              <p className="text-sm font-semibold">{selectedFacility?.parkingName || 'Parking Facility'}</p>
              <p className="text-xs text-gray-600">Generated on: {new Date().toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">Total Records: {logs.length}</p>
              <p className="text-xs text-gray-600">Vehicles Inside: {summary.vehiclesInside}</p>
              <p className="text-xs text-gray-600">Exits: {summary.exits}</p>
            </div>
          </div>
        </div>

        <table className="w-full text-left border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 font-bold">
              <th className="p-2 border border-gray-300">Movement ID</th>
              <th className="p-2 border border-gray-300">Vehicle</th>
              <th className="p-2 border border-gray-300">Customer</th>
              <th className="p-2 border border-gray-300">Bay</th>
              <th className="p-2 border border-gray-300">Type</th>
              <th className="p-2 border border-gray-300">Staff</th>
              <th className="p-2 border border-gray-300">Entry Time</th>
              <th className="p-2 border border-gray-300">Exit Time</th>
              <th className="p-2 border border-gray-300">Duration</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-gray-200">
                <td className="p-2 border border-gray-300 font-mono">{log.movementReference}</td>
                <td className="p-2 border border-gray-300 font-mono font-bold">{log.vehicleNumber}</td>
                <td className="p-2 border border-gray-300">{log.customerName}</td>
                <td className="p-2 border border-gray-300 font-mono">{log.slotNumber}</td>
                <td className="p-2 border border-gray-300">{log.movementType}</td>
                <td className="p-2 border border-gray-300">{log.verifiedByName || 'Staff'}</td>
                <td className="p-2 border border-gray-300 font-mono">
                  {log.entryTime ? new Date(log.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </td>
                <td className="p-2 border border-gray-300 font-mono">
                  {log.exitTime ? new Date(log.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Inside'}
                </td>
                <td className="p-2 border border-gray-300 font-mono">{log.formattedDuration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
