import React, { useMemo } from 'react';
import type { LayoutElementData } from '@/api/parkingLot.api';
import type { DesignerMode, LaneConnectionType, ResizeHandlePosition, ToolType } from './types';
import { cn } from '@/lib/utils';
import {
  Car,
  ArrowRight,
  Lock,
  AlertTriangle,
  TrendingUp,
  LogIn,
  LogOut,
  Footprints,
  ChevronsUpDown,
  Building2,
} from 'lucide-react';

interface CanvasElementProps {
  element: LayoutElementData;
  isSelected: boolean;
  mode: DesignerMode;
  activeTool?: ToolType;
  onSelect: (el: LayoutElementData) => void;
  onPointerDown: (e: React.PointerEvent, el: LayoutElementData) => void;
  onRotate?: (elementId: string, customAngleOrDelta?: number, isDelta?: boolean) => void;
  onRemove?: (elementId: string) => void;
  onResizeStart?: (
    e: React.PointerEvent,
    elementId: string,
    handle?: ResizeHandlePosition,
  ) => void;
  onConnectLane?: (el: LayoutElementData, connectionType: LaneConnectionType) => void;
  isConnectionHighlighted?: boolean;
  isZoneHighlighted?: boolean;
  gateElements?: LayoutElementData[];
  zoneTheme?: {
    color: string;
    fill: string;
    border: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
  };
}

export function getRotatedCursor(
  baseDirection: 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw',
  rotation = 0,
): string {
  const normRot = ((Math.round(rotation / 45) * 45) % 360 + 360) % 360;
  const dirAngles: Record<string, number> = {
    e: 0,
    se: 45,
    s: 90,
    sw: 135,
    w: 180,
    nw: 225,
    n: 270,
    ne: 315,
  };
  const effectiveAngle = (dirAngles[baseDirection] + normRot) % 360;
  if (effectiveAngle === 0 || effectiveAngle === 180) return 'cursor-ew-resize';
  if (effectiveAngle === 90 || effectiveAngle === 270) return 'cursor-ns-resize';
  if (effectiveAngle === 45 || effectiveAngle === 225) return 'cursor-nwse-resize';
  if (effectiveAngle === 135 || effectiveAngle === 315) return 'cursor-nesw-resize';
  return 'cursor-move';
}

