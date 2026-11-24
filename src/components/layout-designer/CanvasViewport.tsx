import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { LayoutElementData, LayoutCanvasConfig } from '@/api/parkingLot.api';
import type {
  DesignerMode,
  ToolType,
  DraggingElementState,
  FrameResizeState,
  ElementResizeState,
  ResizeHandlePosition,
  LaneConnectionType,
} from './types';
import { clampElementInsideBounds } from './types';
import { CanvasElement } from './CanvasElement';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Expand, Scaling } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveDragElement, setActiveDragElement } from './dragState';
import { cn } from '@/lib/utils';

export interface ZoneTheme {
  color: string;
  fill: string;
  border: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
}

export const PRESET_ZONE_THEMES: Record<string, ZoneTheme> = {
  A: {
    color: '#3b82f6', // Vivid Blue
    fill: 'rgba(59, 130, 246, 0.16)',
    border: '#60a5fa',
    glow: 'rgba(59, 130, 246, 0.55)',
    badgeBg: 'bg-blue-500/25',
    badgeText: 'text-blue-300 font-bold',
  },
  B: {
    color: '#10b981', // Emerald Green
    fill: 'rgba(16, 185, 129, 0.16)',
    border: '#34d399',
    glow: 'rgba(16, 185, 129, 0.55)',
    badgeBg: 'bg-emerald-500/25',
    badgeText: 'text-emerald-300 font-bold',
  },
  C: {
    color: '#f59e0b', // Golden Amber
    fill: 'rgba(245, 158, 11, 0.16)',
    border: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.55)',
    badgeBg: 'bg-amber-500/25',
    badgeText: 'text-amber-300 font-bold',
  },
  D: {
    color: '#a855f7', // Vivid Purple
    fill: 'rgba(168, 85, 247, 0.16)',
    border: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.55)',
    badgeBg: 'bg-purple-500/25',
    badgeText: 'text-purple-300 font-bold',
  },
  E: {
    color: '#f43f5e', // Rose Red
    fill: 'rgba(244, 63, 94, 0.16)',
    border: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.55)',
    badgeBg: 'bg-rose-500/25',
    badgeText: 'text-rose-300 font-bold',
  },
  F: {
    color: '#06b6d4', // Vibrant Cyan
    fill: 'rgba(6, 182, 212, 0.16)',
    border: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.55)',
    badgeBg: 'bg-cyan-500/25',
    badgeText: 'text-cyan-300 font-bold',
  },
  G: {
    color: '#84cc16', // Lime Green
    fill: 'rgba(132, 204, 22, 0.16)',
    border: '#a3e635',
    glow: 'rgba(132, 204, 22, 0.55)',
    badgeBg: 'bg-lime-500/25',
    badgeText: 'text-lime-300 font-bold',
  },
  H: {
    color: '#ea580c', // Fiery Orange
    fill: 'rgba(234, 88, 12, 0.16)',
    border: '#fb923c',
    glow: 'rgba(234, 88, 12, 0.55)',
    badgeBg: 'bg-orange-500/25',
    badgeText: 'text-orange-300 font-bold',
  },
  VIP: {
    color: '#ec4899', // Hot Pink
    fill: 'rgba(236, 72, 153, 0.18)',
    border: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.6)',
    badgeBg: 'bg-pink-500/25',
    badgeText: 'text-pink-300 font-bold',
  },
  EV: {
    color: '#14b8a6', // Electric Teal
    fill: 'rgba(20, 184, 166, 0.18)',
    border: '#2dd4bf',
    glow: 'rgba(20, 184, 166, 0.6)',
    badgeBg: 'bg-teal-500/25',
    badgeText: 'text-teal-300 font-bold',
  },
};

export function getZoneTheme(zoneCode?: string | null): ZoneTheme {
  const code = (zoneCode || 'A').toUpperCase().trim();
  if (PRESET_ZONE_THEMES[code]) {
    return PRESET_ZONE_THEMES[code];
  }
  const colors: ZoneTheme[] = [
    { color: '#6366f1', fill: 'rgba(99, 102, 241, 0.16)', border: '#818cf8', glow: 'rgba(99, 102, 241, 0.5)', badgeBg: 'bg-indigo-500/25', badgeText: 'text-indigo-300 font-bold' },
    { color: '#14b8a6', fill: 'rgba(20, 184, 166, 0.16)', border: '#2dd4bf', glow: 'rgba(20, 184, 166, 0.5)', badgeBg: 'bg-teal-500/25', badgeText: 'text-teal-300 font-bold' },
    { color: '#f97316', fill: 'rgba(249, 115, 22, 0.16)', border: '#fb923c', glow: 'rgba(249, 115, 22, 0.5)', badgeBg: 'bg-orange-500/25', badgeText: 'text-orange-300 font-bold' },
    { color: '#d946ef', fill: 'rgba(217, 70, 239, 0.16)', border: '#e879f9', glow: 'rgba(217, 70, 239, 0.5)', badgeBg: 'bg-fuchsia-500/25', badgeText: 'text-fuchsia-300 font-bold' },
    { color: '#e11d48', fill: 'rgba(225, 29, 72, 0.16)', border: '#fb7185', glow: 'rgba(225, 29, 72, 0.5)', badgeBg: 'bg-rose-500/25', badgeText: 'text-rose-300 font-bold' },
    { color: '#0284c7', fill: 'rgba(2, 132, 199, 0.16)', border: '#38bdf8', glow: 'rgba(2, 132, 199, 0.5)', badgeBg: 'bg-sky-500/25', badgeText: 'text-sky-300 font-bold' },
  ];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface CanvasViewportProps {
  canvasConfig: LayoutCanvasConfig;
  elements: LayoutElementData[];
  selectedElementId: string | null;
  mode: DesignerMode;
  activeTool: ToolType;
  showGrid: boolean;
  showRulers?: boolean;
  snapToGrid: boolean;
  zoom: number;
  panX: number;
  panY: number;
  onPanChange: (panX: number, panY: number) => void;
  onZoomChange: (zoom: number) => void;
  onSelectElement: (element: LayoutElementData | null) => void;
  onUpdateElementPosition: (elementId: string, x: number, y: number) => void;
  onUpdateElementDimensions?: (elementId: string, width: number, height: number) => void;
  onUpdateElementGeometry?: (elementId: string, x: number, y: number, width: number, height: number) => void;
  onUpdateElement?: (elementId: string, updatedFields: Partial<LayoutElementData>) => void;
  onUpdateCanvasConfig?: (config: Partial<LayoutCanvasConfig>) => void;
  onRotateElement: (elementId: string, customAngleOrDelta?: number, isDelta?: boolean) => void;
  onRemoveElement: (elementId: string) => void;
  onConnectLane?: (el: LayoutElementData, connectionType: LaneConnectionType) => void;
  onDropNewElement: (elementType: string, x: number, y: number, extraData?: any) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onFitToScreen?: () => void;
  onResetView?: () => void;
  zones?: Array<{ _id: string; zoneName: string; zoneCode: string }>;
  showZoneHighlights?: boolean;
  onToggleZoneHighlights?: () => void;
  selectedZoneFilter?: string | null;
  onSelectZoneFilter?: (zone: string | null) => void;
  highlightedElementId?: string | null;
  onToolChange?: (tool: ToolType) => void;
  enableSlotAssister?: boolean;
  canResizeCanvas?: boolean;
  onActionComplete?: () => void;
}

export interface DockPort {
  id: string;
  offsetX: number;
  offsetY: number;
  heading: 'north' | 'south' | 'east' | 'west';
  category:
    | 'lane-end'
    | 'curb'
    | 'gate'
    | 'ramp'
    | 'slot-bay'
    | 'slot-side'
    | 'wall-joint'
    | 'wall-face';
  label: string;
}

export interface SmartGuideVisual {
  alignLines?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  spacingPills?: Array<{ x: number; y: number; text: string }>;
}

export interface UniversalSnapResult {
  snappedX: number;
  snappedY: number;
  guideX: number;
  guideY: number;
  label: string;
  isSlotAssister?: boolean;
  smartGuide?: SmartGuideVisual;
}

export function getSlotNavPointers(slot: LayoutElementData): Array<{
  id: string;
  targetLaneId: string | null;
  curbX?: number | null;
  curbY?: number | null;
}> {
  if (slot.navPointers && slot.navPointers.length > 0) {
    return slot.navPointers;
  }
  return [
    {
      id: 'nav-1',
      targetLaneId: slot.connectedLaneIds?.[0] || null,
    },
  ];
}

/**
 * Rotates a local point (lx, ly) around the element center (width/2, height/2) by rotationDeg.
 * Matches SVG transform: translate(x, y) rotate(rotation, width/2, height/2)
 */
export function rotateLocalPoint(
  lx: number,
  ly: number,
  width: number,
  height: number,
  rotationDeg = 0,
): { rx: number; ry: number } {
  if (!rotationDeg) return { rx: lx, ry: ly };
  const rad = (rotationDeg * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = lx - cx;
  const dy = ly - cy;
  return {
    rx: cx + (dx * cos - dy * sin),
    ry: cy + (dx * sin + dy * cos),
  };
}

// Check whether an element is visually horizontal on canvas after accounting for rotation
export function isElementVisuallyHorizontal(el: { width: number; height: number; rotation?: number }): boolean {
  const rotRad = (((el.rotation || 0) % 360 + 360) % 360 * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rotRad));
  const sin = Math.abs(Math.sin(rotRad));
  const visualWidth = el.width * cos + el.height * sin;
  const visualHeight = el.width * sin + el.height * cos;
  return visualWidth >= visualHeight;
}

// Calculate the precise visual axis-aligned bounding box of any element in canvas coordinates
export function getVisualBoundingBox(el: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): {
  cx: number;
  cy: number;
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const rotRad = (((el.rotation || 0) % 360 + 360) % 360 * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rotRad));
  const sin = Math.abs(Math.sin(rotRad));
  const vW = Math.round((el.width * cos + el.height * sin) * 10) / 10;
  const vH = Math.round((el.width * sin + el.height * cos) * 10) / 10;
  return {
    cx,
    cy,
    width: vW,
    height: vH,
    left: cx - vW / 2,
    top: cy - vH / 2,
    right: cx + vW / 2,
    bottom: cy + vH / 2,
  };
}

// Compute all docking ports / connection sockets for any layout element
export function getElementDockPorts(el: LayoutElementData): DockPort[] {
  const isHorizontal = el.width >= el.height;
  const isSquareHub =
    el.label?.includes('Square') ||
    el.label?.includes('Connector') ||
    el.label?.includes('Hub');
  // Only square-ish elements are corner turns (elongated lanes are always straight lanes)
  const isTurn =
    (el.label?.includes('Turn') || el.label?.includes('Corner')) &&
    Math.abs(el.width - el.height) <= 40;
  const isTJunction = el.label?.includes('T-Junction');
  const ports: DockPort[] = [];

  switch (el.elementType) {
    case 'DrivingLane': {
      if (isSquareHub) {
        // Universal 4-Way Square Junction Hub: 4 universal road mouths (North, South, East, West)
        ports.push({ id: 'north', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'lane-end', label: 'North Hub Port' });
        ports.push({ id: 'south', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'lane-end', label: 'South Hub Port' });
        ports.push({ id: 'west', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'lane-end', label: 'West Hub Port' });
        ports.push({ id: 'east', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'lane-end', label: 'East Hub Port' });
      } else if (isTurn) {
        // 90° Turn Connector: 4 universal road mouths (strictly lane-end)
        ports.push({ id: 'west', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'lane-end', label: 'West Road Port' });
        ports.push({ id: 'east', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'lane-end', label: 'East Road Port' });
        ports.push({ id: 'north', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'lane-end', label: 'North Road Port' });
        ports.push({ id: 'south', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'lane-end', label: 'South Road Port' });
      } else if (isTJunction) {
        // T-Junction: West and East through-road, plus North & South merge stems
        ports.push({ id: 'west', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'lane-end', label: 'Through Road (West)' });
        ports.push({ id: 'east', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'lane-end', label: 'Through Road (East)' });
        ports.push({ id: 'south-stem', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'lane-end', label: 'Merge Stem (South)' });
        ports.push({ id: 'north-stem', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'lane-end', label: 'Merge Stem (North)' });
      } else if (isHorizontal) {
        // Straight Horizontal Lane:
        // Road ends are strictly 'lane-end' (NO half-length snaps)
        ports.push({ id: 'west', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'lane-end', label: 'West End' });
        ports.push({ id: 'east', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'lane-end', label: 'East End' });
        // Curbs for parking slots only (category: 'curb')
        ports.push({ id: 'north-curb', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'curb', label: 'North Curb' });
        ports.push({ id: 'south-curb', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'curb', label: 'South Curb' });
        // Multiple docking points along longer horizontal lanes for rows of slots
        const step = 60;
        for (let cx = step; cx <= el.width - step; cx += step) {
          if (Math.abs(cx - el.width / 2) > 15) {
            ports.push({ id: `north-curb-${cx}`, offsetX: cx, offsetY: 0, heading: 'north', category: 'curb', label: 'North Curb' });
            ports.push({ id: `south-curb-${cx}`, offsetX: cx, offsetY: el.height, heading: 'south', category: 'curb', label: 'South Curb' });
          }
        }
      } else {
        // Straight Vertical Lane:
        // Road ends are strictly 'lane-end' (NO half-length snaps)
        ports.push({ id: 'north', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'lane-end', label: 'North End' });
        ports.push({ id: 'south', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'lane-end', label: 'South End' });
        // Curbs for parking slots only (category: 'curb')
        ports.push({ id: 'west-curb', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'curb', label: 'West Curb' });
        ports.push({ id: 'east-curb', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'curb', label: 'East Curb' });
        // Multiple docking points along longer vertical lanes for rows of slots
        const step = 60;
        for (let cy = step; cy <= el.height - step; cy += step) {
          if (Math.abs(cy - el.height / 2) > 15) {
            ports.push({ id: `west-curb-${cy}`, offsetX: 0, offsetY: cy, heading: 'west', category: 'curb', label: 'West Curb' });
            ports.push({ id: `east-curb-${cy}`, offsetX: el.width, offsetY: cy, heading: 'east', category: 'curb', label: 'East Curb' });
          }
        }
      }
      break;
    }

    case 'Entrance': {
      // Vehicles enter into driving lane
      if (isHorizontal) {
        ports.push({ id: 'mouth', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'gate', label: 'Entry to Road' });
      } else {
        ports.push({ id: 'mouth', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'gate', label: 'Entry to Road' });
      }
      break;
    }

    case 'Exit': {
      // Vehicles exit from driving lane into gate
      if (isHorizontal) {
        ports.push({ id: 'mouth', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'gate', label: 'Exit from Road' });
      } else {
        ports.push({ id: 'mouth', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'gate', label: 'Exit from Road' });
      }
      break;
    }

    case 'Ramp':
    case 'RampPortal': {
      // Ramps transition traffic across floors
      if (isHorizontal) {
        ports.push({ id: 'portal-a', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'ramp', label: 'Ramp Port' });
        ports.push({ id: 'portal-b', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'ramp', label: 'Ramp Port' });
      } else {
        ports.push({ id: 'portal-a', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'ramp', label: 'Ramp Port' });
        ports.push({ id: 'portal-b', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'ramp', label: 'Ramp Port' });
      }
      break;
    }

    case 'ParkingSlot': {
      // Slots have open bay entry (slot-bay) that docks to road curbs, and side edges (slot-side) that dock side-by-side
      if (isHorizontal) {
        ports.push({ id: 'mouth-west', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'slot-bay', label: 'Slot Bay Entry' });
        ports.push({ id: 'mouth-east', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'slot-bay', label: 'Slot Bay Entry' });
        ports.push({ id: 'side-north', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'slot-side', label: 'Adjacent Slot' });
        ports.push({ id: 'side-south', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'slot-side', label: 'Adjacent Slot' });
      } else {
        ports.push({ id: 'mouth-south', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'slot-bay', label: 'Slot Bay Entry' });
        ports.push({ id: 'mouth-north', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'slot-bay', label: 'Slot Bay Entry' });
        ports.push({ id: 'side-west', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'slot-side', label: 'Adjacent Slot' });
        ports.push({ id: 'side-east', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'slot-side', label: 'Adjacent Slot' });
      }
      break;
    }

    case 'Wall': {
      // Walls only connect to other walls and pillars
      if (isHorizontal) {
        ports.push({ id: 'west-end', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'wall-joint', label: 'West Wall End' });
        ports.push({ id: 'east-end', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'wall-joint', label: 'East Wall End' });
        ports.push({ id: 'north-face', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'wall-face', label: 'North Wall Face' });
        ports.push({ id: 'south-face', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'wall-face', label: 'South Wall Face' });
        const step = 40;
        for (let cx = step; cx <= el.width - step; cx += step) {
          if (Math.abs(cx - el.width / 2) > 15) {
            ports.push({ id: `north-face-${cx}`, offsetX: cx, offsetY: 0, heading: 'north', category: 'wall-face', label: 'Wall Face Joint' });
            ports.push({ id: `south-face-${cx}`, offsetX: cx, offsetY: el.height, heading: 'south', category: 'wall-face', label: 'Wall Face Joint' });
          }
        }
      } else {
        ports.push({ id: 'north-end', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'wall-joint', label: 'North Wall End' });
        ports.push({ id: 'south-end', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'wall-joint', label: 'South Wall End' });
        ports.push({ id: 'west-face', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'wall-face', label: 'West Wall Face' });
        ports.push({ id: 'east-face', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'wall-face', label: 'East Wall Face' });
        const step = 40;
        for (let cy = step; cy <= el.height - step; cy += step) {
          if (Math.abs(cy - el.height / 2) > 15) {
            ports.push({ id: `west-face-${cy}`, offsetX: 0, offsetY: cy, heading: 'west', category: 'wall-face', label: 'Wall Face Joint' });
            ports.push({ id: `east-face-${cy}`, offsetX: el.width, offsetY: cy, heading: 'east', category: 'wall-face', label: 'Wall Face Joint' });
          }
        }
      }
      break;
    }

    case 'Pillar': {
      // Concrete Pillars dock walls and columns
      ports.push({ id: 'north-face', offsetX: el.width / 2, offsetY: 0, heading: 'north', category: 'wall-joint', label: 'North Pillar Face' });
      ports.push({ id: 'south-face', offsetX: el.width / 2, offsetY: el.height, heading: 'south', category: 'wall-joint', label: 'South Pillar Face' });
      ports.push({ id: 'west-face', offsetX: 0, offsetY: el.height / 2, heading: 'west', category: 'wall-joint', label: 'West Pillar Face' });
      ports.push({ id: 'east-face', offsetX: el.width, offsetY: el.height / 2, heading: 'east', category: 'wall-joint', label: 'East Pillar Face' });
      break;
    }
  }

  return ports;
}

export interface ConnectedElementInfo {
  element: LayoutElementData;
  connectionType: 'road' | 'gate' | 'ramp' | 'slot' | 'hub-junction' | 'wall-joint' | 'wall-merged' | 'pillar-joint';
  myPortLabel: string;
  otherPortLabel: string;
}

