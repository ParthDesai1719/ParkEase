import React, { useState, useMemo } from 'react';
import type { UnplacedSlotItem, PropDimensionDefaults } from './types';
import { DEFAULT_PROP_DIMENSIONS } from './types';
import type { LayoutElementData } from '@/api/parkingLot.api';
import { getZoneTheme } from './CanvasViewport';
import { setActiveDragElement } from './dragState';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Car,
  Search,
  Plus,
  Compass,
  ArrowRight,
  ShieldAlert,
  Lock,
  Square,
  Columns,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  LogIn,
  LogOut,
  Sparkles,
  Footprints,
  ChevronsUpDown,
  Layers,
  Building2,
} from 'lucide-react';

interface ElementsPaletteProps {
  unplacedSlots: UnplacedSlotItem[];
  totalSlotsCount: number;
  placedSlotsCount: number;
  onAddElement: (elementType: string, extraData?: any) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  zones?: Array<{ _id: string; zoneName: string; zoneCode: string }>;
  placedElements?: LayoutElementData[];
  showZoneHighlights?: boolean;
  onToggleZoneHighlights?: () => void;
  selectedZoneFilter?: string | null;
  onSelectZoneFilter?: (zone: string | null) => void;
  propDefaults?: PropDimensionDefaults;
}

