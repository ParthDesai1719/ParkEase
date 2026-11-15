import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Building,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  LogOut,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  User,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  approveOwnerApplication,
  getOwnerApplicationById,
  getOwnerApplicationDocumentBlob,
  getOwnerApplications,
  rejectOwnerApplication,
  updateOwnerApplicationRemarks,
  type OwnerApplicationItem,
} from '@/api/admin.api';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

/**
 * Mask sensitive government ID numbers for privacy while permitting verification.
 * e.g., "123456789012" -> "•••• •••• 9012"
 */
function maskGovernmentId(idNumber?: string): string {
  if (!idNumber) return 'Not Provided';
  const clean = idNumber.replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  const lastFour = clean.slice(-4);
  return `•••• •••• ${lastFour}`;
}

function isImageFile(urlOrPath?: string | null): boolean {
  if (!urlOrPath) return false;
  const clean = urlOrPath.toLowerCase().split('?')[0];
  return (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.gif') ||
    clean.endsWith('.svg')
  );
}

function isPdfFile(urlOrPath?: string | null): boolean {
  if (!urlOrPath) return false;
  const clean = urlOrPath.toLowerCase().split('?')[0];
  return clean.endsWith('.pdf');
}

interface InspectingDoc {
  title: string;
  docType: 'identityProof' | 'businessLicense' | 'propertyProof' | 'parkingImage';
  index?: number;
  urlOrPath: string;
}