// Compute all directly connected / coupled elements for any selected element
export function findConnectedElements(
  target: LayoutElementData | null,
  allElements: LayoutElementData[],
): ConnectedElementInfo[] {
  if (!target) return [];
  const results: ConnectedElementInfo[] = [];
  const targetPorts = getElementDockPorts(target);

  const targetWorldPorts = targetPorts.map((p) => {
    const { rx, ry } = rotateLocalPoint(p.offsetX, p.offsetY, target.width, target.height, target.rotation || 0);
    return {
      port: p,
      x: target.x + rx,
      y: target.y + ry,
    };
  });

  const others = allElements.filter((el) => el.elementId !== target.elementId);

  for (const other of others) {
    // Strict Isolation: Walls and Pillars connect ONLY to Walls, Pillars, and cutting Gates
    if (target.elementType === 'Wall') {
      if (
        other.elementType !== 'Wall' &&
        other.elementType !== 'Pillar' &&
        other.elementType !== 'Entrance' &&
        other.elementType !== 'Exit'
      ) {
        continue;
      }
    } else if (target.elementType === 'Pillar') {
      if (other.elementType !== 'Wall' && other.elementType !== 'Pillar') {
        continue;
      }
    } else {
      // Target is non-wall (road, slot, ramp): ignore Wall and Pillar
      if (other.elementType === 'Wall' || other.elementType === 'Pillar') {
        if (target.elementType !== 'Entrance' && target.elementType !== 'Exit') {
          continue;
        }
      }
    }

    const otherPorts = getElementDockPorts(other);
    let isConnected = false;
    let connType: ConnectedElementInfo['connectionType'] = 'road';
    let myLabel = '';
    let otherLabel = '';

    // Check port-to-port proximity (<= 14px)
    for (const tp of targetWorldPorts) {
      if (isConnected) break;
      for (const op of otherPorts) {
        const { rx, ry } = rotateLocalPoint(op.offsetX, op.offsetY, other.width, other.height, other.rotation || 0);
        const oWorldX = other.x + rx;
        const oWorldY = other.y + ry;

        const dist = Math.hypot(tp.x - oWorldX, tp.y - oWorldY);
        if (dist <= 14) {
          const catA = tp.port.category;
          const catB = op.category;
          if (
            (catA === 'lane-end' && catB === 'lane-end') ||
            (catA === 'gate' && catB === 'lane-end') ||
            (catA === 'lane-end' && catB === 'gate') ||
            (catA === 'ramp' && catB === 'lane-end') ||
            (catA === 'lane-end' && catB === 'ramp') ||
            (catA === 'slot-side' && catB === 'slot-side') ||
            (catA === 'slot-bay' && catB === 'curb') ||
            (catA === 'curb' && catB === 'slot-bay') ||
            (catA === 'wall-joint' && catB === 'wall-joint') ||
            (catA === 'wall-joint' && catB === 'wall-face') ||
            (catA === 'wall-face' && catB === 'wall-joint')
          ) {
            isConnected = true;
            if (other.elementType === 'Pillar' || target.elementType === 'Pillar') {
              connType = 'pillar-joint';
            } else if (catA === 'wall-joint' || catA === 'wall-face' || catB === 'wall-joint' || catB === 'wall-face') {
              connType = catA === 'wall-joint' && catB === 'wall-joint' ? 'wall-merged' : 'wall-joint';
            } else if (catA === 'gate' || catB === 'gate') {
              connType = 'gate';
            } else if (catA === 'ramp' || catB === 'ramp') {
              connType = 'ramp';
            } else if (catA === 'slot-side' || catB === 'slot-side' || catA === 'slot-bay' || catB === 'slot-bay') {
              connType = 'slot';
            } else {
              connType = 'road';
            }
            myLabel = tp.port.label;
            otherLabel = op.label;
            break;
          }
        }
      }
    }

    // Check Wall-to-Wall or Wall-to-Pillar bounding box touch/overlap
    if (!isConnected && (target.elementType === 'Wall' || target.elementType === 'Pillar')) {
      if (other.elementType === 'Wall' || other.elementType === 'Pillar') {
        const overlapX = Math.max(0, Math.min(target.x + target.width, other.x + other.width) - Math.max(target.x, other.x));
        const overlapY = Math.max(0, Math.min(target.y + target.height, other.y + other.height) - Math.max(target.y, other.y));
        const touchDistX = Math.min(Math.abs(target.x + target.width - other.x), Math.abs(other.x + other.width - target.x));
        const touchDistY = Math.min(Math.abs(target.y + target.height - other.y), Math.abs(other.y + other.height - target.y));

        if ((overlapX > 0 && touchDistY <= 10) || (overlapY > 0 && touchDistX <= 10) || (overlapX > 0 && overlapY > 0)) {
          isConnected = true;
          if (target.elementType === 'Pillar' || other.elementType === 'Pillar') {
            connType = 'pillar-joint';
            myLabel = target.elementType === 'Wall' ? 'Wall End Joint' : 'Pillar Face';
            otherLabel = other.elementType === 'Wall' ? 'Wall End Joint' : 'Pillar Face';
          } else {
            connType = 'wall-merged';
            myLabel = 'Merged Wall Joint';
            otherLabel = 'Surrounding Wall';
          }
        }
      } else if (other.elementType === 'Entrance' || other.elementType === 'Exit') {
        // Gate cutting through wall
        const gateLeft = other.x;
        const gateTop = other.y;
        const gateRight = other.x + other.width;
        const gateBottom = other.y + other.height;
        const wallLeft = target.x;
        const wallTop = target.y;
        const wallRight = target.x + target.width;
        const wallBottom = target.y + target.height;

        const intersects = !(gateRight < wallLeft || gateLeft > wallRight || gateBottom < wallTop || gateTop > wallBottom);
        if (intersects) {
          isConnected = true;
          connType = 'gate';
          myLabel = 'Wall Opening (Cut)';
          otherLabel = `${other.elementType} Gate`;
        }
      }
    }

    // Check In-Lane Embedded Junction connection
    if (!isConnected && target.elementType === 'DrivingLane' && other.elementType === 'DrivingLane') {
      const isTargetHub =
        target.label?.includes('Square') ||
        target.label?.includes('Connector') ||
        target.label?.includes('Hub') ||
        Math.abs(target.width - target.height) <= 30;
      const isOtherHub =
        other.label?.includes('Square') ||
        other.label?.includes('Connector') ||
        other.label?.includes('Hub') ||
        Math.abs(other.width - other.height) <= 30;

      if ((isTargetHub && !isOtherHub) || (!isTargetHub && isOtherHub)) {
        const hubElem = isTargetHub ? target : other;
        const straightElem = isTargetHub ? other : target;
        const isHoriz = isElementVisuallyHorizontal(straightElem);
        const vStraight = getVisualBoundingBox(straightElem);
        const vHub = getVisualBoundingBox(hubElem);

        if (isHoriz) {
          if (
            Math.abs(vHub.cy - vStraight.cy) <= 10 &&
            vHub.right >= vStraight.left - 10 &&
            vHub.left <= vStraight.right + 10
          ) {
            isConnected = true;
            connType = 'hub-junction';
            myLabel = isTargetHub ? 'Embedded Road Hub' : 'Carrier Roadway';
            otherLabel = isTargetHub ? 'Carrier Roadway' : 'Embedded Road Hub';
          }
        } else {
          if (
            Math.abs(vHub.cx - vStraight.cx) <= 10 &&
            vHub.bottom >= vStraight.top - 10 &&
            vHub.top <= vStraight.bottom + 10
          ) {
            isConnected = true;
            connType = 'hub-junction';
            myLabel = isTargetHub ? 'Embedded Road Hub' : 'Carrier Roadway';
            otherLabel = isTargetHub ? 'Carrier Roadway' : 'Embedded Road Hub';
          }
        }
      }
    }

    // Check ParkingSlot to DrivingLane Navigation Linkage (strictly explicit via user's navigation pointer)
    if (
      !isConnected &&
      ((target.elementType === 'ParkingSlot' && other.elementType === 'DrivingLane') ||
        (target.elementType === 'DrivingLane' && other.elementType === 'ParkingSlot'))
    ) {
      const slot = target.elementType === 'ParkingSlot' ? target : other;
      const lane = target.elementType === 'DrivingLane' ? target : other;

      const isNavLinked =
        slot.connectedLaneIds?.includes(lane.elementId) ||
        slot.navPointers?.some((p) => p.targetLaneId === lane.elementId);

      if (isNavLinked) {
        isConnected = true;
        connType = 'slot';
        myLabel = target.elementType === 'ParkingSlot' ? 'Slot Nav Route' : 'Servicing Roadway';
        otherLabel = other.elementType === 'DrivingLane' ? (other.label || 'Roadway Route') : `Bay ${other.slotNumber || other.elementId}`;
      }
    }

    if (isConnected) {
      results.push({
        element: other,
        connectionType: connType,
        myPortLabel: myLabel,
        otherPortLabel: otherLabel,
      });
    }
  }

  return results;
}