export const ElementsPalette: React.FC<ElementsPaletteProps> = ({
  unplacedSlots,
  totalSlotsCount,
  placedSlotsCount,
  onAddElement,
  isCollapsed,
  onToggleCollapse,
  zones = [],
  placedElements = [],
  showZoneHighlights = true,
  onToggleZoneHighlights,
  selectedZoneFilter = null,
  onSelectZoneFilter,
  propDefaults = DEFAULT_PROP_DIMENSIONS,
}) => {
  const [activeTab, setActiveTab] = useState<'slots' | 'elements'>('slots');
  const [slotSearch, setSlotSearch] = useState('');

  // Discover all unique zone codes across configured zones, placed elements, and unplaced slots
  const availableZoneCodes = useMemo(() => {
    const codes = new Set<string>();
    if (zones) {
      for (const z of zones) {
        if (z.zoneCode) codes.add(z.zoneCode.toUpperCase());
      }
    }
    if (placedElements) {
      for (const el of placedElements) {
        if (el.elementType === 'ParkingSlot' && el.zoneCode) {
          codes.add(el.zoneCode.toUpperCase());
        }
      }
    }
    if (unplacedSlots) {
      for (const slot of unplacedSlots) {
        const matched = zones?.find((z) => z._id === (typeof slot.zoneId === 'object' ? (slot.zoneId as any)?._id : slot.zoneId));
        const code = (typeof slot.zoneId === 'object' && slot.zoneId ? (slot.zoneId as any).zoneCode : matched?.zoneCode) || slot.slotNumber?.match(/^([A-Za-z]+)/)?.[1];
        if (code) codes.add(code.toUpperCase());
      }
    }
    return Array.from(codes).sort();
  }, [zones, placedElements, unplacedSlots]);

  const filteredUnplacedSlots = unplacedSlots.filter((slot) => {
    const term = slotSearch.toLowerCase();
    const matched = zones?.find((z) => z._id === (typeof slot.zoneId === 'object' ? (slot.zoneId as any)?._id : slot.zoneId));
    const zoneName = (typeof slot.zoneId === 'object' && slot.zoneId ? (slot.zoneId as any).zoneName : matched?.zoneName) || '';
    const zoneCode = (typeof slot.zoneId === 'object' && slot.zoneId ? (slot.zoneId as any).zoneCode : matched?.zoneCode) || slot.slotNumber?.match(/^([A-Za-z]+)/)?.[1] || '';
    return (
      slot.slotNumber.toLowerCase().includes(term) ||
      slot.slotLabel.toLowerCase().includes(term) ||
      zoneName.toLowerCase().includes(term) ||
      zoneCode.toLowerCase().includes(term)
    );
  });

  const handleDragStart = (e: React.DragEvent, elementType: string, extraData?: any) => {
    setActiveDragElement({ elementType, extraData });
    const payload = JSON.stringify({
      elementType,
      extraData,
    });
    try {
      e.dataTransfer.setData('text/plain', payload);
    } catch (_) {}
    try {
      e.dataTransfer.setData('application/json', payload);
    } catch (_) {}
    try {
      e.dataTransfer.setData('text', payload);
    } catch (_) {}
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    // Retain state briefly so drop handler gets first chance to consume
    setTimeout(() => {
      setActiveDragElement(null);
    }, 200);
  };

  if (isCollapsed) {
    return (
      <aside className="h-full max-h-full w-12 border-r border-border/80 bg-card/95 flex flex-col items-center py-3 gap-3 shrink-0 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onToggleCollapse}
          title="Expand Element Palette"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-6 border-b border-border/60" />
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground -rotate-90 my-12 whitespace-nowrap cursor-pointer select-none"
          onClick={onToggleCollapse}
        >
          Toolbox & Slots
        </span>
      </aside>
    );
  }

  return (
    <aside className="h-full max-h-full w-72 sm:w-80 border-r border-border/80 bg-card/95 backdrop-blur-md flex flex-col shrink-0 text-foreground overflow-hidden z-20 select-none">
      {/* 1. Header with Collapse Toggle */}
      <div className="p-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Layout Toolbox
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
            {placedSlotsCount}/{totalSlotsCount} Placed
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onToggleCollapse}
          title="Collapse Panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* 2. Zone Highlighters Control Center */}
      <div className="p-2.5 mx-2.5 my-2 rounded-lg bg-muted/20 border border-border/70 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold tracking-wide text-foreground">
              Zone Highlighters
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleZoneHighlights}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase transition-colors border',
              showZoneHighlights
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted/60',
            )}
            title="Toggle visual territory highlights and radiant slot boundaries on canvas"
          >
            {showZoneHighlights ? 'ON' : 'OFF'}
          </button>
        </div>

        {showZoneHighlights && (
          <div className="pt-1.5 border-t border-border/40 space-y-1.5">
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Filter territory on canvas:</span>
              {selectedZoneFilter && (
                <button
                  type="button"
                  onClick={() => onSelectZoneFilter?.(null)}
                  className="text-[10px] text-primary hover:underline font-mono"
                >
                  Clear Filter
                </button>
              )}
            </div>

            {availableZoneCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-0.5 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => onSelectZoneFilter?.(null)}
                  className={cn(
                    'px-2 py-1 rounded text-[10px] font-semibold transition-all border flex items-center gap-1',
                    !selectedZoneFilter || selectedZoneFilter === 'ALL'
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                      : 'bg-muted/30 text-muted-foreground border-border/40 hover:border-border hover:text-foreground',
                  )}
                >
                  <span>All Zones</span>
                  <span className="text-[9px] opacity-80 font-mono">
                    ({(placedElements || []).filter((el) => el.elementType === 'ParkingSlot').length})
                  </span>
                </button>

                {availableZoneCodes.map((code) => {
                  const theme = getZoneTheme(code);
                  const count = (placedElements || []).filter(
                    (el) => el.elementType === 'ParkingSlot' && (el.zoneCode || '').toUpperCase() === code,
                  ).length;
                  const isSelected = selectedZoneFilter === code;

                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onSelectZoneFilter?.(isSelected ? null : code)}
                      className={cn(
                        'px-2 py-1 rounded text-[10px] font-semibold transition-all border flex items-center gap-1.5',
                        isSelected
                          ? `${theme.badgeBg} ${theme.badgeText} border-current shadow-xs font-bold ring-1 ring-current`
                          : 'bg-muted/20 text-muted-foreground border-border/40 hover:border-border hover:text-foreground',
                      )}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: theme.color }}
                      />
                      <span>Zone {code}</span>
                      <span className="text-[9px] opacity-75 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                No zones detected on this floor.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Tabs: Official Slots vs Physical Structures */}
      <div className="grid grid-cols-2 p-1.5 bg-muted/30 border-b border-border/60 gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('slots')}
          className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'slots'
              ? 'bg-card text-primary shadow-xs border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Car className="h-3.5 w-3.5" />
          <span>Slots ({unplacedSlots.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('elements')}
          className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'elements'
              ? 'bg-card text-primary shadow-xs border border-border/60'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Physical Tools</span>
        </button>
      </div>

      {/* 3. Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* TAB 1: UNPLACED OFFICIAL SLOTS */}
        {activeTab === 'slots' && (
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <Input
                value={slotSearch}
                onChange={(e) => setSlotSearch(e.target.value)}
                placeholder="Search unplaced slots..."
                className="pl-8 h-8 text-xs bg-muted/20 border-border/60"
              />
            </div>

            <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
              <span>Drag onto canvas or click "+ Place"</span>
              <span className="font-mono">{filteredUnplacedSlots.length} available</span>
            </div>

            {/* Unplaced Slot Cards */}
            {filteredUnplacedSlots.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-dashed border-border/60 bg-muted/10 space-y-1">
                <Car className="h-6 w-6 text-muted-foreground mx-auto opacity-50" />
                <p className="text-xs font-semibold text-foreground">
                  {unplacedSlots.length === 0
                    ? 'All Floor Slots Placed! ✓'
                    : 'No matching slots found'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {unplacedSlots.length === 0
                    ? 'Every official slot for this floor is placed on the canvas.'
                    : 'Try another search term.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUnplacedSlots.map((slot) => {
                  const matched = zones?.find((z) => z._id === (typeof slot.zoneId === 'object' ? (slot.zoneId as any)?._id : slot.zoneId));
                  const zoneCode =
                    (typeof slot.zoneId === 'object' && slot.zoneId ? (slot.zoneId as any).zoneCode : matched?.zoneCode) ||
                    slot.slotNumber?.match(/^([A-Za-z]+)/)?.[1] ||
                    'A';
                  const zoneName =
                    (typeof slot.zoneId === 'object' && slot.zoneId ? (slot.zoneId as any).zoneName : matched?.zoneName) ||
                    `Zone ${zoneCode}`;

                  return (
                    <div
                      key={slot._id}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, 'ParkingSlot', {
                          slotId: slot._id,
                          slotNumber: slot.slotNumber,
                          zoneCode,
                          zoneName,
                          zoneId: typeof slot.zoneId === 'object' ? (slot.zoneId as any)._id : slot.zoneId,
                          width: propDefaults.parkingSlot.width,
                          height: propDefaults.parkingSlot.height,
                        })
                      }
                      onDragEnd={handleDragEnd}
                      className="group p-2 rounded-lg border border-border/60 bg-card hover:border-primary/50 hover:bg-muted/30 transition-all flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0 group-hover:text-primary transition-colors" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-foreground">
                              {slot.slotNumber}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 h-3.5 font-mono font-semibold"
                            >
                              {zoneCode}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {zoneName} &bull; {slot.slotType}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10 gap-1 cursor-pointer shrink-0"
                        onClick={() =>
                          onAddElement('ParkingSlot', {
                            slotId: slot._id,
                            slotNumber: slot.slotNumber,
                            zoneCode,
                            zoneName,
                            zoneId: typeof slot.zoneId === 'object' ? (slot.zoneId as any)._id : slot.zoneId,
                            width: propDefaults.parkingSlot.width,
                            height: propDefaults.parkingSlot.height,
                          })
                        }
                        title="Add to canvas"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Place</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PHYSICAL STRUCTURAL TOOLS */}
        {activeTab === 'elements' && (
          <div className="space-y-4">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Drag physical elements to define floor geometry and navigation:
            </span>

            {/* 1. Driving Lanes */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Traffic & Driving Lanes
              </span>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'DrivingLane', {
                    laneDirection: 'Two-Way',
                    width: propDefaults.straightLane.width,
                    height: propDefaults.straightLane.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('DrivingLane', {
                    laneDirection: 'Two-Way',
                    width: propDefaults.straightLane.width,
                    height: propDefaults.straightLane.height,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-yellow-400 font-bold text-xs">
                    ⇄
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-200">Two-Way Lane</h5>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                        {propDefaults.straightLane.width}×{propDefaults.straightLane.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Bidirectional vehicle movement</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'DrivingLane', {
                    laneDirection: 'One-Way-Forward',
                    width: propDefaults.straightLane.width,
                    height: propDefaults.straightLane.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('DrivingLane', {
                    laneDirection: 'One-Way-Forward',
                    width: propDefaults.straightLane.width,
                    height: propDefaults.straightLane.height,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-yellow-400 font-bold text-xs">
                    →
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-200">One-Way Lane</h5>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                        {propDefaults.straightLane.width}×{propDefaults.straightLane.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Single direction traffic flow</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              {/* 90° Corner / Turn Connector */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'DrivingLane', {
                    laneDirection: 'Two-Way',
                    label: 'Corner Turn',
                    width: propDefaults.cornerTurn.width,
                    height: propDefaults.cornerTurn.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('DrivingLane', {
                    laneDirection: 'Two-Way',
                    label: 'Corner Turn',
                    width: propDefaults.cornerTurn.width,
                    height: propDefaults.cornerTurn.height,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-yellow-400 font-bold text-xs">
                    ↰
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-200">Lane Turn / Corner</h5>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                        {propDefaults.cornerTurn.width}×{propDefaults.cornerTurn.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">90° corner junction connector</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              {/* T-Junction 3-Way Intersection */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'DrivingLane', {
                    laneDirection: 'Two-Way',
                    label: 'T-Junction',
                    width: propDefaults.tJunction.width,
                    height: propDefaults.tJunction.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('DrivingLane', {
                    laneDirection: 'Two-Way',
                    label: 'T-Junction',
                    width: propDefaults.tJunction.width,
                    height: propDefaults.tJunction.height,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-blue-500/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-yellow-400 font-bold text-xs">
                    ┳
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-200">T-Junction Intersection</h5>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                        {propDefaults.tJunction.width}×{propDefaults.tJunction.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">3-way road intersection connector</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              {/* Universal 4-Way Square Connector (Hub) */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'DrivingLane', {
                    laneDirection: 'Two-Way',
                    label: 'Square Connector',
                    width: propDefaults.squareConnector.width,
                    height: propDefaults.squareConnector.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('DrivingLane', {
                    laneDirection: 'Two-Way',
                    label: 'Square Connector',
                    width: propDefaults.squareConnector.width,
                    height: propDefaults.squareConnector.height,
                  })
                }
                className="p-2.5 rounded-lg border border-cyan-500/40 bg-slate-900 hover:border-cyan-400 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-cyan-950/60 flex items-center justify-center border border-cyan-500/60 text-cyan-300 font-black text-sm">
                    ✛
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-100">Square Connector</h5>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                        {propDefaults.squareConnector.width}×{propDefaults.squareConnector.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Connects all 4 sides & auto-sorts route
                    </p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-cyan-400 group-hover:scale-125 transition-transform" />
              </div>
            </div>

            {/* 2. Gates */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Gates & Access Points
              </span>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Entrance', {
                    label: 'Entrance 1',
                    width: propDefaults.entranceGate.width,
                    height: propDefaults.entranceGate.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Entrance', {
                    label: 'Entrance 1',
                    width: propDefaults.entranceGate.width,
                    height: propDefaults.entranceGate.height,
                  })
                }
                className="p-2.5 rounded-lg border border-emerald-900/60 bg-emerald-950/40 hover:border-emerald-500 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-emerald-900/80 flex items-center justify-center text-emerald-400">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-200">Entrance Gate</h5>
                    <p className="text-[10px] text-emerald-400/80">Vehicle entry checkpoint</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-emerald-400 group-hover:text-emerald-300" />
              </div>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Exit', {
                    label: 'Exit 1',
                    width: propDefaults.exitGate.width,
                    height: propDefaults.exitGate.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Exit', {
                    label: 'Exit 1',
                    width: propDefaults.exitGate.width,
                    height: propDefaults.exitGate.height,
                  })
                }
                className="p-2.5 rounded-lg border border-rose-900/60 bg-rose-950/40 hover:border-rose-500 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-rose-900/80 flex items-center justify-center text-rose-400">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-rose-200">Exit Gate</h5>
                    <p className="text-[10px] text-rose-400/80">Vehicle exit checkpoint</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-rose-400 group-hover:text-rose-300" />
              </div>
            </div>

            {/* Level Connectors: Ramps for Multi-Level Parking */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Level Connectors & Ramps
              </span>

              {/* Ramp Up to Upper Level */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Ramp', {
                    rampDirection: 'Up',
                    label: 'Ramp Up (To Upper Level)',
                    targetFloorName: 'To Upper Level',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Ramp', {
                    rampDirection: 'Up',
                    label: 'Ramp Up (To Upper Level)',
                    targetFloorName: 'To Upper Level',
                  })
                }
                className="p-2.5 rounded-lg border border-emerald-900/50 bg-emerald-950/30 hover:border-emerald-500 hover:bg-emerald-950/50 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-emerald-900/80 flex items-center justify-center text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-200">Ramp Up ▲</h5>
                    <p className="text-[10px] text-emerald-400/80">Ascending ramp to upper floor</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-emerald-400 group-hover:text-emerald-300" />
              </div>

              {/* Ramp Down to Lower Level */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Ramp', {
                    rampDirection: 'Down',
                    label: 'Ramp Down (To Lower Level)',
                    targetFloorName: 'To Lower Level',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Ramp', {
                    rampDirection: 'Down',
                    label: 'Ramp Down (To Lower Level)',
                    targetFloorName: 'To Lower Level',
                  })
                }
                className="p-2.5 rounded-lg border border-amber-900/50 bg-amber-950/30 hover:border-amber-500 hover:bg-amber-950/50 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-amber-900/80 flex items-center justify-center text-amber-400">
                    <TrendingUp className="h-4 w-4 rotate-180" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-amber-200">Ramp Down ▼</h5>
                    <p className="text-[10px] text-amber-400/80">Descending ramp to lower floor</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-amber-400 group-hover:text-amber-300" />
              </div>

              {/* Two-Way Ramp */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Ramp', {
                    rampDirection: 'Two-Way',
                    label: 'Two-Way Ramp',
                    targetFloorName: 'Multi-Level Connector',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Ramp', {
                    rampDirection: 'Two-Way',
                    label: 'Two-Way Ramp',
                    targetFloorName: 'Multi-Level Connector',
                  })
                }
                className="p-2.5 rounded-lg border border-indigo-900/50 bg-indigo-950/30 hover:border-indigo-500 hover:bg-indigo-950/50 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-indigo-900/80 flex items-center justify-center text-indigo-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-indigo-200">Two-Way Ramp ⇅</h5>
                    <p className="text-[10px] text-indigo-400/80">Bidirectional level transition</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300" />
              </div>

              {/* Ramp Entry (Arrival into this floor) */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'RampPortal', {
                    portalType: 'Entry',
                    label: 'Ramp Arrival',
                    targetFloorName: 'Floor Entry',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('RampPortal', {
                    portalType: 'Entry',
                    label: 'Ramp Arrival',
                    targetFloorName: 'Floor Entry',
                  })
                }
                className="p-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/20 hover:border-emerald-500 hover:bg-emerald-950/40 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-emerald-900/60 flex items-center justify-center text-emerald-400">
                    <LogIn className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-200">Ramp Entry (Arrival)</h5>
                    <p className="text-[10px] text-emerald-400/80">Vehicle enters floor from ramp</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-emerald-400 group-hover:text-emerald-300" />
              </div>

              {/* Ramp Exit (Departure to ramp) */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'RampPortal', {
                    portalType: 'Exit',
                    label: 'Ramp Departure',
                    targetFloorName: 'Floor Exit',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('RampPortal', {
                    portalType: 'Exit',
                    label: 'Ramp Departure',
                    targetFloorName: 'Floor Exit',
                  })
                }
                className="p-2.5 rounded-lg border border-rose-900/40 bg-rose-950/20 hover:border-rose-500 hover:bg-rose-950/40 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-rose-900/60 flex items-center justify-center text-rose-400">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-rose-200">Ramp Exit (Departure)</h5>
                    <p className="text-[10px] text-rose-400/80">Vehicle leaves floor via ramp</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-rose-400 group-hover:text-rose-300" />
              </div>

              {/* Two-Way Ramp Portal */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'RampPortal', {
                    portalType: 'Two-Way',
                    label: 'Ramp Interchange',
                    targetFloorName: 'Two-Way Portal',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('RampPortal', {
                    portalType: 'Two-Way',
                    label: 'Ramp Interchange',
                    targetFloorName: 'Two-Way Portal',
                  })
                }
                className="p-2.5 rounded-lg border border-indigo-900/40 bg-indigo-950/20 hover:border-indigo-500 hover:bg-indigo-950/40 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-indigo-900/60 flex items-center justify-center text-indigo-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-indigo-200">Ramp Interchange ⇅</h5>
                    <p className="text-[10px] text-indigo-400/80">Both entry & exit on floor</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300" />
              </div>
            </div>

            {/* 3. Structural Obstacles */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Architectural Elements
              </span>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Pillar', {
                    label: 'Structural Column',
                    width: propDefaults.pillar.width,
                    height: propDefaults.pillar.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Pillar', {
                    label: 'Structural Column',
                    width: propDefaults.pillar.width,
                    height: propDefaults.pillar.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-primary/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center text-slate-300">
                    <Columns className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-200">Pillar / Column</h5>
                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-sky-950 border border-sky-500/40 text-sky-300 font-bold">
                        ALL FLOORS
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Load-bearing structural column (Synced All Floors)</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Wall', {
                    label: 'Wall',
                    width: propDefaults.wall.width,
                    height: propDefaults.wall.height,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Wall', {
                    label: 'Wall',
                    width: propDefaults.wall.width,
                    height: propDefaults.wall.height,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-primary/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center text-slate-300">
                    <Square className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">Boundary Wall</h5>
                    <p className="text-[10px] text-slate-400">Physical divider or partition</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>

            {/* 4. Restricted & Reserved Areas */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Zoning & Restrictions
              </span>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'RestrictedArea', {
                    restrictedReason: 'Maintenance / Transformer Room',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('RestrictedArea', {
                    restrictedReason: 'Maintenance / Transformer Room',
                  })
                }
                className="p-2.5 rounded-lg border border-amber-900/60 bg-amber-950/40 hover:border-amber-500 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-amber-900/80 flex items-center justify-center text-amber-400">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-amber-200">Restricted Area</h5>
                    <p className="text-[10px] text-amber-400/80">Non-parking danger zone</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-amber-400 group-hover:text-amber-300" />
              </div>

              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'ReservedArea', {
                    reservedFor: 'Emergency Services Only',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('ReservedArea', {
                    reservedFor: 'Emergency Services Only',
                  })
                }
                className="p-2.5 rounded-lg border border-blue-900/60 bg-blue-950/40 hover:border-blue-500 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-blue-900/80 flex items-center justify-center text-blue-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-blue-200">Reserved Area</h5>
                    <p className="text-[10px] text-blue-400/80">Special bays / emergency space</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-blue-400 group-hover:text-blue-300" />
              </div>
            </div>

            {/* 5. Vertical Circulation & Multi-Storey Shafts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Vertical Access (All Floors)
                </span>
                <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded border border-sky-500/20">
                  Multi-Storey
                </span>
              </div>

              {/* Combined Lift & Staircase Area */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'LiftStaircase', {
                    label: 'Lift & Staircase Core',
                    width: propDefaults.liftStaircase.width,
                    height: propDefaults.liftStaircase.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('LiftStaircase', {
                    label: 'Lift & Staircase Core',
                    width: propDefaults.liftStaircase.width,
                    height: propDefaults.liftStaircase.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                className="p-2.5 rounded-lg border border-sky-500/40 bg-slate-900 hover:border-sky-400 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-sky-950/70 flex items-center justify-center border border-sky-500/60 text-sky-300 font-bold text-xs">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-100">Lift & Staircase Area</h5>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                        {propDefaults.liftStaircase.width}×{propDefaults.liftStaircase.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Combined elevator & stairwell core</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-sky-400 group-hover:scale-125 transition-transform" />
              </div>

              {/* Elevator / Lift */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Lift', {
                    label: 'Elevator / Lift',
                    width: propDefaults.lift.width,
                    height: propDefaults.lift.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Lift', {
                    label: 'Elevator / Lift',
                    width: propDefaults.lift.width,
                    height: propDefaults.lift.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-sky-500/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-sky-400 font-bold text-xs">
                    <ChevronsUpDown className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-200">Elevator / Lift</h5>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                        {propDefaults.lift.width}×{propDefaults.lift.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Vertical passenger elevator shaft</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              {/* Staircase / Stairs */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'Staircase', {
                    label: 'Staircase',
                    width: propDefaults.staircase.width,
                    height: propDefaults.staircase.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('Staircase', {
                    label: 'Staircase',
                    width: propDefaults.staircase.width,
                    height: propDefaults.staircase.height,
                    occupiesAllFloors: true,
                    syncAcrossAllFloors: true,
                  })
                }
                className="p-2.5 rounded-lg border border-border/60 bg-slate-900 hover:border-amber-500/50 hover:bg-slate-800 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-slate-800 flex items-center justify-center border border-slate-700 text-amber-400 font-bold text-xs">
                    <Footprints className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-slate-200">Staircase / Stairs</h5>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                        {propDefaults.staircase.width}×{propDefaults.staircase.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Pedestrian stairwell & fire exit</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>

            {/* 6. Building & Complex Access (Mall, Hospital, Plaza) */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Building & Complex Access
              </span>

              {/* Complex Entrance */}
              <div
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, 'BuildingEntrance', {
                    label: 'Mall / Complex Entrance',
                    width: propDefaults.buildingEntrance.width,
                    height: propDefaults.buildingEntrance.height,
                    buildingType: 'Mall',
                  })
                }
                onDragEnd={handleDragEnd}
                onClick={() =>
                  onAddElement('BuildingEntrance', {
                    label: 'Mall / Complex Entrance',
                    width: propDefaults.buildingEntrance.width,
                    height: propDefaults.buildingEntrance.height,
                    buildingType: 'Mall',
                  })
                }
                className="p-2.5 rounded-lg border border-purple-500/40 bg-purple-950/20 hover:border-purple-400 hover:bg-purple-950/40 transition-all flex items-center justify-between cursor-grab active:cursor-grabbing group shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded bg-purple-900/60 flex items-center justify-center border border-purple-500/50 text-purple-300">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs font-bold text-purple-200">Complex Entrance</h5>
                      <span className="text-[9px] font-mono text-purple-300 bg-purple-900/60 px-1 py-0.2 rounded border border-purple-500/30">
                        {propDefaults.buildingEntrance.width}×{propDefaults.buildingEntrance.height}
                      </span>
                    </div>
                    <p className="text-[10px] text-purple-300/80">Direct portal to Mall, Hospital or Plaza</p>
                  </div>
                </div>
                <Plus className="h-4 w-4 text-purple-400 group-hover:scale-125 transition-transform" />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