export const OwnerManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();

  // URL state synchronization
  const currentStatus = searchParams.get('status') || 'Pending Review';
  const currentSearch = searchParams.get('search') || '';

  const [applications, setApplications] = useState<OwnerApplicationItem[]>([]);
  const [totalApplications, setTotalApplications] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search input state
  const [searchInput, setSearchInput] = useState<string>(currentSearch);

  // Selected application for detail review dialog
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<OwnerApplicationItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Document Inspector modal state
  const [inspectingDoc, setInspectingDoc] = useState<InspectingDoc | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [docBlobUrl, setDocBlobUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState<boolean>(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docMimeType, setDocMimeType] = useState<string | null>(null);

  const openDocumentInspector = (doc: InspectingDoc) => {
    setInspectingDoc(doc);
    setZoomLevel(1);
    setDocBlobUrl(null);
    setDocError(null);
    setDocMimeType(null);
    setDocLoading(true);
  };

  const closeDocumentInspector = () => {
    setInspectingDoc(null);
    setZoomLevel(1);
    setDocBlobUrl(null);
    setDocError(null);
    setDocMimeType(null);
    setDocLoading(false);
  };

  // Fetch and manage secure document blob preview
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!inspectingDoc || !selectedApp) {
      return;
    }

    void getOwnerApplicationDocumentBlob(
      selectedApp._id,
      inspectingDoc.docType,
      inspectingDoc.index,
    )
      .then(({ blob, mimeType }) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        createdUrl = url;
        setDocBlobUrl(url);
        setDocMimeType(mimeType);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg =
          err instanceof Error ? err.message : 'Failed to load secure document preview.';
        setDocError(msg);
      })
      .finally(() => {
        if (active) {
          setDocLoading(false);
        }
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [inspectingDoc, selectedApp]);

  // Remarks state
  const [remarksInput, setRemarksInput] = useState<string>('');
  const [savingRemarks, setSavingRemarks] = useState<boolean>(false);
  const [remarksSuccess, setRemarksSuccess] = useState<string | null>(null);

  // Approval modal state
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);
  const [approveRemarks, setApproveRemarks] = useState<string>('');
  const [approveSubmitting, setApproveSubmitting] = useState<boolean>(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Rejection modal state
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectRemarks, setRejectRemarks] = useState<string>('');
  const [rejectSubmitting, setRejectSubmitting] = useState<boolean>(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Fetch applications list
  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOwnerApplications({
        status: currentStatus === 'All' ? undefined : currentStatus,
        search: currentSearch || undefined,
        limit: 50,
      });

      if (res.success && res.data) {
        setApplications(res.data.applications);
        setTotalApplications(res.data.total);
      } else {
        setError(res.message || 'Failed to load owner applications.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading applications.');
    } finally {
      setLoading(false);
    }
  }, [currentStatus, currentSearch]);

  useEffect(() => {
    let isSubscribed = true;

    const fetchInitial = async () => {
      try {
        const res = await getOwnerApplications({
          status: currentStatus === 'All' ? undefined : currentStatus,
          search: currentSearch || undefined,
          limit: 50,
        });

        if (isSubscribed && res.success && res.data) {
          setApplications(res.data.applications);
          setTotalApplications(res.data.total);
        } else if (isSubscribed) {
          setError(res.message || 'Failed to load owner applications.');
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          setError(err instanceof Error ? err.message : 'Error loading applications.');
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
  }, [currentStatus, currentSearch]);

  // Open detail review dialog and load populated record
  const handleOpenDetail = async (id: string) => {
    setSelectedAppId(id);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await getOwnerApplicationById(id);
      if (res.success && res.data) {
        setSelectedApp(res.data);
        setRemarksInput(res.data.adminRemarks || '');
        setRemarksSuccess(null);
      } else {
        setDetailError(res.message || 'Failed to fetch application details.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching application details.';
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  // Save admin remarks
  const handleSaveRemarks = async () => {
    if (!selectedApp) return;
    setSavingRemarks(true);
    setRemarksSuccess(null);
    try {
      const res = await updateOwnerApplicationRemarks(selectedApp._id, remarksInput);
      if (res.success && res.data) {
        const updated = res.data;
        setSelectedApp(updated);
        setRemarksSuccess('Remarks saved to audit trail.');
        setApplications((prev) =>
          prev.map((app) => (app._id === updated._id ? updated : app)),
        );
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      alert(apiErr.response?.data?.message || apiErr.message || 'Failed to save remarks.');
    } finally {
      setSavingRemarks(false);
    }
  };

  // Status filter tab change
  const handleStatusChange = (val: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (val === 'All') {
      nextParams.set('status', 'All');
    } else {
      nextParams.set('status', val);
    }
    setSearchParams(nextParams);
  };

  // Debounce search input for live asynchronous searching
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQuery = searchParams.get('search') || '';
      const trimmed = searchInput.trim();
      if (trimmed !== currentQuery) {
        const nextParams = new URLSearchParams(searchParams);
        if (trimmed) {
          nextParams.set('search', trimmed);
        } else {
          nextParams.delete('search');
        }
        setSearchParams(nextParams);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  // Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      nextParams.set('search', searchInput.trim());
    } else {
      nextParams.delete('search');
    }
    setSearchParams(nextParams);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    setSearchParams(nextParams);
  };

  // Perform Approval
  const handleApproveSubmit = async () => {
    if (!selectedApp) return;
    try {
      setApproveSubmitting(true);
      setApproveError(null);
      const res = await approveOwnerApplication(selectedApp._id, {
        remarks: approveRemarks.trim() || undefined,
      });

      if (res.success && res.data) {
        setSelectedApp(res.data);
        setIsApproveOpen(false);
        setApproveRemarks('');
        await loadApplications();
      } else {
        setApproveError(res.message || 'Approval failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during approval.';
      setApproveError(msg);
    } finally {
      setApproveSubmitting(false);
    }
  };

  // Perform Rejection
  const handleRejectSubmit = async () => {
    if (!selectedApp) return;
    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      setRejectError('Rejection reason is required.');
      return;
    }
    if (trimmedReason.length > 500) {
      setRejectError('Rejection reason cannot exceed 500 characters.');
      return;
    }

    try {
      setRejectSubmitting(true);
      setRejectError(null);
      const res = await rejectOwnerApplication(selectedApp._id, {
        rejectionReason: trimmedReason,
        remarks: rejectRemarks.trim() || undefined,
      });

      if (res.success && res.data) {
        setSelectedApp(res.data);
        setIsRejectOpen(false);
        setRejectionReason('');
        setRejectRemarks('');
        await loadApplications();
      } else {
        setRejectError(res.message || 'Rejection failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during rejection.';
      setRejectError(msg);
    } finally {
      setRejectSubmitting(false);
    }
  };

  // Render status badge helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending Review':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 hover:bg-amber-500/20">
            <Clock className="h-3 w-3" />
            Pending Review
          </Badge>
        );
      case 'Approved':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 hover:bg-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'Rejected':
        return (
          <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1 hover:bg-destructive/20">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      case 'Submitted':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 hover:bg-blue-500/20">
            <FileText className="h-3 w-3" />
            Submitted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {status}
          </Badge>
        );
    }
  };

  const isEligibleForReview =
    selectedApp?.applicationStatus === 'Pending Review' ||
    selectedApp?.applicationStatus === 'Submitted';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. BREADCRUMBS & HEADER */}
      <div className="space-y-2">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/admin/dashboard" className="hover:text-foreground transition-colors">
            Admin Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Owner Management</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
              <Building className="h-7 w-7 text-primary" />
              Parking Owner Registration Review
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm mt-1">
              Review submitted credentials, verify platform registration fees, and approve or reject
              access to the Parking Owner Dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadApplications}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="gap-1.5 font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <Tabs value={currentStatus} onValueChange={handleStatusChange} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-4 w-full md:w-auto">
            <TabsTrigger value="Pending Review" className="text-xs px-3">
              Pending
            </TabsTrigger>
            <TabsTrigger value="Approved" className="text-xs px-3">
              Approved
            </TabsTrigger>
            <TabsTrigger value="Rejected" className="text-xs px-3">
              Rejected
            </TabsTrigger>
            <TabsTrigger value="All" className="text-xs px-3">
              All Records
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search reference, business, city..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 text-xs h-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
          <Button type="submit" size="sm" variant="secondary" className="h-9 text-xs px-3">
            Search
          </Button>
        </form>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center justify-between py-4 px-6 text-destructive">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadApplications}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 3. APPLICATIONS DATA TABLE */}
      <Card className="border-border/80 bg-card shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/80 bg-muted/40 text-muted-foreground uppercase text-[11px] font-semibold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Reference</th>
                  <th className="py-3.5 px-4">Business &amp; Facility</th>
                  <th className="py-3.5 px-4">Owner / Applicant</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Capacity</th>
                  <th className="py-3.5 px-4">Fee / Payment</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* LOADING SKELETON */}
                {loading && (
                  <>
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-4 px-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="py-4 px-4 space-y-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </td>
                        <td className="py-4 px-4 space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-36" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-5 w-20" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Skeleton className="h-8 w-16 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {/* CANONICAL EMPTY STATE */}
                {!loading && applications.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 px-4 text-center">
                      <div className="mx-auto max-w-sm flex flex-col items-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                          <FileCheck2 className="h-6 w-6" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">
                          {currentStatus === 'Pending Review'
                            ? 'No pending Owner approvals.'
                            : 'No owner applications found.'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {currentSearch
                            ? `No results match the query "${currentSearch}". Try resetting search filters.`
                            : currentStatus === 'Pending Review'
                              ? 'All partner registration submissions have been reviewed and processed.'
                              : 'No records exist under the selected category.'}
                        </p>
                        {currentSearch && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearSearch}
                            className="mt-2 text-xs"
                          >
                            Reset Search
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {/* REAL PERSISTED APPLICATIONS ROWS */}
                {!loading &&
                  applications.map((app) => (
                    <tr
                      key={app._id}
                      className="hover:bg-muted/25 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetail(app._id)}
                    >
                      {/* Reference */}
                      <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                        {app.applicationReference}
                      </td>

                      {/* Business & Facility */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">{app.businessName}</div>
                        <div className="text-[11px] text-muted-foreground">{app.businessType}</div>
                      </td>

                      {/* Owner / Applicant */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">{app.ownerName}</div>
                        <div className="text-[11px] text-muted-foreground">{app.businessEmail}</div>
                        <div className="text-[11px] text-muted-foreground">{app.businessPhone}</div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <div>{app.city}</div>
                        <div className="text-[11px]">{app.state}</div>
                      </td>

                      {/* Capacity */}
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {app.parkingCapacity} slots
                      </td>

                      {/* Fee / Payment */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">
                          ₹{app.registrationFeeAmount || 999}
                        </div>
                        {app.paymentId?.paymentStatus ? (
                          <span
                            className={`text-[10px] font-medium ${
                              app.paymentId.paymentStatus === 'Success'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {app.paymentId.paymentStatus}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Verified</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">{renderStatusBadge(app.applicationStatus)}</td>

                      {/* Submitted Date */}
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                        {app.submittedAt
                          ? new Date(app.submittedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : app.createdAt
                            ? new Date(app.createdAt).toLocaleDateString()
                            : '—'}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetail(app._id)}
                          className="text-xs h-8 gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER SUMMARY */}
          {!loading && applications.length > 0 && (
            <div className="py-3 px-4 border-t border-border/80 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {applications.length} of {totalApplications} record
                {totalApplications > 1 ? 's' : ''}
              </span>
              <span>Sorted by recent submissions</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. APPLICATION DETAIL & REVIEW DIALOG */}
      <Dialog
        open={Boolean(selectedAppId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAppId(null);
            setSelectedApp(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/80 sticky top-0 bg-background/95 backdrop-blur-xs z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Application Review — {selectedApp?.applicationReference || '...'}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Verify business credentials, documents, and platform fee before making an
                  administrative decision.
                </DialogDescription>
              </div>

              {selectedApp && renderStatusBadge(selectedApp.applicationStatus)}
            </div>
          </DialogHeader>

          {/* DIALOG BODY */}
          <div className="p-6 space-y-6">
            {detailLoading && (
              <div className="space-y-4 py-8">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {detailError && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {detailError}
              </div>
            )}

            {!detailLoading && selectedApp && (
              <>
                {/* STATUS CALLOUT (If already finalized) */}
                {selectedApp.applicationStatus === 'Approved' && (
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-800 dark:text-emerald-300 text-xs">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                        Application Approved
                      </p>
                      <p className="mt-0.5">
                        This applicant has been granted the Parking Owner role and has active access
                        to the Parking Owner Dashboard.
                      </p>
                      {selectedApp.reviewedAt && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Approved on {new Date(selectedApp.reviewedAt).toLocaleString()}
                          {selectedApp.reviewedBy && ` by ${selectedApp.reviewedBy.fullName}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedApp.applicationStatus === 'Rejected' && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3 text-destructive text-xs">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Application Rejected</p>
                      <p className="mt-1 font-medium">Reason for Rejection:</p>
                      <p className="mt-0.5 p-2 rounded bg-background/60 border border-border/40 text-foreground">
                        {selectedApp.rejectionReason || 'No reason specified'}
                      </p>
                      {selectedApp.reviewedAt && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Rejected on {new Date(selectedApp.reviewedAt).toLocaleString()}
                          {selectedApp.reviewedBy && ` by ${selectedApp.reviewedBy.fullName}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* SECTION A: OWNER / APPLICANT INFORMATION */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" />
                    A. Owner &amp; Applicant Profile
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-border/80 bg-muted/10 text-xs">
                    <div>
                      <span className="text-muted-foreground">Owner Full Name:</span>
                      <p className="font-semibold text-foreground text-sm mt-0.5">
                        {selectedApp.ownerName}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Contact Email:</span>
                      <p className="font-mono text-foreground mt-0.5">
                        {selectedApp.businessEmail}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Contact Mobile:</span>
                      <p className="font-mono text-foreground mt-0.5">
                        {selectedApp.businessPhone}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Government ID:</span>
                      <p className="text-foreground mt-0.5 font-medium">
                        {selectedApp.governmentIdType}:{' '}
                        <span className="font-mono text-xs">
                          {maskGovernmentId(selectedApp.governmentIdNumber)}
                        </span>
                      </p>
                    </div>

                    {typeof selectedApp.applicantId === 'object' && selectedApp.applicantId && (
                      <div className="sm:col-span-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          Account Status:{' '}
                          <span className="font-medium text-foreground">
                            {selectedApp.applicantId.accountStatus}
                          </span>
                        </span>
                        <span>
                          Joined:{' '}
                          {new Date(selectedApp.applicantId.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION B: BUSINESS & FACILITY INFORMATION */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-primary" />
                    B. Business &amp; Registration Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-border/80 bg-muted/10 text-xs">
                    <div>
                      <span className="text-muted-foreground">Registered Business Name:</span>
                      <p className="font-semibold text-foreground text-sm mt-0.5">
                        {selectedApp.businessName}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Facility Category / Type:</span>
                      <p className="text-foreground font-medium mt-0.5">
                        {selectedApp.businessType}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Physical Business Address:</span>
                      <p className="text-foreground mt-0.5">
                        {selectedApp.businessAddress}, {selectedApp.city}, {selectedApp.state} —{' '}
                        {selectedApp.postalCode}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Reported Parking Capacity:</span>
                      <p className="text-foreground font-bold text-sm mt-0.5">
                        {selectedApp.parkingCapacity} Total Slots
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Application Reference:</span>
                      <p className="font-mono text-foreground text-xs mt-0.5">
                        {selectedApp.applicationReference}
                      </p>
                    </div>

                    {selectedApp.businessDescription && (
                      <div className="sm:col-span-2 pt-2 border-t border-border/40">
                        <span className="text-muted-foreground">Description:</span>
                        <p className="text-foreground mt-1 italic leading-relaxed">
                          "{selectedApp.businessDescription}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION C: SUBMITTED DOCUMENTS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileCheck2 className="h-4 w-4 text-primary" />
                      C. Verification Documents
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      Click &ldquo;Inspect&rdquo; to review image or document stream
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Identity Proof */}
                    <div className="p-3.5 rounded-lg border border-border/80 bg-muted/10 space-y-2 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px] font-medium">
                            Identity Proof ({selectedApp.governmentIdType})
                          </span>
                          {selectedApp.identityProofUrl ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                              Available
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Not Provided
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-foreground text-xs">
                          {maskGovernmentId(selectedApp.governmentIdNumber)}
                        </p>
                      </div>

                      {selectedApp.identityProofUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs h-8 gap-1.5 mt-2 cursor-pointer"
                          onClick={() =>
                            openDocumentInspector({
                              title: `Government Identity Proof (${selectedApp.governmentIdType})`,
                              docType: 'identityProof',
                              urlOrPath: selectedApp.identityProofUrl,
                            })
                          }
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          Inspect ID Proof
                        </Button>
                      )}
                    </div>

                    {/* Business License */}
                    <div className="p-3.5 rounded-lg border border-border/80 bg-muted/10 space-y-2 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px] font-medium">
                            Business License / Registration
                          </span>
                          {selectedApp.businessLicenseUrl ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                              Available
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Not Provided
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedApp.businessLicenseUrl || 'No document on record'}
                        </p>
                      </div>

                      {selectedApp.businessLicenseUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs h-8 gap-1.5 mt-2 cursor-pointer"
                          onClick={() =>
                            openDocumentInspector({
                              title: 'Business Registration / License',
                              docType: 'businessLicense',
                              urlOrPath: selectedApp.businessLicenseUrl,
                            })
                          }
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          Inspect License
                        </Button>
                      )}
                    </div>

                    {/* Property Proof */}
                    <div className="p-3.5 rounded-lg border border-border/80 bg-muted/10 space-y-2 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px] font-medium">
                            Property Ownership Proof
                          </span>
                          {selectedApp.propertyProofUrl ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                              Available
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Not Provided
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedApp.propertyProofUrl || 'No document on record'}
                        </p>
                      </div>

                      {selectedApp.propertyProofUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs h-8 gap-1.5 mt-2 cursor-pointer"
                          onClick={() =>
                            openDocumentInspector({
                              title: 'Property Ownership / Lease Proof',
                              docType: 'propertyProof',
                              urlOrPath: selectedApp.propertyProofUrl,
                            })
                          }
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          Inspect Property Proof
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Photographs Gallery (if any) */}
                  {selectedApp.parkingImageUrls && selectedApp.parkingImageUrls.length > 0 && (
                    <div className="p-3.5 rounded-lg border border-border/80 bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[11px] font-medium">
                          Uploaded Facility Photographs ({selectedApp.parkingImageUrls.length})
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Click any photograph to view enlarged inspection modal
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {selectedApp.parkingImageUrls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              openDocumentInspector({
                                title: `Parking Facility Photograph #${idx + 1}`,
                                docType: 'parkingImage',
                                index: idx,
                                urlOrPath: url,
                              })
                            }
                            className="p-2.5 rounded-md bg-background hover:bg-accent border border-border/60 text-xs flex items-center justify-between transition-colors group cursor-pointer text-left"
                          >
                            <span className="font-medium group-hover:text-primary">Photo #{idx + 1}</span>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION D: REGISTRATION PAYMENT */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-primary" />
                    D. Platform Registration Fee
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg border border-border/80 bg-muted/10 text-xs">
                    <div>
                      <span className="text-muted-foreground">Configured Fee Amount:</span>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        ₹{selectedApp.registrationFeeAmount || 999}
                      </p>
                      <p className="text-[10px] text-muted-foreground">One-time, non-refundable</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Payment Status:</span>
                      <div className="mt-1">
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {selectedApp.paymentId?.paymentStatus || 'Verified & Paid'}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Payment Reference:</span>
                      <p className="font-mono text-foreground text-xs mt-0.5">
                        {selectedApp.paymentId?.paymentReference ||
                          selectedApp.paymentId?._id ||
                          'Linked in Ledger'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECTION E: VERIFICATION CHECKLIST */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    E. Identity &amp; Compliance Checks
                  </h3>

                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/20 border border-border/60 text-xs">
                      {selectedApp.emailOtpVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span>Email OTP Verified</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/20 border border-border/60 text-xs">
                      {selectedApp.mobileOtpVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span>Mobile OTP Verified</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/20 border border-border/60 text-xs">
                      {selectedApp.termsAccepted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span>Platform Terms Accepted</span>
                    </div>
                  </div>
                </div>

                {/* SECTION F: ADMIN REMARKS & AUDIT NOTES */}
                <div className="p-4 rounded-lg border border-border/80 bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Administrator Review Remarks &amp; Audit Notes
                    </span>
                    {remarksSuccess && (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                        <Check className="h-3 w-3 mr-1" />
                        {remarksSuccess}
                      </Badge>
                    )}
                  </div>

                  <Textarea
                    placeholder="Enter internal verification remarks (e.g. Document verified against MCA registry. Awaiting secondary tax validation)..."
                    value={remarksInput}
                    onChange={(e) => setRemarksInput(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="text-xs bg-background"
                  />

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{remarksInput.length} / 1000 characters</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={savingRemarks}
                      onClick={handleSaveRemarks}
                      className="text-xs h-7 gap-1 cursor-pointer"
                    >
                      {savingRemarks ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      Save Remarks
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* DIALOG FOOTER WITH APPROVE / REJECT ACTIONS */}
          <DialogFooter className="p-6 pt-4 border-t border-border/80 sticky bottom-0 bg-background/95 backdrop-blur-xs flex sm:justify-between items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedAppId(null)}
              className="text-xs"
            >
              Close
            </Button>

            {isEligibleForReview && selectedApp && (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsRejectOpen(true)}
                  className="text-xs font-semibold gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject Application
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsApproveOpen(true)}
                  className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve Application
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. APPROVAL CONFIRMATION MODAL */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Approve Parking Owner
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This action promotes the applicant to the official Parking Owner role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-1.5">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Workflow Verification:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Promotes <strong>{selectedApp?.ownerName}</strong> to canonical{' '}
                  <code>PARKING_OWNER</code> role.
                </li>
                <li>Activates Owner Dashboard access.</li>
                <li>Sends confirmation email and creates in-app notification.</li>
                <li>
                  <strong>Does NOT</strong> create a Parking Lot or parking structure.
                </li>
              </ul>
            </div>

            {approveError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {approveError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="approveRemarks" className="text-xs font-medium">
                Admin Remarks (Optional)
              </Label>
              <Textarea
                id="approveRemarks"
                placeholder="Optional internal remarks for audit trail..."
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApproveOpen(false)}
              disabled={approveSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApproveSubmit}
              disabled={approveSubmitting}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {approveSubmitting ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. REJECTION MODAL */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Reject Parking Owner Application
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provide a clear, mandatory reason for the rejection to notify the applicant.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {rejectError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {rejectError}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="rejectionReason" className="text-xs font-medium text-destructive">
                  Rejection Reason (Required) *
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  {rejectionReason.length}/500 chars
                </span>
              </div>
              <Textarea
                id="rejectionReason"
                placeholder="State why the application is rejected (e.g., incomplete business license, invalid ID)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                maxLength={500}
                required
                className="text-xs border-destructive/50 focus-visible:ring-destructive"
              />
              <p className="text-[10px] text-muted-foreground">
                This explanation will be included in the automated notification and email sent to
                the applicant.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rejectRemarks" className="text-xs font-medium">
                Admin Remarks (Optional)
              </Label>
              <Textarea
                id="rejectRemarks"
                placeholder="Optional internal administrative notes..."
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRejectOpen(false)}
              disabled={rejectSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectSubmit}
              disabled={rejectSubmitting || !rejectionReason.trim()}
              className="text-xs font-semibold"
            >
              {rejectSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. SECURE DOCUMENT INSPECTOR MODAL */}
      <Dialog
        open={!!inspectingDoc}
        onOpenChange={(open) => {
          if (!open) {
            closeDocumentInspector();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border/80">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-primary" />
                  {inspectingDoc?.title}
                </DialogTitle>
                <DialogDescription className="text-xs font-mono text-muted-foreground truncate max-w-lg">
                  Stored Reference: {inspectingDoc?.urlOrPath}
                </DialogDescription>
              </div>

              {selectedApp && inspectingDoc && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1 cursor-pointer"
                    disabled={!docBlobUrl}
                    onClick={() => {
                      if (docBlobUrl) {
                        window.open(docBlobUrl, '_blank');
                      }
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in New Tab
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 bg-muted/30 flex flex-col items-center justify-center min-h-[350px]">
            {selectedApp && inspectingDoc && (
              <>
                {docLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Retrieving secure document preview...</p>
                  </div>
                ) : docError ? (
                  <div className="text-center p-6 space-y-3">
                    <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                    <p className="text-sm font-medium text-destructive">{docError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (inspectingDoc) {
                          openDocumentInspector(inspectingDoc);
                        }
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                ) : docBlobUrl ? (
                  docMimeType?.startsWith('image/') || isImageFile(inspectingDoc.urlOrPath) ? (
                    <div className="flex flex-col items-center gap-4 w-full">
                      {/* Zoom Toolbar */}
                      <div className="flex items-center gap-2 p-1.5 rounded-lg border border-border/80 bg-background/90 shadow-xs">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                          title="Zoom In"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[11px] font-mono w-12 text-center">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => setZoomLevel(1)}
                          title="Reset Zoom"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Image Container */}
                      <div className="max-w-full max-h-[55vh] overflow-auto flex items-center justify-center p-2">
                        <img
                          src={docBlobUrl}
                          alt={inspectingDoc.title}
                          style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'center center',
                          }}
                          className="transition-transform duration-150 max-h-[50vh] object-contain rounded border border-border/60 shadow-xs"
                        />
                      </div>
                    </div>
                  ) : docMimeType === 'application/pdf' || isPdfFile(inspectingDoc.urlOrPath) ? (
                    <div className="w-full h-[60vh] flex flex-col">
                      <iframe
                        src={docBlobUrl}
                        title={inspectingDoc.title}
                        className="w-full h-full rounded border border-border/80 bg-background"
                      />
                    </div>
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        Preview not directly embeddable for this format. Click below to download via
                        authorized stream.
                      </p>
                      <Button size="sm" asChild>
                        <a
                          href={docBlobUrl}
                          download={inspectingDoc.title}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Download Document
                        </a>
                      </Button>
                    </div>
                  )
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border/80 bg-background flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={closeDocumentInspector}
            >
              Close Inspector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
