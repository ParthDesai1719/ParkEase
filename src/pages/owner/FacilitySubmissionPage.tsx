import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Car,
  Layers,
  Sparkles,
  Clock,
  IndianRupee,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Save,
  Send,
  Eye,
  Trash2,
  Plus,
  ArrowLeft,
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FacilityLocationMapPicker } from '@/components/common/FacilityLocationMapPicker';
import {
  createDraftSubmission,
  deleteDraftSubmission,
  getSubmissionById,
  submitForReview,
  updateSubmission,
  uploadSubmissionPhoto,
  uploadSubmissionPlanPdf,
  type FacilitySubmissionData,
  type FloorReferenceItem,
  type ZoneReferenceItem,
  type PhotoItem,
  type ParkingPlanPdf,
} from '@/api/facilitySubmission.api';
import { AuthenticatedImage } from '@/components/common/AuthenticatedImage';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/lib/socket';

const FACILITY_TYPES = [
  'Commercial Parking',
  'Shopping Mall',
  'Hospital',
  'Hotel',
  'Airport',
  'Railway Station',
  'Residential Society',
  'Educational Institution',
  'Independent Plot',
  'Other',
];

const AMENITY_OPTIONS = [
  'CCTV Surveillance',
  'Security Personnel',
  'Covered Parking',
  'Open Parking',
  'EV Charging',
  'Accessible Parking',
  'Valet Parking',
  'Lighting',
  'Car Wash',
  'Washroom',
  'Drinking Water',
  'Waiting Area',
  'Lift Access',
  'Escalator',
  'Fire Safety System',
  'Emergency Exit',
  'Help Desk',
];

const PHOTO_CATEGORIES = [
  'Exterior',
  'Complex / Building',
  'Entrance',
  'Exit',
  'Floors',
  'Areas',
  'Zones',
  'Slots',
  'Lanes',
  'Signage',
  'Security',
  'Amenities',
  'Other',
];

type StepId = 'general' | 'layout' | 'operations' | 'media' | 'review';

const FORM_STEPS: Array<{ id: StepId; label: string; stepNumber: number; icon: React.ElementType }> = [
  { id: 'general', label: 'General & Location', stepNumber: 1, icon: Building2 },
  { id: 'layout', label: 'Capacity & Layout', stepNumber: 2, icon: Layers },
  { id: 'operations', label: 'Operations & Rates', stepNumber: 3, icon: Clock },
  { id: 'media', label: 'Rules & Media', stepNumber: 4, icon: ImageIcon },
  { id: 'review', label: 'Review & Submit', stepNumber: 5, icon: CheckCircle2 },
];

