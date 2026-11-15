import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, GitFork } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReplicateLaneNetworkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceFloorName: string;
  sourceFloorNumber: number;
  sourceLanesCount: number;
  availableFloors: Array<{ _id: string; floorName: string; floorNumber: number }>;
  currentFloorId: string;
  onReplicate: (targetFloorIds: string[], replaceExisting: boolean) => Promise<void>;
}

export const ReplicateLaneNetworkModal: React.FC<ReplicateLaneNetworkModalProps> = ({
  open,
  onOpenChange,
  sourceFloorName,
  sourceFloorNumber,
  sourceLanesCount,
  availableFloors,
  currentFloorId,
  onReplicate,
}) => {
  // Candidate target floors (exclude current floor)
  const candidateFloors = availableFloors.filter((f) => f._id !== currentFloorId);

  // Default selection: all upper floors (or candidate floors)
  const [selectedFloorIds, setSelectedFloorIds] = useState<string[]>(() =>
    candidateFloors.map((f) => f._id),
  );
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const toggleFloor = (id: string) => {
    setSelectedFloorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    setSelectedFloorIds(candidateFloors.map((f) => f._id));
  };

  const handleDeselectAll = () => {
    setSelectedFloorIds([]);
  };

  const handleSubmit = async () => {
    if (selectedFloorIds.length === 0 || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onReplicate(selectedFloorIds, replaceExisting);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/80 text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <GitFork className="h-5 w-5 text-cyan-400" />
            <span>Replicate Lane Network to Upper Floors</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Copy the complete internal driving lane layout from{' '}
            <strong className="text-foreground">
              {sourceFloorName} (L{sourceFloorNumber})
            </strong>{' '}
            to upper floors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Source Floor Overview */}
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">Source Floor:</span>
              <span className="font-bold text-cyan-300">
                {sourceFloorName} (Level {sourceFloorNumber})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">Lane Segments:</span>
              <Badge variant="outline" className="font-mono text-cyan-400 border-cyan-500/40">
                {sourceLanesCount} Driving Lanes
              </Badge>
            </div>
          </div>

          {/* Target Floors Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Target Upper Floors ({selectedFloorIds.length}/{candidateFloors.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline underline-offset-2"
                >
                  Select All
                </button>
                <span className="text-muted-foreground text-[10px]">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[10px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer underline underline-offset-2"
                >
                  Clear
                </button>
              </div>
            </div>

            {candidateFloors.length === 0 ? (
              <div className="p-3 text-center rounded-md border border-border/60 bg-muted/20 text-muted-foreground">
                No other floors available in this facility to replicate to.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 rounded-md border border-border/60 bg-muted/10 p-2">
                {candidateFloors.map((floor) => {
                  const isChecked = selectedFloorIds.includes(floor._id);
                  return (
                    <label
                      key={floor._id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-md border transition-all cursor-pointer',
                        isChecked
                          ? 'border-cyan-500/50 bg-cyan-950/30 text-foreground'
                          : 'border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFloor(floor._id)}
                          className="rounded border-border/80 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span className="font-semibold text-xs">
                          {floor.floorName} (L{floor.floorNumber})
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] font-mono',
                          isChecked ? 'bg-cyan-500/20 text-cyan-300' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        Level {floor.floorNumber}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Option: Replace existing lanes */}
          <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-border/60 bg-muted/20 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="rounded border-border/80 text-cyan-500 focus:ring-cyan-500 mt-0.5 cursor-pointer"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Replace existing driving lanes on target floors
              </span>
              <span className="text-[10px] text-muted-foreground leading-relaxed block">
                Recommended: clears any older unaligned lane fragments on target floors and cleanly drops the replicated network.
              </span>
            </div>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={selectedFloorIds.length === 0 || isSubmitting}
            className="text-xs font-semibold gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>
              {isSubmitting
                ? 'Replicating...'
                : `Replicate to ${selectedFloorIds.length} Floor${selectedFloorIds.length === 1 ? '' : 's'}`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
