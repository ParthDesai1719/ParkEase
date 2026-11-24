import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Car,
  Bike,
  Zap,
  Truck,
  Calendar,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  AlertCircle,
  Info,
  ShieldCheck,
  Plus,
  X,
  CreditCard,
  RefreshCw,
  Lock,
  Building2,
  Navigation,
  Hand,
  MousePointer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CanvasViewport } from '@/components/layout-designer/CanvasViewport';
import type { LayoutElementData, LayoutCanvasConfig } from '@/api/parkingLot.api';
import {
  getCustomerBookingContext,
  getCustomerRegisteredVehicles,
  addCustomerRegisteredVehicle,
  initiateCustomerBookingPayment,
  verifyCustomerBookingPayment,
  recordCustomerBookingPaymentFailure,
  type BookingContextResponse,
  type BookingVehicleType,
  type CustomerBookingSlotInfo,
  type CustomerVehicleRecord,
  type VerifyBookingPaymentResponse,
} from '@/api/customerParking.api';
import { BookingConfirmationDialog } from '@/components/customer/booking/BookingConfirmationDialog';
import { cn } from '@/lib/utils';

// Razorpay Checkout Options Type
interface CustomerRazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface CustomerRazorpayInstance {
  open: () => void;
  on?: (event: string, callback: (response: { error?: { description?: string } }) => void) => void;
}

const DEFAULT_CANVAS_CONFIG: LayoutCanvasConfig = {
  width: 1600,
  height: 1000,
  gridSize: 20,
  snapToGrid: true,
  backgroundColor: '#0f172a',
};

const VEHICLE_TYPE_OPTIONS: Array<{
  type: BookingVehicleType;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { type: 'Car', label: 'Car / Sedan', icon: Car },
  { type: 'Bike', label: 'Two-Wheeler', icon: Bike },
  { type: 'SUV', label: 'SUV / MUV', icon: Truck },
  { type: 'EV', label: 'Electric (EV)', icon: Zap },
];

const QUICK_DURATION_HOURS = [1, 2, 3, 4, 6, 8, 12, 24];

/**
 * Formats a Date object into local datetime-local input string (YYYY-MM-DDTHH:mm)
 */