export const FacilitySubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: editSubmissionId } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);

  // Active step
  const [activeStep, setActiveStep] = useState<StepId>('general');

  // Async States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Active Submission ID if draft was created in-memory
  const [submissionId, setSubmissionId] = useState<string | null>(editSubmissionId || null);
  const [submissionReference, setSubmissionReference] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string>('Draft');
  const [adminRemarks, setAdminRemarks] = useState<string | null>(null);

  // 1. Basic Information
  const [facilityName, setFacilityName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [facilityType, setFacilityType] = useState('Commercial Parking');
  const [contactName, setContactName] = useState(user?.fullName || '');
  const [contactPhone, setContactPhone] = useState(user?.mobileNumber || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');

  // 2. Location Information
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [areaLocality, setAreaLocality] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState(23.0225);
  const [longitude, setLongitude] = useState(72.5714);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  // 3. Capacity
  const [totalCapacity, setTotalCapacity] = useState<number>(50);
  const [carCapacity, setCarCapacity] = useState<number>(35);
  const [suvCapacity, setSuvCapacity] = useState<number>(10);
  const [bikeCapacity, setBikeCapacity] = useState<number>(5);
  const [evCapacity, setEvCapacity] = useState<number>(0);
  const [accessibleCapacity, setAccessibleCapacity] = useState<number>(0);
  const [vipCapacity, setVipCapacity] = useState<number>(0);
  const [otherCapacity, setOtherCapacity] = useState<number>(0);

  // 4. Floors Reference
  const [floors, setFloors] = useState<FloorReferenceItem[]>([
    {
      floorName: 'Ground Floor',
      floorNumber: 0,
      slotCount: 50,
      parkingType: 'Covered',
      floorDescription: 'Main drive-in parking bay',
    },
  ]);

  // 5. Zones Reference
  const [zones, setZones] = useState<ZoneReferenceItem[]>([
    {
      zoneName: 'Zone A',
      floorName: 'Ground Floor',
      slotCount: 30,
      zoneType: 'Standard Car Bays',
      supportedVehicleType: 'Car',
    },
    {
      zoneName: 'Zone B',
      floorName: 'Ground Floor',
      slotCount: 20,
      zoneType: 'Standard Car Bays',
      supportedVehicleType: 'Car',
    },
  ]);

  // 6. Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'CCTV Surveillance',
    'Covered Parking',
    'Lighting',
  ]);

  // 7. Operating Info
  const [isOpen24x7, setIsOpen24x7] = useState(false);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [showCustomDailySchedules, setShowCustomDailySchedules] = useState(false);
  const [dailySchedules, setDailySchedules] = useState<
    Array<{ day: string; isOpen: boolean; openingTime: string; closingTime: string }>
  >([
    { day: 'Monday', isOpen: true, openingTime: '08:00', closingTime: '22:00' },
    { day: 'Tuesday', isOpen: true, openingTime: '08:00', closingTime: '22:00' },
    { day: 'Wednesday', isOpen: true, openingTime: '08:00', closingTime: '22:00' },
    { day: 'Thursday', isOpen: true, openingTime: '08:00', closingTime: '22:00' },
    { day: 'Friday', isOpen: true, openingTime: '08:00', closingTime: '22:00' },
    { day: 'Saturday', isOpen: true, openingTime: '08:00', closingTime: '22:00' },
    { day: 'Sunday', isOpen: true, openingTime: '08:00', closingTime: '22:00' },
  ]);

  // 8. Pricing Info
  const [carHourlyRate, setCarHourlyRate] = useState<number>(40);
  const [suvHourlyRate, setSuvHourlyRate] = useState<number>(50);
  const [bikeHourlyRate, setBikeHourlyRate] = useState<number>(20);
  const [dailyRate, setDailyRate] = useState<number>(300);
  const [overnightRate, setOvernightRate] = useState<number>(200);
  const [evChargingRatePerHour, setEvChargingRatePerHour] = useState<number>(60);
  const [otherHourlyRate, setOtherHourlyRate] = useState<number>(0);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number>(15);
  const [minParkingDurationHours, setMinParkingDurationHours] = useState<number>(1);
  const [maxParkingDurationHours, setMaxParkingDurationHours] = useState<number>(24);
  const [additionalPricingNotes, setAdditionalPricingNotes] = useState('');

  // 9. Supported Vehicle Types
  const [supportedVehicleTypes, setSupportedVehicleTypes] = useState<string[]>([
    'Car',
    'SUV',
    'Bike',
  ]);

  // 10. Rules
  const [parkingRules, setParkingRules] = useState(
    'Please park strictly inside designated slot markings. Park at your own risk.',
  );
  const [entryExitInstructions, setEntryExitInstructions] = useState(
    'Show QR booking pass at the main gate scanner. Maintain 10 km/h speed limit.',
  );
  const [vehicleRestrictions, setVehicleRestrictions] = useState(
    'Heavy commercial trucks are not permitted.',
  );
  const [heightWeightRestrictions, setHeightWeightRestrictions] = useState(
    'Max clearance height: 2.4 meters.',
  );
  const [evRules, setEvRules] = useState('');
  const [accessibleParkingRules, setAccessibleParkingRules] = useState('');
  const [vipParkingRules, setVipParkingRules] = useState('');
  const [overnightRules, setOvernightRules] = useState('');
  const [otherInstructions, setOtherInstructions] = useState('');

  // 11. Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [primaryImageUrl, setPrimaryImageUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // 12. Parking Plan PDF
  const [parkingPlanPdf, setParkingPlanPdf] = useState<ParkingPlanPdf | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // 13. Subject & Additional Description
  const [subject, setSubject] = useState('');
  const [additionalDescription, setAdditionalDescription] = useState('');

  // Initial populate for Edit mode
  useEffect(() => {
    if (!editSubmissionId) return;

    const fetchSubmission = async () => {
      try {
        setIsLoading(true);
        const data = await getSubmissionById(editSubmissionId);

        setSubmissionId(data._id || editSubmissionId);
        setSubmissionReference(data.submissionReference || null);
        setSubmissionStatus(data.submissionStatus || 'Draft');
        setAdminRemarks(data.adminRemarks || data.requestedChanges || null);

        setFacilityName(data.facilityName || '');
        setShortDescription(data.shortDescription || '');
        setDetailedDescription(data.detailedDescription || '');
        setFacilityType(data.facilityType || 'Commercial Parking');
        setContactName(data.contactName || '');
        setContactPhone(data.contactPhone || '');
        setContactEmail(data.contactEmail || '');

        if (data.location) {
          setAddressLine1(data.location.addressLine1 || data.location.address || '');
          setAddressLine2(data.location.addressLine2 || '');
          setAreaLocality(data.location.areaLocality || '');
          setCity(data.location.city || '');
          setState(data.location.state || '');
          setPostalCode(data.location.postalCode || '');
          setLatitude(data.location.latitude ?? 23.0225);
          setLongitude(data.location.longitude ?? 72.5714);
          setLocationConfirmed(Boolean(data.location.confirmed));
        }

        if (data.capacity) {
          setTotalCapacity(data.capacity.totalSlots || 0);
          if (data.capacity.breakdown) {
            setCarCapacity(data.capacity.breakdown.car || 0);
            setSuvCapacity(data.capacity.breakdown.suv || 0);
            setBikeCapacity(data.capacity.breakdown.bike || 0);
            setEvCapacity(data.capacity.breakdown.ev || 0);
            setAccessibleCapacity(data.capacity.breakdown.accessible || 0);
            setVipCapacity(data.capacity.breakdown.vip || 0);
            setOtherCapacity(data.capacity.breakdown.other || 0);
          }
        }

        if (data.floors) setFloors(data.floors);
        if (data.zones) setZones(data.zones);
        if (data.amenities) setSelectedAmenities(data.amenities);

        if (data.operatingInfo) {
          setIsOpen24x7(Boolean(data.operatingInfo.isOpen24x7));
          setOpeningTime(data.operatingInfo.openingTime || '08:00');
          setClosingTime(data.operatingInfo.closingTime || '22:00');
          if (data.operatingInfo.dailySchedules && data.operatingInfo.dailySchedules.length > 0) {
            setDailySchedules(data.operatingInfo.dailySchedules);
            setShowCustomDailySchedules(true);
          }
        }

        if (data.pricing) {
          setCarHourlyRate(data.pricing.carHourlyRate || 0);
          setSuvHourlyRate(data.pricing.suvHourlyRate || 0);
          setBikeHourlyRate(data.pricing.bikeHourlyRate || 0);
          setDailyRate(data.pricing.dailyRate || 0);
          setOvernightRate(data.pricing.overnightRate || 0);
          setEvChargingRatePerHour(data.pricing.evChargingRatePerHour || 0);
          setOtherHourlyRate(data.pricing.otherHourlyRate || 0);
          setGracePeriodMinutes(data.pricing.gracePeriodMinutes ?? 15);
          setMinParkingDurationHours(data.pricing.minParkingDurationHours ?? 1);
          setMaxParkingDurationHours(data.pricing.maxParkingDurationHours ?? 24);
          setAdditionalPricingNotes(data.pricing.additionalPricingNotes || '');
        }

        if (data.supportedVehicleTypes) setSupportedVehicleTypes(data.supportedVehicleTypes);

        if (data.parkingRules) {
          setParkingRules(data.parkingRules.rules || '');
          setEntryExitInstructions(data.parkingRules.entryExitInstructions || '');
          setVehicleRestrictions(data.parkingRules.vehicleRestrictions || '');
          setHeightWeightRestrictions(data.parkingRules.heightWeightRestrictions || '');
          setEvRules(data.parkingRules.evRules || '');
          setAccessibleParkingRules(data.parkingRules.accessibleParkingRules || '');
          setVipParkingRules(data.parkingRules.vipParkingRules || '');
          setOvernightRules(data.parkingRules.overnightRules || '');
          setOtherInstructions(data.parkingRules.otherInstructions || '');
        }

        if (data.photos) setPhotos(data.photos);
        if (data.primaryImageUrl) setPrimaryImageUrl(data.primaryImageUrl);
        if (data.parkingPlanPdf) setParkingPlanPdf(data.parkingPlanPdf);
        if (data.subject) setSubject(data.subject);
        if (data.additionalDescription) setAdditionalDescription(data.additionalDescription);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load submission data';
        toast.error(msg);
        navigate('/owner/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSubmission();
  }, [editSubmissionId, navigate]);

  // Real-time status sync via WebSocket and window focus
  useEffect(() => {
    const targetId = editSubmissionId || submissionId;
    if (!targetId) return;

    const socket = getSocket();
    socket.emit('join_submission', targetId);

    const handleStatusChanged = (payload: { submissionId: string; status: string; adminRemarks?: string }) => {
      if (payload.submissionId === targetId) {
        setSubmissionStatus(payload.status);
        if (payload.adminRemarks) {
          setAdminRemarks(payload.adminRemarks);
        }
        // Only show status toast for external administrative reviews, not for self-initiated 'Submitted'
        if (payload.status !== 'Submitted') {
          toast.info(`Facility submission status updated to "${payload.status}".`, {
            id: `submission-status-${payload.submissionId}-${payload.status}`,
          });
        }
      }
    };

    socket.on('facility_status_changed', handleStatusChanged);

    const onFocus = () => {
      getSubmissionById(targetId)
        .then((data) => {
          if (data.submissionStatus) setSubmissionStatus(data.submissionStatus);
          if (data.adminRemarks || data.requestedChanges) {
            setAdminRemarks(data.adminRemarks || data.requestedChanges || null);
          }
        })
        .catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onFocus();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      socket.off('facility_status_changed', handleStatusChanged);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [editSubmissionId, submissionId]);

  // Derived slot sums
  const floorSlotSum = floors.reduce((acc, f) => acc + (f.slotCount || 0), 0);
  const categorySum =
    (carCapacity || 0) +
    (suvCapacity || 0) +
    (bikeCapacity || 0) +
    (evCapacity || 0) +
    (accessibleCapacity || 0) +
    (vipCapacity || 0) +
    (otherCapacity || 0);

  const isFloorMatching = floors.length === 0 || floorSlotSum === totalCapacity;
  const isCatMatching = categorySum === totalCapacity;

  // Check if every floor with defined zones has zone totals matching the floor capacity
  const floorZoneMismatches = floors
    .map((fl) => {
      const flZones = zones.filter((z) => z.floorName === fl.floorName);
      if (flZones.length === 0) return null;
      const zoneSum = flZones.reduce((acc, z) => acc + (Number(z.slotCount) || 0), 0);
      return zoneSum !== fl.slotCount ? { floor: fl.floorName, floorSlots: fl.slotCount, zoneSum } : null;
    })
    .filter(Boolean) as Array<{ floor: string; floorSlots: number; zoneSum: number }>;

  const areZonesMatchingFloors = floorZoneMismatches.length === 0;

  // Readiness Checklist for Step 5
  const readiness = {
    hasName: Boolean(facilityName.trim()),
    hasAddress: Boolean(addressLine1.trim() && city.trim() && state.trim()),
    hasPinConfirmed: Boolean(locationConfirmed),
    hasCapacity: totalCapacity > 0,
    isFloorMatching,
    areZonesMatchingFloors,
    hasPhotos: photos.length > 0,
  };
  const isReadyToSubmit = Object.values(readiness).every(Boolean);
  const isApproved = submissionStatus === 'Approved';
  const isSubmittedOrUnderReview = submissionStatus === 'Submitted' || submissionStatus === 'Under Review';

  // Payload builder
  const buildPayload = (): Partial<FacilitySubmissionData> => ({
    facilityName: facilityName.trim(),
    shortDescription: shortDescription.trim(),
    detailedDescription: detailedDescription.trim(),
    facilityType,
    contactName: contactName.trim(),
    contactPhone: contactPhone.trim(),
    contactEmail: contactEmail.trim(),
    location: {
      address: [addressLine1, addressLine2, areaLocality, city, state, postalCode].filter(Boolean).join(', '),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      areaLocality: areaLocality.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
      latitude,
      longitude,
      confirmed: locationConfirmed,
    },
    capacity: {
      totalSlots: Number(totalCapacity) || 0,
      breakdown: {
        car: Number(carCapacity) || 0,
        suv: Number(suvCapacity) || 0,
        bike: Number(bikeCapacity) || 0,
        ev: Number(evCapacity) || 0,
        accessible: Number(accessibleCapacity) || 0,
        vip: Number(vipCapacity) || 0,
        other: Number(otherCapacity) || 0,
      },
    },
    floors,
    zones,
    amenities: selectedAmenities,
    operatingInfo: {
      isOpen24x7,
      openingTime,
      closingTime,
      scheduleType: showCustomDailySchedules ? 'Custom' : 'Standard',
      dailySchedules: showCustomDailySchedules ? dailySchedules : [],
    },
    pricing: {
      carHourlyRate: Number(carHourlyRate) || 0,
      suvHourlyRate: Number(suvHourlyRate) || 0,
      bikeHourlyRate: Number(bikeHourlyRate) || 0,
      dailyRate: Number(dailyRate) || 0,
      overnightRate: Number(overnightRate) || 0,
      evChargingRatePerHour: Number(evChargingRatePerHour) || 0,
      otherHourlyRate: Number(otherHourlyRate) || 0,
      gracePeriodMinutes: Number(gracePeriodMinutes) || 15,
      minParkingDurationHours: Number(minParkingDurationHours) || 1,
      maxParkingDurationHours: Number(maxParkingDurationHours) || 24,
      additionalPricingNotes: additionalPricingNotes.trim(),
    },
    supportedVehicleTypes,
    parkingRules: {
      rules: parkingRules.trim(),
      entryExitInstructions: entryExitInstructions.trim(),
      vehicleRestrictions: vehicleRestrictions.trim(),
      heightWeightRestrictions: heightWeightRestrictions.trim(),
      evRules: evRules.trim(),
      accessibleParkingRules: accessibleParkingRules.trim(),
      vipParkingRules: vipParkingRules.trim(),
      overnightRules: overnightRules.trim(),
      otherInstructions: otherInstructions.trim(),
    },
    photos,
    primaryImageUrl: primaryImageUrl || (photos.length > 0 ? photos[0].url : ''),
    parkingPlanPdf,
    subject: subject.trim(),
    additionalDescription: additionalDescription.trim(),
  });

  // Action: Save as Draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const payload = buildPayload();
      if (submissionId) {
        const updated = await updateSubmission(submissionId, payload);
        setLastSavedAt(new Date());
        if (isSubmittedOrUnderReview) {
          toast.success(
            `Changes saved successfully! Platform administrators reviewing "${updated.facilityName}" have been notified.`,
          );
        } else {
          toast.success(`Draft updated successfully (${updated.submissionReference || submissionReference}).`);
        }
      } else {
        const created = await createDraftSubmission(payload);
        setSubmissionId(created._id || null);
        setSubmissionReference(created.submissionReference || null);
        setLastSavedAt(new Date());
        toast.success(`Draft saved successfully with ID ${created.submissionReference}.`);
        if (created._id) {
          navigate(`/owner/parking/submissions/${created._id}/edit`, { replace: true });
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = axiosErr.response?.data?.message || axiosErr.message || 'Failed to save draft.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Action: Delete Draft
  const handleDeleteDraft = async () => {
    if (!submissionId) return;
    setIsDeleting(true);
    try {
      await deleteDraftSubmission(submissionId);
      toast.success('Draft parking facility submission deleted successfully.');
      setDeleteDialogOpen(false);
      navigate('/owner/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = axiosErr.response?.data?.message || axiosErr.message || 'Failed to delete draft.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Action: Trigger Submit Workflow
  const handleInitiateSubmit = () => {
    if (!facilityName.trim()) {
      toast.error('Facility name is required.');
      setActiveStep('general');
      return;
    }
    if (!addressLine1.trim() || !city.trim() || !state.trim()) {
      toast.error('Complete address, city, and state are required.');
      setActiveStep('general');
      return;
    }
    if (!locationConfirmed) {
      toast.error('Please confirm the facility location pin on the interactive map.');
      setActiveStep('general');
      return;
    }
    if (totalCapacity < 1) {
      toast.error('Total parking capacity must be at least 1 slot.');
      setActiveStep('layout');
      return;
    }
    if (floors.length > 0 && floorSlotSum !== totalCapacity) {
      toast.error(
        `Floor slot counts sum (${floorSlotSum}) must equal total capacity (${totalCapacity}).`,
      );
      setActiveStep('layout');
      return;
    }
    if (!areZonesMatchingFloors && floorZoneMismatches.length > 0) {
      const m = floorZoneMismatches[0];
      toast.error(
        `Total zone slots on floor "${m.floor}" (${m.zoneSum}) must equal the floor capacity (${m.floorSlots}). Please balance your zone slots in Step 3 (Layout & Zones).`,
      );
      setActiveStep('layout');
      return;
    }
    if (photos.length === 0) {
      toast.error('Please upload at least one actual photograph of the parking facility.');
      setActiveStep('media');
      return;
    }

    setConfirmSubmitOpen(true);
  };

  // Action: Finalize Submission
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setConfirmSubmitOpen(false);

    try {
      const payload = buildPayload();
      let activeId = submissionId;

      if (!activeId) {
        const created = await createDraftSubmission(payload);
        activeId = created._id!;
        setSubmissionId(activeId);
      } else {
        await updateSubmission(activeId, payload);
      }

      const finalized = await submitForReview(activeId);
      toast.success(
        `Parking facility setup request submitted successfully! Reference: ${finalized.submissionReference}`,
      );
      navigate(`/owner/parking/submissions/${finalized._id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = axiosErr.response?.data?.message || axiosErr.message || 'Submission failed.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhoto(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isFirst = photos.length === 0 && i === 0;
        const uploaded = await uploadSubmissionPhoto(file, 'Exterior', isFirst);

        setPhotos((prev) => [
          ...prev,
          {
            url: uploaded.url,
            caption: uploaded.caption || file.name,
            category: uploaded.category,
            isPrimary: uploaded.isPrimary,
          },
        ]);

        if (isFirst || !primaryImageUrl) {
          setPrimaryImageUrl(uploaded.url);
        }
      }
      toast.success(`${files.length} photo(s) uploaded successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Photo upload failed.';
      toast.error(msg);
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  // Reference PDF Upload Handler (Max 1)
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF documents are allowed for the parking plan reference.');
      return;
    }

    setIsUploadingPdf(true);
    try {
      const uploaded = await uploadSubmissionPlanPdf(file);
      setParkingPlanPdf({
        url: uploaded.url,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        uploadedAt: uploaded.uploadedAt,
      });
      toast.success('Reference parking plan PDF uploaded successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PDF upload failed.';
      toast.error(msg);
    } finally {
      setIsUploadingPdf(false);
      e.target.value = '';
    }
  };

  const currentStepIndex = FORM_STEPS.findIndex((s) => s.id === activeStep);

  const goToNextStep = () => {
    if (currentStepIndex < FORM_STEPS.length - 1) {
      setActiveStep(FORM_STEPS[currentStepIndex + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setActiveStep(FORM_STEPS[currentStepIndex - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading facility submission...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. TOP HEADER & WORKFLOW ADVISORY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
            >
              <Link to="/owner/dashboard" className="flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Owner Dashboard
              </Link>
            </Button>
            <span className="text-muted-foreground/40">&bull;</span>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs font-medium">
              Facility Setup Proposal
            </Badge>
            {submissionReference && (
              <Badge variant="secondary" className="font-mono text-xs">
                {submissionReference}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={
                submissionStatus === 'Under Review'
                  ? 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-xs font-semibold'
                  : submissionStatus === 'Changes Requested'
                  ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs font-semibold'
                  : submissionStatus === 'Approved'
                  ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold'
                  : submissionStatus === 'Rejected'
                  ? 'border-destructive/40 text-destructive bg-destructive/10 text-xs font-semibold'
                  : submissionStatus === 'Submitted'
                  ? 'border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 text-xs font-semibold'
                  : 'border-border text-muted-foreground text-xs font-medium'
              }
            >
              {submissionStatus === 'Under Review' && <Clock className="h-3 w-3 mr-1 animate-pulse" />}
              Status: {submissionStatus}
            </Badge>

            {lastSavedAt && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3 text-emerald-500" />
                Draft saved at {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {facilityName || (editSubmissionId ? 'Edit Facility Proposal' : 'New Parking Facility Proposal')}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-1 max-w-2xl">
            Provide comprehensive reference information about your physical parking facility for Administrator survey, boundary verification, and 2D layout planning.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {submissionId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/owner/parking/submissions/${submissionId}`)}
              className="gap-1.5 text-xs font-medium"
              aria-label="View submission details"
            >
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Button>
          )}

          {submissionId && submissionStatus === 'Draft' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isSaving || isSubmitting || isDeleting}
              className="gap-1.5 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete draft submission"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Draft
            </Button>
          )}

          {isSubmittedOrUnderReview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting || isDeleting}
              className="gap-1.5 text-xs font-semibold text-primary border-primary/40 bg-primary/5 hover:bg-primary/10 shadow-xs"
              aria-label="Save changes and notify administrators"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Updating...' : 'Save Changes & Notify Admin'}
            </Button>
          )}

          {!isSubmittedOrUnderReview && !isApproved && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting || isDeleting}
              className="gap-1.5 text-xs font-medium"
              aria-label="Save current progress as a draft"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="gap-1.5 text-xs font-medium"
            aria-label="Preview submission details"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>

          {!isSubmittedOrUnderReview && !isApproved && (
            <Button
              type="button"
              size="sm"
              onClick={handleInitiateSubmit}
              disabled={isSubmitting || isDeleting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-semibold shadow-xs"
              aria-label="Submit parking facility proposal for administrator review"
            >
              <Send className="h-3.5 w-3.5" />
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      {/* Under Review Banner */}
      {submissionStatus === 'Under Review' && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
              <Clock className="h-5 w-5 animate-pulse" />
              Proposal Under Active Administrator Review
            </div>
            {submissionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/owner/parking/submissions/${submissionId}`)}
                className="text-xs h-7 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
              >
                View Live Review
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            An administrator has started reviewing this parking facility proposal. You can modify fields below; clicking <strong>"Save Changes &amp; Notify Admin"</strong> will immediately notify the reviewing team with your updates.
          </p>
        </div>
      )}

      {/* Submitted Banner */}
      {submissionStatus === 'Submitted' && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Clock className="h-5 w-5" />
              Proposal Queued for Administrator Review
            </div>
            {submissionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/owner/parking/submissions/${submissionId}`)}
                className="text-xs h-7 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
              >
                View Submission
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
          <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
            Your facility setup proposal has been submitted to the platform administrators. You can edit any fields below; clicking <strong>"Save Changes &amp; Notify Admin"</strong> will record your updates and alert the review team.
          </p>
        </div>
      )}

      {/* Approved Banner */}
      {submissionStatus === 'Approved' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              Facility Proposal Approved
            </div>
            {submissionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/owner/parking/submissions/${submissionId}`)}
                className="text-xs h-7 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                View Details
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
            This parking facility proposal was approved by administrators. The official parking lot structure can now be generated.
          </p>
        </div>
      )}

      {/* Changes Requested Banner */}
      {submissionStatus === 'Changes Requested' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <AlertTriangle className="h-5 w-5" />
            Administrator Feedback &amp; Action Required
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            {adminRemarks || 'The administrator reviewed your facility setup details and requested adjustments. Please modify the fields as requested and resubmit.'}
          </p>
        </div>
      )}

      {/* FORM STEPPER TABS NAVIGATION */}
      <Tabs
        value={activeStep}
        onValueChange={(val) => setActiveStep(val as StepId)}
        className="space-y-6"
      >
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="w-full justify-start sm:justify-between h-auto p-1.5 bg-muted/60 border border-border/60 rounded-xl gap-1">
            {FORM_STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;
              return (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-lg shrink-0 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}
                  >
                    {step.stepNumber}
                  </span>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{step.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: GENERAL FACILITY INFO & LOCATION                                   */}
        {/* ========================================================================= */}
        <TabsContent value="general" className="space-y-6 focus-visible:outline-none">
          {/* Card 1: Basic Information */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">1. Basic Parking Information</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Provide the primary identification, commercial category, and on-site operator contact details.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="facilityName" className="text-sm font-medium">
                    Parking Facility Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="facilityName"
                    placeholder="e.g. Metro Grand Parking Complex"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                  <p className="text-xs text-muted-foreground">The official display name of your parking lot.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facilityType" className="text-sm font-medium">
                    Facility Type / Category <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="facilityType"
                    aria-label="Facility Type"
                    value={facilityType}
                    onChange={(e) => setFacilityType(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {FACILITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactName" className="text-sm font-medium">
                    On-site Manager / Contact Person
                  </Label>
                  <Input
                    id="contactName"
                    placeholder="Full name of on-site manager"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone" className="text-sm font-medium">
                    Contact Mobile Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="contactPhone"
                    placeholder="e.g. +91 98765 43210"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail" className="text-sm font-medium">
                    Contact Email Address
                  </Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="e.g. facility.manager@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="shortDescription" className="text-sm font-medium">
                    Short Tagline / Overview (max 250 characters)
                  </Label>
                  <Input
                    id="shortDescription"
                    placeholder="e.g. Multi-tier automated covered parking near central transit hub"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    maxLength={250}
                    className="h-10 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">{shortDescription.length} / 250 characters</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="detailedDescription" className="text-sm font-medium">
                    Detailed Operational Description (max 2,000 characters)
                  </Label>
                  <Textarea
                    id="detailedDescription"
                    placeholder="Describe facility accessibility, peak operating hours, security provisions, entrance gates, and visitor navigation..."
                    value={detailedDescription}
                    onChange={(e) => setDetailedDescription(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="text-sm resize-y"
                  />
                  <p className="text-xs text-muted-foreground">{detailedDescription.length} / 2000 characters</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Physical Location & Interactive Map Pin */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">2. Physical Location &amp; Confirmed Map Marker</CardTitle>
                </div>
                {locationConfirmed && (
                  <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" /> Pin Confirmed
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Enter the exact physical address and confirm your location pin on the interactive map so customers can navigate to your lot.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="addressLine1" className="text-sm font-medium">
                    Address Line 1 (Building / Plot / Street) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="addressLine1"
                    placeholder="e.g. Plot No. 42, Commercial Avenue, Main Road"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine2" className="text-sm font-medium">
                    Address Line 2 (Landmark / Floor / Wing)
                  </Label>
                  <Input
                    id="addressLine2"
                    placeholder="e.g. Opposite City Mall / Near Metro Pillar 114"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="areaLocality" className="text-sm font-medium">
                    Area / Locality
                  </Label>
                  <Input
                    id="areaLocality"
                    placeholder="e.g. Central Business District"
                    value={areaLocality}
                    onChange={(e) => setAreaLocality(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="city"
                    placeholder="e.g. Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium">
                    State <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="state"
                    placeholder="e.g. Maharashtra"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-sm font-medium">
                    PIN Code (6 digits) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="postalCode"
                    placeholder="e.g. 400001"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    maxLength={6}
                    className="h-10 text-sm"
                    required
                  />
                </div>
              </div>

              <Separator className="my-2" />

              {/* Interactive Leaflet Map Component */}
              <div className="space-y-2">
                <Label htmlFor="mapSearchLocation" className="text-sm font-medium block">
                  Interactive Premise Pin &amp; Exact Coordinates <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Search address or click on the map to place the marker. Click &ldquo;Confirm This Location Marker&rdquo; to lock the coordinates.
                </p>

                <div className="rounded-xl overflow-hidden border border-border/80 shadow-xs mt-3">
                  <FacilityLocationMapPicker
                    latitude={latitude}
                    longitude={longitude}
                    confirmed={locationConfirmed}
                    addressHint={[addressLine1, areaLocality, city, state].filter(Boolean).join(', ')}
                    onChange={(lat, lng, confirmed) => {
                      setLatitude(lat);
                      setLongitude(lng);
                      setLocationConfirmed(confirmed);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: CAPACITY, FLOORS & ZONES LAYOUT                                    */}
        {/* ========================================================================= */}
        <TabsContent value="layout" className="space-y-6 focus-visible:outline-none">
          {/* Card 1: Total Capacity & Breakdown */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">3. Facility Capacity Breakdown</CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={
                    isCatMatching
                      ? 'border-emerald-600/30 text-emerald-600 bg-emerald-600/5 text-xs font-medium'
                      : 'border-amber-500/40 text-amber-600 bg-amber-500/5 text-xs font-medium'
                  }
                >
                  Vehicle Sum: {categorySum} / {totalCapacity} Slots
                </Badge>
              </div>
              <CardDescription className="text-xs">
                State the total physical bays and estimated allocations across vehicle classes.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div className="space-y-2 col-span-2 sm:col-span-1 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <Label htmlFor="totalCapacity" className="text-sm font-bold text-foreground">
                    Total Capacity (Slots) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="totalCapacity"
                    type="number"
                    min={1}
                    value={totalCapacity}
                    onChange={(e) => setTotalCapacity(Math.max(1, parseInt(e.target.value) || 0))}
                    className="h-11 text-lg font-bold text-primary bg-background"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Total parking slots in the facility.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carCap" className="text-sm font-medium">Standard Car Bays</Label>
                  <Input
                    id="carCap"
                    type="number"
                    min={0}
                    value={carCapacity}
                    onChange={(e) => setCarCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suvCap" className="text-sm font-medium">SUV / Large Vehicle</Label>
                  <Input
                    id="suvCap"
                    type="number"
                    min={0}
                    value={suvCapacity}
                    onChange={(e) => setSuvCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bikeCap" className="text-sm font-medium">Two-Wheeler / Bike</Label>
                  <Input
                    id="bikeCap"
                    type="number"
                    min={0}
                    value={bikeCapacity}
                    onChange={(e) => setBikeCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evCap" className="text-sm font-medium">
                    EV Charging Bays
                  </Label>
                  <Input
                    id="evCap"
                    type="number"
                    min={0}
                    value={evCapacity}
                    onChange={(e) => setEvCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessCap" className="text-sm font-medium">Accessible / Disabled</Label>
                  <Input
                    id="accessCap"
                    type="number"
                    min={0}
                    value={accessibleCapacity}
                    onChange={(e) => setAccessibleCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vipCap" className="text-sm font-medium">VIP / Reserved</Label>
                  <Input
                    id="vipCap"
                    type="number"
                    min={0}
                    value={vipCapacity}
                    onChange={(e) => setVipCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otherCap" className="text-sm font-medium">Other Vehicles</Label>
                  <Input
                    id="otherCap"
                    type="number"
                    min={0}
                    value={otherCapacity}
                    onChange={(e) => setOtherCapacity(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Floor Reference Breakdown */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">4. Floor Reference Structure</CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={
                    isFloorMatching
                      ? 'border-emerald-600/30 text-emerald-600 bg-emerald-600/5 text-xs font-medium'
                      : 'border-destructive/40 text-destructive bg-destructive/5 text-xs font-medium'
                  }
                >
                  Floor Slots: {floorSlotSum} / {totalCapacity} Capacity {isFloorMatching ? '✓' : '✗'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                List the physical floors for survey reference. The sum of floor slot counts must align with Total Facility Capacity.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {floors.map((fl, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Floor Level #{idx + 1}</span>
                    {floors.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFloors(floors.filter((_, i) => i !== idx))}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                        aria-label={`Remove Floor Level #${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Floor
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`floorName-${idx}`} className="text-xs font-medium">
                        Floor Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`floorName-${idx}`}
                        placeholder="e.g. Ground Floor, Basement 1"
                        value={fl.floorName}
                        onChange={(e) => {
                          const next = [...floors];
                          next[idx].floorName = e.target.value;
                          setFloors(next);
                        }}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`floorNumber-${idx}`} className="text-xs font-medium">
                        Level Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`floorNumber-${idx}`}
                        type="number"
                        placeholder="e.g. 0, -1, 1"
                        value={fl.floorNumber}
                        onChange={(e) => {
                          const next = [...floors];
                          next[idx].floorNumber = parseInt(e.target.value) || 0;
                          setFloors(next);
                        }}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`floorSlotCount-${idx}`} className="text-xs font-medium">
                        Slot Count <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`floorSlotCount-${idx}`}
                        type="number"
                        min={0}
                        placeholder="Number of slots"
                        value={fl.slotCount}
                        onChange={(e) => {
                          const next = [...floors];
                          next[idx].slotCount = parseInt(e.target.value) || 0;
                          setFloors(next);
                        }}
                        className="h-9 text-xs font-semibold"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`floorParkingType-${idx}`} className="text-xs font-medium">
                        Structure Type <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id={`floorParkingType-${idx}`}
                        aria-label={`Parking type for ${fl.floorName || `Floor ${idx + 1}`}`}
                        value={fl.parkingType}
                        onChange={(e) => {
                          const next = [...floors];
                          next[idx].parkingType = e.target.value;
                          setFloors(next);
                        }}
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="Covered">Covered Structure</option>
                        <option value="Open Ground">Open Ground</option>
                        <option value="Rooftop">Rooftop</option>
                        <option value="Basement">Basement</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFloors([
                    ...floors,
                    {
                      floorName: `Floor ${floors.length + 1}`,
                      floorNumber: floors.length,
                      slotCount: 0,
                      parkingType: 'Covered',
                    },
                  ])
                }
                className="gap-1.5 text-xs font-medium mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Floor
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Zone Reference Breakdown */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">5. Zone Allocation Reference (Optional)</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {zones.length} Zones Defined
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Reference breakdown for designated sub-sections or bays within floors (e.g. Zone A, EV Charging Zone).
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {/* Floor Zone Alignment Status Bar */}
              {floors.length > 0 && (
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Floor Zone Capacity Alignment
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Each floor with defined zones must match its floor capacity before submission.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {floors.map((fl, fIdx) => {
                      const floorZones = zones.filter((z) => z.floorName === fl.floorName);
                      const assignedSlots = floorZones.reduce((sum, z) => sum + (Number(z.slotCount) || 0), 0);
                      const hasZones = floorZones.length > 0;
                      const isMatched = !hasZones || assignedSlots === fl.slotCount;
                      const diff = assignedSlots - fl.slotCount;

                      return (
                        <div
                          key={fIdx}
                          className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-1.5 transition-colors ${
                            !hasZones
                              ? 'border-border/60 bg-background/50 text-muted-foreground'
                              : isMatched
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : diff > 0
                              ? 'border-destructive/40 bg-destructive/10 text-destructive'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span>{fl.floorName}</span>
                            <span className="font-mono text-[11px]">
                              {assignedSlots} / {fl.slotCount} slots
                            </span>
                          </div>
                          <div className="text-[11px] flex items-center justify-between">
                            <span className="font-medium">
                              {!hasZones
                                ? 'Open-plan (no zones)'
                                : isMatched
                                ? '✓ Balanced'
                                : diff > 0
                                ? `✕ Over by +${diff} slots`
                                : `⚠ ${Math.abs(diff)} slots unassigned`}
                            </span>
                            {hasZones && (
                              <span className="text-[10px] opacity-80">
                                {floorZones.length} {floorZones.length === 1 ? 'zone' : 'zones'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {zones.map((zn, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Zone Reference #{idx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setZones(zones.filter((_, i) => i !== idx))}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      aria-label={`Remove Zone Reference #${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Zone
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`zoneName-${idx}`} className="text-xs font-medium">Zone Name</Label>
                      <Input
                        id={`zoneName-${idx}`}
                        placeholder="e.g. Zone A, Premium Bay"
                        value={zn.zoneName}
                        onChange={(e) => {
                          const next = [...zones];
                          next[idx].zoneName = e.target.value;
                          setZones(next);
                        }}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`zoneFloor-${idx}`} className="text-xs font-medium">Associated Floor</Label>
                      <select
                        id={`zoneFloor-${idx}`}
                        value={zn.floorName}
                        onChange={(e) => {
                          const next = [...zones];
                          next[idx].floorName = e.target.value;
                          setZones(next);
                        }}
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {floors.map((f, i) => (
                          <option key={i} value={f.floorName}>
                            {f.floorName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`zoneSlotCount-${idx}`} className="text-xs font-medium">Slot Count</Label>
                      <Input
                        id={`zoneSlotCount-${idx}`}
                        type="number"
                        min={0}
                        placeholder="Slots in zone"
                        value={zn.slotCount}
                        onChange={(e) => {
                          const next = [...zones];
                          next[idx].slotCount = parseInt(e.target.value) || 0;
                          setZones(next);
                        }}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`zoneType-${idx}`} className="text-xs font-medium">Zone Purpose</Label>
                      <select
                        id={`zoneType-${idx}`}
                        value={
                          zn.zoneType === 'Standard'
                            ? 'Standard Car Bays'
                            : zn.zoneType === 'EV Dedicated' || zn.zoneType === 'EV Charging'
                            ? 'EV Charging Bays'
                            : zn.zoneType === 'VIP' || zn.zoneType === 'VIP / Valet'
                            ? 'VIP / Reserved'
                            : zn.zoneType || 'Standard Car Bays'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = [...zones];
                          next[idx].zoneType = val;

                          // Automatically synchronize supported vehicle type
                          if (val.includes('Two-Wheeler') || val.includes('Bike')) {
                            next[idx].supportedVehicleType = 'Bike';
                          } else if (val.includes('SUV') || val.includes('Large')) {
                            next[idx].supportedVehicleType = 'SUV';
                          } else if (val.includes('EV')) {
                            next[idx].supportedVehicleType = 'EV';
                          } else if (val.includes('Accessible')) {
                            next[idx].supportedVehicleType = 'Accessible';
                          } else {
                            next[idx].supportedVehicleType = 'Car';
                          }
                          setZones(next);
                        }}
                        className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="Standard Car Bays">Standard Car Bays</option>
                        <option value="SUV / Large Vehicle">SUV / Large Vehicle</option>
                        <option value="Two-Wheeler / Bike">Two-Wheeler / Bike</option>
                        <option value="EV Charging Bays">EV Charging Bays</option>
                        <option value="VIP / Reserved">VIP / Reserved</option>
                        <option value="Accessible / Disabled">Accessible / Disabled</option>
                        <option value="Staff Only">Staff Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setZones([
                    ...zones,
                    {
                      zoneName: `Zone ${String.fromCharCode(65 + zones.length)}`,
                      floorName: floors[0]?.floorName || 'Ground Floor',
                      slotCount: 10,
                      zoneType: 'Standard Car Bays',
                      supportedVehicleType: 'Car',
                    },
                  ])
                }
                className="gap-1.5 text-xs font-medium mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Sub-Zone
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: OPERATING SCHEDULES & PRICING TARIFFS                              */}
        {/* ========================================================================= */}
        <TabsContent value="operations" className="space-y-6 focus-visible:outline-none">
          {/* Card 1: Operating Schedule */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">6. Operating Schedule &amp; Hours</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Define the working hours when vehicles can enter and exit the facility.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-foreground">Open 24×7 Non-Stop</span>
                  <p className="text-xs text-muted-foreground">The parking premise operates 24 hours a day, 7 days a week.</p>
                </div>
                <Button
                  type="button"
                  variant={isOpen24x7 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsOpen24x7(!isOpen24x7)}
                  className="text-xs font-medium"
                >
                  {isOpen24x7 ? '24×7 Enabled ✓' : 'Standard Hours'}
                </Button>
              </div>

              {!isOpen24x7 && (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="openingTime" className="text-sm font-medium">Standard Opening Time</Label>
                    <Input
                      id="openingTime"
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="closingTime" className="text-sm font-medium">Standard Closing Time</Label>
                    <Input
                      id="closingTime"
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Parking Tariff & Rates */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">7. Parking Tariff &amp; Rates (INR ₹)</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Configure hourly rates, day passes, and policy limits for visitor billing.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="carRate" className="text-sm font-medium">
                    Car Rate (₹/hr) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="carRate"
                    type="number"
                    min={0}
                    value={carHourlyRate}
                    onChange={(e) => setCarHourlyRate(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suvRate" className="text-sm font-medium">
                    SUV Rate (₹/hr) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="suvRate"
                    type="number"
                    min={0}
                    value={suvHourlyRate}
                    onChange={(e) => setSuvHourlyRate(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bikeRate" className="text-sm font-medium">
                    Bike Rate (₹/hr) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bikeRate"
                    type="number"
                    min={0}
                    value={bikeHourlyRate}
                    onChange={(e) => setBikeHourlyRate(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gracePeriod" className="text-sm font-medium">Grace Period (Mins)</Label>
                  <Input
                    id="gracePeriod"
                    type="number"
                    min={0}
                    value={gracePeriodMinutes}
                    onChange={(e) => setGracePeriodMinutes(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dailyRate" className="text-sm font-medium">Full Day Flat Rate (₹)</Label>
                  <Input
                    id="dailyRate"
                    type="number"
                    min={0}
                    value={dailyRate}
                    onChange={(e) => setDailyRate(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overnightRate" className="text-sm font-medium">Overnight Rate (₹)</Label>
                  <Input
                    id="overnightRate"
                    type="number"
                    min={0}
                    value={overnightRate}
                    onChange={(e) => setOvernightRate(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="evRate" className="text-sm font-medium">EV Hourly Rate (₹/hr)</Label>
                  <Input
                    id="evRate"
                    type="number"
                    min={0}
                    value={evChargingRatePerHour}
                    onChange={(e) => setEvChargingRatePerHour(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otherRate" className="text-sm font-medium">Other Rate (₹/hr)</Label>
                  <Input
                    id="otherRate"
                    type="number"
                    min={0}
                    value={otherHourlyRate}
                    onChange={(e) => setOtherHourlyRate(parseInt(e.target.value) || 0)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minDuration" className="text-sm font-medium">Min Duration (Hours)</Label>
                  <Input
                    id="minDuration"
                    type="number"
                    min={1}
                    value={minParkingDurationHours}
                    onChange={(e) => setMinParkingDurationHours(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDuration" className="text-sm font-medium">Max Duration (Hours)</Label>
                  <Input
                    id="maxDuration"
                    type="number"
                    min={1}
                    value={maxParkingDurationHours}
                    onChange={(e) => setMaxParkingDurationHours(Math.max(1, parseInt(e.target.value) || 24))}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="pricingNotes" className="text-sm font-medium">Surge &amp; Discount Notes</Label>
                  <Input
                    id="pricingNotes"
                    placeholder="e.g. Free 15 min pick-up/drop-off; weekend surge applies"
                    value={additionalPricingNotes}
                    onChange={(e) => setAdditionalPricingNotes(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Vehicle Eligibility & Amenities */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">8. Vehicle Eligibility &amp; Facility Amenities</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Select which vehicle classes are supported and mark all available on-premise amenities.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium block">Supported Vehicle Classes</Label>
                <div className="flex flex-wrap gap-2.5">
                  {['Car', 'SUV', 'Bike', 'EV', 'Truck', 'Bus'].map((v) => {
                    const active = supportedVehicleTypes.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setSupportedVehicleTypes(supportedVehicleTypes.filter((x) => x !== v));
                          } else {
                            setSupportedVehicleTypes([...supportedVehicleTypes, v]);
                          }
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                        }`}
                      >
                        {active && '✓ '}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Facility Amenities ({selectedAmenities.length} selected)</Label>
                  <span className="text-xs text-muted-foreground">Select all that apply</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {AMENITY_OPTIONS.map((amenity) => {
                    const checked = selectedAmenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => {
                          if (checked) {
                            setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
                          } else {
                            setSelectedAmenities([...selectedAmenities, amenity]);
                          }
                        }}
                        className={`text-left p-2.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-2 ${
                          checked
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-card border-border/80 text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded flex items-center justify-center text-[10px] shrink-0 border ${
                            checked
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {checked && '✓'}
                        </span>
                        <span className="truncate">{amenity}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: OPERATIONAL RULES & MEDIA UPLOADS                                  */}
        {/* ========================================================================= */}
        <TabsContent value="media" className="space-y-6 focus-visible:outline-none">
          {/* Card 1: Facility Rules & Restrictions */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">9. Facility Operational Rules</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Establish rules, clearance thresholds, and navigation instructions for incoming vehicles.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="parkingRules" className="text-sm font-medium">General Parking Rules &amp; Policies</Label>
                  <Textarea
                    id="parkingRules"
                    placeholder="e.g. Please park strictly inside designated slot markings. Park at your own risk."
                    value={parkingRules}
                    onChange={(e) => setParkingRules(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="entryExitInstructions" className="text-sm font-medium">Entry &amp; Exit Instructions</Label>
                  <Textarea
                    id="entryExitInstructions"
                    placeholder="e.g. Scan QR booking pass at the barrier scanner. Maintain 10 km/h limit."
                    value={entryExitInstructions}
                    onChange={(e) => setEntryExitInstructions(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="heightRestrictions" className="text-sm font-medium">Height &amp; Weight Limits</Label>
                  <Input
                    id="heightRestrictions"
                    placeholder="e.g. Max clearance height 2.4 meters"
                    value={heightWeightRestrictions}
                    onChange={(e) => setHeightWeightRestrictions(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicleRestrictions" className="text-sm font-medium">Vehicle Restrictions</Label>
                  <Input
                    id="vehicleRestrictions"
                    placeholder="e.g. Heavy commercial trucks not permitted"
                    value={vehicleRestrictions}
                    onChange={(e) => setVehicleRestrictions(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Facility Photographs */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">10. Facility Photographs</CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={
                    photos.length > 0
                      ? 'border-emerald-600/30 text-emerald-600 bg-emerald-600/5 text-xs font-medium'
                      : 'border-destructive/40 text-destructive bg-destructive/5 text-xs font-medium'
                  }
                >
                  {photos.length} Photo(s) Attached {photos.length > 0 ? '✓' : '(Min 1 required)'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Upload clear photos showing exterior building, entrance gate, exit barrier, floors, and slot markings.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Photo Upload Zone */}
              <div className="p-6 border-2 border-dashed border-border/80 rounded-xl text-center hover:border-primary/50 transition-colors bg-muted/10">
                <UploadCloud className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-foreground">Upload Facility Photographs</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Select JPEG, PNG, or WebP files from your device. You can set the primary cover photo below.
                </p>

                <div className="mt-4">
                  <input
                    type="file"
                    id="photoUpload"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingPhoto}
                    asChild
                    className="cursor-pointer text-xs"
                  >
                    <label htmlFor="photoUpload">
                      {isUploadingPhoto ? 'Uploading Photos...' : 'Select Photos to Upload'}
                    </label>
                  </Button>
                </div>
              </div>

              {/* Photos Gallery */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photos.map((p, idx) => (
                    <div
                      key={idx}
                      className={`relative rounded-xl border overflow-hidden group bg-card transition-all ${
                        p.isPrimary || primaryImageUrl === p.url
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border/80'
                      }`}
                    >
                      <div className="aspect-video w-full bg-muted overflow-hidden relative">
                        <AuthenticatedImage
                          src={p.url}
                          alt={p.caption || `Facility photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {(p.isPrimary || primaryImageUrl === p.url) && (
                          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                            Primary Cover
                          </Badge>
                        )}
                      </div>

                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <select
                            value={p.category || 'Exterior'}
                            onChange={(e) => {
                              const next = [...photos];
                              next[idx].category = e.target.value;
                              setPhotos(next);
                            }}
                            className="text-[11px] h-7 rounded border border-input bg-background px-1.5"
                          >
                            {PHOTO_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              const next = photos.filter((_, i) => i !== idx);
                              setPhotos(next);
                              if (primaryImageUrl === p.url) {
                                setPrimaryImageUrl(next[0]?.url || '');
                              }
                            }}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded"
                            title="Remove photo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const next = photos.map((item, i) => ({
                              ...item,
                              isPrimary: i === idx,
                            }));
                            setPhotos(next);
                            setPrimaryImageUrl(p.url);
                          }}
                          className={`w-full text-center py-1 rounded text-[11px] font-medium border ${
                            p.isPrimary || primaryImageUrl === p.url
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted'
                          }`}
                        >
                          {p.isPrimary || primaryImageUrl === p.url ? '★ Primary Cover' : 'Set as Primary'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Reference Parking Plan PDF */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">11. Reference Parking Plan / Blueprint PDF (Optional)</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Upload an architectural layout, AutoCAD export, or marked floor plan PDF to assist the Administrator in drafting the official 2D layout.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {parkingPlanPdf ? (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground truncate max-w-xs">{parkingPlanPdf.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {(parkingPlanPdf.fileSize / (1024 * 1024)).toFixed(2)} MB &bull; Uploaded for layout reference
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setParkingPlanPdf(null)}
                      className="text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-border/80 rounded-xl text-center hover:border-primary/50 transition-colors bg-muted/10">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-foreground">Attach Architectural Plan PDF</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Max 1 PDF document up to 10MB.
                  </p>
                  <div className="mt-4">
                    <input
                      type="file"
                      id="pdfUpload"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      disabled={isUploadingPdf}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingPdf}
                      asChild
                      className="cursor-pointer text-xs"
                    >
                      <label htmlFor="pdfUpload">
                        {isUploadingPdf ? 'Uploading PDF...' : 'Select PDF File'}
                      </label>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 5: REVIEW, SURVEY NOTES & FINAL SUBMIT                                */}
        {/* ========================================================================= */}
        <TabsContent value="review" className="space-y-6 focus-visible:outline-none">
          {/* Card 1: Additional Survey Guidance */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">12. Survey Guidance &amp; Subject Notes</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Provide custom instructions or reference notes for the Administrator conducting the review.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="submissionSubject" className="text-sm font-medium">Submission Subject Line</Label>
                  <Input
                    id="submissionSubject"
                    placeholder="e.g. Commercial Facility Setup Proposal — Downtown Plaza"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="surveyGuidance" className="text-sm font-medium">
                    Additional Survey Guidance &amp; Layout Notes
                  </Label>
                  <Textarea
                    id="surveyGuidance"
                    placeholder="Mention specific physical boundary details, boom barriers, height clearance variations, or preferred 2D layout orientation..."
                    value={additionalDescription}
                    onChange={(e) => setAdditionalDescription(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Pre-Submission Readiness Checklist */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base font-semibold">13. Pre-Submission Readiness Checklist</CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={
                    isReadyToSubmit
                      ? 'border-emerald-600/30 text-emerald-600 bg-emerald-600/5 text-xs font-medium'
                      : 'border-amber-500/40 text-amber-600 bg-amber-500/5 text-xs font-medium'
                  }
                >
                  {isReadyToSubmit ? 'All Requirements Met ✓' : 'Requirements Pending ✗'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Verify each prerequisite before submitting your proposal for Administrator review.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Name */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                    readiness.hasName ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground' : 'bg-destructive/5 border-destructive/20 text-destructive'
                  }`}
                >
                  <span className="font-medium">Facility Name &amp; Contact:</span>
                  <span className="font-semibold">{readiness.hasName ? '✓ Complete' : '✗ Name Missing'}</span>
                </div>

                {/* 2. Map Pin */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                    readiness.hasPinConfirmed ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground' : 'bg-destructive/5 border-destructive/20 text-destructive'
                  }`}
                >
                  <span className="font-medium">Interactive Map Location:</span>
                  <span className="font-semibold">{readiness.hasPinConfirmed ? '✓ Pin Confirmed' : '✗ Pin Not Confirmed'}</span>
                </div>

                {/* 3. Capacity */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                    readiness.hasCapacity ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground' : 'bg-destructive/5 border-destructive/20 text-destructive'
                  }`}
                >
                  <span className="font-medium">Total Capacity ({totalCapacity} slots):</span>
                  <span className="font-semibold">{readiness.hasCapacity ? '✓ Valid' : '✗ Minimum 1 Slot'}</span>
                </div>

                {/* 4. Floor Match */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
                    readiness.isFloorMatching ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground' : 'bg-destructive/5 border-destructive/20 text-destructive'
                  }`}
                >
                  <span className="font-medium">Floor Slots Sum ({floorSlotSum} / {totalCapacity}):</span>
                  <span className="font-semibold">{readiness.isFloorMatching ? '✓ Balanced' : '✗ Mismatched Totals'}</span>
                </div>

                {/* 5. Zone Match */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between sm:col-span-2 ${
                    readiness.areZonesMatchingFloors ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground' : 'bg-destructive/5 border-destructive/20 text-destructive'
                  }`}
                >
                  <span className="font-medium">Zone Allocation Match:</span>
                  <span className="font-semibold">{readiness.areZonesMatchingFloors ? '✓ Balanced Per Floor' : `✗ ${floorZoneMismatches.length} Floor(s) Mismatched`}</span>
                </div>

                {/* 6. Photos */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between sm:col-span-2 ${
                    readiness.hasPhotos ? 'bg-emerald-500/5 border-emerald-500/20 text-foreground' : 'bg-destructive/5 border-destructive/20 text-destructive'
                  }`}
                >
                  <span className="font-medium">Facility Photographs ({photos.length} uploaded):</span>
                  <span className="font-semibold">{readiness.hasPhotos ? '✓ Verified' : '✗ At Least 1 Photo Required'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Executive Summary Review */}
          <Card className="border border-border/80 bg-card shadow-xs rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border/50 pb-4 px-6 pt-5">
              <CardTitle className="text-base font-semibold">14. Executive Proposal Summary</CardTitle>
              <CardDescription className="text-xs">
                Review the consolidated summary before final submission.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/20 border border-border/60">
                <div>
                  <span className="text-muted-foreground">Facility Name:</span>
                  <p className="font-bold text-foreground text-sm mt-0.5">{facilityName || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Facility Type:</span>
                  <p className="font-semibold text-foreground mt-0.5">{facilityType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Capacity:</span>
                  <p className="font-bold text-primary text-sm mt-0.5">{totalCapacity} Slots</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Floors / Levels:</span>
                  <p className="font-semibold text-foreground mt-0.5">{floors.length} Floors</p>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-muted-foreground">Premises Address:</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {[addressLine1, addressLine2, areaLocality, city, state, postalCode].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-muted-foreground">Schedule &amp; Tariff:</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {isOpen24x7 ? 'Open 24×7' : `${openingTime} to ${closingTime}`} &bull; Car: ₹{carHourlyRate}/hr, SUV: ₹{suvHourlyRate}/hr, Bike: ₹{bikeHourlyRate}/hr
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                {isSubmittedOrUnderReview ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-6 gap-2 shadow-md cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Updating...' : 'Save Changes & Notify Admin'}
                  </Button>
                ) : isApproved ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => navigate(`/owner/parking/submissions/${submissionId || editSubmissionId}`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 gap-2 shadow-md cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    View Approved Details
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={handleInitiateSubmit}
                    disabled={isSubmitting || !isReadyToSubmit}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm px-6 gap-2 shadow-md cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    {isSubmitting ? 'Submitting Proposal...' : 'Submit for Administrator Review'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* BOTTOM STEPPER NAVIGATION BAR                                             */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card shadow-xs mt-8">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {currentStepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToPrevStep}
                className="gap-1.5 text-xs font-medium"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous Step
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                asChild
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Link to="/owner/dashboard" className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Cancel &amp; Return
                </Link>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {isSubmittedOrUnderReview ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isSubmitting || isDeleting}
                className="gap-1.5 text-xs font-semibold text-primary border-primary/40 bg-primary/5 hover:bg-primary/10 shadow-xs"
                aria-label="Save changes and notify administrators"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Updating...' : 'Save Changes & Notify Admin'}
              </Button>
            ) : !isApproved && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isSubmitting || isDeleting}
                className="gap-1.5 text-xs font-medium"
                aria-label="Save current progress as a draft"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
            )}

            {currentStepIndex < FORM_STEPS.length - 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={goToNextStep}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-semibold shadow-xs"
              >
                Next Step
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : isSubmittedOrUnderReview ? (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Save className="h-3.5 w-3.5" />
                Save Changes &amp; Notify Admin
              </Button>
            ) : isApproved ? (
              <Button
                type="button"
                size="sm"
                onClick={() => navigate(`/owner/parking/submissions/${submissionId || editSubmissionId}`)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                View Submission Details
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleInitiateSubmit}
                disabled={isSubmitting || isDeleting || !isReadyToSubmit}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                Submit for Review
              </Button>
            )}
          </div>
        </div>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL 1: SUBMISSION PREVIEW DIALOG                                        */}
      {/* ========================================================================= */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Facility Submission Preview</DialogTitle>
            <DialogDescription className="text-xs">
              Review all preliminary survey details before final dispatch to the platform administrator.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs py-2">
            <div className="grid grid-cols-2 gap-3 border-b pb-3">
              <div>
                <span className="text-muted-foreground">Facility Name:</span>
                <p className="font-semibold text-foreground text-sm">{facilityName || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Facility Type:</span>
                <p className="font-semibold text-foreground">{facilityType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Location Pin:</span>
                <p className="font-semibold text-foreground">
                  {locationConfirmed ? 'Confirmed Marker ✓' : 'Pending Marker Confirmation ✗'} ({latitude.toFixed(4)}, {longitude.toFixed(4)})
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Capacity:</span>
                <p className="font-semibold text-foreground">{totalCapacity} Slots</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Address:</span>
                <p className="font-semibold text-foreground">
                  {[addressLine1, addressLine2, areaLocality, city, state, postalCode].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            </div>

            <div className="border-b pb-3 space-y-1">
              <span className="text-muted-foreground">Floors ({floors.length}):</span>
              <p className="font-semibold text-foreground">
                {floors.map((f) => `${f.floorName} (${f.slotCount} bays)`).join(', ')}
              </p>
            </div>

            <div className="border-b pb-3 space-y-1">
              <span className="text-muted-foreground">Operating Schedule &amp; Tariff:</span>
              <p className="font-semibold text-foreground">
                {isOpen24x7 ? 'Open 24×7' : `${openingTime} to ${closingTime}`} &bull; Car: ₹{carHourlyRate}/hr, SUV: ₹{suvHourlyRate}/hr, Bike: ₹{bikeHourlyRate}/hr
              </p>
            </div>

            <div className="border-b pb-3 space-y-1">
              <span className="text-muted-foreground">Uploaded Photos &amp; Blueprint Plan:</span>
              <p className="font-semibold text-foreground">
                {photos.length} photograph(s) attached &bull; {parkingPlanPdf ? `PDF: ${parkingPlanPdf.fileName}` : 'No reference PDF'}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)} className="text-xs">
              Close Preview
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPreviewOpen(false);
                handleInitiateSubmit();
              }}
              className="bg-primary text-primary-foreground text-xs font-semibold"
            >
              Proceed to Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: FINAL SUBMISSION CONFIRMATION                                    */}
      {/* ========================================================================= */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Send className="h-4 w-4 text-primary" />
              Confirm Review Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
              Are you sure you want to submit <strong>{facilityName || 'this facility'}</strong> for Administrator review?
              <br /><br />
              Once submitted, your proposal will enter the administrative survey and 2D layout planning queue. An automated confirmation email will be sent to <strong>{contactEmail || user?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmSubmitOpen(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              {isSubmitting ? 'Submitting...' : 'Yes, Submit for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE DRAFT CONFIRMATION                                        */}
      {/* ========================================================================= */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete Draft Facility Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
              Are you sure you want to permanently delete this draft
              {facilityName ? (
                <>
                  {' '}for <strong>&ldquo;{facilityName}&rdquo;</strong>
                </>
              ) : null}?
              <br /><br />
              All entered preliminary details, layout breakdowns, and attached media will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteDraft}
              disabled={isDeleting}
              className="text-xs font-semibold gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? 'Deleting...' : 'Yes, Delete Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
