import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import {
  ShieldAlert,
  Cpu,
  Radio,
  Scan,
  Car,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Layers,
  Lock,
  Unlock,
  Camera,
  Upload,
  QrCode,
  RefreshCw,
  FileUp,
  MapPin,
  Info,
  Hand,
  MousePointer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { CanvasViewport } from '@/components/layout-designer/CanvasViewport';
import { barrierApi, type BarrierReaderInfo, type BarrierScanResponse } from '@/api/barrier.api';
import { getSocket } from '@/lib/socket';
import type { LayoutElementData, LayoutCanvasConfig } from '@/api/parkingLot.api';

const DEFAULT_CANVAS_CONFIG: LayoutCanvasConfig = {
  width: 1400,
  height: 900,
  gridSize: 20,
  snapToGrid: false,
  backgroundColor: '#090d16',
};

type ScannerMode = 'OPTICAL' | 'CAMERA' | 'UPLOAD' | 'MANUAL';
export type SlotDisplayStatus = 'Available' | 'Reserved' | 'Occupied' | 'Overstay' | 'Barrier Open' | 'Under Maintenance';

export const ParkingSimulatorPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Facility and floor selection state
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');

  // Viewport navigation state
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [zoom, setZoom] = useState<number>(0.75);
  const [panX, setPanX] = useState<number>(20);
  const [panY, setPanY] = useState<number>(20);

  // Hardware interaction state
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<string | null>(null);
  const [selectedReaderId, setSelectedReaderId] = useState<string>('ENTRY-GATE-01');
  const [customQrPayload, setCustomQrPayload] = useState<string>('');
  const [scanResult, setScanResult] = useState<BarrierScanResponse | null>(null);
  const [acceleratedSpeed, setAcceleratedSpeed] = useState<number>(1);
  const [nowTime, setNowTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = useCallback((sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // Optical / Camera Scanner states
  const [scannerMode, setScannerMode] = useState<ScannerMode>('OPTICAL');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isScanningLaserActive, setIsScanningLaserActive] = useState<boolean>(false);
  const [activeBookingQrDataUrl, setActiveBookingQrDataUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isVerifyingScan, setIsVerifyingScan] = useState<boolean>(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCameraScanningRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Fetch available facilities
  const facilitiesQuery = useQuery({
    queryKey: ['barrier-facilities'],
    queryFn: barrierApi.getFacilities,
  });

  // Auto-select first facility once loaded
  useEffect(() => {
    if (!selectedLotId && facilitiesQuery.data?.facilities && facilitiesQuery.data.facilities.length > 0) {
      setSelectedLotId(facilitiesQuery.data.facilities[0]._id);
    }
  }, [facilitiesQuery.data, selectedLotId]);

  // 2. Fetch facility published layout, slots, and reader states
  const facilityDataQuery = useQuery({
    queryKey: ['barrier-facility-state', selectedLotId],
    queryFn: () => barrierApi.getFacilityLayoutAndState(selectedLotId),
    enabled: Boolean(selectedLotId),
    refetchInterval: 1000,
  });

  // 3. Fetch active and upcoming bookings for this facility (filtered to only those that haven't exited)
  const bookingsQuery = useQuery({
    queryKey: ['barrier-facility-bookings', selectedLotId],
    queryFn: () => barrierApi.getFacilityBookings(selectedLotId),
    enabled: Boolean(selectedLotId),
    refetchInterval: 3000,
  });

  // Auto-select first floor when facility loads
  useEffect(() => {
    if (facilityDataQuery.data?.floors && facilityDataQuery.data.floors.length > 0) {
      if (!selectedFloorId || !facilityDataQuery.data.floors.some((f: any) => String(f._id) === String(selectedFloorId))) {
        setSelectedFloorId(String(facilityDataQuery.data.floors[0]._id));
      }
    }
  }, [facilityDataQuery.data, selectedFloorId]);

  // Socket.IO live updates
  useEffect(() => {
    if (!selectedLotId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_lot', selectedLotId);

    const handleBarrierChange = () => {
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
      void queryClient.invalidateQueries({ queryKey: ['barrier-events', selectedLotId] });
    };

    const handleSlotChange = () => {
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
    };

    const handleBookingChange = () => {
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-bookings', selectedLotId] });
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
    };

    socket.on('barrier_state_changed', handleBarrierChange);
    socket.on('slot_status_changed', handleSlotChange);
    socket.on('booking_status_changed', handleBookingChange);

    return () => {
      socket.off('barrier_state_changed', handleBarrierChange);
      socket.off('slot_status_changed', handleSlotChange);
      socket.off('booking_status_changed', handleBookingChange);
    };
  }, [selectedLotId, queryClient]);

  // Floor Slot Counts
  const floorSlotCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (facilityDataQuery.data?.slots) {
      for (const slot of facilityDataQuery.data.slots as any[]) {
        const fId = String(typeof slot.floorId === 'object' && slot.floorId !== null ? slot.floorId._id : slot.floorId);
        counts.set(fId, (counts.get(fId) || 0) + 1);
      }
    }
    return counts;
  }, [facilityDataQuery.data?.slots]);

  // Readers map by ID
  const readersMap = useMemo(() => {
    const map = new Map<string, BarrierReaderInfo>();
    if (facilityDataQuery.data?.readers) {
      for (const r of facilityDataQuery.data.readers) {
        map.set(r.readerId, r);
      }
    }
    return map;
  }, [facilityDataQuery.data]);

  // Live active reader
  const currentReader = useMemo(() => {
    return readersMap.get(selectedReaderId) || null;
  }, [readersMap, selectedReaderId]);

  // Priority-aware map of active and upcoming bookings by slot number and ID
  // Highest priority: Overstay (3) > Active (2) > Confirmed (1)
  const slotBookingsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!bookingsQuery.data?.bookings) return map;

    const getPriority = (status: string) => {
      if (status === 'Overstay') return 3;
      if (status === 'Active') return 2;
      if (status === 'Confirmed') return 1;
      return 0;
    };

    const sorted = [...bookingsQuery.data.bookings].sort(
      (a, b) => getPriority(b.bookingStatus) - getPriority(a.bookingStatus),
    );

    for (const b of sorted) {
      // Exclude completed or cancelled bookings
      if (b.bookingStatus === 'Completed' || b.bookingStatus === 'Cancelled') continue;
      const slotNum = b.currentSlotId?.slotNumber;
      const slotId = b.currentSlotId?._id;
      if (slotNum && !map.has(slotNum)) map.set(slotNum, b);
      if (slotId && !map.has(slotId.toString())) map.set(slotId.toString(), b);
    }
    return map;
  }, [bookingsQuery.data]);

  // Filtered active and upcoming bookings (strictly excluding bookings that have exited)
  const validLiveBookings = useMemo(() => {
    if (!bookingsQuery.data?.bookings) return [];
    return bookingsQuery.data.bookings.filter(
      (b: any) =>
        (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Active' || b.bookingStatus === 'Overstay') &&
        !b.actualExitTime,
    );
  }, [bookingsQuery.data]);

  // Currently selected booking record (if any)
  const activeBooking = useMemo(() => {
    if (!selectedBookingId || validLiveBookings.length === 0) return null;
    return validLiveBookings.find((b: any) => b._id === selectedBookingId) || null;
  }, [selectedBookingId, validLiveBookings]);

  // Inspected Bay Information based on selectedSlotNumber
  const inspectedSlotInfo = useMemo(() => {
    if (!selectedSlotNumber) return null;

    const slotDoc = facilityDataQuery.data?.slots?.find((s: any) => s.slotNumber === selectedSlotNumber);
    const booking = slotBookingsMap.get(selectedSlotNumber);
    const reader = readersMap.get(`SLOT-${selectedSlotNumber}-READER`);
    const isBarrierOpen = reader?.barrierState === 'OPEN';
    const isObstructed = Boolean(reader?.isObstructed);

    let displayStatus: SlotDisplayStatus = 'Available';

    if (isBarrierOpen) {
      displayStatus = 'Barrier Open';
    } else if (isObstructed) {
      displayStatus = 'Under Maintenance';
    } else if (booking) {
      if (booking.bookingStatus === 'Overstay') {
        displayStatus = 'Overstay';
      } else if (booking.bookingStatus === 'Active') {
        displayStatus = slotDoc?.slotStatus === 'Occupied' ? 'Occupied' : 'Reserved';
      } else if (booking.bookingStatus === 'Confirmed') {
        displayStatus = 'Reserved';
      } else {
        displayStatus = 'Available';
      }
    } else if (slotDoc?.slotStatus === 'Occupied') {
      displayStatus = 'Occupied';
    } else if (slotDoc?.slotStatus === 'Reserved') {
      displayStatus = 'Reserved';
    } else if (slotDoc?.slotStatus === 'Under Maintenance') {
      displayStatus = 'Under Maintenance';
    } else {
      displayStatus = 'Available';
    }

    return {
      slotNumber: selectedSlotNumber,
      slotType: slotDoc?.slotType || 'Standard',
      displayStatus,
      booking,
      reader,
      isBarrierOpen,
      isObstructed,
    };
  }, [selectedSlotNumber, facilityDataQuery.data?.slots, slotBookingsMap, readersMap]);

  // Operational facility state statistics
  const facilityStats = useMemo(() => {
    const slots: any[] = facilityDataQuery.data?.slots || [];
    const totalSlots = slots.length;

    let availableCount = 0;
    let reservedCount = 0;
    let occupiedCount = 0;
    let overstayCount = 0;
    let barrierOpenCount = 0;

    for (const s of slots) {
      const slotReader = readersMap.get(`SLOT-${s.slotNumber}-READER`);
      const isBarrierOpen = slotReader?.barrierState === 'OPEN';
      const b = slotBookingsMap.get(s.slotNumber) || slotBookingsMap.get(s._id?.toString());

      if (isBarrierOpen) {
        barrierOpenCount++;
      }

      if (b) {
        if (b.bookingStatus === 'Overstay') {
          overstayCount++;
        } else if (b.bookingStatus === 'Active') {
          occupiedCount++;
        } else if (b.bookingStatus === 'Confirmed') {
          reservedCount++;
        } else {
          availableCount++;
        }
      } else if (s.slotStatus === 'Occupied') {
        occupiedCount++;
      } else if (s.slotStatus === 'Reserved') {
        reservedCount++;
      } else {
        availableCount++;
      }
    }

    const entryReader = readersMap.get('ENTRY-GATE-01');
    const exitReader = readersMap.get('EXIT-GATE-01');

    return {
      totalSlots,
      availableCount,
      reservedCount,
      occupiedCount,
      overstayCount,
      barrierOpenCount,
      entryBarrierState: entryReader?.barrierState || 'CLOSED',
      exitBarrierState: exitReader?.barrierState || 'CLOSED',
    };
  }, [facilityDataQuery.data?.slots, slotBookingsMap, readersMap]);

  // Generate QR Code image for the active booking
  useEffect(() => {
    let isMounted = true;
    const token = activeBooking?.qrCode || activeBooking?.bookingReference || '';
    if (!token) {
      setActiveBookingQrDataUrl('');
      return;
    }

    QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setActiveBookingQrDataUrl(url);
      })
      .catch(() => {
        if (isMounted) setActiveBookingQrDataUrl('');
      });

    return () => {
      isMounted = false;
    };
  }, [activeBooking]);

  // Extract layout elements for selected floor with accurate live booking and hardware barrier states
  const { elements, canvasConfig, targetElementId } = useMemo(() => {
    if (!facilityDataQuery.data?.layouts) {
      return { elements: [] as LayoutElementData[], canvasConfig: DEFAULT_CANVAS_CONFIG, targetElementId: null };
    }

    const currentLayout =
      facilityDataQuery.data.layouts.find((l: any) => {
        const layoutFloorId = typeof l.floorId === 'object' && l.floorId !== null ? l.floorId._id : l.floorId;
        return String(layoutFloorId) === String(selectedFloorId);
      }) ||
      facilityDataQuery.data.layouts[0];

    if (!currentLayout) {
      return { elements: [] as LayoutElementData[], canvasConfig: DEFAULT_CANVAS_CONFIG, targetElementId: null };
    }

    const rawElements: LayoutElementData[] = (currentLayout.elements || []).map((el: any) => {
      const elCopy: LayoutElementData = {
        ...el,
        elementId: el.elementId || el._id || `el-sim-${Math.random()}`,
      };

      if (el.elementType === 'ParkingSlot') {
        const slotReaderId = `SLOT-${el.slotNumber}-READER`;
        const r = readersMap.get(slotReaderId);
        const barrierState = r?.barrierState || 'CLOSED';
        const isTimerActive = Boolean(r?.autoCloseTimerActive);
        const isObstructed = Boolean(r?.isObstructed);
        const booking = slotBookingsMap.get(el.slotNumber) || (el.slotId ? slotBookingsMap.get(el.slotId) : null);

        const slotDeadline = r?.autoCloseDeadline ? new Date(r.autoCloseDeadline).getTime() : 0;
        const slotSecLeft = slotDeadline > nowTime ? Math.max(0, Math.ceil((slotDeadline - nowTime) / 1000)) : 0;

        // Derive effective slot status according to user specification:
        // Available | Reserved | Occupied | Overstay | Barrier Open
        if (barrierState === 'OPEN') {
          elCopy.effectiveStatus = 'Barrier Open';
          elCopy.color = '#38bdf8'; // Sky blue
          elCopy.label = slotSecLeft > 0 ? `Bay ${el.slotNumber} • ⏳ ${formatCountdown(slotSecLeft)}` : `Bay ${el.slotNumber} • BARRIER OPEN`;
        } else if (isObstructed) {
          elCopy.effectiveStatus = 'Under Maintenance';
          elCopy.color = '#ef4444';
          elCopy.label = `Bay ${el.slotNumber} • OBSTRUCTED`;
        } else if (booking) {
          if (booking.bookingStatus === 'Overstay') {
            elCopy.effectiveStatus = 'Overstay';
            elCopy.color = '#dc2626'; // Deep red
            elCopy.label = `Bay ${el.slotNumber} • OVERSTAY (${booking.vehicleId?.vehicleNumber || 'Vehicle'})`;
          } else if (booking.bookingStatus === 'Active') {
            const slotDoc = facilityDataQuery.data?.slots?.find((s: any) => s.slotNumber === el.slotNumber);
            if (slotDoc?.slotStatus === 'Occupied') {
              elCopy.effectiveStatus = 'Occupied';
              elCopy.color = '#ef4444'; // Red
              elCopy.label = `Bay ${el.slotNumber} • OCCUPIED (${booking.vehicleId?.vehicleNumber || 'Vehicle'})`;
            } else {
              elCopy.effectiveStatus = 'Reserved';
              elCopy.color = '#f59e0b'; // Amber
              elCopy.label = `Bay ${el.slotNumber} • RESERVED (${booking.bookingReference})`;
            }
          } else if (booking.bookingStatus === 'Confirmed') {
            elCopy.effectiveStatus = 'Reserved';
            elCopy.color = '#f59e0b'; // Amber
            elCopy.label = `Bay ${el.slotNumber} • RESERVED (${booking.bookingReference})`;
          } else {
            elCopy.effectiveStatus = 'Available';
            elCopy.color = '#10b981';
            elCopy.label = `Bay ${el.slotNumber} • AVAILABLE`;
          }
        } else if (isTimerActive) {
          elCopy.effectiveStatus = 'Reserved';
          elCopy.color = '#f59e0b';
          elCopy.label = `Bay ${el.slotNumber} • 5-MIN TIMER`;
        } else {
          // Check slot doc in database
          const slotDoc = facilityDataQuery.data?.slots?.find((s: any) => s.slotNumber === el.slotNumber);
          if (slotDoc?.slotStatus === 'Occupied') {
            elCopy.effectiveStatus = 'Occupied';
            elCopy.color = '#ef4444';
            elCopy.label = `Bay ${el.slotNumber} • OCCUPIED`;
          } else if (slotDoc?.slotStatus === 'Reserved') {
            elCopy.effectiveStatus = 'Reserved';
            elCopy.color = '#f59e0b';
            elCopy.label = `Bay ${el.slotNumber} • RESERVED`;
          } else if (slotDoc?.slotStatus === 'Under Maintenance') {
            elCopy.effectiveStatus = 'Under Maintenance';
            elCopy.color = '#64748b';
            elCopy.label = `Bay ${el.slotNumber} • MAINTENANCE`;
          } else {
            elCopy.effectiveStatus = 'Available';
            elCopy.color = '#10b981';
            elCopy.label = `Bay ${el.slotNumber} • AVAILABLE`;
          }
        }
      }

      if (el.elementType === 'Entrance') {
        const entryReader = readersMap.get('ENTRY-GATE-01');
        const entryDeadline = entryReader?.autoCloseDeadline ? new Date(entryReader.autoCloseDeadline).getTime() : 0;
        const entrySecLeft = entryDeadline > nowTime ? Math.max(0, Math.ceil((entryDeadline - nowTime) / 1000)) : 0;
        if (entryReader?.barrierState === 'OPEN') {
          elCopy.color = '#38bdf8';
          elCopy.label = entrySecLeft > 0 ? `ENTRY GATE • ⏳ ${formatCountdown(entrySecLeft)}` : 'ENTRY GATE [BARRIER OPEN]';
        } else {
          elCopy.label = 'ENTRY GATE [BARRIER CLOSED]';
        }
      }

      if (el.elementType === 'Exit') {
        const exitReader = readersMap.get('EXIT-GATE-01');
        const exitDeadline = exitReader?.autoCloseDeadline ? new Date(exitReader.autoCloseDeadline).getTime() : 0;
        const exitSecLeft = exitDeadline > nowTime ? Math.max(0, Math.ceil((exitDeadline - nowTime) / 1000)) : 0;
        if (exitReader?.barrierState === 'OPEN') {
          elCopy.color = '#38bdf8';
          elCopy.label = exitSecLeft > 0 ? `EXIT GATE • ⏳ ${formatCountdown(exitSecLeft)}` : 'EXIT GATE [BARRIER OPEN]';
        } else {
          elCopy.label = 'EXIT GATE [BARRIER CLOSED]';
        }
      }

      return elCopy;
    });

    const targetSlotEl = rawElements.find(
      (el) => el.elementType === 'ParkingSlot' && el.slotNumber === selectedSlotNumber,
    );

    return {
      elements: rawElements,
      canvasConfig: currentLayout.canvasConfig || DEFAULT_CANVAS_CONFIG,
      targetElementId: targetSlotEl ? targetSlotEl.elementId : null,
    };
  }, [facilityDataQuery.data, selectedFloorId, readersMap, selectedSlotNumber, slotBookingsMap, nowTime, formatCountdown]);

  // MUTATIONS
  const scanQrMutation = useMutation({
    mutationFn: barrierApi.scanQr,
    onSuccess: (data) => {
      setScanResult(data);
      if (data.authorized) {
        toast.success(`Access Authorized: ${data.message}`);
        if (data.assignedSlot?.slotNumber) {
          setSelectedSlotNumber(data.assignedSlot.slotNumber);
        }
      } else {
        toast.error(`Access Rejected: ${data.message}`);
      }
      autoClosingReadersRef.current.clear();
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
      void queryClient.refetchQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
      void queryClient.invalidateQueries({ queryKey: ['barrier-events', selectedLotId] });
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-bookings', selectedLotId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'QR Scan failed.');
    },
  });

  const confirmPassageMutation = useMutation({
    mutationFn: barrierApi.confirmPassage,
    onSuccess: (data) => {
      toast.success(data.message);
      autoClosingReadersRef.current.clear();
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
      void queryClient.invalidateQueries({ queryKey: ['barrier-events', selectedLotId] });
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-bookings', selectedLotId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to confirm passage.');
    },
  });

  const sendCommandMutation = useMutation({
    mutationFn: barrierApi.sendCommand,
    onSuccess: () => {
      toast.success('Barrier command acknowledged.');
      autoClosingReadersRef.current.clear();
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
      void queryClient.invalidateQueries({ queryKey: ['barrier-events', selectedLotId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Command failed.');
    },
  });

  const toggleObstructionMutation = useMutation({
    mutationFn: barrierApi.setObstruction,
    onSuccess: (data) => {
      toast.info(`Safety sensor obstruction set to: ${data.isObstructed}`);
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
    },
  });

  // Track in-flight or completed auto-closures to prevent repeated calls and spam notifications
  const autoClosingReadersRef = useRef<Set<string>>(new Set());

  const executeAutoClose = useCallback(
    async (readerId: string, isManual: boolean = false) => {
      if (autoClosingReadersRef.current.has(readerId)) return;
      autoClosingReadersRef.current.add(readerId);

      // 1. Optimistically update local React Query cache immediately
      // The barrier instantly closes in the UI without waiting for network or page reload!
      queryClient.setQueryData(['barrier-facility-state', selectedLotId], (oldData: any) => {
        if (!oldData) return oldData;
        const updatedReaders = (oldData.readers || []).map((r: BarrierReaderInfo) => {
          if (r.readerId === readerId) {
            return {
              ...r,
              barrierState: 'CLOSED',
              autoCloseTimerActive: false,
              autoCloseDeadline: null,
            };
          }
          return r;
        });

        const updatedSlots = (oldData.slots || []).map((s: any) => {
          if (`SLOT-${s.slotNumber}-READER` === readerId && s.slotStatus === 'Reserved') {
            return {
              ...s,
              slotStatus: 'Occupied',
            };
          }
          return s;
        });

        return {
          ...oldData,
          readers: updatedReaders,
          slots: updatedSlots,
        };
      });

      // 2. Synchronize with backend with exact parkingLotId
      try {
        await barrierApi.forceAutoClose({ readerId, parkingLotId: selectedLotId });
        if (isManual) {
          toast.success('Barrier auto-closed successfully.');
        }
      } catch (err: any) {
        if (isManual) {
          toast.error(err.response?.data?.message || 'Auto-close failed.');
        }
      } finally {
        void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
        void queryClient.invalidateQueries({ queryKey: ['barrier-events', selectedLotId] });
      }
    },
    [selectedLotId, queryClient],
  );

  const acceleratedTimerMutation = useMutation({
    mutationFn: barrierApi.setAcceleratedTimer,
    onSuccess: (data) => {
      setAcceleratedSpeed(data.multiplier || 1);
      toast.info(
        `Barrier auto-close speed set to: ${data.multiplier}x (${data.multiplier === 60 ? '5s mode' : data.multiplier === 10 ? '30s mode' : '5m real-time'
        })`,
      );
      void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
    },
  });

  // Execute scan at target reader with a given decoded string
  const executeScanWithPayload = useCallback(
    (decodedPayload: string) => {
      if (!selectedLotId || !selectedReaderId) {
        toast.error('Please select facility and reader.');
        return;
      }
      const payload = decodedPayload.trim();
      if (!payload) {
        toast.error('No QR payload captured.');
        return;
      }

      setIsVerifyingScan(true);
      scanQrMutation.mutate(
        {
          parkingLotId: selectedLotId,
          readerId: selectedReaderId,
          qrPayload: payload,
          source: 'SIMULATOR',
        },
        {
          onSettled: () => {
            setIsVerifyingScan(false);
          },
        },
      );
    },
    [selectedLotId, selectedReaderId, scanQrMutation],
  );

  // Stop Camera Utility
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current && isCameraScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        isCameraScanningRef.current = false;
        setIsCameraActive(false);
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
  }, []);

  // Start Camera Utility
  const startCamera = useCallback(async () => {
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('sim-camera-viewport');
      }

      if (isCameraScanningRef.current) {
        await stopCamera();
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.max(160, Math.floor(minEdge * 0.78));
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          stopCamera();
          toast.success(`Optical Camera Captured QR: ${decodedText}`);
          executeScanWithPayload(decodedText);
        },
        () => {
          // ignore per-frame parse failures
        },
      );

      isCameraScanningRef.current = true;
      setIsCameraActive(true);
    } catch (err: unknown) {
      console.error('Camera startup error:', err);
      toast.error('Camera access denied or unavailable. Use Optical Pass Scan or File Upload.');
      setIsCameraActive(false);
    }
  }, [stopCamera, executeScanWithPayload]);

  // Clean up camera on unmount or tab switch
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (scannerMode !== 'CAMERA') {
      void stopCamera();
    }
  }, [scannerMode, stopCamera]);

  // Handle File Upload QR Scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('sim-camera-viewport');
      }
      const decodedText = await html5QrCodeRef.current.scanFile(file, true);
      toast.success(`Image Decoded: ${decodedText}`);
      executeScanWithPayload(decodedText);
    } catch (err: unknown) {
      toast.error('Could not decode a valid QR code from the selected image.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Optical Hardware Pass Scan simulation (visual laser scanning animation)
  const handlePerformOpticalPassScan = () => {
    const payload = customQrPayload.trim() || activeBooking?.qrCode || activeBooking?.bookingReference || '';
    if (!payload) {
      toast.error('Select an active booking or enter a custom QR payload to scan.');
      return;
    }

    setIsScanningLaserActive(true);
    setTimeout(() => {
      setIsScanningLaserActive(false);
      executeScanWithPayload(payload);
    }, 850);
  };

  // Execute vehicle passage confirmation
  const handleConfirmPassage = (direction: 'IN' | 'OUT') => {
    if (!selectedLotId || !selectedReaderId) {
      toast.error('Select facility and reader.');
      return;
    }

    const bookingIdToPass = activeBooking?._id || inspectedSlotInfo?.booking?._id;
    if (!bookingIdToPass) {
      toast.error('Please select an active booking or a bay with an active booking first.');
      return;
    }

    confirmPassageMutation.mutate({
      parkingLotId: selectedLotId,
      readerId: selectedReaderId,
      bookingId: bookingIdToPass,
      direction,
      source: 'SIMULATOR',
    });
  };

  // Handle clicking an element on the canvas
  const handleSelectCanvasElement = useCallback(
    (el: LayoutElementData | null) => {
      if (!el) return;
      if (el.elementType === 'ParkingSlot' && el.slotNumber) {
        setSelectedSlotNumber(el.slotNumber);
        setSelectedReaderId(`SLOT-${el.slotNumber}-READER`);

        // Check if there is a booking on this slot
        const booking = slotBookingsMap.get(el.slotNumber);
        if (booking) {
          setSelectedBookingId(booking._id);
        } else {
          // Clear booking ID so that inspected slot does not show old booking data
          setSelectedBookingId('');
        }
      } else if (el.elementType === 'Entrance') {
        setSelectedReaderId('ENTRY-GATE-01');
      } else if (el.elementType === 'Exit') {
        setSelectedReaderId('EXIT-GATE-01');
      }
    },
    [slotBookingsMap],
  );

  // Individual auto-close countdown tracking for EACH barrier across the facility
  const activeTimersList = useMemo(() => {
    const list: Array<{
      readerId: string;
      readerType: string;
      slotNumber?: string | null;
      displayName: string;
      barrierState: string;
      isTimerActive: boolean;
      secondsLeft: number;
      deadlineFormatted: string;
      isObstructed: boolean;
      percentRemaining: number;
    }> = [];

    const fullDuration = 300 / acceleratedSpeed;

    for (const r of readersMap.values()) {
      const isBarrierOpen = r.barrierState === 'OPEN';
      let deadline = r.autoCloseDeadline ? new Date(r.autoCloseDeadline).getTime() : 0;
      let isTimerActive = Boolean(r.autoCloseTimerActive && isBarrierOpen && deadline);

      // Fallback: If barrier is OPEN without an explicit deadline, calculate from barrierOpenedAt
      if (isBarrierOpen && !deadline && r.barrierOpenedAt) {
        const openedAt = new Date(r.barrierOpenedAt).getTime();
        const fallbackDeadline = openedAt + fullDuration * 1000;
        if (fallbackDeadline > nowTime) {
          deadline = fallbackDeadline;
          isTimerActive = true;
        }
      }

      const secondsLeft = isTimerActive && deadline ? Math.max(0, Math.ceil((deadline - nowTime) / 1000)) : 0;

      let displayName = r.readerId;
      if (r.readerType === 'ENTRY') {
        displayName = 'Main Entry Gate';
      } else if (r.readerType === 'EXIT') {
        displayName = 'Main Exit Gate';
      } else if (r.readerType === 'SLOT' || r.slotNumber) {
        displayName = `Bay ${r.slotNumber || r.readerId.replace('SLOT-', '').replace('-READER', '')} Barrier`;
      }

      // Include all open barriers, barriers with active countdowns, and the selected barrier
      if (isBarrierOpen || isTimerActive || r.readerId === selectedReaderId) {
        const percentRemaining = secondsLeft > 0 ? Math.min(100, Math.max(0, (secondsLeft / fullDuration) * 100)) : 0;

        list.push({
          readerId: r.readerId,
          readerType: r.readerType,
          slotNumber: r.slotNumber,
          displayName,
          barrierState: r.barrierState,
          isTimerActive,
          secondsLeft,
          deadlineFormatted: deadline ? new Date(deadline).toLocaleTimeString() : 'None',
          isObstructed: Boolean(r.isObstructed),
          percentRemaining,
        });
      }
    }

    return list.sort((a, b) => {
      if (a.isTimerActive && !b.isTimerActive) return -1;
      if (!a.isTimerActive && b.isTimerActive) return 1;
      if (a.barrierState === 'OPEN' && b.barrierState !== 'OPEN') return -1;
      if (a.barrierState !== 'OPEN' && b.barrierState === 'OPEN') return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [readersMap, nowTime, selectedReaderId, acceleratedSpeed]);

  // Automatically trigger auto-close when countdown reaches 0 for any barrier, or if an open barrier has expired/has no active timer
  useEffect(() => {
    for (const item of activeTimersList) {
      if (item.barrierState === 'OPEN' && !item.isObstructed) {
        if (!item.isTimerActive || item.secondsLeft === 0) {
          void executeAutoClose(item.readerId, false);
        }
      }
    }
  }, [activeTimersList, executeAutoClose]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner: SIMULATED HARDWARE MODE */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 text-xs animate-pulse">
            Barrier Simulator
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-amber-300/80">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping inline-block" />
        </div>
      </div>

      {/* Main Top Header Controls: Facility Selector & Live Clock */}
      <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="h-6 w-6 text-primary" />
            ParkEase QR Barrier &amp; Hardware Simulator
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Scan QR passes at gate &amp; bay terminals to trigger physical barriers, auto-closures, and departures.
          </p>
        </div>

        {/* Facility Dropdown & Floor Switcher */}
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Select Facility</label>
            <select
              value={selectedLotId}
              onChange={(e) => {
                setSelectedLotId(e.target.value);
                setSelectedFloorId('');
                setSelectedBookingId('');
                setSelectedSlotNumber(null);
              }}
              className="h-9 rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-primary min-w-[240px]"
            >
              {facilitiesQuery.isLoading && <option value="">Loading facilities...</option>}
              {!facilitiesQuery.isLoading && (!facilitiesQuery.data?.facilities || facilitiesQuery.data.facilities.length === 0) && (
                <option value="">No facilities found</option>
              )}
              {facilitiesQuery.data?.facilities.map((lot) => (
                <option key={lot._id} value={lot._id}>
                  {lot.parkingName} {lot.city ? `(${lot.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Floor Selection Dropdown */}
          {facilityDataQuery.data?.floors && facilityDataQuery.data.floors.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="h-3 w-3 text-emerald-400" />
                Floor
              </label>
              <select
                value={selectedFloorId}
                onChange={(e) => {
                  setSelectedFloorId(e.target.value);
                  setSelectedSlotNumber(null);
                }}
                className="h-9 rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-white font-medium focus:outline-hidden focus:ring-1 focus:ring-primary min-w-[150px]"
              >
                {facilityDataQuery.data.floors.map((fl: any) => {
                  const count = floorSlotCounts.get(String(fl._id));
                  return (
                    <option key={fl._id} value={fl._id}>
                      {fl.floorName || `Floor ${fl.floorNumber}`} {count !== undefined ? `(${count} bays)` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Facility Operational State KPI Strip (Real-time Async Dynamic Badges) */}
      <div className="bg-slate-900 border-b border-slate-800/80 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            Facility State:
            {facilityDataQuery.isFetching || bookingsQuery.isFetching ? (
              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            )}
          </span>
          <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-200">
            Total Bays: <strong className="ml-1 text-white">{facilityStats.totalSlots}</strong>
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Available: <strong className="ml-1">{facilityStats.availableCount}</strong>
          </Badge>
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Reserved: <strong className="ml-1">{facilityStats.reservedCount}</strong>
          </Badge>
          <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/30">
            Occupied: <strong className="ml-1">{facilityStats.occupiedCount}</strong>
          </Badge>
          {facilityStats.overstayCount > 0 && (
            <Badge className="bg-red-600/30 text-red-300 border border-red-500/50 animate-pulse font-bold">
              Overstay: <strong className="ml-1">{facilityStats.overstayCount}</strong>
            </Badge>
          )}
          {facilityStats.barrierOpenCount > 0 && (
            <Badge className="bg-sky-500/20 text-sky-300 border border-sky-400/50 font-bold">
              Barriers Open: <strong className="ml-1">{facilityStats.barrierOpenCount}</strong>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Entry Barrier:</span>
            <Badge
              className={
                facilityStats.entryBarrierState === 'OPEN'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 font-bold'
                  : 'bg-slate-800 text-slate-400'
              }
            >
              {facilityStats.entryBarrierState}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Exit Barrier:</span>
            <Badge
              className={
                facilityStats.exitBarrierState === 'OPEN'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 font-bold'
                  : 'bg-slate-800 text-slate-400'
              }
            >
              {facilityStats.exitBarrierState}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Grid: 2D Layout & Hardware Overlay (Left 8 Cols) + Hardware Control Panel (Right 4 Cols) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* =================================================================== */}
        {/* LEFT COLUMN: INTERACTIVE 2D FACILITY LAYOUT WITH HARDWARE OVERLAY   */}
        {/* =================================================================== */}
        <div className="lg:col-span-8 flex flex-col border-r border-slate-800 bg-slate-950 p-4 space-y-3">
          {/* Top Bar above Layout: Legend and Current Reader Info */}
          {/* Top Bar above Layout: Floor Switcher, Pan/Zoom Controls, Legend, and Current Reader Info */}
          <div className="flex flex-col gap-2 bg-slate-900/70 rounded-xl p-3 border border-slate-800 text-xs">
            {/* Row 1: Floor Switcher & Viewport Controls (Pan, Zoom, Reset) */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
              {/* Floor Switcher Dropdown & Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Layers className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-semibold text-slate-300 text-xs">Floor:</span>
                  <select
                    value={selectedFloorId}
                    onChange={(e) => {
                      setSelectedFloorId(e.target.value);
                      setSelectedSlotNumber(null);
                    }}
                    className="bg-transparent text-white font-medium text-xs border-none focus:outline-hidden cursor-pointer"
                  >
                    {(facilityDataQuery.data?.floors || []).map((fl: any) => {
                      const count = floorSlotCounts.get(String(fl._id));
                      return (
                        <option key={fl._id} value={fl._id} className="bg-slate-900 text-white">
                          {fl.floorName || `Floor ${fl.floorNumber}`} {count !== undefined ? `(${count} bays)` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Multiple Floor Quick Switcher Pills */}
                {facilityDataQuery.data?.floors && facilityDataQuery.data.floors.length > 1 && (
                  <div className="hidden sm:flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/80">
                    {facilityDataQuery.data.floors.map((fl: any) => (
                      <Button
                        key={fl._id}
                        type="button"
                        size="sm"
                        variant={String(selectedFloorId) === String(fl._id) ? 'default' : 'ghost'}
                        onClick={() => {
                          setSelectedFloorId(String(fl._id));
                          setSelectedSlotNumber(null);
                        }}
                        className={`h-6 text-[11px] px-2.5 py-0 rounded-md font-medium transition-all ${String(selectedFloorId) === String(fl._id)
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                      >
                        {fl.floorName}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Viewport Pan & Zoom Controls */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
                {/* Mode: Select vs Pan */}
                <Button
                  type="button"
                  size="sm"
                  variant={activeTool === 'select' ? 'default' : 'ghost'}
                  onClick={() => setActiveTool('select')}
                  className={`h-7 px-2.5 text-xs gap-1 font-medium ${activeTool === 'select'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  title="Inspect Mode: Click bays to inspect and trigger hardware"
                >
                  <MousePointer className="h-3 w-3" />
                  <span>Select</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeTool === 'pan' ? 'default' : 'ghost'}
                  onClick={() => setActiveTool('pan')}
                  className={`h-7 px-2.5 text-xs gap-1 font-medium ${activeTool === 'pan'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  title="Pan Mode: Click & drag anywhere to move canvas"
                >
                  <Hand className="h-3 w-3" />
                  <span>Pan</span>
                </Button>

                <div className="h-4 w-px bg-slate-800 mx-0.5" />

                {/* Pan Nudge Arrows */}
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPanX((prev) => prev + 60)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Pan Left"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPanX((prev) => prev - 60)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Pan Right"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPanY((prev) => prev + 60)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Pan Up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPanY((prev) => prev - 60)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Pan Down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="h-4 w-px bg-slate-800 mx-0.5" />

                {/* Zoom In, Out, Reset */}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)))}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="font-mono text-[11px] text-slate-300 px-1 min-w-[38px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPanX(20);
                    setPanY(20);
                    setZoom(0.75);
                  }}
                  className="h-7 px-2 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 gap-1"
                  title="Reset Pan & Zoom"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </Button>
              </div>
            </div>

            {/* Row 2: Active Reader Badge and Color Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary animate-pulse" />
                <span className="font-semibold text-slate-200">Active Reader:</span>
                <Badge variant="outline" className="font-mono text-xs border-primary/40 bg-primary/10 text-primary">
                  {selectedReaderId}
                </Badge>
                {currentReader && (
                  <Badge
                    className={
                      currentReader.barrierState === 'OPEN'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }
                  >
                    Barrier: {currentReader.barrierState}
                  </Badge>
                )}
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Reserved
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" /> Occupied
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600 inline-block animate-pulse" /> Overstay
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400 inline-block" /> Barrier Open
                </span>
              </div>
            </div>
          </div>

          {/* 2D Canvas Viewport */}
          <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden min-h-[460px] relative">
            {/* Floating Live Barrier Auto-Close Countdown HUD */}
            {activeTimersList.filter((t) => t.isTimerActive).length > 0 && (
              <div className="absolute top-3 inset-x-0 mx-auto w-fit max-w-[95%] z-30 flex flex-wrap items-center justify-center gap-2 bg-slate-950/95 border border-amber-500/60 shadow-[0_4px_24px_rgba(245,158,11,0.25)] backdrop-blur-md rounded-2xl px-4 py-2">
                <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider font-mono font-black text-amber-400">
                      LIVE BARRIER TIMERS
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {acceleratedSpeed}x Speed Multiplier
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeTimersList
                    .filter((t) => t.isTimerActive)
                    .map((item) => (
                      <div
                        key={`hud-${item.readerId}`}
                        onClick={() => {
                          setSelectedReaderId(item.readerId);
                          if (item.slotNumber) setSelectedSlotNumber(item.slotNumber);
                        }}
                        className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 rounded-xl px-3 py-1 cursor-pointer transition-all shadow-sm"
                        title="Click to target this barrier"
                      >
                        <span className="text-sm">
                          {item.readerType === 'ENTRY' ? '🚪' : item.readerType === 'EXIT' ? '🏁' : '🅿️'}
                        </span>
                        <div className="flex flex-col text-left">
                          <span className="text-[11px] font-bold text-white leading-tight">
                            {item.displayName}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            {item.readerId}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-1 bg-black/80 border border-amber-500/50 px-2 py-0.5 rounded-lg shadow-inner">
                          <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                          <span className="text-sm font-black font-mono tracking-widest text-amber-300">
                            {formatCountdown(item.secondsLeft)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {facilityDataQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center h-full p-12 space-y-3">
                <Skeleton className="h-8 w-48 bg-slate-800" />
                <Skeleton className="h-64 w-full bg-slate-800" />
              </div>
            ) : elements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                <Layers className="h-8 w-8 mb-2 opacity-50" />
                <p>No published 2D layout found for this facility.</p>
              </div>
            ) : (
              <CanvasViewport
                elements={elements}
                canvasConfig={canvasConfig}
                selectedElementId={targetElementId}
                highlightedElementId={targetElementId}
                mode="booking"
                activeTool={activeTool}
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
                onSelectElement={handleSelectCanvasElement}
                onUpdateElementPosition={() => { }}
                onRotateElement={() => { }}
                onRemoveElement={() => { }}
                onDropNewElement={() => { }}
              />
            )}

            {/* Viewport pan hint overlay */}
            <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-400 rounded-lg px-2.5 py-1 text-[10px] flex items-center gap-1.5 shadow-md pointer-events-none">
              <Move className="h-3 w-3 text-slate-400" />
              <span>Drag background or Hand tool to Pan • Scroll to Zoom</span>
            </div>

            {/* Target Bay Banner Overlay */}
            {selectedSlotNumber && (
              <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 shadow-lg">
                <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                <span>Selected Bay: <strong className="text-primary font-mono">{selectedSlotNumber}</strong></span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-slate-300 font-mono text-[11px]">{selectedReaderId}</span>
              </div>
            )}
          </div>

          {/* Quick Reader Switcher Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Direct Reader Select:</span>
            <Button
              size="sm"
              variant={selectedReaderId === 'ENTRY-GATE-01' ? 'default' : 'outline'}
              onClick={() => setSelectedReaderId('ENTRY-GATE-01')}
              className="text-xs h-7 gap-1"
            >
              Entry Gate
            </Button>
            <Button
              size="sm"
              variant={selectedReaderId === 'EXIT-GATE-01' ? 'default' : 'outline'}
              onClick={() => setSelectedReaderId('EXIT-GATE-01')}
              className="text-xs h-7 gap-1"
            >
              Exit Gate
            </Button>
            {inspectedSlotInfo && (
              <Button
                size="sm"
                variant={selectedReaderId === `SLOT-${inspectedSlotInfo.slotNumber}-READER` ? 'default' : 'outline'}
                onClick={() => setSelectedReaderId(`SLOT-${inspectedSlotInfo.slotNumber}-READER`)}
                className="text-xs h-7 gap-1 border-primary/40 text-primary"
              >
                Bay {inspectedSlotInfo.slotNumber} Reader
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedReaderId('SLOT-B-99-READER')}
              className="text-xs h-7 gap-1 text-rose-400 border-rose-500/30"
              title="Test Wrong-Slot Rejection"
            >
              Wrong Bay Reader
            </Button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: HARDWARE CONTROLLER PANEL & INTERACTIVE SCANNER       */}
        {/* =================================================================== */}
        <div className="lg:col-span-4 flex flex-col bg-slate-900 overflow-y-auto max-h-[calc(100vh-140px)] p-4 space-y-4">
          {/* Card 1: Inspected Bay State (Updates whenever user clicks ANY slot) */}
          {inspectedSlotInfo && (
            <Card className="border-slate-800 bg-slate-950/80 shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                    <MapPin className="h-4 w-4 text-emerald-400" />
                    Inspected Bay: Slot {inspectedSlotInfo.slotNumber}
                  </CardTitle>
                  <Badge
                    className={
                      inspectedSlotInfo.displayStatus === 'Barrier Open'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 font-bold'
                        : inspectedSlotInfo.displayStatus === 'Overstay'
                          ? 'bg-red-600/30 text-red-300 border border-red-500/50 font-black animate-pulse'
                          : inspectedSlotInfo.displayStatus === 'Occupied'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                            : inspectedSlotInfo.displayStatus === 'Reserved'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    }
                  >
                    {inspectedSlotInfo.displayStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Bay Reader:</span>
                    <span className="font-mono text-slate-200">SLOT-{inspectedSlotInfo.slotNumber}-READER</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Barrier State:</span>
                    <Badge
                      className={
                        inspectedSlotInfo.isBarrierOpen
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-400'
                          : 'bg-slate-800 text-slate-400'
                      }
                    >
                      {inspectedSlotInfo.isBarrierOpen ? 'OPEN' : 'CLOSED'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Auto-Close Timer:</span>
                    {inspectedSlotInfo.isBarrierOpen && inspectedSlotInfo.reader?.autoCloseDeadline ? (
                      (() => {
                        const dl = new Date(inspectedSlotInfo.reader.autoCloseDeadline).getTime();
                        const sec = dl > nowTime ? Math.max(0, Math.ceil((dl - nowTime) / 1000)) : 0;
                        return (
                          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono animate-pulse font-bold">
                            ⏳ {formatCountdown(sec)} ({sec}s)
                          </Badge>
                        );
                      })()
                    ) : (
                      <span className="text-slate-500 font-mono text-[10px]">Inactive (Closed)</span>
                    )}
                  </div>

                  {inspectedSlotInfo.booking ? (
                    <>
                      <div className="border-t border-slate-800 pt-1.5 flex justify-between items-center">
                        <span className="text-slate-400">Current Booking:</span>
                        <span className="font-mono font-bold text-primary">
                          {inspectedSlotInfo.booking.bookingReference}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Customer:</span>
                        <span className="font-semibold text-white">
                          {inspectedSlotInfo.booking.customerId?.fullName || 'Guest Driver'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Vehicle:</span>
                        <span className="font-mono text-white">
                          {inspectedSlotInfo.booking.vehicleId?.vehicleNumber || 'Vehicle'}
                        </span>
                      </div>
                      {inspectedSlotInfo.booking.bookingStatus === 'Overstay' && (
                        <div className="border-t border-red-500/30 pt-1.5 flex justify-between items-center text-red-300 font-semibold">
                          <span>Overstay Penalty:</span>
                          <span className="font-mono">
                            {inspectedSlotInfo.booking.overstayDurationMinutes || 1}m &bull; ₹{inspectedSlotInfo.booking.overstayCharge || 0}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="border-t border-slate-800 pt-1.5 flex items-center gap-1.5 text-emerald-400/90">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      <span>No active vehicle or booking assigned. Bay is Available.</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs border-slate-700"
                    onClick={() => setSelectedReaderId(`SLOT-${inspectedSlotInfo.slotNumber}-READER`)}
                  >
                    Target Bay Reader
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card 2: Live Facility Bookings (Only active & upcoming that haven't passed exit gate) */}
          <Card className="border-slate-800 bg-slate-950/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                  <Car className="h-4 w-4 text-primary" />
                  Active &amp; Upcoming Bookings ({validLiveBookings.length})
                </CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-slate-400 hover:text-white"
                  onClick={() => {
                    void queryClient.invalidateQueries({ queryKey: ['barrier-facility-bookings', selectedLotId] });
                    void queryClient.invalidateQueries({ queryKey: ['barrier-facility-state', selectedLotId] });
                  }}
                  title="Refresh bookings"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <CardDescription className="text-[11px] text-slate-400">
                Only Confirmed (upcoming), Active (inside), and Overstay bookings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <select
                value={selectedBookingId}
                onChange={(e) => {
                  const bId = e.target.value;
                  setSelectedBookingId(bId);
                  const found = validLiveBookings.find((b: any) => b._id === bId);
                  if (found?.currentSlotId?.slotNumber) {
                    setSelectedSlotNumber(found.currentSlotId.slotNumber);
                    if (found.bookingStatus === 'Confirmed') {
                      setSelectedReaderId('ENTRY-GATE-01');
                    } else {
                      setSelectedReaderId(`SLOT-${found.currentSlotId.slotNumber}-READER`);
                    }
                  }
                }}
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-white"
              >
                <option value="">-- Choose Live Booking to Inspect / Scan --</option>
                {validLiveBookings.map((b: any) => (
                  <option key={b._id} value={b._id}>
                    {b.bookingReference} &bull; Bay {b.currentSlotId?.slotNumber || 'None'} &bull; {b.bookingStatus}
                  </option>
                ))}
              </select>

              {activeBooking ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Booking Ref:</span>
                    <span className="font-mono font-bold text-primary">{activeBooking.bookingReference}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-semibold text-white">{activeBooking.customerId?.fullName || 'Valued Customer'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Vehicle:</span>
                    <span className="font-mono text-white">
                      {activeBooking.vehicleId?.vehicleNumber || activeBooking.vehicleId?.licensePlate || 'Vehicle'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Assigned Bay:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      Bay {activeBooking.currentSlotId?.slotNumber || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Booking State:</span>
                    <Badge
                      className={
                        activeBooking.bookingStatus === 'Overstay'
                          ? 'bg-red-600/30 text-red-300 border border-red-500/50 font-black animate-pulse'
                          : activeBooking.bookingStatus === 'Active'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                            : activeBooking.bookingStatus === 'Confirmed'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                              : 'bg-slate-800 text-slate-300'
                      }
                    >
                      {activeBooking.bookingStatus === 'Confirmed'
                        ? 'Confirmed (Reserved)'
                        : activeBooking.bookingStatus === 'Active'
                          ? 'Active (Parked Inside)'
                          : activeBooking.bookingStatus === 'Overstay'
                            ? 'Overstay Active'
                            : activeBooking.bookingStatus}
                    </Badge>
                  </div>
                  {activeBooking.bookingStatus === 'Overstay' && (
                    <div className="pt-1.5 border-t border-red-500/30 flex justify-between items-center text-red-300 font-semibold">
                      <span>Overstay Penalty:</span>
                      <span className="font-mono">
                        {activeBooking.overstayDurationMinutes || 1} mins &bull; +₹{activeBooking.overstayCharge || 0}
                      </span>
                    </div>
                  )}
                  {activeBooking.slotReassignmentStatus === 'REASSIGNED' && (
                    <div className="pt-1 text-amber-400 font-medium border-t border-slate-800/80">
                      ⚠️ Reassigned from Bay {activeBooking.originalSlotId?.slotNumber || 'Original'} due to Overstay Conflict.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Select a live booking above to present its pass to the scanner.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Interactive Hardware Optical & Camera Scanner */}
          <Card className="border-slate-800 bg-slate-950/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                  <Scan className="h-4 w-4 text-emerald-400" />
                  Hardware QR Scanner
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/40 text-emerald-400">
                  Target: {selectedReaderId}
                </Badge>
              </div>
              <CardDescription className="text-[11px] text-slate-400">
                Simulate optical hardware scanning with camera, image upload, or visual pass reader.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {/* Scanner Mode Switcher Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setScannerMode('OPTICAL')}
                  className={`py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${scannerMode === 'OPTICAL'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <QrCode className="h-3 w-3" />
                  Pass Scan
                </button>
                <button
                  type="button"
                  onClick={() => setScannerMode('CAMERA')}
                  className={`py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${scannerMode === 'CAMERA'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <Camera className="h-3 w-3" />
                  Webcam
                </button>
                <button
                  type="button"
                  onClick={() => setScannerMode('UPLOAD')}
                  className={`py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${scannerMode === 'UPLOAD'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setScannerMode('MANUAL')}
                  className={`py-1 rounded-md font-semibold transition-all flex items-center justify-center gap-1 ${scannerMode === 'MANUAL'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <Cpu className="h-3 w-3" />
                  Manual
                </button>
              </div>

              {/* MODE 1: OPTICAL VIEWPORT WITH SQUARE PASS SCANNER FRAME */}
              {scannerMode === 'OPTICAL' && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 text-center">
                  {/* Square QR Reader Viewfinder Frame */}
                  <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px] aspect-square bg-slate-950 rounded-2xl p-4 flex flex-col items-center justify-center overflow-hidden border-2 border-emerald-500/40 shadow-2xl">
                    {/* Viewfinder Corner Brackets */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute top-3 right-3 w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute bottom-3 left-3 w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />

                    {/* HUD Status Header */}
                    <div className="absolute top-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                      <span className="text-[9px] uppercase tracking-widest font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900/90 text-emerald-400 border border-emerald-500/40 backdrop-blur-xs">
                        OPTICAL BARCODE READER
                      </span>
                    </div>

                    {/* Inner Square QR Code Presentation */}
                    <div className="relative w-44 h-44 aspect-square bg-white rounded-xl p-2.5 flex flex-col items-center justify-center overflow-hidden shadow-inner border border-slate-700">
                      {activeBookingQrDataUrl ? (
                        <img
                          src={activeBookingQrDataUrl}
                          alt="Booking QR"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-slate-400 flex flex-col items-center gap-1.5 p-2 text-center">
                          <QrCode className="h-10 w-10 text-slate-400" />
                          <span className="text-[10px] font-medium text-slate-600">Select booking or bay to load pass</span>
                        </div>
                      )}

                      {/* Animated Optical Laser Sweep Beam */}
                      {isScanningLaserActive && (
                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-red-500 via-rose-400 to-red-500 shadow-[0_0_14px_#ef4444] animate-bounce z-20" />
                      )}
                    </div>

                    {/* Bottom HUD info */}
                    <div className="absolute bottom-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                      <span className="text-[9px] font-mono text-slate-300 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 backdrop-blur-xs">
                        {activeBooking ? `PASS: ${activeBooking.bookingReference}` : 'NO PASS LOADED'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold text-slate-200 text-xs">
                      {activeBooking ? `Pass: ${activeBooking.bookingReference}` : 'Custom / Unassigned Pass'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Presenting pass to <strong className="text-emerald-400 font-mono">{selectedReaderId}</strong>
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handlePerformOpticalPassScan}
                    disabled={isScanningLaserActive || isVerifyingScan}
                    className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs shadow-md"
                  >
                    <Scan className="h-4 w-4" />
                    {isScanningLaserActive ? 'Scanning Optical Barcode...' : isVerifyingScan ? 'Verifying with Barrier...' : 'Present Pass & Scan'}
                  </Button>
                </div>
              )}

              {/* MODE 2: CAMERA WEBCAM SCANNER WITH SQUARE QR READER FRAME */}
              {scannerMode === 'CAMERA' && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
                  {/* Square QR Reader Viewfinder Frame */}
                  <div className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px] aspect-square bg-slate-950 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-2xl flex items-center justify-center">
                    {/* HTML5 QR Code Mount Element */}
                    <div id="sim-camera-viewport" className="w-full h-full" />

                    {/* Viewfinder HUD Corner Brackets */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute top-3 right-3 w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute bottom-3 left-3 w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />

                    {/* Inner Target Square Reticle Guide Box */}
                    <div className="absolute inset-7 border border-dashed border-emerald-500/25 rounded-xl pointer-events-none z-10 flex items-center justify-center">
                      {/* Center Crosshair */}
                      <div className="relative w-6 h-6 flex items-center justify-center opacity-30">
                        <div className="w-5 h-0.5 bg-emerald-400 rounded-full" />
                        <div className="h-5 w-0.5 bg-emerald-400 rounded-full -ml-2.5" />
                      </div>
                    </div>

                    {/* Active Camera HUD: Laser Sweep & Status Banner */}
                    {isCameraActive && (
                      <>
                        <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-qr-laser z-20 pointer-events-none" />
                        <div className="absolute top-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                          <span className="text-[9px] uppercase tracking-widest font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900/90 text-emerald-400 border border-emerald-500/40 backdrop-blur-xs">
                            SCANNING ACTIVE
                          </span>
                        </div>
                        <div className="absolute bottom-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                          <span className="text-[9px] font-mono text-slate-300 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 backdrop-blur-xs">
                            ALIGN QR PASS WITHIN SQUARE
                          </span>
                        </div>
                      </>
                    )}

                    {/* Inactive State Overlay */}
                    {!isCameraActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-slate-400 gap-2 bg-slate-950/95 z-20">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-1">
                          <Camera className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-semibold text-slate-200">Optical Webcam Scanner</p>
                        <p className="text-[10px] text-slate-400 max-w-[200px]">Point your webcam at a printed or mobile ParkEase QR pass.</p>
                        <Button
                          type="button"
                          onClick={startCamera}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 h-8 mt-1 shadow-md"
                        >
                          <Camera className="h-3.5 w-3.5" /> Start Webcam Scanner
                        </Button>
                      </div>
                    )}

                    {/* Verifying / Decoding Overlay */}
                    {isVerifyingScan && (
                      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-30">
                        <RefreshCw className="h-7 w-7 text-emerald-400 animate-spin" />
                        <span className="text-xs font-bold text-slate-100 font-mono">Verifying Pass with Barrier...</span>
                      </div>
                    )}
                  </div>

                  {isCameraActive && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={stopCamera}
                      className="w-full text-xs h-8 font-semibold shadow-xs"
                    >
                      Stop Camera
                    </Button>
                  )}
                </div>
              )}

              {/* MODE 3: UPLOAD QR IMAGE FILE WITH SQUARE FRAME */}
              {scannerMode === 'UPLOAD' && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="sim-qr-file-input"
                  />
                  {/* Square Reader Frame for Upload */}
                  <label
                    htmlFor="sim-qr-file-input"
                    className="relative mx-auto w-full max-w-[280px] sm:max-w-[300px] aspect-square bg-slate-950 rounded-2xl p-4 flex flex-col items-center justify-center overflow-hidden border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 cursor-pointer transition-colors shadow-2xl group"
                  >
                    {/* Viewfinder Corner Brackets */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute top-3 right-3 w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute bottom-3 left-3 w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-sm shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 pointer-events-none" />

                    <div className="absolute top-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                      <span className="text-[9px] uppercase tracking-widest font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900/90 text-emerald-400 border border-emerald-500/40 backdrop-blur-xs">
                        QR FILE DROPZONE
                      </span>
                    </div>

                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-2 group-hover:scale-105 transition-transform">
                      <FileUp className="h-7 w-7" />
                    </div>
                    <span className="font-semibold text-slate-200 text-xs px-2 text-center line-clamp-1">
                      {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Choose QR Screenshot or Pass'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Click to browse or drop PNG, JPG, WebP</span>

                    <div className="absolute bottom-2.5 inset-x-0 flex justify-center z-20 pointer-events-none">
                      <span className="text-[9px] font-mono text-slate-300 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 backdrop-blur-xs">
                        SQUARE SCAN ZONE
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {/* MODE 4: MANUAL PAYLOAD SCAN */}
              {scannerMode === 'MANUAL' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Custom QR Payload</label>
                    <Input
                      value={customQrPayload}
                      onChange={(e) => setCustomQrPayload(e.target.value)}
                      placeholder="e.g. PE-PASS|BK-123456|SLOT-A1|TOKEN or BK-123456"
                      className="font-mono text-xs bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => executeScanWithPayload(customQrPayload)}
                    disabled={isVerifyingScan || !customQrPayload.trim()}
                    className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
                  >
                    <Scan className="h-3.5 w-3.5" />
                    Submit Manual Code
                  </Button>
                </div>
              )}

              {/* Scan Result Feedback Alert */}
              {scanResult && (
                <div
                  className={`rounded-lg border p-3 text-xs space-y-1 ${scanResult.authorized
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {scanResult.authorized ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>{scanResult.authorized ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{scanResult.message}</p>
                  {scanResult.errorCode && (
                    <Badge variant="outline" className="text-[9px] font-mono border-rose-500/40 text-rose-400">
                      Code: {scanResult.errorCode}
                    </Badge>
                  )}
                </div>
              )}

              {/* Live Auto-Close Countdown in Scan Result */}
              {scanResult && scanResult.authorized && activeTimersList.filter((t) => t.isTimerActive).length > 0 && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-3 space-y-2 text-xs shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                      <span className="font-bold text-amber-300">5-Minute Auto-Close Active:</span>
                    </div>
                    <Badge className="bg-amber-500 text-slate-950 font-mono font-black text-xs px-2 py-0.5 animate-pulse">
                      LIVE COUNTDOWN
                    </Badge>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {activeTimersList
                      .filter((t) => t.isTimerActive)
                      .map((item) => (
                        <div
                          key={`scan-timer-${item.readerId}`}
                          className="flex items-center justify-between bg-black/60 border border-amber-500/30 rounded-lg px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                            <span>{item.readerType === 'ENTRY' ? '🚪' : item.readerType === 'EXIT' ? '🏁' : '🅿️'}</span>
                            <span>{item.displayName}</span>
                            <span className="font-mono text-[9px] text-slate-400">({item.readerId})</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono font-black text-amber-400 text-sm">
                            <span>⏳ {formatCountdown(item.secondsLeft)}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({item.secondsLeft}s)</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Simulated Vehicle Passage & Physical Barrier Control */}
          <Card className="border-slate-800 bg-slate-950/80 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <Radio className="h-4 w-4 text-sky-400" />
                Physical Barrier Passage Sensors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleConfirmPassage('IN')}
                  disabled={confirmPassageMutation.isPending}
                  size="sm"
                  className="text-xs h-8 bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Confirm Passage IN (Entry/Bay)
                </Button>
                <Button
                  onClick={() => handleConfirmPassage('OUT')}
                  disabled={confirmPassageMutation.isPending}
                  size="sm"
                  className="text-xs h-8 bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                >
                  Confirm Passage OUT (Bay/Exit)
                </Button>
              </div>

              {/* Manual Open/Close Commands & Safety Sensor */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendCommandMutation.mutate({ readerId: selectedReaderId, command: 'OPEN' })}
                  className="text-xs h-7 flex-1 border-slate-700 text-slate-200"
                >
                  <Unlock className="h-3 w-3 mr-1" /> Force Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendCommandMutation.mutate({ readerId: selectedReaderId, command: 'CLOSE' })}
                  className="text-xs h-7 flex-1 border-slate-700 text-slate-200"
                >
                  <Lock className="h-3 w-3 mr-1" /> Force Close
                </Button>
                <Button
                  size="sm"
                  variant={currentReader?.isObstructed ? 'destructive' : 'outline'}
                  onClick={() =>
                    toggleObstructionMutation.mutate({
                      readerId: selectedReaderId,
                      isObstructed: !currentReader?.isObstructed,
                    })
                  }
                  className="text-xs h-7 border-slate-700"
                  title="Toggle Safety Sensor Obstruction"
                >
                  <ShieldAlert className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Individual Auto-Closure Timers for Each Barrier */}
          <Card className="border-slate-800 bg-slate-950/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Barrier Auto-Close Timers
                </CardTitle>
                <div className="flex items-center gap-2">
                  {activeTimersList.filter((t) => t.isTimerActive).length > 0 ? (
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] animate-pulse font-mono font-bold">
                      {activeTimersList.filter((t) => t.isTimerActive).length} ACTIVE TIMERS
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-800 font-mono">
                      ALL IDLE
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="text-[11px] text-slate-400">
                Live countdowns for each individual barrier in the facility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {/* Global Speed Mode Selector */}
              <div className="space-y-1.5 pb-2 border-b border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-400" />
                    Timer Speed Multiplier
                  </label>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">
                    {acceleratedSpeed}x ({acceleratedSpeed === 1 ? '5 min' : acceleratedSpeed === 10 ? '30 sec' : '5 sec'})
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={acceleratedSpeed === 1 ? 'default' : 'outline'}
                    onClick={() => acceleratedTimerMutation.mutate(1)}
                    className="text-[11px] h-7 border-slate-700"
                  >
                    1x (5 min)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={acceleratedSpeed === 10 ? 'default' : 'outline'}
                    onClick={() => acceleratedTimerMutation.mutate(10)}
                    className="text-[11px] h-7 border-slate-700"
                  >
                    10x (30 sec)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={acceleratedSpeed === 60 ? 'default' : 'outline'}
                    onClick={() => acceleratedTimerMutation.mutate(60)}
                    className="text-[11px] h-7 border-slate-700 text-amber-300 font-bold"
                  >
                    60x (5 sec)
                  </Button>
                </div>
              </div>

              {/* Individual Barrier Timers List */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {activeTimersList.length > 0 ? (
                  activeTimersList.map((item) => (
                    <div
                      key={item.readerId}
                      className={`rounded-lg border p-2.5 space-y-2 text-[11px] transition-colors ${item.isTimerActive
                        ? 'border-amber-500/40 bg-amber-950/20'
                        : item.barrierState === 'OPEN'
                          ? 'border-sky-500/30 bg-sky-950/20'
                          : 'border-slate-800 bg-slate-900/60'
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <span className="text-xs">
                            {item.readerType === 'ENTRY' ? '🚪' : item.readerType === 'EXIT' ? '🏁' : '🅿️'}
                          </span>
                          <span>{item.displayName}</span>
                          <span className="font-mono text-[9px] text-slate-400">({item.readerId})</span>
                        </div>
                        {item.isTimerActive ? (
                          <div className="flex items-center gap-1.5 bg-black px-2.5 py-1 rounded-md border border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                            <span className="text-lg font-black font-mono tracking-wider text-amber-300">
                              {formatCountdown(item.secondsLeft)}
                            </span>
                          </div>
                        ) : item.barrierState === 'OPEN' ? (
                          <div className="flex items-center gap-1.5 bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-400/50">
                            <Clock className="h-3.5 w-3.5 text-sky-400 animate-spin" />
                            <span className="text-xs font-mono font-bold text-sky-300">
                              Auto-closing...
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-800">
                            CLOSED
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 pt-0.5">
                        <div>
                          Remaining:{' '}
                          <span className={`font-mono font-bold ${item.isTimerActive ? 'text-amber-400' : item.barrierState === 'OPEN' ? 'text-sky-300' : 'text-slate-500'}`}>
                            {item.isTimerActive ? `${item.secondsLeft}s` : item.barrierState === 'OPEN' ? 'Closing...' : 'Idle'}
                          </span>
                        </div>
                        <div>
                          Deadline: <span className="font-mono text-slate-300">{item.deadlineFormatted}</span>
                        </div>
                        <div className="text-right">
                          Sensor:{' '}
                          <span className={item.isObstructed ? 'text-rose-400 font-bold' : 'text-emerald-400 font-semibold'}>
                            {item.isObstructed ? 'OBSTRUCTED' : 'CLEAR'}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {item.isTimerActive && (
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-400 h-1.5 rounded-full transition-all duration-1000"
                            style={{ width: `${item.percentRemaining}%` }}
                          />
                        </div>
                      )}

                      {/* Item Quick Controls */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedReaderId === item.readerId ? 'default' : 'outline'}
                          onClick={() => {
                            setSelectedReaderId(item.readerId);
                            if (item.slotNumber) setSelectedSlotNumber(item.slotNumber);
                          }}
                          className="text-[10px] h-6 px-2 border-slate-700 gap-1"
                        >
                          {selectedReaderId === item.readerId ? 'Selected Reader' : 'Target Reader'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void executeAutoClose(item.readerId, true)}
                          disabled={item.barrierState !== 'OPEN'}
                          className="text-[10px] h-6 px-2 border-rose-500/40 text-rose-300 hover:bg-rose-500/20 font-semibold"
                        >
                          Expire &amp; Auto-Close
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-500 italic rounded-lg border border-slate-800 bg-slate-900/40 text-xs">
                    All facility barriers are currently closed. Scan a pass to open a barrier and activate its 5-minute timer.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ParkingSimulatorPage;