function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'message' in err.response.data &&
    typeof err.response.data.message === 'string'
  ) {
    return err.response.data.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export const CustomerBookingPage: React.FC = () => {
  const { id: parkingLotId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Initial time window: 15 minutes from now (rounded to 15m), 2 hours duration
  const initialStart = useMemo(() => {
    const now = new Date();
    return new Date(Math.ceil((now.getTime() + 15 * 60 * 1000) / (15 * 60 * 1000)) * (15 * 60 * 1000));
  }, []);
  const initialEnd = useMemo(
    () => new Date(initialStart.getTime() + 2 * 60 * 60 * 1000),
    [initialStart],
  );

  // Booking Configuration State
  const [selectedVehicleType, setSelectedVehicleType] = useState<BookingVehicleType>('Car');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [entryTimeStr, setEntryTimeStr] = useState<string>(() =>
    toLocalDateTimeInputValue(initialStart),
  );
  const [exitTimeStr, setExitTimeStr] = useState<string>(() =>
    toLocalDateTimeInputValue(initialEnd),
  );

  // Customer Vehicles State
  const [vehicles, setVehicles] = useState<CustomerVehicleRecord[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState<boolean>(true);
  const [addVehicleDialogOpen, setAddVehicleDialogOpen] = useState<boolean>(false);
  const [newVehicleNumber, setNewVehicleNumber] = useState<string>('');
  const [newVehicleType, setNewVehicleType] = useState<BookingVehicleType>('Car');
  const [newVehicleBrand, setNewVehicleBrand] = useState<string>('');
  const [newVehicleModel, setNewVehicleModel] = useState<string>('');
  const [isAddingVehicle, setIsAddingVehicle] = useState<boolean>(false);

  // Facility & Layout Context State
  const [bookingContext, setBookingContext] = useState<BookingContextResponse | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);
  const [showZoneHighlights, setShowZoneHighlights] = useState<boolean>(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [inspectedElement, setInspectedElement] = useState<LayoutElementData | null>(null);

  // Loading & Error States
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshingLayout, setIsRefreshingLayout] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Viewport Transform State
  const [zoom, setZoom] = useState<number>(0.75);
  const [panX, setPanX] = useState<number>(40);
  const [panY, setPanY] = useState<number>(40);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);

  // Payment & Confirmation State
  const [isInitiatingPayment, setIsInitiatingPayment] = useState<boolean>(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [paymentBannerError, setPaymentBannerError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<VerifyBookingPaymentResponse | null>(
    null,
  );
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState<boolean>(false);

  // Live 1-second ticker for slot availability countdowns
  const [, setLiveTicker] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getAvailabilityCountdown = (targetIso?: string | null): string => {
    if (!targetIso) return 'Checking availability';
    const targetMs = new Date(targetIso).getTime();
    const diffSec = Math.floor((targetMs - Date.now()) / 1000);
    if (diffSec <= 0) return 'Available soon';
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;
    if (hours > 0) {
      return `Available in ${hours}h ${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
    }
    return `Available in ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Load Razorpay Checkout SDK
  useEffect(() => {
    if (!window.Razorpay) {
      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, []);

  // Load Customer Vehicles on Mount
  useEffect(() => {
    let active = true;
    const fetchVehicles = async () => {
      try {
        const list = await getCustomerRegisteredVehicles();
        if (!active) return;
        setVehicles(list);
        if (list.length > 0) {
          const defaultVeh = list.find((v) => v.isDefault) || list[0]!;
          setSelectedVehicleId(defaultVeh._id);
          setSelectedVehicleType(defaultVeh.vehicleType);
        }
      } catch {
        // Keep empty list if none found
      } finally {
        if (active) setIsLoadingVehicles(false);
      }
    };
    void fetchVehicles();
    return () => {
      active = false;
    };
  }, []);

  // Fit 2D Layout to Viewport Container
  const handleFitToScreen = useCallback(
    (customConfig?: LayoutCanvasConfig) => {
      const cfg =
        customConfig || bookingContext?.activeFloor.layout.canvasConfig || DEFAULT_CANVAS_CONFIG;
      const container = viewportContainerRef.current;
      if (!container) {
        setZoom(0.65);
        setPanX(40);
        setPanY(40);
        return;
      }
      const rect = container.getBoundingClientRect();
      const availW = Math.max(320, rect.width - 48);
      const availH = Math.max(320, rect.height - 48);
      const scaleX = availW / cfg.width;
      const scaleY = availH / cfg.height;
      const nextZoom = Math.min(1.15, Math.max(0.32, Math.min(scaleX, scaleY)));
      const centeredX = Math.round((rect.width - cfg.width * nextZoom) / 2);
      const centeredY = Math.round((rect.height - cfg.height * nextZoom) / 2);
      setZoom(Number(nextZoom.toFixed(2)));
      setPanX(Math.max(16, centeredX));
      setPanY(Math.max(16, centeredY));
    },
    [bookingContext],
  );

  // Fetch Booking Context (Layout + Slot Eligibility + Price Breakdown)
  const fetchContext = useCallback(
    async (opts?: {
      isInitial?: boolean;
      targetFloorId?: string;
      clearSelectedSlot?: boolean;
      suppressSlotWarning?: boolean;
    }) => {
      if (!parkingLotId) return;

      const entryDate = new Date(entryTimeStr);
      const exitDate = new Date(exitTimeStr);

      if (isNaN(entryDate.getTime()) || isNaN(exitDate.getTime())) {
        setConfigError('Please enter a valid check-in and check-out date and time.');
        return;
      }
      if (exitDate.getTime() <= entryDate.getTime()) {
        setConfigError('Check-out time must be after check-in time.');
        return;
      }

      setConfigError(null);
      if (opts?.isInitial) {
        setIsInitialLoading(true);
        setPageError(null);
      } else {
        setIsRefreshingLayout(true);
      }

      try {
        const data = await getCustomerBookingContext({
          parkingLotId,
          floorId: opts?.targetFloorId ?? (selectedFloorId || undefined),
          vehicleType: selectedVehicleType,
          scheduledEntryTime: entryDate.toISOString(),
          scheduledExitTime: exitDate.toISOString(),
        });

        setBookingContext(data);
        setSelectedFloorId(data.activeFloor.floor._id);

        if (
          opts?.isInitial &&
          data.facility.vehicleCapacityByType &&
          !data.facility.vehicleCapacityByType[selectedVehicleType]?.isOffered
        ) {
          const firstOffered = (['Car', 'SUV', 'Bike', 'EV'] as const).find(
            (vt) => data.facility.vehicleCapacityByType?.[vt]?.isOffered,
          );
          if (firstOffered && firstOffered !== selectedVehicleType) {
            setSelectedVehicleType(firstOffered);
          }
        }

        // Verify if currently selected slot is still eligible (suppressed on successful booking confirmation)
        if (opts?.clearSelectedSlot) {
          setSelectedSlotId(null);
        } else if (selectedSlotId && !opts?.suppressSlotWarning) {
          const updatedSlot = data.activeFloor.slots.find((s) => s._id === selectedSlotId);
          if (!updatedSlot || !updatedSlot.isEligible) {
            setSelectedSlotId(null);
            if (updatedSlot && !updatedSlot.isEligible) {
              toast.warning(
                `Slot ${updatedSlot.slotNumber} is not available for the updated configuration: ${updatedSlot.ineligibilityReason || 'Unavailable'}`,
              );
            }
          }
        }

        if (opts?.isInitial || opts?.targetFloorId) {
          setTimeout(() => {
            handleFitToScreen(data.activeFloor.layout.canvasConfig);
          }, 60);
        }
      } catch (err: unknown) {
        const msg = extractApiErrorMessage(
          err,
          'Unable to load booking layout and availability for this facility.',
        );
        if (opts?.isInitial) {
          setPageError(msg);
        } else {
          setConfigError(msg);
        }
      } finally {
        setIsInitialLoading(false);
        setIsRefreshingLayout(false);
      }
    },
    [
      parkingLotId,
      entryTimeStr,
      exitTimeStr,
      selectedFloorId,
      selectedVehicleType,
      selectedSlotId,
      handleFitToScreen,
    ],
  );

  // Trigger initial context load and refresh when parameters change
  useEffect(() => {
    let cancelled = false;
    const runFetch = async () => {
      if (cancelled) return;
      await fetchContext({ isInitial: bookingContext === null });
    };
    void runFetch();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkingLotId, selectedVehicleType, entryTimeStr, exitTimeStr]);

  // Vehicles filtered by selected vehicle type
  const compatibleCustomerVehicles = useMemo(
    () => vehicles.filter((v) => v.vehicleType === selectedVehicleType),
    [vehicles, selectedVehicleType],
  );

  // Derive active vehicle ID for the selected vehicle type without synchronous setState in useEffect
  const effectiveSelectedVehicleId = useMemo(() => {
    if (compatibleCustomerVehicles.length === 0) return '';
    if (compatibleCustomerVehicles.some((v) => v._id === selectedVehicleId)) {
      return selectedVehicleId;
    }
    // Prefer free vehicle without an active booking
    const freeDefault = compatibleCustomerVehicles.find((v) => v.isDefault && !v.hasActiveBooking);
    if (freeDefault) return freeDefault._id;
    const freeFirst = compatibleCustomerVehicles.find((v) => !v.hasActiveBooking);
    if (freeFirst) return freeFirst._id;

    const def =
      compatibleCustomerVehicles.find((v) => v.isDefault) || compatibleCustomerVehicles[0]!;
    return def._id;
  }, [compatibleCustomerVehicles, selectedVehicleId]);

  // Currently selected vehicle record
  const selectedVehicleRecord = useMemo(() => {
    return compatibleCustomerVehicles.find((v) => v._id === effectiveSelectedVehicleId) || null;
  }, [compatibleCustomerVehicles, effectiveSelectedVehicleId]);

  // Currently selected slot object
  const selectedSlotInfo: CustomerBookingSlotInfo | null = useMemo(() => {
    if (!bookingContext || !selectedSlotId) return null;
    return bookingContext.activeFloor.slots.find((s) => s._id === selectedSlotId) || null;
  }, [bookingContext, selectedSlotId]);

  // Selected layout element ID for CanvasViewport highlight
  const selectedElementId: string | null = useMemo(() => {
    if (!bookingContext || !selectedSlotInfo) return null;
    const match = bookingContext.activeFloor.layout.elements.find(
      (el) =>
        el.elementType === 'ParkingSlot' &&
        (el.slotId === selectedSlotInfo._id || el.slotNumber === selectedSlotInfo.slotNumber),
    );
    return match ? match.elementId : null;
  }, [bookingContext, selectedSlotInfo]);

  // Handle clicking an element on the 2D layout canvas
  const handleSelectCanvasElement = useCallback(
    (el: LayoutElementData | null) => {
      if (!el || !bookingContext) {
        setInspectedElement(null);
        return;
      }

      setInspectedElement(el);

      if (el.elementType !== 'ParkingSlot') {
        return;
      }

      const slotInfo = bookingContext.activeFloor.slots.find(
        (s) => s._id === el.slotId || s.slotNumber === el.slotNumber,
      );

      if (!slotInfo) {
        toast.error('This bay is not linked to an active slot record.');
        return;
      }

      if (slotInfo.isOverflow) {
        toast.error(
          `Slot ${slotInfo.slotNumber} is designated as an Overflow bay and is frozen for customer bookings. Overflow bays cannot be booked online and are strictly reserved for automatic system overstay reassignments and security staff.`,
        );
        return;
      }

      if (!slotInfo.isEligible) {
        toast.warning(
          slotInfo.ineligibilityReason ||
            `Slot ${slotInfo.slotNumber} cannot be selected (${slotInfo.effectiveStatus}).`,
        );
        return;
      }

      if (selectedSlotId === slotInfo._id) {
        setSelectedSlotId(null);
      } else {
        setSelectedSlotId(slotInfo._id);
        toast.success(
          `Selected Slot ${slotInfo.slotNumber} (${slotInfo.floorName} • Zone ${slotInfo.zoneCode})`,
        );
      }
    },
    [bookingContext, selectedSlotId],
  );

  // Handle quick duration preset click
  const handleApplyQuickDuration = (hours: number) => {
    const start = new Date(entryTimeStr);
    if (isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    setExitTimeStr(toLocalDateTimeInputValue(end));
  };

  // Handle Floor Change
  const handleFloorChange = (floorId: string) => {
    if (floorId === selectedFloorId) return;
    setSelectedZoneFilter(null);
    setSelectedSlotId(null);
    setInspectedElement(null);
    setSelectedFloorId(floorId);
    void fetchContext({ targetFloorId: floorId });
  };

  // Handle Quick Add Vehicle
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedNum = newVehicleNumber.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(cleanedNum)) {
      toast.error('Enter a valid Indian registration number (e.g. GJ05AB1234).');
      return;
    }
    if (!newVehicleBrand.trim() || !newVehicleModel.trim()) {
      toast.error('Please enter your vehicle brand and model.');
      return;
    }

    setIsAddingVehicle(true);
    try {
      const created = await addCustomerRegisteredVehicle({
        vehicleNumber: cleanedNum,
        vehicleType: newVehicleType,
        vehicleBrand: newVehicleBrand.trim(),
        vehicleModel: newVehicleModel.trim(),
      });
      setVehicles((prev) => [created, ...prev.filter((v) => v._id !== created._id)]);
      setSelectedVehicleType(created.vehicleType);
      setSelectedVehicleId(created._id);
      setAddVehicleDialogOpen(false);
      setNewVehicleNumber('');
      setNewVehicleBrand('');
      setNewVehicleModel('');
      toast.success(`Vehicle ${created.vehicleNumber} registered and selected.`);
    } catch (err: unknown) {
      toast.error(extractApiErrorMessage(err, 'Failed to register vehicle.'));
    } finally {
      setIsAddingVehicle(false);
    }
  };

  // Initiate Payment & Launch Razorpay Checkout
  const handleProceedToPayment = async () => {
    if (!parkingLotId || !bookingContext) return;
    if (!selectedSlotInfo) {
      toast.error('Please select an available green parking slot on the 2D layout first.');
      return;
    }
    if (!effectiveSelectedVehicleId) {
      toast.error('Please select or register a compatible vehicle before booking.');
      setNewVehicleType(selectedVehicleType);
      setAddVehicleDialogOpen(true);
      return;
    }
    if (selectedVehicleRecord?.hasActiveBooking) {
      toast.error(
        `${selectedVehicleRecord.vehicleNumber} has an active booking (${selectedVehicleRecord.activeBookingReference || 'Active'}). Only one active booking is permitted per vehicle. Please complete or exit the existing booking before booking another slot.`,
      );
      return;
    }

    setPaymentBannerError(null);
    setIsInitiatingPayment(true);

    try {
      const entryIso = new Date(entryTimeStr).toISOString();
      const exitIso = new Date(exitTimeStr).toISOString();

      const orderData = await initiateCustomerBookingPayment({
        parkingLotId,
        slotId: selectedSlotInfo._id,
        vehicleId: effectiveSelectedVehicleId,
        scheduledEntryTime: entryIso,
        scheduledExitTime: exitIso,
      });

      if (typeof window.Razorpay !== 'function') {
        throw new Error(
          'Razorpay Checkout SDK could not be loaded. Please check your internet connection.',
        );
      }

      const options: CustomerRazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency,
        name: 'ParkEase Smart Parking',
        description: `${orderData.summary.facilityName} — Slot ${orderData.summary.slotNumber}`,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.customer.name,
          email: orderData.customer.email,
          contact: orderData.customer.contact,
        },
        theme: {
          color: '#f97316',
        },
        handler: async (response) => {
          setIsVerifyingPayment(true);
          setPaymentBannerError(null);
          try {
            const verification = await verifyCustomerBookingPayment({
              parkingLotId,
              bookingId: orderData.bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verification.bookingStatus === 'Confirmed') {
              setSelectedSlotId(null);
              setConfirmedBooking(verification);
              setConfirmationDialogOpen(true);
              toast.success(`Booking ${verification.bookingReference} confirmed!`);
              void fetchContext({ clearSelectedSlot: true, suppressSlotWarning: true });
            } else {
              // Concurrent slot conflict resulted in automatic refund
              setSelectedSlotId(null);
              setPaymentBannerError(verification.message);
              toast.error(verification.message, { duration: 7000 });
              void fetchContext({ clearSelectedSlot: true, suppressSlotWarning: true });
            }
          } catch (vErr: unknown) {
            const errMsg = extractApiErrorMessage(
              vErr,
              'Payment verification failed. Please contact support if amount was debited.',
            );
            setPaymentBannerError(errMsg);
            toast.error(errMsg);
          } finally {
            setIsVerifyingPayment(false);
            setIsInitiatingPayment(false);
          }
        },
        modal: {
          ondismiss: async () => {
            setIsInitiatingPayment(false);
            try {
              await recordCustomerBookingPaymentFailure({
                parkingLotId,
                bookingId: orderData.bookingId,
                reason: 'Customer closed the payment checkout window before completing payment.',
              });
            } catch {
              // Non-blocking cleanup
            }
            toast.info('Payment was cancelled. Your slot has not been charged.');
          },
        },
      };

      const RazorpayCtor = window.Razorpay as unknown as new (
        opts: CustomerRazorpayOptions,
      ) => CustomerRazorpayInstance;
      const rzp = new RazorpayCtor(options);
      if (rzp.on) {
        rzp.on('payment.failed', async (failResp: { error?: { description?: string } }) => {
          const reason =
            failResp?.error?.description || 'Payment transaction was declined by the gateway.';
          setPaymentBannerError(reason);
          setIsInitiatingPayment(false);
          try {
            await recordCustomerBookingPaymentFailure({
              parkingLotId,
              bookingId: orderData.bookingId,
              reason,
            });
          } catch {
            // Ignore
          }
        });
      }
      rzp.open();
    } catch (err: unknown) {
      const msg = extractApiErrorMessage(err, 'Could not initiate booking payment.');
      setPaymentBannerError(msg);
      toast.error(msg);
      setIsInitiatingPayment(false);
      // Refresh layout in case slot status changed
      void fetchContext();
    }
  };

  // Current active step for progress indicator
  const currentStep = confirmedBooking ? 3 : selectedSlotInfo ? 2 : 1;

  // Format duration helper
  const formattedDuration = useMemo(() => {
    const mins = bookingContext?.priceBreakdown.bookingDurationMinutes || 0;
    if (mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h > 0 ? `${h} hr${h > 1 ? 's' : ''}` : ''}${m > 0 ? ` ${m} min` : ''}`.trim();
  }, [bookingContext]);

  // 1. INITIAL LOADING SKELETON STATE
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <div className="border-b border-border/80 bg-card/60">
          <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8 space-y-3">
            <Skeleton className="h-4 w-56" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-4 w-96" />
              </div>
              <Skeleton className="h-10 w-64 rounded-full" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <Skeleton className="h-[600px] w-full rounded-xl" />
            </div>
            <div className="lg:col-span-4">
              <Skeleton className="h-[520px] w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. FACILITY OR PUBLISHED LAYOUT ERROR STATE
  if (pageError || !bookingContext) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full border-border/80 shadow-sm">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-foreground">Booking Unavailable</h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {pageError ||
                  'This parking facility is not currently eligible for online slot reservations.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/customer/parking/${parkingLotId || ''}`}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Facility Details
                </Link>
              </Button>
              <Button size="sm" onClick={() => void fetchContext({ isInitial: true })}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { facility, floors, activeFloor, priceBreakdown } = bookingContext;
  const { slotSummary } = activeFloor;

  return (
    <div className="min-h-screen bg-muted/20 pb-24 lg:pb-12">
      {/* =================================================================== */}
      {/* TOP HEADER BAR: Breadcrumbs, Facility Info & Step Progress          */}
      {/* =================================================================== */}
      <div className="border-b border-border/80 bg-background sticky top-0 z-20">
        <div className="mx-auto max-w-[1440px] px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2"
          >
            <Link to="/customer/search" className="hover:text-primary transition-colors">
              Find Parking
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <Link
              to={`/customer/parking/${facility._id}`}
              className="hover:text-primary transition-colors truncate max-w-[200px]"
            >
              {facility.parkingName}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-semibold text-foreground">Select Slot & Book</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-lg border-border/80 mt-0.5"
                asChild
              >
                <Link
                  to={`/customer/parking/${facility._id}`}
                  title="Back to Parking Details"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>

              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    {facility.parkingName}
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold"
                  >
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Verified 2D Layout
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    {facility.address}, {facility.city}, {facility.state} — {facility.postalCode}
                  </span>
                  <span className="text-border mx-1">|</span>
                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    {facility.isOpen24Hours
                      ? 'Open 24×7'
                      : `${facility.openingTime} – ${facility.closingTime}`}
                  </span>
                </p>
              </div>
            </div>

            {/* Step Progress Indicator */}
            <div className="flex items-center gap-2 sm:gap-3 bg-muted/50 border border-border/70 rounded-xl px-3.5 py-2 self-start md:self-auto">
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold',
                    currentStep >= 1
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  1
                </span>
                <span className="font-semibold text-foreground">Configure</span>
              </div>

              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />

              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold',
                    currentStep >= 2
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted-foreground/20 text-muted-foreground',
                  )}
                >
                  2
                </span>
                <span
                  className={cn(
                    'font-medium',
                    currentStep >= 2 ? 'text-foreground font-semibold' : 'text-muted-foreground',
                  )}
                >
                  Select Bay
                </span>
              </div>

              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />

              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold',
                    currentStep >= 3
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted-foreground/20 text-muted-foreground',
                  )}
                >
                  3
                </span>
                <span
                  className={cn(
                    'font-medium',
                    currentStep >= 3 ? 'text-emerald-600 font-semibold' : 'text-muted-foreground',
                  )}
                >
                  Pay & Confirm
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MAIN CONTENT CONTAINER                                              */}
      {/* =================================================================== */}
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* 1. BOOKING CONFIGURATION BAR */}
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                1. Configure Reservation Details
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-muted-foreground font-medium">Quick Duration:</span>
              {QUICK_DURATION_HOURS.map((hrs) => {
                const isCurr =
                  Math.round(priceBreakdown.bookingDurationMinutes / 60) === hrs &&
                  priceBreakdown.bookingDurationMinutes % 60 === 0;
                return (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => handleApplyQuickDuration(hrs)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors',
                      isCurr
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border/80 hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    {hrs}h
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE VEHICLE BOOKING ALERT AREA */}
          {selectedVehicleRecord?.hasActiveBooking && (
            <div
              className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200 shadow-xs animate-in fade-in-50"
              data-testid="vehicle-active-booking-alert"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-amber-900 dark:text-amber-300">
                    <span className="font-mono">{selectedVehicleRecord.vehicleNumber}</span> has an active booking ({selectedVehicleRecord.activeBookingReference || 'Active'}).
                  </p>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    Only one active booking is permitted per vehicle. Please complete or exit the existing booking before booking another slot.
                  </p>
                </div>
              </div>

              {selectedVehicleRecord.activeBookingId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold shrink-0 border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200 hover:bg-amber-500/30"
                  onClick={() => navigate(`/customer/booking/${selectedVehicleRecord.activeBookingId}`)}
                >
                  View Existing Booking &rarr;
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Vehicle Type Selector (4 cols) */}
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Vehicle Type</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {VEHICLE_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isEv = opt.type === 'EV';
                  const typeCap = facility.vehicleCapacityByType?.[opt.type];
                  const isOffered = isEv
                    ? Boolean(typeCap && typeCap.isOffered && typeCap.operationalSlots > 0)
                    : typeCap
                    ? typeCap.isOffered && typeCap.operationalSlots > 0
                    : true;
                  const active = isOffered && selectedVehicleType === opt.type;
                  const effectiveEvRate =
                    facility.pricing.evChargingRatePerHour > 0
                      ? facility.pricing.evChargingRatePerHour
                      : facility.pricing.carHourlyRate;
                  const rate =
                    opt.type === 'Bike'
                      ? facility.pricing.bikeHourlyRate
                      : opt.type === 'SUV'
                      ? facility.pricing.suvHourlyRate
                      : opt.type === 'EV'
                      ? effectiveEvRate
                      : facility.pricing.carHourlyRate;

                  return (
                    <button
                      key={opt.type}
                      type="button"
                      disabled={!isOffered}
                      title={
                        isOffered
                          ? `${opt.label} — ₹${rate}/hr (${typeCap?.operationalSlots ?? typeCap?.totalSlots ?? 0} bays)`
                          : `${opt.label} bays are not available at this facility`
                      }
                      onClick={() => {
                        if (!isOffered) return;
                        setSelectedVehicleType(opt.type);
                        setSelectedSlotId(null);
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center py-2 px-1.5 rounded-lg border text-center transition-all',
                        !isOffered
                          ? 'border-dashed border-border/50 bg-muted/20 text-muted-foreground/45 cursor-not-allowed opacity-50 select-none pointer-events-none'
                          : active
                          ? 'border-primary bg-primary/10 text-primary shadow-2xs cursor-pointer'
                          : 'border-border/80 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer',
                      )}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <span className="text-[11px] font-bold leading-tight">{opt.type}</span>
                      {isOffered ? (
                        <span className="text-[10px] opacity-80 font-mono">₹{rate}/h</span>
                      ) : (
                        <span className="text-[9px] font-bold leading-tight text-rose-500/90 dark:text-rose-400 mt-0.5">
                          Not Available
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Registered Vehicle Selector (3 cols) */}
            <div className="md:col-span-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="vehicle-select" className="text-xs font-semibold text-muted-foreground">
                  Your {selectedVehicleType} Vehicle
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setNewVehicleType(selectedVehicleType);
                    setAddVehicleDialogOpen(true);
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />
                  Add Vehicle
                </button>
              </div>

              {isLoadingVehicles ? (
                <Skeleton className="h-10 w-full rounded-lg" />
              ) : compatibleCustomerVehicles.length > 0 ? (
                <>
                  <select
                    id="vehicle-select"
                    value={effectiveSelectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className={`w-full h-10 rounded-lg border bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 ${
                      selectedVehicleRecord?.hasActiveBooking
                        ? 'border-amber-500/60 text-amber-500 focus:ring-amber-500/30'
                        : 'border-input text-foreground focus:ring-primary/30'
                    }`}
                  >
                    {compatibleCustomerVehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.vehicleNumber} — {v.vehicleBrand} {v.vehicleModel}
                        {v.hasActiveBooking ? ` (⚠️ Active Booking: ${v.activeBookingReference || v.activeBookingStatus})` : ''}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 text-xs justify-start gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                  onClick={() => {
                    setNewVehicleType(selectedVehicleType);
                    setAddVehicleDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Register {selectedVehicleType} Number
                </Button>
              )}
            </div>

            {/* Check-In Date/Time (2.5 cols) */}
            <div className="md:col-span-2 lg:col-span-2 space-y-1.5">
              <Label htmlFor="entry-datetime" className="text-xs font-semibold text-muted-foreground">
                Check-In Time
              </Label>
              <Input
                id="entry-datetime"
                type="datetime-local"
                value={entryTimeStr}
                onChange={(e) => setEntryTimeStr(e.target.value)}
                className="h-10 text-xs font-medium"
              />
            </div>

            {/* Check-Out Date/Time (2.5 cols) */}
            <div className="md:col-span-3 lg:col-span-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="exit-datetime" className="text-xs font-semibold text-muted-foreground">
                  Check-Out Time
                </Label>
                <span className="text-[11px] font-semibold text-primary">
                  Duration: {formattedDuration}
                </span>
              </div>
              <Input
                id="exit-datetime"
                type="datetime-local"
                value={exitTimeStr}
                onChange={(e) => setExitTimeStr(e.target.value)}
                className="h-10 text-xs font-medium"
              />
            </div>
          </div>

          {/* Configuration Validation Alert */}
          {configError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{configError}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-destructive/30 hover:bg-destructive/20"
                onClick={() => {
                  setEntryTimeStr(toLocalDateTimeInputValue(initialStart));
                  setExitTimeStr(toLocalDateTimeInputValue(initialEnd));
                }}
              >
                Reset Window
              </Button>
            </div>
          )}
        </div>

        {/* 2. MAIN WORKSPACE: 2D LAYOUT VIEWER (8 COLS) + STICKY SUMMARY PANEL (4 COLS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* =============================================================== */}
          {/* LEFT / MAIN REGION: INTERACTIVE 2D PARKING LAYOUT VIEWER        */}
          {/* =============================================================== */}
          <div className="lg:col-span-8 space-y-3">
            <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden flex flex-col">
              {/* Floor Tabs & Viewport Controls Header */}
              <div className="p-3.5 sm:px-5 border-b border-border/80 bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Floor Selector Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-2 shrink-0">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>Floor:</span>
                  </div>
                  {floors.map((fl) => {
                    const isActive = fl._id === activeFloor.floor._id;
                    return (
                      <button
                        key={fl._id}
                        type="button"
                        onClick={() => handleFloorChange(fl._id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 border',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                            : 'bg-muted/50 text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted',
                        )}
                      >
                        <span>{fl.floorName}</span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-background text-muted-foreground',
                          )}
                        >
                          {fl.totalSlots}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Zone Filter & Canvas Controls */}
                <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                  {activeFloor.zones.length > 0 && (
                    <select
                      aria-label="Filter by Zone"
                      value={selectedZoneFilter || 'ALL'}
                      onChange={(e) =>
                        setSelectedZoneFilter(e.target.value === 'ALL' ? null : e.target.value)
                      }
                      className="h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground"
                    >
                      <option value="ALL">All Zones ({activeFloor.zones.length})</option>
                      {activeFloor.zones.map((z) => (
                        <option key={z._id} value={z.zoneCode}>
                          Zone {z.zoneCode} — {z.zoneName}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Select vs Pan Mode Toggle */}
                  <div className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveTool('select')}
                      className={cn(
                        'px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors',
                        activeTool === 'select'
                          ? 'bg-background text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      title="Select Slot Mode"
                    >
                      <MousePointer className="h-3 w-3" />
                      Select
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('pan')}
                      className={cn(
                        'px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors',
                        activeTool === 'pan'
                          ? 'bg-background text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      title="Pan Canvas Mode"
                    >
                      <Hand className="h-3 w-3" />
                      Pan
                    </button>
                  </div>

                  {/* Zoom & Fit Controls */}
                  <div className="inline-flex items-center rounded-lg border border-border/80 bg-background">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.12).toFixed(2))))}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-2 text-[11px] font-mono font-semibold text-foreground border-x border-border/60">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.12).toFixed(2))))}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFitToScreen()}
                      className="p-1.5 text-muted-foreground hover:text-foreground border-l border-border/60"
                      title="Fit Layout to Screen"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void fetchContext()}
                    disabled={isRefreshingLayout}
                    title="Refresh Slot Availability"
                  >
                    <RotateCcw
                      className={cn('h-3.5 w-3.5', isRefreshingLayout && 'animate-spin')}
                    />
                  </Button>
                </div>
              </div>

              {/* Status Legend & Live Floor Counter Bar */}
              <div className="px-4 py-2.5 bg-slate-900 text-slate-200 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center flex-wrap gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-emerald-500/30 border border-emerald-400 inline-block" />
                    <span className="text-[11px] font-medium">
                      Available ({slotSummary.compatibleAvailableCount} for {selectedVehicleType})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-blue-500/50 border border-blue-400 inline-block" />
                    <span className="text-[11px] font-medium">Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-amber-500/30 border border-amber-400 inline-block" />
                    <span className="text-[11px] font-medium">
                      Reserved ({slotSummary.reservedCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-red-500/30 border border-red-400 inline-block" />
                    <span className="text-[11px] font-medium">
                      Occupied ({slotSummary.occupiedCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-slate-600/40 border border-slate-500 inline-block" />
                    <span className="text-[11px] font-medium">
                      Maintenance / Other Vehicle
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-slate-500/25 border border-slate-400 border-dashed inline-block" />
                    <span className="text-[11px] font-medium text-slate-400">
                      Overflow (Frozen)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowZoneHighlights((prev) => !prev)}
                  className="text-[11px] font-semibold text-slate-300 hover:text-white underline-offset-2 hover:underline"
                >
                  {showZoneHighlights ? 'Hide Zone Boundaries' : 'Show Zone Boundaries'}
                </button>
              </div>

              {/* No Compatible Slots Banner on Current Floor */}
              {slotSummary.compatibleAvailableCount === 0 && (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      No available {selectedVehicleType} bays on {activeFloor.floor.floorName} for
                      the selected time window. Try switching floors or adjusting your arrival time.
                    </span>
                  </div>
                </div>
              )}

              {/* 2D Interactive Canvas Viewport */}
              <div
                ref={viewportContainerRef}
                className="relative h-[520px] sm:h-[600px] w-full bg-slate-950 overflow-hidden"
              >
                <CanvasViewport
                  canvasConfig={activeFloor.layout.canvasConfig}
                  elements={activeFloor.layout.elements}
                  selectedElementId={selectedElementId}
                  mode="booking"
                  activeTool={activeTool}
                  showGrid={true}
                  showRulers={false}
                  snapToGrid={false}
                  zoom={zoom}
                  panX={panX}
                  panY={panY}
                  onPanChange={(nx, ny) => {
                    setPanX(nx);
                    setPanY(ny);
                  }}
                  onZoomChange={(nz) => setZoom(nz)}
                  onSelectElement={handleSelectCanvasElement}
                  onUpdateElementPosition={() => {}}
                  onRotateElement={() => {}}
                  onRemoveElement={() => {}}
                  onDropNewElement={() => {}}
                  onFitToScreen={() => handleFitToScreen()}
                  onResetView={() => handleFitToScreen()}
                  zones={activeFloor.zones}
                  showZoneHighlights={showZoneHighlights}
                  selectedZoneFilter={selectedZoneFilter}
                  canResizeCanvas={false}
                  enableSlotAssister={false}
                />

                {/* Floating Selected / Inspected Slot Pill at Bottom of Canvas */}
                {selectedSlotInfo ? (
                  <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md bg-slate-900/95 backdrop-blur-md border border-blue-500/50 text-white rounded-xl p-3 shadow-lg flex items-center justify-between gap-4 z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-600/30 border border-blue-400 flex items-center justify-center font-mono font-bold text-sm text-blue-200 shrink-0">
                        {selectedSlotInfo.slotNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            Bay {selectedSlotInfo.slotNumber} Selected
                          </span>
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-[10px] py-0">
                            {selectedSlotInfo.slotType}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {selectedSlotInfo.floorName} • Zone {selectedSlotInfo.zoneCode} (
                          {selectedSlotInfo.supportedVehicleType})
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSlotId(null)}
                      className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Change
                    </Button>
                  </div>
                ) : inspectedElement && inspectedElement.elementType === 'ParkingSlot' ? (
                  <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-xl p-3 shadow-lg flex items-center justify-between gap-3 z-10">
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-200">
                          Slot {inspectedElement.slotNumber} — {inspectedElement.effectiveStatus}
                        </p>
                        {inspectedElement.expectedAvailableAt &&
                          (inspectedElement.effectiveStatus === 'Occupied' ||
                            inspectedElement.effectiveStatus === 'Reserved') && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono font-bold">
                              ⏳ {getAvailabilityCountdown(inspectedElement.expectedAvailableAt)}
                            </Badge>
                          )}
                      </div>
                      {inspectedElement.expectedAvailableAt &&
                        (inspectedElement.effectiveStatus === 'Occupied' ||
                          inspectedElement.effectiveStatus === 'Reserved') && (
                          <p className="text-[10px] text-amber-400 font-medium">
                            Expected available:{' '}
                            {new Date(inspectedElement.expectedAvailableAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            (includes 15-min grace period)
                          </p>
                        )}
                      <p className="text-[11px] text-slate-400">
                        {inspectedElement.ineligibilityReason ||
                          'Click an available green slot to reserve.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedElement(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-xs border border-slate-800 text-slate-300 rounded-lg px-3 py-1.5 text-[11px] flex items-center gap-2 pointer-events-none">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      Click any green <strong>AVAILABLE</strong> slot to select. Scroll to zoom or
                      drag to pan.
                    </span>
                  </div>
                )}
              </div>

              {/* Accessible Quick-Select Eligible Slot Pills Bar */}
              <div className="p-3.5 sm:px-5 bg-background border-t border-border/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Compatible Available {selectedVehicleType} Bays on {activeFloor.floor.floorName} (
                    {slotSummary.compatibleAvailableCount}):
                  </span>
                  {selectedSlotInfo && (
                    <button
                      type="button"
                      onClick={() => setSelectedSlotId(null)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                {slotSummary.compatibleAvailableCount > 0 ? (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {activeFloor.slots
                      .filter(
                        (s) =>
                          s.isEligible &&
                          (!selectedZoneFilter || s.zoneCode === selectedZoneFilter),
                      )
                      .map((slot) => {
                        const isSelected = selectedSlotId === slot._id;
                        return (
                          <button
                            key={slot._id}
                            type="button"
                            onClick={() =>
                              setSelectedSlotId(isSelected ? null : slot._id)
                            }
                            className={cn(
                              'px-2.5 py-1 rounded-md text-xs font-mono font-bold border transition-all shrink-0 flex items-center gap-1',
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
                            )}
                          >
                            <span>{slot.slotNumber}</span>
                            <span className="text-[10px] opacity-75 font-sans">
                              (Z-{slot.zoneCode})
                            </span>
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No compatible {selectedVehicleType} slots are free on this floor for the
                    selected window.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* RIGHT REGION: STICKY BOOKING SUMMARY & PAYMENT CHECKOUT         */}
          {/* =============================================================== */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            <Card className="border-border/80 bg-card shadow-sm overflow-hidden">
              <div className="bg-muted/40 px-5 py-4 border-b border-border/80 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">Booking Summary</h2>
                  <p className="text-xs text-muted-foreground">
                    Review your slot and fare breakdown
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                  {formattedDuration}
                </Badge>
              </div>

              <CardContent className="p-5 space-y-5">
                {/* Facility & Location */}
                <div className="space-y-1 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{facility.parkingName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    {facility.address}, {facility.city}
                  </p>
                </div>

                {/* Selected Slot Callout */}
                <div
                  className={cn(
                    'rounded-xl p-3.5 border transition-colors',
                    selectedSlotInfo
                      ? 'bg-blue-500/5 border-blue-500/30'
                      : 'bg-muted/40 border-dashed border-border',
                  )}
                >
                  {selectedSlotInfo ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Selected Parking Bay
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-extrabold font-mono text-foreground">
                            {selectedSlotInfo.slotNumber}
                          </span>
                          <Badge variant="secondary" className="text-[11px]">
                            {selectedSlotInfo.floorName} • Zone {selectedSlotInfo.zoneCode}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedSlotInfo.slotType} Bay • Supports{' '}
                          {selectedSlotInfo.supportedVehicleType}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setSelectedSlotId(null)}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground py-1">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Navigation className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">No Parking Slot Selected</p>
                        <p className="text-[11px]">
                          Tap any green bay on the 2D floor plan to assign your spot.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Schedule & Vehicle Summary Details */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Vehicle Type</span>
                    <span className="font-semibold text-foreground">{selectedVehicleType}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Registered Vehicle</span>
                    <span className="font-semibold font-mono text-foreground">
                      {compatibleCustomerVehicles.find(
                        (v) => v._id === effectiveSelectedVehicleId,
                      )?.vehicleNumber || (
                        <button
                          type="button"
                          onClick={() => {
                            setNewVehicleType(selectedVehicleType);
                            setAddVehicleDialogOpen(true);
                          }}
                          className="text-primary font-sans underline"
                        >
                          + Add {selectedVehicleType}
                        </button>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Check-In</span>
                    <span className="font-medium text-foreground">
                      {new Date(priceBreakdown.scheduledEntryTime).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Check-Out</span>
                    <span className="font-medium text-foreground">
                      {new Date(priceBreakdown.scheduledExitTime).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Entry Grace Period</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {priceBreakdown.gracePeriodMinutes} mins included
                    </span>
                  </div>
                </div>

                {/* Price Calculation Breakdown */}
                <div className="pt-3 border-t border-border/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>{priceBreakdown.appliedPricingTier}</span>
                    <span className="font-mono">₹{priceBreakdown.hourlyRate}/hr</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>
                      Billable Duration ({priceBreakdown.billableHours} hr
                      {priceBreakdown.billableHours > 1 ? 's' : ''})
                    </span>
                    <span className="font-mono">₹{priceBreakdown.baseAmount}</span>
                  </div>

                  {Boolean(priceBreakdown.platformBookingFee && priceBreakdown.platformBookingFee > 0) && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Platform Booking Fee</span>
                      <span className="font-mono text-primary font-bold">₹{priceBreakdown.platformBookingFee}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Final Payable Amount</span>
                    <span className="text-xl font-extrabold text-primary font-mono">
                      ₹{priceBreakdown.totalAmount}
                    </span>
                  </div>
                </div>

                {/* Payment Error Banner */}
                {paymentBannerError && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{paymentBannerError}</span>
                  </div>
                )}

                {/* Primary Checkout CTA Button */}
                <Button
                  type="button"
                  size="lg"
                  className="w-full font-bold gap-2 shadow-sm"
                  disabled={
                    !selectedSlotInfo ||
                    Boolean(configError) ||
                    isInitiatingPayment ||
                    isVerifyingPayment ||
                    Boolean(selectedVehicleRecord?.hasActiveBooking)
                  }
                  onClick={() => void handleProceedToPayment()}
                >
                  <CreditCard className="h-4 w-4" />
                  {isVerifyingPayment
                    ? 'Verifying Payment & Locking Bay...'
                    : isInitiatingPayment
                    ? 'Opening Razorpay Checkout...'
                    : selectedVehicleRecord?.hasActiveBooking
                    ? `Vehicle ${selectedVehicleRecord.vehicleNumber} Has Active Booking`
                    : selectedSlotInfo
                    ? `Pay ₹${priceBreakdown.totalAmount} & Confirm Slot ${selectedSlotInfo.slotNumber}`
                    : 'Select a Slot on 2D Plan to Continue'}
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground text-center">
                  <Lock className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span>
                    Secured by Razorpay • Instant QR Entry Pass upon verification
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MOBILE FIXED BOTTOM SUMMARY BAR                                     */}
      {/* =================================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 shadow-lg">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold font-mono text-primary">
                ₹{priceBreakdown.totalAmount}
              </span>
              <span className="text-xs text-muted-foreground">({formattedDuration})</span>
            </div>
            <p className="text-xs font-medium text-foreground truncate">
              {selectedSlotInfo
                ? `Slot ${selectedSlotInfo.slotNumber} • ${selectedSlotInfo.floorName} (Zone ${selectedSlotInfo.zoneCode})`
                : 'Tap a green bay on the 2D layout'}
            </p>
          </div>

          <Button
            type="button"
            size="default"
            className="font-bold gap-1.5 shrink-0"
            disabled={
              !selectedSlotInfo ||
              Boolean(configError) ||
              isInitiatingPayment ||
              isVerifyingPayment ||
              Boolean(selectedVehicleRecord?.hasActiveBooking)
            }
            onClick={() => void handleProceedToPayment()}
          >
            <CreditCard className="h-4 w-4" />
            {isVerifyingPayment
              ? 'Verifying...'
              : isInitiatingPayment
              ? 'Processing...'
              : selectedVehicleRecord?.hasActiveBooking
              ? 'Vehicle Booked'
              : selectedSlotInfo
              ? `Pay ₹${priceBreakdown.totalAmount}`
              : 'Select Bay'}
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* QUICK ADD VEHICLE DIALOG                                            */}
      {/* =================================================================== */}
      <Dialog open={addVehicleDialogOpen} onOpenChange={setAddVehicleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Register Vehicle for Booking
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add your vehicle details to link with your digital QR entry pass.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleAddVehicleSubmit(e)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-veh-type" className="text-xs font-semibold">
                Vehicle Category
              </Label>
              <select
                id="new-veh-type"
                value={newVehicleType}
                onChange={(e) => setNewVehicleType(e.target.value as BookingVehicleType)}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-xs font-semibold"
              >
                <option value="Car">Car / Sedan</option>
                <option value="Bike">Two-Wheeler (Bike / Scooter)</option>
                <option value="SUV">SUV / MUV</option>
                <option value="EV">Electric Vehicle (EV)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-veh-number" className="text-xs font-semibold">
                Registration Number (License Plate)
              </Label>
              <Input
                id="new-veh-number"
                placeholder="e.g. GJ05AB1234"
                value={newVehicleNumber}
                onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())}
                className="font-mono uppercase text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-veh-brand" className="text-xs font-semibold">
                  Brand / Make
                </Label>
                <Input
                  id="new-veh-brand"
                  placeholder="e.g. Hyundai, Tata"
                  value={newVehicleBrand}
                  onChange={(e) => setNewVehicleBrand(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-veh-model" className="text-xs font-semibold">
                  Model
                </Label>
                <Input
                  id="new-veh-model"
                  placeholder="e.g. Creta, Nexon"
                  value={newVehicleModel}
                  onChange={(e) => setNewVehicleModel(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddVehicleDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isAddingVehicle}>
                {isAddingVehicle ? 'Saving...' : 'Save & Select Vehicle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* BOOKING CONFIRMATION MODAL                                          */}
      {/* =================================================================== */}
      <BookingConfirmationDialog
        open={confirmationDialogOpen}
        onOpenChange={setConfirmationDialogOpen}
        parkingLotId={facility._id}
        confirmation={confirmedBooking}
        onGoToDashboard={() => navigate('/customer/dashboard')}
        onBackToFacility={() => navigate(`/customer/parking/${facility._id}`)}
      />
    </div>
  );
};
