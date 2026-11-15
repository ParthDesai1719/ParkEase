import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Clock,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Eye,
  Edit3,
  Layers,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Info,
  CheckCircle2,
  Zap,
  Accessibility,
  Star,
  Save,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  getOwnerParkingLotById,
  getOwnerParkingLotHierarchy,
  activateFacility,
  type OfficialParkingLot,
  type OfficialParkingLotHierarchy,
} from '@/api/parkingLot.api';
import {
  updateOwnerParkingLot,
  type OwnerParkingLotBusinessUpdatePayload,
} from '@/api/owner.api';

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

  // Tab State
  const initialTab = searchParams.get('tab') === 'edit' ? 'edit' : searchParams.get('tab') === 'structure' ? 'structure' : 'overview';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Data States
  const [lot, setLot] = useState<OfficialParkingLot | null>(null);
  const [hierarchy, setHierarchy] = useState<OfficialParkingLotHierarchy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit Form State
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
  const [isSaving, setIsSaving] = useState(false);

  // Go-Live Activation State
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Status Change Dialog State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<OwnerParkingLotBusinessUpdatePayload['parkingStatus']>('Active');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch Parking Lot & Structural Hierarchy
  const fetchData = useCallback(async (isManual = false) => {
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
    void fetchData();
  }, [fetchData]);

  // Synchronize Tab with URL
  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams(val === 'overview' ? {} : { tab: val });
  };

  // Handle Edit Form Submission
  const handleSaveBusinessInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!formData.contactNumber?.trim()) {
      toast.error('Contact phone number is required.');
      return;
    }

    setIsSaving(true);
    try {
      await updateOwnerParkingLot(id, formData);
      toast.success('Facility business information updated successfully.');
      void fetchData();
      setActiveTab('overview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update facility';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setFormData((prev) => {
      const current = prev.amenities || [];
      const updated = current.includes(amenity)
        ? current.filter((a) => a !== amenity)
        : [...current, amenity];
      return { ...prev, amenities: updated };
    });
  };

  // Handle Go-Live Activation
  const handleConfirmGoLive = async () => {
    if (!id) return;
    setIsActivating(true);
    try {
      const res = await activateFacility(id);
      if (res.success) {
        toast.success(`Facility "${lot?.parkingName}" is now LIVE!`);
        setShowGoLiveModal(false);
        void fetchData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to activate facility';
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  // Handle Direct Operational Status Change
  const handleStatusChangeSubmit = async () => {
    if (!id || !selectedNewStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateOwnerParkingLot(id, { parkingStatus: selectedNewStatus });
      setLot((prev) => (prev ? { ...prev, parkingStatus: selectedNewStatus } : null));
      setFormData((prev) => ({ ...prev, parkingStatus: selectedNewStatus }));
      toast.success(`Facility status updated to "${selectedNewStatus}".`);
      setShowStatusModal(false);
      void fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update parking lot status';
      toast.error(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getFacilityStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-xs">Live & Active</Badge>;
      case 'Inactive':
        return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/30 text-xs">Inactive</Badge>;
      case 'Under Maintenance':
        return <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30 text-xs">Under Maintenance</Badge>;
      case 'Temporarily Closed':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">Temporarily Closed</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const getSlotTypeBadge = (type: string) => {
    switch (type) {
      case 'EV Charging':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1"><Zap className="h-2.5 w-2.5" /> EV</Badge>;
      case 'Accessible':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] gap-1"><Accessibility className="h-2.5 w-2.5" /> Accessible</Badge>;
      case 'VIP':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-1"><Star className="h-2.5 w-2.5" /> VIP</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{type}</Badge>;
    }
  };

  const getSlotStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Available</span>;
      case 'Occupied':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">Occupied</span>;
      case 'Reserved':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">Reserved</span>;
      case 'Under Maintenance':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-500">Maintenance</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-xs text-muted-foreground">
        Loading parking facility details...
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-lg font-bold text-foreground">Facility Not Found</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          The requested parking facility could not be found or does not belong to your account.
        </p>
        <Button asChild size="sm">
          <Link to="/owner/parking-lots">Back to Parking Lots</Link>
        </Button>
      </div>
    );
  }

  const isConfirmedNotLive =
    lot.layoutReviewStatus === 'Owner Confirmed' && lot.parkingStatus !== 'Active';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. BREADCRUMBS & TOP HEADER */}
      <div>
        <Link
          to="/owner/parking-lots"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to My Parking Lots
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                Official Parking Facility
              </Badge>
              {getFacilityStatusBadge(lot.parkingStatus)}
              {lot.layoutReviewStatus && (
                <Badge variant="secondary" className="text-xs">
                  Layout: {lot.layoutReviewStatus}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {lot.parkingName}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 sm:text-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {formatAddress(lot.address)}, {lot.city}, {lot.state} &bull; Pin: {lot.postalCode}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isConfirmedNotLive && (
              <Button
                onClick={() => setShowGoLiveModal(true)}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5 shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" /> Go-Live Activation
              </Button>
            )}

            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
              <Link to={`/owner/parking-lots/${lot._id}/layout`}>
                <Eye className="h-3.5 w-3.5" />
                View 2D Layout
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData(true)}
              disabled={isRefreshing}
              className="h-9 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* 2. STATS QUICK ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="shadow-2xs border-border/80 p-4">
          <div className="text-xs text-muted-foreground">Total Bays</div>
          <div className="text-xl font-bold text-foreground mt-1">{lot.totalSlots}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{lot.totalFloors} {lot.totalFloors === 1 ? 'Floor' : 'Floors'}</div>
        </Card>

        <Card className="shadow-2xs border-border/80 p-4">
          <div className="text-xs text-muted-foreground">Available Bays</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{lot.availableSlots}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{lot.occupiedSlots ?? 0} Occupied</div>
        </Card>

        <Card className="shadow-2xs border-border/80 p-4">
          <div className="text-xs text-muted-foreground">Hourly Rate</div>
          <div className="text-xl font-bold text-foreground mt-1">₹{lot.hourlyRate}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{lot.gracePeriodMinutes ?? 15} mins grace</div>
        </Card>

        <Card className="shadow-2xs border-border/80 p-4">
          <div className="text-xs text-muted-foreground">Operating Window</div>
          <div className="text-xl font-bold text-foreground mt-1">
            {lot.isOpen24Hours ? '24/7' : `${lot.openingTime || '00:00'} - ${lot.closingTime || '23:59'}`}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{lot.isOpen24Hours ? 'Always Open' : 'Custom Hours'}</div>
        </Card>
      </div>

      {/* 3. TABS CONTAINER */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border border-border/70">
          <TabsTrigger value="overview" className="text-xs font-semibold">
            Overview & Operational Info
          </TabsTrigger>
          <TabsTrigger value="structure" className="text-xs font-semibold">
            Official Structure ({hierarchy?.floors?.length || lot.totalFloors} Floors)
          </TabsTrigger>
          <TabsTrigger value="edit" className="text-xs font-semibold gap-1.5">
            <Edit3 className="h-3.5 w-3.5" /> Edit Business Info
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Facility Details Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-bold text-foreground">Operational Information</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Public and operational details shown to customer drivers
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                {/* Dedicated Operational Status Control */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/30">
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium">Facility Operational Status:</span>
                    <div className="flex items-center gap-2 mt-1">
                      {getFacilityStatusBadge(lot.parkingStatus)}
                      <span className="text-[11px] text-muted-foreground">
                        {lot.parkingStatus === 'Active' ? '(Live & accepting bookings)' : '(Bookings paused/suspended)'}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedNewStatus((lot.parkingStatus as OwnerParkingLotBusinessUpdatePayload['parkingStatus']) || 'Active');
                      setShowStatusModal(true);
                    }}
                    className="h-8 text-xs gap-1.5 font-semibold shadow-2xs shrink-0"
                  >
                    <Activity className="h-3.5 w-3.5 text-primary" /> Change Status
                  </Button>
                </div>

                <div>
                  <span className="text-muted-foreground">Description:</span>
                  <p className="font-normal text-foreground mt-0.5 whitespace-pre-wrap">
                    {lot.description || 'No facility description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/60">
                  <div>
                    <span className="text-muted-foreground">Contact Phone:</span>
                    <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {lot.contactNumber || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Support Email:</span>
                    <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {lot.supportEmail || '—'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/60">
                  <div>
                    <span className="text-muted-foreground">Operating Schedule:</span>
                    <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {lot.isOpen24Hours ? '24 Hours Open' : `${lot.openingTime || '00:00'} to ${lot.closingTime || '23:59'}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Grace Window:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {lot.gracePeriodMinutes ?? 15} minutes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Amenities & Security Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-bold text-foreground">Amenities & Facility Services</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Features and amenities supported at this location
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {lot.amenities && lot.amenities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {lot.amenities.map((amenity) => (
                      <Badge
                        key={amenity}
                        variant="secondary"
                        className="text-xs px-2.5 py-1 gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No amenities listed yet.</p>
                )}

                <div className="pt-4 border-t border-border/60 space-y-2">
                  <h4 className="text-xs font-bold text-foreground">Visual 2D Layout Plan</h4>
                  <p className="text-xs text-muted-foreground">
                    Inspect the official floor layouts, marked lanes, entrance/exit gates, and slot placements as designed and published by platform administrators.
                  </p>
                  <Button asChild size="sm" variant="outline" className="text-xs gap-1.5 mt-2">
                    <Link to={`/owner/parking-lots/${lot._id}/layout`}>
                      <Eye className="h-3.5 w-3.5" /> Open Visual Layout Viewer
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: OFFICIAL STRUCTURE (READ-ONLY) */}
        <TabsContent value="structure" className="space-y-6">
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-foreground flex items-start gap-3">
            <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Official Physical Parking Structure (Read-Only)</span>
              <p className="text-muted-foreground mt-0.5">
                Official Floors, Zones, and Parking Slots are provisioned and topologically validated by System Administrators according to architectural guidelines. Parking owners have permitted operational access, while physical structural definitions remain strictly protected.
              </p>
            </div>
          </div>

          {!hierarchy || hierarchy.floors.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No structural floor hierarchy found for this facility.
            </div>
          ) : (
            <div className="space-y-6">
              {hierarchy.floors.map((floor) => (
                <Card key={floor._id} className="border-border/80 shadow-xs overflow-hidden">
                  <CardHeader className="bg-muted/30 py-3.5 px-5 border-b border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-bold text-foreground">
                          {floor.floorName} (Floor {floor.floorNumber})
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {floor.zones?.length || 0} Zones
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {floor.totalSlots} Slots
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    {floor.zones && floor.zones.length > 0 ? (
                      floor.zones.map((zone) => (
                        <div key={zone._id} className="rounded-lg border border-border/70 p-4 space-y-3 bg-card/60">
                          <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-foreground">{zone.zoneName}</span>
                              <span className="text-[11px] font-mono text-muted-foreground">({zone.zoneCode})</span>
                              {zone.vehicleType && (
                                <Badge variant="outline" className="text-[10px]">
                                  {zone.vehicleType}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">
                              {zone.slots?.length || 0} Slots
                            </span>
                          </div>

                          {/* Slot Chips Grid */}
                          {zone.slots && zone.slots.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                              {zone.slots.map((slot) => (
                                <div
                                  key={slot._id}
                                  className="rounded-md border border-border/60 bg-muted/20 p-2 text-center space-y-1"
                                >
                                  <div className="text-xs font-bold font-mono text-foreground">
                                    {slot.slotNumber}
                                  </div>
                                  <div className="flex flex-col gap-1 items-center">
                                    {getSlotTypeBadge(slot.slotType)}
                                    {getSlotStatusBadge(slot.slotStatus)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground italic">No slots in this zone.</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">No zones configured for this floor.</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: EDIT BUSINESS INFORMATION */}
        <TabsContent value="edit" className="space-y-6">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground">Edit Facility Information</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Update operational details, customer support contacts, operating hours, and active amenities
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSaveBusinessInfo} className="space-y-6">
                {/* Notice on protected structural fields */}
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Core structural attributes (facility location, coordinates, floors, zones, and slot layouts) are governed by administrator specifications and cannot be modified here.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact Number */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contactNumber" className="text-xs font-semibold">
                      Contact Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="contactNumber"
                      value={formData.contactNumber}
                      onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      placeholder="+91 9876543210"
                      className="text-xs h-9"
                      required
                    />
                  </div>

                  {/* Support Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="supportEmail" className="text-xs font-semibold">
                      Support Email Address
                    </Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      value={formData.supportEmail || ''}
                      onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                      placeholder="support@facility.com"
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Hourly Rate */}
                  <div className="space-y-1.5">
                    <Label htmlFor="hourlyRate" className="text-xs font-semibold">
                      Hourly Rate (₹)
                    </Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      min={0}
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Grace Period */}
                  <div className="space-y-1.5">
                    <Label htmlFor="gracePeriodMinutes" className="text-xs font-semibold">
                      Arrival Grace Period (Minutes)
                    </Label>
                    <Input
                      id="gracePeriodMinutes"
                      type="number"
                      min={0}
                      max={120}
                      value={formData.gracePeriodMinutes}
                      onChange={(e) => setFormData({ ...formData, gracePeriodMinutes: Number(e.target.value) })}
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Operational Status */}
                  <div className="space-y-1.5">
                    <Label htmlFor="parkingStatus" className="text-xs font-semibold">
                      Operational Status
                    </Label>
                    <Select
                      value={formData.parkingStatus}
                      onValueChange={(val: string) =>
                        setFormData({
                          ...formData,
                          parkingStatus: val as OwnerParkingLotBusinessUpdatePayload['parkingStatus'],
                        })
                      }
                    >
                      <SelectTrigger id="parkingStatus" className="text-xs h-9">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active (Open to Public)</SelectItem>
                        <SelectItem value="Inactive">Inactive (Suspended)</SelectItem>
                        <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                        <SelectItem value="Temporarily Closed">Temporarily Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 24 Hours Open Toggle */}
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <Label className="text-xs font-semibold mb-2">24 Hours Operation</Label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={formData.isOpen24Hours}
                        onChange={(e) =>
                          setFormData({ ...formData, isOpen24Hours: e.target.checked })
                        }
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                      <span>Facility operates 24 Hours, 7 Days a week</span>
                    </label>
                  </div>

                  {/* Operating Times (if not 24h) */}
                  {!formData.isOpen24Hours && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="openingTime" className="text-xs font-semibold">
                          Opening Time (HH:mm)
                        </Label>
                        <Input
                          id="openingTime"
                          value={formData.openingTime}
                          onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                          placeholder="06:00"
                          className="text-xs h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="closingTime" className="text-xs font-semibold">
                          Closing Time (HH:mm)
                        </Label>
                        <Input
                          id="closingTime"
                          value={formData.closingTime}
                          onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                          placeholder="23:00"
                          className="text-xs h-9"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-semibold">
                    Facility Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide driving instructions, landmarks, and parking guidance for customers..."
                    rows={3}
                    className="text-xs"
                    maxLength={1000}
                  />
                </div>

                {/* Amenities Checkboxes */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Label className="text-xs font-semibold">Supported Amenities & Services</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {ALL_AMENITIES.map((amenity) => {
                      const checked = (formData.amenities || []).includes(amenity);
                      return (
                        <label
                          key={amenity}
                          onClick={() => toggleAmenity(amenity)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${checked
                              ? 'border-primary/50 bg-primary/5 font-semibold text-primary'
                              : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => { }} // handled by parent onClick
                            className="rounded border-input text-primary"
                          />
                          <span>{amenity}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab('overview')}
                    disabled={isSaving}
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    size="sm"
                    className="text-xs font-semibold gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? 'Saving Changes...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* GO-LIVE ACTIVATION MODAL */}
      <Dialog open={showGoLiveModal} onOpenChange={setShowGoLiveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Activate Facility Go-Live
            </DialogTitle>
            <DialogDescription>
              Activating <strong>&quot;{lot.parkingName}&quot;</strong> publishes the parking facility to public discovery and enables live slot reservations by customer drivers.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Slots:</span>
              <span className="font-semibold text-foreground">{lot.totalSlots} bays</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate:</span>
              <span className="font-semibold text-foreground">₹{lot.hourlyRate} / hour</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Review Status:</span>
              <span className="font-semibold text-emerald-600">Layout Confirmed by Owner</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowGoLiveModal(false)} disabled={isActivating}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleConfirmGoLive}
              disabled={isActivating}
            >
              {isActivating ? 'Activating...' : 'Confirm & Go-Live'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CHANGE PARKING LOT STATUS MODAL */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-base">
              <Activity className="h-5 w-5 text-primary" />
              Change Facility Operational Status
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update the operational status for <strong>&quot;{lot.parkingName}&quot;</strong>. This changes customer booking availability immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {[
              {
                value: 'Active',
                label: 'Active (Live & Accepting Bookings)',
                desc: 'Facility is visible on public discovery. Drivers can find and book bays.',
                disabled: lot.layoutReviewStatus !== 'Owner Confirmed',
                disabledReason: 'Requires 2D layout confirmation before activating.',
              },
              {
                value: 'Under Maintenance',
                label: 'Under Maintenance',
                desc: 'Temporarily paused for physical maintenance or renovations. New reservations are paused.',
              },
              {
                value: 'Temporarily Closed',
                label: 'Temporarily Closed',
                desc: 'Temporarily off-duty for holidays or private events. Discovery is paused.',
              },
              {
                value: 'Inactive',
                label: 'Inactive (Suspended)',
                desc: 'Facility is deactivated and completely hidden from public search.',
              },
            ].map((option) => {
              const isSelected = selectedNewStatus === option.value;
              const isCurrent = lot.parkingStatus === option.value;

              return (
                <div
                  key={option.value}
                  onClick={() => {
                    if (!option.disabled) {
                      setSelectedNewStatus(option.value as OwnerParkingLotBusinessUpdatePayload['parkingStatus']);
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all ${option.disabled
                      ? 'opacity-50 cursor-not-allowed border-border/50 bg-muted/20'
                      : isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5 cursor-pointer'
                        : 'border-border/70 hover:border-border hover:bg-muted/30 cursor-pointer'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${option.value === 'Active'
                            ? 'bg-emerald-500'
                            : option.value === 'Under Maintenance'
                              ? 'bg-amber-500'
                              : option.value === 'Temporarily Closed'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                          }`}
                      />
                      {option.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Current Status
                        </Badge>
                      )}
                      <input
                        type="radio"
                        name="parkingStatusOption"
                        checked={isSelected}
                        disabled={option.disabled}
                        onChange={() =>
                          setSelectedNewStatus(
                            option.value as OwnerParkingLotBusinessUpdatePayload['parkingStatus'],
                          )
                        }
                        className="text-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {option.desc}
                  </p>
                  {option.disabled && (
                    <p className="text-[10px] text-amber-600 font-medium mt-1 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> {option.disabledReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowStatusModal(false)} disabled={isUpdatingStatus}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusChangeSubmit}
              disabled={isUpdatingStatus || selectedNewStatus === lot.parkingStatus}
              className="font-semibold text-xs gap-1.5"
            >
              {isUpdatingStatus ? 'Updating...' : 'Apply Status Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
