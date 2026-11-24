import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Eye,
  Layers,
  ArrowLeft,
  Sparkles,
  Info,
  Star,
  Save,
  Activity,
  Car,
  CalendarCheck,
  TrendingUp,
  MessageSquareQuote,
  Settings,
  Grid3X3,
  Search,
  Check,
  AlertTriangle,
  Send,
  DollarSign,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { useLiveSync } from '@/hooks/useLiveSync';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getOwnerParkingLotById,
  getOwnerParkingLotHierarchy,
  activateFacility,
  type OfficialParkingLot,
  type OfficialParkingLotHierarchy,
} from '@/api/parkingLot.api';
import {
  updateOwnerParkingLot,
  getOwnerSlots,
  updateOwnerSlotStatus,
  getOwnerBookings,
  type OwnerParkingLotBusinessUpdatePayload,
  type OwnerSlotItem,
  type OwnerBookingItem,
} from '@/api/owner.api';
import {
  getOwnerDashboardAnalytics,
  type OwnerDashboardAnalyticsData,
} from '@/api/ownerAnalytics.api';
import {
  getOwnerReviews,
  submitOwnerReviewReply,
  type OwnerReviewItem,
  type OwnerReviewsSummary,
} from '@/api/ownerReviews.api';
import { cn } from '@/lib/utils';

const formatAddress = (addr: OfficialParkingLot['address']): string => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.street, addr.city, addr.state].filter(Boolean).join(', ');
};

const ALL_AMENITIES = [
  'CCTV Surveillance',
  'Covered Parking',
  'EV Charging',
  'Disabled Parking',
  'Security Staff',
  'Car Wash',
  'Washroom',
  'Drinking Water',
  'Lift Access',
  'Fire Safety System',
];

