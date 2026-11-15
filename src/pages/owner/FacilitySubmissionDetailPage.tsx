import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Car,
  Layers,
  Sparkles,
  Clock,
  FileText,
  ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Edit3,
  Calendar,
  ShieldCheck,
  Download,
  AlertCircle,
  Grid3X3,
  Info,
  Lock,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getSubmissionById,
  deleteDraftSubmission,
  fetchSubmissionFileBlob,
  type FacilitySubmissionData,
} from '@/api/facilitySubmission.api';
import { AuthenticatedImage } from '@/components/common/AuthenticatedImage';
import { getSocket } from '@/lib/socket';

export const FacilitySubmissionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<FacilitySubmissionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteDraft = async () => {
    if (!submission?._id) return;
    setIsDeleting(true);
    try {
      await deleteDraftSubmission(submission._id);
      toast.success('Draft parking facility submission deleted successfully.');
      setDeleteDialogOpen(false);
      navigate('/owner/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete draft submission.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchDetail = useCallback(async (isManual = false) => {
    if (!id) return;
    try {
      if (isManual) {
        setIsRefreshing(true);
      }
      const data = await getSubmissionById(id);
      setSubmission(data);
      if (isManual) {
        toast.success('Facility submission status updated.');
      }
    } catch (err: unknown) {
      if (isManual) {
        const msg = err instanceof Error ? err.message : 'Failed to refresh submission';
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  // Real-time Socket.io listener + Window focus & visibility listener + Polling
  useEffect(() => {
    if (!id) return;

    // 1. WebSocket listener
    const socket = getSocket();
    socket.emit('join_submission', id);

    const handleStatusChanged = (payload: { submissionId: string; status: string }) => {
      if (payload.submissionId === id) {
        void fetchDetail();
      }
    };

    socket.on('facility_status_changed', handleStatusChanged);

    // 2. Refetch on window focus or visibility change
    const onFocus = () => {
      void fetchDetail();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchDetail();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 3. Fallback smart polling interval (every 4 seconds for active review states)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchDetail();
      }
    }, 4000);

    return () => {
      socket.off('facility_status_changed', handleStatusChanged);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [id, fetchDetail]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent mx-auto" />
          <p className="text-xs text-muted-foreground">Loading facility submission...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold">Submission Not Found</h2>
        <Button asChild variant="outline">
          <Link to="/owner/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const isEditable =
    submission.submissionStatus === 'Draft' || submission.submissionStatus === 'Changes Requested';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Submitted':
        return (
          <Badge className="bg-sky-600/10 text-sky-600 border-sky-600/30">Submitted</Badge>
        );
      case 'Under Review':
        return (
          <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/30">Under Review</Badge>
        );
      case 'Changes Requested':
        return (
          <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30">
            Changes Requested
          </Badge>
        );
      case 'Approved':
        return (
          <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30">
            Approved
          </Badge>
        );
      case 'Rejected':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const isApproved = submission.submissionStatus === 'Approved';
  const hasOfficialLot = Boolean(submission.officialParkingLotId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. NAVIGATION & STATUS HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
            >
              <Link to="/owner/dashboard" className="flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                Owner Dashboard
              </Link>
            </Button>
            <span className="text-muted-foreground/40">&bull;</span>
            <Badge variant="outline" className="text-xs">
              Page 3B — Submission Details
            </Badge>
            <span className="font-mono text-xs font-semibold text-foreground">
              {submission.submissionReference}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {submission.facilityName}
            </h1>
            {getStatusBadge(submission.submissionStatus || 'Draft')}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Created:{' '}
              {submission.createdAt
                ? format(new Date(submission.createdAt), 'MMM dd, yyyy')
                : '—'}
            </span>
            {submission.submittedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Submitted: {format(new Date(submission.submittedAt), 'MMM dd, yyyy HH:mm')}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              {submission.facilityType}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchDetail(true)}
            disabled={isRefreshing || isLoading}
            className="gap-1.5 font-medium text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {submission.submissionStatus === 'Draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="gap-2 font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete draft submission"
            >
              <Trash2 className="h-4 w-4" />
              Delete Draft
            </Button>
          )}

          {isEditable && (
            <Button asChild size="sm" className="gap-2 font-semibold shadow-xs">
              <Link to={`/owner/parking/submissions/${submission._id}/edit`}>
                <Edit3 className="h-4 w-4" />
                {submission.submissionStatus === 'Changes Requested'
                  ? 'Update & Resubmit'
                  : 'Edit Draft'}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 2. LIFECYCLE FEEDBACK BANNERS */}
      {/* 2a. Under Active Review Notice */}
      {submission.submissionStatus === 'Under Review' && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
            <Clock className="h-5 w-5 animate-pulse" />
            Facility Setup Under Active Administrator Review
          </div>
          <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            An Administrator has initiated the review of your parking facility setup survey information.
            {submission.reviewedAt && (
              <span>
                {' '}Review commenced on <strong>{format(new Date(submission.reviewedAt), 'MMM dd, yyyy HH:mm')}</strong>.
              </span>
            )}
          </p>
          <p className="text-[11px] text-blue-800 dark:text-blue-300 font-medium pt-0.5">
            The platform team is evaluating your declared floors, zones, slot capacities, and photographs. You will receive an update once the review is completed.
          </p>
        </div>
      )}

      {/* 2b. Submitted Awaiting Review Notice */}
      {submission.submissionStatus === 'Submitted' && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-sm">
            <Clock className="h-5 w-5" />
            Facility Submission Received &mdash; Awaiting Administrator Review
          </div>
          <p className="text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
            Your facility setup request was submitted successfully on{' '}
            {submission.submittedAt ? format(new Date(submission.submittedAt), 'MMM dd, yyyy HH:mm') : 'recently'}.
            It is in the administrator queue and review will begin shortly.
          </p>
        </div>
      )}

      {/* 2c. Changes Requested */}
      {submission.submissionStatus === 'Changes Requested' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <AlertTriangle className="h-5 w-5" />
            Administrator Feedback &amp; Action Required
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            {submission.adminRemarks ||
              submission.requestedChanges ||
              'The administrator has reviewed your facility setup details and requested adjustments. Please click "Update & Resubmit" to modify the requested information.'}
          </p>
          <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
            <Link to={`/owner/parking/submissions/${submission._id}/edit`}>
              Make Corrections &amp; Resubmit
            </Link>
          </Button>
        </div>
      )}

      {/* 2b. Rejection Notice */}
      {submission.submissionStatus === 'Rejected' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm">
            <AlertCircle className="h-5 w-5" />
            Facility Setup Submission Rejected
          </div>
          <p className="text-xs text-destructive/90 leading-relaxed">
            {submission.rejectionReason ||
              'This facility setup request was not approved by the platform administration team.'}
          </p>
        </div>
      )}

      {/* 2c. Approved Notice */}
      {isApproved && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="h-5 w-5" />
            Facility Submission Approved
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
            Your facility setup survey information has been approved by the platform administration
            {submission.approvedAt && ` on ${format(new Date(submission.approvedAt), 'MMM dd, yyyy HH:mm')}`}.
            {submission.adminRemarks && ` Administrator remarks: "${submission.adminRemarks}".`}
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium pt-1">
            Note: Approval completes Stage 1. Official parking lot record creation, floor &amp; zone slotting, and 2D layout publication are performed separately by the platform Administrator.
          </p>
        </div>
      )}

      {/* 3. MULTI-STAGE ADMINISTRATIVE PROGRESS TRACKER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Facility Setup &amp; Structural Progress Tracker
          </h2>
          <span className="text-[11px] text-muted-foreground">Authoritative Lifecycle</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Stage 1: Submission & Review */}
          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">1. Submission Review</span>
              {getStatusBadge(submission.submissionStatus || 'Draft')}
            </div>
            <p className="text-xs font-semibold text-foreground">
              {submission.submissionStatus === 'Approved'
                ? 'Survey Approved'
                : submission.submissionStatus === 'Under Review'
                ? 'Review in Progress'
                : submission.submissionStatus === 'Changes Requested'
                ? 'Adjustments Requested'
                : submission.submissionStatus}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {submission.submissionStatus === 'Under Review' && submission.reviewedAt
                ? `Review started ${format(new Date(submission.reviewedAt), 'MMM dd, HH:mm')}`
                : submission.submittedAt
                ? `Submitted ${format(new Date(submission.submittedAt), 'MMM dd')}`
                : 'Pending submission'}
            </p>
          </div>

          {/* Stage 2: Official Parking Lot Creation */}
          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">2. Official Lot</span>
              {hasOfficialLot ? (
                <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-[10px]">Lot Created</Badge>
              ) : isApproved ? (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 text-[10px]">Pending Creation</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Awaiting Approval</Badge>
              )}
            </div>
            <p className="text-xs font-semibold text-foreground">
              {hasOfficialLot ? 'Lot Record Registered' : isApproved ? 'Pending Admin Lot Creation' : 'Not Started'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {hasOfficialLot ? 'Admin created official lot' : 'Requires admin survey'}
            </p>
          </div>

          {/* Stage 3: Floor & Slot Layout Design */}
          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">3. Layout &amp; Slots</span>
              {hasOfficialLot ? (
                <Badge variant="outline" className="text-sky-600 border-sky-600/30 text-[10px]">Configured</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Not Started</Badge>
              )}
            </div>
            <p className="text-xs font-semibold text-foreground">
              {hasOfficialLot ? '2D Layout Active' : 'Not Configured'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {hasOfficialLot ? 'Interactive visual plan ready for inspection' : 'Admin configures official slots & aisles'}
            </p>
            {hasOfficialLot && (
              <Button asChild size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <Link to={`/owner/parking-lots/${submission.officialParkingLotId}/layout`}>
                  <Eye className="h-3 w-3" />
                  Review 2D Plan
                </Link>
              </Button>
            )}
          </div>

          {/* Stage 4: Layout Publication & Activation */}
          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">4. Activation</span>
              {hasOfficialLot ? (
                <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 text-[10px]">Ready</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Inactive
                </Badge>
              )}
            </div>
            <p className="text-xs font-semibold text-foreground">
              {hasOfficialLot ? 'Owner Review & Go Live' : 'Driver Bookings Disabled'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {hasOfficialLot ? 'Confirm layout plan to unlock live operations' : 'Activated only after layout publication'}
            </p>
            {hasOfficialLot && (
              <Button asChild size="sm" className="w-full h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                <Link to={`/owner/parking-lots/${submission.officialParkingLotId}/layout`}>
                  <CheckCircle2 className="h-3 w-3" />
                  Review &amp; Go Live
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Authoritative Boundary:</strong> As a Parking Owner, your submitted floor and zone details represent survey reference data. Platform Administrators independently verify safety, establish official lots, floors, zones, slots, and 2D visual layouts before publishing and activating the facility.
          </p>
        </div>
      </div>

      {/* 4. SUBMISSION DETAILS GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: 2 Spans */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Location & Address */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Location &amp; Coordinates</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                <span className="text-muted-foreground block text-[11px] mb-0.5">
                  Complete Address:
                </span>
                <p className="font-semibold text-foreground text-sm">
                  {submission.location?.address || '—'}
                </p>
                {submission.location?.addressLine1 && (
                  <p className="text-muted-foreground text-xs mt-1">
                    {submission.location.addressLine1}
                    {submission.location.addressLine2 ? `, ${submission.location.addressLine2}` : ''}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">City:</span>
                  <p className="font-medium text-foreground">{submission.location?.city}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">State:</span>
                  <p className="font-medium text-foreground">{submission.location?.state}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">PIN Code:</span>
                  <p className="font-medium text-foreground">{submission.location?.postalCode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Map Pin:</span>
                  <p className="font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Confirmed
                  </p>
                </div>
              </div>

              <div className="text-[11px] font-mono text-muted-foreground bg-muted/40 p-2 rounded border border-border/40">
                Coordinates: {submission.location?.latitude?.toFixed(6)},{' '}
                {submission.location?.longitude?.toFixed(6)}
              </div>
            </CardContent>
          </Card>

          {/* Card: Capacity, Floors & Zones Breakdown */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Capacity &amp; Structural Breakdown</CardTitle>
                </div>
                <Badge variant="outline" className="font-bold text-xs text-primary">
                  {submission.capacity?.totalSlots} Total Slots
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7 text-center">
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase">Car</span>
                  <p className="font-bold text-sm text-foreground">
                    {submission.capacity?.breakdown?.car || 0}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase">SUV</span>
                  <p className="font-bold text-sm text-foreground">
                    {submission.capacity?.breakdown?.suv || 0}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase">Bike</span>
                  <p className="font-bold text-sm text-foreground">
                    {submission.capacity?.breakdown?.bike || 0}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase">EV</span>
                  <p className="font-bold text-sm text-foreground">
                    {submission.capacity?.breakdown?.ev || 0}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase">Accessible</span>
                  <p className="font-bold text-sm text-foreground">
                    {submission.capacity?.breakdown?.accessible || 0}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase">VIP</span>
                  <p className="font-bold text-sm text-foreground">
                    {submission.capacity?.breakdown?.vip || 0}
                  </p>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase">Other</span>
                  <p className="font-bold text-sm text-foreground">
                    {submission.capacity?.breakdown?.other || 0}
                  </p>
                </div>
              </div>

              {/* Floors List */}
              {submission.floors && submission.floors.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Submitted Floors ({submission.floors.length}):
                  </span>
                  <div className="space-y-1.5">
                    {submission.floors.map((fl, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40 text-xs"
                      >
                        <span className="font-medium text-foreground">
                          {fl.floorName} (Floor #{fl.floorNumber})
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{fl.parkingType}</span>
                          <Badge variant="secondary" className="text-[11px] font-mono">
                            {fl.slotCount} Bays
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Zones Reference List */}
              {submission.zones && submission.zones.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Grid3X3 className="h-3.5 w-3.5 text-primary" />
                    Submitted Reference Zones ({submission.zones.length}):
                  </span>
                  <div className="space-y-1.5">
                    {submission.zones.map((zn, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded bg-muted/20 border border-border/40 text-xs gap-1.5"
                      >
                        <div>
                          <span className="font-semibold text-foreground">{zn.zoneName}</span>
                          <span className="text-muted-foreground ml-2">
                            on Floor: <strong>{zn.floorName}</strong> ({zn.zoneType || 'Standard'})
                          </span>
                          {zn.description && (
                            <p className="text-[11px] text-muted-foreground/80 mt-0.5">{zn.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {zn.supportedVehicleType || 'Car'}
                          </Badge>
                          <Badge variant="secondary" className="text-[11px] font-mono">
                            {zn.slotCount} Bays
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Parking Rules & Instructions */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Parking Rules &amp; Instructions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold">General Parking Rules:</span>
                <p className="text-foreground leading-relaxed">
                  {submission.parkingRules?.rules || 'Standard parking rules apply.'}
                </p>
              </div>

              {submission.parkingRules?.entryExitInstructions && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <span className="text-muted-foreground font-semibold">Entry / Exit Instructions:</span>
                  <p className="text-foreground leading-relaxed">
                    {submission.parkingRules.entryExitInstructions}
                  </p>
                </div>
              )}

              {submission.parkingRules?.vehicleRestrictions && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <span className="text-muted-foreground font-semibold">Vehicle Restrictions:</span>
                  <p className="text-foreground leading-relaxed">
                    {submission.parkingRules.vehicleRestrictions}
                  </p>
                </div>
              )}

              {submission.parkingRules?.heightWeightRestrictions && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <span className="text-muted-foreground font-semibold">Height &amp; Weight Limits:</span>
                  <p className="text-foreground leading-relaxed">
                    {submission.parkingRules.heightWeightRestrictions}
                  </p>
                </div>
              )}

              {submission.parkingRules?.evRules && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <span className="text-muted-foreground font-semibold">EV Charging Bay Rules:</span>
                  <p className="text-foreground leading-relaxed">
                    {submission.parkingRules.evRules}
                  </p>
                </div>
              )}

              {submission.parkingRules?.overnightRules && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <span className="text-muted-foreground font-semibold">Overnight Parking Policy:</span>
                  <p className="text-foreground leading-relaxed">
                    {submission.parkingRules.overnightRules}
                  </p>
                </div>
              )}

              {submission.parkingRules?.otherInstructions && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <span className="text-muted-foreground font-semibold">Other Instructions:</span>
                  <p className="text-foreground leading-relaxed">
                    {submission.parkingRules.otherInstructions}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Photographs */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Submitted Photographs</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  {submission.photos?.length || 0} Photos
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {submission.photos && submission.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {submission.photos.map((ph, idx) => {
                    const isPrimary = ph.url === submission.primaryImageUrl || ph.isPrimary;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg border overflow-hidden bg-muted/40 ${
                          isPrimary ? 'ring-2 ring-primary border-primary' : 'border-border/60'
                        }`}
                      >
                        <div className="h-28 w-full bg-muted/60 overflow-hidden">
                          <AuthenticatedImage
                            src={ph.url}
                            alt={ph.caption || 'Facility Photo'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="p-2 flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground truncate">{ph.category}</span>
                          {isPrimary && (
                            <Badge className="bg-primary/10 text-primary border-primary/30 text-[9px] px-1 py-0">
                              Primary
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No photos attached.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: 1 Span */}
        <div className="space-y-6">
          {/* Card: Operating & Pricing */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Operating &amp; Tariff</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground">Schedule:</span>
                <p className="font-bold text-foreground">
                  {submission.operatingInfo?.isOpen24x7
                    ? 'Open 24×7'
                    : `${submission.operatingInfo?.openingTime || '—'} to ${submission.operatingInfo?.closingTime || '—'}`}
                </p>
              </div>

              {/* Day Schedules Table if available */}
              {submission.operatingInfo?.dailySchedules &&
                submission.operatingInfo.dailySchedules.length > 0 && (
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    <span className="text-muted-foreground block font-semibold">Weekly Hours:</span>
                    <div className="space-y-1">
                      {submission.operatingInfo.dailySchedules.map((ds, idx) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">{ds.day}</span>
                          <span className="font-medium text-foreground">
                            {ds.isOpen ? `${ds.openingTime || '—'} - ${ds.closingTime || '—'}` : 'Closed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="border-t border-border/60 pt-3 space-y-2">
                <span className="text-muted-foreground block font-semibold">Standard Rates:</span>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Car Hourly:</span>
                  <span className="font-bold text-foreground">
                    ₹{submission.pricing?.carHourlyRate}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SUV Hourly:</span>
                  <span className="font-bold text-foreground">
                    ₹{submission.pricing?.suvHourlyRate}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bike Hourly:</span>
                  <span className="font-bold text-foreground">
                    ₹{submission.pricing?.bikeHourlyRate}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EV Hourly:</span>
                  <span className="font-bold text-foreground">
                    ₹{submission.pricing?.evChargingRatePerHour || 0}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other Hourly:</span>
                  <span className="font-bold text-foreground">
                    ₹{submission.pricing?.otherHourlyRate || 0}/hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Full Day Flat:</span>
                  <span className="font-bold text-foreground">
                    ₹{submission.pricing?.dailyRate || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overnight Flat:</span>
                  <span className="font-bold text-foreground">
                    ₹{submission.pricing?.overnightRate || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grace Period:</span>
                  <span className="font-medium text-foreground">
                    {submission.pricing?.gracePeriodMinutes ?? 15} mins
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Duration:</span>
                  <span className="font-medium text-foreground">
                    {submission.pricing?.minParkingDurationHours ?? 1} hr
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Duration:</span>
                  <span className="font-medium text-foreground">
                    {submission.pricing?.maxParkingDurationHours ?? 24} hrs
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Amenities */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Selected Amenities</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {submission.amenities && submission.amenities.length > 0 ? (
                  submission.amenities.map((am) => (
                    <Badge key={am} variant="secondary" className="text-[11px]">
                      {am}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No amenities specified</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card: Reference Plan PDF */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Reference Parking Plan</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {submission.parkingPlanPdf ? (
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                  <p className="font-semibold text-foreground truncate">
                    {submission.parkingPlanPdf.fileName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(submission.parkingPlanPdf.fileSize / (1024 * 1024)).toFixed(2)} MB &bull;
                    Administrator survey guide
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 mt-1 cursor-pointer"
                    onClick={async () => {
                      try {
                        const filename = submission.parkingPlanPdf!.url.split('/').pop();
                        if (!filename) return;
                        const blob = await fetchSubmissionFileBlob(filename);
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                      } catch {
                        toast.error('Failed to open PDF reference.');
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> View Reference PDF
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No reference PDF uploaded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL: DELETE DRAFT CONFIRMATION */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete Draft Facility Submission
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
              Are you sure you want to permanently delete this draft
              {submission.facilityName ? (
                <>
                  {' '}for <strong>&ldquo;{submission.facilityName}&rdquo;</strong>
                </>
              ) : null}?
              <br /><br />
              All entered details, floor/zone breakdowns, and uploaded media will be permanently deleted. This action cannot be undone.
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
