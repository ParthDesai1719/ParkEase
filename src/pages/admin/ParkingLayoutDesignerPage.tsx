import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  getOfficialParkingLotHierarchy,
  getFloorLayout,
  initDraftLayout,
  saveLayoutElements,
  validateDraftLayout,
  publishDraftLayout,
  replicateLaneNetwork,
  updateFacilityCanvasBoundary,
  type LayoutElementData,
  type LayoutCanvasConfig,
  type OfficialParkingLotHierarchy,
  type OfficialHierarchyZone,
} from '@/api/parkingLot.api';
import type {
  DesignerMode,
  ToolType,
  UnplacedSlotItem,
  LaneConnectionType,
  PropDimensionDefaults,
} from '@/components/layout-designer/types';
import {
  DEFAULT_PROP_DIMENSIONS,
  mergePropDefaults,
  clampElementInsideBounds,
} from '@/components/layout-designer/types';
import { DesignerToolbar } from '@/components/layout-designer/DesignerToolbar';
import { ElementsPalette } from '@/components/layout-designer/ElementsPalette';
import { CanvasViewport } from '@/components/layout-designer/CanvasViewport';
import { PropertyInspector } from '@/components/layout-designer/PropertyInspector';
import { PropDefaultsModal } from '@/components/layout-designer/PropDefaultsModal';
import { ReplicateLaneNetworkModal } from '@/components/layout-designer/ReplicateLaneNetworkModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, UploadCloud, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export function isGroundFloorCheck(
  floor?: { floorNumber?: number; floorName?: string; _id?: string } | null,
  allFloors?: Array<{ floorNumber?: number; floorName?: string; _id?: string }> | null,
): boolean {
  if (!floor) return false;
  if (floor.floorNumber === 0) return true;
  const name = (floor.floorName || '').trim().toLowerCase();
  if (
    name === 'g' ||
    name === 'ground' ||
    name === 'g floor' ||
    name === 'ground floor' ||
    name === 'floor g' ||
    name === 'level g' ||
    name.startsWith('g ') ||
    name.startsWith('g-') ||
    name.startsWith('g_') ||
    name.includes('ground')
  ) {
    return true;
  }
  if (allFloors && allFloors.length > 0) {
    const minFloorNumber = Math.min(
      ...allFloors.map((f) => (f.floorNumber != null ? f.floorNumber : 0)),
    );
    if (floor.floorNumber === minFloorNumber) {
      return true;
    }
  }
  return false;
}

