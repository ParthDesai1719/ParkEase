import React from 'react';
import { Link } from 'react-router-dom';
import type { DesignerMode, ToolType } from './types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  UploadCloud,
  Eye,
  Edit3,
  MousePointer,
  Hand,
  Grid,
  Ruler,
  Scaling,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  Layers,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  AlignJustify,
  Undo2,
  Redo2,
} from 'lucide-react';

interface DesignerToolbarProps {
  parkingLotId: string;
  parkingLotName: string;
  floors: Array<{ _id: string; floorName: string; floorNumber: number }>;
  currentFloorId: string;
  onFloorChange: (floorId: string) => void;
  status: string;
  version: number;
  isPublished: boolean;
  isValidated: boolean;
  mode: DesignerMode;
  onModeChange: (mode: DesignerMode) => void;
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onResetView: () => void;
  onFitToScreen?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showRulers?: boolean;
  onToggleRulers?: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  showZoneHighlights?: boolean;
  onToggleZoneHighlights?: () => void;
  enableSlotAssister?: boolean;
  onToggleSlotAssister?: () => void;
  isSettingsOpen?: boolean;
  onOpenPropDefaults?: () => void;
  isSaving: boolean;
  isAutoSaving?: boolean;
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  isValidating: boolean;
  onValidate: () => void;
  isPublishing: boolean;
  onPublish: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const DesignerToolbar: React.FC<DesignerToolbarProps> = ({
  parkingLotId,
  parkingLotName,
  floors,
  currentFloorId,
  onFloorChange,
  status,
  version,
  isPublished,
  isValidated,
  mode,
  onModeChange,
  activeTool,
  onToolChange,
  zoom,
  onZoomChange,
  onResetView,
  isFullscreen = false,
  onToggleFullscreen,
  showGrid,
  onToggleGrid,
  showRulers = true,
  onToggleRulers,
  snapToGrid,
  onToggleSnap,
  showZoneHighlights = true,
  onToggleZoneHighlights,
  enableSlotAssister = true,
  onToggleSlotAssister,
  isSettingsOpen: _isSettingsOpen = false,
  onOpenPropDefaults,
  isSaving,
  isAutoSaving = false,
  hasUnsavedChanges,
  onSaveDraft,
  isValidating,
  onValidate,
  isPublishing,
  onPublish,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  return (
    <header className="h-14 border-b border-border/80 bg-card/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-3 text-foreground select-none shrink-0 z-30">
      {/* 1. LEFT: Back Button, Facility Identity & Floor Switcher */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
        >
          <Link to={`/admin/parking-lots/${parkingLotId}`} title="Back to Parking Lot Hierarchy">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="h-5 w-px bg-border/60 shrink-0" />

        {/* Status Pill Badge */}
        <div className="flex items-center shrink-0" title={parkingLotName}>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wide whitespace-nowrap shrink-0 border select-none',
              isPublished
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isValidated
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                isPublished
                  ? 'bg-emerald-400'
                  : isValidated
                  ? 'bg-blue-400'
                  : 'bg-amber-400 animate-pulse',
              )}
            />
            {status} v{version}
          </span>
        </div>

        <div className="h-5 w-px bg-border/60 shrink-0 hidden sm:block" />

        {/* Floor Switcher Dropdown */}
        <div className="relative flex items-center shrink-0">
          <Layers className="absolute left-2.5 h-3.5 w-3.5 text-primary pointer-events-none" />
          <select
            value={currentFloorId}
            onChange={(e) => onFloorChange(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs font-semibold bg-muted/40 hover:bg-muted/70 border border-border/70 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors appearance-none"
            title="Switch Parking Floor"
          >
            {floors.map((fl) => (
              <option key={fl._id} value={fl._id}>
                {fl.floorName} (L{fl.floorNumber})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* 2. CENTER: View Mode, Canvas Tools, Grid/Snap & Zoom */}
      <div className="flex items-center gap-2">
        {/* Mode Switcher: Design vs Customer Preview */}
        <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onModeChange('edit')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all',
              mode === 'edit'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Design</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('preview')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all',
              mode === 'preview'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>
        </div>

        {/* Tools: Pointer vs Hand Pan */}
        {mode === 'edit' && (
          <div className="hidden lg:flex items-center rounded-lg border border-border/70 bg-muted/30 p-0.5 shrink-0">
            <Button
              type="button"
              variant={activeTool === 'select' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7 rounded-sm"
              onClick={() => onToolChange('select')}
              title="Select & Move (V)"
            >
              <MousePointer className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={activeTool === 'pan' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7 rounded-sm"
              onClick={() => onToolChange('pan')}
              title="Pan Canvas (H)"
            >
              <Hand className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant={activeTool === 'measure' ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'h-7 w-7 rounded-sm transition-colors',
                activeTool === 'measure' && 'bg-amber-500/20 text-amber-400 border border-amber-500/50',
              )}
              onClick={() => onToolChange(activeTool === 'measure' ? 'select' : 'measure')}
              title="Distance Scaler (M): Click any two props to measure distance"
            >
              <Scaling className="h-3.5 w-3.5" />
            </Button>

            {/* Undo / Redo */}
            <div className="flex items-center border-l border-border/60 pl-1 ml-0.5 gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canUndo}
                className={cn('h-7 w-7 rounded-sm cursor-pointer', !canUndo && 'opacity-30 cursor-not-allowed')}
                onClick={onUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canRedo}
                className={cn('h-7 w-7 rounded-sm cursor-pointer', !canRedo && 'opacity-30 cursor-not-allowed')}
                onClick={onRedo}
                title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Grid & Snap Toggles */}
        <div className="hidden md:flex items-center gap-0.5 border-l border-border/60 pl-2 shrink-0">
          <Button
            type="button"
            variant={showGrid ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onToggleGrid}
            title={showGrid ? 'Hide Grid' : 'Show Grid'}
          >
            <Grid className="h-3.5 w-3.5" />
          </Button>

          {onToggleRulers && (
            <Button
              type="button"
              variant={showRulers ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'h-7 w-7',
                showRulers ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={onToggleRulers}
              title={showRulers ? 'Hide Block Grid Scales (Rulers)' : 'Show Block Grid Scales (Rulers)'}
            >
              <Ruler className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            type="button"
            variant={snapToGrid ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'h-7 w-7',
              snapToGrid ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={onToggleSnap}
            title={snapToGrid ? 'Snap to Grid: ON' : 'Snap to Grid: OFF'}
          >
            <Magnet className="h-3.5 w-3.5" />
          </Button>

          {onToggleZoneHighlights && (
            <Button
              type="button"
              variant={showZoneHighlights ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'h-7 w-7 transition-colors',
                showZoneHighlights
                  ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={onToggleZoneHighlights}
              title={showZoneHighlights ? 'Hide Zone Highlighters (Z)' : 'Highlight Parking Zones (Z)'}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}

          {onToggleSlotAssister && (
            <Button
              type="button"
              variant={enableSlotAssister ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'h-7 w-7 transition-colors',
                enableSlotAssister
                  ? 'text-purple-400 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={onToggleSlotAssister}
              title={
                enableSlotAssister
                  ? 'Smart Slot Assister (Alignment & Equal Spacing): ON'
                  : 'Smart Slot Assister (Alignment & Equal Spacing): OFF'
              }
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </Button>
          )}

          {onOpenPropDefaults && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onOpenPropDefaults}
              title="Default Prop Dimensions & Settings"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="hidden sm:flex items-center gap-0.5 border-l border-border/60 pl-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onZoomChange(Math.max(zoom - 0.15, 0.3))}
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          <span className="text-[11px] font-mono font-semibold w-10 text-center text-muted-foreground select-none">
            {Math.round(zoom * 100)}%
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onZoomChange(Math.min(zoom + 0.15, 3.0))}
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground text-[10px] font-mono font-bold"
            onClick={onResetView}
            title="Reset View (100%)"
          >
            1:1
          </Button>
        </div>
      </div>

      {/* 3. RIGHT: Actions (Fullscreen, Save, Validate, Publish) */}
      <div className="flex items-center gap-2 shrink-0">
        {onToggleFullscreen && (
          <Button
            type="button"
            variant={isFullscreen ? 'secondary' : 'outline'}
            size="icon"
            onClick={onToggleFullscreen}
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Expand Canvas to Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        )}

        {/* Save Draft Button (Shows loader on auto-save and manual save) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSaveDraft()}
          disabled={isSaving || isAutoSaving}
          className="h-8 text-xs font-semibold gap-1.5 shrink-0 cursor-pointer"
          title="Save Draft (Ctrl+S)"
        >
          {isSaving || isAutoSaving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isAutoSaving ? 'Auto-saving...' : isSaving ? 'Saving...' : 'Save Draft'}
          </span>
          {hasUnsavedChanges && !isSaving && !isAutoSaving && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onValidate}
          disabled={isValidating}
          className={cn(
            'h-8 text-xs font-semibold gap-1.5 shrink-0',
            isValidated && 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20',
          )}
          title="Run Structural Validation"
        >
          {isValidating ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Validate</span>
        </Button>

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onPublish}
          disabled={isPublishing || !isValidated}
          className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
          title={isValidated ? 'Publish Official Layout' : 'Validate layout before publishing'}
        >
          {isPublishing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UploadCloud className="h-3.5 w-3.5" />
          )}
          <span>Publish</span>
        </Button>
      </div>
    </header>
  );
};
