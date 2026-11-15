import React, { useState, useEffect } from 'react';
import type { PropDimensionDefaults, DimensionPropKey } from './types';
import { DEFAULT_PROP_DIMENSIONS, mergePropDefaults } from './types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  SlidersHorizontal,
  RotateCcw,
  Save,
  Car,
  Compass,
  Shield,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface PropDefaultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propDefaults: PropDimensionDefaults;
  onSavePropDefaults: (newDefaults: PropDimensionDefaults, applyToExisting?: boolean) => void;
  placedElementsCount?: number;
}

export const PropDefaultsModal: React.FC<PropDefaultsModalProps> = ({
  open,
  onOpenChange,
  propDefaults,
  onSavePropDefaults,
  placedElementsCount = 0,
}) => {
  const [formData, setFormData] = useState<PropDimensionDefaults>(() => mergePropDefaults(propDefaults));
  const [applyToExisting, setApplyToExisting] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setFormData(mergePropDefaults(propDefaults));
      setApplyToExisting(false);
    }
  }, [open, propDefaults]);

  const handleUpdate = (
    key: DimensionPropKey,
    field: 'width' | 'height',
    value: number,
  ) => {
    setFormData((prev) => {
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

  const handleResetToFactory = () => {
    setFormData(DEFAULT_PROP_DIMENSIONS);
    toast.info('Reset dimensions to system factory defaults.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePropDefaults(formData, applyToExisting);
    toast.success('Default prop dimensions saved! Drag and drop will use these sizes.');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-slate-100 shadow-2xl p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
          {/* Header */}
          <DialogHeader className="p-5 border-b border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    Default Prop Dimensions
                    <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/40">
                      Auto-Applied
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Configure preset width and height for props so every dragged item drops at your preferred size.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Body with Tabs */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <Tabs defaultValue="lanes" className="w-full">
              <TabsList className="grid grid-cols-3 bg-slate-900 border border-slate-800 text-slate-400 h-9">
                <TabsTrigger value="lanes" className="text-xs font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                  <Car className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                  Driving Lanes
                </TabsTrigger>
                <TabsTrigger value="slots" className="text-xs font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                  <Shield className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
                  Parking Slots
                </TabsTrigger>
                <TabsTrigger value="structures" className="text-xs font-semibold data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                  <Compass className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                  Gates & Walls
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: DRIVING LANES */}
              <TabsContent value="lanes" className="space-y-4 pt-3">
                <p className="text-xs text-slate-400">
                  Preset dimensions for straight roadways, turns, T-junctions, and 4-way square connectors:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Straight Two-Way / One-Way Road */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Straight Driving Lane</span>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        Two-Way / One-Way
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Length / Width (px)</Label>
                        <NumericInput
                          min={60}
                          max={1200}
                          step={20}
                          value={formData.straightLane.width}
                          onChangeValue={(val) => handleUpdate('straightLane', 'width', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Thickness / Height (px)</Label>
                        <NumericInput
                          min={30}
                          max={200}
                          step={10}
                          value={formData.straightLane.height}
                          onChangeValue={(val) => handleUpdate('straightLane', 'height', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4-Way Square Connector (Hub) */}
                  <div className="p-3.5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-200">4-Way Square Connector</span>
                      <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded">
                        Universal Hub
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Width (px)</Label>
                        <NumericInput
                          min={40}
                          max={240}
                          step={10}
                          value={formData.squareConnector.width}
                          onChangeValue={(val) => handleUpdate('squareConnector', 'width', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Height (px)</Label>
                        <NumericInput
                          min={40}
                          max={240}
                          step={10}
                          value={formData.squareConnector.height}
                          onChangeValue={(val) => handleUpdate('squareConnector', 'height', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Corner Turn Connector */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">90° Corner Turn</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        Corner Bend
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Width (px)</Label>
                        <NumericInput
                          min={40}
                          max={300}
                          step={10}
                          value={formData.cornerTurn.width}
                          onChangeValue={(val) => handleUpdate('cornerTurn', 'width', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Height (px)</Label>
                        <NumericInput
                          min={40}
                          max={300}
                          step={10}
                          value={formData.cornerTurn.height}
                          onChangeValue={(val) => handleUpdate('cornerTurn', 'height', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* T-Junction Intersection */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">T-Junction Intersection</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        3-Way Road
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Width (px)</Label>
                        <NumericInput
                          min={60}
                          max={400}
                          step={10}
                          value={formData.tJunction.width}
                          onChangeValue={(val) => handleUpdate('tJunction', 'width', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400">Height (px)</Label>
                        <NumericInput
                          min={40}
                          max={200}
                          step={10}
                          value={formData.tJunction.height}
                          onChangeValue={(val) => handleUpdate('tJunction', 'height', val)}
                          className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: PARKING SLOTS */}
              <TabsContent value="slots" className="space-y-4 pt-3">
                <p className="text-xs text-slate-400">
                  Standard dimensions for individual parking bays when placed from the unplaced slots list:
                </p>

                <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Parking Bay Bay Dimensions</h4>
                      <p className="text-xs text-slate-400">Applies to Standard, EV, Accessible, and VIP slots</p>
                    </div>
                    <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      Ratio: {(formData.parkingSlot.height / formData.parkingSlot.width).toFixed(1)}:1
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">Slot Width (Bay Width, px)</Label>
                      <NumericInput
                        min={40}
                        max={160}
                        step={5}
                        value={formData.parkingSlot.width}
                        onChangeValue={(val) => handleUpdate('parkingSlot', 'width', val)}
                        className="h-9 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                      />
                      <span className="text-[10px] text-slate-500">Standard car stall: 60 - 80px</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-300">Slot Depth / Height (Bay Length, px)</Label>
                      <NumericInput
                        min={60}
                        max={260}
                        step={10}
                        value={formData.parkingSlot.height}
                        onChangeValue={(val) => handleUpdate('parkingSlot', 'height', val)}
                        className="h-9 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                      />
                      <span className="text-[10px] text-slate-500">Standard car stall: 100 - 130px</span>
                    </div>
                  </div>
                </div>

                {/* Smart Slot Alignment & Spacing Assister */}
                <div className="p-4 rounded-lg border border-purple-500/40 bg-purple-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-400">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-purple-200">Slot Smart Assister</h4>
                        <p className="text-xs text-purple-300/70">
                          Automatic Equal Spacing & Same-Line Snapping
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enableSlotAssister !== false}
                        onChange={(e) => setFormData((prev) => ({ ...prev, enableSlotAssister: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                    </label>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    When dragging or moving slots, magnetically locks them into equal spacing with adjacent slots and aligns them in the same row/column with live purple alignment guides and distance badges.
                  </p>
                </div>
              </TabsContent>

              {/* TAB 3: GATES, WALLS & STRUCTURES */}
              <TabsContent value="structures" className="space-y-4 pt-3">
                <p className="text-xs text-slate-400">
                  Dimensions for gates, architectural pillars, masonry walls, and vehicle ramps:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Entrance Gate */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300">Entrance Gate</span>
                      <span className="text-[10px] text-slate-400">Entry Portal</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={60}
                        max={300}
                        value={formData.entranceGate.width}
                        onChangeValue={(val) => handleUpdate('entranceGate', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={20}
                        max={120}
                        value={formData.entranceGate.height}
                        onChangeValue={(val) => handleUpdate('entranceGate', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Exit Gate */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-300">Exit Gate</span>
                      <span className="text-[10px] text-slate-400">Exit Portal</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={60}
                        max={300}
                        value={formData.exitGate.width}
                        onChangeValue={(val) => handleUpdate('exitGate', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={20}
                        max={120}
                        value={formData.exitGate.height}
                        onChangeValue={(val) => handleUpdate('exitGate', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Pillar */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Structural Pillar</span>
                      <span className="text-[10px] text-slate-400">Column</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={20}
                        max={100}
                        value={formData.pillar.width}
                        onChangeValue={(val) => handleUpdate('pillar', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={20}
                        max={100}
                        value={formData.pillar.height}
                        onChangeValue={(val) => handleUpdate('pillar', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Wall */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Masonry Wall</span>
                      <span className="text-[10px] text-slate-400">Barrier</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={40}
                        max={600}
                        value={formData.wall.width}
                        onChangeValue={(val) => handleUpdate('wall', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={8}
                        max={40}
                        value={formData.wall.height}
                        onChangeValue={(val) => handleUpdate('wall', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Lift & Staircase Core */}
                  <div className="p-3.5 rounded-lg border border-sky-500/30 bg-sky-950/20 space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-200">Lift & Staircase Core Area</span>
                      <span className="text-[10px] font-mono text-sky-400 bg-sky-500/20 px-1.5 py-0.5 rounded">
                        Multi-Storey Vertical Shaft
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={80}
                        max={300}
                        value={formData.liftStaircase?.width ?? DEFAULT_PROP_DIMENSIONS.liftStaircase.width}
                        onChangeValue={(val) => handleUpdate('liftStaircase', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={50}
                        max={200}
                        value={formData.liftStaircase?.height ?? DEFAULT_PROP_DIMENSIONS.liftStaircase.height}
                        onChangeValue={(val) => handleUpdate('liftStaircase', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Individual Lift & Staircase */}
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300">Elevator / Lift</span>
                      <span className="text-[10px] text-slate-400">Shaft</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={40}
                        max={180}
                        value={formData.lift?.width ?? DEFAULT_PROP_DIMENSIONS.lift.width}
                        onChangeValue={(val) => handleUpdate('lift', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={40}
                        max={180}
                        value={formData.lift?.height ?? DEFAULT_PROP_DIMENSIONS.lift.height}
                        onChangeValue={(val) => handleUpdate('lift', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300">Staircase / Stairs</span>
                      <span className="text-[10px] text-slate-400">Exit Stairs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={50}
                        max={200}
                        value={formData.staircase?.width ?? DEFAULT_PROP_DIMENSIONS.staircase.width}
                        onChangeValue={(val) => handleUpdate('staircase', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={40}
                        max={150}
                        value={formData.staircase?.height ?? DEFAULT_PROP_DIMENSIONS.staircase.height}
                        onChangeValue={(val) => handleUpdate('staircase', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  {/* Complex Entrance (Mall / Hospital) */}
                  <div className="p-3.5 rounded-lg border border-purple-500/30 bg-purple-950/20 space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-200">Complex Entrance (Mall / Hospital Portal)</span>
                      <span className="text-[10px] font-mono text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
                        Building Connection
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumericInput
                        min={60}
                        max={300}
                        value={formData.buildingEntrance?.width ?? DEFAULT_PROP_DIMENSIONS.buildingEntrance.width}
                        onChangeValue={(val) => handleUpdate('buildingEntrance', 'width', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Width"
                      />
                      <NumericInput
                        min={30}
                        max={150}
                        value={formData.buildingEntrance?.height ?? DEFAULT_PROP_DIMENSIONS.buildingEntrance.height}
                        onChangeValue={(val) => handleUpdate('buildingEntrance', 'height', val)}
                        className="h-8 text-xs font-mono bg-slate-950 border-slate-800 text-white"
                        placeholder="Height"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Retroactive batch update option */}
            {placedElementsCount > 0 && (
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="apply-to-existing-check"
                    checked={applyToExisting}
                    onChange={(e) => setApplyToExisting(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-primary cursor-pointer"
                  />
                  <label htmlFor="apply-to-existing-check" className="text-xs text-slate-300 cursor-pointer select-none">
                    Also apply these dimensions to existing straight lanes & slots already placed on this floor
                  </label>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  {placedElementsCount} elements
                </Badge>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToFactory}
              className="text-xs text-slate-400 hover:text-slate-200 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Defaults
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs border-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-xs"
              >
                <Save className="h-3.5 w-3.5" />
                Save & Apply Defaults
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

