import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Building2,
  RefreshCw,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Car,
  User,
  Phone,
  Mail,
  Banknote,
  Eye,
  History,
  ShieldCheck,
  ShieldAlert,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLiveSync } from '@/hooks/useLiveSync';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  type ManualBookingItem,
  type ManualSearchBookingsResult,
  type ManualBookingDetailData,
} from '@/api/security.api';

const LOCAL_STORAGE_KEY = 'parkease_security_active_lot_id';

const CANONICAL_ENTRY_REASONS = [
  'Customer cannot display the QR Code.',
  'QR Code cannot be scanned or camera unreadable.',
  "Customer's mobile device is unavailable / battery depleted.",
  'Network connectivity prevents QR retrieval on customer phone.',
  'Physical QR receipt is lost or damaged.',
  'Disputed verification requiring manual gate check-in.',
];

const CANONICAL_EXIT_REASONS = [
  'Customer cannot display the QR Code.',
  'QR Code cannot be scanned or camera unreadable.',
  "Customer's mobile device is unavailable / battery depleted.",
  'Physical QR receipt is lost or damaged.',
  'Security Staff manual exit inspection verified.',
  'Emergency gate clearance authorized by Security Supervisor.',
];

const REJECTION_REASONS = [
  'Vehicle license plate mismatch against booking record.',
  'Customer uncooperative or refuses identity verification.',
  'Disputed vehicle ownership or unauthorized driver.',
  'Assigned parking bay is occupied or obstructed.',
  'Operational safety or security risk at facility.',
  'Other operational rejection reason.',
];