export const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  mode,
  activeTool = 'select',
  onSelect,
  onPointerDown,
  onRotate,
  onRemove,
  onResizeStart,
  // onConnectLane omitted as rounded lane connection anchors were removed in favor of direct stretching
  isConnectionHighlighted = false,
  isZoneHighlighted = false,
  gateElements = [],
  zoneTheme,
}) => {
  const {
    elementId,
    elementType,
    x,
    y,
    width,
    height,
    rotation = 0,
    slotNumber,
    zoneCode,
    label,
    laneDirection,
    rampDirection = 'Up',
    portalType = 'Entry',
    targetFloorName,
    restrictedReason,
    reservedFor,
  } = element;

  // For Wall elements: compute any intersecting Entrance / Exit gates that cut through this wall
  const intersectingCuts = useMemo(() => {
    if (elementType !== 'Wall' || !gateElements || gateElements.length === 0) return [];
    const cuts: Array<{ cutX: number; cutY: number; cutW: number; cutH: number }> = [];

    for (const gate of gateElements) {
      const gRot = (gate.rotation || 0) % 180;
      const gW = gRot === 90 ? gate.height : gate.width;
      const gH = gRot === 90 ? gate.width : gate.height;
      const gLeft = gate.x + (gate.width - gW) / 2;
      const gTop = gate.y + (gate.height - gH) / 2;
      const gRight = gLeft + gW;
      const gBottom = gTop + gH;

      const wRot = (rotation || 0) % 180;
      const wW = wRot === 90 ? height : width;
      const wH = wRot === 90 ? width : height;
      const wLeft = x + (width - wW) / 2;
      const wTop = y + (height - wH) / 2;
      const wRight = wLeft + wW;
      const wBottom = wTop + wH;

      const intersects = !(
        gRight < wLeft ||
        gLeft > wRight ||
        gBottom < wTop ||
        gTop > wBottom
      );

      if (intersects) {
        const overlapWorldLeft = Math.max(wLeft, gLeft);
        const overlapWorldTop = Math.max(wTop, gTop);
        const overlapWorldRight = Math.min(wRight, gRight);
        const overlapWorldBottom = Math.min(wBottom, gBottom);

        const localCutX = Math.max(0, overlapWorldLeft - wLeft);
        const localCutY = Math.max(0, overlapWorldTop - wTop);
        const localCutW = Math.min(width, overlapWorldRight - overlapWorldLeft);
        const localCutH = Math.min(height, overlapWorldBottom - overlapWorldTop);

        if (localCutW > 2 && localCutH > 2) {
          cuts.push({ cutX: localCutX, cutY: localCutY, cutW: localCutW, cutH: localCutH });
        }
      }
    }
    return cuts;
  }, [elementType, gateElements, x, y, width, height, rotation]);

  const isSquareHub =
    label?.includes('Square') || label?.includes('Connector') || label?.includes('Hub');
  const isEdit = mode === 'edit';

  const transform = `translate(${x}, ${y}) rotate(${rotation}, ${width / 2}, ${height / 2})`;

  return (
    <g
      id={`canvas-elem-${elementId}`}
      transform={transform}
      className={`select-none ${
        isEdit
          ? activeTool === 'measure'
            ? 'cursor-crosshair'
            : 'cursor-move'
          : 'cursor-pointer'
      } group transition-all ${
        isConnectionHighlighted
          ? 'filter drop-shadow(0 0 12px rgba(6, 182, 212, 0.85))'
          : isSelected
          ? 'filter drop-shadow(0 0 6px rgba(59, 130, 246, 0.6))'
          : ''
      }`}
      onPointerDown={(e) => {
        if (isEdit) {
          onPointerDown(e, element);
        } else {
          onSelect(element);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(element);
      }}
    >
      {/* Visual Beacon when highlighted in Connected Props Inspector */}
      {isConnectionHighlighted && (
        <g pointerEvents="none" className="animate-pulse">
          <rect
            x={-5}
            y={-5}
            width={width + 10}
            height={height + 10}
            rx={8}
            fill="rgba(6, 182, 212, 0.2)"
            stroke="#06b6d4"
            strokeWidth={3}
            strokeDasharray="6 3"
          />
          <foreignObject x={0} y={-24} width={Math.max(120, width)} height={22}>
            <div className="w-full flex justify-center">
              <span className="text-[9px] font-black tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-400 px-2 py-0.5 rounded shadow-lg uppercase select-none">
                🔗 CONNECTED
              </span>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 1. PARKING SLOT */}
      {elementType === 'ParkingSlot' && (() => {
        const isBooking = mode === 'booking';
        const effectiveStatus = element.effectiveStatus || 'Available';
        const isCompatible = element.isVehicleCompatible !== false;

        // Determine booking status visual colors (Available=Green, Reserved=Yellow, Occupied=Red, Maintenance=Grey, Selected=Blue)
        let bookingFill = 'rgba(16, 185, 129, 0.22)';
        let bookingStroke = '#10b981';
        let statusLabel = 'AVAILABLE';
        let statusBadgeClass = 'text-emerald-300 bg-emerald-950/90 border border-emerald-500/40';
        let carIconClass = 'text-emerald-400';

        if (isBooking) {
          if (isSelected) {
            bookingFill = 'rgba(59, 130, 246, 0.38)';
            bookingStroke = '#3b82f6';
            statusLabel = 'SELECTED';
            statusBadgeClass = 'text-blue-200 bg-blue-950/95 border border-blue-400';
            carIconClass = 'text-blue-300';
          } else if (effectiveStatus === 'Under Maintenance') {
            bookingFill = 'rgba(100, 116, 139, 0.25)';
            bookingStroke = '#64748b';
            statusLabel = 'MAINTENANCE';
            statusBadgeClass = 'text-slate-300 bg-slate-900/90 border border-slate-600/50';
            carIconClass = 'text-slate-400';
          } else if (effectiveStatus === 'Occupied') {
            bookingFill = 'rgba(239, 68, 68, 0.26)';
            bookingStroke = '#ef4444';
            statusLabel = 'OCCUPIED';
            statusBadgeClass = 'text-red-300 bg-red-950/90 border border-red-500/40';
            carIconClass = 'text-red-400';
          } else if (effectiveStatus === 'Reserved') {
            bookingFill = 'rgba(234, 179, 8, 0.26)';
            bookingStroke = '#eab308';
            statusLabel = 'RESERVED';
            statusBadgeClass = 'text-amber-300 bg-amber-950/90 border border-amber-500/40';
            carIconClass = 'text-amber-400';
          } else if (!isCompatible) {
            bookingFill = 'rgba(71, 85, 105, 0.18)';
            bookingStroke = '#475569';
            statusLabel = element.supportedVehicleType ? `${element.supportedVehicleType.toUpperCase()} ONLY` : 'INCOMPATIBLE';
            statusBadgeClass = 'text-slate-400 bg-slate-900/80 border border-slate-700';
            carIconClass = 'text-slate-500';
          }
        }

        return (
          <g className={isBooking && !isCompatible && !isSelected ? 'opacity-60' : ''}>
            {/* Slot Bay Background */}
            <rect
              width={width}
              height={height}
              rx={4}
              fill={
                isBooking
                  ? bookingFill
                  : isZoneHighlighted && zoneTheme
                  ? zoneTheme.fill
                  : isEdit
                  ? isSelected
                    ? '#1e293b'
                    : '#0f172a'
                  : '#064e3b15'
              }
              stroke={
                isBooking
                  ? bookingStroke
                  : isSelected
                  ? '#3b82f6'
                  : isZoneHighlighted && zoneTheme
                  ? zoneTheme.border
                  : isEdit
                  ? '#475569'
                  : '#10b981'
              }
              strokeWidth={isSelected ? 3 : isBooking ? 2 : isZoneHighlighted ? 2 : 1.5}
              strokeDasharray={
                isBooking
                  ? effectiveStatus === 'Under Maintenance' || !isCompatible
                    ? '4 3'
                    : undefined
                  : isZoneHighlighted
                  ? '6 3'
                  : undefined
              }
            />

            {/* Open Bay Entry Indicator (bottom open edge) */}
            <line
              x1={4}
              y1={height - 1}
              x2={width - 4}
              y2={height - 1}
              stroke={
                isBooking
                  ? bookingStroke
                  : isZoneHighlighted && zoneTheme
                  ? zoneTheme.color
                  : '#94a3b8'
              }
              strokeWidth={2}
              strokeDasharray="4 3"
            />

            {/* Slot Number & Badges */}
            <foreignObject x={2} y={2} width={width - 4} height={height - 8}>
              <div className="w-full h-full flex flex-col items-center justify-between p-1.5 text-center pointer-events-none select-none">
                <div className="flex items-center justify-between w-full">
                  <span
                    className={cn(
                      'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors',
                      isZoneHighlighted && zoneTheme
                        ? `${zoneTheme.badgeBg} ${zoneTheme.badgeText} border-current`
                        : 'bg-primary/20 text-primary border-primary/30',
                    )}
                  >
                    {zoneCode || slotNumber?.match(/^([A-Za-z]+)/)?.[1] || 'A'}
                  </span>
                  <span className="text-[9px] text-slate-300 font-mono">
                    {isBooking && element.supportedVehicleType
                      ? element.supportedVehicleType
                      : `${width}×${height}`}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center my-auto">
                  <div className="flex items-center gap-1">
                    <Car className={cn('h-4 w-4 shrink-0', isBooking ? carIconClass : 'text-primary')} />
                    <span className="text-xs font-black tracking-tight text-white font-mono">
                      {slotNumber || 'SLOT'}
                    </span>
                  </div>
                  {label && (
                    <span className="text-[9px] text-slate-300 truncate max-w-[80px]">
                      {label}
                    </span>
                  )}
                </div>

                <div className="w-full">
                  {isEdit ? (
                    <span className="text-[8px] uppercase tracking-wider font-semibold text-emerald-400 block bg-emerald-950/60 rounded px-1">
                      Mapped
                    </span>
                  ) : isBooking ? (
                    <span className={cn('text-[8px] font-bold tracking-wider block rounded py-0.5 px-1 truncate', statusBadgeClass)}>
                      {statusLabel}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-emerald-500 block bg-emerald-500/10 rounded py-0.5">
                      AVAILABLE
                    </span>
                  )}
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })()}

      {/* 2. DRIVING LANE & CORNER CONNECTOR */}
      {elementType === 'DrivingLane' && (
        <g>
          {/* Road Asphalt Fill */}
          <rect
            width={width}
            height={height}
            rx={4}
            fill="#1e293b"
            stroke={isSelected ? '#3b82f6' : '#334155'}
            strokeWidth={isSelected ? 2 : 1}
          />

          {/* Road Curb Edge Markings */}
          {width >= height ? (
            <>
              <line x1={0} y1={2} x2={width} y2={2} stroke="#475569" strokeWidth={1.5} opacity={0.6} />
              <line x1={0} y1={height - 2} x2={width} y2={height - 2} stroke="#475569" strokeWidth={1.5} opacity={0.6} />
            </>
          ) : (
            <>
              <line x1={2} y1={0} x2={2} y2={height} stroke="#475569" strokeWidth={1.5} opacity={0.6} />
              <line x1={width - 2} y1={0} x2={width - 2} y2={height} stroke="#475569" strokeWidth={1.5} opacity={0.6} />
            </>
          )}

          {/* Center Dividing Line & Road Geometry */}
          {isSquareHub ? (
            /* 4-Way Square Connector: Box Junction Yellow Grid + 4-Way Through Centerlines + Smart Routing Core */
            <g>
              {/* Box Junction Yellow Grid Hatching */}
              <rect
                x={10}
                y={10}
                width={width - 20}
                height={height - 20}
                fill="none"
                stroke="#facc15"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                opacity={0.4}
              />
              <line
                x1={10}
                y1={10}
                x2={width - 10}
                y2={height - 10}
                stroke="#facc15"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.3}
              />
              <line
                x1={width - 10}
                y1={10}
                x2={10}
                y2={height - 10}
                stroke="#facc15"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.3}
              />

              {/* East-West Through Centerline */}
              <line
                x1={0}
                y1={height / 2}
                x2={width}
                y2={height / 2}
                stroke="#facc15"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                opacity={0.9}
              />
              {/* North-South Through Centerline */}
              <line
                x1={width / 2}
                y1={0}
                x2={width / 2}
                y2={height}
                stroke="#facc15"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                opacity={0.9}
              />

              {/* Central Topological Routing Hub Node */}
              <circle
                cx={width / 2}
                cy={height / 2}
                r={15}
                fill="#083344"
                stroke="#06b6d4"
                strokeWidth={2}
                className="drop-shadow"
              />
              <circle
                cx={width / 2}
                cy={height / 2}
                r={5.5}
                fill="#22d3ee"
                className="animate-pulse"
              />
              <text
                x={width / 2}
                y={height / 2 + 3}
                fill="#ecfeff"
                fontSize={8.5}
                fontWeight="black"
                textAnchor="middle"
                pointerEvents="none"
              >
                ✛
              </text>
            </g>
          ) : label?.includes('Turn') || label?.includes('Corner') ? (
            /* Curved Centerline for Corner / Turn Connector */
            <g>
              <path
                d={`M 0 ${height / 2} Q ${width / 2} ${height / 2} ${width / 2} ${height}`}
                stroke="#facc15"
                strokeWidth={2.5}
                strokeDasharray="8 6"
                fill="none"
                opacity={0.9}
              />
              <path
                d={`M 0 0 Q ${width} 0 ${width} ${height}`}
                stroke="#64748b"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="none"
                opacity={0.3}
              />
            </g>
          ) : label?.includes('T-Junction') ? (
            /* T-Junction 3-Way Centerlines */
            <g>
              <line
                x1={0}
                y1={height / 2}
                x2={width}
                y2={height / 2}
                stroke="#facc15"
                strokeWidth={2.5}
                strokeDasharray="8 6"
                opacity={0.9}
              />
              <line
                x1={width / 2}
                y1={height / 2}
                x2={width / 2}
                y2={height}
                stroke="#facc15"
                strokeWidth={2.5}
                strokeDasharray="8 6"
                opacity={0.9}
              />
            </g>
          ) : (
            /* Straight Dividing Centerline */
            <line
              x1={width >= height ? 0 : width / 2}
              y1={width >= height ? height / 2 : 0}
              x2={width >= height ? width : width / 2}
              y2={width >= height ? height / 2 : height}
              stroke="#facc15"
              strokeWidth={2}
              strokeDasharray="10 8"
              opacity={0.85}
            />
          )}

          {/* Train-Track End Couplers / Docking Sockets */}
          {isSquareHub ? (
            /* 4-Way Couplers at North, South, West, and East faces */
            <>
              {/* North Coupler */}
              <line x1={width / 2 - 12} y1={4} x2={width / 2 + 12} y2={4} stroke="#facc15" strokeWidth={2} opacity={0.7} />
              <circle cx={width / 2} cy={2} r={3.5} fill="#0f172a" stroke="#22d3ee" strokeWidth={1.5} />
              {/* South Coupler */}
              <line x1={width / 2 - 12} y1={height - 4} x2={width / 2 + 12} y2={height - 4} stroke="#facc15" strokeWidth={2} opacity={0.7} />
              <circle cx={width / 2} cy={height - 2} r={3.5} fill="#0f172a" stroke="#22d3ee" strokeWidth={1.5} />
              {/* West Coupler */}
              <line x1={4} y1={height / 2 - 12} x2={4} y2={height / 2 + 12} stroke="#facc15" strokeWidth={2} opacity={0.7} />
              <circle cx={2} cy={height / 2} r={3.5} fill="#0f172a" stroke="#22d3ee" strokeWidth={1.5} />
              {/* East Coupler */}
              <line x1={width - 4} y1={height / 2 - 12} x2={width - 4} y2={height / 2 + 12} stroke="#facc15" strokeWidth={2} opacity={0.7} />
              <circle cx={width - 2} cy={height / 2} r={3.5} fill="#0f172a" stroke="#22d3ee" strokeWidth={1.5} />
            </>
          ) : label?.includes('Turn') || label?.includes('Corner') ? (
            /* 90° Turn: Coupler at West end and South vertical end */
            <>
              {/* West Road Coupler */}
              <line x1={4} y1={height / 2 - 12} x2={4} y2={height / 2 + 12} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={2} cy={height / 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
              {/* South Vertical Road Coupler */}
              <line x1={width / 2 - 12} y1={height - 4} x2={width / 2 + 12} y2={height - 4} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={width / 2} cy={height - 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
            </>
          ) : label?.includes('T-Junction') ? (
            /* T-Junction: Coupler at West, East, and South Merge Stem */
            <>
              {/* West Coupler */}
              <line x1={4} y1={height / 2 - 12} x2={4} y2={height / 2 + 12} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={2} cy={height / 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
              {/* East Coupler */}
              <line x1={width - 4} y1={height / 2 - 12} x2={width - 4} y2={height / 2 + 12} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={width - 2} cy={height / 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
              {/* South Merge Stem Coupler */}
              <line x1={width / 2 - 12} y1={height - 4} x2={width / 2 + 12} y2={height - 4} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={width / 2} cy={height - 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
            </>
          ) : width >= height ? (
            /* Straight Horizontal Road Couplers */
            <>
              {/* Left End Joint & Socket */}
              <line x1={4} y1={height / 2 - 12} x2={4} y2={height / 2 + 12} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={2} cy={height / 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
              {/* Right End Joint & Socket */}
              <line x1={width - 4} y1={height / 2 - 12} x2={width - 4} y2={height / 2 + 12} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={width - 2} cy={height / 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
            </>
          ) : (
            /* Straight Vertical Road Couplers */
            <>
              {/* Top End Joint & Socket */}
              <line x1={width / 2 - 12} y1={4} x2={width / 2 + 12} y2={4} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={width / 2} cy={2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
              {/* Bottom End Joint & Socket */}
              <line x1={width / 2 - 12} y1={height - 4} x2={width / 2 + 12} y2={height - 4} stroke="#facc15" strokeWidth={2} opacity={0.6} />
              <circle cx={width / 2} cy={height - 2} r={3.5} fill="#0f172a" stroke="#facc15" strokeWidth={1.5} />
            </>
          )}

          {/* Lane Flow Badge / Arrows */}
          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex items-center justify-center gap-1.5 p-1 text-muted-foreground pointer-events-none select-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60 shadow-xs">
                {isSquareHub
                  ? '✛ 4-WAY ROUTER'
                  : label?.includes('Turn') || label?.includes('Corner')
                  ? '↱ 90° TURN'
                  : label?.includes('T-Junction')
                  ? '┳ T-JUNCTION'
                  : laneDirection === 'Two-Way'
                  ? '⇄ TWO-WAY LANE'
                  : laneDirection === 'One-Way-Backward'
                  ? '← ONE-WAY'
                  : '→ ONE-WAY'}
              </span>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 3. ENTRANCE GATE */}
      {elementType === 'Entrance' && (
        <g>
          <rect
            width={width}
            height={height}
            rx={4}
            fill="#065f46"
            stroke={isSelected ? '#3b82f6' : '#10b981'}
            strokeWidth={isSelected ? 2.5 : 2}
          />
          {/* Accent Entry Strip & Road Dock Socket */}
          <rect width={8} height={height} rx={2} fill="#34d399" />
          <circle cx={width} cy={height / 2} r={3.5} fill="#065f46" stroke="#34d399" strokeWidth={1.5} />
          <foreignObject x={8} y={0} width={width - 8} height={height}>
            <div className="w-full h-full flex items-center justify-center gap-1.5 px-2 text-emerald-100 pointer-events-none select-none">
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-300 animate-pulse" />
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                  {label || 'ENTRANCE'}
                </span>
                <span className="text-[9px] text-emerald-200">ENTRY GATE</span>
              </div>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 4. EXIT GATE */}
      {elementType === 'Exit' && (
        <g>
          <rect
            width={width}
            height={height}
            rx={4}
            fill="#881337"
            stroke={isSelected ? '#3b82f6' : '#f43f5e'}
            strokeWidth={isSelected ? 2.5 : 2}
          />
          {/* Accent Exit Strip & Road Dock Socket */}
          <rect width={8} height={height} rx={2} fill="#fb7185" />
          <circle cx={0} cy={height / 2} r={3.5} fill="#881337" stroke="#fb7185" strokeWidth={1.5} />
          <foreignObject x={8} y={0} width={width - 8} height={height}>
            <div className="w-full h-full flex items-center justify-center gap-1.5 px-2 text-rose-100 pointer-events-none select-none">
              <ArrowRight className="h-4 w-4 shrink-0 text-rose-300" />
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                  {label || 'EXIT'}
                </span>
                <span className="text-[9px] text-rose-200">EXIT GATE</span>
              </div>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 5. PILLAR (Load-bearing structural column - continuous across floors) */}
      {elementType === 'Pillar' && (
        <g>
          <rect
            width={width}
            height={height}
            rx={2}
            fill="url(#boundary-wall-hatch)"
            stroke={
              isSelected
                ? '#38bdf8'
                : element.occupiesAllFloors || element.syncAcrossAllFloors
                ? '#0284c7'
                : '#475569'
            }
            strokeWidth={isSelected ? 2.5 : 1.6}
          />
          {/* Structural concrete chamfered core */}
          <line x1={0} y1={0} x2={width} y2={height} stroke="#64748b" strokeWidth={1.2} />
          <line x1={width} y1={0} x2={0} y2={height} stroke="#64748b" strokeWidth={1.2} />
          <rect
            x={width / 4}
            y={height / 4}
            width={width / 2}
            height={height / 2}
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth={1}
            rx={1}
          />

          {/* Multi-Storey Column Badge */}
          {(element.occupiesAllFloors || element.syncAcrossAllFloors) && width >= 28 && height >= 18 && (
            <g transform={`translate(${width - 18}, 2)`}>
              <rect width={16} height={8} rx={1.5} fill="#0284c7" />
              <text x={8} y={6} textAnchor="middle" fill="#ffffff" fontSize="5.5" fontFamily="monospace" fontWeight="bold">
                ALL
              </text>
            </g>
          )}

          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex items-center justify-center text-slate-300 pointer-events-none select-none font-bold text-[9px] font-mono">
              {label || 'COL'}
            </div>
          </foreignObject>
        </g>
      )}

      {/* 6. WALL (Architectural concrete body, merges with surrounding walls, cuts open for Entrance/Exit gates) */}
      {elementType === 'Wall' && (
        <g>
          {/* Dynamic Cutout Mask for any intersecting Entrance / Exit gates */}
          {intersectingCuts.length > 0 && (
            <defs>
              <mask id={`wall-cutout-${elementId}`}>
                <rect width={width} height={height} fill="white" />
                {intersectingCuts.map((cut, idx) => (
                  <rect
                    key={`cut-${idx}`}
                    x={cut.cutX - 1}
                    y={cut.cutY - 1}
                    width={cut.cutW + 2}
                    height={cut.cutH + 2}
                    fill="black"
                  />
                ))}
              </mask>
            </defs>
          )}

          {/* Wall masonry concrete body matching boundary walls */}
          <rect
            width={width}
            height={height}
            rx={1}
            fill="url(#boundary-wall-hatch)"
            stroke={isSelected ? '#3b82f6' : '#475569'}
            strokeWidth={isSelected ? 2 : 1.5}
            mask={intersectingCuts.length > 0 ? `url(#wall-cutout-${elementId})` : undefined}
          />

          {/* Architectural center cap line */}
          {width >= height ? (
            <line
              x1={0}
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="6 3"
              mask={intersectingCuts.length > 0 ? `url(#wall-cutout-${elementId})` : undefined}
            />
          ) : (
            <line
              x1={width / 2}
              y1={0}
              x2={width / 2}
              y2={height}
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="6 3"
              mask={intersectingCuts.length > 0 ? `url(#wall-cutout-${elementId})` : undefined}
            />
          )}

          {/* Architectural Gate Jambs on both sides of each cutout opening */}
          {intersectingCuts.map((cut, idx) => (
            <g key={`jamb-${idx}`} pointerEvents="none">
              {width >= height ? (
                <>
                  <rect x={cut.cutX - 3} y={0} width={3} height={height} fill="#1e293b" stroke="#94a3b8" strokeWidth={1} />
                  <rect x={cut.cutX + cut.cutW} y={0} width={3} height={height} fill="#1e293b" stroke="#94a3b8" strokeWidth={1} />
                </>
              ) : (
                <>
                  <rect x={0} y={cut.cutY - 3} width={width} height={3} fill="#1e293b" stroke="#94a3b8" strokeWidth={1} />
                  <rect x={0} y={cut.cutY + cut.cutH} width={width} height={3} fill="#1e293b" stroke="#94a3b8" strokeWidth={1} />
                </>
              )}
            </g>
          ))}
        </g>
      )}

      {/* 7. RESTRICTED AREA */}
      {elementType === 'RestrictedArea' && (
        <g>
          <rect
            width={width}
            height={height}
            rx={4}
            fill="#7c2d1230"
            stroke={isSelected ? '#3b82f6' : '#ea580c'}
            strokeWidth={isSelected ? 2.5 : 1.5}
            strokeDasharray="6 4"
          />
          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-amber-500 pointer-events-none select-none">
              <AlertTriangle className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                RESTRICTED
              </span>
              <span className="text-[9px] text-amber-200/80 truncate max-w-[90%]">
                {restrictedReason || label || 'No Parking'}
              </span>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 8. RESERVED AREA */}
      {elementType === 'ReservedArea' && (
        <g>
          <rect
            width={width}
            height={height}
            rx={4}
            fill="#1e3a8a30"
            stroke={isSelected ? '#3b82f6' : '#3b82f6'}
            strokeWidth={isSelected ? 2.5 : 1.5}
            strokeDasharray="6 4"
          />
          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-blue-400 pointer-events-none select-none">
              <Lock className="h-4 w-4 mb-1 text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                RESERVED
              </span>
              <span className="text-[9px] text-blue-200/80 truncate max-w-[90%]">
                {reservedFor || label || 'Designated Bay'}
              </span>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 9. VEHICULAR RAMP (Upper / Lower Levels Connector) */}
      {elementType === 'Ramp' && (
        <g>
          {/* Ramp Base Road Surface */}
          <rect
            width={width}
            height={height}
            rx={6}
            fill="#181e2e"
            stroke={isSelected ? '#3b82f6' : rampDirection === 'Up' ? '#059669' : rampDirection === 'Down' ? '#d97706' : '#6366f1'}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />

          {/* Concrete Guardrail Side Curbs */}
          <line x1={0} y1={2} x2={width} y2={2} stroke="#475569" strokeWidth={4} />
          <line x1={0} y1={height - 2} x2={width} y2={height - 2} stroke="#475569" strokeWidth={4} />

          {/* Incline Texture: Transverse Traction Grooves */}
          {Array.from({ length: Math.max(3, Math.floor(width / 24)) }).map((_, idx) => {
            const lineX = 14 + idx * 24;
            if (lineX >= width - 10) return null;
            return (
              <line
                key={idx}
                x1={lineX}
                y1={6}
                x2={lineX}
                y2={height - 6}
                stroke="#334155"
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.6}
              />
            );
          })}

          {/* Two-Way Center Divider */}
          {rampDirection === 'Two-Way' && (
            <line
              x1={0}
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="#eab308"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )}

          {/* Incline Flow Directional Graphic */}
          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center pointer-events-none select-none">
              <div className="flex items-center gap-1">
                <TrendingUp
                  className={`h-4 w-4 ${
                    rampDirection === 'Up'
                      ? 'text-emerald-400'
                      : rampDirection === 'Down'
                      ? 'text-amber-400 rotate-180'
                      : 'text-indigo-400'
                  }`}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    rampDirection === 'Up'
                      ? 'text-emerald-300'
                      : rampDirection === 'Down'
                      ? 'text-amber-300'
                      : 'text-indigo-300'
                  }`}
                >
                  {rampDirection === 'Up'
                    ? '▲ RAMP UP'
                    : rampDirection === 'Down'
                    ? '▼ RAMP DOWN'
                    : '⇅ TWO-WAY RAMP'}
                </span>
              </div>
              <span className="text-[9px] font-semibold text-slate-300/90 truncate max-w-[95%] mt-0.5">
                {targetFloorName || label || (rampDirection === 'Up' ? 'To Upper Level' : rampDirection === 'Down' ? 'To Lower Level' : 'Floor Connector')}
              </span>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 10. RAMP PORTAL / FLOOR TRANSITION GATE */}
      {elementType === 'RampPortal' && (
        <g>
          {/* Base Portal Road */}
          <rect
            width={width}
            height={height}
            rx={6}
            fill={portalType === 'Entry' ? '#064e3b40' : portalType === 'Exit' ? '#7f1d1d40' : '#312e8140'}
            stroke={
              isSelected
                ? '#3b82f6'
                : portalType === 'Entry'
                ? '#10b981'
                : portalType === 'Exit'
                ? '#f43f5e'
                : '#818cf8'
            }
            strokeWidth={isSelected ? 2.5 : 2}
          />

          {/* Barrier gate curb lines */}
          <line
            x1={0}
            y1={0}
            x2={width}
            y2={0}
            stroke={portalType === 'Entry' ? '#10b981' : portalType === 'Exit' ? '#f43f5e' : '#818cf8'}
            strokeWidth={3}
            strokeDasharray="8 4"
          />

          {portalType === 'Two-Way' && (
            <line
              x1={width / 2}
              y1={0}
              x2={width / 2}
              y2={height}
              stroke="#eab308"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center pointer-events-none select-none">
              <div className="flex items-center gap-1">
                {portalType === 'Entry' ? (
                  <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                ) : portalType === 'Exit' ? (
                  <LogOut className="h-3.5 w-3.5 text-rose-400" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-400" />
                )}
                <span
                  className={`text-[9px] font-black uppercase tracking-wider ${
                    portalType === 'Entry'
                      ? 'text-emerald-300'
                      : portalType === 'Exit'
                      ? 'text-rose-300'
                      : 'text-indigo-300'
                  }`}
                >
                  {portalType === 'Entry'
                    ? '▲ RAMP ARRIVAL'
                    : portalType === 'Exit'
                    ? '▼ RAMP DEPARTURE'
                    : '⇅ RAMP PORTAL'}
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-200 truncate max-w-[95%]">
                {portalType === 'Entry'
                  ? `Entry: ${targetFloorName || 'Floor'}`
                  : portalType === 'Exit'
                  ? `Exit: ${targetFloorName || 'Floor'}`
                  : `Portal: ${targetFloorName || 'Floor'}`}
              </span>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 11. PASSENGER LIFT / ELEVATOR */}
      {elementType === 'Lift' && (
        <g>
          {/* Outer Structural Concrete Shaft */}
          <rect
            width={width}
            height={height}
            rx={4}
            fill="#0b1329"
            stroke={isSelected ? '#38bdf8' : '#0284c7'}
            strokeWidth={isSelected ? 2.5 : 1.8}
          />
          {/* Architectural Shaft Cross Lines (Standard CAD symbol for elevator shaft) */}
          <line x1={4} y1={4} x2={width - 4} y2={height - 4} stroke="#0284c725" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={width - 4} y1={4} x2={4} y2={height - 4} stroke="#0284c725" strokeWidth={1} strokeDasharray="3 3" />

          {/* Lift Car Cabin */}
          <rect
            x={Math.max(6, width * 0.12)}
            y={Math.max(6, height * 0.12)}
            width={Math.max(20, width * 0.76)}
            height={Math.max(20, height * 0.76)}
            rx={3}
            fill="#0f172a"
            stroke="#38bdf8"
            strokeWidth={1.5}
          />

          {/* Center Sliding Door Split Line */}
          <line
            x1={width / 2}
            y1={Math.max(6, height * 0.12)}
            x2={width / 2}
            y2={height - Math.max(6, height * 0.12)}
            stroke="#38bdf880"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />

          {/* Multi-Storey Shaft Badge */}
          {(element.occupiesAllFloors || element.syncAcrossAllFloors) && (
            <g transform={`translate(${width - 24}, 3)`}>
              <rect width={21} height={10} rx={2} fill="#0284c7" />
              <text x={10.5} y={7.5} textAnchor="middle" fill="#ffffff" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                ALL
              </text>
            </g>
          )}

          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center pointer-events-none select-none">
              <div className="flex items-center gap-0.5 text-sky-400">
                <ChevronsUpDown className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black tracking-wider text-sky-200">
                  {label || 'LIFT'}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[7px] font-mono px-1 py-0.2 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-bold">
                  ▲▼ ELEVATOR
                </span>
              </div>
            </div>
          </foreignObject>
        </g>
      )}

      {/* 12. PEDESTRIAN STAIRCASE / STAIRWELL */}
      {elementType === 'Staircase' && (() => {
        const stepCount = Math.max(4, Math.min(12, Math.floor(width / 14)));
        const stepWidth = (width - 12) / stepCount;
        return (
          <g>
            {/* Outer Enclosure Wall */}
            <rect
              width={width}
              height={height}
              rx={4}
              fill="#18120c"
              stroke={isSelected ? '#fbbf24' : '#d97706'}
              strokeWidth={isSelected ? 2.5 : 1.8}
            />

            {/* Stepped Treads Pattern */}
            {Array.from({ length: stepCount }).map((_, idx) => {
              const xPos = 6 + idx * stepWidth;
              const isEven = idx % 2 === 0;
              return (
                <g key={idx}>
                  <rect
                    x={xPos}
                    y={6}
                    width={stepWidth}
                    height={height - 12}
                    fill={isEven ? '#78350f35' : '#451a0320'}
                  />
                  <line
                    x1={xPos + stepWidth}
                    y1={6}
                    x2={xPos + stepWidth}
                    y2={height - 6}
                    stroke="#d9770660"
                    strokeWidth={1.2}
                  />
                </g>
              );
            })}

            {/* Central Egress / Flight Direction Line */}
            <line
              x1={8}
              y1={height / 2}
              x2={width - 14}
              y2={height / 2}
              stroke="#fbbf24"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            {/* Direction Arrow Head */}
            <polygon
              points={`${width - 10},${height / 2} ${width - 16},${height / 2 - 4} ${width - 16},${height / 2 + 4}`}
              fill="#fbbf24"
            />

            {/* Multi-Storey Shaft Badge */}
            {(element.occupiesAllFloors || element.syncAcrossAllFloors) && (
              <g transform={`translate(${width - 24}, 3)`}>
                <rect width={21} height={10} rx={2} fill="#d97706" />
                <text x={10.5} y={7.5} textAnchor="middle" fill="#ffffff" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                  ALL
                </text>
              </g>
            )}

            <foreignObject x={0} y={0} width={width} height={height}>
              <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center pointer-events-none select-none">
                <div className="flex items-center gap-1 bg-amber-950/85 px-1.5 py-0.5 rounded border border-amber-500/40 shadow-xs">
                  <Footprints className="h-3 w-3 text-amber-400" />
                  <span className="text-[9px] font-black tracking-wider text-amber-200">
                    {label || 'STAIRS'}
                  </span>
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })()}

      {/* 13. COMBINED LIFT & STAIRCASE CORE AREA */}
      {elementType === 'LiftStaircase' && (() => {
        const splitX = Math.round(width * 0.44);
        const stairCount = Math.max(3, Math.min(8, Math.floor((width - splitX - 12) / 14)));
        const stairWidth = (width - splitX - 12) / stairCount;

        return (
          <g>
            {/* Perimeter Structural Enclosure */}
            <rect
              width={width}
              height={height}
              rx={5}
              fill="#0f172a"
              stroke={isSelected ? '#38bdf8' : '#0ea5e9'}
              strokeWidth={isSelected ? 2.5 : 2}
            />

            {/* Dividing Solid Concrete Core Wall between Lift and Stairs */}
            <rect
              x={splitX - 3}
              y={0}
              width={6}
              height={height}
              fill="#334155"
              stroke="#475569"
              strokeWidth={1}
            />

            {/* --- LEFT SIDE: ELEVATOR SHAFT --- */}
            <g>
              {/* Shaft background */}
              <rect
                x={4}
                y={4}
                width={splitX - 7}
                height={height - 8}
                rx={3}
                fill="#0b1329"
                stroke="#0284c7"
                strokeWidth={1.2}
              />
              {/* Shaft cross lines */}
              <line x1={6} y1={6} x2={splitX - 5} y2={height - 6} stroke="#0284c725" strokeWidth={1} strokeDasharray="2 2" />
              <line x1={splitX - 5} y1={6} x2={6} y2={height - 6} stroke="#0284c725" strokeWidth={1} strokeDasharray="2 2" />

              {/* Lift Car */}
              <rect
                x={8}
                y={8}
                width={splitX - 15}
                height={height - 16}
                rx={2}
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth={1.2}
              />
              {/* Sliding Door center split */}
              <line
                x1={(8 + splitX - 7) / 2}
                y1={8}
                x2={(8 + splitX - 7) / 2}
                y2={height - 8}
                stroke="#38bdf870"
                strokeWidth={1.2}
              />
            </g>

            {/* --- RIGHT SIDE: STAIRWELL --- */}
            <g>
              {/* Stairwell background */}
              <rect
                x={splitX + 3}
                y={4}
                width={width - splitX - 7}
                height={height - 8}
                rx={3}
                fill="#18120c"
                stroke="#d97706"
                strokeWidth={1.2}
              />

              {/* Steps Treads */}
              {Array.from({ length: stairCount }).map((_, idx) => {
                const sX = splitX + 5 + idx * stairWidth;
                const isEven = idx % 2 === 0;
                return (
                  <g key={idx}>
                    <rect
                      x={sX}
                      y={6}
                      width={stairWidth}
                      height={height - 12}
                      fill={isEven ? '#78350f35' : '#451a0320'}
                    />
                    <line
                      x1={sX + stairWidth}
                      y1={6}
                      x2={sX + stairWidth}
                      y2={height - 6}
                      stroke="#d9770660"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {/* Walking directional arrow */}
              <line
                x1={splitX + 8}
                y1={height / 2}
                x2={width - 12}
                y2={height / 2}
                stroke="#fbbf24"
                strokeWidth={1.4}
                strokeDasharray="3 2"
              />
              <polygon
                points={`${width - 8},${height / 2} ${width - 13},${height / 2 - 3} ${width - 13},${height / 2 + 3}`}
                fill="#fbbf24"
              />
            </g>

            {/* Multi-Storey Shaft Badge */}
            {(element.occupiesAllFloors || element.syncAcrossAllFloors) && (
              <g transform={`translate(${splitX - 16}, 3)`}>
                <rect width={32} height={10} rx={2} fill="#0284c7" />
                <text x={16} y={7.5} textAnchor="middle" fill="#ffffff" fontSize="6.5" fontFamily="monospace" fontWeight="bold">
                  ALL FLOORS
                </text>
              </g>
            )}

            {/* Identification Badges */}
            <foreignObject x={0} y={0} width={width} height={height}>
              <div className="w-full h-full flex flex-col justify-between p-1.5 pointer-events-none select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5 bg-sky-950/90 border border-sky-500/50 px-1 py-0.2 rounded shadow-xs">
                    <ChevronsUpDown className="h-3 w-3 text-sky-400" />
                    <span className="text-[7.5px] font-black text-sky-200">LIFT</span>
                  </div>
                  <div className="flex items-center gap-0.5 bg-amber-950/90 border border-amber-500/50 px-1 py-0.2 rounded shadow-xs">
                    <Footprints className="h-3 w-3 text-amber-400" />
                    <span className="text-[7.5px] font-black text-amber-200">STAIRS</span>
                  </div>
                </div>

                <div className="self-center bg-slate-900/90 border border-slate-700/80 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-slate-200 shadow-xs">
                  {label || 'LIFT & STAIRS CORE'}
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })()}

      {/* 14. COMPLEX / BUILDING ENTRANCE (Mall, Hospital, Commercial Plaza) */}
      {elementType === 'BuildingEntrance' && (
        <g>
          {/* Base Portal Road / Pedestrian Threshold */}
          <rect
            width={width}
            height={height}
            rx={6}
            fill="#1e103540"
            stroke={isSelected ? '#c084fc' : '#9333ea'}
            strokeWidth={isSelected ? 2.5 : 2}
          />

          {/* Overhead Canopy / Glass Arch Header */}
          <rect
            x={2}
            y={2}
            width={width - 4}
            height={10}
            rx={3}
            fill="#581c87"
            stroke="#c084fc"
            strokeWidth={1}
          />

          {/* Welcoming Pedestrian Threshold Mat */}
          <rect
            x={10}
            y={height - 14}
            width={width - 20}
            height={12}
            rx={2}
            fill="#9333ea20"
            stroke="#a855f7"
            strokeWidth={1}
            strokeDasharray="3 2"
          />

          {/* Sliding Glass Doors */}
          <line
            x1={width / 2}
            y1={12}
            x2={width / 2}
            y2={height - 14}
            stroke="#e9d5ff"
            strokeWidth={2}
          />
          <line
            x1={width / 2 - 16}
            y1={14}
            x2={width / 2 - 16}
            y2={height - 16}
            stroke="#a855f780"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
          <line
            x1={width / 2 + 16}
            y1={14}
            x2={width / 2 + 16}
            y2={height - 16}
            stroke="#a855f780"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />

          <foreignObject x={0} y={0} width={width} height={height}>
            <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center pointer-events-none select-none">
              <div className="flex items-center gap-1.5 bg-purple-950/90 border border-purple-500/50 px-2 py-0.5 rounded shadow-xs">
                <Building2 className="h-3.5 w-3.5 text-purple-300" />
                <span className="text-[9px] font-black uppercase tracking-wider text-purple-200">
                  {label || 'COMPLEX ENTRANCE'}
                </span>
              </div>
              <span className="text-[8px] font-mono font-semibold text-purple-300/80 mt-0.5">
                {element.buildingType ? `${element.buildingType} Portal` : 'Mall / Hospital / Plaza Link'}
              </span>
            </div>
          </foreignObject>
        </g>
      )}

      {/* Quick Action Floating Overlay on Selection (Edit Mode Only - Suppressed during Measure Mode) */}
      {isEdit && isSelected && activeTool !== 'measure' && (
        <g className="cursor-default">
          {/* Bounding Selection Outline (pointer-events: none so click and drag passes through to element) */}
          <rect
            x={-3}
            y={-3}
            width={width + 6}
            height={height + 6}
            rx={6}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            pointerEvents="none"
          />

          {/* Rotate Button (Top Right) */}
          {onRotate && (
            <g
              transform={`translate(${width + 10}, ${-12})`}
              className="cursor-pointer group/rotate"
              pointerEvents="all"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                const step = e.altKey ? 15 : e.shiftKey ? 45 : 90;
                onRotate(elementId, step, true);
              }}
            >
              <title>Click to rotate 90° (Shift+Click: 45°, Alt+Click: 15°)</title>
              <circle
                r={12}
                fill="#0f172a"
                stroke="#3b82f6"
                strokeWidth={1.8}
                pointerEvents="all"
                className="transition-transform group-hover/rotate:scale-110"
              />
              {/* Circular rotation arrow */}
              <path
                d="M -1 -5.5 A 5.5 5.5 0 1 1 -5.5 0 M -4 -4 L -1 -5.5 L -1.5 -2.5"
                fill="none"
                stroke="#60a5fa"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            </g>
          )}

          {/* Quick Rotation Angle Badge Pill */}
          {onRotate && (
            <g
              transform={`translate(${width + 26}, ${-12})`}
              pointerEvents="all"
              className="cursor-pointer group/angle-badge"
              onClick={(e) => {
                e.stopPropagation();
                // Cycle through standard angles: 0, 30, 45, 60, 90, 135, 180, 270
                const presets = [0, 30, 45, 60, 90, 135, 180, 270];
                const cur = Math.round(rotation || 0);
                const next = presets.find((p) => p > cur) ?? 0;
                onRotate(elementId, next, false);
              }}
            >
              <title>Current: {Math.round((rotation || 0) * 10) / 10}°. Click to cycle angles (0°, 30°, 45°, 60°, 90°, 135°, 180°, 270°)</title>
              <rect
                x={0}
                y={-8}
                width={30}
                height={16}
                rx={8}
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth={1}
                className="group-hover/angle-badge:stroke-cyan-300 group-hover/angle-badge:fill-slate-900"
              />
              <text
                x={15}
                y={3.5}
                fill="#38bdf8"
                fontSize={8}
                fontFamily="ui-monospace, monospace"
                fontWeight="bold"
                textAnchor="middle"
                className="select-none pointer-events-none"
              >
                {Math.round(rotation || 0)}°
              </text>
            </g>
          )}

          {/* Delete Button (Top Left) */}
          {onRemove && (
            <g
              transform={`translate(${-10}, ${-12})`}
              className="cursor-pointer group/delete"
              pointerEvents="all"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(elementId);
              }}
            >
              <title>Delete from Canvas</title>
              <circle
                r={12}
                fill="#0f172a"
                stroke="#ef4444"
                strokeWidth={1.8}
                pointerEvents="all"
                className="transition-transform group-hover/delete:scale-110"
              />
              {/* X icon */}
              <path
                d="M -4 -4 L 4 4 M 4 -4 L -4 4"
                fill="none"
                stroke="#f87171"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            </g>
          )}

          {/* Stretch & Resize Handles on ALL SIDES & CORNERS */}
          {onResizeStart && (
            <g pointerEvents="all">
              {/* 1. East Stretch Handle (Right Edge Pill - Horizontal stretch East) */}
              <g
                transform={`translate(${width + 2}, ${height / 2})`}
                className={cn(getRotatedCursor('e', rotation), 'group/stretch-e')}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, elementId, 'e');
                }}
              >
                <title>Stretch Right Edge horizontally (↔)</title>
                <rect
                  x={-4}
                  y={-14}
                  width={8}
                  height={28}
                  rx={4}
                  fill="#0f172a"
                  stroke="#3b82f6"
                  strokeWidth={1.8}
                  className="transition-transform group-hover/stretch-e:scale-125 drop-shadow"
                />
                <line x1={-1.5} y1={-7} x2={-1.5} y2={7} stroke="#93c5fd" strokeWidth={1.2} />
                <line x1={1.5} y1={-7} x2={1.5} y2={7} stroke="#93c5fd" strokeWidth={1.2} />
              </g>

              {/* 2. West Stretch Handle (Left Edge Pill - Horizontal stretch West) */}
              <g
                transform={`translate(${-2}, ${height / 2})`}
                className={cn(getRotatedCursor('w', rotation), 'group/stretch-w')}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, elementId, 'w');
                }}
              >
                <title>Stretch Left Edge horizontally (↔)</title>
                <rect
                  x={-4}
                  y={-14}
                  width={8}
                  height={28}
                  rx={4}
                  fill="#0f172a"
                  stroke="#3b82f6"
                  strokeWidth={1.8}
                  className="transition-transform group-hover/stretch-w:scale-125 drop-shadow"
                />
                <line x1={-1.5} y1={-7} x2={-1.5} y2={7} stroke="#93c5fd" strokeWidth={1.2} />
                <line x1={1.5} y1={-7} x2={1.5} y2={7} stroke="#93c5fd" strokeWidth={1.2} />
              </g>

              {/* 3. South Stretch Handle (Bottom Edge Pill - Vertical stretch South) */}
              <g
                transform={`translate(${width / 2}, ${height + 2})`}
                className={cn(getRotatedCursor('s', rotation), 'group/stretch-s')}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, elementId, 's');
                }}
              >
                <title>Stretch Bottom Edge vertically (↕)</title>
                <rect
                  x={-14}
                  y={-4}
                  width={28}
                  height={8}
                  rx={4}
                  fill="#0f172a"
                  stroke="#3b82f6"
                  strokeWidth={1.8}
                  className="transition-transform group-hover/stretch-s:scale-125 drop-shadow"
                />
                <line x1={-7} y1={-1.5} x2={7} y2={-1.5} stroke="#93c5fd" strokeWidth={1.2} />
                <line x1={-7} y1={1.5} x2={7} y2={1.5} stroke="#93c5fd" strokeWidth={1.2} />
              </g>

              {/* 4. North Stretch Handle (Top Edge Pill - Vertical stretch North) */}
              <g
                transform={`translate(${width / 2}, ${-2})`}
                className={cn(getRotatedCursor('n', rotation), 'group/stretch-n')}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeStart(e, elementId, 'n');
                }}
              >
                <title>Stretch Top Edge vertically (↕)</title>
                <rect
                  x={-14}
                  y={-4}
                  width={28}
                  height={8}
                  rx={4}
                  fill="#0f172a"
                  stroke="#3b82f6"
                  strokeWidth={1.8}
                  className="transition-transform group-hover/stretch-n:scale-125 drop-shadow"
                />
                <line x1={-7} y1={-1.5} x2={7} y2={-1.5} stroke="#93c5fd" strokeWidth={1.2} />
                <line x1={-7} y1={1.5} x2={7} y2={1.5} stroke="#93c5fd" strokeWidth={1.2} />
              </g>
            </g>
          )}
        </g>
      )}
    </g>
  );
};