export const ParkingLayoutDesignerPage: React.FC = () => {
  const { id: parkingLotId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected floor query parameter
  const targetFloorId = searchParams.get('floorId') || '';

  // Data states
  const [hierarchy, setHierarchy] = useState<OfficialParkingLotHierarchy | null>(null);
  const hierarchyRef = useRef<OfficialParkingLotHierarchy | null>(null);
  useEffect(() => {
    hierarchyRef.current = hierarchy;
  }, [hierarchy]);
  const [currentFloorId, setCurrentFloorId] = useState<string>('');
  const [layoutVersion, setLayoutVersion] = useState<number>(1);
  const [layoutStatus, setLayoutStatus] = useState<string>('Draft');
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Canvas Config & Elements
  const masterFacilityBoundaryRef = useRef<{ width: number; height: number } | null>(null);

  // Restore cached master facility boundary for this parking lot
  useEffect(() => {
    if (!parkingLotId) return;
    try {
      const stored = localStorage.getItem(`parkease_facility_boundary_${parkingLotId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.width && parsed?.height) {
          masterFacilityBoundaryRef.current = {
            width: Number(parsed.width),
            height: Number(parsed.height),
          };
          setCanvasConfig((prev) => ({
            ...prev,
            width: Number(parsed.width),
            height: Number(parsed.height),
          }));
        }
      }
    } catch {
      // ignore
    }
  }, [parkingLotId]);
  const [canvasConfig, setCanvasConfig] = useState<LayoutCanvasConfig>({
    width: 1600,
    height: 1000,
    gridSize: 20,
    snapToGrid: true,
    backgroundColor: '#0f172a',
  });
  const [elements, setElements] = useState<LayoutElementData[]>([]);
  const [unplacedSlots, setUnplacedSlots] = useState<UnplacedSlotItem[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Designer viewport states
  const [mode, setMode] = useState<DesignerMode>('edit');
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(80);
  const [panY, setPanY] = useState<number>(40);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showZoneHighlights, setShowZoneHighlights] = useState<boolean>(true);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState<boolean>(false);

  // Status flags
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Modals & Settings
  const [validationModalOpen, setValidationModalOpen] = useState<boolean>(false);
  const [publishModalOpen, setPublishModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [propDefaultsModalOpen, setPropDefaultsModalOpen] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'settings'>('properties');
  const [inspectorCollapsed, setInspectorCollapsed] = useState<boolean>(false);
  const [clipboardElement, setClipboardElement] = useState<LayoutElementData | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [highlightedElementId, setHighlightedElementId] = useState<string | null>(null);

  // Undo / Redo History Stack (Ctrl+Z / Ctrl+Y)
  const historyRef = useRef<Array<{ elements: LayoutElementData[]; canvasConfig: LayoutCanvasConfig }>>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoActionRef = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Lane Network Clipboard (Persisted across floor switches in localStorage)
  const [laneNetworkClipboard, setLaneNetworkClipboard] = useState<{
    sourceFloorId: string;
    sourceFloorName: string;
    timestamp: number;
    lanes: LayoutElementData[];
  } | null>(() => {
    try {
      const saved = localStorage.getItem('parkease_lane_clipboard');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Replicate Lanes Modal
  const [replicateLanesModalOpen, setReplicateLanesModalOpen] = useState<boolean>(false);

  // User-configured default prop dimensions (persisted in localStorage)
  const [propDefaults, setPropDefaults] = useState<PropDimensionDefaults>(() => {
    try {
      const saved = localStorage.getItem('parkease_prop_dimensions');
      if (saved) return mergePropDefaults(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load saved prop dimensions:', e);
    }
    return DEFAULT_PROP_DIMENSIONS;
  });

  const handleSavePropDefaults = (newDefaults: PropDimensionDefaults, applyToExisting = false) => {
    setPropDefaults(newDefaults);
    try {
      localStorage.setItem('parkease_prop_dimensions', JSON.stringify(newDefaults));
    } catch (e) {
      console.error('Failed to save prop dimensions:', e);
    }

    if (applyToExisting) {
      setElements((prevElements) =>
        prevElements.map((el) => {
          if (el.elementType === 'ParkingSlot') {
            return { ...el, width: newDefaults.parkingSlot.width, height: newDefaults.parkingSlot.height };
          }
          if (el.elementType === 'DrivingLane') {
            const isCorner = el.label?.includes('Turn') || el.label?.includes('Corner');
            const isTJunction = el.label?.includes('T-Junction');
            const isSquare =
              el.label?.includes('Square') || el.label?.includes('Connector') || el.label?.includes('Hub');
            if (isSquare) {
              return { ...el, width: newDefaults.squareConnector.width, height: newDefaults.squareConnector.height };
            }
            if (isTJunction) {
              return { ...el, width: newDefaults.tJunction.width, height: newDefaults.tJunction.height };
            }
            if (isCorner) {
              return { ...el, width: newDefaults.cornerTurn.width, height: newDefaults.cornerTurn.height };
            }
            if (el.width >= el.height) {
              return { ...el, width: newDefaults.straightLane.width, height: newDefaults.straightLane.height };
            } else {
              return { ...el, width: newDefaults.straightLane.height, height: newDefaults.straightLane.width };
            }
          }
          if (el.elementType === 'Entrance') {
            return { ...el, width: newDefaults.entranceGate.width, height: newDefaults.entranceGate.height };
          }
          if (el.elementType === 'Exit') {
            return { ...el, width: newDefaults.exitGate.width, height: newDefaults.exitGate.height };
          }
          if (el.elementType === 'Pillar') {
            return { ...el, width: newDefaults.pillar.width, height: newDefaults.pillar.height };
          }
          if (el.elementType === 'Wall') {
            return { ...el, width: newDefaults.wall.width, height: newDefaults.wall.height };
          }
          if (el.elementType === 'Ramp' || el.elementType === 'RampPortal') {
            return { ...el, width: newDefaults.ramp.width, height: newDefaults.ramp.height };
          }
          return el;
        }),
      );
      setHasUnsavedChanges(true);
      toast.success('Updated existing elements on canvas to match new dimensions!');
    }
  };

  // Available floors
  const floors = useMemo(() => {
    return hierarchy?.floors.map((fl) => ({
      _id: fl._id,
      floorName: fl.floorName,
      floorNumber: fl.floorNumber,
    })) || [];
  }, [hierarchy]);

  // Current Floor Object
  const currentFloor = useMemo(() => {
    return hierarchy?.floors.find((f) => f._id === currentFloorId);
  }, [hierarchy, currentFloorId]);

  // Master Floor check: Facility boundary can only be changed from Ground Floor
  const isGroundFloor = useMemo(() => {
    return isGroundFloorCheck(currentFloor, hierarchy?.floors);
  }, [currentFloor, hierarchy]);

  // Selected element object
  const selectedElement = useMemo(() => {
    return elements.find((el) => el.elementId === selectedElementId) || null;
  }, [elements, selectedElementId]);

  // Load Lot Hierarchy and Floor Layout
  const loadFloorLayoutData = useCallback(
    async (lotId: string, floorId: string) => {
      try {
        setLoading(true);
        setSelectedElementId(null);

        // Fetch or initialize layout
        let layoutRes = await getFloorLayout(lotId, floorId);

        if (!layoutRes.data?.layout) {
          // Initialize draft
          const initRes = await initDraftLayout(lotId, floorId);
          if (initRes.success && initRes.data?.layout) {
            layoutRes = await getFloorLayout(lotId, floorId);
          }
        }

        if (layoutRes.success && layoutRes.data) {
          const lData = layoutRes.data.layout;
          if (lData) {
            setLayoutVersion(lData.version);
            setLayoutStatus(lData.status);
            setIsPublished(Boolean(lData.isPublished));
            setIsValidated(Boolean(lData.isValidated));
            setValidationErrors(lData.validationErrors || []);

            // Identify whether the requested floor is Ground Floor via live hierarchy ref
            const allFloors = hierarchyRef.current?.floors || [];
            const targetFloor = allFloors.find((f) => f._id === floorId);
            const isGround = isGroundFloorCheck(targetFloor, allFloors);

            // Adopt server canvasConfig only if client does not already have an active master boundary
            if (!masterFacilityBoundaryRef.current && lData.canvasConfig?.width && lData.canvasConfig?.height) {
              masterFacilityBoundaryRef.current = {
                width: lData.canvasConfig.width,
                height: lData.canvasConfig.height,
              };
              try {
                localStorage.setItem(
                  `parkease_facility_boundary_${lotId}`,
                  JSON.stringify(masterFacilityBoundaryRef.current),
                );
              } catch {
                // ignore
              }
            } else if (isGround && lData.canvasConfig?.width && lData.canvasConfig?.height && !localStorage.getItem(`parkease_facility_boundary_${lotId}`)) {
              masterFacilityBoundaryRef.current = {
                width: lData.canvasConfig.width,
                height: lData.canvasConfig.height,
              };
            }

            // Facility boundary must remain strictly locked and equal across all floors of this facility.
            // Both Ground Floor and upper floors adhere to the master facility boundary so ratios never drift or change.
            const effectiveWidth =
              masterFacilityBoundaryRef.current?.width ||
              lData.canvasConfig?.width ||
              1600;
            const effectiveHeight =
              masterFacilityBoundaryRef.current?.height ||
              lData.canvasConfig?.height ||
              1000;

            const floorZones = targetFloor?.zones || hierarchyRef.current?.floors.find((f) => f._id === floorId)?.zones || [];
            const zoneLookup = new Map(floorZones.map((z) => [z._id, z]));
            const slotLookup = new Map<string, OfficialHierarchyZone>();
            for (const z of floorZones) {
              for (const s of z.slots || []) {
                slotLookup.set(s._id, z);
              }
            }

            const enrichedElements: LayoutElementData[] = (lData.elements || []).map((el: LayoutElementData) => {
              if (el.elementType !== 'ParkingSlot') return el;
              let zCode = el.zoneCode;
              let zName = el.zoneName;
              let zId = el.zoneId;

              if (el.slotId && slotLookup.has(el.slotId)) {
                const z = slotLookup.get(el.slotId)!;
                zCode = z.zoneCode;
                zName = z.zoneName;
                zId = z._id;
              } else if (el.zoneId && zoneLookup.has(String(el.zoneId))) {
                const z = zoneLookup.get(String(el.zoneId))!;
                zCode = z.zoneCode;
                zName = z.zoneName;
              } else if (!zCode && el.slotNumber) {
                const match = el.slotNumber.match(/^([A-Za-z]+)/);
                if (match) {
                  zCode = match[1].toUpperCase();
                  zName = `Zone ${zCode}`;
                }
              }

              return {
                ...el,
                zoneCode: zCode || el.zoneCode || 'A',
                zoneName: zName || el.zoneName || `Zone ${zCode || 'A'}`,
                zoneId: zId || el.zoneId,
              };
            });

            const loadedCanvasConfig = {
              width: effectiveWidth,
              height: effectiveHeight,
              gridSize: lData.canvasConfig?.gridSize || 20,
              snapToGrid: lData.canvasConfig?.snapToGrid ?? true,
              backgroundColor: lData.canvasConfig?.backgroundColor || '#0f172a',
            };

            setCanvasConfig(loadedCanvasConfig);
            setElements(enrichedElements);

            // Initialize undo history stack for this floor layout
            historyRef.current = [
              {
                elements: JSON.parse(JSON.stringify(enrichedElements)),
                canvasConfig: { ...loadedCanvasConfig },
              },
            ];
            historyIndexRef.current = 0;
            setCanUndo(false);
            setCanRedo(false);
          } else {
            setElements([]);
            historyRef.current = [
              {
                elements: [],
                canvasConfig: { ...canvasConfig },
              },
            ];
            historyIndexRef.current = 0;
            setCanUndo(false);
            setCanRedo(false);
          }

          setUnplacedSlots((layoutRes.data.unplacedSlots as UnplacedSlotItem[]) || []);
          setHasUnsavedChanges(false);
        }
      } catch (err: any) {
        console.error('Failed to load floor layout:', err);
        toast.error(err?.response?.data?.message || 'Failed to load floor layout.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Initial load
  useEffect(() => {
    if (!parkingLotId) return;

    async function init() {
      try {
        setLoading(true);
        const hierRes = await getOfficialParkingLotHierarchy(parkingLotId!);
        if (hierRes.success && hierRes.data) {
          setHierarchy(hierRes.data);
          hierarchyRef.current = hierRes.data;
          const firstFloor =
            hierRes.data.floors.find((f) => f._id === targetFloorId) || hierRes.data.floors[0];
          if (firstFloor) {
            setCurrentFloorId(firstFloor._id);
            await loadFloorLayoutData(parkingLotId!, firstFloor._id);
          }
        }
      } catch (err: any) {
        console.error('Failed to initialize designer:', err);
        toast.error('Failed to load parking structure hierarchy.');
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [parkingLotId, targetFloorId, loadFloorLayoutData]);

  // Floor switch handler
  const handleFloorChange = async (newFloorId: string) => {
    if (newFloorId === currentFloorId) return;

    // If on Ground Floor with unsaved boundary/layout changes, auto-save so upper floors strictly sync
    if (isGroundFloor && hasUnsavedChanges) {
      try {
        await handleSaveDraft(true);
      } catch (saveErr) {
        console.warn('Auto-save Ground Floor boundary before floor transition failed:', saveErr);
      }
    } else if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes on the current floor. Discard and switch floor?',
      );
      if (!confirmLeave) return;
    }

    setCurrentFloorId(newFloorId);
    setSearchParams({ floorId: newFloorId });
    if (parkingLotId) {
      await loadFloorLayoutData(parkingLotId, newFloorId);
    }
  };

  // Center / reset view
  const handleResetView = useCallback(() => {
    setZoom(1.0);
    setPanX(60);
    setPanY(40);
  }, []);

  // Auto-fit entire floor canvas to visible viewport
  const handleFitToScreen = useCallback(() => {
    const sidebarWidth = paletteCollapsed || mode === 'preview' ? 48 : 288;
    const inspectorWidth = selectedElementId && mode === 'edit' ? 288 : 0;
    const availableW = window.innerWidth - sidebarWidth - inspectorWidth - 60;
    const availableH = window.innerHeight - 110;
    const fitZoom = Math.min(availableW / canvasConfig.width, availableH / canvasConfig.height, 1.25);
    const rounded = Math.max(0.2, Math.round(fitZoom * 100) / 100);
    const centerPanX = Math.round((availableW - canvasConfig.width * rounded) / 2) + 20;
    const centerPanY = Math.round((availableH - canvasConfig.height * rounded) / 2) + 20;
    setZoom(rounded);
    setPanX(Math.max(36, centerPanX));
    setPanY(Math.max(36, centerPanY));
    toast.success(`Canvas fitted to screen (${Math.round(rounded * 100)}%)`);
  }, [paletteCollapsed, mode, selectedElementId, canvasConfig.width, canvasConfig.height]);

  // Record History Snapshot for Undo/Redo (Ctrl+Z)
  const recordHistorySnapshot = useCallback(
    (newElements: LayoutElementData[], newCanvasConfig?: LayoutCanvasConfig) => {
      if (isUndoRedoActionRef.current) return;
      const cfg = newCanvasConfig || canvasConfig;
      const nextSnapshot = {
        elements: JSON.parse(JSON.stringify(newElements)),
        canvasConfig: { ...cfg },
      };

      // Discard any redo branch beyond current pointer
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);

      // Avoid pushing duplicates
      const last = newHistory[newHistory.length - 1];
      if (
        last &&
        JSON.stringify(last.elements) === JSON.stringify(nextSnapshot.elements) &&
        last.canvasConfig.width === nextSnapshot.canvasConfig.width &&
        last.canvasConfig.height === nextSnapshot.canvasConfig.height
      ) {
        return;
      }

      if (newHistory.length >= 40) {
        newHistory.shift();
      }

      newHistory.push(nextSnapshot);
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
    },
    [canvasConfig],
  );

  // Undo (Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    const targetIdx = historyIndexRef.current - 1;
    const targetSnapshot = historyRef.current[targetIdx];
    if (!targetSnapshot) return;

    isUndoRedoActionRef.current = true;
    historyIndexRef.current = targetIdx;
    setElements(JSON.parse(JSON.stringify(targetSnapshot.elements)));
    setCanvasConfig({ ...targetSnapshot.canvasConfig });
    setHasUnsavedChanges(true);
    setIsValidated(false);
    setSelectedElementId(null);
    setCanUndo(targetIdx > 0);
    setCanRedo(targetIdx < historyRef.current.length - 1);
    toast.info('Undo (Ctrl+Z)');
    setTimeout(() => {
      isUndoRedoActionRef.current = false;
    }, 50);
  }, []);

  // Redo (Ctrl+Y or Ctrl+Shift+Z)
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const targetIdx = historyIndexRef.current + 1;
    const targetSnapshot = historyRef.current[targetIdx];
    if (!targetSnapshot) return;

    isUndoRedoActionRef.current = true;
    historyIndexRef.current = targetIdx;
    setElements(JSON.parse(JSON.stringify(targetSnapshot.elements)));
    setCanvasConfig({ ...targetSnapshot.canvasConfig });
    setHasUnsavedChanges(true);
    setIsValidated(false);
    setSelectedElementId(null);
    setCanUndo(targetIdx > 0);
    setCanRedo(targetIdx < historyRef.current.length - 1);
    toast.info('Redo (Ctrl+Y)');
    setTimeout(() => {
      isUndoRedoActionRef.current = false;
    }, 50);
  }, []);

  // Copy Whole Lane Network to Clipboard
  const handleCopyLaneNetwork = useCallback(() => {
    const lanes = elements.filter((el) => el.elementType === 'DrivingLane');
    if (lanes.length === 0) {
      toast.info('No driving lanes found on this floor to copy.');
      return;
    }

    const clipboardData = {
      sourceFloorId: currentFloorId || '',
      sourceFloorName: currentFloor?.floorName || 'Floor',
      timestamp: Date.now(),
      lanes: JSON.parse(JSON.stringify(lanes)),
    };

    setLaneNetworkClipboard(clipboardData);
    try {
      localStorage.setItem('parkease_lane_clipboard', JSON.stringify(clipboardData));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
    toast.success(
      `Copied whole lane network (${lanes.length} lanes) from ${currentFloor?.floorName}! Switch to an upper floor and click "Paste Lanes".`,
    );
  }, [elements, currentFloorId, currentFloor]);

  // Paste Whole Lane Network from Clipboard
  const handlePasteLaneNetwork = useCallback(() => {
    if (!laneNetworkClipboard || !laneNetworkClipboard.lanes || laneNetworkClipboard.lanes.length === 0) {
      toast.info('No lane network in clipboard. Use "Copy Lanes" on Ground Floor first.');
      return;
    }

    // Generate new unique element IDs and remap connectedLaneIds
    const idMap = new Map<string, string>();
    const clonedLanes = laneNetworkClipboard.lanes.map((lane) => {
      const newId = `LANE-${Date.now().toString(36)}-${Math.floor(Math.random() * 9000 + 1000)}`;
      idMap.set(lane.elementId, newId);
      return {
        ...lane,
        elementId: newId,
      };
    });

    const remappedLanes = clonedLanes.map((lane) => ({
      ...lane,
      connectedLaneIds: (lane.connectedLaneIds || []).map((oldId) => idMap.get(oldId) || oldId),
    }));

    setElements((prev) => {
      // Replace existing driving lanes on this floor with the cleanly copied network
      const nonLaneElements = prev.filter((el) => el.elementType !== 'DrivingLane');
      const updated = [...nonLaneElements, ...remappedLanes];
      recordHistorySnapshot(updated);
      return updated;
    });

    setHasUnsavedChanges(true);
    setIsValidated(false);
    toast.success(
      `Pasted whole lane network (${remappedLanes.length} lanes) from ${laneNetworkClipboard.sourceFloorName} onto ${currentFloor?.floorName || 'this floor'}!`,
    );
  }, [laneNetworkClipboard, currentFloor, recordHistorySnapshot]);

  // Replicate Lane Network to Multiple Upper Floors via Backend API
  const handleReplicateLaneNetwork = useCallback(
    async (targetFloorIds: string[], replaceExisting: boolean) => {
      if (!parkingLotId || !currentFloorId) return;
      try {
        const res = await replicateLaneNetwork(parkingLotId, currentFloorId, {
          targetFloorIds,
          replaceExisting,
        });
        if (res.success && res.data) {
          toast.success(res.data.message || 'Lane network replicated to upper floors successfully!');
          if (targetFloorIds.includes(currentFloorId)) {
            await loadFloorLayoutData(parkingLotId, currentFloorId);
          }
        }
      } catch (err: any) {
        console.error('Failed to replicate lane network:', err);
        toast.error(err?.response?.data?.message || 'Failed to replicate lane network to upper floors.');
      }
    },
    [parkingLotId, currentFloorId, loadFloorLayoutData],
  );

  // Save Draft (explicit or silent auto-save)
  const handleSaveDraft = useCallback(
    async (isAutoOrEvent: boolean | React.SyntheticEvent = false) => {
      const isAuto = typeof isAutoOrEvent === 'boolean' ? isAutoOrEvent : false;
      if (!parkingLotId || !currentFloorId || isSaving || isAutoSaving) return;

      // Validate slot linkages upfront
      const unlinkedSlots = elements.filter((el) => el.elementType === 'ParkingSlot' && !el.slotId);
      if (unlinkedSlots.length > 0) {
        if (!isAuto) {
          toast.error(
            `Cannot save: ${unlinkedSlots.length} parking slot(s) on canvas are not linked to official slots. Delete them or link them from the Official Floor Slots palette.`,
          );
        }
        return;
      }

      try {
        if (isAuto) {
          setIsAutoSaving(true);
        } else {
          setIsSaving(true);
        }

        const sanitizedElements: LayoutElementData[] = elements.map((el) => ({
          ...el,
          slotId: el.slotId ? String(el.slotId).trim() : null,
          zoneId: el.zoneId ? String(el.zoneId).trim() : null,
          zoneCode: el.zoneCode ? String(el.zoneCode).trim() : null,
          zoneName: el.zoneName ? String(el.zoneName).trim() : null,
          targetFloorId: el.targetFloorId ? String(el.targetFloorId).trim() : null,
          x: Math.round(Number(el.x || 0) * 10) / 10,
          y: Math.round(Number(el.y || 0) * 10) / 10,
          width: Math.max(1, Math.round(Number(el.width || 10) * 10) / 10),
          height: Math.max(1, Math.round(Number(el.height || 10) * 10) / 10),
          rotation: Math.round((((Number(el.rotation || 0) % 360) + 360) % 360) * 10) / 10,
          occupiesAllFloors: el.occupiesAllFloors,
          syncAcrossAllFloors: el.syncAcrossAllFloors,
          shaftGroupId: el.shaftGroupId,
          buildingType: el.buildingType,
          connectedLaneIds: Array.isArray(el.connectedLaneIds) ? el.connectedLaneIds : [],
          navPointers: Array.isArray(el.navPointers)
            ? el.navPointers.map((p) => ({
                id: p.id,
                targetLaneId: p.targetLaneId ? String(p.targetLaneId).trim() : null,
                curbX: p.curbX != null ? Math.round(Number(p.curbX) * 10) / 10 : null,
                curbY: p.curbY != null ? Math.round(Number(p.curbY) * 10) / 10 : null,
              }))
            : undefined,
        }));

        const res = await saveLayoutElements(parkingLotId, currentFloorId, {
          elements: sanitizedElements,
          canvasConfig: {
            ...canvasConfig,
            width: masterFacilityBoundaryRef.current?.width || canvasConfig.width,
            height: masterFacilityBoundaryRef.current?.height || canvasConfig.height,
          },
        });

        if (res.success && res.data) {
          setHasUnsavedChanges(false);
          setLayoutStatus('Draft');
          setIsValidated(false);
          if (!isAuto) {
            toast.success(res.message || 'Draft layout saved successfully.');
          }
        }
      } catch (err: any) {
        console.error('Failed to save draft:', err);
        const errMsg = err?.response?.data?.message || err?.message || 'Failed to save layout draft.';
        if (!isAuto) {
          toast.error(errMsg);
        } else {
          console.warn('Auto-save encountered an issue:', errMsg);
        }
      } finally {
        setIsSaving(false);
        setIsAutoSaving(false);
      }
    },
    [parkingLotId, currentFloorId, isSaving, isAutoSaving, elements, canvasConfig],
  );

  // Remove element from canvas
  const handleRemoveElement = useCallback(
    (elementId: string) => {
      const target = elements.find((el) => el.elementId === elementId);
      if (!target) return;

      // If it's a parking slot, return it back to unplacedSlots!
      if (target.elementType === 'ParkingSlot' && target.slotId) {
        const restoredSlot: UnplacedSlotItem = {
          _id: target.slotId,
          slotNumber: target.slotNumber || 'SLOT',
          slotLabel: target.slotNumber || 'SLOT',
          slotType: 'Standard',
          supportedVehicleType: 'Car',
          slotStatus: 'Available',
          qrIdentifier: '',
          zoneId: {
            _id: target.zoneId || '',
            zoneName: 'Zone ' + (target.zoneCode || ''),
            zoneCode: target.zoneCode || 'Z',
          },
        };

        setUnplacedSlots((prev) => [restoredSlot, ...prev]);
      }

      setElements((prev) => {
        const next = prev.filter((el) => el.elementId !== elementId);
        recordHistorySnapshot(next);
        return next;
      });
      if (selectedElementId === elementId) {
        setSelectedElementId(null);
      }
      setHasUnsavedChanges(true);
      setIsValidated(false);
      toast.info(`Removed element from canvas.`);
    },
    [elements, selectedElementId, recordHistorySnapshot],
  );

  // Copy selected element to clipboard
  const handleCopyElement = useCallback(
    (targetEl?: LayoutElementData | null) => {
      const target = targetEl || elements.find((item) => item.elementId === selectedElementId);
      if (!target) return;
      setClipboardElement(target);
      toast.info(`Copied ${target.label || target.elementType} (Press Ctrl+V to paste)`);
    },
    [elements, selectedElementId],
  );

  // Paste copied element from clipboard
  const handlePasteElement = useCallback(() => {
    if (!clipboardElement || mode !== 'edit') return;

    // Offset pasted element by 30px so it's visibly distinct and easily dragged
    const offsetX = 30;
    const offsetY = 30;
    let newX = Math.min(canvasConfig.width - clipboardElement.width, clipboardElement.x + offsetX);
    let newY = Math.min(canvasConfig.height - clipboardElement.height, clipboardElement.y + offsetY);
    newX = Math.max(10, newX);
    newY = Math.max(10, newY);

    if (clipboardElement.elementType === 'ParkingSlot') {
      // Slot integrity: assign next available unplaced slot
      if (unplacedSlots.length === 0) {
        toast.warning('All official parking slots for this floor are already placed on the canvas.');
        return;
      }

      const nextSlot = unplacedSlots[0];
      const newSlotElement: LayoutElementData = {
        ...clipboardElement,
        elementId: `PARKINGSLOT-${Date.now().toString(36).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
        slotId: nextSlot._id,
        slotNumber: nextSlot.slotNumber,
        zoneCode: typeof nextSlot.zoneId === 'object' && nextSlot.zoneId ? nextSlot.zoneId.zoneCode : 'A',
        zoneId: typeof nextSlot.zoneId === 'object' && nextSlot.zoneId ? nextSlot.zoneId._id : nextSlot.zoneId,
        x: newX,
        y: newY,
      };

      setElements((prev) => {
        const next = [...prev, newSlotElement];
        recordHistorySnapshot(next);
        return next;
      });
      setUnplacedSlots((prev) => prev.filter((s) => s._id !== nextSlot._id));
      setSelectedElementId(newSlotElement.elementId);
      setInspectorCollapsed(false);
      setInspectorTab('properties');
      setHasUnsavedChanges(true);
      setIsValidated(false);
      // Advance clipboard offset for consecutive pastes
      setClipboardElement((prev) => (prev ? { ...prev, x: newX, y: newY } : null));
      toast.success(`Pasted parking slot ${nextSlot.slotNumber}`);
      return;
    }

    // Physical Elements (DrivingLane, Wall, Pillar, Entrance, Exit, Ramp, etc.)
    const uniqueId = `${clipboardElement.elementType.toUpperCase()}-${Date.now().toString(36).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`;
    const clonedElement: LayoutElementData = {
      ...clipboardElement,
      elementId: uniqueId,
      x: newX,
      y: newY,
    };

    setElements((prev) => {
      const next = [...prev, clonedElement];
      recordHistorySnapshot(next);
      return next;
    });
    setSelectedElementId(uniqueId);
    setInspectorCollapsed(false);
    setInspectorTab('properties');
    setHasUnsavedChanges(true);
    setIsValidated(false);
    // Advance clipboard offset for consecutive pastes
    setClipboardElement((prev) => (prev ? { ...prev, x: newX, y: newY } : null));
    toast.success(`Pasted ${clipboardElement.label || clipboardElement.elementType}`);
  }, [clipboardElement, mode, canvasConfig, unplacedSlots, recordHistorySnapshot]);

  // Duplicate an element directly by ID
  const handleDuplicateElement = useCallback(
    (elementId: string) => {
      const target = elements.find((el) => el.elementId === elementId);
      if (!target) return;
      setClipboardElement(target);

      const offsetX = 30;
      const offsetY = 30;
      let newX = Math.min(canvasConfig.width - target.width, target.x + offsetX);
      let newY = Math.min(canvasConfig.height - target.height, target.y + offsetY);
      newX = Math.max(10, newX);
      newY = Math.max(10, newY);

      if (target.elementType === 'ParkingSlot') {
        if (unplacedSlots.length === 0) {
          toast.warning('All official parking slots for this floor are already placed on the canvas.');
          return;
        }
        const nextSlot = unplacedSlots[0];
        const newSlotElement: LayoutElementData = {
          ...target,
          elementId: `PARKINGSLOT-${Date.now().toString(36).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`,
          slotId: nextSlot._id,
          slotNumber: nextSlot.slotNumber,
          zoneCode: typeof nextSlot.zoneId === 'object' && nextSlot.zoneId ? nextSlot.zoneId.zoneCode : 'A',
          zoneId: typeof nextSlot.zoneId === 'object' && nextSlot.zoneId ? nextSlot.zoneId._id : nextSlot.zoneId,
          x: newX,
          y: newY,
        };
        setElements((prev) => {
          const next = [...prev, newSlotElement];
          recordHistorySnapshot(next);
          return next;
        });
        setUnplacedSlots((prev) => prev.filter((s) => s._id !== nextSlot._id));
        setSelectedElementId(newSlotElement.elementId);
        setInspectorCollapsed(false);
        setInspectorTab('properties');
        setHasUnsavedChanges(true);
        setIsValidated(false);
        toast.success(`Duplicated slot ${nextSlot.slotNumber}`);
        return;
      }

      const uniqueId = `${target.elementType.toUpperCase()}-${Date.now().toString(36).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`;
      const clonedElement: LayoutElementData = {
        ...target,
        elementId: uniqueId,
        x: newX,
        y: newY,
      };
      setElements((prev) => {
        const next = [...prev, clonedElement];
        recordHistorySnapshot(next);
        return next;
      });
      setSelectedElementId(uniqueId);
      setInspectorCollapsed(false);
      setInspectorTab('properties');
      setHasUnsavedChanges(true);
      setIsValidated(false);
      toast.success(`Duplicated ${target.label || target.elementType}`);
    },
    [elements, unplacedSlots, canvasConfig, recordHistorySnapshot],
  );

  // Debounced Auto-Save on Changes (runs 2s after user stops editing)
  useEffect(() => {
    if (!hasUnsavedChanges || isSaving || isAutoSaving || loading) return;

    const timer = setTimeout(() => {
      handleSaveDraft(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, elements, canvasConfig, isSaving, isAutoSaving, loading, handleSaveDraft]);

  // Keyboard shortcuts (including Ctrl+C & Ctrl+V for props)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input, textarea, or contentEditable
      if (
        ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Ctrl+S or Cmd+S -> Save Draft
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveDraft(false);
        return;
      }

      // Ctrl+Z or Cmd+Z -> Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Ctrl+Y or Cmd+Y -> Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+C or Cmd+C -> Copy selected element
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedElementId && mode === 'edit') {
          e.preventDefault();
          handleCopyElement();
        }
      }

      // Ctrl+V or Cmd+V -> Paste copied element
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboardElement && mode === 'edit') {
          e.preventDefault();
          handlePasteElement();
        }
      }

      // Escape -> Deselect element, exit measurement scaler, or exit fullscreen
      if (e.key === 'Escape') {
        if (activeTool === 'measure') {
          setActiveTool('select');
        } else if (selectedElementId) {
          setSelectedElementId(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }

      // F -> Toggle Fullscreen
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }

      // V -> Select tool
      if (e.key.toLowerCase() === 'v') {
        setActiveTool('select');
      }

      // H -> Pan tool
      if (e.key.toLowerCase() === 'h') {
        setActiveTool('pan');
      }

      // M -> Measure Distance Scaler tool
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveTool((prev) => (prev === 'measure' ? 'select' : 'measure'));
      }

      // Arrow keys (all 4) -> Move selected prop smoothly by 0.1px on each press (Shift+Arrow for 1px)
      // Clamped strictly within canvas and inside the facility boundary walls
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) &&
        selectedElementId &&
        mode === 'edit'
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        setElements((prev) =>
          prev.map((el) => {
            if (el.elementId !== selectedElementId) return el;
            const rawX = Math.round((el.x + dx) * 10) / 10;
            const rawY = Math.round((el.y + dy) * 10) / 10;
            const isGate = el.elementType === 'Entrance' || el.elementType === 'Exit';
            const clamped = clampElementInsideBounds(
              rawX,
              rawY,
              el.width,
              el.height,
              el.rotation || 0,
              canvasConfig.width,
              canvasConfig.height,
              isGate,
              14,
            );
            return {
              ...el,
              x: clamped.x,
              y: clamped.y,
            };
          }),
        );
        setHasUnsavedChanges(true);
        setIsValidated(false);
      }

      // Delete or Backspace -> Remove selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId && mode === 'edit') {
        e.preventDefault();
        handleRemoveElement(selectedElementId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedElementId,
    clipboardElement,
    mode,
    elements,
    canvasConfig,
    isFullscreen,
    handleSaveDraft,
    handleCopyElement,
    handlePasteElement,
    handleRemoveElement,
    handleUndo,
    handleRedo,
  ]);

  // Update element coordinates (clamped strictly inside facility boundary walls)
  const handleUpdateElementPosition = (elementId: string, x: number, y: number) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.elementId !== elementId) return el;
        const isGate = el.elementType === 'Entrance' || el.elementType === 'Exit';
        const clamped = clampElementInsideBounds(
          x,
          y,
          el.width,
          el.height,
          el.rotation || 0,
          canvasConfig.width,
          canvasConfig.height,
          isGate,
          14,
        );
        return { ...el, x: clamped.x, y: clamped.y };
      }),
    );
    setHasUnsavedChanges(true);
    setIsValidated(false);
  };

  // Update element dimensions (from on-canvas resize handle)
  const handleUpdateElementDimensions = useCallback((elementId: string, width: number, height: number) => {
    setElements((prev) =>
      prev.map((el) => (el.elementId === elementId ? { ...el, width, height } : el)),
    );
    setHasUnsavedChanges(true);
    setIsValidated(false);
  }, []);

  // Update element position and dimensions atomically during stretching/resizing
  const handleUpdateElementGeometry = useCallback(
    (elementId: string, x: number, y: number, width: number, height: number) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.elementId !== elementId) return el;
          const isGate = el.elementType === 'Entrance' || el.elementType === 'Exit';
          const clamped = clampElementInsideBounds(
            x,
            y,
            width,
            height,
            el.rotation || 0,
            canvasConfig.width,
            canvasConfig.height,
            isGate,
            14,
          );
          return {
            ...el,
            x: clamped.x,
            y: clamped.y,
            width,
            height,
          };
        }),
      );
      setHasUnsavedChanges(true);
      setIsValidated(false);
    },
    [canvasConfig.width, canvasConfig.height],
  );

  // Update canvas config (from stretchable crop handles or locker inputs, allowed on Ground Floor only)
  const handleUpdateCanvasConfig = useCallback((cfg: Partial<LayoutCanvasConfig>) => {
    if (!isGroundFloor) {
      toast.info('Facility boundary (width & height) can only be changed from Ground Floor.');
      return;
    }
    setCanvasConfig((prev) => {
      const updated = { ...prev, ...cfg };
      masterFacilityBoundaryRef.current = {
        width: updated.width,
        height: updated.height,
      };
      if (parkingLotId) {
        try {
          localStorage.setItem(
            `parkease_facility_boundary_${parkingLotId}`,
            JSON.stringify({ width: updated.width, height: updated.height }),
          );
        } catch {
          // ignore
        }
        // Persist facility boundary immediately to database across all floors
        void updateFacilityCanvasBoundary(parkingLotId, {
          width: updated.width,
          height: updated.height,
        }).catch((err) => {
          console.warn('Silent canvas boundary backend sync:', err);
        });
      }
      return updated;
    });
    setHasUnsavedChanges(true);
    setIsValidated(false);
  }, [isGroundFloor, parkingLotId]);

  // Rotate element by custom degrees, presets, or delta (keeps visual bounding box inside boundary walls)
  const handleRotateElement = (
    elementId: string,
    customAngleOrDelta?: number,
    isDelta: boolean = true,
  ) => {
    setElements((prev) => {
      const updated = prev.map((el) => {
        if (el.elementId !== elementId) return el;
        const currentRot = el.rotation || 0;
        let nextRot: number;
        if (customAngleOrDelta === undefined) {
          nextRot = (currentRot + 90) % 360;
        } else if (isDelta) {
          nextRot = (currentRot + customAngleOrDelta + 360) % 360;
        } else {
          nextRot = ((customAngleOrDelta % 360) + 360) % 360;
        }
        nextRot = Math.round(nextRot * 10) / 10;
        const isGate = el.elementType === 'Entrance' || el.elementType === 'Exit';
        const clamped = clampElementInsideBounds(
          el.x,
          el.y,
          el.width,
          el.height,
          nextRot,
          canvasConfig.width,
          canvasConfig.height,
          isGate,
          14,
        );
        return {
          ...el,
          rotation: nextRot,
          x: clamped.x,
          y: clamped.y,
        };
      });
      recordHistorySnapshot(updated);
      return updated;
    });
    setHasUnsavedChanges(true);
    setIsValidated(false);
  };

  // Update element custom properties by ID directly
  const handleUpdateElementById = useCallback(
    (elementId: string, updatedFields: Partial<LayoutElementData>) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.elementId !== elementId) return el;
          return { ...el, ...updatedFields };
        }),
      );
      setHasUnsavedChanges(true);
      setIsValidated(false);
    },
    [],
  );

  // Update element custom properties (clamped inside boundary walls)
  const handleUpdateElement = (updatedFields: Partial<LayoutElementData>) => {
    if (!selectedElementId) return;
    setElements((prev) => {
      const updated = prev.map((el) => {
        if (el.elementId !== selectedElementId) return el;
        const next = { ...el, ...updatedFields };
        const isGate = next.elementType === 'Entrance' || next.elementType === 'Exit';
        const clamped = clampElementInsideBounds(
          next.x,
          next.y,
          next.width,
          next.height,
          next.rotation || 0,
          canvasConfig.width,
          canvasConfig.height,
          isGate,
          14,
        );
        return { ...next, x: clamped.x, y: clamped.y };
      });
      recordHistorySnapshot(updated);
      return updated;
    });
    setHasUnsavedChanges(true);
    setIsValidated(false);
  };

  // Quick Connect / Extend new lane from an existing lane or turn
  const handleConnectLane = (
    source: LayoutElementData,
    connectionType: LaneConnectionType,
  ) => {
    const isSquareHub =
      source.label?.includes('Square') ||
      source.label?.includes('Connector') ||
      source.label?.includes('Hub') ||
      (Math.abs(source.width - source.height) <= 30 && source.elementType === 'DrivingLane');
    const isHorizontal = source.width >= source.height;
    const laneThickness = isHorizontal ? source.height : source.width;
    const laneLength = isHorizontal ? source.width : source.height;

    let newX = source.x;
    let newY = source.y;
    let newW = source.width;
    let newH = source.height;
    let newLabel = 'Driving Lane';

    if (isSquareHub) {
      // 4-Way Square Connector extension on all 4 faces
      const hubSize = Math.min(source.width, source.height);
      if (connectionType === 'forward') {
        // Extend East (Horizontal)
        newX = source.x + source.width;
        newY = source.y + (source.height - hubSize) / 2;
        newW = 240;
        newH = hubSize;
      } else if (connectionType === 'backward') {
        // Extend West (Horizontal)
        newX = Math.max(0, source.x - 240);
        newY = source.y + (source.height - hubSize) / 2;
        newW = 240;
        newH = hubSize;
      } else if (connectionType === 'turn-left') {
        // Extend North (Vertical)
        newX = source.x + (source.width - hubSize) / 2;
        newY = Math.max(0, source.y - 240);
        newW = hubSize;
        newH = 240;
      } else if (connectionType === 'turn-right') {
        // Extend South (Vertical)
        newX = source.x + (source.width - hubSize) / 2;
        newY = source.y + source.height;
        newW = hubSize;
        newH = 240;
      }
    } else if (isHorizontal) {
      if (connectionType === 'forward') {
        // Continue straight to the right
        newX = source.x + source.width;
        newY = source.y;
        newW = source.width;
        newH = source.height;
      } else if (connectionType === 'backward') {
        // Continue straight to the left
        newX = Math.max(0, source.x - source.width);
        newY = source.y;
        newW = source.width;
        newH = source.height;
      } else if (connectionType === 'turn-left') {
        // Turn 90° Up (Vertical lane extending upwards from the right end)
        newW = laneThickness;
        newH = Math.max(160, laneLength);
        newX = source.x + source.width - laneThickness;
        newY = Math.max(0, source.y - newH);
        newLabel = 'Driving Lane';
      } else if (connectionType === 'turn-right') {
        // Turn 90° Down (Vertical lane extending downwards from the right end)
        newW = laneThickness;
        newH = Math.max(160, laneLength);
        newX = source.x + source.width - laneThickness;
        newY = source.y + source.height;
        newLabel = 'Driving Lane';
      }
    } else {
      // Vertical lane
      if (connectionType === 'forward') {
        // Continue straight downward
        newX = source.x;
        newY = source.y + source.height;
        newW = source.width;
        newH = source.height;
      } else if (connectionType === 'backward') {
        // Continue straight upward
        newX = source.x;
        newY = Math.max(0, source.y - source.height);
        newW = source.width;
        newH = source.height;
      } else if (connectionType === 'turn-left') {
        // Turn 90° Left (Horizontal lane extending left from the bottom end)
        newW = Math.max(160, laneLength);
        newH = laneThickness;
        newX = Math.max(0, source.x - newW + laneThickness);
        newY = source.y + source.height - laneThickness;
        newLabel = 'Driving Lane';
      } else if (connectionType === 'turn-right') {
        // Turn 90° Right (Horizontal lane extending right from the bottom end)
        newW = Math.max(160, laneLength);
        newH = laneThickness;
        newX = source.x;
        newY = source.y + source.height - laneThickness;
        newLabel = 'Driving Lane';
      }
    }

    // Keep within canvas frame dimensions
    newX = Math.max(0, Math.min(canvasConfig.width - newW, newX));
    newY = Math.max(0, Math.min(canvasConfig.height - newH, newY));

    const uniqueId = `DRIVINGLANE-${Date.now().toString(36).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`;
    const connectedElement: LayoutElementData = {
      elementId: uniqueId,
      elementType: 'DrivingLane',
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      rotation: 0,
      zIndex: 1,
      laneDirection: source.laneDirection || 'Two-Way',
      label: newLabel,
    };

    setElements((prev) => {
      const next = [...prev, connectedElement];
      recordHistorySnapshot(next);
      return next;
    });
    setSelectedElementId(uniqueId);
    setHasUnsavedChanges(true);
    setIsValidated(false);
    toast.success(`Connected new lane ${newLabel === 'Corner Turn' ? 'turn' : 'segment'}.`);
  };

  // Add / Drop element onto canvas
  const handleAddOrDropElement = (
    elementType: string,
    xOrExtra?: number | any,
    y?: number,
    extraDataArg?: any,
  ) => {
    let x: number | undefined;
    let extraData: any;

    if (
      typeof xOrExtra === 'object' &&
      xOrExtra !== null &&
      y === undefined &&
      extraDataArg === undefined
    ) {
      // Called as onAddElement(elementType, extraData) from ElementsPalette click
      extraData = xOrExtra;
      x = undefined;
    } else {
      // Called with coordinates (elementType, x, y, extraData) from canvas drop
      x = typeof xOrExtra === 'number' && !isNaN(xOrExtra) ? xOrExtra : undefined;
      extraData = extraDataArg;
    }

    const defaultX =
      typeof x === 'number' && !isNaN(x)
        ? x
        : Math.max(50, Math.min(canvasConfig.width - 150, 100 + (elements.length % 7) * 40));
    const defaultY =
      typeof y === 'number' && !isNaN(y)
        ? y
        : Math.max(50, Math.min(canvasConfig.height - 150, 100 + (elements.length % 7) * 40));

    const uniqueId = `${elementType.toUpperCase()}-${Date.now().toString(36).slice(-4)}-${Math.floor(Math.random() * 90 + 10)}`;

    let newElement: LayoutElementData;

    switch (elementType) {
      case 'ParkingSlot': {
        const slotId = extraData?.slotId;
        const slotNumber = extraData?.slotNumber || 'A01';
        const zoneCode = extraData?.zoneCode || extraData?.slotNumber?.match(/^([A-Za-z]+)/)?.[1] || 'A';
        const zoneName = extraData?.zoneName || `Zone ${zoneCode}`;
        const zoneId = extraData?.zoneId || null;

        newElement = {
          elementId: uniqueId,
          elementType: 'ParkingSlot',
          slotId,
          slotNumber,
          zoneCode,
          zoneName,
          zoneId,
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.parkingSlot.width,
          height: extraData?.height || propDefaults.parkingSlot.height,
          rotation: 0,
          zIndex: 2,
        };

        // Remove from unplaced slots
        if (slotId) {
          setUnplacedSlots((prev) => prev.filter((s) => s._id !== slotId));
        }
        break;
      }

      case 'DrivingLane': {
        const isCorner = extraData?.label?.includes('Turn') || extraData?.label?.includes('Corner');
        const isTJunction = extraData?.label?.includes('T-Junction');
        const isSquare =
          extraData?.label?.includes('Square') ||
          extraData?.label?.includes('Connector') ||
          extraData?.label?.includes('Hub');

        const defaultW = isSquare
          ? propDefaults.squareConnector.width
          : isTJunction
          ? propDefaults.tJunction.width
          : isCorner
          ? propDefaults.cornerTurn.width
          : propDefaults.straightLane.width;

        const defaultH = isSquare
          ? propDefaults.squareConnector.height
          : isTJunction
          ? propDefaults.tJunction.height
          : isCorner
          ? propDefaults.cornerTurn.height
          : propDefaults.straightLane.height;

        newElement = {
          elementId: uniqueId,
          elementType: 'DrivingLane',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || defaultW,
          height: extraData?.height || defaultH,
          rotation: extraData?.rotation || 0,
          zIndex: 1,
          laneDirection: extraData?.laneDirection || 'Two-Way',
          label: extraData?.label || 'Driving Lane',
        };
        break;
      }

      case 'Entrance':
        newElement = {
          elementId: uniqueId,
          elementType: 'Entrance',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.entranceGate.width,
          height: extraData?.height || propDefaults.entranceGate.height,
          rotation: 0,
          zIndex: 3,
          label: extraData?.label || 'Entrance 1',
        };
        break;

      case 'Exit':
        newElement = {
          elementId: uniqueId,
          elementType: 'Exit',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.exitGate.width,
          height: extraData?.height || propDefaults.exitGate.height,
          rotation: 0,
          zIndex: 3,
          label: extraData?.label || 'Exit 1',
        };
        break;

      case 'Pillar':
        newElement = {
          elementId: uniqueId,
          elementType: 'Pillar',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.pillar.width,
          height: extraData?.height || propDefaults.pillar.height,
          rotation: 0,
          zIndex: 3,
          label: extraData?.label || 'Structural Column',
          occupiesAllFloors: extraData?.occupiesAllFloors ?? true,
          syncAcrossAllFloors: extraData?.syncAcrossAllFloors ?? true,
          shaftGroupId: `COLUMN-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
        };
        break;

      case 'Wall':
        newElement = {
          elementId: uniqueId,
          elementType: 'Wall',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.wall.width,
          height: extraData?.height || propDefaults.wall.height,
          rotation: 0,
          zIndex: 2,
          label: 'Wall',
        };
        break;

      case 'RestrictedArea':
        newElement = {
          elementId: uniqueId,
          elementType: 'RestrictedArea',
          x: defaultX,
          y: defaultY,
          width: 160,
          height: 160,
          rotation: 0,
          zIndex: 2,
          restrictedReason: extraData?.restrictedReason || 'Electrical / Maintenance',
        };
        break;

      case 'ReservedArea':
        newElement = {
          elementId: uniqueId,
          elementType: 'ReservedArea',
          x: defaultX,
          y: defaultY,
          width: 160,
          height: 160,
          rotation: 0,
          zIndex: 2,
          reservedFor: extraData?.reservedFor || 'Emergency Services',
        };
        break;

      case 'Ramp':
        newElement = {
          elementId: uniqueId,
          elementType: 'Ramp',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.ramp.width,
          height: extraData?.height || propDefaults.ramp.height,
          rotation: 0,
          zIndex: 2,
          rampDirection: extraData?.rampDirection || 'Up',
          label: extraData?.label || 'Ramp Up (To Upper Level)',
          targetFloorId: extraData?.targetFloorId || null,
          targetFloorName: extraData?.targetFloorName || 'To Upper Level',
          rampGroupId: `RAMP-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
          autoPlaceOnTargetFloor: true,
        };
        break;

      case 'RampPortal':
        newElement = {
          elementId: uniqueId,
          elementType: 'RampPortal',
          x: defaultX,
          y: defaultY,
          width: 160,
          height: 60,
          rotation: 0,
          zIndex: 3,
          portalType: extraData?.portalType || 'Entry',
          label: extraData?.label || 'Ramp Arrival',
          targetFloorId: extraData?.targetFloorId || null,
          targetFloorName: extraData?.targetFloorName || 'Floor Connection',
          rampGroupId: `RAMP-${Date.now().toString(36)}-${Math.floor(Math.random() * 90 + 10)}`,
          autoPlaceOnTargetFloor: true,
        };
        break;

      case 'Lift':
        newElement = {
          elementId: uniqueId,
          elementType: 'Lift',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.lift.width,
          height: extraData?.height || propDefaults.lift.height,
          rotation: 0,
          zIndex: 3,
          label: extraData?.label || 'Lift / Elevator',
          occupiesAllFloors: extraData?.occupiesAllFloors ?? true,
          syncAcrossAllFloors: extraData?.syncAcrossAllFloors ?? true,
          shaftGroupId: extraData?.shaftGroupId || uniqueId,
        };
        break;

      case 'Staircase':
        newElement = {
          elementId: uniqueId,
          elementType: 'Staircase',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.staircase.width,
          height: extraData?.height || propDefaults.staircase.height,
          rotation: 0,
          zIndex: 3,
          label: extraData?.label || 'Staircase / Stairs',
          occupiesAllFloors: extraData?.occupiesAllFloors ?? true,
          syncAcrossAllFloors: extraData?.syncAcrossAllFloors ?? true,
          shaftGroupId: extraData?.shaftGroupId || uniqueId,
        };
        break;

      case 'LiftStaircase':
        newElement = {
          elementId: uniqueId,
          elementType: 'LiftStaircase',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.liftStaircase.width,
          height: extraData?.height || propDefaults.liftStaircase.height,
          rotation: 0,
          zIndex: 3,
          label: extraData?.label || 'Lift & Staircase Core',
          occupiesAllFloors: extraData?.occupiesAllFloors ?? true,
          syncAcrossAllFloors: extraData?.syncAcrossAllFloors ?? true,
          shaftGroupId: extraData?.shaftGroupId || uniqueId,
        };
        break;

      case 'BuildingEntrance':
        newElement = {
          elementId: uniqueId,
          elementType: 'BuildingEntrance',
          x: defaultX,
          y: defaultY,
          width: extraData?.width || propDefaults.buildingEntrance.width,
          height: extraData?.height || propDefaults.buildingEntrance.height,
          rotation: 0,
          zIndex: 3,
          label: extraData?.label || 'Complex Entrance',
          buildingType: extraData?.buildingType || 'Mall',
        };
        break;

      default:
        return;
    }

    const isGate =
      newElement.elementType === 'Entrance' ||
      newElement.elementType === 'Exit' ||
      newElement.elementType === 'BuildingEntrance';
    const clamped = clampElementInsideBounds(
      newElement.x,
      newElement.y,
      newElement.width,
      newElement.height,
      newElement.rotation || 0,
      canvasConfig.width,
      canvasConfig.height,
      isGate,
      14,
    );
    newElement.x = clamped.x;
    newElement.y = clamped.y;

    setElements((prev) => {
      const next = [...prev, newElement];
      recordHistorySnapshot(next);
      return next;
    });
    setSelectedElementId(newElement.elementId);
    setHasUnsavedChanges(true);
    setIsValidated(false);
    toast.success(`Placed ${newElement.label || newElement.elementType} on canvas.`);
  };

  // Validate Layout
  const handleValidate = async () => {
    if (!parkingLotId || !currentFloorId) return;

    try {
      setIsValidating(true);
      // Auto-save pending changes first
      if (hasUnsavedChanges) {
        const sanitizedElements: LayoutElementData[] = elements.map((el) => ({
          ...el,
          slotId: el.slotId ? String(el.slotId).trim() : null,
          zoneId: el.zoneId ? String(el.zoneId).trim() : null,
          zoneCode: el.zoneCode ? String(el.zoneCode).trim() : null,
          zoneName: el.zoneName ? String(el.zoneName).trim() : null,
          targetFloorId: el.targetFloorId ? String(el.targetFloorId).trim() : null,
          x: Math.round(Number(el.x || 0) * 10) / 10,
          y: Math.round(Number(el.y || 0) * 10) / 10,
          width: Math.max(1, Math.round(Number(el.width || 10) * 10) / 10),
          height: Math.max(1, Math.round(Number(el.height || 10) * 10) / 10),
          rotation: Math.round((((Number(el.rotation || 0) % 360) + 360) % 360) * 10) / 10,
          occupiesAllFloors: el.occupiesAllFloors,
          syncAcrossAllFloors: el.syncAcrossAllFloors,
          shaftGroupId: el.shaftGroupId,
          buildingType: el.buildingType,
          connectedLaneIds: Array.isArray(el.connectedLaneIds) ? el.connectedLaneIds : [],
          navPointers: Array.isArray(el.navPointers)
            ? el.navPointers.map((p) => ({
                id: p.id,
                targetLaneId: p.targetLaneId ? String(p.targetLaneId).trim() : null,
                curbX: p.curbX != null ? Math.round(Number(p.curbX) * 10) / 10 : null,
                curbY: p.curbY != null ? Math.round(Number(p.curbY) * 10) / 10 : null,
              }))
            : undefined,
        }));
        await saveLayoutElements(parkingLotId, currentFloorId, {
          elements: sanitizedElements,
          canvasConfig,
        });
        setHasUnsavedChanges(false);
      }

      const res = await validateDraftLayout(parkingLotId, currentFloorId);
      if (res.success && res.data) {
        const { isValid, errors } = res.data;
        setIsValidated(isValid);
        setValidationErrors(errors || []);
        if (isValid) {
          setLayoutStatus('Validated');
          toast.success('Layout validation passed! Ready for publication.');
        } else {
          setValidationModalOpen(true);
        }
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      toast.error(err?.response?.data?.message || 'Validation request failed.');
    } finally {
      setIsValidating(false);
    }
  };

  // Publish Layout
  const handlePublish = async () => {
    if (!parkingLotId || !currentFloorId) return;

    try {
      setIsPublishing(true);
      const res = await publishDraftLayout(parkingLotId, currentFloorId);
      if (res.success && res.data) {
        setLayoutStatus('Published');
        setIsPublished(true);
        setPublishModalOpen(false);
        toast.success('Official 2D layout published! Owner has been notified for inspection and confirmation.');
      }
    } catch (err: any) {
      console.error('Publish error:', err);
      toast.error(err?.response?.data?.message || 'Failed to publish layout.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Compute stats for property inspector
  const floorStats = useMemo(() => {
    const placedSlots = elements.filter((el) => el.elementType === 'ParkingSlot').length;
    const totalSlots = currentFloor?.totalSlots || 0;
    const entrancesCount = elements.filter((el) => el.elementType === 'Entrance').length;
    const exitsCount = elements.filter((el) => el.elementType === 'Exit').length;
    const rampsCount = elements.filter((el) => el.elementType === 'Ramp').length;

    return {
      floorName: currentFloor?.floorName || 'Floor',
      floorNumber: currentFloor?.floorNumber || 0,
      totalSlots,
      placedSlots,
      unplacedSlots: Math.max(0, totalSlots - placedSlots),
      entrancesCount,
      exitsCount,
      rampsCount,
    };
  }, [elements, currentFloor]);

  if (loading && !hierarchy) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-200 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">Loading 2D Parking Layout Designer...</p>
      </div>
    );
  }

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[100] w-screen h-screen bg-background flex flex-col overflow-hidden m-0 p-0 shadow-2xl'
          : 'h-full w-full flex flex-col overflow-hidden bg-background'
      }
    >
      {/* 1. TOP TOOLBAR */}
      <DesignerToolbar
        parkingLotId={parkingLotId || ''}
        parkingLotName={hierarchy?.parkingLot.parkingName || 'Parking Facility'}
        floors={floors}
        currentFloorId={currentFloorId}
        onFloorChange={handleFloorChange}
        status={layoutStatus}
        version={layoutVersion}
        isPublished={isPublished}
        isValidated={isValidated}
        mode={mode}
        onModeChange={setMode}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        zoom={zoom}
        onZoomChange={setZoom}
        onResetView={handleResetView}
        onFitToScreen={handleFitToScreen}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers(!showRulers)}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid(!snapToGrid)}
        showZoneHighlights={showZoneHighlights}
        onToggleZoneHighlights={() => setShowZoneHighlights(!showZoneHighlights)}
        enableSlotAssister={propDefaults.enableSlotAssister !== false}
        onToggleSlotAssister={() => {
          const nextVal = !(propDefaults.enableSlotAssister !== false);
          handleSavePropDefaults({ ...propDefaults, enableSlotAssister: nextVal }, false);
          toast.success(
            nextVal
              ? 'Smart Slot Assister enabled! Live alignment lines & equal spacing guides are active.'
              : 'Smart Slot Assister disabled.',
          );
        }}
        isSettingsOpen={!inspectorCollapsed && inspectorTab === 'settings'}
        onOpenPropDefaults={() => {
          if (inspectorCollapsed) {
            setInspectorCollapsed(false);
            setInspectorTab('settings');
          } else if (inspectorTab === 'settings') {
            setInspectorCollapsed(true);
          } else {
            setInspectorTab('settings');
          }
        }}
        isSaving={isSaving}
        isAutoSaving={isAutoSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveDraft={() => handleSaveDraft(false)}
        isValidating={isValidating}
        onValidate={handleValidate}
        isPublishing={isPublishing}
        onPublish={() => setPublishModalOpen(true)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* 2. MAIN WORKSPACE: Element Palette + Interactive Canvas + Property Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Elements Palette & Unplaced Slots Tray (Hidden in Customer Preview) */}
        {mode === 'edit' && (
          <ElementsPalette
            unplacedSlots={unplacedSlots}
            totalSlotsCount={floorStats.totalSlots}
            placedSlotsCount={floorStats.placedSlots}
            onAddElement={(type, extra) => handleAddOrDropElement(type, extra)}
            isCollapsed={paletteCollapsed}
            onToggleCollapse={() => setPaletteCollapsed(!paletteCollapsed)}
            zones={currentFloor?.zones || []}
            placedElements={elements}
            showZoneHighlights={showZoneHighlights}
            onToggleZoneHighlights={() => setShowZoneHighlights(!showZoneHighlights)}
            selectedZoneFilter={selectedZoneFilter}
            onSelectZoneFilter={setSelectedZoneFilter}
            propDefaults={propDefaults}
          />
        )}

        {/* Center SVG Interactive Canvas Viewport */}
        <CanvasViewport
          canvasConfig={canvasConfig}
          elements={elements}
          selectedElementId={selectedElementId}
          mode={mode}
          activeTool={activeTool}
          showGrid={showGrid}
          showRulers={showRulers}
          snapToGrid={snapToGrid}
          zoom={zoom}
          panX={panX}
          panY={panY}
          onPanChange={(newX, newY) => {
            setPanX(newX);
            setPanY(newY);
          }}
          onZoomChange={setZoom}
          onSelectElement={(el) => {
            setSelectedElementId(el ? el.elementId : null);
            setInspectorTab('properties');
            if (el) {
              setInspectorCollapsed(false);
            }
          }}
          onUpdateElementPosition={handleUpdateElementPosition}
          onUpdateElementDimensions={handleUpdateElementDimensions}
          onUpdateElementGeometry={handleUpdateElementGeometry}
          onUpdateElement={handleUpdateElementById}
          onUpdateCanvasConfig={handleUpdateCanvasConfig}
          onRotateElement={handleRotateElement}
          onRemoveElement={handleRemoveElement}
          onConnectLane={handleConnectLane}
          onDropNewElement={(type, x, y, extra) => handleAddOrDropElement(type, x, y, extra)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          onFitToScreen={handleFitToScreen}
          onResetView={handleResetView}
          zones={currentFloor?.zones || []}
          showZoneHighlights={showZoneHighlights}
          onToggleZoneHighlights={() => setShowZoneHighlights(!showZoneHighlights)}
          selectedZoneFilter={selectedZoneFilter}
          onSelectZoneFilter={setSelectedZoneFilter}
          highlightedElementId={highlightedElementId}
          onToolChange={setActiveTool}
          enableSlotAssister={propDefaults.enableSlotAssister !== false}
          canResizeCanvas={isGroundFloor}
          onActionComplete={() => {
            recordHistorySnapshot(elements, canvasConfig);
          }}
        />

        {/* Right Property Inspector Panel (Hidden in Customer Preview) */}
        {mode === 'edit' && (
          <PropertyInspector
            selectedElement={selectedElement}
            onClose={() => setSelectedElementId(null)}
            onUpdateElement={handleUpdateElement}
            onRotateElement={handleRotateElement}
            onRemoveElement={handleRemoveElement}
            onConnectLane={handleConnectLane}
            floorStats={floorStats}
            floors={floors}
            currentFloorId={currentFloorId}
            propDefaults={propDefaults}
            onSavePropDefaults={handleSavePropDefaults}
            activeInspectorTab={inspectorTab}
            onInspectorTabChange={setInspectorTab}
            onOpenExpandedModal={() => setPropDefaultsModalOpen(true)}
            placedElementsCount={elements.length}
            isCollapsed={inspectorCollapsed}
            onToggleCollapse={() => setInspectorCollapsed(!inspectorCollapsed)}
            onDuplicateElement={handleDuplicateElement}
            allElements={elements}
            highlightedElementId={highlightedElementId}
            onHighlightElement={setHighlightedElementId}
            onSelectConnectedElement={(el) => setSelectedElementId(el.elementId)}
            canvasConfig={canvasConfig}
            onUpdateCanvasConfig={handleUpdateCanvasConfig}
            canResizeCanvas={isGroundFloor}
            lanesCount={elements.filter((el) => el.elementType === 'DrivingLane').length}
            hasCopiedLanes={Boolean(laneNetworkClipboard && laneNetworkClipboard.lanes && laneNetworkClipboard.lanes.length > 0)}
            copiedLanesCount={laneNetworkClipboard?.lanes?.length || 0}
            copiedSourceFloorName={laneNetworkClipboard?.sourceFloorName || ''}
            onCopyLaneNetwork={handleCopyLaneNetwork}
            onPasteLaneNetwork={handlePasteLaneNetwork}
            onOpenReplicateLanesModal={() => setReplicateLanesModalOpen(true)}
          />
        )}
      </div>

      {/* 3. VALIDATION WARNINGS DIALOG */}
      <Dialog open={validationModalOpen} onOpenChange={setValidationModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/80 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500 font-bold text-base">
              <ShieldAlert className="h-5 w-5" />
              Structural Validation Incomplete
            </DialogTitle>
            <DialogDescription className="text-xs">
              The following structural requirements must be addressed before this layout can be published:
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx} className="text-foreground font-medium">
                  {err}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setValidationModalOpen(false)}>
              Got It, Continue Editing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. PUBLISH CONFIRMATION DIALOG */}
      <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border/80 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-500 font-bold text-base">
              <UploadCloud className="h-5 w-5" />
              Publish Official 2D Parking Layout
            </DialogTitle>
            <DialogDescription className="text-xs">
              Promote this validated layout to the canonical official version for {currentFloor?.floorName}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-lg bg-muted/20 border border-border/60 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Floor:</span>
              <span className="font-bold text-foreground">
                {currentFloor?.floorName} (Level {currentFloor?.floorNumber})
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Total Slots Placed:</span>
              <span className="font-mono font-bold text-primary">
                {floorStats.placedSlots} / {floorStats.totalSlots} Slots
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Access / Ingress &amp; Egress:</span>
              <span className="font-bold text-foreground">
                {floorStats.entrancesCount > 0 || floorStats.exitsCount > 0
                  ? `${floorStats.entrancesCount} Entrance • ${floorStats.exitsCount} Exit`
                  : floorStats.rampsCount > 0
                    ? `${floorStats.rampsCount} Inter-Floor Ramp${floorStats.rampsCount > 1 ? 's' : ''}`
                    : 'None placed'}
              </span>
            </div>
            {floorStats.rampsCount > 0 && (
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Inter-Floor Ramps:</span>
                <span className="font-bold text-emerald-400">
                  {floorStats.rampsCount} Level Connector{floorStats.rampsCount > 1 ? 's' : ''}
                </span>
              </div>
            )}

            <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-500 font-medium">
              <strong>NOTICE:</strong> Publishing publishes this 2D layout and immediately notifies the Parking Owner via in-app alerts and email. The parking lot review status will update to <strong>Pending Owner Review</strong> so the owner can inspect the floor plan and confirm approval before facility activation.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handlePublish}
              disabled={isPublishing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {isPublishing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm & Publish Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. DEFAULT PROP DIMENSIONS & SETTINGS MODAL */}
      <PropDefaultsModal
        open={propDefaultsModalOpen}
        onOpenChange={setPropDefaultsModalOpen}
        propDefaults={propDefaults}
        onSavePropDefaults={handleSavePropDefaults}
        placedElementsCount={elements.length}
      />

      {/* 6. REPLICATE LANE NETWORK MODAL */}
      <ReplicateLaneNetworkModal
        open={replicateLanesModalOpen}
        onOpenChange={setReplicateLanesModalOpen}
        sourceFloorName={currentFloor?.floorName || 'Current Floor'}
        sourceFloorNumber={currentFloor?.floorNumber || 0}
        sourceLanesCount={elements.filter((el) => el.elementType === 'DrivingLane').length}
        availableFloors={floors}
        currentFloorId={currentFloorId}
        onReplicate={handleReplicateLaneNetwork}
      />
    </div>
  );
};

export default ParkingLayoutDesignerPage;
