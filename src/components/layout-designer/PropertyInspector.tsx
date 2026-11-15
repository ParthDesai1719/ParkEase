import type { LayoutElementData, LayoutCanvasConfig } from '@/api/parkingLot.api';
import React, { useState, useEffect, useMemo } from 'react';
import type { LaneConnectionType, PropDimensionDefaults, DimensionPropKey } from './types';
import { DEFAULT_PROP_DIMENSIONS, mergePropDefaults } from './types';
import { findConnectedElements, getSlotNavPointers } from './CanvasViewport';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  RotateCw,
  Trash2,
  X,
  Sliders,
  Layers,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  RotateCcw,
  Save,
  Car,
  Shield,
  Maximize2,
  DoorOpen,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  ClipboardPaste,
  GitFork,
  Link2,
  Compass,
  Navigation,
  Plus,
  Sparkles,
  Building2,
  Footprints,
  Columns,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PropertyInspectorProps {
  selectedElement: LayoutElementData | null;
  onClose: () => void;
  onUpdateElement: (updated: Partial<LayoutElementData>) => void;
  onRotateElement: (elementId: string, customAngleOrDelta?: number, isDelta?: boolean) => void;
  onRemoveElement: (elementId: string) => void;
  onConnectLane?: (el: LayoutElementData, connectionType: LaneConnectionType) => void;
  floorStats: {
    floorName: string;
    floorNumber: number;
    totalSlots: number;
    placedSlots: number;
    unplacedSlots: number;
    entrancesCount: number;
    exitsCount: number;
    rampsCount?: number;
  };
  floors?: Array<{ _id: string; floorName: string; floorNumber: number }>;
  currentFloorId?: string;
  // Prop Defaults & Settings Pane
  propDefaults: PropDimensionDefaults;
  onSavePropDefaults: (newDefaults: PropDimensionDefaults, applyToExisting?: boolean) => void;
  activeInspectorTab?: 'properties' | 'settings';
  onInspectorTabChange?: (tab: 'properties' | 'settings') => void;
  onOpenExpandedModal?: () => void;
  placedElementsCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onDuplicateElement?: (elementId: string) => void;
  allElements?: LayoutElementData[];
  highlightedElementId?: string | null;
  onHighlightElement?: (id: string | null) => void;
  onSelectConnectedElement?: (el: LayoutElementData) => void;
  canvasConfig?: LayoutCanvasConfig;
  onUpdateCanvasConfig?: (cfg: Partial<LayoutCanvasConfig>) => void;
  canResizeCanvas?: boolean;
  lanesCount?: number;
  hasCopiedLanes?: boolean;
  copiedLanesCount?: number;
  copiedSourceFloorName?: string;
  onCopyLaneNetwork?: () => void;
  onPasteLaneNetwork?: () => void;
  onOpenReplicateLanesModal?: () => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedElement,
  onClose,
  onUpdateElement,
  onRotateElement,
  onRemoveElement,
  onConnectLane,
  floorStats,
  floors = [],
  currentFloorId = '',
  propDefaults,
  onSavePropDefaults,
  activeInspectorTab = 'properties',
  onInspectorTabChange,
  onOpenExpandedModal,
  placedElementsCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  onDuplicateElement,
  allElements = [],
  highlightedElementId = null,
  onHighlightElement,
  onSelectConnectedElement,
  canvasConfig,
  onUpdateCanvasConfig,
  canResizeCanvas = true,
  lanesCount = 0,
  hasCopiedLanes = false,
  copiedLanesCount = 0,
  copiedSourceFloorName = '',
  onCopyLaneNetwork,
  onPasteLaneNetwork,
  onOpenReplicateLanesModal,
}) => {
  const [settingsData, setSettingsData] = useState<PropDimensionDefaults>(() => mergePropDefaults(propDefaults));
  const [applyToExisting, setApplyToExisting] = useState<boolean>(false);

  const connectedProps = useMemo(() => {
    if (!selectedElement || !allElements.length) return [];
    return findConnectedElements(selectedElement, allElements);
  }, [selectedElement, allElements]);

  // Driving lanes available on this floor for navigation routing
  const drivingLanes = useMemo(() => {
    return (allElements || []).filter((el) => el.elementType === 'DrivingLane');
  }, [allElements]);

  // Add new Navigation Pointer to selected slot
  const handleAddSlotNavPointer = () => {
    if (!selectedElement) return;
    const currentPointers = getSlotNavPointers(selectedElement);
    const newPointer = {
      id: `nav-${Date.now().toString(36).slice(-4)}`,
      targetLaneId: null,
    };
    const updated = [...currentPointers, newPointer];
    onUpdateElement({
      navPointers: updated,
    });
    toast.success('Added new Navigation Pointer to parking slot');
  };

  // Connect or disconnect a Navigation Pointer to a Driving Lane
  const handleConnectNavPointer = (pointerId: string, laneId: string) => {
    if (!selectedElement) return;
    const currentPointers = getSlotNavPointers(selectedElement);
    const updated = currentPointers.map((p) =>
      p.id === pointerId ? { ...p, targetLaneId: laneId ? laneId : null, curbX: null, curbY: null } : p,
    );
    const updatedConnectedLaneIds = Array.from(
      new Set(updated.map((p) => p.targetLaneId).filter(Boolean)),
    ) as string[];
    onUpdateElement({
      navPointers: updated,
      connectedLaneIds: updatedConnectedLaneIds,
    });
    if (laneId) {
      toast.success('Connected Navigation Pointer to Lane');
    } else {
      toast.info('Disconnected Navigation Pointer');
    }
  };

  // Delete a Navigation Pointer (if more than 1)
  const handleDeleteSlotNavPointer = (pointerId: string) => {
    if (!selectedElement) return;
    const currentPointers = getSlotNavPointers(selectedElement);
    if (currentPointers.length <= 1) {
      toast.info('At least one navigation pointer must remain on the slot');
      return;
    }
    const updated = currentPointers.filter((p) => p.id !== pointerId);
    const updatedConnectedLaneIds = Array.from(
      new Set(updated.map((p) => p.targetLaneId).filter(Boolean)),
    ) as string[];
    onUpdateElement({
      navPointers: updated,
      connectedLaneIds: updatedConnectedLaneIds,
    });
    toast.info('Removed Navigation Pointer');
  };

  useEffect(() => {
    setSettingsData(mergePropDefaults(propDefaults));
  }, [propDefaults]);

  const handleUpdateSetting = (
    key: DimensionPropKey,
    field: 'width' | 'height',
    value: number,
  ) => {
    setSettingsData((prev) => {
      const merged = mergePropDefaults(prev);
      const current = merged[key] as { width: number; height: number };
      return {
        ...merged,
        [key]: {
          ...current,
          [field]: Math.max(10, Math.min(2000, value)),
        },
      };
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePropDefaults(settingsData, applyToExisting);
    toast.success('Default prop dimensions saved! Newly dragged items will use these sizes.');
  };

  const handleResetSettings = () => {
    setSettingsData(DEFAULT_PROP_DIMENSIONS);
    toast.info('Reset prop dimensions to factory defaults.');
  };

  // Sleek Collapsed Right Sidebar Rail
  if (isCollapsed && onToggleCollapse) {
    return (
      <aside className="w-12 h-full max-h-full border-l border-border/80 bg-card/95 backdrop-blur-md flex flex-col items-center py-3 gap-3 shrink-0 z-20 select-none">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onToggleCollapse}
          title="Expand Right Sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="w-6 border-b border-border/60" />

        {/* Quick Toggle: Overview / Element Properties */}
        <Button
          variant={activeInspectorTab === 'properties' ? 'secondary' : 'ghost'}
          size="icon"
          className={cn(
            'h-8 w-8 cursor-pointer transition-colors',
            selectedElement && 'text-primary bg-primary/15 border border-primary/40',
          )}
          onClick={() => {
            onInspectorTabChange?.('properties');
            onToggleCollapse();
          }}
          title={selectedElement ? `Selected: ${selectedElement.label || selectedElement.elementType}` : 'Floor Overview & Statistics'}
        >
          {selectedElement ? <Sliders className="h-4 w-4 text-primary" /> : <Layers className="h-4 w-4" />}
        </Button>

        {/* Quick Toggle: Prop Settings */}
        <Button
          variant={activeInspectorTab === 'settings' ? 'secondary' : 'ghost'}
          size="icon"
          className={cn(
            'h-8 w-8 cursor-pointer relative transition-colors',
            activeInspectorTab === 'settings'
              ? 'text-cyan-400 bg-cyan-950/50 border border-cyan-500/50'
              : 'text-muted-foreground hover:text-cyan-400',
          )}
          onClick={() => {
            onInspectorTabChange?.('settings');
            onToggleCollapse();
          }}
          title="Prop Defaults & Scale Settings"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </Button>

        <div className="w-6 border-b border-border/60" />

        {/* Rotated Sidebar Label */}
        <span
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground rotate-90 my-16 whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors"
          onClick={onToggleCollapse}
        >
          Overview & Settings
        </span>
      </aside>
    );
  }

  return (
    <aside className="w-72 sm:w-80 h-full max-h-full border-l border-border/80 bg-card/95 backdrop-blur-md flex flex-col shrink-0 text-foreground overflow-y-auto z-20 select-none">
      {/* 1. TOP TAB SWITCHER: Properties/Overview vs Prop Settings */}
      <div className="flex items-center border-b border-border/70 bg-muted/40 p-1.5 shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onInspectorTabChange?.('properties')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md transition-all cursor-pointer',
            activeInspectorTab === 'properties'
              ? 'bg-background text-foreground shadow-xs border border-border/60'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {selectedElement ? (
            <>
              <Sliders className="h-3.5 w-3.5 text-primary" />
              <span>Properties</span>
            </>
          ) : (
            <>
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Overview</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onInspectorTabChange?.('settings')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md transition-all cursor-pointer',
            activeInspectorTab === 'settings'
              ? 'bg-background text-cyan-400 shadow-xs border border-cyan-500/50'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
          <span>Prop Settings</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </button>

        {selectedElement && activeInspectorTab === 'properties' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            onClick={onClose}
            title="Deselect Element"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            onClick={onToggleCollapse}
            title="Collapse Sidebar to Right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 2. PANE CONTENT */}
      {activeInspectorTab === 'settings' ? (
        /* ================= PROP SETTINGS PANE ================= */
        <div className="p-4 space-y-4 flex flex-col flex-1">
          {/* Header Banner */}
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Default Dimensions
                </h4>
              </div>
              {onOpenExpandedModal && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-cyan-400 hover:text-cyan-200 hover:bg-cyan-900/40 cursor-pointer"
                  onClick={onOpenExpandedModal}
                  title="Expand to Full Dialog Window"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-slate-300">
              Adjust default Width × Height of props so every dragged item drops at your exact preferred scale.
            </p>
          </div>

          {/* SMART SLOT ALIGNMENT & EQUAL SPACING ASSISTER TOGGLE */}
          <div className="rounded-lg border border-purple-500/40 bg-purple-950/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-purple-500/20 text-purple-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-purple-200">
                    Slot Smart Assister
                  </h4>
                  <p className="text-[10px] text-purple-300/70">
                    Equal Spacing & Same-Line Alignment
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsData.enableSlotAssister !== false}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setSettingsData((prev) => ({ ...prev, enableSlotAssister: enabled }));
                    onSavePropDefaults({ ...settingsData, enableSlotAssister: enabled }, false);
                    toast.success(
                      enabled
                        ? 'Smart Slot Assister enabled! Live alignment lines & equal spacing guides are active.'
                        : 'Smart Slot Assister disabled.',
                    );
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
              </label>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Assists in placing slots at equal distance between each other and automatically snaps them into the same line (top, center, bottom, left, right) with live dimension badges.
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-purple-500/20 text-[10px]">
              <span className="text-purple-300/80">Assister Status:</span>
              <span
                className={cn(
                  'font-mono font-semibold px-2 py-0.5 rounded-full border',
                  settingsData.enableSlotAssister !== false
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'bg-muted text-muted-foreground border-border/60',
                )}
              >
                {settingsData.enableSlotAssister !== false ? '● ACTIVE & SNAPPING' : '○ DISABLED'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 flex-1">
            {/* Category A: Driving Lanes */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-border/50 pb-1.5 text-xs font-bold text-amber-400">
                <Car className="h-3.5 w-3.5" />
                <span>Driving Lanes & Connectors</span>
              </div>

              {/* Straight Lane */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Straight Lane</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {settingsData.straightLane.width} × {settingsData.straightLane.height} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Width / Length</Label>
                    <NumericInput
                      min={60}
                      max={1200}
                      step={20}
                      value={settingsData.straightLane.width}
                      onChangeValue={(val) => handleUpdateSetting('straightLane', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Height / Thickness</Label>
                    <NumericInput
                      min={30}
                      max={200}
                      step={10}
                      value={settingsData.straightLane.height}
                      onChangeValue={(val) => handleUpdateSetting('straightLane', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>

              {/* Corner Turn */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">90° Corner Turn</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {settingsData.cornerTurn.width} × {settingsData.cornerTurn.height} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Width</Label>
                    <NumericInput
                      min={40}
                      max={300}
                      step={10}
                      value={settingsData.cornerTurn.width}
                      onChangeValue={(val) => {
                        handleUpdateSetting('cornerTurn', 'width', val);
                        handleUpdateSetting('cornerTurn', 'height', val);
                      }}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Height</Label>
                    <NumericInput
                      min={40}
                      max={300}
                      step={10}
                      value={settingsData.cornerTurn.height}
                      onChangeValue={(val) => {
                        handleUpdateSetting('cornerTurn', 'width', val);
                        handleUpdateSetting('cornerTurn', 'height', val);
                      }}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>

              {/* Square Connector */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Square Connector (4-Way)</span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    {settingsData.squareConnector.width} × {settingsData.squareConnector.height} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Size (W × H)</Label>
                    <NumericInput
                      min={40}
                      max={240}
                      step={10}
                      value={settingsData.squareConnector.width}
                      onChangeValue={(val) => {
                        handleUpdateSetting('squareConnector', 'width', val);
                        handleUpdateSetting('squareConnector', 'height', val);
                      }}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                  <div className="flex items-end">
                    <span className="text-[10px] text-muted-foreground pb-1">4-way docking hub</span>
                  </div>
                </div>
              </div>

              {/* T-Junction */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">T-Junction</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {settingsData.tJunction.width} × {settingsData.tJunction.height} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Width</Label>
                    <NumericInput
                      min={60}
                      max={400}
                      step={10}
                      value={settingsData.tJunction.width}
                      onChangeValue={(val) => handleUpdateSetting('tJunction', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Height</Label>
                    <NumericInput
                      min={40}
                      max={200}
                      step={10}
                      value={settingsData.tJunction.height}
                      onChangeValue={(val) => handleUpdateSetting('tJunction', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Category B: Parking Slots */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-border/50 pb-1.5 text-xs font-bold text-blue-400">
                <Shield className="h-3.5 w-3.5" />
                <span>Parking Slots</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Standard Slot Bay</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {settingsData.parkingSlot.width} × {settingsData.parkingSlot.height} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Bay Width</Label>
                    <NumericInput
                      min={40}
                      max={160}
                      step={5}
                      value={settingsData.parkingSlot.width}
                      onChangeValue={(val) => handleUpdateSetting('parkingSlot', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Bay Length (Height)</Label>
                    <NumericInput
                      min={60}
                      max={260}
                      step={10}
                      value={settingsData.parkingSlot.height}
                      onChangeValue={(val) => handleUpdateSetting('parkingSlot', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Category C: Gates & Structures */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-border/50 pb-1.5 text-xs font-bold text-emerald-400">
                <DoorOpen className="h-3.5 w-3.5" />
                <span>Gates, Walls & Structures</span>
              </div>

              {/* Entrance Gate */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Entrance Gate W×H</Label>
                  <div className="flex items-center gap-1">
                    <NumericInput
                      min={60}
                      max={300}
                      value={settingsData.entranceGate.width}
                      onChangeValue={(val) => handleUpdateSetting('entranceGate', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <NumericInput
                      min={20}
                      max={120}
                      value={settingsData.entranceGate.height}
                      onChangeValue={(val) => handleUpdateSetting('entranceGate', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Exit Gate W×H</Label>
                  <div className="flex items-center gap-1">
                    <NumericInput
                      min={60}
                      max={300}
                      value={settingsData.exitGate.width}
                      onChangeValue={(val) => handleUpdateSetting('exitGate', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <NumericInput
                      min={20}
                      max={120}
                      value={settingsData.exitGate.height}
                      onChangeValue={(val) => handleUpdateSetting('exitGate', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>

              {/* Wall & Pillar */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Boundary Wall W×H</Label>
                  <div className="flex items-center gap-1">
                    <NumericInput
                      min={40}
                      max={600}
                      value={settingsData.wall.width}
                      onChangeValue={(val) => handleUpdateSetting('wall', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <NumericInput
                      min={8}
                      max={40}
                      value={settingsData.wall.height}
                      onChangeValue={(val) => handleUpdateSetting('wall', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Structural Pillar</Label>
                  <div className="flex items-center gap-1">
                    <NumericInput
                      min={20}
                      max={100}
                      value={settingsData.pillar.width}
                      onChangeValue={(val) => {
                        handleUpdateSetting('pillar', 'width', val);
                        handleUpdateSetting('pillar', 'height', val);
                      }}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                    <span className="text-[10px] text-muted-foreground">px square</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category D: Vertical Access & Complex Connectors */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-border/50 pb-1.5 text-xs font-bold text-sky-400">
                <Layers className="h-3.5 w-3.5" />
                <span>Vertical Shafts & Complex Access</span>
              </div>

              {/* Lift & Staircase Core */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Lift & Staircase Core Area</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {settingsData.liftStaircase?.width ?? DEFAULT_PROP_DIMENSIONS.liftStaircase.width} ×{' '}
                    {settingsData.liftStaircase?.height ?? DEFAULT_PROP_DIMENSIONS.liftStaircase.height} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Width</Label>
                    <NumericInput
                      min={80}
                      max={300}
                      value={settingsData.liftStaircase?.width ?? DEFAULT_PROP_DIMENSIONS.liftStaircase.width}
                      onChangeValue={(val) => handleUpdateSetting('liftStaircase', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] text-muted-foreground">Height</Label>
                    <NumericInput
                      min={50}
                      max={200}
                      value={settingsData.liftStaircase?.height ?? DEFAULT_PROP_DIMENSIONS.liftStaircase.height}
                      onChangeValue={(val) => handleUpdateSetting('liftStaircase', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>

              {/* Lift & Staircase individual */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                <div>
                  <Label className="text-[9px] text-muted-foreground">Elevator / Lift W×H</Label>
                  <div className="flex items-center gap-1">
                    <NumericInput
                      min={40}
                      max={180}
                      value={settingsData.lift?.width ?? DEFAULT_PROP_DIMENSIONS.lift.width}
                      onChangeValue={(val) => handleUpdateSetting('lift', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <NumericInput
                      min={40}
                      max={180}
                      value={settingsData.lift?.height ?? DEFAULT_PROP_DIMENSIONS.lift.height}
                      onChangeValue={(val) => handleUpdateSetting('lift', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[9px] text-muted-foreground">Staircase W×H</Label>
                  <div className="flex items-center gap-1">
                    <NumericInput
                      min={50}
                      max={200}
                      value={settingsData.staircase?.width ?? DEFAULT_PROP_DIMENSIONS.staircase.width}
                      onChangeValue={(val) => handleUpdateSetting('staircase', 'width', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <NumericInput
                      min={40}
                      max={150}
                      value={settingsData.staircase?.height ?? DEFAULT_PROP_DIMENSIONS.staircase.height}
                      onChangeValue={(val) => handleUpdateSetting('staircase', 'height', val)}
                      className="h-7 text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>

              {/* Building & Complex Entrance */}
              <div className="pt-1 border-t border-border/40">
                <Label className="text-[9px] text-muted-foreground">Complex Entrance W×H (Mall / Hospital)</Label>
                <div className="flex items-center gap-1 mt-1">
                  <NumericInput
                    min={60}
                    max={300}
                    value={settingsData.buildingEntrance?.width ?? DEFAULT_PROP_DIMENSIONS.buildingEntrance.width}
                    onChangeValue={(val) => handleUpdateSetting('buildingEntrance', 'width', val)}
                    className="h-7 text-xs font-mono bg-muted/30"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <NumericInput
                    min={30}
                    max={150}
                    value={settingsData.buildingEntrance?.height ?? DEFAULT_PROP_DIMENSIONS.buildingEntrance.height}
                    onChangeValue={(val) => handleUpdateSetting('buildingEntrance', 'height', val)}
                    className="h-7 text-xs font-mono bg-muted/30"
                  />
                </div>
              </div>
            </div>

            {/* Checkbox: Apply to Existing */}
            {placedElementsCount > 0 && (
              <label className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/60 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={applyToExisting}
                  onChange={(e) => setApplyToExisting(e.target.checked)}
                  className="rounded border-border/80 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                />
                <span className="text-[11px] text-foreground">
                  Also update all <strong className="text-cyan-400">{placedElementsCount}</strong> existing canvas elements
                </span>
              </label>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1 mt-auto">
              <Button
                type="submit"
                className="w-full h-8 text-xs font-semibold gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer shadow-xs"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Prop Defaults</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetSettings}
                className="w-full h-7 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Factory Defaults</span>
              </Button>
            </div>
          </form>
        </div>
      ) : !selectedElement ? (
        /* ================= OVERVIEW / FLOOR STATS PANE ================= */
        <div className="p-4 space-y-5 flex-1">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Floor Statistics & Guide
            </h3>
          </div>

          {/* Floor Context Summary */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Floor Level:</span>
              <span className="font-bold text-foreground">
                {floorStats.floorName} (L{floorStats.floorNumber})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Placed Inventory:</span>
              <Badge
                variant={floorStats.unplacedSlots === 0 ? 'default' : 'secondary'}
                className="font-mono text-[10px]"
              >
                {floorStats.placedSlots} / {floorStats.totalSlots} Slots
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Entry / Exit Gates:</span>
              <span className="font-bold text-foreground font-mono">
                {floorStats.entrancesCount} IN • {floorStats.exitsCount} OUT
              </span>
            </div>
            {floorStats.rampsCount !== undefined && floorStats.rampsCount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Level Ramps:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {floorStats.rampsCount} Ramp{floorStats.rampsCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Facility Boundary & Canvas Dimensions (Synced across all floors, master controlled from Ground Floor) */}
          {canvasConfig && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Maximize2 className="h-3 w-3" />
                  <span>Facility Boundary</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[9px] font-mono border-cyan-500/30 text-cyan-300 bg-cyan-900/30"
                  >
                    {canvasConfig.width} × {canvasConfig.height} px
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] font-mono',
                      canResizeCanvas !== false
                        ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/40'
                        : 'border-slate-600 text-slate-400 bg-slate-900/60',
                    )}
                  >
                    {canResizeCanvas !== false ? 'G Floor Master' : 'Locked to G'}
                  </Badge>
                </div>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                {canResizeCanvas !== false
                  ? 'Facility perimeter boundary. Adjust via the stretcher handles on canvas or edit inputs below (updates all floors).'
                  : 'Facility boundary (Width × Height) is locked to Ground Floor Master. Current dimensions apply to all levels.'}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Width (px)</Label>
                  <NumericInput
                    key={`canvas-w-${canvasConfig.width}`}
                    min={600}
                    max={6000}
                    step={50}
                    value={canvasConfig.width}
                    disabled={canResizeCanvas === false}
                    onChangeValue={(val) => onUpdateCanvasConfig?.({ width: Math.max(600, val) })}
                    className={cn(
                      'h-7 text-xs font-mono bg-muted/40 border-border/60',
                      canResizeCanvas === false && 'opacity-60 cursor-not-allowed bg-slate-900',
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Height (px)</Label>
                  <NumericInput
                    key={`canvas-h-${canvasConfig.height}`}
                    min={400}
                    max={4000}
                    step={50}
                    value={canvasConfig.height}
                    disabled={canResizeCanvas === false}
                    onChangeValue={(val) => onUpdateCanvasConfig?.({ height: Math.max(400, val) })}
                    className={cn(
                      'h-7 text-xs font-mono bg-muted/40 border-border/60',
                      canResizeCanvas === false && 'opacity-60 cursor-not-allowed bg-slate-900',
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Driving Lane Network (Copy / Paste / Replicate Across Floors) */}
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <GitFork className="h-3 w-3" />
                <span>Driving Lane Network</span>
              </span>
              <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/30 text-cyan-300 bg-cyan-900/30">
                {lanesCount || 0} Lanes
              </Badge>
            </div>

            <p className="text-[10px] text-slate-300 leading-relaxed">
              Copy the complete driving lane network from this floor to replicate across upper floors.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCopyLaneNetwork}
                disabled={!lanesCount || lanesCount === 0}
                className="h-8 text-[11px] font-semibold gap-1.5 border-cyan-500/40 text-cyan-300 bg-cyan-900/20 hover:bg-cyan-900/40 cursor-pointer disabled:opacity-40"
                title="Copy all driving lanes on this floor to clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Lanes ({lanesCount || 0})</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onPasteLaneNetwork}
                disabled={!hasCopiedLanes}
                className={cn(
                  'h-8 text-[11px] font-semibold gap-1.5 border-emerald-500/40 text-emerald-300 bg-emerald-950/20 hover:bg-emerald-900/40 cursor-pointer',
                  hasCopiedLanes && 'animate-pulse bg-emerald-950/40 border-emerald-500/60',
                  !hasCopiedLanes && 'opacity-40 cursor-not-allowed',
                )}
                title={
                  hasCopiedLanes
                    ? `Paste copied lane network (${copiedLanesCount} lanes from ${copiedSourceFloorName || 'source floor'})`
                    : 'No lane network in clipboard'
                }
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                <span>Paste Lanes ({copiedLanesCount || 0})</span>
              </Button>
            </div>

            {onOpenReplicateLanesModal && (lanesCount || 0) > 0 && floors.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenReplicateLanesModal}
                className="w-full h-7 text-[10px] font-semibold gap-1.5 text-cyan-300 hover:text-cyan-100 hover:bg-cyan-900/30 border border-cyan-500/20 mt-1 cursor-pointer"
              >
                <GitFork className="h-3 w-3 text-cyan-400" />
                <span>Replicate to Multiple Upper Floors...</span>
              </Button>
            )}
          </div>

          {/* Validation Status Hints */}
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Layout Requirements:
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                {floorStats.entrancesCount > 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className={floorStats.entrancesCount > 0 ? 'text-foreground' : 'text-amber-500'}>
                  At least 1 Entrance Gate
                </span>
              </div>

              <div className="flex items-center gap-2">
                {floorStats.exitsCount > 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className={floorStats.exitsCount > 0 ? 'text-foreground' : 'text-amber-500'}>
                  At least 1 Exit Gate
                </span>
              </div>

              <div className="flex items-center gap-2">
                {floorStats.unplacedSlots === 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className={floorStats.unplacedSlots === 0 ? 'text-foreground' : 'text-amber-500'}>
                  All {floorStats.totalSlots} official slots mapped
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 text-xs text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
              Quick Controls:
            </span>
            <ul className="space-y-1 text-[11px] list-disc pl-4">
              <li>Click any element on canvas to inspect & edit.</li>
              <li>Drag unplaced slots from left toolbox to place.</li>
              <li>Use the <strong>Prop Settings</strong> tab to customize default sizes.</li>
              <li>Rotate elements using the rotate button or properties panel.</li>
            </ul>
          </div>
        </div>
      ) : (
        /* ================= ELEMENT PROPERTIES PANE ================= */
        <div className="p-4 space-y-4 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Element Properties
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={onClose}
              title="Close Panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Element Type Badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 border-primary/40 text-primary">
              {selectedElement.elementType}
            </Badge>
            <span className="text-[10px] font-mono text-muted-foreground">
              {selectedElement.elementId}
            </span>
          </div>

          {/* Slot Specific Properties */}
          {selectedElement.elementType === 'ParkingSlot' && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Official Slot Number:</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {selectedElement.slotNumber || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Zone:</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  Zone {selectedElement.zoneCode || 'A'}
                </Badge>
              </div>
            </div>
          )}

          {/* Vertical Shaft / Multi-Storey Structural Properties (Lift, Staircase, Pillar/Column) */}
          {['Lift', 'Staircase', 'LiftStaircase', 'Pillar'].includes(selectedElement.elementType) && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
                <div className="flex items-center gap-1.5 text-sky-300 font-bold">
                  {selectedElement.elementType === 'Lift' ? (
                    <ChevronsUpDown className="h-4 w-4" />
                  ) : selectedElement.elementType === 'Staircase' ? (
                    <Footprints className="h-4 w-4 text-amber-400" />
                  ) : selectedElement.elementType === 'Pillar' ? (
                    <Columns className="h-4 w-4 text-slate-300" />
                  ) : (
                    <Layers className="h-4 w-4 text-sky-300" />
                  )}
                  <span>
                    {selectedElement.elementType === 'Lift'
                      ? 'Elevator Shaft'
                      : selectedElement.elementType === 'Staircase'
                        ? 'Pedestrian Stairwell'
                        : selectedElement.elementType === 'Pillar'
                          ? 'Structural Column (Pillar)'
                          : 'Lift & Staircase Core'}
                  </span>
                </div>
                <Badge variant="outline" className="text-[9px] font-mono border-sky-500/40 text-sky-300">
                  {selectedElement.elementType === 'Pillar' ? 'Structural Column' : 'Shaft Core'}
                </Badge>
              </div>

              {/* Multi-Storey All Floors Occupancy Toggle */}
              <div className="space-y-1.5 pt-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedElement.occupiesAllFloors !== false && selectedElement.syncAcrossAllFloors !== false}
                    onChange={(e) => {
                      onUpdateElement({
                        occupiesAllFloors: e.target.checked,
                        syncAcrossAllFloors: e.target.checked,
                        shaftGroupId: selectedElement.shaftGroupId || selectedElement.elementId,
                      });
                      toast.info(
                        e.target.checked
                          ? 'Footprint will occupy & sync across all floors on save.'
                          : 'Footprint is now isolated to this floor only.',
                      );
                    }}
                    className="mt-0.5 rounded border-border"
                  />
                  <div className="text-left">
                    <span className="font-semibold text-foreground text-xs block">
                      Occupies All Floors (Continuous Structural Sync)
                    </span>
                    <span className="text-[10px] text-muted-foreground block leading-tight">
                      Pre-sets and locks identical spatial footprint (position & size) on every floor. Moving or removing it here updates or removes it across all floors. (Walls remain floor-specific).
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Building & Complex Entrance Properties (Mall, Hospital, Plaza) */}
          {selectedElement.elementType === 'BuildingEntrance' && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <Building2 className="h-4 w-4" />
                  <span>Complex / Building Portal</span>
                </div>
                <Badge variant="outline" className="text-[9px] font-mono border-purple-500/40 text-purple-300">
                  Pedestrian Access
                </Badge>
              </div>

              <div className="space-y-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Connected Facility Type</Label>
                  <select
                    value={selectedElement.buildingType || 'Mall'}
                    onChange={(e) => onUpdateElement({ buildingType: e.target.value })}
                    className="w-full mt-1 bg-background border border-border/80 rounded px-2 py-1 text-xs text-foreground"
                  >
                    <option value="Mall">Shopping Mall / Retail Center</option>
                    <option value="Hospital">Hospital / Medical Center</option>
                    <option value="Commercial Office">Commercial Office Tower</option>
                    <option value="Transit Terminal">Airport / Transit Hub</option>
                    <option value="Residential">Residential Complex</option>
                    <option value="General Complex">General Public Structure</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Geometry: Coordinates X, Y */}
          <div className="space-y-3 border-t border-border/60 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Canvas Position & Dimensions
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">X Coordinate</Label>
                <NumericInput
                  step={0.1}
                  precision={1}
                  allowNegative={true}
                  allowDecimals={true}
                  value={selectedElement.x}
                  onChangeValue={(val) => onUpdateElement({ x: val })}
                  className="h-8 text-xs font-mono bg-muted/30 border-border/60"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Y Coordinate</Label>
                <NumericInput
                  step={0.1}
                  precision={1}
                  allowNegative={true}
                  allowDecimals={true}
                  value={selectedElement.y}
                  onChangeValue={(val) => onUpdateElement({ y: val })}
                  className="h-8 text-xs font-mono bg-muted/30 border-border/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Width (px)</Label>
                <NumericInput
                  min={10}
                  step={1}
                  allowDecimals={true}
                  value={selectedElement.width}
                  onChangeValue={(val) => onUpdateElement({ width: Math.max(10, val) })}
                  className="h-8 text-xs font-mono bg-muted/30 border-border/60"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Height (px)</Label>
                <NumericInput
                  min={10}
                  step={1}
                  allowDecimals={true}
                  value={selectedElement.height}
                  onChangeValue={(val) => onUpdateElement({ height: Math.max(10, val) })}
                  className="h-8 text-xs font-mono bg-muted/30 border-border/60"
                />
              </div>
            </div>

            {/* Rotation & Angle Controls */}
            <div className="space-y-2.5 pt-2.5 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Compass className="h-3 w-3 text-cyan-400" />
                  <span>Rotation Angle</span>
                </Label>
                <div className="flex items-center gap-1">
                  <NumericInput
                    min={0}
                    max={360}
                    step={0.5}
                    precision={1}
                    allowDecimals={true}
                    value={Math.round((selectedElement.rotation || 0) * 10) / 10}
                    onChangeValue={(val) => {
                      onRotateElement(selectedElement.elementId, val, false);
                    }}
                    className="w-16 h-7 text-xs font-mono text-right bg-muted/40 border-border/60"
                  />
                  <span className="text-xs font-mono text-muted-foreground">°</span>
                </div>
              </div>

              {/* Angle Range Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={Math.round(selectedElement.rotation || 0)}
                  onChange={(e) => onRotateElement(selectedElement.elementId, Number(e.target.value), false)}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-[8px] font-mono text-muted-foreground px-0.5">
                  <span>0°</span>
                  <span>90°</span>
                  <span>180°</span>
                  <span>270°</span>
                  <span>360°</span>
                </div>
              </div>

              {/* Standard Angle Presets */}
              <div className="space-y-1">
                <span className="text-[9px] text-muted-foreground font-medium">Standard Angles:</span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: '0°', angle: 0 },
                    { label: '30°', angle: 30 },
                    { label: '45°', angle: 45 },
                    { label: '60°', angle: 60 },
                    { label: '90°', angle: 90 },
                    { label: '135°', angle: 135 },
                    { label: '180°', angle: 180 },
                    { label: '270°', angle: 270 },
                  ].map((preset) => {
                    const isActive = Math.round(selectedElement.rotation || 0) === preset.angle;
                    return (
                      <Button
                        key={`preset-${preset.angle}`}
                        type="button"
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onRotateElement(selectedElement.elementId, preset.angle, false)}
                        className={cn(
                          'h-6 text-[10px] font-mono px-1 py-0 cursor-pointer',
                          isActive
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white font-bold'
                            : 'hover:border-cyan-500/50 hover:text-cyan-400 bg-muted/20',
                        )}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Angle Nudge / Stepper Buttons */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono px-1.5 cursor-pointer bg-muted/20"
                    onClick={() => onRotateElement(selectedElement.elementId, -45, true)}
                    title="Rotate 45° Counter-Clockwise"
                  >
                    -45°
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono px-1.5 cursor-pointer bg-muted/20"
                    onClick={() => onRotateElement(selectedElement.elementId, -15, true)}
                    title="Rotate 15° Counter-Clockwise"
                  >
                    -15°
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono px-1.5 cursor-pointer bg-muted/20"
                    onClick={() => onRotateElement(selectedElement.elementId, -1, true)}
                    title="Nudge 1° Counter-Clockwise"
                  >
                    -1°
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono px-1.5 cursor-pointer bg-muted/20"
                    onClick={() => onRotateElement(selectedElement.elementId, 1, true)}
                    title="Nudge 1° Clockwise"
                  >
                    +1°
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono px-1.5 cursor-pointer bg-muted/20"
                    onClick={() => onRotateElement(selectedElement.elementId, 15, true)}
                    title="Rotate 15° Clockwise"
                  >
                    +15°
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] font-mono px-1.5 cursor-pointer bg-muted/20"
                    onClick={() => onRotateElement(selectedElement.elementId, 45, true)}
                    title="Rotate 45° Clockwise"
                  >
                    +45°
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Element Quick Actions: Rotate & Duplicate */}
          <div className="space-y-2 border-t border-border/60 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Quick Actions
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 cursor-pointer hover:border-cyan-500/50 hover:text-cyan-400"
                onClick={() => onRotateElement(selectedElement.elementId, 45, true)}
                title="Rotate 45° clockwise"
              >
                <RotateCw className="h-3 w-3 text-cyan-400" />
                <span>+45°</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 cursor-pointer hover:border-cyan-500/50 hover:text-cyan-400"
                onClick={() => onRotateElement(selectedElement.elementId, 90, true)}
                title="Rotate 90° clockwise"
              >
                <RotateCw className="h-3 w-3 text-cyan-400" />
                <span>+90°</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 cursor-pointer hover:border-cyan-500/50 hover:text-cyan-400"
                onClick={() => onRotateElement(selectedElement.elementId, 180, true)}
                title="Flip 180°"
              >
                <RotateCcw className="h-3 w-3 text-amber-400" />
                <span>Flip 180°</span>
              </Button>
            </div>

            {onDuplicateElement && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1.5 cursor-pointer hover:border-cyan-500/50 hover:text-cyan-400"
                onClick={() => onDuplicateElement(selectedElement.elementId)}
                title="Duplicate Prop (Ctrl+C / Ctrl+V)"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Duplicate Prop</span>
              </Button>
            )}

            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Tip: Press <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/60 font-mono font-bold">Ctrl+C</kbd> / <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/60 font-mono font-bold">Ctrl+V</kbd> to duplicate. Use <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/60 font-mono font-bold">Arrow Keys</kbd> to nudge by 0.1px (<kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/60 font-mono font-bold">Shift+Arrow</kbd> for 1px). On canvas, click the angle pill to cycle standard angles!
            </p>
          </div>

          {/* Parking Slot Customer Navigation Route Manager */}
          {selectedElement.elementType === 'ParkingSlot' && (
            <div className="space-y-3 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Customer Navigation Routes
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Link navigation pointers to road lanes
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSlotNavPointer}
                  className="h-6 text-[10px] px-2 gap-1 text-cyan-400 border-cyan-500/40 hover:bg-cyan-950/40"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Nav</span>
                </Button>
              </div>

              {(() => {
                const navPointers = getSlotNavPointers(selectedElement);

                return (
                  <div className="space-y-2">
                    {navPointers.map((pointer, pIdx) => {
                      const targetLane = pointer.targetLaneId
                        ? drivingLanes.find((l) => l.elementId === pointer.targetLaneId)
                        : null;

                      return (
                        <div
                          key={`nav-inspector-pointer-${pointer.id}`}
                          className={cn(
                            'p-2.5 rounded-lg border text-xs space-y-2',
                            targetLane
                              ? 'border-cyan-500/40 bg-cyan-950/20'
                              : 'border-amber-500/40 bg-amber-950/20',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] flex items-center gap-1.5">
                              <Navigation
                                className={cn(
                                  'h-3.5 w-3.5',
                                  targetLane ? 'text-cyan-400' : 'text-amber-400',
                                )}
                              />
                              <span className={targetLane ? 'text-cyan-300' : 'text-amber-300'}>
                                Navigation Pointer #{pIdx + 1}
                              </span>
                            </span>
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[9px] px-1.5 py-0',
                                  targetLane
                                    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40'
                                    : 'text-amber-400 border-amber-500/40 bg-amber-950/40',
                                )}
                              >
                                {targetLane ? 'Connected' : 'Unconnected'}
                              </Badge>
                              {navPointers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlotNavPointer(pointer.id)}
                                  className="text-muted-foreground hover:text-red-400 p-0.5 rounded transition-colors"
                                  title="Remove this navigation pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">
                              Connected Driving Lane:
                            </Label>
                            <select
                              value={pointer.targetLaneId || ''}
                              onChange={(e) => handleConnectNavPointer(pointer.id, e.target.value)}
                              className="w-full h-7 rounded border border-border bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            >
                              <option value="">-- Unconnected (Drag on canvas or select) --</option>
                              {drivingLanes.map((lane) => (
                                <option key={lane.elementId} value={lane.elementId}>
                                  {lane.label || 'Driving Lane'} ({lane.elementId})
                                </option>
                              ))}
                            </select>
                          </div>

                          {targetLane ? (
                            <div className="flex items-center justify-between pt-0.5">
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Navigating via <strong className="text-cyan-300">{targetLane.label || 'Roadway'}</strong>
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConnectNavPointer(pointer.id, '')}
                                className="h-5 text-[9px] px-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                              >
                                Disconnect
                              </Button>
                            </div>
                          ) : (
                            <p className="text-[10px] text-amber-200/80 leading-relaxed">
                              Drag the glowing <strong className="text-amber-300">➤ NAV</strong> pointer on the canvas onto any driving lane, or select a lane above.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Driving Lane Specific Settings */}
          {selectedElement.elementType === 'DrivingLane' && (
            <div className="space-y-3 border-t border-border/60 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Lane Traffic Flow
              </span>

              {/* Serviced Parking Bays Navigation Summary */}
              {(() => {
                const connectedSlots = (allElements || []).filter(
                  (el) =>
                    el.elementType === 'ParkingSlot' &&
                    (el.connectedLaneIds?.includes(selectedElement.elementId) ||
                      el.navPointers?.some((p) => p.targetLaneId === selectedElement.elementId) ||
                      connectedProps.some((c) => c.element.elementId === el.elementId)),
                );
                if (connectedSlots.length > 0) {
                  return (
                    <div className="p-2 rounded-md border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-medium">
                        <Navigation className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Servicing {connectedSlots.length} Parking Bay{connectedSlots.length > 1 ? 's' : ''}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-emerald-400 border-emerald-500/40">
                        Nav-Ready
                      </Badge>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Direction</Label>
                <select
                  value={selectedElement.laneDirection || 'Two-Way'}
                  onChange={(e) => onUpdateElement({ laneDirection: e.target.value as any })}
                  className="w-full h-8 text-xs bg-muted/40 border border-border/60 rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="Two-Way">⇄ Two-Way Traffic</option>
                  <option value="One-Way-Forward">→ One-Way Forward</option>
                  <option value="One-Way-Backward">← One-Way Backward</option>
                </select>
              </div>

              {/* Quick Connect Actions */}
              {onConnectLane && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    {selectedElement.label?.includes('Square') ||
                      selectedElement.label?.includes('Connector') ||
                      selectedElement.label?.includes('Hub') ||
                      Math.abs(selectedElement.width - selectedElement.height) <= 30
                      ? '✛ 4-Way Hub: Branch Next Lanes'
                      : 'Quick Connect Next Lane'}
                  </span>
                  {selectedElement.label?.includes('Square') ||
                    selectedElement.label?.includes('Connector') ||
                    selectedElement.label?.includes('Hub') ||
                    Math.abs(selectedElement.width - selectedElement.height) <= 30 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-medium gap-1 justify-start cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-300"
                        onClick={() => onConnectLane(selectedElement, 'turn-left')}
                        title="Branch Vertical Lane North (↑)"
                      >
                        <span className="font-bold">↑</span>
                        <span>Branch North</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-medium gap-1 justify-start cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-300"
                        onClick={() => onConnectLane(selectedElement, 'turn-right')}
                        title="Branch Vertical Lane South (↓)"
                      >
                        <span className="font-bold">↓</span>
                        <span>Branch South</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-medium gap-1 justify-start cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-300"
                        onClick={() => onConnectLane(selectedElement, 'forward')}
                        title="Branch Horizontal Lane East (→)"
                      >
                        <span className="font-bold">→</span>
                        <span>Branch East</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-medium gap-1 justify-start cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-300"
                        onClick={() => onConnectLane(selectedElement, 'backward')}
                        title="Branch Horizontal Lane West (←)"
                      >
                        <span className="font-bold">←</span>
                        <span>Branch West</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-medium gap-1 justify-start cursor-pointer hover:border-emerald-500/50"
                        onClick={() => onConnectLane(selectedElement, 'forward')}
                      >
                        <ArrowRight className="h-3 w-3 text-emerald-400" />
                        <span>Continue Straight</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-medium gap-1 justify-start cursor-pointer hover:border-blue-500/50"
                        onClick={() => onConnectLane(selectedElement, 'turn-left')}
                      >
                        <span>↰ Turn Up / Left</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] font-medium gap-1 justify-start cursor-pointer hover:border-blue-500/50"
                        onClick={() => onConnectLane(selectedElement, 'turn-right')}
                      >
                        <span>↱ Turn Down / Right</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ramp / Level Connection Properties (Ramp and RampPortal) */}
          {(selectedElement.elementType === 'Ramp' || selectedElement.elementType === 'RampPortal') && (
            <div className="space-y-3 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Multi-Level Ramp Synchronization
                </span>
                <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/40 text-emerald-400">
                  Floor Connector
                </Badge>
              </div>

              {selectedElement.elementType === 'Ramp' ? (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Incline Direction</Label>
                  <select
                    value={selectedElement.rampDirection || 'Up'}
                    onChange={(e) => onUpdateElement({ rampDirection: e.target.value as any })}
                    className="w-full h-8 text-xs bg-muted/40 border border-border/60 rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="Up">▲ Ramp Up (To Upper Level)</option>
                    <option value="Down">▼ Ramp Down (To Lower Level)</option>
                    <option value="Two-Way">⇅ Two-Way Ramp</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Portal Flow Type</Label>
                  <select
                    value={selectedElement.portalType || 'Entry'}
                    onChange={(e) => onUpdateElement({ portalType: e.target.value as any })}
                    className="w-full h-8 text-xs bg-muted/40 border border-border/60 rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="Entry">▲ Ramp Arrival (Entry into floor from ramp)</option>
                    <option value="Exit">▼ Ramp Departure (Exit from floor onto ramp)</option>
                    <option value="Two-Way">⇅ Ramp Interchange (Two-Way)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Assign Connected Floor</Label>
                <select
                  value={selectedElement.targetFloorId || ''}
                  onChange={(e) => {
                    const flId = e.target.value;
                    const targetFl = floors.find((f) => f._id === flId);
                    onUpdateElement({
                      targetFloorId: flId || null,
                      targetFloorName: targetFl
                        ? `${targetFl.floorName} (Level ${targetFl.floorNumber})`
                        : '',
                    });
                  }}
                  className="w-full h-8 text-xs bg-muted/40 border border-border/60 rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">-- Auto-Detect Next Level --</option>
                  {floors
                    .filter((f) => f._id !== currentFloorId)
                    .map((fl) => (
                      <option key={fl._id} value={fl._id}>
                        {fl.floorName} (Level {fl.floorNumber})
                      </option>
                    ))}
                </select>
              </div>

              {/* Cross-Floor Auto-Placement Toggle */}
              <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 p-2.5 space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedElement.autoPlaceOnTargetFloor !== false}
                    onChange={(e) => {
                      onUpdateElement({
                        autoPlaceOnTargetFloor: e.target.checked,
                        rampGroupId: selectedElement.rampGroupId || selectedElement.elementId,
                      });
                      toast.info(
                        e.target.checked
                          ? 'Matching ramp/portal will auto-place on the connected floor of identical size.'
                          : 'Ramp will not auto-place on the connected floor.',
                      );
                    }}
                    className="mt-0.5 rounded border-border"
                  />
                  <div className="text-left">
                    <span className="font-semibold text-emerald-300 text-xs block">
                      Auto-Place Matching Ramp / Portal on Connected Floor
                    </span>
                    <span className="text-[10px] text-muted-foreground block leading-tight">
                      When saving, automatically places or updates the counterpart element of the exact same size{' '}
                      <strong className="text-foreground">({selectedElement.width}×{selectedElement.height} px)</strong> at the exact same location on the other level.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Connected Props / Coupling Overview */}
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3 w-3 text-cyan-400" />
                <span>Connected Props ({connectedProps.length})</span>
              </span>
              {connectedProps.length > 0 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-cyan-400 border-cyan-500/40 bg-cyan-950/30">
                  Coupled
                </Badge>
              )}
            </div>

            {connectedProps.length === 0 ? (
              <div className="p-2 rounded-md bg-muted/20 border border-dashed border-border/60 text-center">
                <p className="text-[10px] text-muted-foreground">
                  No directly connected props yet. Stretch or drag this prop near another element to couple automatically.
                </p>
              </div>
            ) : (
              <div
                className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5"
                onMouseLeave={() => onHighlightElement?.(null)}
              >
                {connectedProps.map((conn, idx) => {
                  const isHovered = highlightedElementId === conn.element.elementId;
                  return (
                    <div
                      key={`conn-${conn.element.elementId}-${idx}`}
                      onMouseEnter={() => onHighlightElement?.(conn.element.elementId)}
                      onMouseLeave={() => onHighlightElement?.(null)}
                      onClick={() => onSelectConnectedElement?.(conn.element)}
                      className={cn(
                        'p-2 rounded-md border text-xs flex items-center justify-between cursor-pointer transition-all',
                        isHovered
                          ? 'border-cyan-400 bg-cyan-950/40 shadow-xs ring-1 ring-cyan-400/50'
                          : 'border-border/60 bg-muted/30 hover:border-cyan-500/50 hover:bg-muted/50',
                      )}
                      title="Click to select this prop, or hover to highlight on canvas"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate text-[11px]">
                            {conn.element.label ||
                              (conn.element.elementType === 'ParkingSlot'
                                ? `Slot ${conn.element.slotNumber || conn.element.elementId}`
                                : conn.element.elementType)}
                          </span>
                          <span className="text-[9px] text-muted-foreground truncate font-mono">
                            {conn.myPortLabel} ↔ {conn.otherPortLabel}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="secondary"
                        className="text-[9px] font-mono shrink-0 uppercase tracking-wider text-cyan-300 bg-cyan-950/50 border border-cyan-800"
                      >
                        {conn.connectionType}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Remove Element Action */}
          <div className="border-t border-border/60 pt-4 mt-auto">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 cursor-pointer"
              onClick={() => onRemoveElement(selectedElement.elementId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove from Canvas</span>
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              {selectedElement.elementType === 'ParkingSlot'
                ? 'Returns slot to unplaced tray. Official database slot is preserved.'
                : 'Removes physical element from draft layout.'}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