// Universal Magnetic Snapping Engine (Train-Track & Facility Graph)
export function findUniversalSnap(
  targetElem: LayoutElementData,
  rawX: number,
  rawY: number,
  allElements: LayoutElementData[],
  snapRadius = 50,
  canvasConfig?: LayoutCanvasConfig,
  enableSlotAssister = true,
): UniversalSnapResult | null {
  const targetPorts = getElementDockPorts(targetElem);
  if (targetPorts.length === 0) return null;

  const otherElements = allElements.filter((el) => el.elementId !== targetElem.elementId);
  let bestSnap: UniversalSnapResult | null = null;
  let minDistance = snapRadius;

  // 1. Facility Perimeter Boundary Wall Snapping (when target is Wall)
  if (targetElem.elementType === 'Wall' && canvasConfig) {
    // North Perimeter Wall (y = 14)
    if (Math.abs(rawY - 14) < snapRadius && Math.abs(rawY - 14) < minDistance) {
      minDistance = Math.abs(rawY - 14);
      bestSnap = {
        snappedX: Math.round(rawX),
        snappedY: 14,
        guideX: Math.round(rawX + targetElem.width / 2),
        guideY: 14,
        label: '🧱 MERGED WITH NORTH PERIMETER WALL',
      };
    }
    // South Perimeter Wall (y = canvasConfig.height - 14 - targetElem.height)
    const southTargetY = canvasConfig.height - 14 - targetElem.height;
    if (Math.abs(rawY - southTargetY) < snapRadius && Math.abs(rawY - southTargetY) < minDistance) {
      minDistance = Math.abs(rawY - southTargetY);
      bestSnap = {
        snappedX: Math.round(rawX),
        snappedY: Math.round(southTargetY),
        guideX: Math.round(rawX + targetElem.width / 2),
        guideY: canvasConfig.height - 14,
        label: '🧱 MERGED WITH SOUTH PERIMETER WALL',
      };
    }
    // West Perimeter Wall (x = 14)
    if (Math.abs(rawX - 14) < snapRadius && Math.abs(rawX - 14) < minDistance) {
      minDistance = Math.abs(rawX - 14);
      bestSnap = {
        snappedX: 14,
        snappedY: Math.round(rawY),
        guideX: 14,
        guideY: Math.round(rawY + targetElem.height / 2),
        label: '🧱 MERGED WITH WEST PERIMETER WALL',
      };
    }
    // East Perimeter Wall (x = canvasConfig.width - 14 - targetElem.width)
    const eastTargetX = canvasConfig.width - 14 - targetElem.width;
    if (Math.abs(rawX - eastTargetX) < snapRadius && Math.abs(rawX - eastTargetX) < minDistance) {
      minDistance = Math.abs(rawX - eastTargetX);
      bestSnap = {
        snappedX: Math.round(eastTargetX),
        snappedY: Math.round(rawY),
        guideX: canvasConfig.width - 14,
        guideY: Math.round(rawY + targetElem.height / 2),
        label: '🧱 MERGED WITH EAST PERIMETER WALL',
      };
    }
  }

  for (const other of otherElements) {
    // Strict Isolation:
    // Walls and Pillars ONLY connect to Walls, Pillars, and cutting Gates
    if (targetElem.elementType === 'Wall' || targetElem.elementType === 'Pillar') {
      if (other.elementType !== 'Wall' && other.elementType !== 'Pillar') {
        continue;
      }
    } else if (other.elementType === 'Wall' || other.elementType === 'Pillar') {
      // Gates (Entrance / Exit) can snap along walls to cut openings
      if (
        (targetElem.elementType === 'Entrance' || targetElem.elementType === 'Exit') &&
        other.elementType === 'Wall'
      ) {
        // Allowed through for gate-cut-wall logic below
      } else {
        continue;
      }
    }

    const otherPorts = getElementDockPorts(other);
    if (otherPorts.length === 0) continue;

    for (const tPort of targetPorts) {
      for (const oPort of otherPorts) {
        // Compatibility Filter:
        // - 'lane-end' connects strictly to 'lane-end', 'gate', or 'ramp'
        // - 'curb' connects strictly to 'slot-bay' (roadside parking)
        // - 'slot-side' connects strictly to 'slot-side' (side-by-side slot row)
        // - 'wall-joint' / 'wall-face' connects strictly to other walls / pillars
        let isCompatible = false;
        let snapLabel = '⚓ TRACK COUPLED';

        if (tPort.category === 'lane-end' && oPort.category === 'lane-end') {
          isCompatible = true;
          if (
            targetElem.label?.includes('Square') ||
            targetElem.label?.includes('Connector') ||
            targetElem.label?.includes('Hub') ||
            other.label?.includes('Square') ||
            other.label?.includes('Connector') ||
            other.label?.includes('Hub')
          ) {
            snapLabel = '✛ 4-WAY HUB CONNECTED';
          } else if (tPort.id.includes('stem') || oPort.id.includes('stem')) {
            snapLabel = '✦ T-JUNCTION MERGED';
          } else if (
            targetElem.label?.includes('Turn') ||
            targetElem.label?.includes('Corner') ||
            other.label?.includes('Turn') ||
            other.label?.includes('Corner')
          ) {
            snapLabel = '↱ TURN LOCKED';
          } else {
            snapLabel = '═ ROAD COUPLED';
          }
        } else if (
          (tPort.category === 'gate' && oPort.category === 'lane-end') ||
          (tPort.category === 'lane-end' && oPort.category === 'gate')
        ) {
          isCompatible = true;
          snapLabel = '🚪 GATE CONNECTED';
        } else if (
          (tPort.category === 'ramp' && oPort.category === 'lane-end') ||
          (tPort.category === 'lane-end' && oPort.category === 'ramp')
        ) {
          isCompatible = true;
          snapLabel = '🚗 RAMP CONNECTED';
        } else if (tPort.category === 'slot-side' && oPort.category === 'slot-side') {
          isCompatible = true;
          snapLabel = '🅿 SLOT ROW LINKED';
        } else if (
          (tPort.category === 'slot-bay' && oPort.category === 'curb') ||
          (tPort.category === 'curb' && oPort.category === 'slot-bay')
        ) {
          isCompatible = true;
          snapLabel = '🅿 BAY DOCKED TO ROAD';
        } else if (
          (tPort.category === 'wall-joint' && oPort.category === 'wall-joint') ||
          (tPort.category === 'wall-joint' && oPort.category === 'wall-face') ||
          (tPort.category === 'wall-face' && oPort.category === 'wall-joint')
        ) {
          isCompatible = true;
          snapLabel =
            other.elementType === 'Pillar' || targetElem.elementType === 'Pillar'
              ? '🏛 DOCKED TO CONCRETE PILLAR'
              : tPort.category === 'wall-joint' && oPort.category === 'wall-joint'
              ? '🧱 WALLS MERGED (CONTINUOUS)'
              : '🧱 WALL T-JUNCTION MERGED';
        }

        if (!isCompatible) continue;

        // 1. Calculate world position of other element's port (accounting for other.rotation)
        const { rx: o_rx, ry: o_ry } = rotateLocalPoint(
          oPort.offsetX,
          oPort.offsetY,
          other.width,
          other.height,
          other.rotation || 0,
        );
        const oWorldX = other.x + o_rx;
        const oWorldY = other.y + o_ry;

        // 2. Calculate local rotated offset of target element's port (accounting for targetElem.rotation)
        const { rx: t_rx, ry: t_ry } = rotateLocalPoint(
          tPort.offsetX,
          tPort.offsetY,
          targetElem.width,
          targetElem.height,
          targetElem.rotation || 0,
        );

        // 3. Candidate top-left for target element so its rotated port lands exactly at oWorld
        const candX = oWorldX - t_rx;
        const candY = oWorldY - t_ry;

        const dist = Math.hypot(rawX - candX, rawY - candY);
        const isHubSnap =
          targetElem.label?.includes('Square') ||
          targetElem.label?.includes('Connector') ||
          targetElem.label?.includes('Hub') ||
          targetElem.label?.includes('Turn') ||
          targetElem.label?.includes('Corner') ||
          other.label?.includes('Square') ||
          other.label?.includes('Connector') ||
          other.label?.includes('Hub') ||
          other.label?.includes('Turn') ||
          other.label?.includes('Corner') ||
          Math.abs(targetElem.width - targetElem.height) <= 40 ||
          Math.abs(other.width - other.height) <= 40;
        const effectiveDist = isHubSnap ? dist * 0.75 : dist;

        if (effectiveDist < minDistance) {
          minDistance = effectiveDist;
          bestSnap = {
            snappedX: Math.round(candX),
            snappedY: Math.round(candY),
            guideX: Math.round(oWorldX),
            guideY: Math.round(oWorldY),
            label: snapLabel,
          };
        }
      }
    }

    // --- Dedicated Straight-to-Straight Lane Perpendicular Docking (T-Branch Snap) ---
    // Allows connecting a horizontal lane flush against a vertical lane (or vice versa)
    const isTargetStraightLane =
      targetElem.elementType === 'DrivingLane' &&
      !targetElem.label?.includes('Turn') &&
      !targetElem.label?.includes('Corner') &&
      !targetElem.label?.includes('T-Junction');

    const isOtherStraightLane =
      other.elementType === 'DrivingLane' &&
      !other.label?.includes('Turn') &&
      !other.label?.includes('Corner') &&
      !other.label?.includes('T-Junction');

    if (isTargetStraightLane && isOtherStraightLane) {
      const targetIsHoriz = isElementVisuallyHorizontal(targetElem);
      const otherIsHoriz = isElementVisuallyHorizontal(other);
      const vTarget = getVisualBoundingBox({ ...targetElem, x: rawX, y: rawY });
      const vOther = getVisualBoundingBox(other);

      if (targetIsHoriz && !otherIsHoriz) {
        // Target is Horizontal, Other is Vertical
        const W_t = vTarget.width;
        const H_t = vTarget.height;
        const oEastEdge = vOther.right;
        const oWestEdge = vOther.left;
        const oTop = vOther.top;
        const oBottom = vOther.bottom;

        const targetCenterY = vTarget.cy;
        const inVerticalSpan = targetCenterY >= oTop - 25 && targetCenterY <= oBottom + 25;

        if (inVerticalSpan) {
          let alignedCy = targetCenterY;
          if (Math.abs(vTarget.top - oTop) < 25) {
            alignedCy = oTop + H_t / 2;
          } else if (Math.abs(vTarget.bottom - oBottom) < 25) {
            alignedCy = oBottom - H_t / 2;
          } else if (Math.abs(targetCenterY - vOther.cy) < 25) {
            alignedCy = vOther.cy;
          }

          // 1. Target's West end docks flush against other's East edge
          const candCx_east = oEastEdge + W_t / 2;
          const dist_east = Math.abs(vTarget.left - oEastEdge);
          if (dist_east < minDistance) {
            minDistance = dist_east;
            bestSnap = {
              snappedX: Math.round((candCx_east - targetElem.width / 2) * 10) / 10,
              snappedY: Math.round((alignedCy - targetElem.height / 2) * 10) / 10,
              guideX: Math.round(oEastEdge),
              guideY: Math.round(alignedCy),
              label: '✦ LANE T-BRANCH',
            };
          }

          // 2. Target's East end docks flush against other's West edge
          const candCx_west = oWestEdge - W_t / 2;
          const dist_west = Math.abs(vTarget.right - oWestEdge);
          if (dist_west < minDistance) {
            minDistance = dist_west;
            bestSnap = {
              snappedX: Math.round((candCx_west - targetElem.width / 2) * 10) / 10,
              snappedY: Math.round((alignedCy - targetElem.height / 2) * 10) / 10,
              guideX: Math.round(oWestEdge),
              guideY: Math.round(alignedCy),
              label: '✦ LANE T-BRANCH',
            };
          }
        }
      } else if (!targetIsHoriz && otherIsHoriz) {
        // Target is Vertical, Other is Horizontal
        const W_t = vTarget.width;
        const H_t = vTarget.height;
        const oBottomEdge = vOther.bottom;
        const oTopEdge = vOther.top;
        const oLeft = vOther.left;
        const oRight = vOther.right;

        const targetCenterX = vTarget.cx;
        const inHorizontalSpan = targetCenterX >= oLeft - 25 && targetCenterX <= oRight + 25;

        if (inHorizontalSpan) {
          let alignedCx = targetCenterX;
          if (Math.abs(vTarget.left - oLeft) < 25) {
            alignedCx = oLeft + W_t / 2;
          } else if (Math.abs(vTarget.right - oRight) < 25) {
            alignedCx = oRight - W_t / 2;
          } else if (Math.abs(targetCenterX - vOther.cx) < 25) {
            alignedCx = vOther.cx;
          }

          // 1. Target's North end docks flush against other's Bottom edge
          const candCy_bottom = oBottomEdge + H_t / 2;
          const dist_bottom = Math.abs(vTarget.top - oBottomEdge);
          if (dist_bottom < minDistance) {
            minDistance = dist_bottom;
            bestSnap = {
              snappedX: Math.round((alignedCx - targetElem.width / 2) * 10) / 10,
              snappedY: Math.round((candCy_bottom - targetElem.height / 2) * 10) / 10,
              guideX: Math.round(alignedCx),
              guideY: Math.round(oBottomEdge),
              label: '✦ LANE T-BRANCH',
            };
          }

          // 2. Target's South end docks flush against other's Top edge
          const candCy_top = oTopEdge - H_t / 2;
          const dist_top = Math.abs(vTarget.bottom - oTopEdge);
          if (dist_top < minDistance) {
            minDistance = dist_top;
            bestSnap = {
              snappedX: Math.round((alignedCx - targetElem.width / 2) * 10) / 10,
              snappedY: Math.round((candCy_top - targetElem.height / 2) * 10) / 10,
              guideX: Math.round(alignedCx),
              guideY: Math.round(oTopEdge),
              label: '✦ LANE T-BRANCH',
            };
          }
        }
      }
    }

    // --- Dedicated In-Lane Snapping for Square Connector (Placed anywhere along a lane) ---
    const isTargetSquareHub =
      targetElem.elementType === 'DrivingLane' &&
      (targetElem.label?.includes('Square') ||
        targetElem.label?.includes('Connector') ||
        targetElem.label?.includes('Hub') ||
        targetElem.label?.includes('Turn') ||
        targetElem.label?.includes('Corner') ||
        targetElem.label?.includes('T-Junction') ||
        Math.abs(targetElem.width - targetElem.height) <= 40);

    const isOtherSquareHub =
      other.elementType === 'DrivingLane' &&
      (other.label?.includes('Square') ||
        other.label?.includes('Connector') ||
        other.label?.includes('Hub') ||
        other.label?.includes('Turn') ||
        other.label?.includes('Corner') ||
        other.label?.includes('T-Junction') ||
        Math.abs(other.width - other.height) <= 40);

    if (isTargetSquareHub && other.elementType === 'DrivingLane' && !isOtherSquareHub) {
      const otherIsHoriz = isElementVisuallyHorizontal(other);
      const vOther = getVisualBoundingBox(other);
      if (otherIsHoriz) {
        // Horizontal lane: Center the square connector vertically onto the lane
        const candY = vOther.cy - targetElem.height / 2;
        const distY = Math.abs(rawY - candY);
        // Generous horizontal overlap checking allowing connector anywhere along or near the lane
        const xOverlap =
          rawX + targetElem.width >= vOther.left - 40 &&
          rawX <= vOther.right + 40;
        const verticalThreshold = Math.max(70, vOther.height / 2 + 40);

        if (distY < verticalThreshold && xOverlap) {
          if (distY < minDistance || distY < 60) {
            minDistance = distY;
            // Snap X along the lane with magnetic adherence to ends, midpoint, and 20px grid
            let snapX = Math.max(vOther.left, Math.min(vOther.right - targetElem.width, rawX));
            if (Math.abs(rawX - vOther.left) < 25) {
              snapX = vOther.left;
            } else if (Math.abs(rawX - (vOther.right - targetElem.width)) < 25) {
              snapX = vOther.right - targetElem.width;
            } else {
              const midX = vOther.cx - targetElem.width / 2;
              if (Math.abs(rawX - midX) < 25) {
                snapX = midX;
              } else {
                const localOffset = rawX - vOther.left;
                const snappedOffset = Math.round(localOffset / 20) * 20;
                snapX = Math.max(vOther.left, Math.min(vOther.right - targetElem.width, vOther.left + snappedOffset));
              }
            }

            bestSnap = {
              snappedX: Math.round(snapX * 10) / 10,
              snappedY: Math.round(candY * 10) / 10,
              guideX: Math.round(snapX + targetElem.width / 2),
              guideY: Math.round(candY + targetElem.height / 2),
              label: '✛ IN-LANE JUNCTION HUB',
            };
          }
        }
      } else {
        // Vertical lane: Center the square connector horizontally onto the lane
        const candX = vOther.cx - targetElem.width / 2;
        const distX = Math.abs(rawX - candX);
        const yOverlap =
          rawY + targetElem.height >= vOther.top - 40 &&
          rawY <= vOther.bottom + 40;
        const horizontalThreshold = Math.max(70, vOther.width / 2 + 40);

        if (distX < horizontalThreshold && yOverlap) {
          if (distX < minDistance || distX < 60) {
            minDistance = distX;
            let snapY = Math.max(vOther.top, Math.min(vOther.bottom - targetElem.height, rawY));
            if (Math.abs(rawY - vOther.top) < 25) {
              snapY = vOther.top;
            } else if (Math.abs(rawY - (vOther.bottom - targetElem.height)) < 25) {
              snapY = vOther.bottom - targetElem.height;
            } else {
              const midY = vOther.cy - targetElem.height / 2;
              if (Math.abs(rawY - midY) < 25) {
                snapY = midY;
              } else {
                const localOffset = rawY - vOther.top;
                const snappedOffset = Math.round(localOffset / 20) * 20;
                snapY = Math.max(vOther.top, Math.min(vOther.bottom - targetElem.height, vOther.top + snappedOffset));
              }
            }

            bestSnap = {
              snappedX: Math.round(candX * 10) / 10,
              snappedY: Math.round(snapY * 10) / 10,
              guideX: Math.round(candX + targetElem.width / 2),
              guideY: Math.round(snapY + targetElem.height / 2),
              label: '✛ IN-LANE JUNCTION HUB',
            };
          }
        }
      }
    }

    // --- Dedicated Gate Cutout Wall Snapping ---
    if (
      (targetElem.elementType === 'Entrance' || targetElem.elementType === 'Exit') &&
      other.elementType === 'Wall'
    ) {
      const otherIsHoriz = isElementVisuallyHorizontal(other);
      const vOther = getVisualBoundingBox(other);
      if (otherIsHoriz) {
        // Horizontal Wall: Center the gate vertically on the wall to cut through it
        const candY = vOther.cy - targetElem.height / 2;
        const distY = Math.abs(rawY - candY);
        const xOverlap =
          rawX + targetElem.width >= vOther.left - 20 &&
          rawX <= vOther.right + 20;

        if (distY < 45 && xOverlap) {
          if (distY < minDistance) {
            minDistance = distY;
            const clampedX = Math.max(vOther.left, Math.min(vOther.right - targetElem.width, rawX));
            bestSnap = {
              snappedX: Math.round(clampedX * 10) / 10,
              snappedY: Math.round(candY * 10) / 10,
              guideX: Math.round(clampedX + targetElem.width / 2),
              guideY: Math.round(vOther.cy),
              label: '🚪 CUTTING WALL OPENING',
            };
          }
        }
      } else {
        // Vertical Wall: Center the gate horizontally on the wall to cut through it
        const candX = vOther.cx - targetElem.width / 2;
        const distX = Math.abs(rawX - candX);
        const yOverlap =
          rawY + targetElem.height >= vOther.top - 20 &&
          rawY <= vOther.bottom + 20;

        if (distX < 45 && yOverlap) {
          if (distX < minDistance) {
            minDistance = distX;
            const clampedY = Math.max(vOther.top, Math.min(vOther.bottom - targetElem.height, rawY));
            bestSnap = {
              snappedX: Math.round(candX * 10) / 10,
              snappedY: Math.round(clampedY * 10) / 10,
              guideX: Math.round(vOther.cx),
              guideY: Math.round(clampedY + targetElem.height / 2),
              label: '🚪 CUTTING WALL OPENING',
            };
          }
        }
      }
    }

    // --- Universal Continuous ParkingSlot to DrivingLane Curb Docking (ANY Point along ALL 4 Curbs) ---
    if (
      (targetElem.elementType === 'ParkingSlot' && other.elementType === 'DrivingLane') ||
      (targetElem.elementType === 'DrivingLane' && other.elementType === 'ParkingSlot')
    ) {
      const slotElem = targetElem.elementType === 'ParkingSlot' ? targetElem : other;
      const laneElem = targetElem.elementType === 'DrivingLane' ? targetElem : other;
      const isTargetSlot = targetElem.elementType === 'ParkingSlot';

      if (isTargetSlot) {
        // User is positioning a Parking Slot relative to an existing Driving Lane
        const vLane = getVisualBoundingBox(laneElem);
        const vSlot = getVisualBoundingBox({ ...slotElem, x: rawX, y: rawY });
        const slotW = vSlot.width;
        const slotH = vSlot.height;

        // 1. NORTH CURB of the lane (slot sits above lane, slot bottom touches lane top)
        const northTargetCy = vLane.top - slotH / 2;
        const distNorth = Math.abs(vSlot.bottom - vLane.top);
        const inNorthSpan = vSlot.right >= vLane.left - 24 && vSlot.left <= vLane.right + 24;

        if (inNorthSpan && distNorth < 50 && distNorth < minDistance) {
          minDistance = distNorth;
          let snapCx = vSlot.cx;

          // Magnetically align side-by-side to adjacent slot on this North curb if within 16px
          for (const s of allElements) {
            if (s.elementType === 'ParkingSlot' && s.elementId !== slotElem.elementId) {
              const vS = getVisualBoundingBox(s);
              if (Math.abs(vS.bottom - vLane.top) < 12) {
                if (Math.abs(vSlot.left - vS.right) <= 16) {
                  snapCx = vS.right + slotW / 2;
                  break;
                } else if (Math.abs(vSlot.right - vS.left) <= 16) {
                  snapCx = vS.left - slotW / 2;
                  break;
                }
              }
            }
          }

          if (vLane.width > slotW) {
            snapCx = Math.max(vLane.left + slotW / 2, Math.min(vLane.right - slotW / 2, snapCx));
          } else {
            snapCx = vLane.cx;
          }

          const snappedX = snapCx - slotElem.width / 2;
          const snappedY = northTargetCy - slotElem.height / 2;

          bestSnap = {
            snappedX: Math.round(snappedX * 10) / 10,
            snappedY: Math.round(snappedY * 10) / 10,
            guideX: Math.round(snapCx),
            guideY: Math.round(vLane.top),
            label: '🅿 ATTACHED TO NORTH ROAD CURB',
          };
        }

        // 2. SOUTH CURB of the lane (slot sits below lane, slot top touches lane bottom)
        const southTargetCy = vLane.bottom + slotH / 2;
        const distSouth = Math.abs(vSlot.top - vLane.bottom);
        const inSouthSpan = vSlot.right >= vLane.left - 24 && vSlot.left <= vLane.right + 24;

        if (inSouthSpan && distSouth < 50 && distSouth < minDistance) {
          minDistance = distSouth;
          let snapCx = vSlot.cx;

          // Magnetically align side-by-side to adjacent slot on South curb if within 16px
          for (const s of allElements) {
            if (s.elementType === 'ParkingSlot' && s.elementId !== slotElem.elementId) {
              const vS = getVisualBoundingBox(s);
              if (Math.abs(vS.top - vLane.bottom) < 12) {
                if (Math.abs(vSlot.left - vS.right) <= 16) {
                  snapCx = vS.right + slotW / 2;
                  break;
                } else if (Math.abs(vSlot.right - vS.left) <= 16) {
                  snapCx = vS.left - slotW / 2;
                  break;
                }
              }
            }
          }

          if (vLane.width > slotW) {
            snapCx = Math.max(vLane.left + slotW / 2, Math.min(vLane.right - slotW / 2, snapCx));
          } else {
            snapCx = vLane.cx;
          }

          const snappedX = snapCx - slotElem.width / 2;
          const snappedY = southTargetCy - slotElem.height / 2;

          bestSnap = {
            snappedX: Math.round(snappedX * 10) / 10,
            snappedY: Math.round(snappedY * 10) / 10,
            guideX: Math.round(snapCx),
            guideY: Math.round(vLane.bottom),
            label: '🅿 ATTACHED TO SOUTH ROAD CURB',
          };
        }

        // 3. WEST CURB of the lane (slot sits to the left of lane, slot right touches lane left)
        const westTargetCx = vLane.left - slotW / 2;
        const distWest = Math.abs(vSlot.right - vLane.left);
        const inWestSpan = vSlot.bottom >= vLane.top - 24 && vSlot.top <= vLane.bottom + 24;

        if (inWestSpan && distWest < 50 && distWest < minDistance) {
          minDistance = distWest;
          let snapCy = vSlot.cy;

          // Magnetically align top-to-bottom to adjacent slot on West curb if within 16px
          for (const s of allElements) {
            if (s.elementType === 'ParkingSlot' && s.elementId !== slotElem.elementId) {
              const vS = getVisualBoundingBox(s);
              if (Math.abs(vS.right - vLane.left) < 12) {
                if (Math.abs(vSlot.top - vS.bottom) <= 16) {
                  snapCy = vS.bottom + slotH / 2;
                  break;
                } else if (Math.abs(vSlot.bottom - vS.top) <= 16) {
                  snapCy = vS.top - slotH / 2;
                  break;
                }
              }
            }
          }

          if (vLane.height > slotH) {
            snapCy = Math.max(vLane.top + slotH / 2, Math.min(vLane.bottom - slotH / 2, snapCy));
          } else {
            snapCy = vLane.cy;
          }

          const snappedX = westTargetCx - slotElem.width / 2;
          const snappedY = snapCy - slotElem.height / 2;

          bestSnap = {
            snappedX: Math.round(snappedX * 10) / 10,
            snappedY: Math.round(snappedY * 10) / 10,
            guideX: Math.round(vLane.left),
            guideY: Math.round(snapCy),
            label: '🅿 ATTACHED TO WEST ROAD CURB',
          };
        }

        // 4. EAST CURB of the lane (slot sits to the right of lane, slot left touches lane right)
        const eastTargetCx = vLane.right + slotW / 2;
        const distEast = Math.abs(vSlot.left - vLane.right);
        const inEastSpan = vSlot.bottom >= vLane.top - 24 && vSlot.top <= vLane.bottom + 24;

        if (inEastSpan && distEast < 50 && distEast < minDistance) {
          minDistance = distEast;
          let snapCy = vSlot.cy;

          // Magnetically align top-to-bottom to adjacent slot on East curb if within 16px
          for (const s of allElements) {
            if (s.elementType === 'ParkingSlot' && s.elementId !== slotElem.elementId) {
              const vS = getVisualBoundingBox(s);
              if (Math.abs(vS.left - vLane.right) < 12) {
                if (Math.abs(vSlot.top - vS.bottom) <= 16) {
                  snapCy = vS.bottom + slotH / 2;
                  break;
                } else if (Math.abs(vSlot.bottom - vS.top) <= 16) {
                  snapCy = vS.top - slotH / 2;
                  break;
                }
              }
            }
          }

          if (vLane.height > slotH) {
            snapCy = Math.max(vLane.top + slotH / 2, Math.min(vLane.bottom - slotH / 2, snapCy));
          } else {
            snapCy = vLane.cy;
          }

          const snappedX = eastTargetCx - slotElem.width / 2;
          const snappedY = snapCy - slotElem.height / 2;

          bestSnap = {
            snappedX: Math.round(snappedX * 10) / 10,
            snappedY: Math.round(snappedY * 10) / 10,
            guideX: Math.round(vLane.right),
            guideY: Math.round(snapCy),
            label: '🅿 ATTACHED TO EAST ROAD CURB',
          };
        }
      } else {
        // User is dragging a Driving Lane near an existing Parking Slot
        const vSlot = getVisualBoundingBox(slotElem);
        const vLane = getVisualBoundingBox({ ...laneElem, x: rawX, y: rawY });
        const laneW = vLane.width;
        const laneH = vLane.height;

        // North curb of dragging lane touches slot bottom
        const candNorthCy = vSlot.bottom + laneH / 2;
        const distNorth = Math.abs(vLane.top - vSlot.bottom);
        // South curb of dragging lane touches slot top
        const candSouthCy = vSlot.top - laneH / 2;
        const distSouth = Math.abs(vLane.bottom - vSlot.top);
        // West curb of dragging lane touches slot right
        const candWestCx = vSlot.right + laneW / 2;
        const distWest = Math.abs(vLane.left - vSlot.right);
        // East curb of dragging lane touches slot left
        const candEastCx = vSlot.left - laneW / 2;
        const distEast = Math.abs(vLane.right - vSlot.left);

        if (distNorth < 45 && distNorth < minDistance) {
          minDistance = distNorth;
          const snappedY = candNorthCy - laneElem.height / 2;
          bestSnap = {
            snappedX: Math.round(rawX * 10) / 10,
            snappedY: Math.round(snappedY * 10) / 10,
            guideX: Math.round(vSlot.cx),
            guideY: Math.round(vSlot.bottom),
            label: '═ ROAD CURB DOCKED TO BAY',
          };
        } else if (distSouth < 45 && distSouth < minDistance) {
          minDistance = distSouth;
          const snappedY = candSouthCy - laneElem.height / 2;
          bestSnap = {
            snappedX: Math.round(rawX * 10) / 10,
            snappedY: Math.round(snappedY * 10) / 10,
            guideX: Math.round(vSlot.cx),
            guideY: Math.round(vSlot.top),
            label: '═ ROAD CURB DOCKED TO BAY',
          };
        } else if (distWest < 45 && distWest < minDistance) {
          minDistance = distWest;
          const snappedX = candWestCx - laneElem.width / 2;
          bestSnap = {
            snappedX: Math.round(snappedX * 10) / 10,
            snappedY: Math.round(rawY * 10) / 10,
            guideX: Math.round(vSlot.right),
            guideY: Math.round(vSlot.cy),
            label: '═ ROAD CURB DOCKED TO BAY',
          };
        } else if (distEast < 45 && distEast < minDistance) {
          minDistance = distEast;
          const snappedX = candEastCx - laneElem.width / 2;
          bestSnap = {
            snappedX: Math.round(snappedX * 10) / 10,
            snappedY: Math.round(rawY * 10) / 10,
            guideX: Math.round(vSlot.left),
            guideY: Math.round(vSlot.cy),
            label: '═ ROAD CURB DOCKED TO BAY',
          };
        }
      }
    }

    // =========================================================================
    // SMART SLOT ASSISTER: Same-Line Alignment & Equal Spacing Between Slots
    // =========================================================================
    if (enableSlotAssister && targetElem.elementType === 'ParkingSlot') {
      const vTarget = getVisualBoundingBox({ ...targetElem, x: rawX, y: rawY });
      const otherSlots = allElements.filter(
        (el) => el.elementType === 'ParkingSlot' && el.elementId !== targetElem.elementId,
      );

      if (otherSlots.length > 0) {
        const otherVBoxes = otherSlots.map((s) => ({
          slot: s,
          vBox: getVisualBoundingBox(s),
        }));

        // 1. SAME-LINE ALIGNMENT ASSISTER (Top, Center, Bottom, Left, Center, Right)
        let bestAlignX: {
          candCx: number;
          dist: number;
          alignLine: { x1: number; y1: number; x2: number; y2: number };
          label: string;
        } | null = null;

        let bestAlignY: {
          candCy: number;
          dist: number;
          alignLine: { x1: number; y1: number; x2: number; y2: number };
          label: string;
        } | null = null;

        const ALIGN_THRESHOLD = 14;

        for (const { vBox } of otherVBoxes) {
          // Horizontal Alignment (matching Y coordinates: Top, Center, Bottom)
          const horizDist = Math.abs(vTarget.cx - vBox.cx);
          if (horizDist < 800) {
            // A. Top-edge align
            const topDist = Math.abs(vTarget.top - vBox.top);
            if (topDist <= ALIGN_THRESHOLD && (!bestAlignY || topDist < bestAlignY.dist)) {
              const candCy = vBox.top + vTarget.height / 2;
              const minX = Math.min(vTarget.left, vBox.left) - 30;
              const maxX = Math.max(vTarget.right, vBox.right) + 30;
              bestAlignY = {
                candCy,
                dist: topDist,
                alignLine: { x1: minX, y1: vBox.top, x2: maxX, y2: vBox.top },
                label: '☲ SAME LINE: TOP ALIGNED',
              };
            }

            // B. Center align Y
            const cyDist = Math.abs(vTarget.cy - vBox.cy);
            if (cyDist <= ALIGN_THRESHOLD && (!bestAlignY || cyDist < bestAlignY.dist)) {
              const candCy = vBox.cy;
              const minX = Math.min(vTarget.left, vBox.left) - 30;
              const maxX = Math.max(vTarget.right, vBox.right) + 30;
              bestAlignY = {
                candCy,
                dist: cyDist,
                alignLine: { x1: minX, y1: vBox.cy, x2: maxX, y2: vBox.cy },
                label: '☲ SAME LINE: CENTER ALIGNED',
              };
            }

            // C. Bottom-edge align
            const botDist = Math.abs(vTarget.bottom - vBox.bottom);
            if (botDist <= ALIGN_THRESHOLD && (!bestAlignY || botDist < bestAlignY.dist)) {
              const candCy = vBox.bottom - vTarget.height / 2;
              const minX = Math.min(vTarget.left, vBox.left) - 30;
              const maxX = Math.max(vTarget.right, vBox.right) + 30;
              bestAlignY = {
                candCy,
                dist: botDist,
                alignLine: { x1: minX, y1: vBox.bottom, x2: maxX, y2: vBox.bottom },
                label: '☲ SAME LINE: BOTTOM ALIGNED',
              };
            }
          }

          // Vertical Alignment (matching X coordinates: Left, Center, Right)
          const vertDist = Math.abs(vTarget.cy - vBox.cy);
          if (vertDist < 800) {
            // A. Left-edge align
            const leftDist = Math.abs(vTarget.left - vBox.left);
            if (leftDist <= ALIGN_THRESHOLD && (!bestAlignX || leftDist < bestAlignX.dist)) {
              const candCx = vBox.left + vTarget.width / 2;
              const minY = Math.min(vTarget.top, vBox.top) - 30;
              const maxY = Math.max(vTarget.bottom, vBox.bottom) + 30;
              bestAlignX = {
                candCx,
                dist: leftDist,
                alignLine: { x1: vBox.left, y1: minY, x2: vBox.left, y2: maxY },
                label: '☲ SAME LINE: LEFT ALIGNED',
              };
            }

            // B. Center align X
            const cxDist = Math.abs(vTarget.cx - vBox.cx);
            if (cxDist <= ALIGN_THRESHOLD && (!bestAlignX || cxDist < bestAlignX.dist)) {
              const candCx = vBox.cx;
              const minY = Math.min(vTarget.top, vBox.top) - 30;
              const maxY = Math.max(vTarget.bottom, vBox.bottom) + 30;
              bestAlignX = {
                candCx,
                dist: cxDist,
                alignLine: { x1: vBox.cx, y1: minY, x2: vBox.cx, y2: maxY },
                label: '☲ SAME LINE: CENTER ALIGNED',
              };
            }

            // C. Right-edge align
            const rightDist = Math.abs(vTarget.right - vBox.right);
            if (rightDist <= ALIGN_THRESHOLD && (!bestAlignX || rightDist < bestAlignX.dist)) {
              const candCx = vBox.right - vTarget.width / 2;
              const minY = Math.min(vTarget.top, vBox.top) - 30;
              const maxY = Math.max(vTarget.bottom, vBox.bottom) + 30;
              bestAlignX = {
                candCx,
                dist: rightDist,
                alignLine: { x1: vBox.right, y1: minY, x2: vBox.right, y2: maxY },
                label: '☲ SAME LINE: RIGHT ALIGNED',
              };
            }
          }
        }

        // 2. EQUAL SPACING ASSISTER (Between Slots in Rows and Columns)
        let bestSpacingSnap: {
          candCx?: number;
          candCy?: number;
          dist: number;
          gap: number;
          pills: Array<{ x: number; y: number; text: string }>;
          alignLine?: { x1: number; y1: number; x2: number; y2: number };
          label: string;
        } | null = null;

        const SPACING_THRESHOLD = 16;

        // A. Horizontal Row Equal Spacing
        const rowNeighbors = otherVBoxes
          .filter(({ vBox }) => Math.abs(vBox.cy - (bestAlignY ? bestAlignY.candCy : vTarget.cy)) <= 30)
          .sort((a, b) => a.vBox.cx - b.vBox.cx);

        if (rowNeighbors.length >= 2) {
          for (let i = 0; i < rowNeighbors.length - 1; i++) {
            const leftBox = rowNeighbors[i].vBox;
            const rightBox = rowNeighbors[i + 1].vBox;
            const pairGap = Math.round(rightBox.left - leftBox.right);

            if (pairGap >= 0 && pairGap <= 200) {
              const refY = leftBox.cy;

              // Right of row
              const candRightCx = rightBox.right + pairGap + vTarget.width / 2;
              const distRight = Math.abs(vTarget.cx - candRightCx);
              if (distRight <= SPACING_THRESHOLD && (!bestSpacingSnap || distRight < bestSpacingSnap.dist)) {
                bestSpacingSnap = {
                  candCx: candRightCx,
                  dist: distRight,
                  gap: pairGap,
                  pills: [
                    { x: (leftBox.right + rightBox.left) / 2, y: refY, text: `${pairGap}px` },
                    { x: (rightBox.right + (rightBox.right + pairGap)) / 2, y: refY, text: `${pairGap}px` },
                  ],
                  alignLine: {
                    x1: leftBox.left - 20,
                    y1: refY,
                    x2: rightBox.right + pairGap + vTarget.width + 20,
                    y2: refY,
                  },
                  label: `⇥ EQUAL SPACING: ${pairGap}px ⇤`,
                };
              }

              // Left of row
              const candLeftCx = leftBox.left - pairGap - vTarget.width / 2;
              const distLeft = Math.abs(vTarget.cx - candLeftCx);
              if (distLeft <= SPACING_THRESHOLD && (!bestSpacingSnap || distLeft < bestSpacingSnap.dist)) {
                bestSpacingSnap = {
                  candCx: candLeftCx,
                  dist: distLeft,
                  gap: pairGap,
                  pills: [
                    { x: ((leftBox.left - pairGap) + leftBox.left) / 2, y: refY, text: `${pairGap}px` },
                    { x: (leftBox.right + rightBox.left) / 2, y: refY, text: `${pairGap}px` },
                  ],
                  alignLine: {
                    x1: leftBox.left - pairGap - vTarget.width - 20,
                    y1: refY,
                    x2: rightBox.right + 20,
                    y2: refY,
                  },
                  label: `⇥ EQUAL SPACING: ${pairGap}px ⇤`,
                };
              }
            }
          }
        }

        // B. Vertical Column Equal Spacing
        const colNeighbors = otherVBoxes
          .filter(({ vBox }) => Math.abs(vBox.cx - (bestAlignX ? bestAlignX.candCx : vTarget.cx)) <= 30)
          .sort((a, b) => a.vBox.cy - b.vBox.cy);

        if (colNeighbors.length >= 2) {
          for (let i = 0; i < colNeighbors.length - 1; i++) {
            const topBox = colNeighbors[i].vBox;
            const botBox = colNeighbors[i + 1].vBox;
            const pairGap = Math.round(botBox.top - topBox.bottom);

            if (pairGap >= 0 && pairGap <= 200) {
              const refX = topBox.cx;

              // Below column
              const candBotCy = botBox.bottom + pairGap + vTarget.height / 2;
              const distBot = Math.abs(vTarget.cy - candBotCy);
              if (distBot <= SPACING_THRESHOLD && (!bestSpacingSnap || distBot < bestSpacingSnap.dist)) {
                bestSpacingSnap = {
                  candCy: candBotCy,
                  dist: distBot,
                  gap: pairGap,
                  pills: [
                    { x: refX, y: (topBox.bottom + botBox.top) / 2, text: `${pairGap}px` },
                    { x: refX, y: (botBox.bottom + (botBox.bottom + pairGap)) / 2, text: `${pairGap}px` },
                  ],
                  alignLine: {
                    x1: refX,
                    y1: topBox.top - 20,
                    x2: refX,
                    y2: botBox.bottom + pairGap + vTarget.height + 20,
                  },
                  label: `⇥ EQUAL SPACING: ${pairGap}px ⇤`,
                };
              }

              // Above column
              const candTopCy = topBox.top - pairGap - vTarget.height / 2;
              const distTop = Math.abs(vTarget.cy - candTopCy);
              if (distTop <= SPACING_THRESHOLD && (!bestSpacingSnap || distTop < bestSpacingSnap.dist)) {
                bestSpacingSnap = {
                  candCy: candTopCy,
                  dist: distTop,
                  gap: pairGap,
                  pills: [
                    { x: refX, y: ((topBox.top - pairGap) + topBox.top) / 2, text: `${pairGap}px` },
                    { x: refX, y: (topBox.bottom + botBox.top) / 2, text: `${pairGap}px` },
                  ],
                  alignLine: {
                    x1: refX,
                    y1: topBox.top - pairGap - vTarget.height - 20,
                    x2: refX,
                    y2: botBox.bottom + 20,
                  },
                  label: `⇥ EQUAL SPACING: ${pairGap}px ⇤`,
                };
              }
            }
          }
        }

        // 3. COMBINE ALIGNMENT & SPACING
        if (bestSpacingSnap || bestAlignX || bestAlignY) {
          const finalCx = bestSpacingSnap?.candCx ?? bestAlignX?.candCx ?? vTarget.cx;
          const finalCy = bestSpacingSnap?.candCy ?? bestAlignY?.candCy ?? vTarget.cy;

          const alignLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
          if (bestSpacingSnap?.alignLine) alignLines.push(bestSpacingSnap.alignLine);
          if (bestAlignX?.alignLine) alignLines.push(bestAlignX.alignLine);
          if (bestAlignY?.alignLine) alignLines.push(bestAlignY.alignLine);

          const spacingPills = bestSpacingSnap?.pills || [];

          let assisterLabel = '✦ SMART SLOT ASSISTER';
          if (bestSpacingSnap && (bestAlignX || bestAlignY)) {
            assisterLabel = `⇥ EQUAL SPACING (${bestSpacingSnap.gap}px) & ALIGNED ⇤`;
          } else if (bestSpacingSnap) {
            assisterLabel = bestSpacingSnap.label;
          } else if (bestAlignX && bestAlignY) {
            assisterLabel = '☲ SAME LINE ALIGNED (ROW & COL)';
          } else if (bestAlignX) {
            assisterLabel = bestAlignX.label;
          } else if (bestAlignY) {
            assisterLabel = bestAlignY.label;
          }

          const snappedX = finalCx - targetElem.width / 2;
          const snappedY = finalCy - targetElem.height / 2;

          const assisterDist = Math.min(
            bestSpacingSnap?.dist ?? 999,
            bestAlignX?.dist ?? 999,
            bestAlignY?.dist ?? 999,
          );

          if (!bestSnap || assisterDist < minDistance || assisterDist <= 12) {
            bestSnap = {
              snappedX: Math.round(snappedX * 10) / 10,
              snappedY: Math.round(snappedY * 10) / 10,
              guideX: Math.round(finalCx),
              guideY: Math.round(finalCy),
              label: assisterLabel,
              isSlotAssister: true,
              smartGuide: {
                alignLines,
                spacingPills,
              },
            };
          }
        }
      }
    }
  }

  return bestSnap;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  canvasConfig,
  elements,
  selectedElementId,
  mode,
  activeTool,
  showGrid,
  showRulers = true,
  snapToGrid,
  zoom,
  panX,
  panY,
  onPanChange,
  onZoomChange,
  onSelectElement,
  onUpdateElementPosition,
  onUpdateElementDimensions,
  onUpdateElementGeometry,
  onUpdateElement,
  onUpdateCanvasConfig,
  onRotateElement,
  onRemoveElement,
  onConnectLane,
  onDropNewElement,
  isFullscreen = false,
  onToggleFullscreen,
  onFitToScreen,
  onResetView,
  zones = [],
  showZoneHighlights = true,
  selectedZoneFilter = null,
  highlightedElementId = null,
  onToolChange,
  enableSlotAssister = true,
  canResizeCanvas = true,
  onActionComplete,
}) => {
  const activeZoneFilter = selectedZoneFilter;

  // Filter Entrance & Exit gates for wall cutout masking
  const gateElements = useMemo(() => {
    return elements.filter((el) => el.elementType === 'Entrance' || el.elementType === 'Exit');
  }, [elements]);

  // Zone Highlighters computation: clusters of slots belonging to same zone
  const zoneClusters = useMemo(() => {
    if (!showZoneHighlights) return [];
    const map = new Map<
      string,
      {
        zoneCode: string;
        zoneName: string;
        slots: LayoutElementData[];
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        theme: ZoneTheme;
      }
    >();

    for (const el of elements) {
      if (el.elementType !== 'ParkingSlot') continue;
      const matchedZone = zones?.find((z) => z._id === el.zoneId || (z.zoneCode && el.zoneCode && z.zoneCode.toUpperCase() === el.zoneCode.toUpperCase()));
      const code = (
        el.zoneCode ||
        matchedZone?.zoneCode ||
        el.slotNumber?.match(/^([A-Za-z]+)/)?.[1] ||
        'A'
      ).toUpperCase().trim();

      if (activeZoneFilter && activeZoneFilter !== 'ALL' && code !== activeZoneFilter) {
        continue;
      }
      const theme = getZoneTheme(code);
      const existing = map.get(code);
      if (!existing) {
        map.set(code, {
          zoneCode: code,
          zoneName: el.zoneName || matchedZone?.zoneName || `Zone ${code}`,
          slots: [el],
          minX: el.x,
          minY: el.y,
          maxX: el.x + el.width,
          maxY: el.y + el.height,
          theme,
        });
      } else {
        existing.slots.push(el);
        existing.minX = Math.min(existing.minX, el.x);
        existing.minY = Math.min(existing.minY, el.y);
        existing.maxX = Math.max(existing.maxX, el.x + el.width);
        existing.maxY = Math.max(existing.maxY, el.y + el.height);
      }
    }

    return Array.from(map.values());
  }, [elements, showZoneHighlights, activeZoneFilter, zones]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Keep live mutable refs so non-passive native wheel listeners always read current view coordinates
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);

  useEffect(() => {
    zoomRef.current = zoom;
    panXRef.current = panX;
    panYRef.current = panY;
  }, [zoom, panX, panY]);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [draggingElem, setDraggingElem] = useState<DraggingElementState | null>(null);
  const [frameResize, setFrameResize] = useState<FrameResizeState | null>(null);
  const [elementResize, setElementResize] = useState<ElementResizeState | null>(null);
  const [laneSnapGuide, setLaneSnapGuide] = useState<{
    x: number;
    y: number;
    label?: string;
    isSlotAssister?: boolean;
    smartGuide?: SmartGuideVisual;
  } | null>(null);

  // Dragging Navigation Pointer to connect a slot to a driving lane
  const [draggingNavPointer, setDraggingNavPointer] = useState<{
    slotElementId: string;
    pointerId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hoveredLaneId: string | null;
  } | null>(null);

  // Distance Scaler state (measures distance between any two selected props)
  const [measureFirstElemId, setMeasureFirstElemId] = useState<string | null>(null);
  const [measureSecondElemId, setMeasureSecondElemId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  useEffect(() => {
    if (activeTool !== 'measure') {
      setMeasureFirstElemId(null);
      setMeasureSecondElemId(null);
    }
  }, [activeTool]);

  const measureElemA = useMemo(
    () => elements.find((el) => el.elementId === measureFirstElemId) || null,
    [elements, measureFirstElemId],
  );
  const measureElemB = useMemo(
    () => elements.find((el) => el.elementId === measureSecondElemId) || null,
    [elements, measureSecondElemId],
  );

  const measureData = useMemo(() => {
    if (!measureElemA || !measureElemB) return null;

    const cAx = measureElemA.x + measureElemA.width / 2;
    const cAy = measureElemA.y + measureElemA.height / 2;
    const cBx = measureElemB.x + measureElemB.width / 2;
    const cBy = measureElemB.y + measureElemB.height / 2;

    const dx = Math.abs(cBx - cAx);
    const dy = Math.abs(cBy - cAy);
    const centerDist = Math.hypot(cBx - cAx, cBy - cAy);

    // Clearance distance between bounding boxes
    const clearanceX = Math.max(
      0,
      Math.max(measureElemA.x, measureElemB.x) -
        Math.min(measureElemA.x + measureElemA.width, measureElemB.x + measureElemB.width),
    );
    const clearanceY = Math.max(
      0,
      Math.max(measureElemA.y, measureElemB.y) -
        Math.min(measureElemA.y + measureElemA.height, measureElemB.y + measureElemB.height),
    );
    const edgeClearance = Math.hypot(clearanceX, clearanceY);

    const normLen = Math.max(0.001, centerDist);
    const perpX = (-(cBy - cAy) / normLen) * 12;
    const perpY = ((cBx - cAx) / normLen) * 12;

    return {
      cAx,
      cAy,
      cBx,
      cBy,
      dx,
      dy,
      centerDist,
      edgeClearance,
      perpX,
      perpY,
      midX: (cAx + cBx) / 2,
      midY: (cAy + cBy) / 2,
      centerMeters: (centerDist / 20).toFixed(1),
      clearanceMeters: (edgeClearance / 20).toFixed(1),
    };
  }, [measureElemA, measureElemB]);

  const handleMeasureSelect = useCallback(
    (el: LayoutElementData) => {
      if (!measureFirstElemId || (measureFirstElemId && measureSecondElemId)) {
        setMeasureFirstElemId(el.elementId);
        setMeasureSecondElemId(null);
      } else if (measureFirstElemId && !measureSecondElemId) {
        if (measureFirstElemId === el.elementId) {
          setMeasureFirstElemId(null);
          return;
        }
        setMeasureSecondElemId(el.elementId);
      }
    },
    [measureFirstElemId, measureSecondElemId],
  );

  const isEdit = mode === 'edit';
  const gridSize = canvasConfig.gridSize || 20;

  // Snap coordinate helper
  const snap = useCallback(
    (val: number) => {
      if (!snapToGrid) return Math.round(val);
      return Math.round(val / gridSize) * gridSize;
    },
    [snapToGrid, gridSize],
  );

  // Active selected element for ruler projection tracking
  const selectedElement = useMemo(
    () => elements.find((el) => el.elementId === selectedElementId) || null,
    [elements, selectedElementId],
  );

  // Block grid measurement scale tick generation for all 4 canvas perimeter boundaries
  const rulerThickness = 24;
  const { xTicks, yTicks } = useMemo(() => {
    const majorStep = Math.max(100, gridSize * 5);
    const minorStep = gridSize;

    const xList: Array<{ pos: number; isMajor: boolean; isMedium: boolean }> = [];
    for (let x = 0; x <= canvasConfig.width; x += minorStep) {
      const isMajor = x % majorStep === 0;
      const isMedium = !isMajor && x % (majorStep / 2) === 0;
      xList.push({ pos: x, isMajor, isMedium });
    }
    if (canvasConfig.width % minorStep !== 0) {
      xList.push({ pos: canvasConfig.width, isMajor: false, isMedium: false });
    }

    const yList: Array<{ pos: number; isMajor: boolean; isMedium: boolean }> = [];
    for (let y = 0; y <= canvasConfig.height; y += minorStep) {
      const isMajor = y % majorStep === 0;
      const isMedium = !isMajor && y % (majorStep / 2) === 0;
      yList.push({ pos: y, isMajor, isMedium });
    }
    if (canvasConfig.height % minorStep !== 0) {
      yList.push({ pos: canvasConfig.height, isMajor: false, isMedium: false });
    }

    return { xTicks: xList, yTicks: yList };
  }, [canvasConfig.width, canvasConfig.height, gridSize]);

  // Convert client viewport pixels to Canvas virtual coordinates
  const clientToCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left - panX;
      const rawY = clientY - rect.top - panY;
      return {
        x: rawX / zoom,
        y: rawY / zoom,
      };
    },
    [panX, panY, zoom],
  );

  // 1. NON-PASSIVE NATIVE WHEEL & TOUCH PINCH LISTENERS
  // Strictly prevent the whole browser window / screen from zooming in/out
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialTouchDistance = 0;
    let initialZoom = zoomRef.current;

    const handleNativeWheel = (e: WheelEvent) => {
      // Intercept and prevent the browser's default page zoom
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY;
      const zoomFactor = delta < 0 ? 1.08 : 0.92;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const currentPanX = panXRef.current;
      const currentPanY = panYRef.current;

      // Clamped limits: min 0.25 (25%) to max 2.5 (250%)
      const nextZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.25), 2.5);
      const nextPanX = mouseX - (mouseX - currentPanX) * (nextZoom / currentZoom);
      const nextPanY = mouseY - (mouseY - currentPanY) * (nextZoom / currentZoom);

      onZoomChange(nextZoom);
      onPanChange(nextPanX, nextPanY);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialTouchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialZoom = zoomRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (initialTouchDistance > 0) {
          const ratio = currentDist / initialTouchDistance;
          const targetZoom = Math.min(Math.max(initialZoom * ratio, 0.25), 2.5);
          onZoomChange(targetZoom);
        }
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [onZoomChange, onPanChange]);

  // Background Pointer Down -> Pan canvas or deselect
  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'measure') {
      if (e.target === svgRef.current || (e.target as HTMLElement).id === 'canvas-bg-rect') {
        setMeasureFirstElemId(null);
        setMeasureSecondElemId(null);
      }
      return;
    }
    const targetEl = e.target as HTMLElement;
    const isBg =
      e.target === svgRef.current ||
      targetEl.id === 'canvas-bg-rect' ||
      targetEl.id === 'canvas-container' ||
      targetEl.tagName === 'svg';

    if (e.button === 1 || activeTool === 'pan' || e.shiftKey || (!isEdit && isBg && e.button === 0)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      containerRef.current?.setPointerCapture?.(e.pointerId);
    } else if (isBg) {
      onSelectElement(null);
    }
  };

  // Dragging element pointer down
  const handleElementPointerDown = (e: React.PointerEvent, el: LayoutElementData) => {
    if (!isEdit) return;
    if (activeTool === 'pan') return;
    e.stopPropagation();

    if (activeTool === 'measure') {
      handleMeasureSelect(el);
      return;
    }

    onSelectElement(el);

    const canvasPos = clientToCanvasCoords(e.clientX, e.clientY);
    setDraggingElem({
      elementId: el.elementId,
      startX: canvasPos.x,
      startY: canvasPos.y,
      initialElemX: el.x,
      initialElemY: el.y,
      hasMoved: false,
    });

    containerRef.current?.setPointerCapture?.(e.pointerId);
  };

  // Start Canvas Frame Stretch / Resize (Crop Tool Style)
  const handleFrameResizeStart = (
    handle: 'corner' | 'right' | 'bottom',
    e: React.PointerEvent,
  ) => {
    if (!isEdit || canResizeCanvas === false) return;
    e.stopPropagation();
    onSelectElement(null);
    const canvasPos = clientToCanvasCoords(e.clientX, e.clientY);
    setFrameResize({
      handle,
      startX: canvasPos.x,
      startY: canvasPos.y,
      initialWidth: canvasConfig.width,
      initialHeight: canvasConfig.height,
    });
    containerRef.current?.setPointerCapture?.(e.pointerId);
  };

  // Start Individual Element Resize / Stretch from ANY side or corner
  const handleElementResizeStart = (
    e: React.PointerEvent,
    elementId: string,
    handle: ResizeHandlePosition = 'se',
  ) => {
    if (!isEdit) return;
    e.stopPropagation();
    const target = elements.find((el) => el.elementId === elementId);
    if (!target) return;

    const canvasPos = clientToCanvasCoords(e.clientX, e.clientY);
    setElementResize({
      elementId,
      handle,
      startX: canvasPos.x,
      startY: canvasPos.y,
      initialX: target.x,
      initialY: target.y,
      initialWidth: target.width,
      initialHeight: target.height,
      initialRotation: target.rotation || 0,
    });
    containerRef.current?.setPointerCapture?.(e.pointerId);
  };

  // Add new Navigation Pointer to selected slot
  const handleAddNavPointer = useCallback(
    (slotElementId: string) => {
      const slot = elements.find((el) => el.elementId === slotElementId);
      if (!slot) return;
      const currentPointers = getSlotNavPointers(slot);
      const newPointer = {
        id: `nav-${Date.now().toString(36).slice(-4)}`,
        targetLaneId: null,
      };
      const updatedPointers = [...currentPointers, newPointer];
      onUpdateElement?.(slotElementId, {
        navPointers: updatedPointers,
      });
      toast.success('Added new Navigation Pointer to parking slot');
    },
    [elements, onUpdateElement],
  );

  // Disconnect Navigation Pointer from Lane
  const handleDisconnectNavPointer = useCallback(
    (slotElementId: string, pointerId: string) => {
      const slot = elements.find((el) => el.elementId === slotElementId);
      if (!slot) return;
      const currentPointers = getSlotNavPointers(slot);
      const updatedPointers = currentPointers.map((p) =>
        p.id === pointerId ? { ...p, targetLaneId: null, curbX: null, curbY: null } : p,
      );
      const updatedConnectedLaneIds = Array.from(
        new Set(updatedPointers.map((p) => p.targetLaneId).filter(Boolean)),
      ) as string[];
      onUpdateElement?.(slotElementId, {
        navPointers: updatedPointers,
        connectedLaneIds: updatedConnectedLaneIds,
      });
      toast.info('Disconnected Navigation Pointer from Lane');
    },
    [elements, onUpdateElement],
  );

  // Delete Navigation Pointer (if more than 1)
  const handleDeleteNavPointer = useCallback(
    (slotElementId: string, pointerId: string) => {
      const slot = elements.find((el) => el.elementId === slotElementId);
      if (!slot) return;
      const currentPointers = getSlotNavPointers(slot);
      if (currentPointers.length <= 1) {
        toast.info('At least one navigation pointer must remain on the slot');
        return;
      }
      const updatedPointers = currentPointers.filter((p) => p.id !== pointerId);
      const updatedConnectedLaneIds = Array.from(
        new Set(updatedPointers.map((p) => p.targetLaneId).filter(Boolean)),
      ) as string[];
      onUpdateElement?.(slotElementId, {
        navPointers: updatedPointers,
        connectedLaneIds: updatedConnectedLaneIds,
      });
      toast.info('Removed Navigation Pointer');
    },
    [elements, onUpdateElement],
  );

  // Start dragging a navigation pointer to link to a lane
  const handleNavPointerDragStart = useCallback(
    (e: React.PointerEvent, slotElementId: string, pointerId: string) => {
      e.stopPropagation();
      const canvasPos = clientToCanvasCoords(e.clientX, e.clientY);
      setDraggingNavPointer({
        slotElementId,
        pointerId,
        startX: canvasPos.x,
        startY: canvasPos.y,
        currentX: canvasPos.x,
        currentY: canvasPos.y,
        hoveredLaneId: null,
      });
      containerRef.current?.setPointerCapture?.(e.pointerId);
    },
    [clientToCanvasCoords],
  );

  // Global pointer move (Handles Panning, Element Dragging, Frame Stretching, Element Resizing)
  const handlePointerMove = (e: React.PointerEvent) => {
    // 1. Panning canvas
    if (isPanning) {
      onPanChange(e.clientX - panStart.x, e.clientY - panStart.y);
      return;
    }

    // 2. Stretching Canvas Frame (Crop photo style)
    if (frameResize && onUpdateCanvasConfig) {
      const currentCanvasPos = clientToCanvasCoords(e.clientX, e.clientY);
      const deltaX = currentCanvasPos.x - frameResize.startX;
      const deltaY = currentCanvasPos.y - frameResize.startY;

      let newWidth = frameResize.initialWidth;
      let newHeight = frameResize.initialHeight;

      if (frameResize.handle === 'corner' || frameResize.handle === 'right') {
        newWidth = Math.max(600, Math.min(6000, snap(frameResize.initialWidth + deltaX)));
      }
      if (frameResize.handle === 'corner' || frameResize.handle === 'bottom') {
        newHeight = Math.max(400, Math.min(4000, snap(frameResize.initialHeight + deltaY)));
      }

      onUpdateCanvasConfig({ width: newWidth, height: newHeight });
      return;
    }

    // 3. Resizing / Stretching an Element from ALL SIDES (Rotation-Aware & Magnetic Snap-to-Connect)
    if (elementResize && onUpdateElementDimensions) {
      const currentCanvasPos = clientToCanvasCoords(e.clientX, e.clientY);
      const handle = elementResize.handle || 'e';
      const minDimension = 30;

      const initialX = elementResize.initialX;
      const initialY = elementResize.initialY;
      const W0 = elementResize.initialWidth;
      const H0 = elementResize.initialHeight;
      const rotDeg = elementResize.initialRotation || 0;
      const rad = (rotDeg * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      // Local stretch axis and invariant fixed anchor point in local space (x, y)
      let anchorLocalX0 = 0;
      let anchorLocalY0 = 0;
      let axisLocalX = 1;
      let axisLocalY = 0;
      let isWidthStretch = true;

      if (handle === 'e') {
        // Stretch East: West edge center (0, H0/2) is invariant fixed anchor
        anchorLocalX0 = 0;
        anchorLocalY0 = H0 / 2;
        axisLocalX = 1;
        axisLocalY = 0;
        isWidthStretch = true;
      } else if (handle === 'w') {
        // Stretch West: East edge center (W0, H0/2) is invariant fixed anchor
        anchorLocalX0 = W0;
        anchorLocalY0 = H0 / 2;
        axisLocalX = -1;
        axisLocalY = 0;
        isWidthStretch = true;
      } else if (handle === 's') {
        // Stretch South: North edge center (W0/2, 0) is invariant fixed anchor
        anchorLocalX0 = W0 / 2;
        anchorLocalY0 = 0;
        axisLocalX = 0;
        axisLocalY = 1;
        isWidthStretch = false;
      } else if (handle === 'n') {
        // Stretch North: South edge center (W0/2, H0) is invariant fixed anchor
        anchorLocalX0 = W0 / 2;
        anchorLocalY0 = H0;
        axisLocalX = 0;
        axisLocalY = -1;
        isWidthStretch = false;
      } else {
        // Fallback for corner handles if triggered
        anchorLocalX0 = 0;
        anchorLocalY0 = 0;
        axisLocalX = 1;
        axisLocalY = 0;
        isWidthStretch = true;
      }

      // Convert local anchor and axis into world coordinate space
      const { rx: anchorInitRx, ry: anchorInitRy } = rotateLocalPoint(
        anchorLocalX0,
        anchorLocalY0,
        W0,
        H0,
        rotDeg,
      );
      const anchorWorldX = initialX + anchorInitRx;
      const anchorWorldY = initialY + anchorInitRy;

      // Stretch direction unit vector in world space
      const uX = axisLocalX * cosR - axisLocalY * sinR;
      const uY = axisLocalX * sinR + axisLocalY * cosR;

      // Perpendicular unit vector in world space
      const vX = -uY;
      const vY = uX;

      // Distance from invariant anchor to pointer along stretch axis
      const dx = currentCanvasPos.x - anchorWorldX;
      const dy = currentCanvasPos.y - anchorWorldY;
      const rawDist = dx * uX + dy * uY;
      let targetDist = Math.max(minDimension, snap(rawDist));

      // Stretch-to-Connect Magnetic Snapping against other props' ports
      const currentResizingElement = elements.find((el) => el.elementId === elementResize.elementId);
      let snapLockGuide: { x: number; y: number; label: string } | null = null;

      if (currentResizingElement) {
        const others = elements.filter((el) => el.elementId !== currentResizingElement.elementId);
        let bestSnapDist = 35; // 35px magnetic snap lock radius

        for (const other of others) {
          const otherPorts = getElementDockPorts(other);
          for (const oPort of otherPorts) {
            // Compatibility Check
            let isComp = false;
            let snapLabel = '⚓ AUTO-COUPLED';
            if (currentResizingElement.elementType === 'DrivingLane') {
              if (oPort.category === 'lane-end') {
                isComp = true;
                snapLabel = '═ ROAD COUPLED';
              } else if (oPort.category === 'gate') {
                isComp = true;
                snapLabel = '🚪 GATE CONNECTED';
              } else if (oPort.category === 'ramp') {
                isComp = true;
                snapLabel = '🚗 RAMP CONNECTED';
              }
            } else if (currentResizingElement.elementType === 'ParkingSlot') {
              if (oPort.category === 'curb' || oPort.category === 'slot-side') {
                isComp = true;
                snapLabel = '🅿 DOCKED TO ROAD';
              }
            }

            if (!isComp) continue;

            const { rx: oRx, ry: oRy } = rotateLocalPoint(
              oPort.offsetX,
              oPort.offsetY,
              other.width,
              other.height,
              other.rotation || 0,
            );
            const oWorldX = other.x + oRx;
            const oWorldY = other.y + oRy;

            const pdx = oWorldX - anchorWorldX;
            const pdy = oWorldY - anchorWorldY;
            const alongAxis = pdx * uX + pdy * uY;
            const perpDist = Math.abs(pdx * vX + pdy * vY);

            // If the port aligns perpendicularly with the lane and along the stretch direction
            if (perpDist <= 28 && alongAxis >= minDimension - 10) {
              const diff = Math.abs(rawDist - alongAxis);
              if (diff < bestSnapDist) {
                bestSnapDist = diff;
                targetDist = Math.round(alongAxis);
                snapLockGuide = {
                  x: Math.round(oWorldX),
                  y: Math.round(oWorldY),
                  label: snapLabel,
                };
              }
            }
          }
        }
      }

      setLaneSnapGuide(snapLockGuide);

      // Compute new geometry with stationary invariant anchor in world space
      let newWidth = W0;
      let newHeight = H0;
      let newAnchorLocalX = 0;
      let newAnchorLocalY = 0;

      if (isWidthStretch) {
        newWidth = targetDist;
        newHeight = H0;
        newAnchorLocalX = handle === 'w' ? newWidth : 0;
        newAnchorLocalY = newHeight / 2;
      } else {
        newWidth = W0;
        newHeight = targetDist;
        newAnchorLocalX = newWidth / 2;
        newAnchorLocalY = handle === 'n' ? newHeight : 0;
      }

      const { rx: newAnchorRx, ry: newAnchorRy } = rotateLocalPoint(
        newAnchorLocalX,
        newAnchorLocalY,
        newWidth,
        newHeight,
        rotDeg,
      );

      const newX = Math.round(anchorWorldX - newAnchorRx);
      const newY = Math.round(anchorWorldY - newAnchorRy);

      const isGate = currentResizingElement?.elementType === 'Entrance' || currentResizingElement?.elementType === 'Exit';
      const clamped = clampElementInsideBounds(
        newX,
        newY,
        newWidth,
        newHeight,
        rotDeg,
        canvasConfig.width,
        canvasConfig.height,
        isGate,
        14,
      );

      if (onUpdateElementGeometry) {
        onUpdateElementGeometry(elementResize.elementId, clamped.x, clamped.y, newWidth, newHeight);
      } else {
        onUpdateElementDimensions(elementResize.elementId, newWidth, newHeight);
        onUpdateElementPosition(elementResize.elementId, clamped.x, clamped.y);
      }
      return;
    }

    // 4. Dragging Element to position inside frame
    if (draggingElem && isEdit) {
      const currentCanvasPos = clientToCanvasCoords(e.clientX, e.clientY);
      const deltaX = currentCanvasPos.x - draggingElem.startX;
      const deltaY = currentCanvasPos.y - draggingElem.startY;

      const rawNewX = draggingElem.initialElemX + deltaX;
      const rawNewY = draggingElem.initialElemY + deltaY;

      const targetElem = elements.find((el) => el.elementId === draggingElem.elementId);
      const elemW = targetElem?.width || 60;
      const elemH = targetElem?.height || 100;

      let snappedX = snap(rawNewX);
      let snappedY = snap(rawNewY);
      let snapGuidePoint: {
        x: number;
        y: number;
        label: string;
        isSlotAssister?: boolean;
        smartGuide?: SmartGuideVisual;
      } | null = null;

      // Universal Train-Track & Facility Graph Magnetic Snapping
      if (targetElem) {
        const universalSnap = findUniversalSnap(
          targetElem,
          rawNewX,
          rawNewY,
          elements,
          48,
          canvasConfig,
          enableSlotAssister,
        );
        if (universalSnap) {
          snappedX = universalSnap.snappedX;
          snappedY = universalSnap.snappedY;
          snapGuidePoint = {
            x: universalSnap.guideX,
            y: universalSnap.guideY,
            label: universalSnap.label,
            isSlotAssister: universalSnap.isSlotAssister,
            smartGuide: universalSnap.smartGuide,
          };
        }
      }

      const isGate = targetElem?.elementType === 'Entrance' || targetElem?.elementType === 'Exit';
      const clamped = clampElementInsideBounds(
        snappedX,
        snappedY,
        elemW,
        elemH,
        targetElem?.rotation || 0,
        canvasConfig.width,
        canvasConfig.height,
        isGate,
        14,
      );
      snappedX = clamped.x;
      snappedY = clamped.y;

      setLaneSnapGuide(snapGuidePoint);
      onUpdateElementPosition(draggingElem.elementId, snappedX, snappedY);
    }

    // 5. Dragging Navigation Pointer to Link Slot to Driving Lane
    if (draggingNavPointer) {
      const currentCanvasPos = clientToCanvasCoords(e.clientX, e.clientY);
      const candidateLanes = elements.filter((el) => el.elementType === 'DrivingLane');
      let matchedLaneId: string | null = null;
      let minLaneDist = 70; // 70px snap radius

      for (const lane of candidateLanes) {
        const vBox = getVisualBoundingBox(lane);
        const nearestX = Math.max(vBox.left, Math.min(vBox.right, currentCanvasPos.x));
        const nearestY = Math.max(vBox.top, Math.min(vBox.bottom, currentCanvasPos.y));
        const dist = Math.hypot(currentCanvasPos.x - nearestX, currentCanvasPos.y - nearestY);
        if (dist < minLaneDist) {
          minLaneDist = dist;
          matchedLaneId = lane.elementId;
        }
      }

      setDraggingNavPointer((prev) =>
        prev
          ? {
              ...prev,
              currentX: currentCanvasPos.x,
              currentY: currentCanvasPos.y,
              hoveredLaneId: matchedLaneId,
            }
          : null,
      );
      return;
    }
  };

  // Global pointer up -> Release all drags and resize operations
  const handlePointerUp = (e: React.PointerEvent) => {
    if (containerRef.current?.hasPointerCapture?.(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    if (draggingNavPointer) {
      if (draggingNavPointer.hoveredLaneId) {
        const slot = elements.find((el) => el.elementId === draggingNavPointer.slotElementId);
        const lane = elements.find((el) => el.elementId === draggingNavPointer.hoveredLaneId);
        if (slot && lane) {
          const currentPointers = getSlotNavPointers(slot);
          const updatedPointers = currentPointers.map((p) =>
            p.id === draggingNavPointer.pointerId
              ? {
                  ...p,
                  targetLaneId: lane.elementId,
                  curbX: Math.round(draggingNavPointer.currentX),
                  curbY: Math.round(draggingNavPointer.currentY),
                }
              : p,
          );
          const updatedConnectedLaneIds = Array.from(
            new Set(updatedPointers.map((p) => p.targetLaneId).filter(Boolean)),
          ) as string[];

          onUpdateElement?.(slot.elementId, {
            navPointers: updatedPointers,
            connectedLaneIds: updatedConnectedLaneIds,
          });
          toast.success(`Navigation linked to ${lane.label || 'Driving Lane'}`);
        }
      } else {
        toast.info('Navigation pointer dropped without linking. Drag onto a driving lane to link.');
      }
      setDraggingNavPointer(null);
    }
    if (frameResize) {
      toast.success(
        `Facility boundary adjusted to ${canvasConfig.width} × ${canvasConfig.height} px (Updated live in Overview locker)`,
      );
    }

    const didChange = Boolean(
      (draggingElem && draggingElem.hasMoved) ||
      elementResize ||
      frameResize ||
      draggingNavPointer,
    );
    if (didChange) {
      onActionComplete?.();
    }

    setIsPanning(false);
    setDraggingElem(null);
    setFrameResize(null);
    setElementResize(null);
    setLaneSnapGuide(null);
  };

  // Drag & drop from Element Palette / Slot Tray
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    let elementType: string | undefined;
    let extraData: any;

    const inMemoryDrag = getActiveDragElement();
    if (inMemoryDrag) {
      elementType = inMemoryDrag.elementType;
      extraData = inMemoryDrag.extraData;
      setActiveDragElement(null);
    } else {
      const rawData =
        e.dataTransfer.getData('application/json') ||
        e.dataTransfer.getData('text/plain') ||
        e.dataTransfer.getData('text');
      if (rawData) {
        try {
          const payload = JSON.parse(rawData);
          elementType = payload.elementType;
          extraData = payload.extraData;
        } catch (err) {
          console.error('Failed to parse dropped element data:', err);
        }
      }
    }

    if (!elementType) {
      console.warn('Drop ignored: no elementType found in drag state or dataTransfer');
      return;
    }

    try {
      const coords = clientToCanvasCoords(e.clientX, e.clientY);
      let targetX = coords.x - 35;
      let targetY = coords.y - 30;

      if (isNaN(targetX) || isNaN(targetY)) {
        targetX = Math.round(canvasConfig.width / 2 - 35);
        targetY = Math.round(canvasConfig.height / 2 - 30);
      }

      const tempElem: LayoutElementData = {
        elementId: 'temp-drop',
        elementType: elementType as any,
        x: targetX,
        y: targetY,
        width:
          extraData?.width ||
          (elementType === 'DrivingLane'
            ? 480
            : elementType === 'ParkingSlot'
            ? 70
            : elementType === 'Entrance' || elementType === 'Exit' || elementType === 'BuildingEntrance'
            ? 140
            : elementType === 'LiftStaircase'
            ? 150
            : elementType === 'Staircase'
            ? 100
            : elementType === 'Lift'
            ? 80
            : elementType === 'Ramp'
            ? 160
            : elementType === 'RampPortal'
            ? 140
            : elementType === 'Wall'
            ? 240
            : elementType === 'Pillar'
            ? 40
            : elementType === 'RestrictedArea' || elementType === 'ReservedArea'
            ? 160
            : 70),
        height:
          extraData?.height ||
          (elementType === 'DrivingLane'
            ? 100
            : elementType === 'ParkingSlot'
            ? 120
            : elementType === 'Entrance' || elementType === 'Exit'
            ? 50
            : elementType === 'BuildingEntrance'
            ? 60
            : elementType === 'LiftStaircase'
            ? 80
            : elementType === 'Staircase'
            ? 70
            : elementType === 'Lift'
            ? 80
            : elementType === 'Ramp'
            ? 100
            : elementType === 'RampPortal'
            ? 70
            : elementType === 'Wall'
            ? 16
            : elementType === 'Pillar'
            ? 40
            : elementType === 'RestrictedArea' || elementType === 'ReservedArea'
            ? 160
            : 70),
        rotation: extraData?.rotation || 0,
        zIndex: 1,
        label: extraData?.label,
      };

      const dropSnap = findUniversalSnap(tempElem, targetX, targetY, elements, 60, canvasConfig, enableSlotAssister);
      if (dropSnap) {
        targetX = dropSnap.snappedX;
        targetY = dropSnap.snappedY;
      } else {
        targetX = snap(targetX);
        targetY = snap(targetY);
      }

      const isGate = elementType === 'Entrance' || elementType === 'Exit' || elementType === 'BuildingEntrance';
      const clamped = clampElementInsideBounds(
        targetX,
        targetY,
        tempElem.width || 70,
        tempElem.height || 60,
        tempElem.rotation || 0,
        canvasConfig.width,
        canvasConfig.height,
        isGate,
        14,
      );
      targetX = clamped.x;
      targetY = clamped.y;

      onDropNewElement(elementType, targetX, targetY, extraData);
    } catch (err) {
      console.error('Failed to parse dropped element:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex-1 w-full h-full overflow-hidden bg-slate-950 select-none cursor-default transition-all',
        isDragOver && 'ring-2 ring-primary ring-inset shadow-[inset_0_0_20px_rgba(59,130,246,0.25)]',
      )}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <svg
        ref={svgRef}
        className="w-full h-full overflow-visible touch-none"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          cursor:
            isPanning
              ? 'grabbing'
              : activeTool === 'pan' || !isEdit
              ? 'grab'
              : activeTool === 'measure'
              ? 'crosshair'
              : frameResize
              ? frameResize.handle === 'corner'
                ? 'se-resize'
                : frameResize.handle === 'right'
                ? 'ew-resize'
                : 'ns-resize'
              : draggingElem
              ? 'grabbing'
              : 'default',
        }}
      >
        <defs>
          {/* Minor Grid Pattern */}
          <pattern
            id="grid-minor"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="#334155"
              strokeWidth="0.5"
              strokeOpacity="0.4"
            />
          </pattern>

          {/* Major Grid Pattern */}
          <pattern
            id="grid-major"
            width={gridSize * 5}
            height={gridSize * 5}
            patternUnits="userSpaceOnUse"
          >
            <rect width={gridSize * 5} height={gridSize * 5} fill="url(#grid-minor)" />
            <path
              d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`}
              fill="none"
              stroke="#475569"
              strokeWidth="1"
              strokeOpacity="0.6"
            />
          </pattern>

          {/* Architectural Concrete Masonry Hatch Pattern for Boundary Walls */}
          <pattern
            id="boundary-wall-hatch"
            width={12}
            height={12}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={12} height={12} fill="#1e293b" />
            <line x1={0} y1={0} x2={0} y2={12} stroke="#334155" strokeWidth={3} />
            <line x1={6} y1={0} x2={6} y2={12} stroke="#475569" strokeWidth={1.5} />
          </pattern>

          {/* Dynamic Mask that cuts holes through the boundary wall for any Entrance or Exit gate */}
          <mask id="boundary-wall-cutout-mask">
            <rect
              x={-100}
              y={-100}
              width={canvasConfig.width + 200}
              height={canvasConfig.height + 200}
              fill="white"
            />
            {gateElements.map((gate) => {
              const isRot = !!(gate.rotation && gate.rotation !== 0);
              const cx = gate.x + gate.width / 2;
              const cy = gate.y + gate.height / 2;
              return (
                <rect
                  key={`wall-cut-${gate.elementId}`}
                  x={gate.x - 2}
                  y={gate.y - 2}
                  width={gate.width + 4}
                  height={gate.height + 4}
                  rx={2}
                  transform={isRot ? `rotate(${gate.rotation}, ${cx}, ${cy})` : undefined}
                  fill="black"
                />
              );
            })}
          </mask>
        </defs>

        {/* Viewport Transform Group (Handles Pan and Zoom) */}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {/* Floor Canvas Background Plate */}
          <rect
            id="canvas-bg-rect"
            x={0}
            y={0}
            width={canvasConfig.width}
            height={canvasConfig.height}
            fill={canvasConfig.backgroundColor || '#0f172a'}
            stroke={frameResize ? '#60a5fa' : '#334155'}
            strokeWidth={frameResize ? 3 : 2}
            strokeDasharray={frameResize ? '4 4' : undefined}
            rx={4}
            className="transition-colors"
          />

          {/* Grid Overlay */}
          {showGrid && (
            <rect
              x={0}
              y={0}
              width={canvasConfig.width}
              height={canvasConfig.height}
              fill="url(#grid-major)"
              pointerEvents="none"
            />
          )}

          {/* ============================================================== */}
          {/* AUTHENTIC ARCHITECTURAL FACILITY BOUNDARY WALL SYSTEM           */}
          {/* Cut out dynamically by any Entrance or Exit gate via SVG mask   */}
          {/* ============================================================== */}
          <g
            id="facility-boundary-wall-perimeter"
            mask="url(#boundary-wall-cutout-mask)"
            pointerEvents="none"
            className="select-none"
          >
            {/* North Wall (Top Boundary) */}
            <rect
              x={0}
              y={0}
              width={canvasConfig.width}
              height={14}
              fill="url(#boundary-wall-hatch)"
              stroke="#475569"
              strokeWidth={1.5}
            />
            <line x1={0} y1={14} x2={canvasConfig.width} y2={14} stroke="#64748b" strokeWidth={1} />

            {/* South Wall (Bottom Boundary) */}
            <rect
              x={0}
              y={canvasConfig.height - 14}
              width={canvasConfig.width}
              height={14}
              fill="url(#boundary-wall-hatch)"
              stroke="#475569"
              strokeWidth={1.5}
            />
            <line
              x1={0}
              y1={canvasConfig.height - 14}
              x2={canvasConfig.width}
              y2={canvasConfig.height - 14}
              stroke="#64748b"
              strokeWidth={1}
            />

            {/* West Wall (Left Boundary) */}
            <rect
              x={0}
              y={0}
              width={14}
              height={canvasConfig.height}
              fill="url(#boundary-wall-hatch)"
              stroke="#475569"
              strokeWidth={1.5}
            />
            <line x1={14} y1={0} x2={14} y2={canvasConfig.height} stroke="#64748b" strokeWidth={1} />

            {/* East Wall (Right Boundary) */}
            <rect
              x={canvasConfig.width - 14}
              y={0}
              width={14}
              height={canvasConfig.height}
              fill="url(#boundary-wall-hatch)"
              stroke="#475569"
              strokeWidth={1.5}
            />
            <line
              x1={canvasConfig.width - 14}
              y1={0}
              x2={canvasConfig.width - 14}
              y2={canvasConfig.height}
              stroke="#64748b"
              strokeWidth={1}
            />

            {/* Corner Reinforced Pillars / Masonry Quoins */}
            {/* Top-Left */}
            <rect x={0} y={0} width={20} height={20} fill="#334155" stroke="#94a3b8" strokeWidth={1.5} />
            <circle cx={10} cy={10} r={2.5} fill="#0f172a" stroke="#cbd5e1" strokeWidth={1} />

            {/* Top-Right */}
            <rect x={canvasConfig.width - 20} y={0} width={20} height={20} fill="#334155" stroke="#94a3b8" strokeWidth={1.5} />
            <circle cx={canvasConfig.width - 10} cy={10} r={2.5} fill="#0f172a" stroke="#cbd5e1" strokeWidth={1} />

            {/* Bottom-Left */}
            <rect x={0} y={canvasConfig.height - 20} width={20} height={20} fill="#334155" stroke="#94a3b8" strokeWidth={1.5} />
            <circle cx={10} cy={canvasConfig.height - 10} r={2.5} fill="#0f172a" stroke="#cbd5e1" strokeWidth={1} />

            {/* Bottom-Right */}
            <rect x={canvasConfig.width - 20} y={canvasConfig.height - 20} width={20} height={20} fill="#334155" stroke="#94a3b8" strokeWidth={1.5} />
            <circle cx={canvasConfig.width - 10} cy={canvasConfig.height - 10} r={2.5} fill="#0f172a" stroke="#cbd5e1" strokeWidth={1} />

            {/* Boundary Wall Markings */}
            <text
              x={canvasConfig.width / 2}
              y={10}
              fill="#94a3b8"
              fontSize={8}
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              letterSpacing={2}
            >
              ▲ NORTH FACILITY BOUNDARY WALL ({canvasConfig.width}m) ▲
            </text>
            <text
              x={canvasConfig.width / 2}
              y={canvasConfig.height - 4}
              fill="#94a3b8"
              fontSize={8}
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              letterSpacing={2}
            >
              ▼ SOUTH FACILITY BOUNDARY WALL ({canvasConfig.width}m) ▼
            </text>
          </g>

          {/* Architectural Gate Jambs for Entrance & Exit Breaches */}
          <g id="gate-wall-jambs" pointerEvents="none" className="select-none">
            {gateElements.map((gate) => {
              const isEntrance = gate.elementType === 'Entrance';
              const beaconColor = isEntrance ? '#22c55e' : '#ef4444';
              const jambs: React.ReactNode[] = [];

              // North Wall Breach
              if (gate.y <= 16) {
                jambs.push(
                  <g key={`north-jamb-${gate.elementId}`}>
                    <rect x={gate.x - 5} y={0} width={4} height={14} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={gate.x - 3} cy={7} r={2} fill={beaconColor} />
                    <rect x={gate.x + gate.width + 1} y={0} width={4} height={14} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={gate.x + gate.width + 3} cy={7} r={2} fill={beaconColor} />
                  </g>
                );
              }
              // South Wall Breach
              if (gate.y + gate.height >= canvasConfig.height - 16) {
                jambs.push(
                  <g key={`south-jamb-${gate.elementId}`}>
                    <rect x={gate.x - 5} y={canvasConfig.height - 14} width={4} height={14} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={gate.x - 3} cy={canvasConfig.height - 7} r={2} fill={beaconColor} />
                    <rect x={gate.x + gate.width + 1} y={canvasConfig.height - 14} width={4} height={14} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={gate.x + gate.width + 3} cy={canvasConfig.height - 7} r={2} fill={beaconColor} />
                  </g>
                );
              }
              // West Wall Breach
              if (gate.x <= 16) {
                jambs.push(
                  <g key={`west-jamb-${gate.elementId}`}>
                    <rect x={0} y={gate.y - 5} width={14} height={4} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={7} cy={gate.y - 3} r={2} fill={beaconColor} />
                    <rect x={0} y={gate.y + gate.height + 1} width={14} height={4} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={7} cy={gate.y + gate.height + 3} r={2} fill={beaconColor} />
                  </g>
                );
              }
              // East Wall Breach
              if (gate.x + gate.width >= canvasConfig.width - 16) {
                jambs.push(
                  <g key={`east-jamb-${gate.elementId}`}>
                    <rect x={canvasConfig.width - 14} y={gate.y - 5} width={14} height={4} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={canvasConfig.width - 7} cy={gate.y - 3} r={2} fill={beaconColor} />
                    <rect x={canvasConfig.width - 14} y={gate.y + gate.height + 1} width={14} height={4} fill="#475569" stroke="#94a3b8" strokeWidth={1} rx={1} />
                    <circle cx={canvasConfig.width - 7} cy={gate.y + gate.height + 3} r={2} fill={beaconColor} />
                  </g>
                );
              }

              return jambs;
            })}
          </g>

          {/* Canvas Perimeter Dimension Indicators */}
          <text
            x={10}
            y={canvasConfig.height - 10}
            fill="#64748b"
            fontSize={12}
            fontFamily="monospace"
            pointerEvents="none"
          >
            Floor Plane Boundary: {canvasConfig.width} × {canvasConfig.height} units
          </text>

          {/* ============================================================== */}
          {/* 4-SIDED ARCHITECTURAL BLOCK GRID MEASUREMENT SCALES (RULERS)   */}
          {/* Top (North), Bottom (South), Left (West), Right (East)         */}
          {/* ============================================================== */}
          {showRulers && (
            <g id="canvas-perimeter-scales" pointerEvents="none" className="select-none">
              {/* --- 1. TOP / NORTH SCALE (X-AXIS) --- */}
              <g id="scale-north">
                <rect
                  x={0}
                  y={-rulerThickness}
                  width={canvasConfig.width}
                  height={rulerThickness}
                  fill="#0b1120"
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={0}
                  x2={canvasConfig.width}
                  y2={0}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
                {/* Ticks and Labels */}
                {xTicks.map((tick) => (
                  <g key={`north-tick-${tick.pos}`}>
                    <line
                      x1={tick.pos}
                      y1={tick.isMajor ? -rulerThickness : tick.isMedium ? -11 : -5}
                      x2={tick.pos}
                      y2={0}
                      stroke={tick.isMajor ? '#64748b' : tick.isMedium ? '#475569' : '#334155'}
                      strokeWidth={tick.isMajor ? 1.2 : 0.8}
                    />
                    {tick.isMajor && (
                      <text
                        x={tick.pos + 3}
                        y={-14}
                        fill="#cbd5e1"
                        fontSize={8.5}
                        fontFamily="ui-monospace, monospace"
                        fontWeight="600"
                      >
                        {tick.pos}
                      </text>
                    )}
                  </g>
                ))}
                {/* North Heading Center Label */}
                {canvasConfig.width >= 400 && (
                  <text
                    x={canvasConfig.width / 2}
                    y={-6}
                    fill="#38bdf8"
                    fontSize={7.5}
                    fontFamily="ui-monospace, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    letterSpacing={1.5}
                    opacity={0.85}
                  >
                    ▲ NORTH SCALE (X: 0 → {canvasConfig.width}px) ▲
                  </text>
                )}
                {/* Active Selection X-Projection */}
                {selectedElement && (
                  <g>
                    <rect
                      x={selectedElement.x}
                      y={-rulerThickness}
                      width={Math.max(2, selectedElement.width)}
                      height={rulerThickness}
                      fill="rgba(56, 189, 248, 0.25)"
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                    />
                    <text
                      x={selectedElement.x + selectedElement.width / 2}
                      y={-2}
                      fill="#38bdf8"
                      fontSize={7.5}
                      fontFamily="ui-monospace, monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      W: {Math.round(selectedElement.width)}
                    </text>
                  </g>
                )}
              </g>

              {/* --- 2. BOTTOM / SOUTH SCALE (X-AXIS) --- */}
              <g id="scale-south">
                <rect
                  x={0}
                  y={canvasConfig.height}
                  width={canvasConfig.width}
                  height={rulerThickness}
                  fill="#0b1120"
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={canvasConfig.height}
                  x2={canvasConfig.width}
                  y2={canvasConfig.height}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
                {/* Ticks and Labels */}
                {xTicks.map((tick) => (
                  <g key={`south-tick-${tick.pos}`}>
                    <line
                      x1={tick.pos}
                      y1={canvasConfig.height}
                      x2={tick.pos}
                      y2={canvasConfig.height + (tick.isMajor ? rulerThickness : tick.isMedium ? 11 : 5)}
                      stroke={tick.isMajor ? '#64748b' : tick.isMedium ? '#475569' : '#334155'}
                      strokeWidth={tick.isMajor ? 1.2 : 0.8}
                    />
                    {tick.isMajor && (
                      <text
                        x={tick.pos + 3}
                        y={canvasConfig.height + 15}
                        fill="#cbd5e1"
                        fontSize={8.5}
                        fontFamily="ui-monospace, monospace"
                        fontWeight="600"
                      >
                        {tick.pos}
                      </text>
                    )}
                  </g>
                ))}
                {/* South Heading Center Label */}
                {canvasConfig.width >= 400 && (
                  <text
                    x={canvasConfig.width / 2}
                    y={canvasConfig.height + 21}
                    fill="#38bdf8"
                    fontSize={7.5}
                    fontFamily="ui-monospace, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    letterSpacing={1.5}
                    opacity={0.85}
                  >
                    ▼ SOUTH SCALE (X: 0 → {canvasConfig.width}px) ▼
                  </text>
                )}
                {/* Active Selection X-Projection */}
                {selectedElement && (
                  <rect
                    x={selectedElement.x}
                    y={canvasConfig.height}
                    width={Math.max(2, selectedElement.width)}
                    height={rulerThickness}
                    fill="rgba(56, 189, 248, 0.25)"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                  />
                )}
              </g>

              {/* --- 3. LEFT / WEST SCALE (Y-AXIS) --- */}
              <g id="scale-west">
                <rect
                  x={-rulerThickness}
                  y={0}
                  width={rulerThickness}
                  height={canvasConfig.height}
                  fill="#0b1120"
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={canvasConfig.height}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
                {/* Ticks and Labels */}
                {yTicks.map((tick) => (
                  <g key={`west-tick-${tick.pos}`}>
                    <line
                      x1={tick.isMajor ? -rulerThickness : tick.isMedium ? -11 : -5}
                      y1={tick.pos}
                      x2={0}
                      y2={tick.pos}
                      stroke={tick.isMajor ? '#64748b' : tick.isMedium ? '#475569' : '#334155'}
                      strokeWidth={tick.isMajor ? 1.2 : 0.8}
                    />
                    {tick.isMajor && (
                      <text
                        x={-22}
                        y={tick.pos - 2}
                        fill="#cbd5e1"
                        fontSize={7.5}
                        fontFamily="ui-monospace, monospace"
                        fontWeight="600"
                      >
                        {tick.pos}
                      </text>
                    )}
                  </g>
                ))}
                {/* Active Selection Y-Projection */}
                {selectedElement && (
                  <g>
                    <rect
                      x={-rulerThickness}
                      y={selectedElement.y}
                      width={rulerThickness}
                      height={Math.max(2, selectedElement.height)}
                      fill="rgba(56, 189, 248, 0.25)"
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                    />
                    <text
                      x={-22}
                      y={selectedElement.y + selectedElement.height / 2 + 3}
                      fill="#38bdf8"
                      fontSize={7}
                      fontFamily="ui-monospace, monospace"
                      fontWeight="bold"
                    >
                      H:{Math.round(selectedElement.height)}
                    </text>
                  </g>
                )}
              </g>

              {/* --- 4. RIGHT / EAST SCALE (Y-AXIS) --- */}
              <g id="scale-east">
                <rect
                  x={canvasConfig.width}
                  y={0}
                  width={rulerThickness}
                  height={canvasConfig.height}
                  fill="#0b1120"
                  stroke="#1e293b"
                  strokeWidth={1}
                />
                <line
                  x1={canvasConfig.width}
                  y1={0}
                  x2={canvasConfig.width}
                  y2={canvasConfig.height}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
                {/* Ticks and Labels */}
                {yTicks.map((tick) => (
                  <g key={`east-tick-${tick.pos}`}>
                    <line
                      x1={canvasConfig.width}
                      y1={tick.pos}
                      x2={canvasConfig.width + (tick.isMajor ? rulerThickness : tick.isMedium ? 11 : 5)}
                      y2={tick.pos}
                      stroke={tick.isMajor ? '#64748b' : tick.isMedium ? '#475569' : '#334155'}
                      strokeWidth={tick.isMajor ? 1.2 : 0.8}
                    />
                    {tick.isMajor && (
                      <text
                        x={canvasConfig.width + 3}
                        y={tick.pos - 2}
                        fill="#cbd5e1"
                        fontSize={7.5}
                        fontFamily="ui-monospace, monospace"
                        fontWeight="600"
                      >
                        {tick.pos}
                      </text>
                    )}
                  </g>
                ))}
                {/* Active Selection Y-Projection */}
                {selectedElement && (
                  <rect
                    x={canvasConfig.width}
                    y={selectedElement.y}
                    width={rulerThickness}
                    height={Math.max(2, selectedElement.height)}
                    fill="rgba(56, 189, 248, 0.25)"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                  />
                )}
              </g>

              {/* --- 5. FOUR CORNER JUNCTION BLOCKS --- */}
              {/* North-West (Top-Left) (0,0) */}
              <g id="corner-nw">
                <rect
                  x={-rulerThickness}
                  y={-rulerThickness}
                  width={rulerThickness}
                  height={rulerThickness}
                  fill="#020617"
                  stroke="#334155"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={-12}
                  y={-14}
                  fill="#38bdf8"
                  fontSize={7}
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  0,0
                </text>
                <text
                  x={-12}
                  y={-4}
                  fill="#64748b"
                  fontSize={6}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                >
                  NW
                </text>
              </g>

              {/* North-East (Top-Right) (W,0) */}
              <g id="corner-ne">
                <rect
                  x={canvasConfig.width}
                  y={-rulerThickness}
                  width={rulerThickness}
                  height={rulerThickness}
                  fill="#020617"
                  stroke="#334155"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={canvasConfig.width + 12}
                  y={-14}
                  fill="#38bdf8"
                  fontSize={7}
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  X:W
                </text>
                <text
                  x={canvasConfig.width + 12}
                  y={-4}
                  fill="#64748b"
                  fontSize={6}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                >
                  NE
                </text>
              </g>

              {/* South-West (Bottom-Left) (0,H) */}
              <g id="corner-sw">
                <rect
                  x={-rulerThickness}
                  y={canvasConfig.height}
                  width={rulerThickness}
                  height={rulerThickness}
                  fill="#020617"
                  stroke="#334155"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={-12}
                  y={canvasConfig.height + 10}
                  fill="#38bdf8"
                  fontSize={7}
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Y:H
                </text>
                <text
                  x={-12}
                  y={canvasConfig.height + 18}
                  fill="#64748b"
                  fontSize={6}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                >
                  SW
                </text>
              </g>

              {/* South-East (Bottom-Right) (W,H) */}
              <g id="corner-se">
                <rect
                  x={canvasConfig.width}
                  y={canvasConfig.height}
                  width={rulerThickness}
                  height={rulerThickness}
                  fill="#020617"
                  stroke="#334155"
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={canvasConfig.width + 12}
                  y={canvasConfig.height + 10}
                  fill="#38bdf8"
                  fontSize={7}
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  SE
                </text>
                <text
                  x={canvasConfig.width + 12}
                  y={canvasConfig.height + 18}
                  fill="#64748b"
                  fontSize={5.5}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                >
                  {gridSize}px
                </text>
              </g>
            </g>
          )}

          {/* STRETCHABLE CANVAS BOUNDARY CROP HANDLES (EDIT MODE ONLY - GROUND FLOOR ONLY) */}
          {isEdit && (
            <g className="select-none" pointerEvents="all">
              {canResizeCanvas !== false ? (
                <>
                  {/* 1. Bottom-Right Corner Crop Handle */}
                  <g
                    transform={`translate(${canvasConfig.width}, ${canvasConfig.height})`}
                    className="cursor-se-resize group"
                    onPointerDown={(e) => handleFrameResizeStart('corner', e)}
                  >
                    <title>Drag corner to stretch facility width and height (Ground Floor Master)</title>
                    {/* Visual crop angle bracket */}
                    <path
                      d="M -24 0 L 0 0 L 0 -24"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                    <rect
                      x={-8}
                      y={-8}
                      width={16}
                      height={16}
                      rx={3}
                      fill="#1d4ed8"
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="group-hover:scale-125 transition-transform drop-shadow"
                    />
                  </g>

                  {/* 2. Right-Edge Midpoint Stretch Handle */}
                  <g
                    transform={`translate(${canvasConfig.width}, ${canvasConfig.height / 2})`}
                    className="cursor-ew-resize group"
                    onPointerDown={(e) => handleFrameResizeStart('right', e)}
                  >
                    <title>Drag edge to stretch facility width</title>
                    <rect
                      x={-5}
                      y={-22}
                      width={10}
                      height={44}
                      rx={5}
                      fill="#1d4ed8"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="group-hover:scale-110 transition-transform drop-shadow"
                    />
                    <line x1={0} y1={-10} x2={0} y2={10} stroke="#93c5fd" strokeWidth={2} />
                  </g>

                  {/* 3. Bottom-Edge Midpoint Stretch Handle */}
                  <g
                    transform={`translate(${canvasConfig.width / 2}, ${canvasConfig.height})`}
                    className="cursor-ns-resize group"
                    onPointerDown={(e) => handleFrameResizeStart('bottom', e)}
                  >
                    <title>Drag edge to stretch facility height</title>
                    <rect
                      x={-22}
                      y={-5}
                      width={44}
                      height={10}
                      rx={5}
                      fill="#1d4ed8"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="group-hover:scale-110 transition-transform drop-shadow"
                    />
                    <line x1={-10} y1={0} x2={10} y2={0} stroke="#93c5fd" strokeWidth={2} />
                  </g>

                  {/* Frame Size Badge / Crop Guide */}
                  <g transform={`translate(${canvasConfig.width - 270}, ${canvasConfig.height + 34})`}>
                    <rect
                      x={0}
                      y={0}
                      width={270}
                      height={24}
                      rx={4}
                      fill="#0f172acc"
                      stroke="#3b82f6"
                      strokeWidth={1}
                    />
                    <text
                      x={135}
                      y={16}
                      fill="#93c5fd"
                      fontSize={11}
                      fontWeight="600"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      📐 Boundary: {canvasConfig.width} × {canvasConfig.height} px (G Floor Master)
                    </text>
                  </g>
                </>
              ) : (
                /* Upper floor boundary indicator - Locked to G floor */
                <g transform={`translate(${canvasConfig.width - 320}, ${canvasConfig.height + 34})`}>
                  <rect
                    x={0}
                    y={0}
                    width={320}
                    height={24}
                    rx={4}
                    fill="#0f172acc"
                    stroke="#475569"
                    strokeWidth={1}
                  />
                  <text
                    x={160}
                    y={16}
                    fill="#94a3b8"
                    fontSize={10}
                    fontWeight="600"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    🔒 Boundary: {canvasConfig.width} × {canvasConfig.height} px (Resize on G Floor Only)
                  </text>
                </g>
              )}
            </g>
          )}

          {/* ============================================================== */}
          {/* ARCHITECTURAL ZONE REGION HULLS & WATERMARK HIGHLIGHTERS       */}
          {/* ============================================================== */}
          {showZoneHighlights && (
            <g id="facility-zone-highlighters" pointerEvents="none" className="select-none">
              {zoneClusters.map((cluster) => {
                if (cluster.slots.length === 0) return null;
                const pad = 16;
                const regX = cluster.minX - pad;
                const regY = cluster.minY - pad;
                const regW = cluster.maxX - cluster.minX + pad * 2;
                const regH = cluster.maxY - cluster.minY + pad * 2;
                const headerW = Math.max(160, cluster.zoneCode.length * 12 + cluster.zoneName.length * 8 + 40);

                return (
                  <g key={`zone-cluster-${cluster.zoneCode}`} className="transition-all duration-300">
                    {/* Zone Territory Bounding Box */}
                    <rect
                      x={regX}
                      y={regY}
                      width={regW}
                      height={regH}
                      rx={12}
                      fill={cluster.theme.fill}
                      stroke={cluster.theme.border}
                      strokeWidth={2}
                      strokeDasharray="8 6"
                      className="transition-all"
                    />

                    {/* Zone Watermark & Stencil Header */}
                    <g transform={`translate(${regX}, ${Math.max(18, regY - 26)})`}>
                      <rect
                        x={0}
                        y={0}
                        width={headerW}
                        height={22}
                        rx={4}
                        fill="#0f172af0"
                        stroke={cluster.theme.border}
                        strokeWidth={1.5}
                      />
                      <circle cx={11} cy={11} r={4} fill={cluster.theme.color} />
                      <text
                        x={22}
                        y={15}
                        fill={cluster.theme.color}
                        fontSize={10}
                        fontWeight="black"
                        fontFamily="monospace"
                        letterSpacing={1}
                      >
                        ⬡ ZONE {cluster.zoneCode} — {cluster.zoneName} ({cluster.slots.length})
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* Render All Layout Elements (Junctions & Connectors layered on top of straight roads for seamless in-lane embedding) */}
          {[...elements]
            .sort((a, b) => {
              if (a.elementId === selectedElementId) return 1;
              if (b.elementId === selectedElementId) return -1;

              const isHub = (el: LayoutElementData) =>
                el.label?.includes('Square') ||
                el.label?.includes('Connector') ||
                el.label?.includes('Hub') ||
                el.label?.includes('Turn') ||
                el.label?.includes('Corner') ||
                el.label?.includes('T-Junction') ||
                Math.abs(el.width - el.height) <= 30;

              if (a.elementType === 'DrivingLane' && b.elementType === 'DrivingLane') {
                const aHub = isHub(a);
                const bHub = isHub(b);
                if (!aHub && bHub) return -1;
                if (aHub && !bHub) return 1;
              }
              return 0;
            })
            .map((el) => {
            const matchedZone = zones?.find((z) => z._id === el.zoneId || (z.zoneCode && el.zoneCode && z.zoneCode.toUpperCase() === el.zoneCode.toUpperCase()));
            const effectiveCode = (
              el.zoneCode ||
              matchedZone?.zoneCode ||
              el.slotNumber?.match(/^([A-Za-z]+)/)?.[1] ||
              'A'
            ).toUpperCase().trim();
            const isHighlighted =
              showZoneHighlights &&
              el.elementType === 'ParkingSlot' &&
              (!activeZoneFilter || activeZoneFilter === 'ALL' || effectiveCode === activeZoneFilter);
            const theme = el.elementType === 'ParkingSlot' ? getZoneTheme(effectiveCode) : undefined;

            return (
              <CanvasElement
                key={el.elementId}
                element={el}
                isSelected={
                  el.elementId === selectedElementId &&
                  (!highlightedElementId || highlightedElementId === el.elementId)
                }
                mode={mode}
                onSelect={onSelectElement}
                onPointerDown={handleElementPointerDown}
                onRotate={isEdit ? onRotateElement : undefined}
                onRemove={isEdit ? onRemoveElement : undefined}
                onResizeStart={isEdit ? handleElementResizeStart : undefined}
                onConnectLane={isEdit ? onConnectLane : undefined}
                isConnectionHighlighted={el.elementId === highlightedElementId}
                isZoneHighlighted={isHighlighted}
                activeTool={activeTool}
                zoneTheme={theme}
                gateElements={gateElements}
              />
            );
          })}

          {/* Active Customer Navigation Route Linkage & Interactive Navigation Pointers */}
          {selectedElement && (
            <g className="select-none">
              {/* Case 1: Parking Slot is selected -> Render "+ Add Nav" button and interactive navigation pointers */}
              {selectedElement.elementType === 'ParkingSlot' && (() => {
                const navPointers = getSlotNavPointers(selectedElement);
                const slotCx = selectedElement.x + selectedElement.width / 2;
                const slotCy = selectedElement.y + selectedElement.height / 2;

                return (
                  <g key={`slot-nav-layer-${selectedElement.elementId}`}>
                    {/* 1. "+ Add Nav" interactive button above selected slot */}
                    {isEdit && (
                      <g
                        className="cursor-pointer group/addnav"
                        transform={`translate(${slotCx}, ${selectedElement.y - 24})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddNavPointer(selectedElement.elementId);
                        }}
                      >
                        <title>Click to add another navigation route pointer</title>
                        <rect
                          x={-48}
                          y={-11}
                          width={96}
                          height={22}
                          rx={11}
                          fill="#0f172af2"
                          stroke="#06b6d4"
                          strokeWidth={1.4}
                          className="transition-all group-hover/addnav:fill-cyan-950 group-hover/addnav:stroke-cyan-300 drop-shadow-md"
                        />
                        <text
                          x={0}
                          y={3.5}
                          fill="#22d3ee"
                          fontSize={9}
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                          fontWeight="bold"
                          textAnchor="middle"
                          className="select-none pointer-events-none"
                        >
                          + Add Nav
                        </text>
                      </g>
                    )}

                    {/* 2. Render each Navigation Pointer */}
                    {navPointers.map((pointer, pIdx) => {
                      const targetLane = pointer.targetLaneId
                        ? elements.find((el) => el.elementId === pointer.targetLaneId && el.elementType === 'DrivingLane')
                        : null;

                      // A. CONNECTED POINTER: Draw route link to the connected Driving Lane
                      if (targetLane) {
                        const isHoriz = isElementVisuallyHorizontal(targetLane);
                        const laneVBox = getVisualBoundingBox(targetLane);
                        const slotVBox = getVisualBoundingBox(selectedElement);
                        const sCx = slotVBox.cx;
                        const sCy = slotVBox.cy;
                        let curbX = pointer.curbX != null ? pointer.curbX : sCx;
                        let curbY = pointer.curbY != null ? pointer.curbY : sCy;
                        let laneMidX = curbX;
                        let laneMidY = curbY;

                        if (isHoriz) {
                          curbX = Math.max(laneVBox.left + 8, Math.min(laneVBox.right - 8, curbX));
                          curbY = sCy < laneVBox.cy ? laneVBox.top : laneVBox.bottom;
                          laneMidX = curbX;
                          laneMidY = laneVBox.cy;
                        } else {
                          curbY = Math.max(laneVBox.top + 8, Math.min(laneVBox.bottom - 8, curbY));
                          curbX = sCx < laneVBox.cx ? laneVBox.left : laneVBox.right;
                          laneMidX = laneVBox.cx;
                          laneMidY = curbY;
                        }

                        return (
                          <g key={`nav-pointer-connected-${pointer.id}`} className="animate-pulse">
                            {/* Roadway Centerline Navigation Route */}
                            <line
                              x1={laneMidX}
                              y1={laneMidY}
                              x2={curbX}
                              y2={curbY}
                              stroke="#06b6d4"
                              strokeWidth={3}
                              strokeDasharray="4 3"
                            />
                            {/* Curb Access to Slot Entry Bay Pathway */}
                            <line
                              x1={curbX}
                              y1={curbY}
                              x2={slotCx}
                              y2={slotCy}
                              stroke="#10b981"
                              strokeWidth={2.5}
                              strokeDasharray="3 2"
                            />
                            {/* Waypoint Anchor on Road Centerline */}
                            <circle cx={laneMidX} cy={laneMidY} r={6} fill="#06b6d4" stroke="#083344" strokeWidth={2} />

                            {/* Curb Transition Dock Waypoint (Draggable to re-route) */}
                            {isEdit ? (
                              <g
                                className="cursor-grab active:cursor-grabbing group/curbpin"
                                transform={`translate(${curbX}, ${curbY})`}
                                onPointerDown={(e) => handleNavPointerDragStart(e, selectedElement.elementId, pointer.id)}
                              >
                                <title>Drag this navigation waypoint to reconnect to another lane</title>
                                <circle r={12} fill="rgba(6, 182, 212, 0.25)" stroke="#06b6d4" strokeWidth={1.5} className="animate-pulse" />
                                <circle r={6.5} fill="#10b981" stroke="#064e3b" strokeWidth={2} />
                                <text x={0} y={3} fill="#ffffff" fontSize={8} fontWeight="black" textAnchor="middle">➤</text>
                              </g>
                            ) : (
                              <circle cx={curbX} cy={curbY} r={4.5} fill="#10b981" stroke="#064e3b" strokeWidth={1.5} />
                            )}

                            {/* Navigation Guidance Badge with Disconnect (✕) Button */}
                            <g transform={`translate(${(laneMidX + slotCx) / 2}, ${(laneMidY + slotCy) / 2 - 12})`}>
                              <rect x={-52} y={-9} width={104} height={18} rx={9} fill="#0f172af2" stroke="#06b6d4" strokeWidth={1.2} />
                              <text x={-6} y={3} fill="#22d3ee" fontSize={8} fontFamily="ui-monospace, monospace" fontWeight="black" textAnchor="middle">
                                ➤ NAV #{pIdx + 1}
                              </text>
                              {isEdit && (
                                <g
                                  className="cursor-pointer group/navx"
                                  transform="translate(38, 0)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDisconnectNavPointer(selectedElement.elementId, pointer.id);
                                  }}
                                >
                                  <title>Disconnect from this road</title>
                                  <circle r={6} fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" strokeWidth={1} />
                                  <text x={0} y={2.5} fill="#fca5a5" fontSize={7} fontWeight="bold" textAnchor="middle">✕</text>
                                </g>
                              )}
                            </g>
                          </g>
                        );
                      }

                      // B. UNCONNECTED POINTER: Render distinct glowing pointer pin for user to connect manually
                      const { rx: mRx, ry: mRy } = rotateLocalPoint(
                        selectedElement.width / 2,
                        selectedElement.height + 18 + pIdx * 28,
                        selectedElement.width,
                        selectedElement.height,
                        selectedElement.rotation || 0,
                      );
                      const pointerX = selectedElement.x + mRx;
                      const pointerY = selectedElement.y + mRy;

                      return (
                        <g
                          key={`unconnected-pointer-${pointer.id}`}
                          className="cursor-grab active:cursor-grabbing group/navpointer"
                          transform={`translate(${pointerX}, ${pointerY})`}
                          onPointerDown={(e) => handleNavPointerDragStart(e, selectedElement.elementId, pointer.id)}
                        >
                          <title>Click and drag this navigation pointer to a driving lane to link navigation</title>
                          {/* Pulsing beacon */}
                          <circle r={18} fill="rgba(6, 182, 212, 0.2)" stroke="#06b6d4" strokeWidth={1.5} className="animate-ping opacity-60" />
                          <circle r={14} fill="#0f172a" stroke="#22d3ee" strokeWidth={2.5} className="drop-shadow-lg" />
                          <text x={0} y={4} fill="#38bdf8" fontSize={11} fontWeight="black" textAnchor="middle">➤</text>
                          {/* Floating Pill Label */}
                          <g transform="translate(0, 20)">
                            <rect x={-52} y={-8} width={104} height={16} rx={8} fill="#082f49" stroke="#38bdf8" strokeWidth={1} />
                            <text x={0} y={3} fill="#7dd3fc" fontSize={7.5} fontWeight="bold" textAnchor="middle">
                              NAV #{pIdx + 1}: DRAG TO LANE
                            </text>
                          </g>
                          {/* Delete pointer button if > 1 pointer */}
                          {isEdit && navPointers.length > 1 && (
                            <g
                              className="cursor-pointer"
                              transform="translate(14, -14)"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNavPointer(selectedElement.elementId, pointer.id);
                              }}
                            >
                              <title>Remove this navigation pointer</title>
                              <circle r={6} fill="#ef4444" stroke="#dc2626" strokeWidth={1} />
                              <text x={0} y={2.5} fill="#ffffff" fontSize={7} fontWeight="bold" textAnchor="middle">✕</text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

              {/* Case 2: Driving Lane is selected, show access points for all serviced parking slots */}
              {selectedElement.elementType === 'DrivingLane' &&
                elements
                  .filter((el) => {
                    if (el.elementType !== 'ParkingSlot') return false;
                    return (
                      el.connectedLaneIds?.includes(selectedElement.elementId) ||
                      el.navPointers?.some((p) => p.targetLaneId === selectedElement.elementId)
                    );
                  })
                  .map((slot) => {
                    const lane = selectedElement;
                    const slotVBox = getVisualBoundingBox(slot);
                    const slotCx = slotVBox.cx;
                    const slotCy = slotVBox.cy;
                    const isHoriz = isElementVisuallyHorizontal(lane);
                    const laneVBox = getVisualBoundingBox(lane);

                    let curbX = slotCx;
                    let curbY = slotCy;

                    if (isHoriz) {
                      curbX = Math.max(laneVBox.left + 8, Math.min(laneVBox.right - 8, slotCx));
                      curbY = slotCy < laneVBox.cy ? laneVBox.top : laneVBox.bottom;
                    } else {
                      curbY = Math.max(laneVBox.top + 8, Math.min(laneVBox.bottom - 8, slotCy));
                      curbX = slotCx < laneVBox.cx ? laneVBox.left : laneVBox.right;
                    }

                    return (
                      <g key={`lane-serviced-slot-${slot.elementId}`} opacity={0.85}>
                        <line
                          x1={curbX}
                          y1={curbY}
                          x2={slotCx}
                          y2={slotCy}
                          stroke="#10b981"
                          strokeWidth={2}
                          strokeDasharray="3 3"
                        />
                        <circle cx={curbX} cy={curbY} r={3.5} fill="#10b981" stroke="#064e3b" strokeWidth={1} />
                      </g>
                    );
                  })}
            </g>
          )}

          {/* Active Navigation Pointer Dragging Guide (Elastic line and lane reticle) */}
          {draggingNavPointer && (() => {
            const slot = elements.find((el) => el.elementId === draggingNavPointer.slotElementId);
            if (!slot) return null;
            const sCx = slot.x + slot.width / 2;
            const sCy = slot.y + slot.height / 2;
            const curX = draggingNavPointer.currentX;
            const curY = draggingNavPointer.currentY;
            const hoveredLane = elements.find((el) => el.elementId === draggingNavPointer.hoveredLaneId);

            return (
              <g pointerEvents="none" className="select-none">
                {/* Live connecting guide line */}
                <line
                  x1={sCx}
                  y1={sCy}
                  x2={curX}
                  y2={curY}
                  stroke="#06b6d4"
                  strokeWidth={3}
                  strokeDasharray="6 4"
                />
                {/* Slot origin anchor */}
                <circle cx={sCx} cy={sCy} r={6} fill="#06b6d4" stroke="#ffffff" strokeWidth={2} />
                {/* Cursor reticle */}
                <g transform={`translate(${curX}, ${curY})`}>
                  <circle r={22} fill="rgba(6, 182, 212, 0.25)" stroke="#22d3ee" strokeWidth={2} className="animate-pulse" />
                  <circle r={10} fill="#06b6d4" stroke="#ffffff" strokeWidth={2} />
                  <text x={0} y={3.5} fill="#ffffff" fontSize={8} fontWeight="black" textAnchor="middle">➤</text>
                  <g transform="translate(0, -30)">
                    <rect x={-65} y={-10} width={130} height={20} rx={10} fill="#0f172af0" stroke="#06b6d4" strokeWidth={1.5} />
                    <text x={0} y={3} fill="#22d3ee" fontSize={8.5} fontWeight="bold" textAnchor="middle">
                      {hoveredLane ? `✦ LINK TO ${hoveredLane.label || 'LANE'}` : 'DRAG ONTO DRIVING LANE'}
                    </text>
                  </g>
                </g>
                {/* Hovered Lane Highlight */}
                {hoveredLane && (() => {
                  const hVBox = getVisualBoundingBox(hoveredLane);
                  return (
                    <rect
                      x={hVBox.left - 4}
                      y={hVBox.top - 4}
                      width={hVBox.width + 8}
                      height={hVBox.height + 8}
                      rx={6}
                      fill="rgba(6, 182, 212, 0.15)"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      strokeDasharray="8 4"
                      className="animate-pulse"
                    />
                  );
                })()}
              </g>
            );
          })()}

          {/* Smart Guides: Alignment Lines & Spacing Badges */}
          {laneSnapGuide?.smartGuide?.alignLines?.map((line, idx) => (
            <g key={`smart-align-${idx}`} pointerEvents="none" className="animate-pulse">
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#c084fc"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              <circle cx={line.x1} cy={line.y1} r={3.5} fill="#a855f7" stroke="#ffffff" strokeWidth={1} />
              <circle cx={line.x2} cy={line.y2} r={3.5} fill="#a855f7" stroke="#ffffff" strokeWidth={1} />
            </g>
          ))}

          {/* Smart Guides: Equal Spacing Dimension Pills */}
          {laneSnapGuide?.smartGuide?.spacingPills?.map((pill, idx) => (
            <g key={`smart-pill-${idx}`} transform={`translate(${pill.x}, ${pill.y})`} pointerEvents="none">
              <rect
                x={-32}
                y={-11}
                width={64}
                height={22}
                rx={11}
                fill="#3b0764f0"
                stroke="#d8b4fe"
                strokeWidth={1.5}
                className="drop-shadow-md"
              />
              <text
                textAnchor="middle"
                y={4}
                fill="#f5d0fe"
                fontSize={10}
                fontWeight="black"
                fontFamily="ui-monospace, monospace"
              >
                ↔ {pill.text}
              </text>
            </g>
          ))}

          {/* Train-Track Magnetic Snap Lock Indicator & Smart Slot Assister Badge */}
          {laneSnapGuide && (() => {
            const isAssister = laneSnapGuide.isSlotAssister;
            const primaryColor = isAssister ? '#c084fc' : '#10b981';
            const ringFill = isAssister ? 'rgba(168, 85, 247, 0.25)' : 'rgba(16, 185, 129, 0.25)';
            const badgeBg = isAssister ? '#3b0764' : '#064e3b';
            const badgeBorder = isAssister ? '#d8b4fe' : '#34d399';
            const badgeText = isAssister ? '#fdf4ff' : '#ecfdf5';

            return (
              <g
                transform={`translate(${laneSnapGuide.x}, ${laneSnapGuide.y})`}
                pointerEvents="none"
                className="animate-pulse"
              >
                <circle
                  r={22}
                  fill={ringFill}
                  stroke={primaryColor}
                  strokeWidth={2.5}
                  strokeDasharray="4 3"
                />
                <circle r={7} fill={primaryColor} stroke="#ffffff" strokeWidth={2} />
                <g transform="translate(0, -26)">
                  <rect
                    x={-75}
                    y={-12}
                    width={150}
                    height={24}
                    rx={12}
                    fill={badgeBg}
                    stroke={badgeBorder}
                    strokeWidth={1.5}
                    className="drop-shadow-lg"
                  />
                  <text
                    textAnchor="middle"
                    y={4}
                    fill={badgeText}
                    fontSize={9.5}
                    fontWeight="bold"
                    fontFamily="ui-monospace, monospace"
                  >
                    {laneSnapGuide.label || '⚓ TRACK COUPLED'}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* ============================================================== */}
          {/* DISTANCE SCALER: POINT 1 & POINT 2 MEASUREMENT OVERLAY         */}
          {/* ============================================================== */}
          {/* Point 1 Marker */}
          {measureElemA && (
            <g pointerEvents="none" className="animate-pulse">
              <rect
                x={measureElemA.x - 4}
                y={measureElemA.y - 4}
                width={measureElemA.width + 8}
                height={measureElemA.height + 8}
                rx={6}
                fill="rgba(245, 158, 11, 0.12)"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="6 3"
              />
              <circle
                cx={measureElemA.x + measureElemA.width / 2}
                cy={measureElemA.y + measureElemA.height / 2}
                r={7}
                fill="#f59e0b"
                stroke="#0f172a"
                strokeWidth={2}
              />
              <foreignObject
                x={measureElemA.x + measureElemA.width / 2 - 60}
                y={measureElemA.y - 28}
                width={120}
                height={24}
              >
                <div className="w-full flex justify-center">
                  <span className="text-[10px] font-black tracking-wider bg-amber-950 text-amber-300 border border-amber-500/80 px-2 py-0.5 rounded shadow-lg uppercase select-none">
                    📍 POINT 1
                  </span>
                </div>
              </foreignObject>
            </g>
          )}

          {/* Point 2 Marker */}
          {measureElemB && (
            <g pointerEvents="none" className="animate-pulse">
              <rect
                x={measureElemB.x - 4}
                y={measureElemB.y - 4}
                width={measureElemB.width + 8}
                height={measureElemB.height + 8}
                rx={6}
                fill="rgba(16, 185, 129, 0.12)"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="6 3"
              />
              <circle
                cx={measureElemB.x + measureElemB.width / 2}
                cy={measureElemB.y + measureElemB.height / 2}
                r={7}
                fill="#10b981"
                stroke="#0f172a"
                strokeWidth={2}
              />
              <foreignObject
                x={measureElemB.x + measureElemB.width / 2 - 60}
                y={measureElemB.y - 28}
                width={120}
                height={24}
              >
                <div className="w-full flex justify-center">
                  <span className="text-[10px] font-black tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-500/80 px-2 py-0.5 rounded shadow-lg uppercase select-none">
                    📍 POINT 2
                  </span>
                </div>
              </foreignObject>
            </g>
          )}

          {/* CAD Dimension Line & Floating Midpoint Distance Badge */}
          {measureData && (
            <g id="distance-scaler-overlay" pointerEvents="none">
              {/* Background Shadow line */}
              <line
                x1={measureData.cAx}
                y1={measureData.cAy}
                x2={measureData.cBx}
                y2={measureData.cBy}
                stroke="#020617"
                strokeWidth={5}
                opacity={0.8}
              />
              {/* Main Golden Dimension Line */}
              <line
                x1={measureData.cAx}
                y1={measureData.cAy}
                x2={measureData.cBx}
                y2={measureData.cBy}
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
              {/* Point 1 Perpendicular End Tick */}
              <line
                x1={measureData.cAx - measureData.perpX}
                y1={measureData.cAy - measureData.perpY}
                x2={measureData.cAx + measureData.perpX}
                y2={measureData.cAy + measureData.perpY}
                stroke="#f59e0b"
                strokeWidth={3}
              />
              {/* Point 2 Perpendicular End Tick */}
              <line
                x1={measureData.cBx - measureData.perpX}
                y1={measureData.cBy - measureData.perpY}
                x2={measureData.cBx + measureData.perpX}
                y2={measureData.cBy + measureData.perpY}
                stroke="#10b981"
                strokeWidth={3}
              />

              {/* Target Indicator Rings */}
              <circle cx={measureData.cAx} cy={measureData.cAy} r={14} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.6} />
              <circle cx={measureData.cBx} cy={measureData.cBy} r={14} fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.6} />

              {/* Floating Midpoint Callout Badge */}
              <foreignObject
                x={measureData.midX - 110}
                y={measureData.midY - 36}
                width={220}
                height={72}
              >
                <div className="w-full flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/95 border-2 border-amber-400 shadow-2xl text-center select-none backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <span>📏 {Math.round(measureData.centerDist)} px</span>
                    <span className="text-[10px] text-amber-200/90 font-mono">({measureData.centerMeters}m)</span>
                  </div>
                  {measureData.edgeClearance > 0 ? (
                    <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span>Clearance: {Math.round(measureData.edgeClearance)} px ({measureData.clearanceMeters}m)</span>
                    </div>
                  ) : (
                    <div className="text-[9px] font-bold text-cyan-400 uppercase">
                      Adjacent / Overlapping
                    </div>
                  )}
                  <div className="text-[9px] text-slate-400 font-mono">
                    ΔX: {Math.round(measureData.dx)}px • ΔY: {Math.round(measureData.dy)}px
                  </div>
                </div>
              </foreignObject>
            </g>
          )}
        </g>
      </svg>

      {/* Top Center: Distance Scaler Floating Interactive Banner */}
      {activeTool === 'measure' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 bg-slate-900/95 border border-amber-500/70 shadow-2xl rounded-full text-xs text-foreground backdrop-blur-md animate-in fade-in duration-200">
          <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 font-bold">
            <Scaling className="h-3.5 w-3.5" />
          </div>

          {!measureElemA ? (
            <span className="text-amber-200 font-medium">
              Click any <strong>first prop</strong> on canvas to measure distance
            </span>
          ) : !measureElemB ? (
            <span className="text-amber-200 font-medium">
              Point 1: <strong className="text-amber-400">{measureElemA.label || measureElemA.elementType}</strong>. Now click the <strong>second prop</strong>!
            </span>
          ) : (
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-300">
                Distance: <strong className="text-amber-400 text-sm font-bold">{Math.round(measureData?.centerDist || 0)} px</strong> ({measureData?.centerMeters}m)
              </span>
              {measureData && measureData.edgeClearance > 0 && (
                <span className="text-slate-400 border-l border-slate-700 pl-2">
                  Clearance: <strong className="text-emerald-400">{Math.round(measureData.edgeClearance)} px</strong> ({measureData.clearanceMeters}m)
                </span>
              )}
            </div>
          )}

          {measureElemA && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMeasureFirstElemId(null);
                setMeasureSecondElemId(null);
              }}
              className="h-6 px-2 text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 rounded-full cursor-pointer ml-1"
              title="Reset measurement points"
            >
              Reset
            </Button>
          )}

          {onToolChange && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToolChange('select')}
              className="h-6 px-2.5 text-[10px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/50 rounded-full cursor-pointer ml-1"
              title="Exit Distance Scaler mode"
            >
              Done
            </Button>
          )}
        </div>
      )}

      {/* Floating Canvas Top-Right Quick View HUD */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg shadow-lg">
        {onFitToScreen && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFitToScreen}
            className="h-7 px-2 text-[11px] font-medium text-slate-200 hover:text-white hover:bg-slate-800 gap-1"
            title="Auto-Fit Entire Canvas to Screen"
          >
            <Expand className="h-3 w-3 text-primary" />
            <span>Fit Screen</span>
          </Button>
        )}

        {onResetView && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetView}
            className="h-7 px-2 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-800"
            title="Reset to 100% Zoom"
          >
            100%
          </Button>
        )}

        {onToggleFullscreen && (
          <Button
            type="button"
            variant={isFullscreen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleFullscreen}
            className={`h-7 px-2.5 text-[11px] font-semibold gap-1.5 ${
              isFullscreen
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-slate-200 hover:text-white hover:bg-slate-800'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Pop Up Full Screen Canvas'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5 text-blue-400" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}</span>
          </Button>
        )}

        <div className="hidden sm:flex items-center border-l border-slate-700/60 pl-2 pr-1 text-[10px] font-mono text-slate-400">
          {canvasConfig.width} × {canvasConfig.height}px
        </div>
      </div>
    </div>
  );
};
