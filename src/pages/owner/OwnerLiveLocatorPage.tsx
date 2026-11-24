import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Car,
  Bike,
  Zap,
  Truck,
  Clock,
  Search,
  Building2,
  AlertTriangle,
  Navigation,
  Layers,
  User,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  getOwnerVehiclesOverview,
  getOwnerLiveVehicleLocator,
  type LocatorSlotItem,
} from '@/api/ownerVehicles.api';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

export const OwnerLiveLocatorPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const urlLotId = searchParams.get('lotId');
  const [selectedLotId, setSelectedLotId] = useState<string>(urlLotId || '');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSlot, setSelectedSlot] = useState<LocatorSlotItem | null>(null);

  // 1. Fetch Overview to get owner's parking lots list
  const { data: overviewData, isLoading: isLoadingOverview } = useQuery({
    queryKey: ['owner-vehicles-overview-lots'],
    queryFn: () => getOwnerVehiclesOverview(),
  });

  const ownerLots = overviewData?.ownerLots || [];

  // Automatically select first parking lot if none selected
  useEffect(() => {
    if (!selectedLotId && ownerLots.length > 0) {
      setSelectedLotId(ownerLots[0]._id);
      setSearchParams({ lotId: ownerLots[0]._id });
    }
  }, [ownerLots, selectedLotId, setSearchParams]);

  // Sync state if URL changes
  useEffect(() => {
    if (urlLotId && urlLotId !== selectedLotId) {
      setSelectedLotId(urlLotId);
    }
  }, [urlLotId]);

  // 2. Fetch Live Locator for selected lot and floor
  const {
    data: locatorData,
    isLoading: isLoadingLocator,
    refetch: refetchLocator,
  } = useQuery({
    queryKey: ['owner-live-locator', selectedLotId, selectedFloorId],
    queryFn: () =>
      getOwnerLiveVehicleLocator({
        parkingLotId: selectedLotId,
        floorId: selectedFloorId || undefined,
      }),
    enabled: !!selectedLotId,
  });

  useLiveSync(() => {
    if (selectedLotId) {
      void refetchLocator();
    }
  });

  // Automatically sync floor tabs when data loads
  useEffect(() => {
    if (locatorData?.selectedFloor && !selectedFloorId) {
      setSelectedFloorId(locatorData.selectedFloor._id);
    }
  }, [locatorData, selectedFloorId]);

  // 3. Real-time updates via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    const handleSync = () => {
      void queryClient.invalidateQueries({ queryKey: ['owner-live-locator'] });
      void queryClient.invalidateQueries({ queryKey: ['owner-vehicles-overview'] });
    };

    socket.on('slot_availability_updated', handleSync);
    socket.on('booking_updated', handleSync);
    socket.on('live_vehicle_update', handleSync);

    return () => {
      socket.off('slot_availability_updated', handleSync);
      socket.off('booking_updated', handleSync);
      socket.off('live_vehicle_update', handleSync);
    };
  }, [queryClient]);

  // Handle lot change
  const handleLotChange = (newLotId: string) => {
    setSelectedLotId(newLotId);
    setSelectedFloorId('');
    setSelectedSlot(null);
    setSearchParams({ lotId: newLotId });
  };

  // Filter slots by search query (slotNumber or vehicle plate) and status
  const filteredSlots = (locatorData?.slots || []).filter((slot) => {
    const matchesSearch =
      !searchQuery.trim() ||
      slot.slotNumber.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (slot.vehicle?.vehicleNumber &&
        slot.vehicle.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
      (slot.customer?.fullName &&
        slot.customer.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'available' && slot.locatorStatus === 'AVAILABLE') ||
      (statusFilter === 'inside' && slot.locatorStatus === 'PARKED_INSIDE') ||
      (statusFilter === 'overstay' && slot.locatorStatus === 'OVERSTAYING') ||
      (statusFilter === 'expected' && slot.locatorStatus === 'EXPECTED') ||
      (statusFilter === 'maintenance' && slot.locatorStatus === 'MAINTENANCE');

    return matchesSearch && matchesStatus;
  });

  // Icon helper based on vehicle type
  const getVehicleIcon = (type?: string) => {
    switch (type?.toUpperCase()) {
      case 'TWO_WHEELER':
      case 'BIKE':
        return <Bike className="w-4 h-4 text-primary" />;
      case 'EV':
      case 'ELECTRIC':
        return <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 font-bold" />;
      case 'TRUCK':
      case 'HEAVY':
        return <Truck className="w-4 h-4 text-primary" />;
      default:
        return <Car className="w-4 h-4 text-foreground" />;
    }
  };

  // Status visual styles for bay grid cards
  const getStatusCardStyle = (status: LocatorSlotItem['locatorStatus']) => {
    switch (status) {
      case 'PARKED_INSIDE':
        return 'border-blue-400/80 bg-blue-50/90 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-sm hover:border-blue-500';
      case 'OVERSTAYING':
        return 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-950 dark:text-rose-100 shadow-md ring-2 ring-rose-500/30 animate-pulse-subtle';
      case 'EXPECTED':
        return 'border-amber-400/80 bg-amber-50/90 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 shadow-sm hover:border-amber-500';
      case 'MAINTENANCE':
        return 'border-border bg-muted/60 text-muted-foreground';
      case 'AVAILABLE':
      default:
        return 'border-emerald-300 dark:border-emerald-700/60 bg-card hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-foreground shadow-2xs hover:border-emerald-500';
    }
  };

  const getStatusBadge = (status: LocatorSlotItem['locatorStatus']) => {
    switch (status) {
      case 'PARKED_INSIDE':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-2 py-0.5 shadow-2xs">
            Parked Inside
          </Badge>
        );
      case 'OVERSTAYING':
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] px-2 py-0.5 shadow-2xs animate-pulse">
            Overstaying
          </Badge>
        );
      case 'EXPECTED':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2 py-0.5 shadow-2xs">
            Expected
          </Badge>
        );
      case 'MAINTENANCE':
        return (
          <Badge variant="secondary" className="font-semibold text-[10px] px-2 py-0.5">
            Maintenance
          </Badge>
        );
      case 'AVAILABLE':
      default:
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 shadow-2xs">
            Available
          </Badge>
        );
    }
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-in fade-in-50 duration-300 pb-16">
      {/* 1. TOP HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 font-bold text-xs">
              Live Fleet Telemetry
            </Badge>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live Visual Map
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Navigation className="h-7 w-7 text-primary" />
            Live Vehicle Locator
          </h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            Real-time interactive floor grid of bays, parked vehicles, license plates, and active dwell timers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/owner/vehicles">
            <Button variant="outline" size="sm" className="gap-2 text-xs font-bold border-border shadow-2xs h-9">
              <Car className="w-4 h-4 text-primary" />
              Vehicle List View
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. FACILITY SWITCHER, REAL-TIME STATS STRIP & FLOOR TABS */}
      <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Facility Dropdown */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <label className="text-[11px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                Select Parking Facility
              </label>
              <div className="mt-1">
                {isLoadingOverview ? (
                  <Skeleton className="h-9 w-64 rounded-lg" />
                ) : ownerLots.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-semibold">No approved facilities available.</p>
                ) : (
                  <select
                    value={selectedLotId}
                    onChange={(e) => handleLotChange(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 py-1 text-xs font-bold text-foreground shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[260px]"
                  >
                    {ownerLots.map((lot) => (
                      <option key={lot._id} value={lot._id}>
                        {lot.parkingName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Live Occupancy Metric Strip */}
          {locatorData?.summary && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 bg-muted/40 p-2 rounded-xl border border-border/60 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-foreground font-bold shadow-2xs">
                <span className="text-muted-foreground text-[11px]">Total Bays:</span>
                <span className="text-foreground font-black">{locatorData.summary.totalSlots}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-900 dark:text-blue-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                <span>Parked:</span>
                <span className="font-black">{locatorData.summary.occupiedCount}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                <span>Expected:</span>
                <span className="font-black">{locatorData.summary.expectedCount}</span>
              </div>
              {locatorData.summary.overstayCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-950 dark:text-rose-200 font-black animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  <span>Overstaying:</span>
                  <span>{locatorData.summary.overstayCount}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                <span>Available:</span>
                <span className="font-black">{locatorData.summary.availableCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Floor Navigation Tabs */}
        {locatorData?.floors && locatorData.floors.length > 0 && (
          <div className="border-t border-border/80 pt-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider whitespace-nowrap flex items-center gap-1 mr-2">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Floors:
              </span>
              {locatorData.floors.map((floor) => {
                const isActive = (selectedFloorId || locatorData.selectedFloor?._id) === floor._id;
                return (
                  <button
                    key={floor._id}
                    onClick={() => {
                      setSelectedFloorId(floor._id);
                      setSelectedSlot(null);
                    }}
                    className={cn(
                      'px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 cursor-pointer',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card text-foreground border-border hover:bg-muted/70 hover:border-border/80',
                    )}
                  >
                    <span>{floor.floorName}</span>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold',
                        isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {floor.totalSlots} bays
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 3. SEARCH & STATUS FILTER CHIPS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bay number, license plate, or customer name..."
              className="pl-9 h-9 text-xs font-medium border-border bg-card shadow-2xs text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="h-9 px-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Bays' },
            { id: 'inside', label: 'Parked Inside' },
            { id: 'overstay', label: 'Overstaying' },
            { id: 'expected', label: 'Expected' },
            { id: 'available', label: 'Available' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer shadow-2xs',
                statusFilter === chip.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-muted/60',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. MAIN BAY GRID (FULL WIDTH) */}
      <div className="w-full">
        {isLoadingLocator ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {Array.from({ length: 18 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : filteredSlots.length === 0 ? (
          <Card className="rounded-xl border border-border/80 bg-card p-12 text-center shadow-2xs">
            <Navigation className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground">No Parking Bays Match Criteria</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 font-medium">
              Try adjusting your search terms or status filters, or select another floor.
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-4 text-xs font-bold"
              >
                Reset Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {filteredSlots.map((slot) => {
              const isSelected = selectedSlot?.slotId === slot.slotId;
              const statusStyle = getStatusCardStyle(slot.locatorStatus);

              return (
                <div
                  key={slot.slotId}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    'p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[148px] relative group hover:scale-[1.02] duration-200',
                    statusStyle,
                    isSelected && 'ring-2 ring-primary ring-offset-2 border-primary shadow-md',
                  )}
                >
                  {/* Top Row: Bay Number & Vehicle Icon */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-black text-sm tracking-tight text-foreground">
                        {slot.slotNumber}
                      </span>
                      <div className="p-1 rounded-md bg-background/90 shadow-2xs border border-border/60">
                        {getVehicleIcon(slot.supportedVehicleType)}
                      </div>
                    </div>

                    {/* Zone info */}
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate mb-2">
                      {slot.zoneName || `Zone ${slot.zoneCode}`}
                    </div>
                  </div>

                  {/* Middle: Vehicle Plate / Reserved / Empty */}
                  <div className="my-1.5">
                    {slot.vehicle ? (
                      <div className="bg-background/95 rounded-lg p-2 border border-border shadow-xs">
                        <div className="font-mono font-black text-xs text-foreground tracking-wider truncate">
                          {slot.vehicle.vehicleNumber}
                        </div>
                        <div className="text-[10px] font-semibold text-muted-foreground truncate mt-0.5">
                          {slot.vehicle.brand} {slot.vehicle.model}
                        </div>
                      </div>
                    ) : slot.locatorStatus === 'EXPECTED' ? (
                      <div className="bg-amber-500/15 rounded-lg p-2 border border-amber-500/30">
                        <div className="font-extrabold text-[11px] text-amber-900 dark:text-amber-300 truncate">
                          Reserved
                        </div>
                        <div className="text-[10px] font-medium text-amber-800 dark:text-amber-400 truncate">
                          {slot.customer?.fullName || 'Customer In Transit'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2.5">
                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                          Available
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Status Badge & Live Duration */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-1">
                    {getStatusBadge(slot.locatorStatus)}

                    {slot.movement && (
                      <span className="text-[10px] font-mono font-extrabold text-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-primary" />
                        {formatDuration(slot.movement.stayDurationMinutes)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. POP-UP MODAL BOX WITH BLURRED BACKDROP FOR SLOT DETAILS */}
      <Dialog open={!!selectedSlot} onOpenChange={(open) => !open && setSelectedSlot(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl bg-card">
          {selectedSlot && (
            <div>
              {/* Modal Header */}
              <DialogHeader className="p-5 bg-muted/50 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <DialogTitle className="text-xl font-black text-foreground">
                    Bay {selectedSlot.slotNumber}
                  </DialogTitle>
                  {getStatusBadge(selectedSlot.locatorStatus)}
                </div>
                <DialogDescription className="text-xs font-semibold text-muted-foreground mt-1">
                  {selectedSlot.floorName} &bull; Zone {selectedSlot.zoneCode} ({selectedSlot.zoneName || 'Standard Zone'})
                </DialogDescription>
              </DialogHeader>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-4 text-xs">
                {/* Status Alert Banner */}
                {selectedSlot.locatorStatus === 'OVERSTAYING' && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-950 dark:text-rose-100 flex items-start gap-2.5 shadow-2xs">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-sm block">Overstay Warning</span>
                      Exceeded scheduled exit time by{' '}
                      <span className="font-black underline">
                        {formatDuration(selectedSlot.movement?.overstayMinutes || 0)}
                      </span>
                      . Standard penalty charges will apply during exit gate barcode validation.
                    </div>
                  </div>
                )}

                {/* Bay Specifications */}
                <div>
                  <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Bay Configuration
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 bg-muted/40 p-3.5 rounded-xl border border-border/60">
                    <div>
                      <span className="text-muted-foreground font-semibold text-[10px] block">Slot Identifier</span>
                      <p className="font-extrabold text-foreground text-sm">{selectedSlot.slotNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-semibold text-[10px] block">Vehicle Compatibility</span>
                      <p className="font-bold text-foreground capitalize">
                        {selectedSlot.supportedVehicleType.toLowerCase().replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-semibold text-[10px] block">Floor Level</span>
                      <p className="font-bold text-foreground">{selectedSlot.floorName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-semibold text-[10px] block">Facility Zone</span>
                      <p className="font-bold text-foreground">{selectedSlot.zoneName || selectedSlot.zoneCode}</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Details */}
                {selectedSlot.vehicle ? (
                  <div>
                    <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-primary" />
                      Parked Vehicle
                    </h4>
                    <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">License Plate</span>
                        <span className="font-mono font-black text-sm bg-background px-3 py-1 rounded-md border border-border text-foreground shadow-2xs">
                          {selectedSlot.vehicle.vehicleNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Brand &amp; Model</span>
                        <span className="font-bold text-foreground">
                          {selectedSlot.vehicle.brand} {selectedSlot.vehicle.model}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Vehicle Class</span>
                        <span className="capitalize font-bold text-foreground">
                          {selectedSlot.vehicle.vehicleType}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Customer Details */}
                {selectedSlot.customer ? (
                  <div>
                    <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      Customer Information
                    </h4>
                    <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Driver Name</span>
                        <span className="font-bold text-foreground">{selectedSlot.customer.fullName}</span>
                      </div>
                      {selectedSlot.customer.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-semibold">Contact Phone</span>
                          <span className="font-mono font-bold text-foreground">{selectedSlot.customer.phone}</span>
                        </div>
                      )}
                      {selectedSlot.customer.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-semibold">Email Address</span>
                          <span className="font-medium text-foreground truncate max-w-[220px]">
                            {selectedSlot.customer.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Stay & Timing Metrics */}
                {selectedSlot.movement && (
                  <div>
                    <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      Active Stay Metrics
                    </h4>
                    <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Gate Entry Timestamp</span>
                        <span className="font-mono font-bold text-foreground">
                          {new Date(selectedSlot.movement.entryTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Elapsed Duration</span>
                        <span className="font-mono font-black text-foreground">
                          {formatDuration(selectedSlot.movement.stayDurationMinutes)}
                        </span>
                      </div>
                      {selectedSlot.movement.overstayMinutes > 0 && (
                        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-extrabold">
                          <span>Overstay Exceeded</span>
                          <span>+{formatDuration(selectedSlot.movement.overstayMinutes)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Booking Reference */}
                {selectedSlot.booking && (
                  <div>
                    <h4 className="font-extrabold text-foreground uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      Booking Reservation
                    </h4>
                    <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Booking ID</span>
                        <span className="font-mono font-black text-primary">
                          {selectedSlot.booking.bookingReference}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-semibold">Scheduled Exit</span>
                        <span className="font-mono font-bold text-foreground">
                          {new Date(selectedSlot.booking.scheduledExitTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Links & Close */}
                <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center gap-2.5">
                  <Link
                    to={`/owner/vehicles?search=${selectedSlot.vehicle?.vehicleNumber || selectedSlot.slotNumber}`}
                    className="w-full sm:flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full text-xs font-bold gap-1.5 h-9">
                      <Car className="w-3.5 h-3.5 text-primary" />
                      View Movement Logs &rarr;
                    </Button>
                  </Link>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setSelectedSlot(null)}
                    className="w-full sm:w-auto text-xs font-bold h-9 px-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerLiveLocatorPage;
