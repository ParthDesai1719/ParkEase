import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Ban,
  Calendar,
  Car,
  ChevronRight,
  Copy,
  Eye,
  Info,
  Printer,
  RefreshCw,
  Search,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import {
  adminOperationsApi,
  type AdminBookingItem,
  type AdminBookingOverview,
  type AdminBookingDetailData,
  type AdminCancellationDetails,
  type AdminLiveVehicleItem,
  type AdminLiveVehicleOverview,
  type AdminLiveVehicleDetailData,
} from '@/api/adminOperations.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useLiveSync } from '@/hooks/useLiveSync';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createPdfManifestTable,
  openParkEasePdfPrintWindow,
} from '@/lib/pdfThemeHelper';
import { getSocket } from '@/lib/socket';

export const AdminOperationsPage: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab determination: support path-based (/admin/bookings vs /admin/live-vehicles) or query param ?tab=
  const determineInitialTab = (): 'bookings' | 'vehicles' => {
    if (location.pathname.includes('live-vehicles')) return 'vehicles';
    if (location.pathname.includes('bookings')) return 'bookings';
    const queryTab = searchParams.get('tab');
    if (queryTab === 'vehicles') return 'vehicles';
    return 'bookings';
  };

  const [activeTab, setActiveTab] = useState<'bookings' | 'vehicles'>(determineInitialTab);

  // Synchronize tab on URL changes
  useEffect(() => {
    const nextTab = determineInitialTab();
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [location.pathname, searchParams]);

  const handleTabChange = (val: string) => {
    const tabVal = val as 'bookings' | 'vehicles';
    setActiveTab(tabVal);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabVal);
    setSearchParams(nextParams);
  };

  // =========================================================================
  // TAB 1: BOOKING MANAGEMENT STATE
  // =========================================================================
  const [bookingOverview, setBookingOverview] = useState<AdminBookingOverview>({
    totalBookings: 0,
    confirmedBookings: 0,
    activeBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    overstayBookings: 0,
    totalRevenue: 0,
    totalRefunded: 0,
  });
  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState<number>(0);
  const [bookingsTotalPages, setBookingsTotalPages] = useState<number>(1);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  // Booking query filters
  const bookingPage = Number(searchParams.get('b_page')) || 1;
  const bookingLimit = Number(searchParams.get('b_limit')) || 10;
  const bookingSearch = searchParams.get('b_search') || '';
  const bookingStatus = searchParams.get('b_status') || 'ALL';
  const bookingType = searchParams.get('b_type') || 'ALL';
  const bookingPaymentStatus = searchParams.get('b_payStatus') || 'ALL';

  const [bookingSearchInput, setBookingSearchInput] = useState<string>(bookingSearch);

  // 350ms Debounced search for bookings
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bookingSearchInput !== bookingSearch) {
        const next = new URLSearchParams(searchParams);
        if (bookingSearchInput.trim()) {
          next.set('b_search', bookingSearchInput.trim());
        } else {
          next.delete('b_search');
        }
        next.set('b_page', '1');
        setSearchParams(next);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [bookingSearchInput, bookingSearch, searchParams, setSearchParams]);

  // Fetch Booking Overview KPIs
  const fetchBookingOverview = useCallback(async () => {
    try {
      const data = await adminOperationsApi.getBookingOverview();
      setBookingOverview(data);
    } catch (err: unknown) {
      console.warn('Failed to fetch booking overview:', err);
    }
  }, []);

  // Fetch Booking Directory
  const fetchBookings = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setBookingsLoading(true);
      setBookingsError(null);
    }
    try {
      const res = await adminOperationsApi.getBookings({
        page: bookingPage,
        limit: bookingLimit,
        search: bookingSearch || undefined,
        status: bookingStatus !== 'ALL' ? bookingStatus : undefined,
        bookingType: bookingType !== 'ALL' ? bookingType : undefined,
        paymentStatus: bookingPaymentStatus !== 'ALL' ? bookingPaymentStatus : undefined,
      });
      setBookings(res.bookings);
      setBookingsTotal(res.total);
      setBookingsTotalPages(res.totalPages);
    } catch (err: unknown) {
      if (!isSilent) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve bookings list.';
        setBookingsError(msg);
      }
    } finally {
      if (!isSilent) {
        setBookingsLoading(false);
      }
    }
  }, [bookingPage, bookingLimit, bookingSearch, bookingStatus, bookingType, bookingPaymentStatus]);

  // =========================================================================
  // TAB 2: LIVE VEHICLE LOCATOR STATE
  // =========================================================================
  const [vehicleOverview, setVehicleOverview] = useState<AdminLiveVehicleOverview>({
    vehiclesCurrentlyInside: 0,
    vehiclesEnteredToday: 0,
    vehiclesExitedToday: 0,
    averageParkingDurationMinutes: 0,
    longestParkedVehicle: null,
    availableSlots: 0,
    occupiedSlots: 0,
    overstayedVehicles: 0,
  });
  const [vehicles, setVehicles] = useState<AdminLiveVehicleItem[]>([]);
  const [vehiclesTotal, setVehiclesTotal] = useState<number>(0);
  const [vehiclesTotalPages, setVehiclesTotalPages] = useState<number>(1);
  const [vehiclesLoading, setVehiclesLoading] = useState<boolean>(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  // Live Vehicle Query filters
  const vehiclePage = Number(searchParams.get('v_page')) || 1;
  const vehicleLimit = Number(searchParams.get('v_limit')) || 10;
  const vehicleSearch = searchParams.get('v_search') || '';
  const vehicleStatus = searchParams.get('v_status') || 'ALL';
  const vehicleDuration = searchParams.get('v_duration') || 'ALL';

  const [vehicleSearchInput, setVehicleSearchInput] = useState<string>(vehicleSearch);

  // 350ms Debounced search for vehicles
  useEffect(() => {
    const timer = setTimeout(() => {
      if (vehicleSearchInput !== vehicleSearch) {
        const next = new URLSearchParams(searchParams);
        if (vehicleSearchInput.trim()) {
          next.set('v_search', vehicleSearchInput.trim());
        } else {
          next.delete('v_search');
        }
        next.set('v_page', '1');
        setSearchParams(next);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [vehicleSearchInput, vehicleSearch, searchParams, setSearchParams]);

  // Fetch Live Vehicle Overview KPIs
  const fetchVehicleOverview = useCallback(async () => {
    try {
      const data = await adminOperationsApi.getLiveVehiclesOverview();
      setVehicleOverview(data);
    } catch (err: unknown) {
      console.warn('Failed to fetch vehicle overview:', err);
    }
  }, []);

  // Fetch Live Vehicles Table
  const fetchLiveVehicles = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setVehiclesLoading(true);
      setVehiclesError(null);
    }
    try {
      const res = await adminOperationsApi.getLiveVehicles({
        page: vehiclePage,
        limit: vehicleLimit,
        search: vehicleSearch || undefined,
        status: vehicleStatus !== 'ALL' ? (vehicleStatus as any) : undefined,
        duration: vehicleDuration !== 'ALL' ? (vehicleDuration as any) : undefined,
      });
      setVehicles(res.vehicles);
      setVehiclesTotal(res.total);
      setVehiclesTotalPages(res.totalPages);
    } catch (err: unknown) {
      if (!isSilent) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve live vehicles.';
        setVehiclesError(msg);
      }
    } finally {
      if (!isSilent) {
        setVehiclesLoading(false);
      }
    }
  }, [vehiclePage, vehicleLimit, vehicleSearch, vehicleStatus, vehicleDuration]);

  useLiveSync(() => {
    if (activeTab === 'bookings') {
      void fetchBookingOverview();
      void fetchBookings(true);
    } else {
      void fetchVehicleOverview();
      void fetchLiveVehicles(true);
    }
  });

  // Initial and reactive data fetching
  useEffect(() => {
    void fetchBookingOverview();
    void fetchVehicleOverview();
  }, [fetchBookingOverview, fetchVehicleOverview]);

  useEffect(() => {
    if (activeTab === 'bookings') {
      void fetchBookings();
    } else {
      void fetchLiveVehicles();
    }
  }, [activeTab, fetchBookings, fetchLiveVehicles]);

  // Real-time minute timer: refresh live duration calculations every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'vehicles') {
        void fetchLiveVehicles();
        void fetchVehicleOverview();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [activeTab, fetchLiveVehicles, fetchVehicleOverview]);

  // Real-time Socket.IO synchronization
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join_admin');

    const handleBookingUpdate = () => {
      void fetchBookingOverview();
      if (activeTab === 'bookings') void fetchBookings();
    };

    const handleVehicleUpdate = () => {
      void fetchVehicleOverview();
      if (activeTab === 'vehicles') void fetchLiveVehicles();
    };

    socket.on('booking_status_changed', handleBookingUpdate);
    socket.on('slot_status_changed', handleVehicleUpdate);
    socket.on('live_vehicle_update', handleVehicleUpdate);

    return () => {
      socket.off('booking_status_changed', handleBookingUpdate);
      socket.off('slot_status_changed', handleVehicleUpdate);
      socket.off('live_vehicle_update', handleVehicleUpdate);
    };
  }, [activeTab, fetchBookingOverview, fetchBookings, fetchVehicleOverview, fetchLiveVehicles]);

  // =========================================================================
  // MODALS & DETAIL DRAWERS STATE
  // =========================================================================
  // 1. Single Booking Detail Modal
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [bookingDetail, setBookingDetail] = useState<AdminBookingDetailData | null>(null);
  const [bookingDetailLoading, setBookingDetailLoading] = useState<boolean>(false);
  const [bookingDetailError, setBookingDetailError] = useState<string | null>(null);

  const handleOpenBookingDetail = async (id: string) => {
    setSelectedBookingId(id);
    setBookingDetailLoading(true);
    setBookingDetailError(null);
    try {
      const data = await adminOperationsApi.getBookingById(id);
      setBookingDetail(data);
    } catch (err: unknown) {
      setBookingDetailError(err instanceof Error ? err.message : 'Failed to load booking details.');
    } finally {
      setBookingDetailLoading(false);
    }
  };

  // 2. Cancel Booking Modal
  const [cancelTarget, setCancelTarget] = useState<AdminBookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleOpenCancelModal = (item: AdminBookingItem) => {
    setCancelTarget(item);
    setCancelReason('');
    setCancelError(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim() || cancelReason.trim().length < 5) {
      setCancelError('Please enter a mandatory administrative reason of at least 5 characters.');
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await adminOperationsApi.cancelBooking(cancelTarget._id, { reason: cancelReason.trim() });
      setCancelTarget(null);
      void fetchBookingOverview();
      void fetchBookings();
      if (selectedBookingId === cancelTarget._id) {
        void handleOpenBookingDetail(cancelTarget._id);
      }
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // 3. View Cancellation Details Modal
  const [cancellationDetails, setCancellationDetails] = useState<AdminCancellationDetails | null>(null);

  const handleOpenCancellationDetails = async (id: string) => {
    try {
      const data = await adminOperationsApi.getBookingCancellationDetails(id);
      setCancellationDetails(data);
    } catch (err: unknown) {
      console.warn('Failed to load cancellation details:', err);
    }
  };

  // 4. Live Vehicle Detail Modal
  const [selectedVehicleBookingId, setSelectedVehicleBookingId] = useState<string | null>(null);
  const [vehicleDetail, setVehicleDetail] = useState<AdminLiveVehicleDetailData | null>(null);
  const [vehicleDetailLoading, setVehicleDetailLoading] = useState<boolean>(false);
  const [vehicleDetailError, setVehicleDetailError] = useState<string | null>(null);

  const handleOpenVehicleDetail = async (bookingId: string) => {
    setSelectedVehicleBookingId(bookingId);
    setVehicleDetailLoading(true);
    setVehicleDetailError(null);
    try {
      const data = await adminOperationsApi.getLiveVehicleDetails(bookingId);
      setVehicleDetail(data);
    } catch (err: unknown) {
      setVehicleDetailError(err instanceof Error ? err.message : 'Failed to load vehicle details.');
    } finally {
      setVehicleDetailLoading(false);
    }
  };

  // =========================================================================
  // PDF EXPORT HANDLERS (Customer Theme Standard)
  // =========================================================================
  const handlePrintBookingsManifest = () => {
    if (bookings.length === 0) return;

    const rows = bookings.map((b) => {
      let statusStyle = 'background:#f1f5f9;color:#475569;';
      if (b.bookingStatus === 'Confirmed') statusStyle = 'background:#dbeafe;color:#1e40af;';
      if (b.bookingStatus === 'Active') statusStyle = 'background:#dcfce7;color:#166534;';
      if (b.bookingStatus === 'Cancelled') statusStyle = 'background:#fee2e2;color:#991b1b;';
      if (b.bookingStatus === 'Overstay') statusStyle = 'background:#fef3c7;color:#92400e;';

      const statusPill = `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;${statusStyle}">${b.bookingStatus}</span>`;

      return [
        { content: b.bookingReference, isMono: true },
        { content: `<strong>${b.customerId?.fullName || 'Walk-in Customer'}</strong><br/><span style="color:#64748b;font-size:10px;">${b.customerId?.mobileNumber || '—'}</span>` },
        { content: `<strong>${b.vehicleNumber}</strong><br/><span style="color:#64748b;font-size:10px;">${b.vehicleType}</span>`, isMono: true },
        { content: `<strong>${b.parkingLotId?.parkingName || '—'}</strong><br/><span style="color:#64748b;font-size:10px;">Bay ${b.currentSlotId?.slotNumber || '—'}</span>` },
        { content: new Date(b.scheduledEntryTime).toLocaleString(), isMono: true },
        { content: `₹${b.totalAmount.toFixed(2)}`, align: 'right' as const, isMono: true },
        { content: statusPill, align: 'center' as const },
      ];
    });

    const columns = [
      { header: 'Reference ID', width: '15%' },
      { header: 'Customer Details', width: '20%' },
      { header: 'Vehicle Plate', width: '15%' },
      { header: 'Facility & Bay', width: '20%' },
      { header: 'Scheduled Entry', width: '16%' },
      { header: 'Amount', width: '14%', align: 'right' as const },
      { header: 'Status', width: '10%', align: 'center' as const },
    ];

    const tableHtml = createPdfManifestTable(columns, rows);

    openParkEasePdfPrintWindow({
      docTitle: 'Platform Booking Directory Manifest',
      docSubtitle: 'Operations Management — Official Ledger',
      documentId: `BOOKINGS-MANIFEST-${new Date().toISOString().slice(0, 10)}`,
      statusPill: {
        text: `Active Scope: ${bookingStatus} (${bookings.length})`,
        variant: bookingStatus === 'Active' ? 'green' : bookingStatus === 'Cancelled' ? 'red' : 'blue',
      },
      metaCards: [
        { label: 'Total Bookings', value: String(bookingOverview.totalBookings), subtext: 'Platform-wide' },
        { label: 'Active (Inside)', value: String(bookingOverview.activeBookings), subtext: 'Currently inside' },
        { label: 'Upcoming', value: String(bookingOverview.confirmedBookings), subtext: 'Confirmed' },
        { label: 'Platform Revenue', value: `₹${bookingOverview.totalRevenue.toFixed(0)}`, subtext: 'Gross collections' },
      ],
      bodyHtml: `
        <div style="margin-bottom:12px;font-size:12px;color:#475569;display:flex;justify-content:space-between;">
          <div><strong>Filter:</strong> Status: ${bookingStatus} &bull; Type: ${bookingType} &bull; Payment: ${bookingPaymentStatus}</div>
          <div>Page ${bookingPage} of ${bookingsTotalPages} (${bookingsTotal} total entries)</div>
        </div>
        ${tableHtml}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management & Reservation System &bull; Operations Governance',
        'Official ledger manifest exported by authorized Administrator. Confidential financial and customer data.',
      ],
    });
  };

  const handlePrintLiveVehiclesManifest = () => {
    if (vehicles.length === 0) return;

    const rows = vehicles.map((v) => {
      const isOverstay = v.trackingStatus === 'Overstayed';
      const statusPill = `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;${
        isOverstay
          ? 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;'
          : 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
      }">${v.trackingStatus}</span>`;

      const hours = Math.floor(v.liveDurationMinutes / 60);
      const mins = v.liveDurationMinutes % 60;
      const durationText = `${hours > 0 ? `${hours}h ` : ''}${mins}m`;

      return [
        { content: v.vehicleNumber, isMono: true },
        { content: `<strong>${v.customer?.fullName || 'Walk-in'}</strong><br/><span style="color:#64748b;font-size:10px;">${v.customer?.mobileNumber || '—'}</span>` },
        { content: v.vehicleType },
        { content: `<strong>${v.parkingLot?.parkingName || '—'}</strong><br/><span style="color:#64748b;font-size:10px;">${v.slot?.slotNumber || 'Bay'} (${v.floor?.floorName || 'F1'})</span>` },
        { content: new Date(v.entryTime).toLocaleTimeString(), isMono: true },
        { content: durationText, isMono: true, align: 'center' as const },
        { content: v.securityStaff?.fullName || 'Gate Officer', align: 'center' as const },
        { content: statusPill, align: 'center' as const },
      ];
    });

    const columns = [
      { header: 'Vehicle Plate', width: '15%' },
      { header: 'Driver / Customer', width: '18%' },
      { header: 'Type', width: '8%' },
      { header: 'Facility & Bay', width: '22%' },
      { header: 'Entry Time', width: '12%' },
      { header: 'Live Duration', width: '10%', align: 'center' as const },
      { header: 'Gate Officer', width: '15%', align: 'center' as const },
      { header: 'Status', width: '10%', align: 'center' as const },
    ];

    const tableHtml = createPdfManifestTable(columns, rows);

    openParkEasePdfPrintWindow({
      docTitle: 'Platform Live Vehicle Locator Manifest',
      docSubtitle: 'Operations Monitoring — Active In-Facility Vehicles',
      documentId: `LIVE-VEHICLES-${new Date().toISOString().slice(0, 10)}`,
      statusPill: {
        text: `Vehicles Inside: ${vehicles.length}`,
        variant: 'green',
      },
      metaCards: [
        { label: 'Vehicles Inside', value: String(vehicleOverview.vehiclesCurrentlyInside), subtext: 'In parking bays' },
        { label: 'Entered Today', value: String(vehicleOverview.vehiclesEnteredToday), subtext: 'Gate check-ins' },
        { label: 'Exited Today', value: String(vehicleOverview.vehiclesExitedToday), subtext: 'Departures' },
        { label: 'Overstayed', value: String(vehicleOverview.overstayedVehicles), subtext: 'Passed grace period' },
      ],
      bodyHtml: `
        <div style="margin-bottom:12px;font-size:12px;color:#475569;display:flex;justify-content:space-between;">
          <div><strong>Filter:</strong> Status: ${vehicleStatus} &bull; Duration: ${vehicleDuration}</div>
          <div>Page ${vehiclePage} of ${vehiclesTotalPages} (${vehiclesTotal} active vehicles)</div>
        </div>
        ${tableHtml}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management & Reservation System &bull; Live Facility Tracking',
        'Real-time physical parking facility monitoring snapshot. Base data derived from gate barrier scans.',
      ],
    });
  };

  // Helper Badge Renderers
  const renderBookingStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-semibold">
            Confirmed
          </Badge>
        );
      case 'Active':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </Badge>
        );
      case 'Completed':
        return (
          <Badge variant="secondary" className="font-semibold">
            Completed
          </Badge>
        );
      case 'Cancelled':
        return (
          <Badge variant="destructive" className="font-semibold">
            Cancelled
          </Badge>
        );
      case 'No Show':
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold">
            No Show
          </Badge>
        );
      case 'Overstay':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold gap-1">
            <AlertTriangle className="h-3 w-3" />
            Overstay
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderPaymentStatusBadge = (status?: string) => {
    if (!status) return <span className="text-muted-foreground text-xs">—</span>;
    switch (status) {
      case 'SUCCESSFUL':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium text-[11px]">
            Paid
          </Badge>
        );
      case 'REFUNDED':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-medium text-[11px]">
            Refunded
          </Badge>
        );
      case 'CASH_REVERSAL_PENDING':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium text-[11px]">
            Cash Reversal Due
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 font-medium text-[11px]">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-[11px]">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. BREADCRUMBS & OPERATIONS HEADER */}
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/admin/dashboard" className="hover:text-foreground transition-colors">
            Admin Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">Operations</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">
            {activeTab === 'bookings' ? 'Booking Management' : 'Live Vehicle Locator'}
          </span>
        </nav>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                Operations Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Platform-wide facility operations oversight: real-time booking lifecycle, reservations, refunds, and live vehicle tracking.
              </p>
            </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={activeTab === 'bookings' ? handlePrintBookingsManifest : handlePrintLiveVehiclesManifest}
              disabled={activeTab === 'bookings' ? bookings.length === 0 : vehicles.length === 0}
              className="gap-1.5 text-xs h-9"
              title="Export official branded PDF manifest"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>

          </div>
        </div>

        {/* Unified Operations Tabs */}
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <button
            onClick={() => handleTabChange('bookings')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'bookings'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Booking Management
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {bookingOverview.totalBookings}
            </Badge>
          </button>

          <button
            onClick={() => handleTabChange('vehicles')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'vehicles'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            Live Vehicle Locator
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {vehicleOverview.vehiclesCurrentlyInside} Inside
            </Badge>
          </button>
        </div>
      </div>
    </div>

      {/* =================================================================== */}
      {/* 2. TAB 1: BOOKING MANAGEMENT CONTENT */}
      {/* =================================================================== */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {/* Booking KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Total Bookings</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{bookingOverview.totalBookings}</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Upcoming</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{bookingOverview.confirmedBookings}</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Inside
                </p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{bookingOverview.activeBookings}</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Completed</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{bookingOverview.completedBookings}</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Cancelled</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{bookingOverview.cancelledBookings}</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Overstay</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">{bookingOverview.overstayBookings}</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Gross Revenue</p>
                <p className="text-lg font-bold tracking-tight text-foreground mt-0.5">₹{bookingOverview.totalRevenue.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Refunded</p>
                <p className="text-lg font-bold tracking-tight text-foreground mt-0.5">₹{bookingOverview.totalRefunded.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Multi-Criteria Filter Bar */}
          <Card className="border border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Booking ID, Vehicle Plate, Customer, Phone..."
                    value={bookingSearchInput}
                    onChange={(e) => setBookingSearchInput(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                  {bookingSearchInput && (
                    <button
                      onClick={() => setBookingSearchInput('')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Status Filter */}
                  <Select
                    value={bookingStatus}
                    onValueChange={(val) => {
                      const next = new URLSearchParams(searchParams);
                      if (val && val !== 'ALL') next.set('b_status', val);
                      else next.delete('b_status');
                      next.set('b_page', '1');
                      setSearchParams(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs w-[130px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="Confirmed">Confirmed</SelectItem>
                      <SelectItem value="Active">Active (Inside)</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="No Show">No Show</SelectItem>
                      <SelectItem value="Overstay">Overstay</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Booking Type Filter */}
                  <Select
                    value={bookingType}
                    onValueChange={(val) => {
                      const next = new URLSearchParams(searchParams);
                      if (val && val !== 'ALL') next.set('b_type', val);
                      else next.delete('b_type');
                      next.set('b_page', '1');
                      setSearchParams(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs w-[120px]">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="ONLINE">Online</SelectItem>
                      <SelectItem value="WALK_IN">Walk-in</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Payment Status Filter */}
                  <Select
                    value={bookingPaymentStatus}
                    onValueChange={(val) => {
                      const next = new URLSearchParams(searchParams);
                      if (val && val !== 'ALL') next.set('b_payStatus', val);
                      else next.delete('b_payStatus');
                      next.set('b_page', '1');
                      setSearchParams(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs w-[140px]">
                      <SelectValue placeholder="All Payments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Payments</SelectItem>
                      <SelectItem value="SUCCESSFUL">Successful</SelectItem>
                      <SelectItem value="REFUNDED">Refunded</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="CASH_REVERSAL_PENDING">Cash Reversal Due</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Reset Filters */}
                  {(bookingSearch || bookingStatus !== 'ALL' || bookingType !== 'ALL' || bookingPaymentStatus !== 'ALL') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBookingSearchInput('');
                        const next = new URLSearchParams(searchParams);
                        next.delete('b_search');
                        next.delete('b_status');
                        next.delete('b_type');
                        next.delete('b_payStatus');
                        next.set('b_page', '1');
                        setSearchParams(next);
                      }}
                      className="text-xs h-9 px-2 text-muted-foreground"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bookings Directory Table */}
          <Card className="border border-border/60">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Reference ID</th>
                      <th className="px-4 py-3 font-semibold">Customer Details</th>
                      <th className="px-4 py-3 font-semibold">Vehicle</th>
                      <th className="px-4 py-3 font-semibold">Facility &amp; Bay</th>
                      <th className="px-4 py-3 font-semibold">Timing Window</th>
                      <th className="px-4 py-3 font-semibold text-right">Amount</th>
                      <th className="px-4 py-3 font-semibold text-center">Payment</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {bookingsLoading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          Loading booking records...
                        </td>
                      </tr>
                    ) : bookingsError ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-rose-500">
                          {bookingsError}
                        </td>
                      </tr>
                    ) : bookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          No bookings found matching current filters.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => (
                        <tr key={b._id} className="hover:bg-muted/30 transition-colors">
                          {/* Reference */}
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">
                            <div className="flex items-center gap-1">
                              <span>{b.bookingReference}</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(b.bookingReference)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy Booking Reference"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-sans">
                              {b.bookingType === 'WALK_IN' ? 'Walk-in' : 'Online'}
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{b.customerId?.fullName || 'Walk-in Guest'}</div>
                            <div className="text-[11px] text-muted-foreground">{b.customerId?.mobileNumber || '—'}</div>
                          </td>

                          {/* Vehicle */}
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold bg-muted/60 px-2 py-0.5 rounded text-[11px] text-foreground">
                              {b.vehicleNumber}
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{b.vehicleType}</div>
                          </td>

                          {/* Facility & Bay */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{b.parkingLotId?.parkingName || '—'}</div>
                            <div className="text-[11px] text-muted-foreground">
                              Bay {b.currentSlotId?.slotNumber || '—'} ({b.floorId?.floorName || 'F1'} &bull; {b.zoneId?.zoneCode || 'Z'})
                            </div>
                          </td>

                          {/* Timestamps */}
                          <td className="px-4 py-3">
                            <div className="text-[11px] text-foreground">
                              In: {new Date(b.scheduledEntryTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Out: {new Date(b.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            ₹{b.totalAmount.toFixed(2)}
                            {b.refundAmount && b.refundAmount > 0 ? (
                              <div className="text-[10px] text-blue-600 font-sans font-normal">
                                Ref: ₹{b.refundAmount.toFixed(0)}
                              </div>
                            ) : null}
                          </td>

                          {/* Payment */}
                          <td className="px-4 py-3 text-center">
                            {renderPaymentStatusBadge(b.payment?.paymentStatus)}
                          </td>

                          {/* Booking Status */}
                          <td className="px-4 py-3 text-center">
                            {renderBookingStatusBadge(b.bookingStatus)}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenBookingDetail(b._id)}
                                className="h-7 w-7 p-0"
                                title="View Complete Booking Dossier"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              {b.cancellableByAdmin ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenCancelModal(b)}
                                  className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                  title="Cancel Booking & Issue Centralized Refund"
                                >
                                  <Ban className="h-3.5 w-3.5 mr-1" />
                                  Cancel
                                </Button>
                              ) : b.bookingStatus === 'Cancelled' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenCancellationDetails(b._id)}
                                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                  title="View Cancellation & Refund Record"
                                >
                                  Refund Info
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs">
                <div className="text-muted-foreground">
                  Showing {bookings.length > 0 ? (bookingPage - 1) * bookingLimit + 1 : 0} to{' '}
                  {Math.min(bookingPage * bookingLimit, bookingsTotal)} of {bookingsTotal} records
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bookingPage <= 1 || bookingsLoading}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('b_page', String(bookingPage - 1));
                      setSearchParams(next);
                    }}
                    className="h-7 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground">
                    Page {bookingPage} of {bookingsTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bookingPage >= bookingsTotalPages || bookingsLoading}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('b_page', String(bookingPage + 1));
                      setSearchParams(next);
                    }}
                    className="h-7 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. TAB 2: LIVE VEHICLE LOCATOR CONTENT */}
      {/* =================================================================== */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          {/* 8 Live Vehicle KPI Cards (Section 47) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Card className="border border-border/60 shadow-xs bg-emerald-500/5">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Vehicles Inside
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                  {vehicleOverview.vehiclesCurrentlyInside}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Entered Today</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                  {vehicleOverview.vehiclesEnteredToday}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Exited Today</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                  {vehicleOverview.vehiclesExitedToday}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Avg Duration</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                  {vehicleOverview.averageParkingDurationMinutes}m
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Longest Parked</p>
                <p className="text-sm font-mono font-bold text-foreground mt-1 truncate" title={vehicleOverview.longestParkedVehicle?.vehicleNumber}>
                  {vehicleOverview.longestParkedVehicle?.vehicleNumber || '—'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {vehicleOverview.longestParkedVehicle ? `${Math.floor(vehicleOverview.longestParkedVehicle.durationMinutes / 60)}h ${vehicleOverview.longestParkedVehicle.durationMinutes % 60}m` : '—'}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Available Bays</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                  {vehicleOverview.availableSlots}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Occupied Bays</p>
                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                  {vehicleOverview.occupiedSlots}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-xs bg-amber-500/5">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Overstayed
                </p>
                <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                  {vehicleOverview.overstayedVehicles}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Live Vehicle Filter Toolbar */}
          <Card className="border border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Vehicle Plate Number, Driver Name, Booking ID..."
                    value={vehicleSearchInput}
                    onChange={(e) => setVehicleSearchInput(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                  {vehicleSearchInput && (
                    <button
                      onClick={() => setVehicleSearchInput('')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Tracking Status Filter */}
                  <Select
                    value={vehicleStatus}
                    onValueChange={(val) => {
                      const next = new URLSearchParams(searchParams);
                      if (val && val !== 'ALL') next.set('v_status', val);
                      else next.delete('v_status');
                      next.set('v_page', '1');
                      setSearchParams(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs w-[140px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="Inside Parking">Inside Parking</SelectItem>
                      <SelectItem value="Overstayed">Overstayed</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Duration Bracket Filter */}
                  <Select
                    value={vehicleDuration}
                    onValueChange={(val) => {
                      const next = new URLSearchParams(searchParams);
                      if (val && val !== 'ALL') next.set('v_duration', val);
                      else next.delete('v_duration');
                      next.set('v_page', '1');
                      setSearchParams(next);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs w-[140px]">
                      <SelectValue placeholder="All Durations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Durations</SelectItem>
                      <SelectItem value="< 1 Hour">&lt; 1 Hour</SelectItem>
                      <SelectItem value="1-3 Hours">1–3 Hours</SelectItem>
                      <SelectItem value="3-6 Hours">3–6 Hours</SelectItem>
                      <SelectItem value="> 6 Hours">&gt; 6 Hours</SelectItem>
                      <SelectItem value="Overnight">Overnight</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Reset Filters */}
                  {(vehicleSearch || vehicleStatus !== 'ALL' || vehicleDuration !== 'ALL') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setVehicleSearchInput('');
                        const next = new URLSearchParams(searchParams);
                        next.delete('v_search');
                        next.delete('v_status');
                        next.delete('v_duration');
                        next.set('v_page', '1');
                        setSearchParams(next);
                      }}
                      className="text-xs h-9 px-2 text-muted-foreground"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Vehicles Table */}
          <Card className="border border-border/60">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Vehicle Plate</th>
                      <th className="px-4 py-3 font-semibold">Driver / Customer</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Facility &amp; Bay Location</th>
                      <th className="px-4 py-3 font-semibold">Entry Time</th>
                      <th className="px-4 py-3 font-semibold text-center">Live Duration</th>
                      <th className="px-4 py-3 font-semibold">Gate Officer</th>
                      <th className="px-4 py-3 font-semibold text-center">Tracking Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {vehiclesLoading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          Tracking live vehicles inside facilities...
                        </td>
                      </tr>
                    ) : vehiclesError ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-rose-500">
                          {vehiclesError}
                        </td>
                      </tr>
                    ) : vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          No active vehicles currently inside matching the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      vehicles.map((v) => {
                        const hours = Math.floor(v.liveDurationMinutes / 60);
                        const mins = v.liveDurationMinutes % 60;
                        const durationString = `${hours > 0 ? `${hours}h ` : ''}${mins}m`;

                        return (
                          <tr key={v._id} className="hover:bg-muted/30 transition-colors">
                            {/* Plate */}
                            <td className="px-4 py-3 font-mono font-bold text-foreground">
                              <span className="bg-muted/70 px-2.5 py-1 rounded border border-border/60 text-xs">
                                {v.vehicleNumber}
                              </span>
                            </td>

                            {/* Customer */}
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">{v.customer?.fullName || 'Walk-in Guest'}</div>
                              <div className="text-[11px] text-muted-foreground">{v.customer?.mobileNumber || '—'}</div>
                            </td>

                            {/* Vehicle Type */}
                            <td className="px-4 py-3">
                              <span className="text-muted-foreground font-medium">{v.vehicleType}</span>
                            </td>

                            {/* Facility & Bay */}
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">{v.parkingLot?.parkingName || '—'}</div>
                              <div className="text-[11px] text-muted-foreground">
                                Bay {v.slot?.slotNumber || '—'} &bull; {v.floor?.floorName || 'F1'} &bull; Zone {v.zone?.zoneCode || 'A'}
                              </div>
                            </td>

                            {/* Entry Time */}
                            <td className="px-4 py-3 font-mono text-[11px]">
                              {new Date(v.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            {/* Live Duration (Auto-Ticker) */}
                            <td className="px-4 py-3 text-center">
                              <Badge
                                variant="outline"
                                className="font-mono text-xs font-bold gap-1 bg-background"
                              >
                                <Timer className="h-3 w-3 text-primary animate-pulse" />
                                {durationString}
                              </Badge>
                            </td>

                            {/* Gate Officer */}
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{v.securityStaff?.fullName || 'Gate Guard'}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {v.securityStaff?.employeeId || 'Verified'}
                              </div>
                            </td>

                            {/* Tracking Status */}
                            <td className="px-4 py-3 text-center">
                              {v.trackingStatus === 'Overstayed' ? (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Overstayed ({v.overstayMinutes}m)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Inside Parking
                                </Badge>
                              )}
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenVehicleDetail(v.bookingId)}
                                className="h-7 w-7 p-0"
                                title="Inspect Live Vehicle Dossier"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs">
                <div className="text-muted-foreground">
                  Showing {vehicles.length > 0 ? (vehiclePage - 1) * vehicleLimit + 1 : 0} to{' '}
                  {Math.min(vehiclePage * vehicleLimit, vehiclesTotal)} of {vehiclesTotal} vehicles inside
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={vehiclePage <= 1 || vehiclesLoading}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('v_page', String(vehiclePage - 1));
                      setSearchParams(next);
                    }}
                    className="h-7 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground">
                    Page {vehiclePage} of {vehiclesTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={vehiclePage >= vehiclesTotalPages || vehiclesLoading}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('v_page', String(vehiclePage + 1));
                      setSearchParams(next);
                    }}
                    className="h-7 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. MODALS & DETAIL DRAWERS */}
      {/* =================================================================== */}

      {/* A. Single Booking Detail Dialog */}
      <Dialog open={Boolean(selectedBookingId)} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Booking Dossier — {bookingDetail?.booking.bookingReference}
            </DialogTitle>
            <DialogDescription>
              Complete physical bay context, customer identity, payment records, and chronological audit trail.
            </DialogDescription>
          </DialogHeader>

          {bookingDetailLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading booking dossier...
            </div>
          ) : bookingDetailError ? (
            <div className="py-6 text-center text-rose-500">{bookingDetailError}</div>
          ) : bookingDetail ? (
            <div className="space-y-4 text-xs">
              {/* Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border border-border/60">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Booking Status</div>
                  <div className="mt-1">{renderBookingStatusBadge(bookingDetail.booking.bookingStatus)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Vehicle Plate</div>
                  <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                    {bookingDetail.booking.vehicleNumber}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Total Charge</div>
                  <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                    ₹{bookingDetail.booking.totalAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Allocated Bay</div>
                  <div className="font-semibold text-foreground mt-0.5">
                    Bay {bookingDetail.booking.currentSlotId?.slotNumber || '—'}
                  </div>
                </div>
              </div>

              {/* Tabs within dossier */}
              <Tabs defaultValue="context" className="w-full">
                <TabsList className="grid grid-cols-3 h-8 text-xs">
                  <TabsTrigger value="context">Overview &amp; Bay</TabsTrigger>
                  <TabsTrigger value="payments">Financials &amp; Refunds</TabsTrigger>
                  <TabsTrigger value="timeline">Audit Timeline ({bookingDetail.timeline.length})</TabsTrigger>
                </TabsList>

                {/* Tab 1: Bay & Parties */}
                <TabsContent value="context" className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card className="border border-border/60">
                      <CardContent className="p-3 space-y-1.5">
                        <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-b pb-1">
                          Driver / Customer
                        </div>
                        <div><strong>Name:</strong> {bookingDetail.booking.customerId?.fullName || 'Walk-in'}</div>
                        <div><strong>Email:</strong> {bookingDetail.booking.customerId?.email || '—'}</div>
                        <div><strong>Mobile:</strong> {bookingDetail.booking.customerId?.mobileNumber || '—'}</div>
                        <div><strong>Vehicle Model:</strong> {bookingDetail.booking.vehicleId?.vehicleBrand} {bookingDetail.booking.vehicleId?.vehicleModel} ({bookingDetail.booking.vehicleType})</div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border/60">
                      <CardContent className="p-3 space-y-1.5">
                        <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-b pb-1">
                          Facility &amp; Owner
                        </div>
                        <div><strong>Facility:</strong> {bookingDetail.booking.parkingLotId?.parkingName}</div>
                        <div><strong>Address:</strong> {bookingDetail.booking.parkingLotId?.address}, {bookingDetail.booking.parkingLotId?.city}</div>
                        <div><strong>Owner:</strong> {bookingDetail.owner?.fullName} ({bookingDetail.owner?.businessName || 'Partner'})</div>
                        <div><strong>Bay Location:</strong> Floor {bookingDetail.booking.floorId?.floorName} &bull; Zone {bookingDetail.booking.zoneId?.zoneCode}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border border-border/60">
                    <CardContent className="p-3 space-y-1.5">
                      <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-b pb-1">
                        Physical Gate Verification Records
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <strong>Scheduled Window:</strong><br />
                          {new Date(bookingDetail.booking.scheduledEntryTime).toLocaleString()} &rarr; {new Date(bookingDetail.booking.scheduledExitTime).toLocaleString()}
                        </div>
                        <div>
                          <strong>Actual Entry / Exit:</strong><br />
                          {bookingDetail.booking.actualEntryTime ? new Date(bookingDetail.booking.actualEntryTime).toLocaleString() : 'Not Checked In'} &rarr;{' '}
                          {bookingDetail.booking.actualExitTime ? new Date(bookingDetail.booking.actualExitTime).toLocaleString() : 'Not Checked Out'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 2: Payments & Refunds */}
                <TabsContent value="payments" className="space-y-3 pt-2">
                  <div className="space-y-2">
                    {bookingDetail.payments.map((p) => (
                      <Card key={p._id} className="border border-border/60">
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-center justify-between border-b pb-1">
                            <span className="font-mono font-bold">{p.paymentReference}</span>
                            {renderPaymentStatusBadge(p.paymentStatus)}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>Method: <strong>{p.paymentMethod}</strong></div>
                            <div>Amount: <strong className="font-mono">₹{p.amount.toFixed(2)}</strong></div>
                            <div>Transaction ID: <span className="font-mono text-[10px]">{p.transactionId || '—'}</span></div>
                            <div>Date: {new Date(p.createdAt).toLocaleString()}</div>
                          </div>

                          {p.refunds && p.refunds.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/60 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded">
                              <div className="font-bold text-blue-700 dark:text-blue-400">Processed Refunds:</div>
                              {p.refunds.map((r, i) => (
                                <div key={i} className="text-[11px] mt-1">
                                  Ref: <span className="font-mono font-semibold">{r.refundReference}</span> &bull;{' '}
                                  Amount: <strong>₹{r.refundAmount}</strong> ({r.refundStatus})<br />
                                  Reason: <em>{r.refundReason}</em>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Tab 3: Timeline */}
                <TabsContent value="timeline" className="space-y-2 pt-2">
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {bookingDetail.timeline.map((t) => (
                      <div key={t._id} className="flex gap-2.5 items-start bg-muted/30 p-2 rounded border border-border/40">
                        <div className="p-1 bg-primary/10 rounded text-primary mt-0.5">
                          <Activity className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{t.eventTitle}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(t.eventTime).toLocaleString()}</span>
                          </div>
                          {t.eventDescription && <div className="text-[11px] text-muted-foreground mt-0.5">{t.eventDescription}</div>}
                          <div className="text-[10px] text-primary/80 mt-1 font-mono">Source: {t.eventSource}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          <DialogFooter className="flex items-center justify-between">
            {bookingDetail?.cancellableByAdmin ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (bookingDetail) {
                    handleOpenCancelModal(bookingDetail.booking);
                  }
                }}
                className="text-xs"
              >
                Cancel Booking
              </Button>
            ) : <div />}
            <Button variant="outline" size="sm" onClick={() => setSelectedBookingId(null)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* B. Administrative Cancel Booking Dialog */}
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" />
              Administrative Booking Cancellation
            </DialogTitle>
            <DialogDescription>
              Cancel reservation {cancelTarget?.bookingReference} and process centralized platform refund.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-rose-700 dark:text-rose-400 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Operational Impact Notice
              </div>
              <p>
                Cancelling this booking will immediately release Bay <strong>{cancelTarget?.currentSlotId?.slotNumber || 'Allocated Bay'}</strong> back to Available status, log an immutable audit trail, dispatch an in-app notification &amp; branded email to the customer, and trigger refund processing.
              </p>
            </div>

            <div className="bg-muted/40 p-2.5 rounded border border-border/60">
              <div>Refund Amount: <strong className="font-mono text-sm text-foreground">₹{cancelTarget?.totalAmount.toFixed(2)}</strong></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Method: {cancelTarget?.payment?.paymentMethod || 'RAZORPAY'} &bull; Status: {cancelTarget?.payment?.paymentMethod === 'RAZORPAY' ? 'Online Gateway Reversal' : 'Cash Reversal at Gate'}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Administrative Cancellation Reason <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                placeholder="Provide reason for administrator cancellation (minimum 5 characters)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-xs h-20"
              />
            </div>

            {cancelError && (
              <div className="p-2 rounded bg-rose-500/10 text-rose-600 text-xs flex items-center gap-1">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelTarget(null)}
              disabled={cancelSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelSubmitting}
              className="text-xs gap-1.5"
            >
              {cancelSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C. Dedicated Cancellation Details Modal */}
      <Dialog open={Boolean(cancellationDetails)} onOpenChange={(open) => !open && setCancellationDetails(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Cancellation &amp; Refund Ledger
            </DialogTitle>
            <DialogDescription>
              Official record for cancelled reservation {cancellationDetails?.bookingReference}.
            </DialogDescription>
          </DialogHeader>

          {cancellationDetails && (
            <div className="space-y-3 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg border border-border/60 space-y-1.5">
                <div><strong>Cancelled By:</strong> {cancellationDetails.cancellationBy}</div>
                <div><strong>Date &amp; Time:</strong> {new Date(cancellationDetails.cancelledAt).toLocaleString()}</div>
                <div><strong>Reason:</strong> <span className="text-rose-600 font-medium">{cancellationDetails.cancellationReason}</span></div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="font-bold">Refund Settlement:</div>
                <div className="text-sm font-mono font-bold">₹{cancellationDetails.refundAmount.toFixed(2)}</div>
                <div>Payment Method: <strong>{cancellationDetails.paymentMethod}</strong></div>
                <div>Status: <strong>{cancellationDetails.paymentStatus}</strong></div>
              </div>

              {cancellationDetails.refunds && cancellationDetails.refunds.length > 0 && (
                <div className="border border-border/60 rounded p-2.5 space-y-1 bg-muted/20">
                  <div className="font-semibold text-muted-foreground uppercase text-[10px]">Gateway References:</div>
                  {cancellationDetails.refunds.map((r, i) => (
                    <div key={i} className="text-[11px]">
                      Ref: <span className="font-mono">{r.refundReference}</span> &bull; {r.refundStatus}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancellationDetails(null)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* D. Live Vehicle Detail Dossier Modal */}
      <Dialog open={Boolean(selectedVehicleBookingId)} onOpenChange={(open) => !open && setSelectedVehicleBookingId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Live Vehicle Dossier — {vehicleDetail?.booking.vehicleNumber}
            </DialogTitle>
            <DialogDescription>
              Real-time physical facility presence, bay assignment, and security gate entry records.
            </DialogDescription>
          </DialogHeader>

          {vehicleDetailLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading vehicle presence records...
            </div>
          ) : vehicleDetailError ? (
            <div className="py-6 text-center text-rose-500">{vehicleDetailError}</div>
          ) : vehicleDetail ? (
            <div className="space-y-4 text-xs">
              {/* Top Live Presence Banner */}
              <div className="p-3 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Physical Presence</div>
                  <div className="font-mono font-bold text-lg text-foreground mt-0.5">
                    {vehicleDetail.booking.vehicleNumber}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {vehicleDetail.booking.vehicleType}
                  </div>
                </div>

                <div className="text-right">
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold px-2.5 py-1 ${
                      vehicleDetail.timing.isOverstay
                        ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    }`}
                  >
                    {vehicleDetail.timing.isOverstay ? 'Overstayed' : 'Inside Facility'}
                  </Badge>
                  <div className="font-mono text-xs text-muted-foreground mt-1">
                    Live Duration: {Math.floor(vehicleDetail.timing.liveDurationMinutes / 60)}h {vehicleDetail.timing.liveDurationMinutes % 60}m
                  </div>
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="border border-border/60">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-b pb-1">
                      Bay Location
                    </div>
                    <div><strong>Facility:</strong> {vehicleDetail.parkingLot?.parkingName}</div>
                    <div><strong>Address:</strong> {vehicleDetail.parkingLot?.address}, {vehicleDetail.parkingLot?.city}</div>
                    <div><strong>Bay:</strong> Bay {vehicleDetail.bayLocation.slot?.slotNumber}</div>
                    <div><strong>Floor &amp; Zone:</strong> {vehicleDetail.bayLocation.floor?.floorName} &bull; Zone {vehicleDetail.bayLocation.zone?.zoneCode}</div>
                  </CardContent>
                </Card>

                <Card className="border border-border/60">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-b pb-1">
                      Customer &amp; Gate Guard
                    </div>
                    <div><strong>Customer:</strong> {vehicleDetail.customer?.fullName || 'Walk-in Guest'}</div>
                    <div><strong>Phone:</strong> {vehicleDetail.customer?.mobileNumber || '—'}</div>
                    <div><strong>Entry Guard:</strong> {vehicleDetail.securityOfficer?.fullName || 'Duty Officer'}</div>
                    <div><strong>Guard ID:</strong> {vehicleDetail.securityOfficer?.employeeId || 'Verified'}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Gate Movements */}
              <Card className="border border-border/60">
                <CardContent className="p-3 space-y-2">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground border-b pb-1">
                    Gate Movement Ledger ({vehicleDetail.movementLogs.length})
                  </div>
                  {vehicleDetail.movementLogs.map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/20 rounded border border-border/40 text-[11px]">
                      <div>
                        <strong>{m.entryMethod || 'QR Code'} Entry</strong> by {m.verifiedBy?.fullName || 'Security Guard'}
                      </div>
                      <div className="font-mono text-muted-foreground">
                        {new Date(m.entryTime).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedVehicleBookingId(null)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
