import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Navigation,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ArrowRight,
  ShieldCheck,
  Crosshair,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CanvasViewport } from '@/components/layout-designer/CanvasViewport';
import { barrierApi } from '@/api/barrier.api';
import type { LayoutElementData, LayoutCanvasConfig } from '@/api/parkingLot.api';
import type { CustomerBookingItem } from '@/api/customerParking.api';

interface CustomerBayNavigationCardProps {
  booking: CustomerBookingItem | any;
}

const DEFAULT_CANVAS_CONFIG: LayoutCanvasConfig = {
  width: 1400,
  height: 900,
  gridSize: 20,
  snapToGrid: false,
  backgroundColor: '#0f172a',
};

export const CustomerBayNavigationCard: React.FC<CustomerBayNavigationCardProps> = ({ booking }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(0.75);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  const lotId =
    typeof booking.parkingLotId === 'object' && booking.parkingLotId?._id
      ? booking.parkingLotId._id
      : (booking.parkingLotId as string) || '';

  // Load facility published layout data
  const layoutQuery = useQuery({
    queryKey: ['barrier-facility-layout', lotId],
    queryFn: () => barrierApi.getFacilityLayoutAndState(lotId),
    enabled: Boolean(lotId),
  });

  const isReassigned = booking.reassignment?.slotReassignmentStatus === 'REASSIGNED';
  const targetSlotNumber =
    booking.currentSlot?.slotNumber ||
    booking.slotNumber ||
    booking.currentSlotId?.slotNumber ||
    '';
  const targetSlotId =
    booking.currentSlot?._id ||
    booking.slotId ||
    booking.currentSlotId?._id ||
    booking.currentSlotId ||
    '';
  const targetFloorId =
    (typeof booking.floor === 'object' && booking.floor?._id) ||
    (typeof booking.floorId === 'object' && (booking.floorId as any)?._id) ||
    booking.floorId ||
    booking.currentSlot?.floorId;
  const originalSlotNumber = booking.reassignment?.originalSlotNumber;

  // Resolve matching layout and extract elements
  const { elements, canvasConfig, targetSlotEl, entranceEl, activeFloorName } = useMemo(() => {
    if (!layoutQuery.data?.layouts || layoutQuery.data.layouts.length === 0) {
      return {
        elements: [] as LayoutElementData[],
        canvasConfig: DEFAULT_CANVAS_CONFIG,
        targetSlotEl: null,
        entranceEl: null,
        activeFloorName: booking.floor?.floorName || 'Ground Floor',
      };
    }

    const layouts: any[] = layoutQuery.data.layouts;

    // 1. Try finding layout by matching floor ID
    let layout = layouts.find((l: any) => {
      const lFloorId = l.floorId?._id || l.floorId;
      return targetFloorId && lFloorId && lFloorId.toString() === targetFloorId.toString();
    });

    // 2. Fallback: Search all layouts for the one containing target slot number or ID
    if (!layout) {
      layout = layouts.find((l: any) =>
        (l.elements || []).some(
          (el: any) =>
            el.elementType === 'ParkingSlot' &&
            (el.slotNumber === targetSlotNumber || (targetSlotId && el.slotId === targetSlotId.toString())),
        ),
      );
    }

    // 3. Fallback to first published layout
    if (!layout) {
      layout = layouts[0];
    }

    const rawElements: LayoutElementData[] = (layout.elements || []).map((el: any) => ({
      ...el,
      elementId: el.elementId || el._id || `el-${Math.random()}`,
    }));

    // Find the target slot element
    const foundTargetSlot = rawElements.find(
      (el) =>
        el.elementType === 'ParkingSlot' &&
        (el.slotNumber === targetSlotNumber || (targetSlotId && el.slotId === targetSlotId.toString())),
    ) || null;

    // Find entrance element
    const foundEntrance = rawElements.find(
      (el) => el.elementType === 'Entrance' || el.elementType === 'BuildingEntrance',
    ) || null;

    // Enrich elements with visual highlight markers for navigation
    const enriched = rawElements.map((el) => {
      if (el.elementType === 'ParkingSlot') {
        if (el.slotNumber === targetSlotNumber || (targetSlotId && el.slotId === targetSlotId.toString())) {
          return {
            ...el,
            label: `YOUR BAY (${el.slotNumber})`,
            color: '#10b981', // Emerald green destination
          };
        }
        if (isReassigned && el.slotNumber === originalSlotNumber) {
          return {
            ...el,
            label: `VACATED (${el.slotNumber})`,
            color: '#f59e0b', // Amber vacated
          };
        }
      }
      return el;
    });

    const resolvedFloorName =
      layout.floorName ||
      (layout.floorNumber != null ? `Floor ${layout.floorNumber}` : null) ||
      booking.floor?.floorName ||
      'Ground Floor';

    return {
      elements: enriched,
      canvasConfig: layout.canvasConfig || DEFAULT_CANVAS_CONFIG,
      targetSlotEl: foundTargetSlot,
      entranceEl: foundEntrance,
      activeFloorName: resolvedFloorName,
    };
  }, [layoutQuery.data, targetSlotNumber, targetSlotId, targetFloorId, originalSlotNumber, isReassigned, booking.floor]);

  // Fits both entrance and bay (the navigation corridor), or centers on bay
  const handleFitRouteOrBay = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerW = rect.width || 800;
    const containerH = rect.height || 420;

    if (targetSlotEl && entranceEl) {
      const pad = 100;
      const minX = Math.min(entranceEl.x, targetSlotEl.x) - pad;
      const minY = Math.min(entranceEl.y, targetSlotEl.y) - pad;
      const maxX = Math.max(entranceEl.x + (entranceEl.width || 80), targetSlotEl.x + (targetSlotEl.width || 80)) + pad;
      const maxY = Math.max(entranceEl.y + (entranceEl.height || 60), targetSlotEl.y + (targetSlotEl.height || 60)) + pad;

      const boxW = Math.max(260, maxX - minX);
      const boxH = Math.max(200, maxY - minY);

      const scaleX = (containerW - 32) / boxW;
      const scaleY = (containerH - 32) / boxH;
      const nextZoom = Math.min(1.2, Math.max(0.42, Math.min(scaleX, scaleY)));

      const centerBoxX = (minX + maxX) / 2;
      const centerBoxY = (minY + maxY) / 2;
      const nextPanX = Math.round(containerW / 2 - centerBoxX * nextZoom);
      const nextPanY = Math.round(containerH / 2 - centerBoxY * nextZoom);

      setZoom(Number(nextZoom.toFixed(2)));
      setPanX(nextPanX);
      setPanY(nextPanY);
    } else if (targetSlotEl) {
      const slotCenterX = targetSlotEl.x + (targetSlotEl.width || 60) / 2;
      const slotCenterY = targetSlotEl.y + (targetSlotEl.height || 100) / 2;
      const nextZoom = 0.85;
      const nextPanX = Math.round(containerW / 2 - slotCenterX * nextZoom);
      const nextPanY = Math.round(containerH / 2 - slotCenterY * nextZoom);

      setZoom(nextZoom);
      setPanX(nextPanX);
      setPanY(nextPanY);
    } else {
      // Fit entire layout
      const scaleX = (containerW - 40) / canvasConfig.width;
      const scaleY = (containerH - 40) / canvasConfig.height;
      const nextZoom = Math.min(1.1, Math.max(0.35, Math.min(scaleX, scaleY)));
      const nextPanX = Math.round((containerW - canvasConfig.width * nextZoom) / 2);
      const nextPanY = Math.round((containerH - canvasConfig.height * nextZoom) / 2);

      setZoom(Number(nextZoom.toFixed(2)));
      setPanX(nextPanX);
      setPanY(nextPanY);
    }
  }, [targetSlotEl, entranceEl, canvasConfig]);

  // Focus exclusively on target bay
  const handleFocusBay = useCallback(() => {
    const container = containerRef.current;
    if (!container || !targetSlotEl) return;

    const rect = container.getBoundingClientRect();
    const containerW = rect.width || 800;
    const containerH = rect.height || 420;

    const slotCenterX = targetSlotEl.x + (targetSlotEl.width || 60) / 2;
    const slotCenterY = targetSlotEl.y + (targetSlotEl.height || 100) / 2;
    const nextZoom = 1.05;
    const nextPanX = Math.round(containerW / 2 - slotCenterX * nextZoom);
    const nextPanY = Math.round(containerH / 2 - slotCenterY * nextZoom);

    setZoom(nextZoom);
    setPanX(nextPanX);
    setPanY(nextPanY);
  }, [targetSlotEl]);

  // Fit entire layout canvas
  const handleFitEntireLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerW = rect.width || 800;
    const containerH = rect.height || 420;

    const scaleX = (containerW - 40) / canvasConfig.width;
    const scaleY = (containerH - 40) / canvasConfig.height;
    const nextZoom = Math.min(1.1, Math.max(0.35, Math.min(scaleX, scaleY)));
    const nextPanX = Math.round((containerW - canvasConfig.width * nextZoom) / 2);
    const nextPanY = Math.round((containerH - canvasConfig.height * nextZoom) / 2);

    setZoom(Number(nextZoom.toFixed(2)));
    setPanX(nextPanX);
    setPanY(nextPanY);
  }, [canvasConfig]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.35, Number((z - 0.15).toFixed(2))));

  // Automatically center and fit route when elements or layout is ready
  useEffect(() => {
    if (elements.length > 0) {
      const timer = setTimeout(() => {
        handleFitRouteOrBay();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [elements, handleFitRouteOrBay]);

  // Calculate entrance & slot centers for SVG path
  const navPoints = useMemo(() => {
    if (!targetSlotEl) return null;
    const sx = targetSlotEl.x + (targetSlotEl.width || 60) / 2;
    const sy = targetSlotEl.y + (targetSlotEl.height || 100) / 2;

    if (!entranceEl) {
      return { sx, sy, ex: null, ey: null };
    }

    const ex = entranceEl.x + (entranceEl.width || 80) / 2;
    const ey = entranceEl.y + (entranceEl.height || 60) / 2;

    return { sx, sy, ex, ey };
  }, [targetSlotEl, entranceEl]);

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/60 pb-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Navigation className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                Turn-by-Turn Bay Navigation
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Live 2D Map
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Direct route from facility entrance gate to your reserved bay.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge variant="outline" className="text-xs bg-slate-900/50 font-medium">
              {activeFloorName}
            </Badge>
            <Badge className="font-mono text-xs px-2.5 py-1 bg-primary text-primary-foreground">
              Destination: Bay {targetSlotNumber}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Reassignment Alert Banner */}
        {isReassigned && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Slot Reassignment Navigation Active</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Your original Bay <span className="font-mono font-bold">{originalSlotNumber}</span> was occupied by an
                  overstay vehicle. Your navigation route has been dynamically updated to{' '}
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Bay {targetSlotNumber}
                  </span>
                  . Please follow the highlighted path below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Direction Waypoints Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-2.5 text-xs">
            <div className="rounded-md bg-blue-500/10 p-1.5 text-blue-600">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Start Point</p>
              <p className="font-medium text-foreground">Main Facility Entrance Gate</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-2.5 text-xs">
            <div className="rounded-md bg-purple-500/10 p-1.5 text-purple-600">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Floor & Zone</p>
              <p className="font-medium text-foreground">
                {activeFloorName} • {booking.zoneName || booking.zone?.zoneName || 'General Zone'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 text-xs">
            <div className="rounded-md bg-emerald-500/20 p-1.5 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 uppercase font-semibold">Destination Bay</p>
              <p className="font-mono font-bold text-foreground">
                Slot {targetSlotNumber} ({booking.currentSlot?.slotType || 'Standard'})
              </p>
            </div>
          </div>
        </div>

        {/* 2D Canvas Viewport Container */}
        <div
          ref={containerRef}
          className="relative rounded-xl border border-border/80 bg-slate-950 overflow-hidden min-h-[400px] h-[440px]"
        >
          {layoutQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center h-full p-12 space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : elements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center text-xs text-muted-foreground">
              <Navigation className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="font-medium">Published layout map not available for this facility.</p>
              <p className="text-[11px] mt-1">Please refer to signage at the gate for Bay {targetSlotNumber}.</p>
            </div>
          ) : (
            <>
              <CanvasViewport
                elements={elements}
                canvasConfig={canvasConfig}
                selectedElementId={targetSlotEl?.elementId || null}
                highlightedElementId={targetSlotEl?.elementId || null}
                mode="preview"
                activeTool="select"
                showGrid={true}
                snapToGrid={false}
                zoom={zoom}
                panX={panX}
                panY={panY}
                onZoomChange={setZoom}
                onPanChange={(x, y) => {
                  setPanX(x);
                  setPanY(y);
                }}
                onSelectElement={() => {}}
                onUpdateElementPosition={() => {}}
                onRotateElement={() => {}}
                onRemoveElement={() => {}}
                onDropNewElement={() => {}}
              />

              {/* Seamless Synchronized SVG Navigation Route Overlay */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
                style={{ width: '100%', height: '100%' }}
              >
                <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                  {/* Glowing Directional Navigation Route Line */}
                  {navPoints?.ex != null && navPoints?.ey != null && (
                    <>
                      <path
                        d={`M ${navPoints.ex} ${navPoints.ey} L ${navPoints.ex} ${navPoints.sy} L ${navPoints.sx} ${navPoints.sy}`}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={4}
                        strokeDasharray="10 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.9"
                        style={{
                          filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.9))',
                        }}
                      />
                      {/* Start Waypoint Marker at Entrance */}
                      <circle cx={navPoints.ex} cy={navPoints.ey} r={12} fill="#3b82f6" stroke="#ffffff" strokeWidth={2.5} />
                      <circle cx={navPoints.ex} cy={navPoints.ey} r={18} fill="none" stroke="#60a5fa" strokeWidth={2} opacity="0.6" />
                      <text
                        x={navPoints.ex}
                        y={navPoints.ey - 16}
                        textAnchor="middle"
                        fill="#93c5fd"
                        fontSize={11}
                        fontWeight={700}
                        letterSpacing="0.5px"
                      >
                        GATE ENTRANCE
                      </text>
                    </>
                  )}

                  {/* Destination Target Bay Pulsing Pin */}
                  {navPoints && (
                    <>
                      <circle
                        cx={navPoints.sx}
                        cy={navPoints.sy}
                        r={24}
                        fill="rgba(16, 185, 129, 0.2)"
                        stroke="#10b981"
                        strokeWidth={1.5}
                      />
                      <circle cx={navPoints.sx} cy={navPoints.sy} r={12} fill="#10b981" stroke="#ffffff" strokeWidth={2.5} />
                      <circle cx={navPoints.sx} cy={navPoints.sy} r={4} fill="#ffffff" />
                      <text
                        x={navPoints.sx}
                        y={navPoints.sy + 26}
                        textAnchor="middle"
                        fill="#a7f3d0"
                        fontSize={12}
                        fontWeight={800}
                        letterSpacing="0.5px"
                      >
                        BAY {targetSlotNumber}
                      </text>
                    </>
                  )}
                </g>
              </svg>

              {/* Floating Interactive Controls Toolbar */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md p-1.5 border border-slate-700/80 shadow-xl z-20">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Focus on My Bay"
                  onClick={handleFocusBay}
                >
                  <Crosshair className="h-4 w-4 text-emerald-400" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Fit Route (Entrance to Bay)"
                  onClick={handleFitRouteOrBay}
                >
                  <Navigation className="h-4 w-4 text-blue-400" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Fit Entire Floor Map"
                  onClick={handleFitEntireLayout}
                >
                  <Maximize2 className="h-4 w-4 text-slate-300" />
                </Button>
                <div className="h-4 w-px bg-slate-700 mx-0.5" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Zoom In"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Zoom Out"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Reset View"
                  onClick={handleFitRouteOrBay}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Map Legend Overlay */}
              <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-900/90 backdrop-blur-md px-3 py-1.5 text-[10px] text-slate-300 border border-slate-700/80 shadow-lg z-20">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                  Your Destination Bay
                </span>
                {isReassigned && (
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                    Vacated Slot
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
                  Entrance Gate
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-4 bg-emerald-400 inline-block rounded-xs" />
                  Nav Route
                </span>
              </div>
            </>
          )}
        </div>

        {/* Step-by-step guidance text */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <p className="flex items-center gap-1.5 text-[11px]">
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
            Scan your QR code at the reader on <strong>Bay {targetSlotNumber}</strong> to lower the bay barrier.
          </p>
          <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
            Interactive Navigation • Pan &amp; Zoom enabled
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