export const OwnerParkingLotDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: overview | slots | bookings | analytics | reviews | settings
  const tabParam = searchParams.get('tab');
  const validTabs = ['overview', 'slots', 'bookings', 'analytics', 'reviews', 'settings'];
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Facility Data
  const [lot, setLot] = useState<OfficialParkingLot | null>(null);
  const [hierarchy, setHierarchy] = useState<OfficialParkingLotHierarchy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsRefreshing] = useState(false);

  // Settings / Edit Form State
  const [formData, setFormData] = useState<OwnerParkingLotBusinessUpdatePayload>({
    description: '',
    contactNumber: '',
    supportEmail: '',
    openingTime: '00:00',
    closingTime: '23:59',
    isOpen24Hours: false,
    hourlyRate: 0,
    gracePeriodMinutes: 15,
    amenities: [],
    parkingStatus: 'Active',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Quick Direct Operational Contacts Dialog State
  const [isEditContactsOpen, setIsEditContactsOpen] = useState(false);
  const [contactPhoneInput, setContactPhoneInput] = useState('');
  const [contactEmailInput, setContactEmailInput] = useState('');
  const [isSavingContacts, setIsSavingContacts] = useState(false);

  // Go-Live Activation State
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Status Change Dialog State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<OwnerParkingLotBusinessUpdatePayload['parkingStatus']>('Active');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // ==========================================================================
  // TAB 2: SLOTS STATE
  // ==========================================================================
  const [slots, setSlots] = useState<OwnerSlotItem[]>([]);
  const [slotStatusFilter, setSlotStatusFilter] = useState<string>('all');
  const [slotFloorFilter, setSlotFloorFilter] = useState<string>('all');
  const [slotVehicleFilter, setSlotVehicleFilter] = useState<string>('all');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [updatingSlotId, setUpdatingSlotId] = useState<string | null>(null);

  // ==========================================================================
  // TAB 3: BOOKINGS STATE
  // ==========================================================================
  const [bookings, setBookings] = useState<OwnerBookingItem[]>([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [bookingSearch, setBookingSearch] = useState<string>('');
  const [bookingPage, setBookingPage] = useState<number>(1);
  const [bookingPagination, setBookingPagination] = useState({ totalCount: 0, totalPages: 1 });
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // ==========================================================================
  // TAB 4: ANALYTICS STATE
  // ==========================================================================
  const [analyticsPreset, setAnalyticsPreset] = useState<'today' | 'this_week' | 'this_month' | 'this_year'>('this_month');
  const [analyticsData, setAnalyticsData] = useState<OwnerDashboardAnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // ==========================================================================
  // TAB 5: REVIEWS STATE
  // ==========================================================================
  const [reviews, setReviews] = useState<OwnerReviewItem[]>([]);
  const [reviewsSummary, setReviewsSummary] = useState<OwnerReviewsSummary | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Sync Tab with URL Search Params
  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  // Fetch Core Facility Details
  const fetchFacilityData = useCallback(async (isManual = false) => {
    if (!id) return;
    try {
      if (isManual) setIsRefreshing(true);
      const [lotRes, hierRes] = await Promise.all([
        getOwnerParkingLotById(id),
        getOwnerParkingLotHierarchy(id),
      ]);

      if (lotRes.success && lotRes.data) {
        const lotData = lotRes.data;
        setLot(lotData);
        setFormData({
          description: lotData.description || '',
          contactNumber: lotData.contactNumber || '',
          supportEmail: lotData.supportEmail || '',
          openingTime: lotData.openingTime || '00:00',
          closingTime: lotData.closingTime || '23:59',
          isOpen24Hours: Boolean(lotData.isOpen24Hours),
          hourlyRate: Number(lotData.hourlyRate || 0),
          gracePeriodMinutes: Number(lotData.gracePeriodMinutes ?? 15),
          amenities: lotData.amenities || [],
          parkingStatus: (lotData.parkingStatus as OwnerParkingLotBusinessUpdatePayload['parkingStatus']) || 'Active',
        });
      }

      if (hierRes.success && hierRes.data) {
        setHierarchy(hierRes.data);
      }

      if (isManual) {
        toast.success('Facility details refreshed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load parking lot details';
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchFacilityData();
  }, [fetchFacilityData]);

  useLiveSync(() => {
    void fetchFacilityData(true);
    void fetchSlotsData();
  });

  // Fetch Slots when Slots tab is active
  const fetchSlotsData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoadingSlots(true);
      const res = await getOwnerSlots({
        parkingLotId: id,
        status: slotStatusFilter !== 'all' ? slotStatusFilter : undefined,
        floorId: slotFloorFilter !== 'all' ? slotFloorFilter : undefined,
        vehicleType: slotVehicleFilter !== 'all' ? slotVehicleFilter : undefined,
        limit: 100,
      });
      if (res.slots) {
        setSlots(res.slots);
      }
    } catch {
      toast.error('Failed to load slots.');
    } finally {
      setIsLoadingSlots(false);
    }
  }, [id, slotStatusFilter, slotFloorFilter, slotVehicleFilter]);

  useEffect(() => {
    if (activeTab === 'slots') {
      void fetchSlotsData();
    }
  }, [activeTab, fetchSlotsData]);

  // Fetch Bookings when Bookings tab is active
  const fetchBookingsData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoadingBookings(true);
      const res = await getOwnerBookings({
        parkingLotId: id,
        status: bookingStatusFilter !== 'all' ? bookingStatusFilter : undefined,
        search: bookingSearch || undefined,
        page: bookingPage,
        limit: 15,
      });
      if (res && res.bookings) {
        setBookings(res.bookings);
        setBookingPagination({
          totalCount: res.total,
          totalPages: res.pages,
        });
      }
    } catch {
      toast.error('Failed to load bookings.');
    } finally {
      setIsLoadingBookings(false);
    }
  }, [id, bookingStatusFilter, bookingSearch, bookingPage]);

  useEffect(() => {
    if (activeTab === 'bookings') {
      void fetchBookingsData();
    }
  }, [activeTab, fetchBookingsData]);

  // Fetch Analytics when Analytics tab is active
  const fetchAnalyticsData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoadingAnalytics(true);
      const res = await getOwnerDashboardAnalytics({
        parkingLotId: id,
        rangePreset: analyticsPreset,
      });
      setAnalyticsData(res);
    } catch {
      toast.error('Failed to load facility analytics.');
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [id, analyticsPreset]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      void fetchAnalyticsData();
    }
  }, [activeTab, fetchAnalyticsData]);

  // Fetch Reviews when Reviews tab is active
  const fetchReviewsData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoadingReviews(true);
      const res = await getOwnerReviews({
        parkingLotId: id,
        limit: 50,
      });
      if (res && res.reviews) {
        setReviews(res.reviews);
        setReviewsSummary(res.summary);
      }
    } catch {
      toast.error('Failed to load reviews.');
    } finally {
      setIsLoadingReviews(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'reviews') {
      void fetchReviewsData();
    }
  }, [activeTab, fetchReviewsData]);

  // Slot Operational Status Toggle (Available <-> Under Maintenance)
  const handleToggleSlotStatus = async (slot: OwnerSlotItem) => {
    const nextStatus = slot.slotStatus === 'Under Maintenance' ? 'Available' : 'Under Maintenance';
    setUpdatingSlotId(slot._id);
    try {
      await updateOwnerSlotStatus(slot._id, {
        slotStatus: nextStatus,
        remarks: 'Owner operational status adjustment',
      });
      toast.success(`Slot ${slot.slotNumber} marked as ${nextStatus}.`);
      setSlots((prev) =>
        prev.map((s) => (s._id === slot._id ? { ...s, slotStatus: nextStatus } : s)),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update slot status';
      toast.error(msg);
    } finally {
      setUpdatingSlotId(null);
    }
  };

  // Submit Review Reply
  const handleSubmitReviewReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      const res = await submitOwnerReviewReply(reviewId, replyText.trim());
      if (res && res.ownerReply) {
        toast.success('Reply submitted to customer.');
        setReplyReviewId(null);
        setReplyText('');
        fetchReviewsData();
      }
    } catch {
      toast.error('Failed to submit reply.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSavingSettings(true);
    try {
      const res = await updateOwnerParkingLot(id, formData);
      if (res && res._id) {
        setLot(res);
        toast.success('Facility settings saved successfully.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings.';
      toast.error(msg);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Direct Operational Contacts Handlers
  const handleOpenEditContacts = () => {
    setContactPhoneInput(lot?.contactNumber || '');
    setContactEmailInput(lot?.supportEmail || '');
    setIsEditContactsOpen(true);
  };

  const handleSaveOperationalContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSavingContacts(true);
    try {
      const res = await updateOwnerParkingLot(id, {
        contactNumber: contactPhoneInput.trim(),
        supportEmail: contactEmailInput.trim(),
      });
      if (res && res._id) {
        setLot(res);
        setFormData((prev) => ({
          ...prev,
          contactNumber: contactPhoneInput.trim(),
          supportEmail: contactEmailInput.trim(),
        }));
        toast.success('Gate operational contacts updated successfully!');
        setIsEditContactsOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update operational contacts.';
      toast.error(msg);
    } finally {
      setIsSavingContacts(false);
    }
  };

  // Go-Live Activation Handler
  const handleGoLiveActivation = async () => {
    if (!id) return;
    setIsActivating(true);
    try {
      const res = await activateFacility(id);
      if (res.success) {
        toast.success('Facility activated successfully! Now live for public bookings.');
        setShowGoLiveModal(false);
        void fetchFacilityData(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Go-Live Activation failed.';
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  // Facility Status Badge
  const getFacilityStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">Active (Live)</Badge>;
      case 'Under Maintenance':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">Under Maintenance</Badge>;
      case 'Temporarily Closed':
        return <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-semibold">Temporarily Closed</Badge>;
      case 'Inactive':
        return <Badge className="bg-slate-600 text-white font-semibold">Inactive (Draft / Setup)</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="p-12 text-center max-w-xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Facility Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested parking facility does not exist or you do not have authorized owner access to it.
        </p>
        <Button asChild variant="outline">
          <Link to="/owner/parking-lots">Back to My Facilities</Link>
        </Button>
      </div>
    );
  }

  const isFacilityActive = lot.parkingStatus === 'Active';

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. BREADCRUMB & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link to="/owner/parking-lots" className="hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Parking Lots
            </Link>
            <span>/</span>
            <span className="text-foreground font-semibold truncate max-w-xs">{lot.parkingName}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {lot.parkingName}
            </h1>
            {getFacilityStatusBadge(lot.parkingStatus)}
            <Badge variant="outline" className="border-border text-muted-foreground font-mono text-xs">
              {lot.totalSlots} Bays • {lot.totalFloors} Floors
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {lot.parkingStatus === 'Inactive' && (
            <Button
              size="sm"
              onClick={() => setShowGoLiveModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold shadow-xs cursor-pointer text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" /> Go-Live Activation
            </Button>
          )}

          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
            <Link to={`/owner/parking-lots/${lot._id}/layout`}>
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span>2D Layout Viewer</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. LIFECYCLE WARNING BANNER (When Inactive / Pending) */}
      {!isFacilityActive && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                Facility Setup Notice ({lot.parkingStatus})
              </span>
              <p className="text-amber-800/90 dark:text-amber-300">
                This facility is not currently active for driver bookings. Official slots, live occupancy, and booking intake
                will activate once verified layout is published and Go-Live activation is confirmed.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowGoLiveModal(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            Review & Go-Live
          </Button>
        </div>
      )}

      {/* 3. QUICK STATS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="shadow-2xs border-border/80 p-4 bg-card">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Total Bays</div>
          <div className="text-2xl font-black text-foreground mt-1">{lot.totalSlots}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{lot.totalFloors} {lot.totalFloors === 1 ? 'Floor' : 'Floors'} official</div>
        </Card>

        <Card className="shadow-2xs border-border/80 p-4 bg-card">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Live Available</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{isFacilityActive ? lot.availableSlots : '-'}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{isFacilityActive ? `${lot.occupiedSlots ?? 0} Parked` : 'Setup Pending'}</div>
        </Card>

        <Card className="shadow-2xs border-border/80 p-4 bg-card">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Base Pricing</div>
          <div className="text-2xl font-black text-foreground mt-1">₹{lot.hourlyRate}<span className="text-xs font-normal text-muted-foreground">/hr</span></div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{lot.gracePeriodMinutes ?? 15} mins grace period</div>
        </Card>

        <Card className="shadow-2xs border-border/80 p-4 bg-card">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Operating Window</div>
          <div className="text-2xl font-black text-foreground mt-1">
            {lot.isOpen24Hours ? '24/7' : `${lot.openingTime || '00:00'} - ${lot.closingTime || '23:59'}`}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{lot.isOpen24Hours ? 'All-Day Access' : 'Scheduled Hours'}</div>
        </Card>
      </div>

      {/* 4. SIX FACILITY MANAGEMENT TABS */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border border-border/70 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs font-semibold gap-1.5 cursor-pointer">
            <Building2 className="w-3.5 h-3.5" />
            <span>1. Overview</span>
          </TabsTrigger>
          <TabsTrigger value="slots" className="text-xs font-semibold gap-1.5 cursor-pointer">
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>2. Slots ({lot.totalSlots})</span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="text-xs font-semibold gap-1.5 cursor-pointer">
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>3. Bookings</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs font-semibold gap-1.5 cursor-pointer">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>4. Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs font-semibold gap-1.5 cursor-pointer">
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>5. Reviews</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs font-semibold gap-1.5 cursor-pointer">
            <Settings className="w-3.5 h-3.5" />
            <span>6. Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ================================================================= */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Primary Details Card (7 Cols) */}
            <Card className="lg:col-span-7 rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-5">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Public Facility Information
                </span>
                <h3 className="text-base font-bold text-foreground mt-1">About This Parking Facility</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">
                  {lot.description || 'No detailed facility description provided.'}
                </p>
              </div>

              {/* Address & Navigation */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-2">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>Location Address</span>
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(lot.address))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 font-semibold text-[11px]"
                  >
                    Open in Maps &rarr;
                  </a>
                </div>
                <p className="text-muted-foreground leading-relaxed">{formatAddress(lot.address)}</p>
              </div>

              {/* Supported Vehicle Types */}
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">
                  Supported Vehicle Types
                </span>
                <div className="flex flex-wrap gap-2">
                  {(((lot as unknown as { supportedVehicleTypes?: string[] }).supportedVehicleTypes) || ['Bike', 'Car', 'SUV', 'EV']).map((vt: string) => (
                    <Badge key={vt} variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
                      <Car className="w-3 h-3 text-primary" />
                      {vt}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Amenities Grid */}
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">
                  Facility Amenities & Features
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_AMENITIES.map((amenity) => {
                    const hasAmenity = lot.amenities?.includes(amenity);
                    return (
                      <div
                        key={amenity}
                        className={cn(
                          'p-2 rounded-lg border text-xs flex items-center gap-2',
                          hasAmenity
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold'
                            : 'bg-muted/20 border-border/60 text-muted-foreground/60',
                        )}
                      >
                        <Check className={cn('w-3.5 h-3.5', hasAmenity ? 'text-emerald-600' : 'opacity-20')} />
                        <span className="truncate">{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Operational Shortcuts & CAD Viewer Card (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* 2D CAD Layout Card */}
              <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-primary" />
                      2D Architectural Layout
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verified canvas grid, driving lanes, and official bay allocation
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Grid3X3 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-foreground block">
                      {hierarchy?.floors?.length || lot.totalFloors} Configured Floors
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Layout validation is published and synchronized with official parking slots.
                    </span>
                  </div>
                  <Button asChild size="sm" className="w-full text-xs font-bold gap-2">
                    <Link to={`/owner/parking-lots/${lot._id}/layout`}>
                      <Eye className="w-3.5 h-3.5" />
                      Open Full 2D Layout Viewport
                    </Link>
                  </Button>
                </div>
              </Card>

              {/* Contact & Support Details */}
              <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-primary" />
                    Direct Operational Contacts
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenEditContacts}
                    className="h-7 text-xs px-2.5 font-semibold gap-1 text-primary hover:bg-primary/10 border-primary/30 cursor-pointer"
                  >
                    <span>Assign / Edit Contacts</span>
                  </Button>
                </div>
                <div className="space-y-2 pt-1 text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Gate Phone:</span>
                    <strong className="text-foreground font-mono">{lot.contactNumber || 'Not specified'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Gate Email:</span>
                    <strong className="text-foreground">{lot.supportEmail || 'Not specified'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Grace Period:</span>
                    <strong className="text-foreground">{lot.gracePeriodMinutes || 15} minutes</strong>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: SLOTS */}
        {/* ================================================================= */}
        <TabsContent value="slots" className="space-y-4">
          {/* Read-Only Architecture Notice */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>
                <strong>Administrator Governance:</strong> Official slot layout, numbering, and physical CAD coordinates are managed by system administrators. Owners may toggle operational availability (Available / Under Maintenance) for temporary inspection.
              </span>
            </div>
          </div>

          {/* Slots Filter Toolbar */}
          <Card className="rounded-xl border border-border/80 p-3 bg-card shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Slot Status</Label>
                <Select value={slotStatusFilter} onValueChange={setSlotStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                    <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Vehicle Type</Label>
                <Select value={slotVehicleFilter} onValueChange={setSlotVehicleFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicle Types</SelectItem>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="EV">EV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground mb-1 block">Floor</Label>
                <Select value={slotFloorFilter} onValueChange={setSlotFloorFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Floors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Floors</SelectItem>
                    {hierarchy?.floors?.map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.floorName} (Floor {f.floorNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Slots Table */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
            <CardContent className="p-0">
              {isLoadingSlots ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                  <Grid3X3 className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="font-semibold text-foreground">No Official Bays Found</p>
                  <p>No parking slots match the selected status or vehicle filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Bay ID</th>
                        <th className="py-3 px-4">Label</th>
                        <th className="py-3 px-4">Floor & Zone</th>
                        <th className="py-3 px-4">Vehicle Type</th>
                        <th className="py-3 px-4">Slot Status</th>
                        <th className="py-3 px-4 text-right">Operational Toggle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {slots.map((slot) => (
                        <tr key={slot._id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-foreground">{slot.slotNumber}</td>
                          <td className="py-3 px-4 font-medium text-foreground">{slot.slotLabel}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {slot.floorId?.floorName || 'Floor'} • {slot.zoneId?.zoneName || 'Zone'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                              {slot.supportedVehicleType || 'Car'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              className={cn(
                                'text-[10px] px-2 py-0.5 font-bold',
                                slot.slotStatus === 'Available'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                  : slot.slotStatus === 'Occupied'
                                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                                    : slot.slotStatus === 'Reserved'
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30',
                              )}
                            >
                              {slot.slotStatus}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={updatingSlotId === slot._id || slot.slotStatus === 'Occupied' || slot.slotStatus === 'Reserved'}
                              onClick={() => handleToggleSlotStatus(slot)}
                              className="text-xs h-7 px-2 font-semibold text-primary cursor-pointer"
                              title={
                                slot.slotStatus === 'Occupied' || slot.slotStatus === 'Reserved'
                                  ? 'Cannot toggle active driver bay'
                                  : 'Toggle operational maintenance'
                              }
                            >
                              {updatingSlotId === slot._id
                                ? 'Updating...'
                                : slot.slotStatus === 'Under Maintenance'
                                  ? 'Mark Available'
                                  : 'Mark Maintenance'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: BOOKINGS */}
        {/* ================================================================= */}
        <TabsContent value="bookings" className="space-y-4">
          {/* Booking Filters */}
          <Card className="rounded-xl border border-border/80 p-3 bg-card shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {['all', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'Overstay'].map((st) => (
                  <Button
                    key={st}
                    variant={bookingStatusFilter === st ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setBookingStatusFilter(st); setBookingPage(1); }}
                    className="h-8 text-xs font-semibold capitalize cursor-pointer"
                  >
                    {st}
                  </Button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  placeholder="Booking ref, vehicle, customer..."
                  value={bookingSearch}
                  onChange={(e) => { setBookingSearch(e.target.value); setBookingPage(1); }}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </Card>

          {/* Bookings Table */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
            <CardContent className="p-0">
              {isLoadingBookings ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : bookings.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                  <CalendarCheck className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="font-semibold text-foreground">No Bookings Found</p>
                  <p>No customer reservations match the specified filters for this facility.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Booking Ref</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Vehicle</th>
                        <th className="py-3 px-4">Bay</th>
                        <th className="py-3 px-4">Scheduled Window</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {bookings.map((b) => (
                        <tr key={b._id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                            {b.bookingReference}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-foreground block">{b.customer?.fullName || 'Walk-In Guest'}</span>
                            <span className="text-[11px] text-muted-foreground">{b.customer?.mobileNumber || 'Direct App'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                            {b.vehicle?.vehicleNumber || 'Unassigned'}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-primary">
                            {b.slot?.slotNumber || 'Assigned Bay'}
                          </td>
                          <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                            {new Date(b.scheduledEntryTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} &rarr;{' '}
                            {new Date(b.scheduledExitTime).toLocaleString('en-IN', { timeStyle: 'short' })}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-foreground">
                            ₹{b.totalAmount}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              className={cn(
                                'text-[10px] px-2 py-0.5 font-bold',
                                b.bookingStatus === 'Active'
                                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                                  : b.bookingStatus === 'Confirmed'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                                    : b.bookingStatus === 'Completed'
                                      ? 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30'
                                      : b.bookingStatus === 'Overstay'
                                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 animate-pulse'
                                        : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {b.bookingStatus}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {bookingPagination.totalPages > 1 && (
                <div className="p-3 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Page {bookingPage} of {bookingPagination.totalPages} ({bookingPagination.totalCount} records)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bookingPage <= 1}
                      onClick={() => setBookingPage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={bookingPage >= bookingPagination.totalPages}
                      onClick={() => setBookingPage((p) => p + 1)}
                      className="h-7 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 4: ANALYTICS */}
        {/* ================================================================= */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Preset Buttons */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Facility Business Metrics</span>
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/60">
              {(['today', 'this_week', 'this_month', 'this_year'] as const).map((preset) => (
                <Button
                  key={preset}
                  variant={analyticsPreset === preset ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAnalyticsPreset(preset)}
                  className="h-7 text-xs capitalize cursor-pointer font-semibold"
                >
                  {preset.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingAnalytics || !analyticsData ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Analytics KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Gross Revenue
                  </span>
                  <div className="text-2xl font-black text-foreground mt-1">
                    ₹{(analyticsData.kpis.totalRevenue || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 block mt-0.5">
                    ₹{(analyticsData.kpis.netRevenue || 0).toLocaleString('en-IN')} Net Earnings
                  </span>
                </Card>

                <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Total Bookings
                  </span>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {analyticsData.kpis.totalBookings || 0}
                  </div>
                  <span className="text-[11px] font-bold text-primary block mt-0.5">
                    {analyticsData.kpis.activeBookings || 0} In Facility Now
                  </span>
                </Card>

                <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Live Occupancy
                  </span>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {analyticsData.kpis.occupancyRate || 0}%
                  </div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    {analyticsData.kpis.occupiedSlots || 0} / {analyticsData.kpis.totalSlots || 0} Bays Parked
                  </span>
                </Card>

                <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Overstay Alerts
                  </span>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {analyticsData.kpis.overstayCount || 0}
                  </div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    {analyticsData.kpis.overstayCount ? 'Exceeded Grace Period' : 'All Clear — 0 Overstays'}
                  </span>
                </Card>
              </div>

              {/* Revenue Trends Breakdown */}
              <Card className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Daily Revenue Breakdown ({analyticsPreset.replace('_', ' ')})
                  </h3>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {analyticsData.revenueTrends?.length || 0} Recorded Days
                  </span>
                </div>

                {analyticsData.revenueTrends.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No payment transactions recorded for this facility during the selected timeframe.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analyticsData.revenueTrends.map((t) => (
                      <div key={t.date} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/20 border border-border/60">
                        <span className="font-mono font-bold text-foreground">{t.date}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{t.transactions} Txns</span>
                          <span className="font-black text-emerald-600">₹{t.revenue.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Floor Occupancy Breakdown */}
              {analyticsData.floorOccupancy && analyticsData.floorOccupancy.length > 0 && (
                <Card className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Floor-by-Floor Bay Distribution
                  </h3>
                  <div className="divide-y divide-border/60">
                    {analyticsData.floorOccupancy.map((fl) => (
                      <div key={fl.floorId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-extrabold text-foreground block">{fl.floorName}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {fl.occupiedSlots} Occupied • {fl.availableSlots} Available of {fl.totalSlots} Bays
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-muted/60 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${fl.occupancyPercentage}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-xs">{fl.occupancyPercentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 5: REVIEWS */}
        {/* ================================================================= */}
        <TabsContent value="reviews" className="space-y-6">
          {/* Reviews KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Facility Rating
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span className="text-2xl font-black text-foreground">
                  {reviewsSummary?.averageRating?.toFixed(1) || '5.0'}
                </span>
                <span className="text-xs text-muted-foreground">/ 5.0</span>
              </div>
            </Card>

            <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Total Reviews
              </span>
              <div className="text-2xl font-black text-foreground mt-1">
                {reviewsSummary?.totalReviews || reviews.length}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5">Verified driver ratings</span>
            </Card>

            <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Awaiting Response
              </span>
              <div className="text-2xl font-black text-foreground mt-1">
                {reviewsSummary?.awaitingReplyCount || 0}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5">Reviews requiring reply</span>
            </Card>
          </div>

          {/* Reviews List */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Customer Reviews & Responses</h3>

            {isLoadingReviews ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <MessageSquareQuote className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                <p className="font-semibold text-foreground">No Customer Reviews Yet</p>
                <p>When verified customer drivers review this facility after parking, their feedback will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4 divide-y divide-border/60">
                {reviews.map((rev) => (
                  <div key={rev._id} className="pt-4 first:pt-0 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{rev.customerName}</span>
                        <div className="flex items-center text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'w-3.5 h-3.5',
                                i < rev.overallRating ? 'fill-amber-500' : 'text-muted-foreground/30',
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(rev.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </span>
                    </div>

                    <p className="text-foreground leading-relaxed">{rev.comment || 'No written commentary provided.'}</p>

                    {/* Owner Response */}
                    {rev.ownerReply ? (
                      <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-primary">Your Official Response:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyReviewId(rev._id);
                              setReplyText(rev.ownerReply || '');
                            }}
                            className="text-primary hover:underline font-semibold cursor-pointer"
                          >
                            Edit Reply
                          </button>
                        </div>
                        <p className="text-foreground">{rev.ownerReply}</p>
                      </div>
                    ) : replyReviewId === rev._id ? (
                      <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/40 border border-border/80">
                        <Label className="text-[11px] font-bold">Write Response to Customer:</Label>
                        <Textarea
                          placeholder="Thank the customer or address their feedback..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={2}
                          className="text-xs resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => { setReplyReviewId(null); setReplyText(''); }}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSubmittingReply || !replyText.trim()}
                            onClick={() => handleSubmitReviewReply(rev._id)}
                            className="h-7 text-xs font-bold"
                          >
                            {isSubmittingReply ? 'Submitting...' : 'Post Reply'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyReviewId(rev._id);
                            setReplyText('');
                          }}
                          className="h-7 text-xs font-semibold gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3 h-3 text-primary" />
                          Reply to Review
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 6: SETTINGS */}
        {/* ================================================================= */}
        <TabsContent value="settings" className="space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-5">
              <div className="border-b border-border/60 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Facility Business Configuration</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Authorized pricing, operational timings, contact points, and amenities
                  </p>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingSettings}
                  className="gap-2 cursor-pointer text-xs font-bold"
                >
                  <Save className="w-4 h-4" />
                  {isSavingSettings ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>

              {/* Status Row */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground font-semibold block text-[11px]">Current Operational Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    {getFacilityStatusBadge(lot.parkingStatus)}
                    <span className="text-muted-foreground text-[11px]">
                      {lot.parkingStatus === 'Active' ? 'Facility is live and accepting bookings.' : 'Public bookings paused.'}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedNewStatus((lot.parkingStatus as OwnerParkingLotBusinessUpdatePayload['parkingStatus']) || 'Active');
                    setShowStatusModal(true);
                  }}
                  className="h-8 text-xs font-bold gap-1.5 cursor-pointer shrink-0"
                >
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  Change Facility Status
                </Button>
              </div>

              {/* Pricing & Grace Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hourlyRate" className="text-xs font-semibold">
                    Base Hourly Rate (₹) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    min="1"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                    className="text-xs h-9"
                    required
                  />
                  <span className="text-[10px] text-muted-foreground">Standard rate charged per booked hour.</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gracePeriod" className="text-xs font-semibold">
                    Grace Period (Minutes)
                  </Label>
                  <Input
                    id="gracePeriod"
                    type="number"
                    min="0"
                    max="60"
                    value={formData.gracePeriodMinutes}
                    onChange={(e) => setFormData({ ...formData, gracePeriodMinutes: Number(e.target.value) })}
                    className="text-xs h-9"
                  />
                  <span className="text-[10px] text-muted-foreground">Buffer duration before overstay penalties trigger.</span>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold">24/7 All-Day Operation</Label>
                    <p className="text-[11px] text-muted-foreground">Facility never closes and accepts reservations round the clock</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isOpen24Hours}
                    onChange={(e) => setFormData({ ...formData, isOpen24Hours: e.target.checked })}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </div>

                {!formData.isOpen24Hours && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="openTime" className="text-xs font-semibold">Opening Time</Label>
                      <Input
                        id="openTime"
                        type="time"
                        value={formData.openingTime}
                        onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="closeTime" className="text-xs font-semibold">Closing Time</Label>
                      <Input
                        id="closeTime"
                        type="time"
                        value={formData.closingTime}
                        onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                <div className="space-y-1.5">
                  <Label htmlFor="contactNumber" className="text-xs font-semibold">Gate Phone (Guard Booth / Entrance)</Label>
                  <Input
                    id="contactNumber"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.contactNumber ?? ''}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground block">Phone line connected to the facility entrance barrier and guard post.</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supportEmail" className="text-xs font-semibold">Gate Email (Operations Desk)</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    placeholder="gate@facility.com"
                    value={formData.supportEmail ?? ''}
                    onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                    className="text-xs h-9"
                  />
                  <span className="text-[10px] text-muted-foreground block">Direct operational email for customer assistance and incident reports.</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label htmlFor="description" className="text-xs font-semibold">Public Facility Description</Label>
                <Textarea
                  id="description"
                  value={formData.description ?? ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>

              {/* Amenities Checklist */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <Label className="text-xs font-semibold">Facility Amenities</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_AMENITIES.map((amenity) => {
                    const isChecked = formData.amenities?.includes(amenity);
                    return (
                      <label
                        key={amenity}
                        className={cn(
                          'flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors',
                          isChecked ? 'bg-primary/10 border-primary/30 font-semibold text-foreground' : 'bg-muted/20 border-border/60 text-muted-foreground',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...(formData.amenities || []), amenity]
                              : (formData.amenities || []).filter((a) => a !== amenity);
                            setFormData({ ...formData, amenities: next });
                          }}
                          className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                        />
                        <span>{amenity}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingSettings}
                  className="gap-2 cursor-pointer text-xs font-bold"
                >
                  <Save className="w-4 h-4" />
                  {isSavingSettings ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>
      </Tabs>

      {/* 5. GO-LIVE ACTIVATION MODAL */}
      <Dialog open={showGoLiveModal} onOpenChange={setShowGoLiveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Go-Live Facility Activation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Activating <strong>{lot.parkingName}</strong> will transition its official status to Active and open booking intake to public drivers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/30 rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bays:</span>
                <span className="font-bold">{lot.totalSlots}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hourly Rate:</span>
                <span className="font-bold">₹{lot.hourlyRate}/hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Floors:</span>
                <span className="font-bold">{lot.totalFloors}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              By confirming, you certify that physical facility signage, barrier gates, and security staff are ready on site.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGoLiveModal(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleGoLiveActivation}
              disabled={isActivating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              {isActivating ? 'Activating...' : 'Confirm Go-Live'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Assign / Edit Gate Contacts Dialog */}
      <Dialog open={isEditContactsOpen} onOpenChange={setIsEditContactsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              Assign Gate Operational Contacts
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure the direct contact numbers and email address accessible by customers, drivers, and on-site security for {lot?.parkingName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveOperationalContacts} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="quickGatePhone" className="text-xs font-semibold">
                Gate Phone Number (Guard Booth)
              </Label>
              <Input
                id="quickGatePhone"
                type="tel"
                placeholder="e.g. +91 98123 45678"
                value={contactPhoneInput}
                onChange={(e) => setContactPhoneInput(e.target.value)}
                className="text-xs h-9 font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Displayed on the customer helpline for one-tap calling when arriving at the gate.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quickGateEmail" className="text-xs font-semibold">
                Gate Email (Operations Desk)
              </Label>
              <Input
                id="quickGateEmail"
                type="email"
                placeholder="e.g. gate@facility.com"
                value={contactEmailInput}
                onChange={(e) => setContactEmailInput(e.target.value)}
                className="text-xs h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Official operational email for helpline inquiries and communication.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditContactsOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingContacts}
                className="text-xs h-8 bg-primary font-bold gap-1.5 cursor-pointer"
              >
                {isSavingContacts ? 'Saving...' : 'Save Gate Contacts'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. OPERATIONAL STATUS CHANGE MODAL */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Change Facility Operational Status</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select the operational availability for <strong>{lot.parkingName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Select Operational Status</Label>
            <Select
              value={selectedNewStatus}
              onValueChange={(val) => setSelectedNewStatus(val as OwnerParkingLotBusinessUpdatePayload['parkingStatus'])}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active (Accepting Reservations)</SelectItem>
                <SelectItem value="Under Maintenance">Under Maintenance (Temporarily Paused)</SelectItem>
                <SelectItem value="Temporarily Closed">Temporarily Closed (Off-Season / Maintenance)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowStatusModal(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!id) return;
                setIsUpdatingStatus(true);
                try {
                  const res = await updateOwnerParkingLot(id, { parkingStatus: selectedNewStatus });
                  if (res && res._id) {
                    setLot(res);
                    setShowStatusModal(false);
                    toast.success(`Facility status updated to ${selectedNewStatus}.`);
                  }
                } catch {
                  toast.error('Failed to update status.');
                } finally {
                  setIsUpdatingStatus(false);
                }
              }}
              disabled={isUpdatingStatus}
              className="text-xs font-bold"
            >
              {isUpdatingStatus ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerParkingLotDetailPage;
