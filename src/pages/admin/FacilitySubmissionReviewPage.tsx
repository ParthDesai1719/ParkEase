import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Car,
  Layers,
  Sparkles,
  Clock,
  Eye,
  FileText,
  ImageIcon,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Download,
  Grid3X3,
  Info,
  Lock,
  User,
  XCircle,
  PlayCircle,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Save,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  getAdminFacilitySubmissionById,
  startAdminFacilityReview,
  requestAdminFacilityChanges,
  approveAdminFacilitySubmission,
  rejectAdminFacilitySubmission,
  updateAdminFacilityRemarks,
  fetchAdminFacilityFileBlob,
  type AdminFacilitySubmissionItem,
} from '@/api/admin.api';
import { createOfficialParkingLot } from '@/api/parkingLot.api';
import { AuthenticatedImage } from '@/components/common/AuthenticatedImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export const FacilitySubmissionReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [submission, setSubmission] = useState<AdminFacilitySubmissionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Remarks state
  const [remarks, setRemarks] = useState('');
  const [isSavingRemarks, setIsSavingRemarks] = useState(false);

  // Action Dialog States
  const [actionLoading, setActionLoading] = useState(false);
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [changeRemarks, setChangeRemarks] = useState('');

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');

  // Official Parking Lot Creation Modal
  const [isCreateLotModalOpen, setIsCreateLotModalOpen] = useState(false);
  const [isCreatingLot, setIsCreatingLot] = useState(false);

  // Image Inspection Modal
  const [inspectingPhoto, setInspectingPhoto] = useState<{
    url: string;
    caption?: string;
    category?: string;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminFacilitySubmissionById(id);
      if (res.success && res.data) {
        setSubmission(res.data);
        setRemarks(res.data.adminRemarks || '');
      } else {
        setError(res.message || 'Facility submission not found.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error connecting to the server.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isSubscribed = true;
    if (!id) return;

    const fetchInitial = async () => {
      try {
        const res = await getAdminFacilitySubmissionById(id);
        if (isSubscribed && res.success && res.data) {
          setSubmission(res.data);
          setRemarks(res.data.adminRemarks || '');
          setError(null);
        } else if (isSubscribed) {
          setError(res.message || 'Facility submission not found.');
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Error connecting to the server.');
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    void fetchInitial();

    return () => {
      isSubscribed = false;
    };
  }, [id]);

  // Action Handlers
  const handleStartReview = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const res = await startAdminFacilityReview(id);
      if (res.success && res.data) {
        setSubmission(res.data);
        toast.success('Facility submission review initiated successfully.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start review.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!id) return;
    if (!changeRemarks.trim() || changeRemarks.trim().length < 5) {
      toast.error('Please enter specific remarks explaining the required changes (min 5 characters).');
      return;
    }

    try {
      setActionLoading(true);
      const res = await requestAdminFacilityChanges(id, changeRemarks.trim());
      if (res.success && res.data) {
        setSubmission(res.data);
        setIsChangesModalOpen(false);
        setChangeRemarks('');
        toast.success('Changes requested. The owner has been notified to modify and resubmit.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to request changes.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      const res = await approveAdminFacilitySubmission(id, approveRemarks.trim() || undefined);
      if (res.success && res.data) {
        setSubmission(res.data);
        setIsApproveModalOpen(false);
        toast.success(
          'Facility submission approved! Stage 1 complete. Official layout configuration can now proceed.',
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve submission.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      toast.error('A comprehensive rejection reason is required (minimum 10 characters).');
      return;
    }

    try {
      setActionLoading(true);
      const res = await rejectAdminFacilitySubmission(
        id,
        rejectionReason.trim(),
        rejectRemarks.trim() || undefined,
      );
      if (res.success && res.data) {
        setSubmission(res.data);
        setIsRejectModalOpen(false);
        toast.success('Facility submission rejected.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject submission.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateOfficialParkingLot = async () => {
    if (!id) return;
    try {
      setIsCreatingLot(true);
      const res = await createOfficialParkingLot(id);
      if (res.success && res.data) {
        const createdLotId = res.data.parkingLot._id;
        toast.success(res.message || 'Official Parking Lot & Structure created successfully!');
        setSubmission((prev) =>
          prev
            ? {
                ...prev,
                officialParkingLotId: createdLotId,
              }
            : prev,
        );
        setIsCreateLotModalOpen(false);
      } else {
        toast.error(res.message || 'Failed to create official parking lot.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create official parking lot.');
    } finally {
      setIsCreatingLot(false);
    }
  };

  const handleSaveRemarksOnly = async () => {
    if (!id) return;
    try {
      setIsSavingRemarks(true);
      const res = await updateAdminFacilityRemarks(id, remarks.trim());
      if (res.success && res.data) {
        setSubmission(res.data);
        toast.success('Administrative remarks updated.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save remarks.');
    } finally {
      setIsSavingRemarks(false);
    }
  };

  const handleOpenPdf = async () => {
    if (!submission?.parkingPlanPdf?.url) return;
    try {
      const filename = submission.parkingPlanPdf.url.split('/').pop();
      if (!filename) return;
      const blob = await fetchAdminFacilityFileBlob(filename);
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch {
      toast.error('Failed to load secure PDF document.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 md:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Facility Submission Not Found</h2>
        <p className="text-xs text-muted-foreground">{error || 'Unable to load facility record.'}</p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadDetail()}>
            Try Again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/facilities">Return to Facility List</Link>
          </Button>
        </div>
      </div>
    );
  }

  const ownerInfo = typeof submission.ownerId === 'object' && submission.ownerId ? submission.ownerId : null;
  const reviewerInfo = typeof submission.reviewedBy === 'object' && submission.reviewedBy ? submission.reviewedBy : null;
  const isPendingReview = submission.submissionStatus === 'Submitted';
  const isUnderReview = submission.submissionStatus === 'Under Review';
  const isApproved = submission.submissionStatus === 'Approved';
  const isRejected = submission.submissionStatus === 'Rejected';
  const isChangesRequested = submission.submissionStatus === 'Changes Requested';
  const canAct = isPendingReview || isUnderReview;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Submitted':
        return (
          <Badge className="bg-sky-600/10 text-sky-600 border-sky-600/30 text-xs font-semibold">
            <Clock className="h-3 w-3 mr-1" /> Submitted
          </Badge>
        );
      case 'Under Review':
        return (
          <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/30 text-xs font-semibold">
            <Eye className="h-3 w-3 mr-1 animate-pulse" /> Under Review
          </Badge>
        );
      case 'Changes Requested':
        return (
          <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30 text-xs font-semibold">
            <AlertTriangle className="h-3 w-3 mr-1" /> Changes Requested
          </Badge>
        );
      case 'Approved':
        return (
          <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-xs font-semibold">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case 'Rejected':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs font-semibold">
            <XCircle className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. NAVIGATION & BREADCRUMBS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Link to="/admin/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <Link to="/admin/facilities" className="hover:text-foreground">
              Facility Submissions
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <span className="font-mono font-semibold text-foreground">
              {submission.submissionReference}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {submission.facilityName}
            </h1>
            {getStatusBadge(submission.submissionStatus)}
            <Badge variant="outline" className="text-xs">
              {submission.facilityType}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
            <span>
              Submitted:{' '}
              {submission.submittedAt
                ? format(new Date(submission.submittedAt), 'MMM dd, yyyy HH:mm')
                : '—'}
            </span>
            {submission.reviewedAt && (
              <span>
                Reviewed: {format(new Date(submission.reviewedAt), 'MMM dd, yyyy HH:mm')}
                {reviewerInfo ? ` by ${reviewerInfo.fullName}` : ''}
              </span>
            )}
            {submission.approvedAt && (
              <span className="text-emerald-600 font-medium">
                Approved: {format(new Date(submission.approvedAt), 'MMM dd, yyyy HH:mm')}
              </span>
            )}
          </div>
        </div>

        {/* Back Link */}
        <Button variant="outline" size="sm" asChild className="gap-1.5 shrink-0">
          <Link to="/admin/facilities">
            <ArrowLeft className="h-4 w-4" />
            Back to Submissions
          </Link>
        </Button>
      </div>

      {/* 2. ADMINISTRATOR ACTION BAR */}
      <Card className="border-primary/20 bg-card shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Review Actions</h3>
              <p className="text-[11px] text-muted-foreground">
                {isApproved
                  ? submission.officialParkingLotId
                    ? 'Submission approved. Official Parking Lot and structural hierarchy (Floors, Zones, Slots) have been generated in Inactive status.'
                    : 'Submission approved. Ready for official Parking Lot conversion and structural hierarchy generation.'
                  : isRejected
                  ? 'This submission was rejected by the administration.'
                  : canAct
                  ? 'Evaluate the submitted survey details, photos, and rules before making a determination.'
                  : 'Owner resubmission pending.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            {/* Start Review (if Submitted) */}
            {isPendingReview && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartReview}
                disabled={actionLoading}
                className="gap-1.5 text-blue-600 border-blue-600/30 hover:bg-blue-600/10 text-xs font-semibold"
              >
                <PlayCircle className="h-4 w-4" />
                Start Review
              </Button>
            )}

            {/* Request Changes (if Submitted or Under Review) */}
            {canAct && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsChangesModalOpen(true)}
                disabled={actionLoading}
                className="gap-1.5 text-amber-600 border-amber-600/30 hover:bg-amber-600/10 text-xs font-semibold"
              >
                <AlertTriangle className="h-4 w-4" />
                Request Changes
              </Button>
            )}

            {/* Reject Button */}
            {canAct && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setIsRejectModalOpen(true)}
                disabled={actionLoading}
                className="gap-1.5 text-xs font-semibold"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            )}

            {/* Approve Button */}
            {canAct && (
              <Button
                size="sm"
                onClick={() => setIsApproveModalOpen(true)}
                disabled={actionLoading}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve Submission
              </Button>
            )}

            {/* Approved & Official Lot Already Created */}
            {isApproved && submission.officialParkingLotId && (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-xs font-semibold py-1">
                  Official Lot Created
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="gap-1.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Link to={`/admin/parking-lots/${submission.officialParkingLotId}`}>
                    <Layers className="h-4 w-4" />
                    View Structure &amp; Hierarchy
                  </Link>
                </Button>
              </div>
            )}

            {/* Approved & Official Lot Not Yet Created */}
            {isApproved && !submission.officialParkingLotId && (
              <Button
                size="sm"
                onClick={() => setIsCreateLotModalOpen(true)}
                disabled={actionLoading || isCreatingLot}
                className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs"
              >
                <Building2 className="h-4 w-4" />
                Create Official Parking Lot
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. LIFECYCLE FEEDBACK BANNERS */}
      {isChangesRequested && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <AlertTriangle className="h-5 w-5" />
            Changes Requested by Administrator
          </div>
          <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
            {submission.adminRemarks || submission.requestedChanges || 'Feedback sent to owner.'}
          </p>
          <span className="text-[11px] text-amber-800/80 block">
            Awaiting owner modifications and resubmission.
          </span>
        </div>
      )}

      {isRejected && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm">
            <XCircle className="h-5 w-5" />
            Facility Setup Submission Rejected
          </div>
          <p className="text-xs text-destructive leading-relaxed">
            <strong>Rejection Reason:</strong> {submission.rejectionReason}
          </p>
          {submission.adminRemarks && (
            <p className="text-[11px] text-destructive/80">
              Remarks: {submission.adminRemarks}
            </p>
          )}
        </div>
      )}

      {isApproved && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              {submission.officialParkingLotId
                ? 'Official Parking Lot & Structure Created (Inactive)'
                : 'Facility Survey Information Approved'}
            </div>
            {submission.officialParkingLotId ? (
              <Button size="sm" asChild className="gap-1.5 text-xs font-semibold">
                <Link to={`/admin/parking-lots/${submission.officialParkingLotId}`}>
                  <Layers className="h-4 w-4" />
                  Inspect Official Hierarchy
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsCreateLotModalOpen(true)}
                disabled={isCreatingLot}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
              >
                <Building2 className="h-4 w-4" />
                Create Official Parking Lot
              </Button>
            )}
          </div>
          <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
            Approved on {format(new Date(submission.approvedAt!), 'MMM dd, yyyy HH:mm')}.
            {submission.adminRemarks && ` Remarks: "${submission.adminRemarks}"`}
          </p>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
            {submission.officialParkingLotId
              ? 'An official Parking Lot and structural hierarchy (Floors, Zones, and Parking Slots) have been generated and linked to this submission. The structure is currently in Inactive staging status.'
              : 'Next Administrative Step: Convert this approved submission into an official ParkEase Parking Lot with Floor, Zone, and Slot records in Inactive status.'}
          </p>
        </div>
      )}

      {/* 4. AUTHORITATIVE STRUCTURAL PROGRESS TRACKER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Authoritative Onboarding Lifecycle Progress
          </h2>
          <span className="text-[11px] text-muted-foreground">Admin Staging Boundary</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">1. Survey Review</span>
              {getStatusBadge(submission.submissionStatus)}
            </div>
            <p className="text-xs font-semibold text-foreground">
              {isApproved ? 'Survey Approved' : submission.submissionStatus}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {submission.submittedAt
                ? `Submitted ${format(new Date(submission.submittedAt), 'MMM dd')}`
                : 'Pending'}
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">2. Official Lot</span>
              {submission.officialParkingLotId ? (
                <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-[10px]">Created</Badge>
              ) : isApproved ? (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 text-[10px]">Pending Creation</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Awaiting Approval</Badge>
              )}
            </div>
            <p className="text-xs font-semibold text-foreground">
              {submission.officialParkingLotId ? 'Official Lot Registered' : isApproved ? 'Pending Admin Lot Provision' : 'Not Started'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Admin structural phase
            </p>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">3. Layout &amp; Slots</span>
              <Badge variant="secondary" className="text-[10px]">Not Configured</Badge>
            </div>
            <p className="text-xs font-semibold text-foreground">Layout Designer Pending</p>
            <p className="text-[11px] text-muted-foreground">Admin 2D canvas mapping</p>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">4. Activation</span>
              <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Inactive
              </Badge>
            </div>
            <p className="text-xs font-semibold text-foreground">Driver Bookings Disabled</p>
            <p className="text-[11px] text-muted-foreground">Activation requires published layout</p>
          </div>
        </div>
      </div>

      {/* 5. MAIN CONTENT TABS */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="text-xs py-2">
            Overview &amp; Location
          </TabsTrigger>
          <TabsTrigger value="capacity" className="text-xs py-2">
            Capacity &amp; Floors ({submission.capacity?.totalSlots} Slots)
          </TabsTrigger>
          <TabsTrigger value="operating" className="text-xs py-2">
            Operating &amp; Tariff
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs py-2">
            Photos ({submission.photos?.length || 0}) &amp; PDF
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs py-2">
            Rules &amp; Notes
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW & LOCATION */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Spans: Facility & Location Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Facility General Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Facility Name:</span>
                      <p className="font-bold text-foreground text-sm">{submission.facilityName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Facility Type:</span>
                      <p className="font-semibold text-foreground">{submission.facilityType}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">Short Description:</span>
                    <p className="text-foreground leading-relaxed">
                      {submission.shortDescription || '—'}
                    </p>
                  </div>

                  {submission.detailedDescription && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Detailed Description:</span>
                      <p className="text-foreground leading-relaxed whitespace-pre-line bg-muted/20 p-3 rounded-lg border border-border/40">
                        {submission.detailedDescription}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-border/60 pt-3">
                    <h4 className="font-semibold text-foreground mb-2">On-Site Facility Contact</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-muted-foreground">Contact Person:</span>
                        <p className="font-medium text-foreground">{submission.contactName || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contact Phone:</span>
                        <p className="font-medium text-foreground">{submission.contactPhone || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contact Email:</span>
                        <p className="font-medium text-foreground">{submission.contactEmail || '—'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Location Card */}
              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Physical Location &amp; Coordinates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-1">
                    <span className="text-muted-foreground text-[11px] block">Complete Address:</span>
                    <p className="font-semibold text-foreground text-sm leading-relaxed">
                      {submission.location?.address}
                    </p>
                    {submission.location?.addressLine1 && (
                      <p className="text-muted-foreground">
                        {submission.location.addressLine1}
                        {submission.location.addressLine2 ? `, ${submission.location.addressLine2}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                      <span className="text-muted-foreground">Pin Status:</span>
                      <p className="font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Confirmed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded bg-muted/40 border border-border/40 font-mono text-[11px]">
                    <span>Latitude: {submission.location?.latitude?.toFixed(6)}</span>
                    <span>Longitude: {submission.location?.longitude?.toFixed(6)}</span>
                    <a
                      href={`https://www.google.com/maps?q=${submission.location?.latitude},${submission.location?.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-sans text-xs"
                    >
                      <ExternalLink className="h-3 w-3" /> Open in Maps
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Owner Profile & Remarks Editor */}
            <div className="space-y-6">
              {/* Owner Info Card */}
              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Submitting Parking Owner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {ownerInfo ? (
                    <>
                      <div>
                        <span className="text-muted-foreground">Full Name:</span>
                        <p className="font-bold text-foreground text-sm">{ownerInfo.fullName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email Address:</span>
                        <p className="font-medium text-foreground">{ownerInfo.email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mobile Number:</span>
                        <p className="font-medium text-foreground">{ownerInfo.mobileNumber}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Account Status:</span>
                        <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-[10px] ml-2">
                          {ownerInfo.accountStatus || 'Active'}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Owner ID: {String(submission.ownerId)}</p>
                  )}
                </CardContent>
              </Card>

              {/* Administrative Remarks Notepad */}
              <Card className="border-border/80 bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Administrator Remarks
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Internal notes and reviewer commentary recorded on this record.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <Textarea
                    placeholder="Enter internal inspection notes or remarks..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={4}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveRemarksOnly}
                    disabled={isSavingRemarks}
                    className="w-full gap-1.5 text-xs"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSavingRemarks ? 'Saving...' : 'Save Remarks'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: CAPACITY, FLOORS & ZONES */}
        <TabsContent value="capacity" className="space-y-6">
          {/* Capacity Breakdown */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" />
                  Vehicle Capacity Categories (Exact 7 Categories)
                </CardTitle>
                <Badge variant="outline" className="font-bold text-xs text-primary">
                  {submission.capacity?.totalSlots} Total Parking Bays
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Car</span>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {submission.capacity?.breakdown?.car || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">SUV</span>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {submission.capacity?.breakdown?.suv || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Bike</span>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {submission.capacity?.breakdown?.bike || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">EV</span>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {submission.capacity?.breakdown?.ev || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Accessible</span>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {submission.capacity?.breakdown?.accessible || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">VIP</span>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {submission.capacity?.breakdown?.vip || 0}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Other</span>
                  <p className="text-lg font-extrabold text-foreground mt-0.5">
                    {submission.capacity?.breakdown?.other || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Floors Reference */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Floor Reference Breakdown ({submission.floors?.length || 0} Floors Declared)
              </CardTitle>
              <CardDescription className="text-[11px]">
                Owner-provided reference data. Sum of floor bays equals {submission.capacity?.totalSlots} slots.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submission.floors && submission.floors.length > 0 ? (
                <div className="space-y-3">
                  {submission.floors.map((fl, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-sm">
                          {fl.floorName} (Floor Number: {fl.floorNumber})
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[11px]">
                            {fl.parkingType || 'Covered'}
                          </Badge>
                          <Badge variant="secondary" className="font-mono font-bold text-xs">
                            {fl.slotCount} Bays
                          </Badge>
                        </div>
                      </div>
                      {fl.floorDescription && (
                        <p className="text-muted-foreground">{fl.floorDescription}</p>
                      )}
                      {fl.specialAreas && (
                        <p className="text-[11px] text-muted-foreground/80">
                          Special areas: {fl.specialAreas}
                        </p>
                      )}
                      {fl.additionalNotes && (
                        <p className="text-[11px] text-muted-foreground/80">
                          Notes: {fl.additionalNotes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No floor breakdown specified.</p>
              )}
            </CardContent>
          </Card>

          {/* Zones Reference */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-primary" />
                Zone Reference Breakdown ({submission.zones?.length || 0} Zones Declared)
              </CardTitle>
              <CardDescription className="text-[11px]">
                Survey reference zones. Official zones are configured by Administrator in layout designer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submission.zones && submission.zones.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {submission.zones.map((zn, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{zn.zoneName}</span>
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {zn.slotCount} Bays
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex gap-3">
                        <span>Floor: <strong>{zn.floorName}</strong></span>
                        <span>Type: {zn.zoneType || 'Standard'}</span>
                        <span>Vehicle: {zn.supportedVehicleType || 'Car'}</span>
                      </div>
                      {zn.description && (
                        <p className="text-[11px] text-muted-foreground">{zn.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No specific zones declared (open facility).</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: OPERATING & TARIFF */}
        <TabsContent value="operating" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Operating Hours Card */}
            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Operating Hours &amp; Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="p-3 rounded-lg bg-muted/20 border border-border/60 flex items-center justify-between">
                  <span className="text-muted-foreground">Schedule Type:</span>
                  <Badge variant={submission.operatingInfo?.isOpen24x7 ? 'default' : 'secondary'}>
                    {submission.operatingInfo?.isOpen24x7
                      ? 'Open 24×7'
                      : `${submission.operatingInfo?.openingTime || '—'} - ${submission.operatingInfo?.closingTime || '—'}`}
                  </Badge>
                </div>

                {submission.operatingInfo?.dailySchedules &&
                  submission.operatingInfo.dailySchedules.length > 0 && (
                    <div className="space-y-1.5 border-t border-border/60 pt-3">
                      <span className="text-muted-foreground font-semibold block">
                        Day-by-Day Hours:
                      </span>
                      <div className="space-y-1">
                        {submission.operatingInfo.dailySchedules.map((ds, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between p-1.5 rounded bg-muted/30 text-[11px]"
                          >
                            <span className="font-medium text-foreground">{ds.day}</span>
                            <span className="text-muted-foreground">
                              {ds.isOpen ? `${ds.openingTime} - ${ds.closingTime}` : 'Closed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Amenities */}
                <div className="border-t border-border/60 pt-3 space-y-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Submitted Amenities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {submission.amenities && submission.amenities.length > 0 ? (
                      submission.amenities.map((am) => (
                        <Badge key={am} variant="secondary" className="text-[11px]">
                          {am}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">No amenities declared</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing & Duration Card */}
            <Card className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" />
                  Parking Tariff &amp; Duration Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Car Hourly Rate:</span>
                    <span className="font-bold text-foreground">₹{submission.pricing?.carHourlyRate}/hr</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">SUV Hourly Rate:</span>
                    <span className="font-bold text-foreground">₹{submission.pricing?.suvHourlyRate}/hr</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Bike Hourly Rate:</span>
                    <span className="font-bold text-foreground">₹{submission.pricing?.bikeHourlyRate}/hr</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">EV Hourly Rate:</span>
                    <span className="font-bold text-foreground">₹{submission.pricing?.evChargingRatePerHour || 0}/hr</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Other Hourly Rate:</span>
                    <span className="font-bold text-foreground">₹{submission.pricing?.otherHourlyRate || 0}/hr</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Full Day Flat Rate:</span>
                    <span className="font-bold text-foreground">₹{submission.pricing?.dailyRate || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Overnight Rate:</span>
                    <span className="font-bold text-foreground">₹{submission.pricing?.overnightRate || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Exit Grace Period:</span>
                    <span className="font-medium text-foreground">{submission.pricing?.gracePeriodMinutes ?? 15} minutes</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Min / Max Duration:</span>
                    <span className="font-medium text-foreground">
                      {submission.pricing?.minParkingDurationHours ?? 1} hr / {submission.pricing?.maxParkingDurationHours ?? 24} hrs
                    </span>
                  </div>
                </div>

                {submission.pricing?.additionalPricingNotes && (
                  <div className="pt-2">
                    <span className="text-muted-foreground text-[11px] block">Pricing Notes:</span>
                    <p className="text-foreground">{submission.pricing.additionalPricingNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: PHOTOS & DOCUMENTS */}
        <TabsContent value="media" className="space-y-6">
          {/* Reference PDF Card */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Submitted Reference Parking Plan PDF
              </CardTitle>
              <CardDescription className="text-[11px]">
                Owner-provided reference document to assist Administrator with 2D survey mapping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submission.parkingPlanPdf ? (
                <div className="p-4 rounded-lg border border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-foreground text-sm">
                      {submission.parkingPlanPdf.fileName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(submission.parkingPlanPdf.fileSize / (1024 * 1024)).toFixed(2)} MB &bull;
                      Secure server stream
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenPdf}
                    className="gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    View / Download PDF
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No reference PDF uploaded by owner.</p>
              )}
            </CardContent>
          </Card>

          {/* Photos Card */}
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Submitted Facility Photographs ({submission.photos?.length || 0})
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Click any photo to inspect with high-resolution zoom and rotation.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {submission.photos && submission.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {submission.photos.map((ph, idx) => {
                    const isPrimary = ph.url === submission.primaryImageUrl || ph.isPrimary;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setInspectingPhoto(ph);
                          setZoomLevel(1);
                          setRotation(0);
                        }}
                        className={`group relative rounded-lg border overflow-hidden bg-muted/40 cursor-pointer hover:border-primary transition-all shadow-2xs ${
                          isPrimary ? 'ring-2 ring-primary border-primary' : 'border-border/60'
                        }`}
                      >
                        <div className="h-36 w-full bg-muted/60 overflow-hidden relative">
                          <AuthenticatedImage
                            src={ph.url}
                            alt={ph.caption || 'Facility Photo'}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                            <ZoomIn className="h-4 w-4" /> Inspect
                          </div>
                        </div>

                        <div className="p-2 flex items-center justify-between text-[11px] bg-card">
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
        </TabsContent>

        {/* TAB 5: RULES & INSTRUCTIONS */}
        <TabsContent value="rules" className="space-y-6">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Submitted Parking Rules &amp; Operational Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-foreground">General Parking Rules:</span>
                <p className="text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                  {submission.parkingRules?.rules || 'Standard parking rules apply.'}
                </p>
              </div>

              {submission.parkingRules?.entryExitInstructions && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Entry &amp; Exit Instructions:</span>
                  <p className="text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                    {submission.parkingRules.entryExitInstructions}
                  </p>
                </div>
              )}

              {submission.parkingRules?.vehicleRestrictions && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Vehicle Restrictions:</span>
                  <p className="text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                    {submission.parkingRules.vehicleRestrictions}
                  </p>
                </div>
              )}

              {submission.parkingRules?.heightWeightRestrictions && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Height &amp; Weight Limits:</span>
                  <p className="text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                    {submission.parkingRules.heightWeightRestrictions}
                  </p>
                </div>
              )}

              {submission.parkingRules?.evRules && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">EV Charging Rules:</span>
                  <p className="text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                    {submission.parkingRules.evRules}
                  </p>
                </div>
              )}

              {submission.parkingRules?.overnightRules && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Overnight Parking Policy:</span>
                  <p className="text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                    {submission.parkingRules.overnightRules}
                  </p>
                </div>
              )}

              {submission.parkingRules?.otherInstructions && (
                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Other Instructions:</span>
                  <p className="text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                    {submission.parkingRules.otherInstructions}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =========================================================================
          DIALOGS & MODALS
          ========================================================================= */}

      {/* 1. Request Changes Dialog */}
      <Dialog open={isChangesModalOpen} onOpenChange={setIsChangesModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Request Facility Adjustments
            </DialogTitle>
            <DialogDescription className="text-xs">
              Explain clearly what needs to be changed (e.g. invalid floor breakdown, missing EV photos, unclear entry instructions). The owner will be notified to modify and resubmit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="changes" className="text-xs font-semibold">
              Required Adjustments &amp; Remarks *
            </Label>
            <Textarea
              id="changes"
              placeholder="e.g. Please clarify floor 2 slot counts and upload an entrance photo..."
              value={changeRemarks}
              onChange={(e) => setChangeRemarks(e.target.value)}
              rows={4}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangesModalOpen(false)}
              disabled={actionLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRequestChanges}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              {actionLoading ? 'Submitting...' : 'Send Feedback to Owner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Approve Submission Dialog */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Approve Facility Submission
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm that the survey details, capacity, and reference files are acceptable.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <span className="font-bold flex items-center gap-1">
              <Info className="h-3.5 w-3.5" /> Authoritative Boundary Notice:
            </span>
            <p className="leading-relaxed text-[11px]">
              Approval ONLY approves the survey record. It does NOT automatically generate official ParkingLot, Floors, or Slots, and DOES NOT activate customer bookings. The platform Administrator will configure official layout in the subsequent phase.
            </p>
          </div>

          <div className="space-y-2 py-2">
            <Label htmlFor="approve-notes" className="text-xs font-semibold">
              Approval Remarks (Optional)
            </Label>
            <Textarea
              id="approve-notes"
              placeholder="Optional remarks or survey confirmation notes..."
              value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
              disabled={actionLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {actionLoading ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Reject Submission Dialog */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Reject Facility Setup Request
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide a clear reason why this facility setup request is rejected. Rejection is final.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="rejection" className="text-xs font-semibold">
                Rejection Reason *
              </Label>
              <Textarea
                id="rejection"
                placeholder="State the formal reason for rejection (min 10 characters)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <div>
              <Label htmlFor="reject-notes" className="text-xs font-semibold">
                Internal Remarks (Optional)
              </Label>
              <Textarea
                id="reject-notes"
                placeholder="Optional internal administrative notes..."
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
              disabled={actionLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading}
              className="text-xs"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Full Photo Inspection Modal */}
      {inspectingPhoto && (
        <Dialog open={Boolean(inspectingPhoto)} onOpenChange={() => setInspectingPhoto(null)}>
          <DialogContent className="max-w-3xl p-4">
            <DialogHeader className="flex flex-row items-center justify-between pb-2">
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                {inspectingPhoto.category || 'Facility Photo'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                  className="h-7 w-7 p-0"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                  className="h-7 w-7 p-0"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="h-7 w-7 p-0"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DialogHeader>

            <div className="relative overflow-hidden bg-black/90 rounded-lg flex items-center justify-center min-h-[350px] max-h-[500px]">
              <div
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
                className="max-h-full max-w-full flex items-center justify-center p-2"
              >
                <AuthenticatedImage
                  src={inspectingPhoto.url}
                  alt={inspectingPhoto.caption || 'Facility Photo'}
                  className="max-h-[460px] max-w-full object-contain rounded"
                />
              </div>
            </div>

            {inspectingPhoto.caption && (
              <p className="text-xs text-muted-foreground pt-1">{inspectingPhoto.caption}</p>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* 5. CREATE OFFICIAL PARKING LOT MODAL */}
      <Dialog open={isCreateLotModalOpen} onOpenChange={setIsCreateLotModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Create Official Parking Lot &amp; Structure
            </DialogTitle>
            <DialogDescription className="text-xs">
              Convert approved facility reference data into official ParkEase Parking Lot, Floor, Zone, and Slot records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Facility Name:</span>
                <span className="font-semibold text-foreground">{submission.facilityName}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Facility Type:</span>
                <span className="font-medium text-foreground">{submission.facilityType}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Total Capacity:</span>
                <span className="font-bold text-foreground">{submission.capacity?.totalSlots || 0} Slots</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Floors to Create:</span>
                <span className="font-medium text-foreground">{submission.floors?.length || 0} Floor(s)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Initial Status:</span>
                <Badge variant="outline" className="text-[11px] font-semibold bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Inactive (Staging)
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3.5 space-y-1.5 text-xs text-blue-900 dark:text-blue-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                Administrative Safety Policy
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-800 dark:text-blue-300 pl-1">
                <li>Initial status will be strictly <strong>Inactive</strong>.</li>
                <li>Each slot will receive a unique identifier, zone designation, and QR identifier.</li>
                <li>Customer bookings and 2D visual layout activation will remain locked until subsequent publishing.</li>
                <li>Original submission data is permanently preserved.</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateLotModalOpen(false)}
              disabled={isCreatingLot}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateOfficialParkingLot}
              disabled={isCreatingLot}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {isCreatingLot ? (
                <>Creating Structure...</>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  Confirm &amp; Create Structure
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
