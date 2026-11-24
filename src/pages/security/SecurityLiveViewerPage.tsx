import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Grid3X3,
  RefreshCw,
  Search,
  Wrench,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import {
  securityLiveViewerApi,
  type SecurityAssignedFacility,
  type SecurityLiveFloorLayoutData,
  type SecuritySlotDetailedInfo,
} from '@/api/securityLiveViewer.api';
import { CanvasViewport } from '@/components/layout-designer/CanvasViewport';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLiveSync } from '@/hooks/useLiveSync';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const SecurityLiveViewerPage: React.FC = () => {
  // Facilities & Floor Selection
  const [facilities, setFacilities] = useState<SecurityAssignedFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [loadingFacilities, setLoadingFacilities] = useState(true);

  // Layout Data
  const [layoutData, setLayoutData] = useState<SecurityLiveFloorLayoutData | null>(null);
  const [loadingLayout, setLoadingLayout] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Search & Slot Highlight
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedElementId, setHighlightedElementId] = useState<string | null>(null);

  // Slot Detail Modal
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [slotDetail, setSlotDetail] = useState<SecuritySlotDetailedInfo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [maintenanceRemarks, setMaintenanceRemarks] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Canvas Viewport State
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // 1. Fetch Assigned Facilities on Mount
  useEffect(() => {
    const fetchFacilities = async () => {
      setLoadingFacilities(true);
      try {
        const data = await securityLiveViewerApi.getAssignedFacilities();
        setFacilities(data);
        if (data.length > 0) {
          const firstLot = data[0];
          setSelectedFacilityId(firstLot.parkingLotId);
          if (firstLot.floors.length > 0) {
            setSelectedFloorId(firstLot.floors[0].floorId);
          }
        }
      } catch (err) {
        console.warn('Failed to load assigned facilities:', err);
        toast.error('Unable to retrieve assigned facilities.');
      } finally {
        setLoadingFacilities(false);
      }
    };
    void fetchFacilities();
  }, []);

  const activeFacility = facilities.find((f) => f.parkingLotId === selectedFacilityId) || null;

  // When facility changes, update floor selection
  const handleFacilityChange = (lotId: string) => {
    setSelectedFacilityId(lotId);
    const lot = facilities.find((f) => f.parkingLotId === lotId);
    if (lot && lot.floors.length > 0) {
      setSelectedFloorId(lot.floors[0].floorId);
    } else {
      setSelectedFloorId('');
      setLayoutData(null);
    }
  };

  // 2. Fetch Live Layout for Active Floor
  const fetchLayout = useCallback(async (isSilent = false) => {
    if (!selectedFacilityId || !selectedFloorId) return;
    if (!isSilent) setLoadingLayout(true);
    try {
      const data = await securityLiveViewerApi.getLiveFloorLayout({
        parkingLotId: selectedFacilityId,
        floorId: selectedFloorId,
      });
      setLayoutData(data);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load floor layout';
      console.warn('Failed to load live layout:', msg);
      if (!isSilent) setLayoutData(null);
    } finally {
      if (!isSilent) setLoadingLayout(false);
    }
  }, [selectedFacilityId, selectedFloorId]);

  useEffect(() => {
    void fetchLayout();
  }, [fetchLayout]);

  // 3. Real-Time Dynamic Sync without ghost reload
  useLiveSync(() => {
    void fetchLayout(true);
  }, {
    enabled: Boolean(selectedFacilityId && selectedFloorId),
  });

  // 4. Search & Filter Matching
  useEffect(() => {
    if (!searchQuery.trim() || !layoutData) {
      setHighlightedElementId(null);
      return;
    }

    const q = searchQuery.trim().toLowerCase();
    const match = layoutData.elements.find(
      (el) =>
        el.elementType === 'ParkingSlot' &&
        (el.slotNumber?.toLowerCase().includes(q) ||
          el.slotLabel?.toLowerCase().includes(q) ||
          el.vehicleNumber?.toLowerCase().includes(q)),
    );

    if (match) {
      setHighlightedElementId(match.elementId);
    } else {
      setHighlightedElementId(null);
    }
  }, [searchQuery, layoutData]);

  // 5. Open Slot Details
  const handleSelectSlotElement = async (slotId: string) => {
    if (!selectedFacilityId || !slotId) return;
    setSelectedSlotId(slotId);
    setLoadingDetail(true);
    setSlotDetail(null);
    setMaintenanceRemarks('');
    try {
      const data = await securityLiveViewerApi.getSlotDetails({
        parkingLotId: selectedFacilityId,
        slotId,
      });
      setSlotDetail(data);
    } catch {
      toast.error('Failed to retrieve bay details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // 6. Security Slot Status Update (Available <-> Under Maintenance)
  const handleUpdateSlotStatus = async (targetStatus: 'Available' | 'Under Maintenance') => {
    if (!selectedFacilityId || !selectedSlotId) return;
    setIsUpdatingStatus(true);
    try {
      const res = await securityLiveViewerApi.updateSlotStatus({
        parkingLotId: selectedFacilityId,
        slotId: selectedSlotId,
        slotStatus: targetStatus,
        remarks: targetStatus === 'Under Maintenance' ? maintenanceRemarks : null,
      });
      toast.success(res.message);
      setMaintenanceRemarks('');
      await Promise.all([
        handleSelectSlotElement(selectedSlotId),
        fetchLayout(),
      ]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update bay status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Canvas Viewport Handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.3, Math.round((prev - 0.15) * 100) / 100));
  const handleResetView = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };
  const handleFitToScreen = () => {
    if (!layoutData?.canvasConfig) return;
    const cw = layoutData.canvasConfig.width || 1600;
    const ch = layoutData.canvasConfig.height || 1000;
    const fitZoom = Math.min(1080 / cw, 580 / ch, 1.2);
    const rounded = Math.max(0.2, Math.round(fitZoom * 100) / 100);
    setZoom(rounded);
    setPanX(20);
    setPanY(20);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. HERO HEADER WITH GLASSMORPHIC CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-linear-to-r from-card via-card/90 to-muted/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                <Grid3X3 className="h-7 w-7 text-primary" />
                2D Live Parking Layout Viewer
              </h1>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold gap-1.5 px-2.5 py-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed Active
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Real-time visual occupancy and vehicle locator mapped directly to the official published facility CAD layout.
            </p>
          </div>

          {/* Facility Selector & Live Refresh */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-auto">
            {facilities.length > 1 && (
              <Select value={selectedFacilityId} onValueChange={handleFacilityChange}>
                <SelectTrigger className="text-xs h-9 w-56 bg-background/80 border-border/80 shadow-2xs">
                  <SelectValue placeholder="Select Facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((fac) => (
                    <SelectItem key={fac.parkingLotId} value={fac.parkingLotId} className="text-xs font-medium">
                      {fac.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* 2. NO ASSIGNED FACILITY BANNER */}
      {loadingFacilities ? (
        <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2.5">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="font-medium">Retrieving authorized facility assignments...</span>
        </div>
      ) : facilities.length === 0 ? (
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-foreground">No Facility Assignments</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            You do not have any active security post assignments. Contact your Parking Owner or Administrator to assign you to a facility.
          </p>
        </Card>
      ) : (
        <>
          {/* 3. FLOOR TABS & SEARCH BAR */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/60 border border-border/70 p-2 rounded-2xl backdrop-blur-xs">
            {/* Floor Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-muted/40 rounded-xl">
              {activeFacility?.floors.map((fl) => (
                <button
                  key={fl.floorId}
                  type="button"
                  onClick={() => setSelectedFloorId(fl.floorId)}
                  className={cn(
                    'text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5',
                    selectedFloorId === fl.floorId
                      ? 'bg-background text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <span>{fl.floorName}</span>
                  {!fl.hasPublishedLayout && (
                    <Badge variant="outline" className="text-[9px] py-0 border-amber-500/40 text-amber-600">
                      No Layout
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {/* Bay / Vehicle Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search Bay # or Vehicle Plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9 bg-background/90 border-border/80 rounded-xl"
              />
              {searchQuery.trim() && (
                <span className="absolute right-2.5 top-2.5 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {highlightedElementId ? '1 Match' : '0 Matches'}
                </span>
              )}
            </div>
          </div>

          {/* 4. REAL-TIME OCCUPANCY STATS HEADER */}
          {layoutData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <Card className="rounded-2xl border border-border/80 shadow-2xs bg-card/80 p-3.5 space-y-1 hover:border-primary/40 transition-colors">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Total Capacity
                </span>
                <div className="text-2xl font-black text-foreground">{layoutData.stats.totalSlots}</div>
                <div className="text-[11px] font-semibold text-primary">{layoutData.stats.occupancyRate}% Occupied</div>
              </Card>

              <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1 hover:border-emerald-500/50 transition-colors">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  Available (Free)
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {layoutData.stats.availableSlots}
                </div>
                <div className="text-[11px] text-muted-foreground">Ready for parking</div>
              </Card>

              <Card className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3.5 space-y-1 hover:border-blue-500/50 transition-colors">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                  Reserved (Arrival)
                </span>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {layoutData.stats.reservedSlots}
                </div>
                <div className="text-[11px] text-muted-foreground">Booked pass active</div>
              </Card>

              <Card className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3.5 space-y-1 hover:border-red-500/50 transition-colors">
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                  Occupied (Parked)
                </span>
                <div className="text-2xl font-black text-red-600 dark:text-red-400">
                  {layoutData.stats.occupiedSlots}
                </div>
                <div className="text-[11px] text-muted-foreground">On-site vehicle</div>
              </Card>

              <Card className="rounded-2xl border border-slate-500/30 bg-slate-500/5 p-3.5 space-y-1 hover:border-slate-500/50 transition-colors">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Maintenance
                </span>
                <div className="text-2xl font-black text-slate-500">
                  {layoutData.stats.maintenanceSlots}
                </div>
                <div className="text-[11px] text-muted-foreground">Temporarily offline</div>
              </Card>

              {/* Overflow Bays Card with Transparent Gray Styling */}
              <Card className="rounded-2xl border border-slate-600/40 bg-slate-800/20 p-3.5 space-y-1 hover:border-slate-500/60 transition-colors">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Overflow Bays</span>
                  <span className="h-2 w-2 rounded-xs bg-slate-500/40 border border-slate-400 inline-block" />
                </span>
                <div className="text-2xl font-black text-slate-300">
                  {layoutData.stats.overflowSlots}
                </div>
                <div className="text-[11px] text-muted-foreground">Universal fallback</div>
              </Card>
            </div>
          )}

          {/* 5. 2D LIVE VIEWPORT CONTAINER WITH POLISHED TOOLBAR */}
          <Card className="rounded-2xl border border-border/80 shadow-md bg-slate-950 overflow-hidden relative">
            {/* Viewport Top Control Strip */}
            <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200">
                  Floor Viewport: {activeFacility?.floors.find((f) => f.floorId === selectedFloorId)?.floorName || 'Floor Layout'}
                </span>
                <Badge variant="outline" className="border-slate-700 text-slate-300 font-mono text-[10px]">
                  {Math.round(zoom * 100)}%
                </Badge>
              </div>

              {/* Viewport Control Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                  onClick={handleZoomIn}
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                  onClick={handleFitToScreen}
                  title="Fit to Screen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                  onClick={handleResetView}
                  title="Reset View"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {loadingLayout ? (
              <div className="h-[580px] flex items-center justify-center text-xs text-muted-foreground gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                <span>Loading official 2D parking layout...</span>
              </div>
            ) : !layoutData ? (
              <div className="h-[580px] flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <span className="font-semibold text-foreground">No Published 2D Layout</span>
                <span>The administrator has not published a 2D layout for this floor yet.</span>
              </div>
            ) : (
              <div className="h-[600px] sm:h-[640px] relative">
                <CanvasViewport
                  mode="booking"
                  elements={layoutData.elements as any}
                  selectedElementId={highlightedElementId}
                  highlightedElementId={highlightedElementId}
                  activeTool="select"
                  showGrid={true}
                  showRulers={false}
                  snapToGrid={false}
                  zoom={zoom}
                  panX={panX}
                  panY={panY}
                  onPanChange={(nx, ny) => {
                    setPanX(nx);
                    setPanY(ny);
                  }}
                  onZoomChange={setZoom}
                  onUpdateElementPosition={() => { }}
                  onRotateElement={() => { }}
                  onRemoveElement={() => { }}
                  onDropNewElement={() => { }}
                  onSelectElement={(el) => {
                    if (el && el.elementType === 'ParkingSlot') {
                      const slotId = el.slotId || (el as any)._id;
                      if (slotId) {
                        void handleSelectSlotElement(slotId);
                      }
                    }
                  }}
                  canvasConfig={layoutData.canvasConfig}
                />
              </div>
            )}

            {/* Viewport Bottom Status Legend Bar */}
            <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Legend:
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                  <span className="text-slate-200 text-[11px] font-medium">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
                  <span className="text-slate-200 text-[11px] font-medium">Reserved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-red-500" />
                  <span className="text-slate-200 text-[11px] font-medium">Occupied</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-slate-500" />
                  <span className="text-slate-200 text-[11px] font-medium">Maintenance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-slate-500/25 border border-dashed border-slate-400" />
                  <span className="text-slate-300 text-[11px] font-medium">Overflow (Universal)</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Synced {lastUpdated.toLocaleTimeString()}</span>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ===================================================================== */}
      {/* 7. AUTHORIZED OPERATIONAL DETAIL DIALOG */}
      {/* ===================================================================== */}
      <Dialog open={Boolean(selectedSlotId)} onOpenChange={(open) => !open && setSelectedSlotId(null)}>
        <DialogContent className="max-w-lg">
          {loadingDetail ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span>Retrieving bay operational data...</span>
            </div>
          ) : slotDetail ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-primary" />
                    <span>Bay Details: {slotDetail.slot.slotNumber}</span>
                  </DialogTitle>
                  <Badge
                    className={cn(
                      'text-xs font-bold',
                      slotDetail.slot.slotStatus === 'Available' && 'bg-emerald-500',
                      slotDetail.slot.slotStatus === 'Reserved' && 'bg-blue-500',
                      slotDetail.slot.slotStatus === 'Occupied' && 'bg-red-500',
                      slotDetail.slot.slotStatus === 'Under Maintenance' && 'bg-slate-500',
                    )}
                  >
                    {slotDetail.slot.slotStatus}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  {slotDetail.floor.floorName} • Zone {slotDetail.zone.zoneCode} ({slotDetail.zone.zoneName})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-xs">
                {/* Slot Specifications */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Bay Classification</span>
                    <strong className="text-foreground">{slotDetail.slot.slotType}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Category</span>
                    <Badge variant={slotDetail.slot.isOverflow ? 'default' : 'outline'} className="text-[10px]">
                      {slotDetail.slot.isOverflow ? 'Overflow Bay (Universal)' : 'Regular Bay'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Vehicle Compatibility</span>
                    <strong className="text-foreground">
                      {slotDetail.slot.isOverflow ? 'All Vehicles (Car, SUV, Bike, EV)' : slotDetail.slot.supportedVehicleType}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Bay Identifier</span>
                    <strong className="font-mono text-foreground">{slotDetail.slot.slotLabel}</strong>
                  </div>
                </div>

                {/* If Slot Has Active Booking / Occupied Vehicle */}
                {slotDetail.activeBooking ? (
                  <div className="space-y-3 p-3.5 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                        Active Vehicle &amp; Booking
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Ref: {slotDetail.activeBooking.bookingReference}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Vehicle Registration</span>
                        <div className="text-sm font-black font-mono text-foreground">
                          {slotDetail.activeBooking.vehicle.vehicleNumber}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Vehicle Type / Model</span>
                        <strong className="text-foreground">
                          {slotDetail.activeBooking.vehicle.vehicleType}{' '}
                          {slotDetail.activeBooking.vehicle.vehicleBrand &&
                            `(${slotDetail.activeBooking.vehicle.vehicleBrand} ${slotDetail.activeBooking.vehicle.vehicleModel || ''})`}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Customer Name</span>
                        <strong className="text-foreground">{slotDetail.activeBooking.customerName}</strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Contact Phone</span>
                        <strong className="font-mono text-foreground">{slotDetail.activeBooking.customerPhone}</strong>
                      </div>
                    </div>

                    <div className="border-t border-border/60 pt-2 grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-muted-foreground block">Check-in / Entry</span>
                        <strong className="text-foreground">
                          {slotDetail.activeBooking.actualEntryTime
                            ? new Date(slotDetail.activeBooking.actualEntryTime).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            : 'Awaiting Gate Scan'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Scheduled Exit</span>
                        <strong className="text-foreground">
                          {new Date(slotDetail.activeBooking.scheduledExitTime).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : slotDetail.slot.slotStatus === 'Under Maintenance' ? (
                  <div className="p-3.5 rounded-xl bg-slate-500/10 border border-slate-500/30 space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">Maintenance Notes</span>
                    <p className="text-muted-foreground leading-relaxed">
                      {slotDetail.slot.remarks || 'Bay placed under maintenance by facility owner.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Ready for Assignment</span>
                    </div>
                    <p className="text-[11px] mt-1 text-muted-foreground">
                      This bay is vacant and open for incoming online reservations or on-site walk-in tickets.
                    </p>
                  </div>
                )}

                {/* Security Staff Operational Bay Maintenance Control */}
                <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-primary" />
                      <span>Security Operational Control</span>
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Slot Status Override
                    </Badge>
                  </div>

                  {slotDetail.slot.slotStatus === 'Occupied' || slotDetail.slot.slotStatus === 'Reserved' ? (
                    <p className="text-[11px] text-muted-foreground italic">
                      This bay is currently {slotDetail.slot.slotStatus.toLowerCase()}. Status modifications are restricted until the vehicle departs.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {slotDetail.slot.slotStatus === 'Under Maintenance' ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            Bay is currently blocked from reservations and walk-ins.
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUpdatingStatus}
                            onClick={() => handleUpdateSlotStatus('Available')}
                            className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            {isUpdatingStatus ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Restore to Available
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Reason for maintenance (e.g. Surface damage, barrier sensor check)..."
                            value={maintenanceRemarks}
                            onChange={(e) => setMaintenanceRemarks(e.target.value)}
                            maxLength={250}
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border/80 bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUpdatingStatus}
                              onClick={() => handleUpdateSlotStatus('Under Maintenance')}
                              className="h-8 text-xs font-bold border-amber-500/50 text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                            >
                              {isUpdatingStatus ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                              ) : (
                                <Wrench className="w-3.5 h-3.5 mr-1" />
                              )}
                              Place Under Maintenance
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedSlotId(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityLiveViewerPage;
