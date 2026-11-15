import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Grid3X3,
  Layers,
  Search,
  RefreshCw,
  Car,
  Bike,
  Zap,
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Eye,
  Building2,
  ArrowRight,
  ShieldAlert,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getOwnerParkingLots,
  getOwnerParkingLotHierarchy,
  type OfficialParkingLot,
  type OfficialParkingLotHierarchy,
} from '@/api/parkingLot.api';
import {
  ownerApi,
  type OwnerSlotItem,
  type OwnerSlotsSummary,
  type UpdateOwnerSlotStatusPayload,
} from '@/api/owner.api';
import { getSocket } from '@/lib/socket';
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

export const OwnerSlotsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLotId = searchParams.get('lotId') || '';

  // Parking Facilities list
  const [parkingLots, setParkingLots] = useState<OfficialParkingLot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>(initialLotId);
  const [selectedLot, setSelectedLot] = useState<OfficialParkingLot | null>(null);

  // Hierarchy Data for selected facility
  const [hierarchy, setHierarchy] = useState<OfficialParkingLotHierarchy | null>(null);

  // Slots List & Summary from backend
  const [slots, setSlots] = useState<OwnerSlotItem[]>([]);
  const [summary, setSummary] = useState<OwnerSlotsSummary>({
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    maintenance: 0,
  });

  // Loading & Refreshing States
  const [isLoadingLots, setIsLoadingLots] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [selectedFloorId, setSelectedFloorId] = useState<string>('ALL');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [slotTypeFilter, setSlotTypeFilter] = useState<string>('ALL');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'hierarchical' | 'grid'>('hierarchical');

  // Debounce search query for live asynchronous searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Slot Detail & Status Change Modal States
  const [activeSlot, setActiveSlot] = useState<OwnerSlotItem | null>(null);
  const [slotDetailData, setSlotDetailData] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'Available' | 'Under Maintenance'>('Under Maintenance');
  const [maintenanceRemarks, setMaintenanceRemarks] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // 1. Fetch Owner Parking Lots on mount
  const fetchParkingLots = useCallback(async () => {
    try {
      setIsLoadingLots(true);
      const res = await getOwnerParkingLots();
      const lots = res.data?.parkingLots || [];
      setParkingLots(lots);

      if (lots.length > 0) {
        // If an initial lot was requested in URL query, pick it if valid; else default to first
        const matched = initialLotId ? lots.find((l: OfficialParkingLot) => l._id === initialLotId) : null;
        const currentLot = matched || lots[0]!;
        setSelectedLotId(currentLot._id);
        setSelectedLot(currentLot);
      } else {
        setSelectedLotId('');
        setSelectedLot(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load parking facilities';
      toast.error(msg);
    } finally {
      setIsLoadingLots(false);
    }
  }, [initialLotId]);

  useEffect(() => {
    void fetchParkingLots();
  }, [fetchParkingLots]);

  // Update URL search params when selectedLotId changes
  const handleSelectLot = (lotId: string) => {
    setSelectedLotId(lotId);
    setSearchParams({ lotId });
    const lot = parkingLots.find((l: OfficialParkingLot) => l._id === lotId) || null;
    setSelectedLot(lot);
    setSelectedFloorId('ALL');
    setSelectedZoneId('ALL');
  };

  // 2. Fetch Hierarchy & Slots for the selected parking lot
  const fetchSlotsData = useCallback(
    async (showRefreshToast = false) => {
      if (!selectedLotId) {
        setSlots([]);
        setHierarchy(null);
        return;
      }

      try {
        if (showRefreshToast) setIsRefreshing(true);
        else setIsLoadingSlots(true);

        // Fetch hierarchy and filtered slot list in parallel
        const [hierarchyRes, slotsRes] = await Promise.all([
          getOwnerParkingLotHierarchy(selectedLotId),
          ownerApi.getOwnerSlots({
            parkingLotId: selectedLotId,
            floorId: selectedFloorId !== 'ALL' ? selectedFloorId : undefined,
            zoneId: selectedZoneId !== 'ALL' ? selectedZoneId : undefined,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
            slotType: slotTypeFilter !== 'ALL' ? slotTypeFilter : undefined,
            vehicleType: vehicleTypeFilter !== 'ALL' ? vehicleTypeFilter : undefined,
            search: debouncedSearchQuery.trim() || undefined,
            limit: 200,
          }),
        ]);

        setHierarchy(hierarchyRes.data || null);
        setSlots(slotsRes.slots || []);
        if (slotsRes.summary) {
          setSummary(slotsRes.summary);
        }

        if (showRefreshToast) {
          toast.success('Slot data refreshed successfully.');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load slot data';
        toast.error(msg);
      } finally {
        setIsLoadingSlots(false);
        setIsRefreshing(false);
      }
    },
    [
      selectedLotId,
      selectedFloorId,
      selectedZoneId,
      statusFilter,
      slotTypeFilter,
      vehicleTypeFilter,
      debouncedSearchQuery,
    ],
  );

  useEffect(() => {
    void fetchSlotsData();
  }, [fetchSlotsData]);

  // 3. Socket.IO Real-time Slot Updates
  useEffect(() => {
    if (!selectedLotId) return;

    const socket = getSocket();
    socket.emit('join_lot', selectedLotId);

    const handleSlotStatusChanged = (data: {
      parkingLotId: string;
      slotId: string;
      slotNumber: string;
      slotStatus: string;
      remarks?: string | null;
    }) => {
      if (data.parkingLotId === selectedLotId) {
        toast.info(`Slot ${data.slotNumber} changed status to "${data.slotStatus}".`);
        // Refresh silently to sync all stats & slot representations
        void fetchSlotsData(false);
      }
    };

    socket.on('slot_status_changed', handleSlotStatusChanged);

    return () => {
      socket.off('slot_status_changed', handleSlotStatusChanged);
    };
  }, [selectedLotId, fetchSlotsData]);

  // 4. Open Slot Detail Modal
  const handleOpenSlotDetail = async (slot: OwnerSlotItem) => {
    setActiveSlot(slot);
    setSlotDetailData(null);
    setIsLoadingDetail(true);

    try {
      const fullDetail = await ownerApi.getOwnerSlotById(slot._id);
      setSlotDetailData(fullDetail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load slot details';
      toast.error(msg);
      // Fallback to minimal slot data
      setSlotDetailData(slot);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 5. Open Status Change Modal
  const handleInitiateStatusChange = (
    slot: OwnerSlotItem,
    target: 'Available' | 'Under Maintenance',
  ) => {
    setActiveSlot(slot);
    setTargetStatus(target);
    setMaintenanceRemarks(slot.remarks || '');
    setShowStatusModal(true);
  };

  // 6. Submit Operational Status Update
  const handleSubmitStatusChange = async () => {
    if (!activeSlot) return;

    try {
      setIsUpdatingStatus(true);
      const payload: UpdateOwnerSlotStatusPayload = {
        slotStatus: targetStatus,
        remarks: targetStatus === 'Under Maintenance' ? maintenanceRemarks.trim() || 'Owner Maintenance' : null,
      };

      const updated = await ownerApi.updateSlotOperationalStatus(activeSlot._id, payload);
      toast.success(
        `Slot ${updated.slotNumber} is now marked as "${updated.slotStatus}".`,
      );

      setShowStatusModal(false);
      setActiveSlot(null);
      setSlotDetailData(null);

      // Re-fetch slots to update local state and hierarchy counters
      void fetchSlotsData(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update slot status';
      toast.error(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Helper formatting
  const formatAddress = (addr: unknown): string => {
    if (!addr) return '—';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object' && addr !== null) {
      const a = addr as { street?: string; city?: string; state?: string };
      return [a.street, a.city, a.state].filter(Boolean).join(', ') || '—';
    }
    return String(addr);
  };

  // Helper status badge
  const renderSlotStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" /> Available
          </Badge>
        );
      case 'Reserved':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-medium">
            <Clock className="h-3 w-3" /> Reserved
          </Badge>
        );
      case 'Occupied':
        return (
          <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 gap-1 font-medium">
            <Car className="h-3 w-3" /> Occupied
          </Badge>
        );
      case 'Under Maintenance':
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30 gap-1 font-medium">
            <Wrench className="h-3 w-3" /> Under Maintenance
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper vehicle icon
  const getVehicleIcon = (vehicleType: string) => {
    switch (vehicleType?.toLowerCase()) {
      case 'bike':
        return <Bike className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'ev':
        return <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Car className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  // Filtered Hierarchy computation for hierarchical view
  const hierarchicalViewData = useMemo(() => {
    if (!hierarchy || !hierarchy.floors) return [];

    return hierarchy.floors
      .filter((fl) => selectedFloorId === 'ALL' || fl._id === selectedFloorId)
      .map((floor) => {
        const filteredZones = floor.zones
          .filter((zn) => selectedZoneId === 'ALL' || zn._id === selectedZoneId)
          .map((zone) => {
            // Find corresponding slots in the backend slots list
            const zoneSlots = slots.filter((s) => {
              const zoneMatch = (s.zoneId as any)?._id?.toString() === zone._id || s.zoneId?.toString() === zone._id;
              return zoneMatch;
            });

            return {
              ...zone,
              matchedSlots: zoneSlots,
            };
          })
          .filter((zone) => zone.matchedSlots.length > 0 || (debouncedSearchQuery === '' && statusFilter === 'ALL' && slotTypeFilter === 'ALL'));

        return {
          ...floor,
          filteredZones,
        };
      })
      .filter((floor) => floor.filteredZones.length > 0);
  }, [hierarchy, slots, selectedFloorId, selectedZoneId, debouncedSearchQuery, statusFilter, slotTypeFilter]);

  // Available floors & zones for filter selectors
  const availableFloors = hierarchy?.floors || [];
  const availableZones = useMemo(() => {
    if (!hierarchy || !hierarchy.floors) return [];
    if (selectedFloorId === 'ALL') {
      return hierarchy.floors.flatMap((fl) => fl.zones);
    }
    const currentFl = hierarchy.floors.find((fl) => fl._id === selectedFloorId);
    return currentFl ? currentFl.zones : [];
  }, [hierarchy, selectedFloorId]);

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. BREADCRUMBS & TOP CONTROLS */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link to="/owner/dashboard" className="hover:text-foreground transition-colors">
              Owner Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/owner/parking-lots" className="hover:text-foreground transition-colors">
              Parking Lots
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Slot Management</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Grid3X3 className="h-7 w-7 text-primary" />
            Slot Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 sm:text-sm">
            Monitor official parking slots, inspect real-time status, and manage operational availability.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {selectedLot && (
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
              <Link to={`/owner/parking-lots/${selectedLot._id}/layout`}>
                <Eye className="h-3.5 w-3.5 text-primary" />
                View 2D Layout
              </Link>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchSlotsData(true)}
            disabled={isRefreshing || isLoadingSlots}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. FACILITY SWITCHER & STATUS BANNER */}
      {isLoadingLots ? (
        <Card className="border-border/80 p-4">
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : parkingLots.length === 0 ? (
        <Card className="border-dashed border-2 border-border/80 text-center py-12 px-4">
          <CardContent className="space-y-3">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <CardTitle className="text-lg">No Parking Facilities Registered</CardTitle>
            <CardDescription className="max-w-md mx-auto text-xs">
              You do not have any official parking facilities assigned to your owner account yet. Once your facility submission is approved and published by platform administrators, its official slots will appear here.
            </CardDescription>
            <Button asChild size="sm" className="mt-2 text-xs">
              <Link to="/owner/parking/submissions/new">Submit Facility</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Facility Switcher Card */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-xs">
            <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Parking Facility
                  </span>
                  {selectedLot && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        selectedLot.parkingStatus === 'Active'
                          ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                          : 'border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                      }`}
                    >
                      {selectedLot.parkingStatus}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={selectedLotId} onValueChange={handleSelectLot}>
                    <SelectTrigger className="w-full sm:w-[320px] font-semibold text-sm h-9">
                      <SelectValue placeholder="Select a parking facility" />
                    </SelectTrigger>
                    <SelectContent>
                      {parkingLots.map((lot) => (
                        <SelectItem key={lot._id} value={lot._id} className="text-xs font-medium">
                          {lot.parkingName} &bull; {lot.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedLot && (
                    <Button asChild variant="ghost" size="sm" className="h-9 text-xs text-primary gap-1">
                      <Link to={`/owner/parking-lots/${selectedLot._id}`}>
                        Facility Details <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>

                {selectedLot && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {formatAddress(selectedLot.address)}, {selectedLot.city}, {selectedLot.state} &bull; Postal Code: {selectedLot.postalCode}
                  </p>
                )}
              </div>

              {/* Administrative Structural Scope Notice */}
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3 max-w-md text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">Official Structural Immutability:</span>{' '}
                    Official floor structures, slot coordinates, and vehicle designations are published and governed by platform administrators. Owners manage live operational slot availability.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Non-operational lifecycle banner if not active */}
          {selectedLot && selectedLot.parkingStatus !== 'Active' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block">Facility Not In Active Service ({selectedLot.parkingStatus})</span>
                Slots in this facility are displayed for administrative readiness and setup inspection. Public customer bookings are paused while the facility is {selectedLot.parkingStatus.toLowerCase()}.
              </div>
            </div>
          )}

          {/* 3. LIVE SLOT SUMMARY KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="border-border/80 shadow-2xs">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-medium text-muted-foreground block">Total Slots</span>
                <span className="text-xl sm:text-2xl font-bold text-foreground mt-0.5 block">
                  {summary.total}
                </span>
                <span className="text-[10px] text-muted-foreground">Official capacity</span>
              </CardContent>
            </Card>

            <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-2xs">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">Available</span>
                <span className="text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 block">
                  {summary.available}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {summary.total > 0 ? Math.round((summary.available / summary.total) * 100) : 0}% bookable
                </span>
              </CardContent>
            </Card>

            <Card className="border-indigo-500/20 bg-indigo-500/5 shadow-2xs">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 block">Occupied</span>
                <span className="text-xl sm:text-2xl font-bold text-indigo-800 dark:text-indigo-300 mt-0.5 block">
                  {summary.occupied}
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Parked on-site</span>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5 shadow-2xs">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block">Reserved</span>
                <span className="text-xl sm:text-2xl font-bold text-amber-800 dark:text-amber-300 mt-0.5 block">
                  {summary.reserved}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">Incoming bookings</span>
              </CardContent>
            </Card>

            <Card className="border-slate-500/20 bg-slate-500/5 shadow-2xs">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">Maintenance</span>
                <span className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {summary.maintenance}
                </span>
                <span className="text-[10px] text-muted-foreground">Maintenance / Offline</span>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-2xs">
              <CardContent className="p-3.5">
                <span className="text-[11px] font-medium text-muted-foreground block">Occupancy Rate</span>
                <span className="text-xl sm:text-2xl font-bold text-foreground mt-0.5 block">
                  {summary.total > 0
                    ? Math.round(((summary.occupied + summary.reserved) / summary.total) * 100)
                    : 0}
                  %
                </span>
                <span className="text-[10px] text-muted-foreground">Active usage</span>
              </CardContent>
            </Card>
          </div>

          {/* 4. FILTER TOOLBAR & NAVIGATION TABS */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-4 space-y-4">
              {/* Floor Selector Tabs */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Select Floor Level
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={selectedFloorId === 'ALL' ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedFloorId('ALL');
                      setSelectedZoneId('ALL');
                    }}
                    className="h-8 text-xs font-semibold"
                  >
                    All Floors ({hierarchy?.stats?.totalSlots ?? slots.length})
                  </Button>
                  {availableFloors.map((fl) => (
                    <Button
                      key={fl._id}
                      size="sm"
                      variant={selectedFloorId === fl._id ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedFloorId(fl._id);
                        setSelectedZoneId('ALL');
                      }}
                      className="h-8 text-xs font-semibold gap-1.5"
                    >
                      <Layers className="h-3 w-3" />
                      {fl.floorName} ({fl.totalSlots} slots)
                    </Button>
                  ))}
                </div>
              </div>

              {/* Zone Selector Pills if specific floor or all */}
              {availableZones.length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Select Zone
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={selectedZoneId === 'ALL' ? 'secondary' : 'ghost'}
                      onClick={() => setSelectedZoneId('ALL')}
                      className="h-7 text-xs px-2.5"
                    >
                      All Zones
                    </Button>
                    {availableZones.map((zn) => (
                      <Button
                        key={zn._id}
                        size="sm"
                        variant={selectedZoneId === zn._id ? 'secondary' : 'ghost'}
                        onClick={() => setSelectedZoneId(zn._id)}
                        className="h-7 text-xs px-2.5 gap-1"
                      >
                        {getVehicleIcon(zn.vehicleType || '')}
                        <span>{zn.zoneName} ({zn.zoneCode})</span>
                        <span className="text-muted-foreground ml-0.5 text-[10px]">
                          [{zn.totalSlots}]
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & Multi-Criteria Filters Row */}
              <div className="pt-3 border-t border-border/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative w-full sm:w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search slot number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                      <SelectItem value="Available" className="text-xs">Available</SelectItem>
                      <SelectItem value="Reserved" className="text-xs">Reserved</SelectItem>
                      <SelectItem value="Occupied" className="text-xs">Occupied</SelectItem>
                      <SelectItem value="Under Maintenance" className="text-xs">Under Maintenance</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Slot Type Filter */}
                  <Select value={slotTypeFilter} onValueChange={setSlotTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
                      <SelectValue placeholder="All Slot Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All Slot Types</SelectItem>
                      <SelectItem value="Standard" className="text-xs">Standard</SelectItem>
                      <SelectItem value="Compact" className="text-xs">Compact</SelectItem>
                      <SelectItem value="Premium" className="text-xs">Premium</SelectItem>
                      <SelectItem value="EV Charging" className="text-xs">EV Charging</SelectItem>
                      <SelectItem value="Accessible" className="text-xs">Accessible</SelectItem>
                      <SelectItem value="Reserved" className="text-xs">Reserved</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Vehicle Type Filter */}
                  <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Vehicle Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All Vehicles</SelectItem>
                      <SelectItem value="Car" className="text-xs">Car</SelectItem>
                      <SelectItem value="Bike" className="text-xs">Bike</SelectItem>
                      <SelectItem value="SUV" className="text-xs">SUV</SelectItem>
                      <SelectItem value="EV" className="text-xs">EV</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Reset Filters */}
                  {(searchQuery || statusFilter !== 'ALL' || slotTypeFilter !== 'ALL' || vehicleTypeFilter !== 'ALL' || selectedFloorId !== 'ALL' || selectedZoneId !== 'ALL') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('ALL');
                        setSlotTypeFilter('ALL');
                        setVehicleTypeFilter('ALL');
                        setSelectedFloorId('ALL');
                        setSelectedZoneId('ALL');
                      }}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 border border-border/80 rounded-lg p-0.5 bg-muted/40 shrink-0 self-end lg:self-auto">
                  <Button
                    size="sm"
                    variant={viewMode === 'hierarchical' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('hierarchical')}
                    className="h-7 text-xs px-2.5 font-medium"
                  >
                    <Layers className="h-3 w-3 mr-1" /> Hierarchy
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('grid')}
                    className="h-7 text-xs px-2.5 font-medium"
                  >
                    <Grid3X3 className="h-3 w-3 mr-1" /> Flat Grid
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. INTERACTIVE SLOTS DISPLAY */}
          {isLoadingSlots ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: 16 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <Card className="border-dashed border-2 border-border/80 text-center py-12 px-4">
              <CardContent className="space-y-2">
                <Grid3X3 className="h-10 w-10 text-muted-foreground mx-auto" />
                <CardTitle className="text-base">No Matching Parking Slots Found</CardTitle>
                <CardDescription className="text-xs">
                  No slots match your active filters or search criteria. Try clearing or broadening your filters.
                </CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setSlotTypeFilter('ALL');
                    setVehicleTypeFilter('ALL');
                    setSelectedFloorId('ALL');
                    setSelectedZoneId('ALL');
                  }}
                  className="mt-2 text-xs"
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'hierarchical' ? (
            /* 5A. HIERARCHICAL VIEW (Floor -> Zone -> Slots) */
            <div className="space-y-6">
              {hierarchicalViewData.map((floor) => (
                <Card key={floor._id} className="border-border/80 shadow-xs overflow-hidden">
                  <CardHeader className="bg-muted/40 py-3.5 px-5 border-b border-border/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {floor.floorNumber}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold text-foreground">
                            {floor.floorName}
                          </CardTitle>
                          <CardDescription className="text-[11px] text-muted-foreground">
                            Level {floor.floorNumber} &bull; {floor.zones.length} Zones &bull; {floor.totalSlots} Slots
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Floor Status: {floor.floorStatus}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-6">
                    {floor.filteredZones.map((zone) => (
                      <div key={zone._id} className="space-y-3">
                        {/* Zone Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              {getVehicleIcon(zone.vehicleType || '')}
                              {zone.zoneName} ({zone.zoneCode})
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {zone.vehicleType}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Showing {zone.matchedSlots.length} of {zone.totalSlots} slots
                          </span>
                        </div>

                        {/* Zone Slots Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                          {zone.matchedSlots.map((slot) => (
                            <SlotCard
                              key={slot._id}
                              slot={slot}
                              onClick={() => void handleOpenSlotDetail(slot)}
                              onQuickStatusToggle={(target) => handleInitiateStatusChange(slot, target)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* 5B. FLAT GRID VIEW */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Showing {slots.length} matching slots</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {slots.map((slot) => (
                  <SlotCard
                    key={slot._id}
                    slot={slot}
                    onClick={() => void handleOpenSlotDetail(slot)}
                    onQuickStatusToggle={(target) => handleInitiateStatusChange(slot, target)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. SLOT DETAIL MODAL */}
      <Dialog open={!!activeSlot && !showStatusModal} onOpenChange={(open) => !open && setActiveSlot(null)}>
        <DialogContent className="max-w-lg sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
                Official Parking Slot
              </Badge>
              {activeSlot && renderSlotStatusBadge(activeSlot.slotStatus)}
            </div>
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span>Slot {activeSlot?.slotNumber} ({activeSlot?.slotLabel})</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Structural and operational properties for slot #{activeSlot?.slotNumber}
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetail ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : activeSlot ? (
            <div className="space-y-4 py-2 text-xs">
              {/* Hierarchy Location Box */}
              <div className="p-3 rounded-lg border border-border/70 bg-muted/30 space-y-1.5">
                <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider block">
                  Location in Facility Hierarchy
                </span>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    <span className="text-[10px] block">Parking Facility:</span>
                    <span className="font-medium text-foreground">{activeSlot.parkingLotId?.parkingName || selectedLot?.parkingName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block">Floor Level:</span>
                    <span className="font-medium text-foreground">{activeSlot.floorId?.floorName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block">Zone:</span>
                    <span className="font-medium text-foreground">
                      {activeSlot.zoneId?.zoneName} ({activeSlot.zoneId?.zoneCode})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] block">QR Identifier:</span>
                    <span className="font-mono text-[11px] text-foreground font-semibold">
                      {activeSlot.qrIdentifier}
                    </span>
                  </div>
                </div>
              </div>

              {/* Slot Technical Properties */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/70">
                <div>
                  <span className="text-muted-foreground text-[10px] block">Slot Type:</span>
                  <span className="font-bold text-foreground text-xs">{activeSlot.slotType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">Compatible Vehicle:</span>
                  <span className="font-bold text-foreground text-xs flex items-center gap-1 mt-0.5">
                    {getVehicleIcon(activeSlot.supportedVehicleType)} {activeSlot.supportedVehicleType}
                  </span>
                </div>
              </div>

              {/* Active Booking Context (if Reserved or Occupied) */}
              {(activeSlot.slotStatus === 'Occupied' || activeSlot.slotStatus === 'Reserved') && (
                <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 text-xs flex items-center gap-1.5">
                      <Car className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Active Customer Booking
                    </span>
                    <Badge variant="outline" className="border-indigo-400/40 text-indigo-700 dark:text-indigo-300 text-[10px]">
                      {activeSlot.slotStatus}
                    </Badge>
                  </div>

                  {slotDetailData?.activeBooking ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-muted-foreground text-[10px] block">Booking Ref:</span>
                        <span className="font-mono font-bold text-foreground">
                          {slotDetailData.activeBooking.bookingReference}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">Customer:</span>
                        <span className="font-medium text-foreground">
                          {slotDetailData.activeBooking.customerId?.fullName || 'Registered Driver'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">Vehicle Plate:</span>
                        <span className="font-semibold text-foreground">
                          {slotDetailData.activeBooking.vehicleId?.vehicleNumber || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px] block">Vehicle Model:</span>
                        <span className="text-foreground">
                          {slotDetailData.activeBooking.vehicleId?.vehicleBrand} {slotDetailData.activeBooking.vehicleId?.vehicleModel || ''}
                        </span>
                      </div>
                      {slotDetailData.activeBooking.scheduledEntryTime && (
                        <div className="col-span-2 text-muted-foreground text-[10px] pt-1 border-t border-indigo-200/40 dark:border-indigo-800/40">
                          Schedule: {new Date(slotDetailData.activeBooking.scheduledEntryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &rarr; {new Date(slotDetailData.activeBooking.scheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Active booking record linked. Customer arrival or parking session in progress.
                    </p>
                  )}
                </div>
              )}

              {/* Maintenance Context (if Under Maintenance) */}
              {activeSlot.slotStatus === 'Under Maintenance' && (
                <div className="p-3.5 rounded-xl border border-slate-500/30 bg-slate-500/5 space-y-1.5">
                  <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    Maintenance / Offline Status
                  </span>
                  <p className="text-muted-foreground text-[11px]">
                    {activeSlot.remarks ? `Reason: ${activeSlot.remarks}` : 'No specific maintenance remarks specified.'}
                  </p>
                </div>
              )}

              {/* Operational Status Action Notice */}
              <div className="pt-2 border-t border-border/60">
                {activeSlot.slotStatus === 'Occupied' || activeSlot.slotStatus === 'Reserved' ? (
                  <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <span>
                      Operational status modifications are disabled while a slot is actively reserved or occupied. This protects scheduled customer bookings from invalidation.
                    </span>
                  </div>
                ) : activeSlot.slotStatus === 'Available' ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground text-xs block">Operational Status Action</span>
                      <span className="text-[11px] text-muted-foreground">
                        Place this slot under maintenance to temporarily block customer reservations.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInitiateStatusChange(activeSlot, 'Under Maintenance')}
                      className="text-xs h-8 gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Wrench className="h-3.5 w-3.5" /> Mark Under Maintenance
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground text-xs block">Operational Status Action</span>
                      <span className="text-[11px] text-muted-foreground">
                        Return this slot to active service to make it bookable by public customers.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInitiateStatusChange(activeSlot, 'Available')}
                      className="text-xs h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Return to Available
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveSlot(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. OPERATIONAL STATUS CHANGE CONFIRMATION DIALOG */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {targetStatus === 'Under Maintenance' ? (
                <>
                  <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Place Slot Under Maintenance
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Return Slot to Available Service
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm operational availability transition for Slot #{activeSlot?.slotNumber} ({activeSlot?.slotLabel})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {targetStatus === 'Under Maintenance' ? (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Placing slot <strong>#{activeSlot?.slotNumber}</strong> under maintenance will temporarily block it from customer searches and reservations.
                </p>
                <div className="space-y-1.5">
                  <span className="font-medium text-foreground block">
                    Maintenance Reason / Remarks (Optional)
                  </span>
                  <Textarea
                    placeholder="e.g. Surface repainting, ultrasonic sensor recalibration, or reserved for maintenance inspection"
                    value={maintenanceRemarks}
                    onChange={(e) => setMaintenanceRemarks(e.target.value)}
                    maxLength={250}
                    rows={3}
                    className="text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">Maximum 250 characters</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Returning slot <strong>#{activeSlot?.slotNumber}</strong> to <strong>Available</strong> status will immediately restore it to the customer booking pool.
                </p>
                <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300 text-[11px]">
                  Hierarchy slot counts for floor &ldquo;{activeSlot?.floorId?.floorName}&rdquo; and zone &ldquo;{activeSlot?.zoneId?.zoneName}&rdquo; will automatically update.
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusModal(false)}
              disabled={isUpdatingStatus}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSubmitStatusChange()}
              disabled={isUpdatingStatus}
              className={`text-xs font-semibold ${
                targetStatus === 'Under Maintenance'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isUpdatingStatus ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> Updating...
                </>
              ) : targetStatus === 'Under Maintenance' ? (
                'Confirm Maintenance'
              ) : (
                'Confirm Available Status'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==========================================
// SUB-COMPONENT: Individual Slot Card
// ==========================================
interface SlotCardProps {
  slot: OwnerSlotItem;
  onClick: () => void;
  onQuickStatusToggle: (target: 'Available' | 'Under Maintenance') => void;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, onClick, onQuickStatusToggle }) => {
  const isAvailable = slot.slotStatus === 'Available';
  const isOccupied = slot.slotStatus === 'Occupied';
  const isReserved = slot.slotStatus === 'Reserved';
  const isMaintenance = slot.slotStatus === 'Under Maintenance';

  const cardBorderClass = isAvailable
    ? 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5 hover:bg-emerald-500/10'
    : isOccupied
    ? 'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5 hover:bg-indigo-500/10'
    : isReserved
    ? 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10'
    : 'border-slate-500/30 hover:border-slate-500/60 bg-slate-500/5 hover:bg-slate-500/10';

  const statusIndicatorClass = isAvailable
    ? 'bg-emerald-500 text-emerald-950 dark:text-emerald-100'
    : isOccupied
    ? 'bg-indigo-500 text-indigo-950 dark:text-indigo-100'
    : isReserved
    ? 'bg-amber-500 text-amber-950 dark:text-amber-100'
    : 'bg-slate-500 text-slate-100';

  const getVehicleIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'bike':
        return <Bike className="h-3 w-3 text-muted-foreground" />;
      case 'ev':
        return <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Car className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border p-2.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between select-none ${cardBorderClass}`}
    >
      {/* Top Row: Slot Number & Vehicle Type Icon */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-extrabold text-sm tracking-tight text-foreground truncate">
          {slot.slotNumber}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {getVehicleIcon(slot.supportedVehicleType)}
        </div>
      </div>

      {/* Middle: Slot Label & Slot Type */}
      <div className="space-y-0.5 my-1">
        <span className="text-[11px] font-medium text-foreground block truncate">
          {slot.slotLabel}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {slot.slotType}
          </span>
          {slot.slotType === 'EV Charging' && (
            <Zap className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          {slot.slotType === 'Accessible' && (
            <Accessibility className="h-2.5 w-2.5 text-blue-600 shrink-0" />
          )}
        </div>
      </div>

      {/* Bottom Row: Status Pill */}
      <div className="mt-1 pt-1.5 border-t border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusIndicatorClass}`} />
          <span className="text-[10px] font-semibold text-foreground truncate">
            {slot.slotStatus}
          </span>
        </div>

        {/* Quick action button for Available or Maintenance */}
        {isAvailable && (
          <button
            type="button"
            title="Mark for maintenance"
            onClick={(e) => {
              e.stopPropagation();
              onQuickStatusToggle('Under Maintenance');
            }}
            className="text-[10px] text-muted-foreground hover:text-amber-600 p-0.5 rounded-sm hover:bg-muted"
          >
            <Wrench className="h-2.5 w-2.5" />
          </button>
        )}

        {isMaintenance && (
          <button
            type="button"
            title="Return to available"
            onClick={(e) => {
              e.stopPropagation();
              onQuickStatusToggle('Available');
            }}
            className="text-[10px] text-muted-foreground hover:text-emerald-600 p-0.5 rounded-sm hover:bg-muted"
          >
            <CheckCircle2 className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
};
export default OwnerSlotsPage;
