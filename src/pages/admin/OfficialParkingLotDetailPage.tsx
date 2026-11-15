import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Layers,
  MapPin,
  Car,
  Info,
  ArrowLeft,
  QrCode,
  Eye,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
} from 'lucide-react';
import {
  getOfficialParkingLotHierarchy,
  getFloorLayout,
  initDraftLayout,
  validateDraftLayout,
  type OfficialParkingLotHierarchy,
  type OfficialHierarchySlot,
  type FloorLayoutResponse,
} from '@/api/parkingLot.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const OfficialParkingLotDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [hierarchy, setHierarchy] = useState<OfficialParkingLotHierarchy | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected floor tab for focused viewing
  const [selectedFloorId, setSelectedFloorId] = useState<string>('ALL');

  // Selected slot for inspector modal
  const [selectedSlot, setSelectedSlot] = useState<{
    slot: OfficialHierarchySlot;
    floorName: string;
    zoneName: string;
    zoneCode: string;
  } | null>(null);

  // 2D Layout Foundation Inspector modal
  const [layoutFloor, setLayoutFloor] = useState<{ floorId: string; floorName: string } | null>(null);
  const [layoutData, setLayoutData] = useState<FloorLayoutResponse | null>(null);
  const [layoutLoading, setLayoutLoading] = useState<boolean>(false);
  const [layoutActionLoading, setLayoutActionLoading] = useState<boolean>(false);
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null);

  const fetchLayout = async (floorId: string) => {
    if (!id) return;
    try {
      setLayoutLoading(true);
      setLayoutMessage(null);
      const res = await getFloorLayout(id, floorId);
      if (res.success && res.data) {
        setLayoutData(res.data);
      }
    } catch (err: any) {
      setLayoutMessage(err?.response?.data?.message || 'Failed to fetch floor layout.');
    } finally {
      setLayoutLoading(false);
    }
  };

  const handleOpenLayoutModal = (floorId: string, floorName: string) => {
    setLayoutFloor({ floorId, floorName });
    setLayoutData(null);
    void fetchLayout(floorId);
  };

  const handleInitDraft = async () => {
    if (!id || !layoutFloor) return;
    try {
      setLayoutActionLoading(true);
      setLayoutMessage(null);
      const res = await initDraftLayout(id, layoutFloor.floorId);
      if (res.success) {
        setLayoutMessage(res.message || 'Draft initialized.');
        await fetchLayout(layoutFloor.floorId);
      }
    } catch (err: any) {
      setLayoutMessage(err?.response?.data?.message || 'Failed to initialize draft layout.');
    } finally {
      setLayoutActionLoading(false);
    }
  };

  const handleValidateDraft = async () => {
    if (!id || !layoutFloor) return;
    try {
      setLayoutActionLoading(true);
      setLayoutMessage(null);
      const res = await validateDraftLayout(id, layoutFloor.floorId);
      if (res.success) {
        setLayoutMessage(res.message || 'Draft validated.');
        await fetchLayout(layoutFloor.floorId);
      }
    } catch (err: any) {
      setLayoutMessage(err?.response?.data?.message || 'Validation error.');
    } finally {
      setLayoutActionLoading(false);
    }
  };

  const loadHierarchy = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getOfficialParkingLotHierarchy(id);
      if (res.success && res.data) {
        setHierarchy(res.data);
      } else {
        setError(res.message || 'Failed to retrieve parking lot hierarchy.');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the server. Please check your network.',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadHierarchy();
  }, [loadHierarchy]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !hierarchy) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Failed to Load Parking Structure</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {error || 'Unable to retrieve parking lot records.'}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/parking-lots">Back to Parking Lots</Link>
          </Button>
          <Button size="sm" onClick={() => void loadHierarchy()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const { parkingLot, floors, stats } = hierarchy;
  const ownerInfo = typeof parkingLot.ownerId === 'object' && parkingLot.ownerId ? parkingLot.ownerId : null;
  const submissionInfo =
    typeof parkingLot.submissionId === 'object' && parkingLot.submissionId
      ? parkingLot.submissionId
      : null;

  const addressText = (() => {
    if (!parkingLot) return '';
    if (typeof parkingLot.address === 'object' && parkingLot.address !== null) {
      const parts = [
        parkingLot.address.street,
        parkingLot.address.city,
        parkingLot.address.state,
        parkingLot.address.postalCode,
      ].filter(Boolean);
      return parts.join(', ');
    }
    const parts = [
      parkingLot.address,
      parkingLot.city,
      parkingLot.state,
      parkingLot.postalCode,
    ].filter(Boolean);
    return parts.join(', ') || 'Address on file';
  })();

  const isOpen24x7 = parkingLot.operatingHours?.open24x7 ?? parkingLot.isOpen24Hours ?? false;
  const openTime = parkingLot.operatingHours?.openTime ?? parkingLot.openingTime ?? '—';
  const closeTime = parkingLot.operatingHours?.closeTime ?? parkingLot.closingTime ?? '—';

  const filteredFloors =
    selectedFloorId === 'ALL'
      ? floors
      : floors.filter((f) => f._id === selectedFloorId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. BREADCRUMB & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Link to="/admin/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <Link to="/admin/parking-lots" className="hover:text-foreground">
              Official Parking Lots
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <span className="font-semibold text-foreground">{parkingLot.parkingName}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {parkingLot.parkingName}
            </h1>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs font-semibold">
              {parkingLot.parkingStatus} (Staging)
            </Badge>
            {parkingLot.layoutReviewStatus === 'Owner Changes Requested' && (
              <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs font-semibold gap-1">
                <AlertTriangle className="h-3 w-3" />
                Owner Changes Requested
              </Badge>
            )}
            {parkingLot.layoutReviewStatus === 'Pending Owner Review' && (
              <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 text-xs font-semibold gap-1">
                <Clock className="h-3 w-3" />
                Awaiting Owner Review
              </Badge>
            )}
            {parkingLot.layoutReviewStatus === 'Owner Confirmed' && (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Owner Approved Layout
              </Badge>
            )}
            <Badge variant="outline" className="text-xs font-mono">
              {parkingLot.parkingType}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              {addressText}
            </span>
            {ownerInfo && (
              <span className="font-medium text-foreground">
                Owner: {ownerInfo.fullName} ({ownerInfo.email})
              </span>
            )}
            {submissionInfo && (
              <span className="flex items-center gap-1 text-primary">
                Source Ref: {submissionInfo.submissionReference}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/admin/parking-lots">
              <ArrowLeft className="h-4 w-4" />
              All Lots
            </Link>
          </Button>

          <Button size="sm" asChild className="gap-1.5 bg-primary text-primary-foreground shadow-xs">
            <Link to={`/admin/parking-lots/${id}/layout`}>
              <Layers className="h-4 w-4" />
              2D Layout Designer
            </Link>
          </Button>

          {submissionInfo && (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link to={`/admin/facilities/${submissionInfo._id}`}>
                <Eye className="h-4 w-4" />
                Source Submission
              </Link>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadHierarchy()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* REVISION REQUESTED NOTIFICATION BANNER */}
      {parkingLot.layoutReviewStatus === 'Owner Changes Requested' && parkingLot.layoutReviewNotes && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-rose-500/20 p-2 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Revisions Requested by Owner{parkingLot.layoutReviewFloorName ? ` for ${parkingLot.layoutReviewFloorName}` : ''}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                "{parkingLot.layoutReviewNotes}"
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 text-xs font-semibold shrink-0">
            <Link to={`/admin/parking-lots/${id}/layout${parkingLot.layoutReviewFloorId ? `?floorId=${parkingLot.layoutReviewFloorId}` : ''}`}>
              <Layers className="h-3.5 w-3.5" />
              Open 2D Designer to Revise
            </Link>
          </Button>
        </div>
      )}

      {/* 2. INACTIVE STAGING NOTIFICATION BANNER */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
          <Info className="h-5 w-5 shrink-0" />
          Official Parking Lot Structure — Staging State (Inactive)
        </div>
        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          This parking lot and its full hierarchy (<strong>{stats.totalFloors} Floor{stats.totalFloors === 1 ? '' : 's'}</strong>,{' '}
          <strong>{stats.totalZones} Zone{stats.totalZones === 1 ? '' : 's'}</strong>,{' '}
          <strong>{stats.totalSlots} Slots</strong>) have been officially established from approved Owner Facility Submission{' '}
          {submissionInfo ? `"${submissionInfo.submissionReference}"` : ''}.
          The lot remains strictly <strong>Inactive</strong>. Visual 2D layout design and customer booking activation take place in subsequent administrative milestones.
        </p>
      </div>

      {/* 3. STRUCTURE METRICS CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Floors
            </span>
            <div className="text-2xl font-extrabold text-foreground">{stats.totalFloors}</div>
            <p className="text-[10px] text-muted-foreground">Multi-level hierarchy</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Zones
            </span>
            <div className="text-2xl font-extrabold text-foreground">{stats.totalZones}</div>
            <p className="text-[10px] text-muted-foreground">Floor subdivisions</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
              Total Slots
            </span>
            <div className="text-2xl font-extrabold text-primary">{stats.totalSlots}</div>
            <p className="text-[10px] text-muted-foreground">Mapped parking inventory</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Available Slots
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats.availableSlots}
            </div>
            <p className="text-[10px] text-muted-foreground">Ready for booking upon activation</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Pricing Model
            </span>
            <div className="text-lg font-bold text-foreground">{parkingLot.pricingModel || 'Hourly'}</div>
            <p className="text-[10px] text-muted-foreground">₹{parkingLot.hourlyRate ?? 0}/hour rate</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Operating Hours
            </span>
            <div className="text-sm font-bold text-foreground">
              {isOpen24x7 ? '24 x 7 Open' : `${openTime} - ${closeTime}`}
            </div>
            <p className="text-[10px] text-muted-foreground">Standard schedule</p>
          </CardContent>
        </Card>
      </div>

      {/* 4. FLOOR SELECTOR / FILTER */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Structural Hierarchy (Lot → Floors → Zones → Slots)
          </h2>
        </div>

        {floors.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={selectedFloorId === 'ALL' ? 'default' : 'outline'}
              onClick={() => setSelectedFloorId('ALL')}
              className="text-xs h-8"
            >
              All Floors ({floors.length})
            </Button>
            {floors.map((floor) => (
              <Button
                key={floor._id}
                size="sm"
                variant={selectedFloorId === floor._id ? 'default' : 'outline'}
                onClick={() => setSelectedFloorId(floor._id)}
                className="text-xs h-8"
              >
                {floor.floorName} ({floor.totalSlots} slots)
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* 5. FLOORS & ZONES TREE DISPLAY */}
      <div className="space-y-6">
        {filteredFloors.map((floor) => {
          const isFloorChangesRequested =
            parkingLot.layoutReviewStatus === 'Owner Changes Requested' &&
            (parkingLot.layoutReviewFloorId === floor._id ||
              parkingLot.layoutReviewFloorName === floor.floorName ||
              (!parkingLot.layoutReviewFloorId && !parkingLot.layoutReviewFloorName));

          return (
            <Card key={floor._id} className="border-border/80 bg-card overflow-hidden shadow-xs">
              <CardHeader className="bg-muted/30 border-b border-border/40 py-3.5 px-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                      {floor.floorNumber}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-foreground">
                        {floor.floorName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Floor Level: {floor.floorNumber} • {floor.totalZones} Zone{floor.totalZones === 1 ? '' : 's'} •{' '}
                        {floor.totalSlots} Total Slots
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {isFloorChangesRequested && (
                      <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs font-semibold gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Revisions Requested
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs font-semibold">
                      Status: {floor.floorStatus}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 border-border/80 hover:bg-muted text-foreground cursor-pointer"
                      onClick={() => handleOpenLayoutModal(floor._id, floor.floorName)}
                      title="Quick status and metadata inspector"
                    >
                      <Info className="h-3.5 w-3.5" />
                      Status
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className={`h-7 text-xs gap-1.5 shadow-xs cursor-pointer ${
                        isFloorChangesRequested
                          ? 'bg-rose-600 hover:bg-rose-700 text-white font-semibold'
                          : 'bg-primary text-primary-foreground'
                      }`}
                      asChild
                    >
                      <Link to={`/admin/parking-lots/${id}/layout?floorId=${floor._id}`}>
                        <Layers className="h-3.5 w-3.5" />
                        {isFloorChangesRequested ? 'Revise 2D Layout' : 'Design 2D Layout'}
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isFloorChangesRequested && parkingLot.layoutReviewNotes && (
                <div className="mx-5 my-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-700 dark:text-rose-300">
                        Owner Feedback for this floor:
                      </span>{' '}
                      <span className="italic font-medium">"{parkingLot.layoutReviewNotes}"</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 gap-1.5 shrink-0"
                    asChild
                  >
                    <Link to={`/admin/parking-lots/${id}/layout?floorId=${floor._id}`}>
                      <Layers className="h-3.5 w-3.5" />
                      Revise Floor in Designer
                    </Link>
                  </Button>
                </div>
              )}

              <CardContent className="p-5 space-y-6">
              {floor.zones.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No zones declared for this floor.</p>
              ) : (
                floor.zones.map((zone) => (
                  <div
                    key={zone._id}
                    className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-3"
                  >
                    {/* Zone Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 font-mono text-xs font-bold text-primary">
                          {zone.zoneCode}
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{zone.zoneName}</h4>
                        {zone.vehicleType && (
                          <Badge variant="secondary" className="text-[10px]">
                            {zone.vehicleType}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{zone.totalSlots}</span> Slots Total
                        <span>•</span>
                        <span className="text-emerald-600 font-medium">
                          {zone.availableSlots} Available
                        </span>
                      </div>
                    </div>

                    {/* Slots Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 pt-1">
                      {zone.slots.map((slot) => {
                        return (
                          <button
                            key={slot._id}
                            type="button"
                            onClick={() =>
                              setSelectedSlot({
                                slot,
                                floorName: floor.floorName,
                                zoneName: zone.zoneName,
                                zoneCode: zone.zoneCode,
                              })
                            }
                            className="group flex flex-col p-2 rounded-md border border-border/70 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-primary"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-mono text-xs font-bold text-foreground group-hover:text-primary">
                                {slot.slotNumber}
                              </span>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </div>

                            <span className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {slot.slotType}
                            </span>

                            <div className="flex items-center justify-between text-[9px] text-muted-foreground/80 mt-1.5 pt-1 border-t border-border/40">
                              <span>{slot.supportedVehicleType}</span>
                              <QrCode className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 group-hover:text-primary" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
      </div>

      {/* 6. SLOT INSPECTOR MODAL */}
      {selectedSlot && (
        <Dialog open={Boolean(selectedSlot)} onOpenChange={() => setSelectedSlot(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <Car className="h-5 w-5 text-primary" />
                Slot Details: {selectedSlot.slot.slotNumber}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Authoritative platform slot record in official parking lot hierarchy.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-2">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Slot Number:</span>
                  <span className="font-mono font-bold text-foreground">{selectedSlot.slot.slotNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Slot Label:</span>
                  <span className="font-medium text-foreground">{selectedSlot.slot.slotLabel}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Floor:</span>
                  <span className="font-medium text-foreground">{selectedSlot.floorName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Zone:</span>
                  <span className="font-medium text-foreground">
                    {selectedSlot.zoneName} ({selectedSlot.zoneCode})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Slot Type:</span>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedSlot.slot.slotType}
                  </Badge>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Vehicle Compatibility:</span>
                  <span className="font-medium text-foreground">
                    {selectedSlot.slot.supportedVehicleType}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-[10px] font-semibold">
                    {selectedSlot.slot.slotStatus}
                  </Badge>
                </div>
                <div className="space-y-1 pt-1">
                  <span className="text-muted-foreground block text-[11px]">Unique QR Identifier:</span>
                  <span className="font-mono text-[11px] font-semibold text-primary block break-all bg-card p-2 rounded border border-border/60">
                    {selectedSlot.slot.qrIdentifier}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedSlot(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 2D LAYOUT FOUNDATION INSPECTOR MODAL */}
      {layoutFloor && (
        <Dialog open={Boolean(layoutFloor)} onOpenChange={() => setLayoutFloor(null)}>
          <DialogContent className="max-w-2xl bg-card border-border/80 text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Layers className="h-5 w-5 text-primary" />
                2D Parking Layout Foundation &mdash; {layoutFloor.floorName}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Backend architecture verification for official floor layout persistency, versioning, and slot associations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {layoutLoading ? (
                <div className="flex items-center justify-center p-8 space-x-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading floor layout metadata...</span>
                </div>
              ) : layoutData ? (
                <div className="space-y-3">
                  {layoutMessage && (
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary font-medium text-xs">
                      {layoutMessage}
                    </div>
                  )}

                  {/* Layout Status Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Status</span>
                      <span className="text-sm font-bold text-primary">
                        {layoutData.layout?.status || 'No Layout'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Version</span>
                      <span className="text-sm font-bold font-mono">
                        v{layoutData.layout?.version ?? 0}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Validated</span>
                      <span className={`text-sm font-bold ${layoutData.layout?.isValidated ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {layoutData.layout?.isValidated ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Published</span>
                      <span className={`text-sm font-bold ${layoutData.layout?.isPublished ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {layoutData.layout?.isPublished ? 'Active' : 'Unpublished'}
                      </span>
                    </div>
                  </div>

                  {/* Element Statistics */}
                  {layoutData.layout && (
                    <div className="p-3 rounded-lg bg-muted/20 border border-border/60 space-y-2">
                      <h4 className="font-semibold text-foreground text-xs">Elements on Canvas</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>Slots Placed: <strong>{layoutData.layout.stats?.placedSlotsCount ?? 0}</strong> / {layoutData.totalFloorSlots ?? 0}</div>
                        <div>Driving Lanes: <strong>{layoutData.layout.stats?.lanesCount ?? 0}</strong></div>
                        <div>Entrances: <strong>{layoutData.layout.stats?.entrancesCount ?? 0}</strong></div>
                        <div>Exits: <strong>{layoutData.layout.stats?.exitsCount ?? 0}</strong></div>
                        <div>Pillars: <strong>{layoutData.layout.stats?.pillarsCount ?? 0}</strong></div>
                        <div>Walls: <strong>{layoutData.layout.stats?.wallsCount ?? 0}</strong></div>
                        <div>Canvas Size: <strong>{layoutData.layout.canvasConfig?.width ?? 1600} x {layoutData.layout.canvasConfig?.height ?? 1000}</strong></div>
                        <div>Grid Size: <strong>{layoutData.layout.canvasConfig?.gridSize ?? 20} units</strong></div>
                      </div>
                    </div>
                  )}

                  {/* Validation errors if any */}
                  {layoutData.layout?.validationErrors && layoutData.layout.validationErrors.length > 0 && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <ShieldAlert className="h-4 w-4" />
                        <span>Validation Issues:</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                        {layoutData.layout.validationErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-muted/10 border border-border/40 text-[11px] text-muted-foreground">
                    Phase 1 establishes the verified backend foundation (Express routes, models, validators, coordinate system, slot integrity, and lifecycle). The complete interactive visual canvas editor will be rendered here in Phase 2.
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No layout data retrieved.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleInitDraft}
                  disabled={layoutActionLoading || layoutLoading}
                  className="text-xs h-8"
                >
                  {layoutActionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Initialize / Sync Draft
                </Button>
                {layoutData?.layout && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleValidateDraft}
                    disabled={layoutActionLoading || layoutLoading}
                    className="text-xs h-8"
                  >
                    Validate Layout
                  </Button>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => setLayoutFloor(null)} className="text-xs h-8">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