export const SecurityManualLookupPage: React.FC = () => {
  // Facilities state
  const [facilities, setFacilities] = useState<SecurityAssignedFacility[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [loadingFacilities, setLoadingFacilities] = useState<boolean>(true);

  // Search and filter state
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Results state
  const [searchData, setSearchData] = useState<ManualSearchBookingsResult | null>(null);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);

  // Action Dialog States
  const [entryModalBooking, setEntryModalBooking] = useState<ManualBookingItem | null>(null);
  const [entryReason, setEntryReason] = useState<string>(CANONICAL_ENTRY_REASONS[0]);
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [submittingEntry, setSubmittingEntry] = useState<boolean>(false);

  const [exitModalBooking, setExitModalBooking] = useState<ManualBookingItem | null>(null);
  const [exitReason, setExitReason] = useState<string>(CANONICAL_EXIT_REASONS[0]);
  const [exitNotes, setExitNotes] = useState<string>('');
  const [submittingExit, setSubmittingExit] = useState<boolean>(false);

  const [rejectModalBooking, setRejectModalBooking] = useState<ManualBookingItem | null>(null);
  const [rejectActionType, setRejectActionType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [rejectReason, setRejectReason] = useState<string>(REJECTION_REASONS[0]);
  const [rejectNotes, setRejectNotes] = useState<string>('');
  const [submittingReject, setSubmittingReject] = useState<boolean>(false);

  const [cashModalBooking, setCashModalBooking] = useState<ManualBookingItem | null>(null);
  const [cashConfirmed, setCashConfirmed] = useState<boolean>(false);
  const [submittingCash, setSubmittingCash] = useState<boolean>(false);

  // Details & Timeline Modal States
  const [detailModalBookingId, setDetailModalBookingId] = useState<string | null>(null);
  const [bookingDetailData, setBookingDetailData] = useState<ManualBookingDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const [timelineModalBookingId, setTimelineModalBookingId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<ManualBookingDetailData | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);

  // 1. Load Facilities
  useEffect(() => {
    let isMounted = true;

    async function loadFacilities() {
      try {
        setLoadingFacilities(true);
        const data = await securityApi.getAssignedFacilities();
        if (!isMounted) return;

        setFacilities(data);

        if (data.length > 0) {
          const cachedLotId = localStorage.getItem(LOCAL_STORAGE_KEY);
          const hasMatchingLot = cachedLotId && data.some((f) => f.parkingLotId === cachedLotId);
          const defaultLot = hasMatchingLot ? cachedLotId! : data[0].parkingLotId;
          setSelectedLotId(defaultLot);
          localStorage.setItem(LOCAL_STORAGE_KEY, defaultLot);
        } else {
          toast.error('No active parking facilities are assigned to your security profile.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        toast.error(err.message || 'Failed to retrieve assigned security posts.');
      } finally {
        if (isMounted) setLoadingFacilities(false);
      }
    }

    loadFacilities();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFacilityChange = (newLotId: string) => {
    setSelectedLotId(newLotId);
    localStorage.setItem(LOCAL_STORAGE_KEY, newLotId);
    setCurrentPage(1);
  };

  // 2. Fetch Bookings Search Results
  const fetchBookings = useCallback(async (isSilent = false) => {
    if (!selectedLotId) return;
    try {
      if (!isSilent) setLoadingResults(true);
      const res = await securityApi.searchManualBookings({
        parkingLotId: selectedLotId,
        query: activeQuery || undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        page: currentPage,
        limit: 10,
      });
      setSearchData(res);
    } catch (err: any) {
      if (!isSilent) toast.error(err.message || 'Failed to search bookings for manual verification.');
    } finally {
      if (!isSilent) setLoadingResults(false);
    }
  }, [selectedLotId, activeQuery, selectedStatus, currentPage]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  // Live dynamic background sync without ghost reload
  useLiveSync(() => {
    void fetchBookings(true);
  }, { enabled: Boolean(selectedLotId) });

  // Debounce search input for live asynchronous searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveQuery(searchInput.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle Search Submission (Immediate trigger on Enter key)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput.trim());
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveQuery('');
    setCurrentPage(1);
  };

  // 3. Handle Manual Entry
  const handleConfirmManualEntry = async () => {
    if (!entryModalBooking || !selectedLotId) return;
    try {
      setSubmittingEntry(true);
      const res = await securityApi.recordManualEntry({
        parkingLotId: selectedLotId,
        bookingId: entryModalBooking.bookingId,
        reason: entryReason,
        notes: entryNotes.trim() || undefined,
      });

      toast.success(
        `Entry approved for vehicle ${entryModalBooking.vehicle.vehicleNumber} (Slot ${res.slot.slotNumber}). Gate unlocked!`,
      );
      setEntryModalBooking(null);
      setEntryNotes('');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to authorize manual vehicle entry.');
    } finally {
      setSubmittingEntry(false);
    }
  };

  // 4. Handle Manual Exit
  const handleConfirmManualExit = async () => {
    if (!exitModalBooking || !selectedLotId) return;
    try {
      setSubmittingExit(true);
      const res = await securityApi.completeManualExit({
        parkingLotId: selectedLotId,
        bookingId: exitModalBooking.bookingId,
        reason: exitReason,
        notes: exitNotes.trim() || undefined,
      });

      toast.success(
        `Vehicle ${exitModalBooking.vehicle.vehicleNumber} exited safely. Slot ${res.slot.slotNumber} is now released!`,
      );
      setExitModalBooking(null);
      setExitNotes('');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete manual vehicle exit.');
    } finally {
      setSubmittingExit(false);
    }
  };

  // 5. Handle Cash Collection
  const handleConfirmCashCollection = async () => {
    if (!cashModalBooking || !selectedLotId || !cashConfirmed) return;
    try {
      setSubmittingCash(true);
      const res = await securityApi.collectOverstayCash({
        parkingLotId: selectedLotId,
        bookingId: cashModalBooking.bookingId,
        amount: cashModalBooking.overstay.overstayCharge,
        notes: 'Cash collected at exit gate barrier during emergency manual lookup.',
      });

      toast.success(
        `Overstay cash ₹${res.amountCollected} confirmed for ${cashModalBooking.bookingReference}. Exit barrier is unlocked!`,
      );
      setCashModalBooking(null);
      setCashConfirmed(false);
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm overstay cash collection.');
    } finally {
      setSubmittingCash(false);
    }
  };

  // 6. Handle Manual Rejection
  const handleConfirmRejection = async () => {
    if (!rejectModalBooking || !selectedLotId) return;
    try {
      setSubmittingReject(true);
      await securityApi.recordManualRejection({
        parkingLotId: selectedLotId,
        bookingId: rejectModalBooking.bookingId,
        actionType: rejectActionType,
        reason: rejectReason,
        notes: rejectNotes.trim() || undefined,
      });

      toast.warning(
        `Manual ${rejectActionType.toLowerCase()} verification rejected for ${rejectModalBooking.vehicle.vehicleNumber}. Logged in audit registry.`,
      );
      setRejectModalBooking(null);
      setRejectNotes('');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record verification rejection.');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Confirm Extension Cash at Exit
  const [isConfirmingCashId, setIsConfirmingCashId] = useState<string | null>(null);
  const handleConfirmExtensionCash = async (item: ManualBookingItem) => {
    if (!selectedLotId || !item.pendingCashExtension) return;

    try {
      setIsConfirmingCashId(item.bookingId);
      const res = await securityApi.confirmCashExtensionPayment({
        parkingLotId: selectedLotId,
        bookingId: item.bookingId,
        paymentId: item.pendingCashExtension.paymentId,
      });

      toast.success(res.message || 'Extension cash payment confirmed successfully.');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm extension cash payment.');
    } finally {
      setIsConfirmingCashId(null);
    }
  };

  // 7. Load Details Modal
  const openDetailModal = async (bookingId: string) => {
    if (!selectedLotId) return;
    setDetailModalBookingId(bookingId);
    try {
      setLoadingDetail(true);
      const res = await securityApi.getManualBookingDetails({
        parkingLotId: selectedLotId,
        bookingId,
      });
      setBookingDetailData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load booking details.');
      setDetailModalBookingId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 8. Load Timeline Modal
  const openTimelineModal = async (bookingId: string) => {
    if (!selectedLotId) return;
    setTimelineModalBookingId(bookingId);
    try {
      setLoadingTimeline(true);
      const res = await securityApi.getManualBookingDetails({
        parkingLotId: selectedLotId,
        bookingId,
      });
      setTimelineData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load booking timeline.');
      setTimelineModalBookingId(null);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const selectedFacility = facilities.find((f) => f.parkingLotId === selectedLotId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm mt-1">
            <Search className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Manual Vehicle Lookup
              </h1>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-xs font-semibold">
                Emergency Fallback
              </Badge>
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                Module 4 · Phase 3
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Authorized emergency fallback to verify and process vehicle entry or exit when QR pass scanning is impossible (device uncharged, screen broken, network failure, or lost receipt).
            </p>
          </div>
        </div>

        {/* Right Facility Selector & Quick Navigation */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="w-full sm:w-64">
            {loadingFacilities ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedLotId} onValueChange={handleFacilityChange}>
                <SelectTrigger className="h-10 text-xs font-medium border-border/80 bg-background/80 backdrop-blur shadow-sm">
                  <Building2 className="w-4 h-4 mr-2 text-primary shrink-0" />
                  <SelectValue placeholder="Select Facility Post" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((fac) => (
                    <SelectItem key={fac.parkingLotId} value={fac.parkingLotId} className="text-xs">
                      {fac.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Link to="/security/scan">
            <Button size="sm" className="h-10 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <QrCode className="w-3.5 h-3.5" />
              QR Scanner
            </Button>
          </Link>
        </div>
      </div>

      {/* Facility Banner & Emergency Operating Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm p-4 col-span-1 md:col-span-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Active Facility Post
                </span>
                {selectedFacility && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    {selectedFacility.isOpen24Hours ? 'Open 24/7' : `${selectedFacility.openingTime || ''} - ${selectedFacility.closingTime || ''}`}
                  </Badge>
                )}
              </div>
              <h2 className="text-base font-bold text-foreground truncate mt-0.5">
                {selectedFacility?.parkingName || 'No facility selected'}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {selectedFacility?.address}, {selectedFacility?.city}, {selectedFacility?.state} - {selectedFacility?.postalCode}
              </p>
            </div>
          </div>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5 backdrop-blur shadow-sm p-4 col-span-1">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                Fallback Policy
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Manual lookup is an authorized emergency fallback for QR scan failures. Every verification records full audit logs and timeline events.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Multi-Criteria Search & Status Filters */}
      <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              {loadingResults && searchInput ? (
                <RefreshCw className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
              ) : (
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              )}
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Vehicle Number (e.g. GJ01AB1234), Booking ID, Customer Name, or Mobile..."
                className="pl-10 h-11 text-xs sm:text-sm bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>

            <Button type="submit" className="h-11 px-6 text-xs sm:text-sm font-semibold shrink-0 gap-2">
              <Search className="w-4 h-4" />
              Search Bookings
            </Button>
          </form>

          {/* Status Tabs and Quick Metric Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'All', label: 'All Bookings', count: searchData?.summary.total },
                { key: 'Confirmed', label: 'Confirmed (Ready)', count: searchData?.summary.confirmed },
                { key: 'Active', label: 'Active (Inside)', count: searchData?.summary.active },
                { key: 'Overstay', label: 'Overstay', count: searchData?.summary.overstay },
                { key: 'Completed', label: 'Completed', count: searchData?.summary.completed },
              ].map((tab) => {
                const isActive = selectedStatus === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(tab.key);
                      setCurrentPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-background text-foreground/80'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground">
              {searchData && (
                <span>
                  Showing {searchData.bookings.length} of {searchData.pagination.totalCount} records
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Result Table / Card List */}
      <Card className="border-border/80 bg-card/60 backdrop-blur shadow-sm overflow-hidden">
        {loadingResults ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : !searchData || searchData.bookings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">No bookings found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              No matching booking records found for the selected facility post with status "{selectedStatus}". Try clearing the search query or changing filters.
            </p>
            {activeQuery && (
              <Button variant="outline" size="sm" onClick={handleClearSearch} className="text-xs mt-2">
                Clear Search Filter
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Customer & Booking ID</th>
                  <th className="py-3.5 px-4">Vehicle Details</th>
                  <th className="py-3.5 px-4">Assigned Slot</th>
                  <th className="py-3.5 px-4">Timing & Stay</th>
                  <th className="py-3.5 px-4">Status & Overstay</th>
                  <th className="py-3.5 px-4 text-right">Available Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {searchData.bookings.map((item) => {
                  const isConfirmed = item.bookingStatus === 'Confirmed';
                  const isActive = item.bookingStatus === 'Active';
                  const isOverstay = item.bookingStatus === 'Overstay' || item.overstay.isOverstay;
                  const isCompleted = item.bookingStatus === 'Completed';

                  return (
                    <tr key={item.bookingId} className="hover:bg-muted/20 transition-colors">
                      {/* Customer & ID */}
                      <td className="py-4 px-4 align-top space-y-1">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-primary" />
                          <span>{item.customer.fullName}</span>
                        </div>
                        <div className="font-mono text-[11px] text-primary tracking-tight font-semibold">
                          {item.bookingReference}
                        </div>
                        <div className="flex flex-col text-[11px] text-muted-foreground">
                          {item.customer.mobileNumber && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {item.customer.mobileNumber}
                            </span>
                          )}
                          {item.customer.email && (
                            <span className="flex items-center gap-1 truncate max-w-[170px]" title={item.customer.email}>
                              <Mail className="w-3 h-3" /> {item.customer.email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Vehicle Details */}
                      <td className="py-4 px-4 align-top space-y-1">
                        <div className="inline-block px-2.5 py-1 rounded bg-foreground/5 border border-foreground/20 font-mono font-bold text-xs tracking-wider text-foreground">
                          {item.vehicle.vehicleNumber}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Car className="w-3.5 h-3.5" />
                          <span>{item.vehicle.vehicleType}</span>
                          {item.vehicle.make && <span>• {item.vehicle.make}</span>}
                          {item.vehicle.model && <span>{item.vehicle.model}</span>}
                          {item.vehicle.color && <span>({item.vehicle.color})</span>}
                        </div>
                      </td>

                      {/* Assigned Slot */}
                      <td className="py-4 px-4 align-top space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-bold text-xs bg-primary/10 text-primary border-primary/20">
                            Bay {item.facility.slotNumber}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{item.facility.floorName}</span> • <span>{item.facility.zoneName}</span>
                        </div>
                        {item.facility.slotIdentifier && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {item.facility.slotIdentifier}
                          </div>
                        )}
                      </td>

                      {/* Timing & Stay */}
                      <td className="py-4 px-4 align-top space-y-1 text-[11px]">
                        <div className="text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Sched In:</span>{' '}
                          {new Date(item.timing.scheduledEntryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' '}
                          <span className="text-[10px]">({new Date(item.timing.scheduledEntryTime).toLocaleDateString([], { month: 'short', day: 'numeric' })})</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-semibold text-foreground/80">Sched Out:</span>{' '}
                          {new Date(item.timing.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {item.timing.actualEntryTime && (
                          <div className="text-emerald-500 font-medium">
                            Entered: {new Date(item.timing.actualEntryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {item.timing.actualExitTime && (
                          <div className="text-muted-foreground font-medium">
                            Exited: {new Date(item.timing.actualExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {typeof item.timing.stayDurationMinutes === 'number' && (
                              <span> ({item.timing.stayDurationMinutes} min)</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status & Overstay */}
                      <td className="py-4 px-4 align-top space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              isConfirmed
                                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                : isActive
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : isOverstay
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : isCompleted
                                ? 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                : 'bg-muted/50 text-muted-foreground'
                            }`}
                          >
                            {item.bookingStatus}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-foreground/5 text-foreground/70">
                            {item.qrStatus.qrStatus} QR
                          </Badge>
                        </div>

                        {/* Overstay Callout */}
                        {item.overstay.isOverstay && (
                          <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] space-y-0.5">
                            <div className="font-bold text-red-500 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Overstay: +{item.overstay.overstayDurationMinutes} min
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Fee: ₹{item.overstay.overstayCharge}</span>
                              <span
                                className={`font-semibold ${
                                  item.overstay.overstayPaymentStatus === 'PAID'
                                    ? 'text-emerald-500'
                                    : 'text-amber-500'
                                }`}
                              >
                                {item.overstay.overstayPaymentStatus}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right space-y-1.5">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {/* Entry actions for Confirmed */}
                          {isConfirmed && item.allowedActions.canAllowEntry && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={() => {
                                setEntryModalBooking(item);
                                setEntryReason(CANONICAL_ENTRY_REASONS[0]);
                                setEntryNotes('');
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Allow Entry
                            </Button>
                          )}

                          {isConfirmed && item.allowedActions.canRejectEntry && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 border-destructive/20 gap-1"
                              onClick={() => {
                                setRejectModalBooking(item);
                                setRejectActionType('ENTRY');
                                setRejectReason(REJECTION_REASONS[0]);
                                setRejectNotes('');
                              }}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          )}

                          {/* Overstay Cash Collection Barrier */}
                          {(isActive || isOverstay) && item.allowedActions.canCollectCash && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1 shadow-sm"
                              onClick={() => {
                                setCashModalBooking(item);
                                setCashConfirmed(false);
                              }}
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              Collect Cash (₹{item.overstay.overstayCharge})
                            </Button>
                          )}

                          {/* Extension Cash Collection Barrier */}
                          {(isActive || isOverstay) && item.pendingCashExtension && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1 shadow-sm cursor-pointer"
                              onClick={() => handleConfirmExtensionCash(item)}
                              disabled={isConfirmingCashId === item.bookingId}
                            >
                              {isConfirmingCashId === item.bookingId ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Banknote className="w-3.5 h-3.5" />
                              )}
                              Confirm Extension Cash (₹{item.pendingCashExtension.amount.toFixed(2)})
                            </Button>
                          )}

                          {/* Exit actions for Active / Overstay */}
                          {(isActive || isOverstay) && item.allowedActions.canCompleteExit && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1"
                              onClick={() => {
                                setExitModalBooking(item);
                                setExitReason(CANONICAL_EXIT_REASONS[0]);
                                setExitNotes('');
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Complete Exit
                            </Button>
                          )}

                          {(isActive || isOverstay) && item.allowedActions.canRejectExit && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 border-destructive/20 gap-1"
                              onClick={() => {
                                setRejectModalBooking(item);
                                setRejectActionType('EXIT');
                                setRejectReason(REJECTION_REASONS[0]);
                                setRejectNotes('');
                              }}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          )}

                          {/* View Booking Details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => openDetailModal(item.bookingId)}
                            title="View Full Booking Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {/* View Timeline */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => openTimelineModal(item.bookingId)}
                            title="View Chronological Timeline"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {searchData && searchData.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border/40 text-xs">
            <span className="text-muted-foreground">
              Page {searchData.pagination.currentPage} of {searchData.pagination.totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loadingResults}
                className="h-8 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(searchData.pagination.totalPages, p + 1))}
                disabled={currentPage >= searchData.pagination.totalPages || loadingResults}
                className="h-8 px-2.5 text-xs"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ---------------- MODAL 1: MANUAL ENTRY VERIFICATION ---------------- */}
      <Dialog open={Boolean(entryModalBooking)} onOpenChange={(open) => !open && setEntryModalBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Verify & Authorize Manual Entry
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Verify customer and vehicle credentials before granting gate access.
            </DialogDescription>
          </DialogHeader>

          {entryModalBooking && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="font-mono font-bold text-primary">{entryModalBooking.bookingReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-foreground">{entryModalBooking.customer.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Plate:</span>
                  <span className="font-mono font-bold text-foreground px-1.5 py-0.5 bg-background rounded border">
                    {entryModalBooking.vehicle.vehicleNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned Slot:</span>
                  <span className="font-bold text-emerald-500">
                    Slot {entryModalBooking.facility.slotNumber} ({entryModalBooking.facility.floorName} · {entryModalBooking.facility.zoneName})
                  </span>
                </div>
              </div>

              {/* Standard Fallback Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Reason for Manual Fallback <span className="text-red-500">*</span>
                </label>
                <Select value={entryReason} onValueChange={setEntryReason}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select verified reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANONICAL_ENTRY_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Operational Notes (Optional)</label>
                <Textarea
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder="e.g. Driver verified with physical Aadhaar / Driving License..."
                  className="text-xs resize-none h-18"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEntryModalBooking(null)} disabled={submittingEntry}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmManualEntry}
              disabled={submittingEntry}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submittingEntry ? 'Approving...' : 'Confirm & Open Barrier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- MODAL 2: MANUAL EXIT VERIFICATION ---------------- */}
      <Dialog open={Boolean(exitModalBooking)} onOpenChange={(open) => !open && setExitModalBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              Verify & Complete Manual Exit
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirm vehicle exit and release parking bay back to available inventory.
            </DialogDescription>
          </DialogHeader>

          {exitModalBooking && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="font-mono font-bold text-primary">{exitModalBooking.bookingReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle Plate:</span>
                  <span className="font-mono font-bold text-foreground px-1.5 py-0.5 bg-background rounded border">
                    {exitModalBooking.vehicle.vehicleNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bay Releasing:</span>
                  <span className="font-bold text-blue-500">Slot {exitModalBooking.facility.slotNumber}</span>
                </div>
              </div>

              {/* Standard Fallback Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Reason for Manual Exit <span className="text-red-500">*</span>
                </label>
                <Select value={exitReason} onValueChange={setExitReason}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select verified reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANONICAL_EXIT_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Operational Notes (Optional)</label>
                <Textarea
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  placeholder="e.g. Driver verified physically, released through South Barrier..."
                  className="text-xs resize-none h-18"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setExitModalBooking(null)} disabled={submittingExit}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmManualExit}
              disabled={submittingExit}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submittingExit ? 'Processing...' : 'Confirm Exit & Release Bay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- MODAL 3: OVERSTAY CASH COLLECTION ---------------- */}
      <Dialog open={Boolean(cashModalBooking)} onOpenChange={(open) => !open && setCashModalBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-500">
              <Banknote className="w-5 h-5 text-amber-500" />
              Collect Overstay Cash at Exit Gate
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Exit barrier remains strictly locked until outstanding overstay charges are settled.
            </DialogDescription>
          </DialogHeader>

          {cashModalBooking && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Amount Due in Cash
                </span>
                <div className="text-3xl font-extrabold text-amber-500">
                  ₹{cashModalBooking.overstay.overstayCharge}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Overstay duration: +{cashModalBooking.overstay.overstayDurationMinutes} minutes beyond grace period.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="font-mono font-bold text-foreground">{cashModalBooking.bookingReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle:</span>
                  <span className="font-mono font-bold text-foreground">{cashModalBooking.vehicle.vehicleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-foreground">{cashModalBooking.customer.fullName}</span>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-border/80 bg-background/50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={cashConfirmed}
                  onChange={(e) => setCashConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-foreground leading-relaxed">
                  I confirm that I have collected exactly <strong className="text-amber-500">₹{cashModalBooking.overstay.overstayCharge}</strong> in cash from the driver at the gate barrier.
                </span>
              </label>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setCashModalBooking(null)} disabled={submittingCash}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCashCollection}
              disabled={submittingCash || !cashConfirmed}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs font-semibold"
            >
              <Banknote className="w-3.5 h-3.5" />
              {submittingCash ? 'Recording...' : 'Confirm Cash Received'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- MODAL 4: OPERATIONAL REJECTION ---------------- */}
      <Dialog open={Boolean(rejectModalBooking)} onOpenChange={(open) => !open && setRejectModalBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Reject Manual {rejectActionType === 'ENTRY' ? 'Entry' : 'Exit'} Verification
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Log operational reason for denying vehicle verification in the security audit trail.
            </DialogDescription>
          </DialogHeader>

          {rejectModalBooking && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle:</span>
                  <span className="font-mono font-bold text-foreground">{rejectModalBooking.vehicle.vehicleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Booking ID:</span>
                  <span className="font-mono font-bold text-foreground">{rejectModalBooking.bookingReference}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <Select value={rejectReason} onValueChange={setRejectReason}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECTION_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Incident Notes</label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Additional context for supervisor review..."
                  className="text-xs resize-none h-18"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setRejectModalBooking(null)} disabled={submittingReject}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmRejection}
              disabled={submittingReject}
              className="gap-1.5 text-xs font-semibold"
            >
              <XCircle className="w-3.5 h-3.5" />
              {submittingReject ? 'Logging...' : 'Confirm Denied Verification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- MODAL 5: FULL BOOKING DETAILS ---------------- */}
      <Dialog open={Boolean(detailModalBookingId)} onOpenChange={(open) => !open && setDetailModalBookingId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Eye className="w-5 h-5 text-primary" />
              Complete Booking & Vehicle Inspection
            </DialogTitle>
          </DialogHeader>

          {loadingDetail || !bookingDetailData ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-5 py-2 text-xs">
              {/* Top Banner */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-base font-extrabold text-primary">
                    {bookingDetailData.bookingReference}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Created for {bookingDetailData.facility.parkingName}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-bold text-xs bg-primary/10 text-primary border-primary/20">
                    {bookingDetailData.bookingStatus}
                  </Badge>
                  <Badge variant="outline" className="font-bold text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    {bookingDetailData.payment.paymentStatus}
                  </Badge>
                </div>
              </div>

              {/* Grid: Customer, Vehicle, Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-border/60 bg-card/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Customer Info
                  </span>
                  <div className="font-bold text-foreground">{bookingDetailData.customer.fullName}</div>
                  <div className="text-muted-foreground">{bookingDetailData.customer.mobileNumber}</div>
                  <div className="text-muted-foreground truncate">{bookingDetailData.customer.email}</div>
                </div>

                <div className="p-3 rounded-lg border border-border/60 bg-card/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Vehicle Details
                  </span>
                  <div className="font-mono font-bold text-foreground">{bookingDetailData.vehicle.vehicleNumber}</div>
                  <div className="text-muted-foreground">Type: {bookingDetailData.vehicle.vehicleType}</div>
                  {bookingDetailData.vehicle.make && (
                    <div className="text-muted-foreground truncate">
                      {bookingDetailData.vehicle.make} {bookingDetailData.vehicle.model || ''}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg border border-border/60 bg-card/40 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Parking Bay
                  </span>
                  <div className="font-bold text-emerald-500">Slot {bookingDetailData.facility.slotNumber}</div>
                  <div className="text-muted-foreground">{bookingDetailData.facility.floorName}</div>
                  <div className="text-muted-foreground">{bookingDetailData.facility.zoneName}</div>
                </div>
              </div>

              {/* Physical Gate Movement History */}
              <div className="space-y-2">
                <span className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-primary" /> Physical Movement Logs
                </span>
                {bookingDetailData.movementLogs.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-border text-center text-muted-foreground text-xs">
                    No physical barrier movements logged yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {bookingDetailData.movementLogs.map((log) => (
                      <div
                        key={log._id}
                        className="p-2.5 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between text-[11px]"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground">
                            Entry: {log.entryTime ? new Date(log.entryTime).toLocaleString() : 'N/A'} ({log.entryMethod || 'QR Code'})
                          </div>
                          {log.exitTime && (
                            <div className="text-muted-foreground">
                              Exit: {new Date(log.exitTime).toLocaleString()} ({log.exitMethod || 'QR Code'}) • Duration: {log.stayDurationMinutes} min
                            </div>
                          )}
                        </div>
                        {log.vehicleNumberSnapshot && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted">
                            {log.vehicleNumberSnapshot}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Records */}
              <div className="space-y-2">
                <span className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-500" /> Payment Transactions
                </span>
                <div className="space-y-1.5">
                  {bookingDetailData.payments.map((pmt) => (
                    <div
                      key={pmt._id}
                      className="p-2.5 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-semibold text-foreground font-mono">{pmt.paymentReference}</span>
                        <div className="text-muted-foreground text-[10px]">
                          {pmt.paymentType} · {pmt.paymentMethod} · {new Date(pmt.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-foreground">₹{pmt.amount}</span>
                        <div className="text-[10px] text-emerald-500 font-semibold">{pmt.paymentStatus}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setDetailModalBookingId(null)} className="text-xs">
              Close Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- MODAL 6: CHRONOLOGICAL TIMELINE ---------------- */}
      <Dialog open={Boolean(timelineModalBookingId)} onOpenChange={(open) => !open && setTimelineModalBookingId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <History className="w-5 h-5 text-primary" />
              Chronological Booking Timeline
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Immutable audit timeline of system events, check-ins, and payments.
            </DialogDescription>
          </DialogHeader>

          {loadingTimeline || !timelineData ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : timelineData.timeline.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No timeline events recorded for this booking.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 py-2 text-xs before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
              {timelineData.timeline.map((evt) => (
                <div key={evt._id} className="relative space-y-1">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{evt.eventTitle}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(evt.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{evt.eventDescription}</p>
                  <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                    <span>Source: {evt.eventSource}</span>
                    {evt.performedByName && <span>• By: {evt.performedByName}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setTimelineModalBookingId(null)} className="text-xs">
              Close Timeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default SecurityManualLookupPage;
