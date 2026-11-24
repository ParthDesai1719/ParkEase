import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Building2,
  Sparkles,
  Rocket,
  MessageSquare,
  RefreshCw,
  Info,
  ShieldCheck,
  Eye,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { ownerApi } from '@/api/owner.api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  getOwnerParkingLotById,
  getOwnerParkingLotHierarchy,
  getOwnerFloorLayout,
  ownerConfirmLayout,
  ownerRequestLayoutChanges,
  activateFacility,
  type OfficialParkingLot,
  type OfficialParkingLotHierarchy,
  type OfficialHierarchyFloor,
  type FloorLayoutResponse,
  type LayoutElementData,
  type LayoutCanvasConfig,
} from '@/api/parkingLot.api';
import { CanvasViewport } from '@/components/layout-designer/CanvasViewport';
import { cn } from '@/lib/utils';
import { useLiveSync } from '@/hooks/useLiveSync';

const DEFAULT_CANVAS_CONFIG: LayoutCanvasConfig = {
  width: 1600,
  height: 1000,
  gridSize: 20,
  snapToGrid: true,
  backgroundColor: '#0f172a',
};

export const OwnerLayoutReviewPage: React.FC = () => {
  const { id: parkingLotId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Primary Data State
  const [parkingLot, setParkingLot] = useState<OfficialParkingLot | null>(null);
  const [hierarchy, setHierarchy] = useState<OfficialParkingLotHierarchy | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [floorLayout, setFloorLayout] = useState<FloorLayoutResponse | null>(null);

  // Loading & Action State
  const [isLoadingLot, setIsLoadingLot] = useState(true);
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [isSubmittingChanges, setIsSubmittingChanges] = useState(false);
  const [isSubmittingActivate, setIsSubmittingActivate] = useState(false);

  // Dialog States
  const [isChangesDialogOpen, setIsChangesDialogOpen] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [changeFloorId, setChangeFloorId] = useState<string>('ALL');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);

  // Viewport Controls
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(60);
  const [panY, setPanY] = useState<number>(40);
  const [showZoneHighlights, setShowZoneHighlights] = useState(true);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<LayoutElementData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load Lot & Hierarchy
  const loadFacilityData = useCallback(async () => {
    if (!parkingLotId) return;
    try {
      setIsLoadingLot(true);
      const [lotRes, hierRes] = await Promise.all([
        getOwnerParkingLotById(parkingLotId),
        getOwnerParkingLotHierarchy(parkingLotId),
      ]);

      if (lotRes.success && lotRes.data) {
        setParkingLot(lotRes.data);
      }
      if (hierRes.success && hierRes.data) {
        setHierarchy(hierRes.data);
        if (hierRes.data.floors.length > 0 && !activeFloorId) {
          setActiveFloorId(hierRes.data.floors[0]._id);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load facility details';
      toast.error(msg);
    } finally {
      setIsLoadingLot(false);
    }
  }, [parkingLotId, activeFloorId]);

  useEffect(() => {
    loadFacilityData();
  }, [loadFacilityData]);

  // Load Floor Layout whenever activeFloorId changes
  const loadActiveFloorLayout = useCallback(async (isSilent = false) => {
    if (!parkingLotId || !activeFloorId) return;
    try {
      if (!isSilent) setIsLoadingLayout(true);
      const res = await getOwnerFloorLayout(parkingLotId, activeFloorId);
      if (res.success && res.data) {
        setFloorLayout(res.data);
      } else if (!isSilent) {
        setFloorLayout(null);
      }
    } catch (err: unknown) {
      console.warn('Could not load published floor layout:', err);
      if (!isSilent) setFloorLayout(null);
    } finally {
      if (!isSilent) setIsLoadingLayout(false);
    }
  }, [parkingLotId, activeFloorId]);

  useEffect(() => {
    if (activeFloorId) {
      loadActiveFloorLayout();
    }
  }, [activeFloorId, loadActiveFloorLayout]);

  useLiveSync(() => {
    if (activeFloorId) {
      void loadActiveFloorLayout(true);
    }
  });

  // Active Floor object
  const activeFloor: OfficialHierarchyFloor | undefined = useMemo(() => {
    if (!hierarchy || !activeFloorId) return undefined;
    return hierarchy.floors.find((f) => f._id === activeFloorId);
  }, [hierarchy, activeFloorId]);

  // Available Zones on Active Floor
  const activeFloorZones = useMemo(() => {
    if (!activeFloor) return [];
    return activeFloor.zones.map((z) => ({
      _id: z._id,
      zoneName: z.zoneName,
      zoneCode: z.zoneCode,
    }));
  }, [activeFloor]);

  // Effective Canvas Config & Elements
  const canvasConfig: LayoutCanvasConfig = useMemo(() => {
    return floorLayout?.layout?.canvasConfig || DEFAULT_CANVAS_CONFIG;
  }, [floorLayout]);

  const elements: LayoutElementData[] = useMemo(() => {
    return (floorLayout?.layout?.elements as LayoutElementData[]) || [];
  }, [floorLayout]);

  // Selected Slot in Hierarchy
  const selectedSlot = useMemo(() => {
    if (!selectedElement || selectedElement.elementType !== 'ParkingSlot' || !hierarchy) return null;
    for (const fl of hierarchy.floors) {
      for (const zn of fl.zones) {
        for (const sl of zn.slots) {
          if (sl._id === selectedElement.slotId || sl.slotNumber === selectedElement.slotNumber) {
            return sl;
          }
        }
      }
    }
    return null;
  }, [selectedElement, hierarchy]);

  const [isUpdatingSlot, setIsUpdatingSlot] = useState(false);

  // Operational Action: Put Under Maintenance / Return to Available
  const handleToggleMaintenance = async () => {
    const slotId = selectedSlot?._id || selectedElement?.slotId;
    if (!slotId) return;
    const currentStatus = selectedSlot?.slotStatus || 'Available';
    const targetStatus = currentStatus === 'Under Maintenance' ? 'Available' : 'Under Maintenance';

    try {
      setIsUpdatingSlot(true);
      await ownerApi.updateSlotOperationalStatus(slotId, {
        slotStatus: targetStatus,
        remarks: targetStatus === 'Under Maintenance' ? 'Owner maintenance inspection' : null,
      });
      toast.success(
        targetStatus === 'Under Maintenance'
          ? `Slot ${selectedElement?.slotNumber} is now placed under maintenance.`
          : `Slot ${selectedElement?.slotNumber} is restored to available.`,
      );
      await Promise.all([loadFacilityData(), loadActiveFloorLayout()]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update slot status');
    } finally {
      setIsUpdatingSlot(false);
    }
  };

  // Operational Action: Toggle Overflow Bay
  const handleToggleOverflow = async () => {
    const slotId = selectedSlot?._id || selectedElement?.slotId;
    if (!slotId) return;
    const currentIsOverflow = Boolean(selectedSlot?.isOverflow || (selectedElement as any)?.isOverflow);
    const targetIsOverflow = !currentIsOverflow;

    try {
      setIsUpdatingSlot(true);
      await ownerApi.updateSlotOperationalStatus(slotId, {
        isOverflow: targetIsOverflow,
      });
      toast.success(
        targetIsOverflow
          ? `Slot ${selectedElement?.slotNumber} designated as Overflow Bay (Universal & transparent gray).`
          : `Slot ${selectedElement?.slotNumber} reverted to Regular Bay.`,
      );

      // Instantly update elements in canvas state for live visual reflection
      if (floorLayout?.layout?.elements) {
        const updatedEls = (floorLayout.layout.elements as any[]).map((el) => {
          if (el.slotId === slotId || el.slotNumber === selectedElement?.slotNumber) {
            return { ...el, isOverflow: targetIsOverflow };
          }
          return el;
        });
        setFloorLayout({
          ...floorLayout,
          layout: {
            ...floorLayout.layout,
            elements: updatedEls,
          },
        });
      }

      if (selectedElement) {
        setSelectedElement({
          ...selectedElement,
          isOverflow: targetIsOverflow,
        } as any);
      }

      await loadFacilityData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to toggle overflow bay');
    } finally {
      setIsUpdatingSlot(false);
    }
  };

  // Zoom / Pan handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(3.0, Math.round((prev + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.3, Math.round((prev - 0.15) * 100) / 100));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPanX(60);
    setPanY(40);
  };

  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const availableW = clientWidth - 40;
    const availableH = clientHeight - 40;
    const fitZoom = Math.min(availableW / canvasConfig.width, availableH / canvasConfig.height, 1.2);
    const rounded = Math.max(0.2, Math.round(fitZoom * 100) / 100);
    setZoom(rounded);
    const centerPanX = Math.round((availableW - canvasConfig.width * rounded) / 2) + 20;
    const centerPanY = Math.round((availableH - canvasConfig.height * rounded) / 2) + 20;
    setPanX(Math.max(20, centerPanX));
    setPanY(Math.max(20, centerPanY));
  };

  // Submit Confirm
  const handleConfirmLayout = async () => {
    if (!parkingLotId) return;
    try {
      setIsSubmittingConfirm(true);
      const res = await ownerConfirmLayout(parkingLotId, confirmNotes);
      if (res.success && res.data) {
        setParkingLot(res.data);
        setIsConfirmDialogOpen(false);
        setConfirmNotes('');
        toast.success('2D Layout confirmed and approved! Facility is ready for activation.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm layout';
      toast.error(msg);
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // Submit Request Changes
  const handleRequestChanges = async () => {
    if (!parkingLotId) return;
    if (!changeNotes.trim()) {
      toast.error('Please describe the adjustments or changes required.');
      return;
    }
    try {
      setIsSubmittingChanges(true);
      const floorIdToSend = changeFloorId !== 'ALL' ? changeFloorId : undefined;
      const res = await ownerRequestLayoutChanges(parkingLotId, changeNotes, floorIdToSend);
      if (res.success && res.data) {
        setParkingLot(res.data);
        setIsChangesDialogOpen(false);
        setChangeNotes('');
        toast.success('Revision request sent to the administration team.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit revision request';
      toast.error(msg);
    } finally {
      setIsSubmittingChanges(false);
    }
  };

  // Submit Activate Facility
  const handleActivateFacility = async () => {
    if (!parkingLotId) return;
    try {
      setIsSubmittingActivate(true);
      const res = await activateFacility(parkingLotId, false);
      if (res.success && res.data) {
        setParkingLot(res.data);
        setIsActivateDialogOpen(false);
        toast.success('🎉 Facility successfully activated! It is now LIVE for operations and bookings.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to activate facility';
      toast.error(msg);
    } finally {
      setIsSubmittingActivate(false);
    }
  };

  const reviewStatus = parkingLot?.layoutReviewStatus || 'Pending Owner Review';
  const isLotActive = parkingLot?.parkingStatus === 'Active';
  const isConfirmed = reviewStatus === 'Owner Confirmed';
  const isChangesRequested = reviewStatus === 'Owner Changes Requested';

  if (isLoadingLot) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading facility layout review...</p>
        </div>
      </div>
    );
  }

  if (!parkingLot) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center space-y-4">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Facility Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested parking facility could not be found or you do not have permission to view it.
        </p>
        <Button asChild variant="outline">
          <Link to="/owner/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* 1. TOP HEADER ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/80 bg-card px-4 py-2.5 gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/owner/dashboard')}
            title="Return to Owner Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground truncate">{parkingLot.parkingName}</h1>
              {/* Status Badge */}
              {isLotActive ? (
                <Badge className="bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border-emerald-600/30 text-[10px] gap-1 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live &amp; Active
                </Badge>
              ) : isConfirmed ? (
                <Badge className="bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border-emerald-600/30 text-[10px] gap-1 py-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Layout Approved
                </Badge>
              ) : isChangesRequested ? (
                <Badge className="bg-amber-600/15 text-amber-600 dark:text-amber-400 border-amber-600/30 text-[10px] gap-1 py-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  Changes Requested
                </Badge>
              ) : (
                <Badge className="bg-sky-600/15 text-sky-600 dark:text-sky-400 border-sky-600/30 text-[10px] gap-1 py-0.5">
                  <Eye className="h-3 w-3" />
                  Awaiting Your Confirmation
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {typeof parkingLot.address === 'string'
                ? parkingLot.address
                : `${parkingLot.city || ''}, ${parkingLot.state || ''}`}{' '}
              • {parkingLot.totalFloors} {parkingLot.totalFloors === 1 ? 'Floor' : 'Floors'} •{' '}
              {parkingLot.totalSlots || 0} Slots
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-border/80"
            onClick={() => {
              setChangeFloorId(activeFloorId || 'ALL');
              setIsChangesDialogOpen(true);
            }}
            disabled={isLotActive}
          >
            <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
            Request Changes
          </Button>

          {!isConfirmed && !isLotActive && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={() => setIsConfirmDialogOpen(true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirm &amp; Approve Layout
            </Button>
          )}

          {isConfirmed && !isLotActive && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold shadow-md animate-pulse"
              onClick={() => setIsActivateDialogOpen(true)}
            >
              <Rocket className="h-3.5 w-3.5" />
              Activate Facility &amp; Go Live
            </Button>
          )}

          {isLotActive && (
            <Button
              asChild
              size="sm"
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
            >
              <Link to="/owner/dashboard">
                <ShieldCheck className="h-3.5 w-3.5" />
                Go to Live Operations
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 2. REVISION / STATUS BANNER */}
      {isChangesRequested && parkingLot.layoutReviewNotes && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Your Requested Changes{parkingLot.layoutReviewFloorName ? ` (${parkingLot.layoutReviewFloorName})` : ''}:</strong>{' '}
              {parkingLot.layoutReviewNotes}
            </span>
          </div>
          <span className="text-[11px] opacity-80 shrink-0">Admin team is reviewing feedback</span>
        </div>
      )}

      {!isLotActive && !isConfirmed && !isChangesRequested && (
        <div className="bg-sky-500/10 border-b border-sky-500/25 px-4 py-1.5 flex items-center justify-between text-xs text-sky-800 dark:text-sky-300">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
            <span>
              Please inspect the 2D layout across all floors. Check slot allocations, driving lanes, and entry/exit
              points. Click <strong>Confirm &amp; Approve Layout</strong> to finalize the plan.
            </span>
          </div>
        </div>
      )}

      {isConfirmed && !isLotActive && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Layout approved! You can now click <strong>Activate Facility &amp; Go Live</strong> to launch operations
              and begin taking customer reservations.
            </span>
          </div>
        </div>
      )}

      {/* 3. SUBHEADER: FLOOR SELECTOR & VIEWPORT CONTROLS */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2 gap-3 shrink-0">
        {/* Floor Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Floor:
          </span>
          {hierarchy?.floors.map((fl) => {
            const isActive = fl._id === activeFloorId;
            return (
              <Button
                key={fl._id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={`h-7 px-3 text-xs gap-1.5 rounded-full ${
                  isActive ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'border-border/70 text-foreground'
                }`}
                onClick={() => {
                  setActiveFloorId(fl._id);
                  setSelectedElement(null);
                }}
              >
                <span>{fl.floorName}</span>
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {fl.totalSlots} slots
                </span>
              </Button>
            );
          })}
        </div>

        {/* Viewport Toolbar */}
        <div className="flex items-center gap-2">
          {/* Zone Highlighting Toggle */}
          <Button
            variant={showZoneHighlights ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs px-2 gap-1"
            onClick={() => setShowZoneHighlights((prev) => !prev)}
            title="Toggle Zone Color Overlays"
          >
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Zones
          </Button>

          {/* Zone Filter */}
          {activeFloorZones.length > 0 && (
            <select
              aria-label="Filter slots by zone"
              className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
              value={selectedZoneFilter || ''}
              onChange={(e) => setSelectedZoneFilter(e.target.value || null)}
            >
              <option value="">All Zones ({activeFloorZones.length})</option>
              {activeFloorZones.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.zoneName} ({z.zoneCode})
                </option>
              ))}
            </select>
          )}

          <div className="h-4 w-px bg-border/60 mx-1" />

          {/* Zoom Buttons */}
          <div className="flex items-center bg-card border border-border/80 rounded-md p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-[11px] font-mono px-1.5 min-w-[42px] text-center text-foreground font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleFitToScreen}
            title="Fit to Screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleResetZoom}
            title="Reset View"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 4. MAIN CANVAS VIEWPORT AREA */}
      <div ref={containerRef} className="relative flex-1 bg-slate-950 overflow-hidden">
        {isLoadingLayout ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-xs z-20">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Loading floor plan...</span>
            </div>
          </div>
        ) : !floorLayout?.hasPublishedLayout ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
            <Building2 className="h-12 w-12 text-muted-foreground/60" />
            <h3 className="text-base font-semibold text-foreground">No Published 2D Layout on this Floor Yet</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              The platform engineering team is drafting and slotting this floor. Once published, the interactive layout
              will automatically appear here for your review.
            </p>
          </div>
        ) : (
          <CanvasViewport
            canvasConfig={canvasConfig}
            elements={elements}
            selectedElementId={selectedElement?.elementId || null}
            mode="preview"
            activeTool="select"
            showGrid={true}
            showRulers={true}
            snapToGrid={false}
            zoom={zoom}
            panX={panX}
            panY={panY}
            onPanChange={(newPanX, newPanY) => {
              setPanX(newPanX);
              setPanY(newPanY);
            }}
            onZoomChange={setZoom}
            onSelectElement={setSelectedElement}
            onUpdateElementPosition={() => {}}
            onRotateElement={() => {}}
            onRemoveElement={() => {}}
            onDropNewElement={() => {}}
            zones={activeFloorZones}
            showZoneHighlights={showZoneHighlights}
            selectedZoneFilter={selectedZoneFilter}
            canResizeCanvas={false}
          />
        )}

        {/* Selected Element Floating Inspector / Operational Management Card */}
        {selectedElement && (
          <div className="absolute bottom-4 right-4 z-30 w-80 rounded-2xl border border-border/90 bg-card/95 p-4 shadow-2xl backdrop-blur-md space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="font-bold text-foreground text-sm">
                  {selectedElement.elementType === 'ParkingSlot'
                    ? `Bay ${selectedElement.slotNumber || selectedElement.label || 'Details'}`
                    : selectedElement.elementType}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => setSelectedElement(null)}
              >
                ✕
              </Button>
            </div>

            {selectedElement.elementType === 'ParkingSlot' ? (
              <div className="space-y-3">
                {/* Status Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5',
                      (selectedSlot?.slotStatus || 'Available') === 'Available' && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
                      selectedSlot?.slotStatus === 'Under Maintenance' && 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
                      selectedSlot?.slotStatus === 'Occupied' && 'bg-red-500/20 text-red-400 border border-red-500/40',
                      selectedSlot?.slotStatus === 'Reserved' && 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
                    )}
                  >
                    {selectedSlot?.slotStatus || 'Available'}
                  </Badge>

                  {Boolean(selectedSlot?.isOverflow || (selectedElement as any)?.isOverflow) ? (
                    <Badge className="bg-slate-800 text-slate-200 border border-slate-600 font-mono text-[10px] gap-1 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-xs bg-slate-400" />
                      Overflow Bay
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-border text-muted-foreground text-[10px] px-2 py-0.5">
                      Regular Bay
                    </Badge>
                  )}
                </div>

                {/* Slot Properties */}
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Zone:</span>
                    <span className="font-medium text-foreground">
                      {selectedElement.zoneName || 'Standard'} ({selectedElement.zoneCode || 'A'})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Vehicle Type:</span>
                    <span className="font-medium text-foreground">
                      {selectedSlot?.supportedVehicleType || (selectedElement as any)?.supportedVehicleType || 'Car'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Dimensions:</span>
                    <span className="font-mono text-foreground">
                      {selectedElement.width} × {selectedElement.height} px
                    </span>
                  </div>
                </div>

                {/* Owner Operational Controls */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Owner Operational Actions
                  </span>

                  {/* 1. Maintenance Toggle */}
                  {(selectedSlot?.slotStatus || 'Available') === 'Under Maintenance' ? (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isUpdatingSlot}
                      onClick={handleToggleMaintenance}
                      className="w-full text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer gap-1.5 shadow-2xs"
                    >
                      {isUpdatingSlot ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Restore to Available
                    </Button>
                  ) : (selectedSlot?.slotStatus || 'Available') === 'Available' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdatingSlot}
                      onClick={handleToggleMaintenance}
                      className="w-full text-xs h-8 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-semibold cursor-pointer gap-1.5"
                    >
                      {isUpdatingSlot ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wrench className="h-3.5 w-3.5" />
                      )}
                      Place Under Maintenance
                    </Button>
                  ) : (
                    <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
                      Slot is actively {selectedSlot?.slotStatus?.toLowerCase()} and cannot be modified.
                    </div>
                  )}

                  {/* 2. Overflow Bay Toggle */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isUpdatingSlot || selectedSlot?.slotStatus === 'Occupied'}
                    onClick={handleToggleOverflow}
                    className="w-full text-xs h-8 border-slate-700 hover:bg-slate-800 text-slate-200 cursor-pointer gap-1.5 font-medium"
                  >
                    {isUpdatingSlot ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    {Boolean(selectedSlot?.isOverflow || (selectedElement as any)?.isOverflow)
                      ? 'Revert to Regular Bay'
                      : 'Designate as Overflow Bay'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-foreground">
                  <span className="text-muted-foreground">Type:</span> {selectedElement.elementType}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Dimensions: {selectedElement.width} × {selectedElement.height} px • Angle: {selectedElement.rotation}°
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. REQUEST CHANGES DIALOG */}
      <Dialog open={isChangesDialogOpen} onOpenChange={setIsChangesDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-500" />
              Request Layout Adjustments
            </DialogTitle>
            <DialogDescription>
              Specify any changes or revisions you need. Platform administrators will be notified and will revise the
              official 2D visual plan accordingly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Target Floor for Revision:
              </label>
              <select
                className="w-full h-8 rounded border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={changeFloorId}
                onChange={(e) => setChangeFloorId(e.target.value)}
              >
                {hierarchy?.floors.map((fl) => (
                  <option key={fl._id} value={fl._id}>
                    {fl.floorName} (Floor Level {fl.floorNumber})
                  </option>
                ))}
                <option value="ALL">Entire Facility (All Floors)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Revision Details &amp; Feedback:
              </label>
              <Textarea
                placeholder="e.g. Please reorient diagonal slots in Zone B, adjust the ramp turning radius, or add an EV charging indicator..."
                className="min-h-[120px] text-xs resize-none"
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsChangesDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={handleRequestChanges}
              disabled={isSubmittingChanges || !changeNotes.trim()}
            >
              {isSubmittingChanges ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Feedback to Admins'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. CONFIRM & APPROVE LAYOUT DIALOG */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              Confirm &amp; Approve 2D Layout Plan
            </DialogTitle>
            <DialogDescription>
              By confirming, you verify that the published visual floor plans, slot alignments, and navigation driving
              lanes match your physical parking facility.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <p className="font-semibold">What happens upon confirmation?</p>
              <ul className="list-disc list-inside space-y-0.5 opacity-90">
                <li>Layout state moves to <strong>Owner Confirmed</strong>.</li>
                <li>Facility becomes eligible for immediate <strong>Go Live Activation</strong>.</li>
                <li>Admins are notified of your approval.</li>
              </ul>
            </div>

            <Textarea
              placeholder="Optional notes or confirmation remarks for the admin team..."
              className="min-h-[80px] text-xs resize-none"
              value={confirmNotes}
              onChange={(e) => setConfirmNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
              onClick={handleConfirmLayout}
              disabled={isSubmittingConfirm}
            >
              {isSubmittingConfirm ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Confirming...
                </>
              ) : (
                'Approve & Confirm Layout'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. ACTIVATE FACILITY & GO LIVE DIALOG */}
      <Dialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <Rocket className="h-5 w-5" />
              Activate Facility &amp; Go Live
            </DialogTitle>
            <DialogDescription>
              Are you ready to activate <strong>{parkingLot.parkingName}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-orange-900 dark:text-orange-200 space-y-1">
              <p className="font-semibold">Going live will:</p>
              <ul className="list-disc list-inside space-y-0.5 opacity-90">
                <li>Set facility status to <strong>Active &amp; Verified</strong>.</li>
                <li>Enable customer slot bookings and live occupancy tracking.</li>
                <li>Transfer full operational control to your Owner Dashboard.</li>
              </ul>
            </div>
            <p className="text-muted-foreground">
              Security staff and gate attendants can immediately scan digital entry/exit QR codes once active.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsActivateDialogOpen(false)}>
              Not Yet
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white gap-1.5 font-bold shadow-md"
              onClick={handleActivateFacility}
              disabled={isSubmittingActivate}
            >
              {isSubmittingActivate ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Activating...
                </>
              ) : (
                '🚀 Activate Facility Now'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
