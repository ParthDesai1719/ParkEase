import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  LogOut,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
  Users,
  UserX,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  activateOwner,
  approveOwnerApplication,
  exportOwnerApplicationsCsv,
  getDashboardOverview,
  getOwnerApplicationById,
  getOwnerApplicationDocumentBlob,
  getOwnerApplicationPayment,
  getOwnerApplications,
  rejectOwnerApplication,
  suspendOwner,
  updateOwnerApplicationRemarks,
  type DashboardOverviewMetrics,
  type OwnerApplicationItem,
  type OwnerPaymentDetails,
} from '@/api/admin.api';
import { useAuthStore } from '@/stores/authStore';
import { useLiveSync } from '@/hooks/useLiveSync';
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
import {
  openParkEasePdfPrintWindow,
  createPdfSectionBlock,
  createPdfManifestTable,
} from '@/lib/pdfThemeHelper';

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
  const currentFeeStatus = searchParams.get('feeStatus') || 'All';
  const currentAccountStatus = searchParams.get('accountStatus') || 'All';
  const currentApprovedFrom = searchParams.get('approvedFrom') || '';
  const currentApprovedTo = searchParams.get('approvedTo') || '';
  const currentPage = Number(searchParams.get('page')) || 1;

  // Applications & Pagination States
  const [applications, setApplications] = useState<OwnerApplicationItem[]>([]);
  const [totalApplications, setTotalApplications] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // KPI Metrics State
  const [kpiMetrics, setKpiMetrics] = useState<DashboardOverviewMetrics>({
    totalOwners: 0,
    pendingApprovals: 0,
    approvedOwners: 0,
    suspendedOwners: 0,
  });
  const [kpiLoading, setKpiLoading] = useState<boolean>(true);

  // Search input state (debounced asynchronously)
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

  // Payment Details Dialog state
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [paymentDetails, setPaymentDetails] = useState<OwnerPaymentDetails | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Suspend Owner Modal state
  const [isSuspendOpen, setIsSuspendOpen] = useState<boolean>(false);
  const [suspendTarget, setSuspendTarget] = useState<{
    id: string;
    ownerName: string;
    businessName: string;
    email: string;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [suspendLoading, setSuspendLoading] = useState<boolean>(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);

  // Reactivate Owner Modal state
  const [isActivateOpen, setIsActivateOpen] = useState<boolean>(false);
  const [activateTarget, setActivateTarget] = useState<{
    id: string;
    ownerName: string;
    businessName: string;
  } | null>(null);
  const [activateRemarks, setActivateRemarks] = useState<string>('');
  const [activateLoading, setActivateLoading] = useState<boolean>(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Export State
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);

  // Open Document Inspector
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

  // Load KPI overview metrics
  const loadKpis = useCallback(async () => {
    try {
      setKpiLoading(true);
      const res = await getDashboardOverview();
      if (res.success && res.data) {
        setKpiMetrics(res.data);
      }
    } catch {
      // Non-fatal
    } finally {
      setKpiLoading(false);
    }
  }, []);

  // Fetch applications list with all active filters
  const loadApplications = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await getOwnerApplications({
        status: currentStatus === 'All' ? undefined : currentStatus,
        search: currentSearch || undefined,
        feeStatus: currentFeeStatus === 'All' ? undefined : currentFeeStatus,
        accountStatus: currentAccountStatus === 'All' ? undefined : currentAccountStatus,
        approvedFrom: currentApprovedFrom || undefined,
        approvedTo: currentApprovedTo || undefined,
        page: currentPage,
        limit: 10,
      });

      if (res.success && res.data) {
        setApplications(res.data.applications);
        setTotalApplications(res.data.total);
        setTotalPages(res.data.totalPages || 1);
      } else if (!isSilent) {
        setError(res.message || 'Failed to load owner applications.');
      }
    } catch (err: unknown) {
      if (!isSilent) {
        setError(err instanceof Error ? err.message : 'Error loading applications.');
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [
    currentStatus,
    currentSearch,
    currentFeeStatus,
    currentAccountStatus,
    currentApprovedFrom,
    currentApprovedTo,
    currentPage,
  ]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useLiveSync(() => {
    void loadKpis();
    void loadApplications(true);
  });

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

  // Open Dedicated Payment Dialog
  const handleOpenPayment = async (id: string) => {
    setIsPaymentOpen(true);
    setPaymentLoading(true);
    setPaymentError(null);
    setPaymentDetails(null);
    try {
      const res = await getOwnerApplicationPayment(id);
      if (res.success && res.data) {
        setPaymentDetails(res.data);
      } else {
        setPaymentError(res.message || 'Failed to fetch payment details.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error retrieving payment details.';
      setPaymentError(msg);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Open Suspend Dialog
  const handleOpenSuspend = (app: OwnerApplicationItem) => {
    const email = typeof app.applicantId === 'object' ? app.applicantId?.email : app.businessEmail;
    setSuspendTarget({
      id: app._id,
      ownerName: app.ownerName,
      businessName: app.businessName,
      email,
    });
    setSuspendReason('');
    setSuspendError(null);
    setIsSuspendOpen(true);
  };

  // Submit Suspend
  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    const trimmed = suspendReason.trim();
    if (trimmed.length < 5) {
      setSuspendError('Suspension reason must be at least 5 characters.');
      return;
    }

    try {
      setSuspendLoading(true);
      setSuspendError(null);
      const res = await suspendOwner(suspendTarget.id, trimmed);
      if (res.success) {
        setIsSuspendOpen(false);
        setSuspendTarget(null);
        setSuspendReason('');
        await Promise.all([loadApplications(), loadKpis()]);
        if (selectedApp && selectedApp._id === suspendTarget.id) {
          await handleOpenDetail(suspendTarget.id);
        }
      } else {
        setSuspendError(res.message || 'Failed to suspend owner.');
      }
    } catch (err: unknown) {
      setSuspendError(err instanceof Error ? err.message : 'Error suspending owner.');
    } finally {
      setSuspendLoading(false);
    }
  };

  // Open Reactivate Dialog
  const handleOpenActivate = (app: OwnerApplicationItem) => {
    setActivateTarget({
      id: app._id,
      ownerName: app.ownerName,
      businessName: app.businessName,
    });
    setActivateRemarks('');
    setActivateError(null);
    setIsActivateOpen(true);
  };

  // Submit Reactivate
  const handleConfirmActivate = async () => {
    if (!activateTarget) return;

    try {
      setActivateLoading(true);
      setActivateError(null);
      const res = await activateOwner(activateTarget.id, activateRemarks.trim() || undefined);
      if (res.success) {
        setIsActivateOpen(false);
        setActivateTarget(null);
        setActivateRemarks('');
        await Promise.all([loadApplications(), loadKpis()]);
        if (selectedApp && selectedApp._id === activateTarget.id) {
          await handleOpenDetail(activateTarget.id);
        }
      } else {
        setActivateError(res.message || 'Failed to reactivate owner.');
      }
    } catch (err: unknown) {
      setActivateError(err instanceof Error ? err.message : 'Error reactivating owner.');
    } finally {
      setActivateLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const blob = await exportOwnerApplicationsCsv({
        status: currentStatus === 'All' ? undefined : currentStatus,
        search: currentSearch || undefined,
        feeStatus: currentFeeStatus === 'All' ? undefined : currentFeeStatus,
        accountStatus: currentAccountStatus === 'All' ? undefined : currentAccountStatus,
        approvedFrom: currentApprovedFrom || undefined,
        approvedTo: currentApprovedTo || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `owner-directory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to export CSV directory.');
    } finally {
      setExportingCsv(false);
    }
  };

  // Print / PDF Export (Official ParkEase Branded Manifest)
  const handlePrintPdf = () => {
    if (applications.length === 0) {
      alert('No owner records available in current view to export.');
      return;
    }

    const tableRows = applications.map((app) => {
      const ownerUser = typeof app.applicantId === 'object' && app.applicantId ? app.applicantId : null;
      const ownerName = app.ownerName || ownerUser?.fullName || 'N/A';
      const ownerEmail = app.businessEmail || ownerUser?.email || 'N/A';
      const ownerPhone = app.businessPhone || ownerUser?.mobileNumber || 'N/A';
      const feeStatus = app.paymentId ? 'Paid' : 'Unpaid';
      const accountStatus = ownerUser?.accountStatus || 'Active';
      const dateStr = app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—';

      const statusBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;${
        app.applicationStatus === 'Approved'
          ? 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
          : app.applicationStatus === 'Rejected'
          ? 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;'
          : 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;'
      }">${app.applicationStatus}</span>`;

      const feeBadge = `<span style="display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;${
        feeStatus === 'Paid'
          ? 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
          : 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;'
      }">${feeStatus === 'Paid' ? '₹999 Paid' : 'Pending'}</span>`;

      return [
        { content: app.applicationReference || app._id.slice(-8).toUpperCase(), isMono: true },
        { content: `<strong>${app.businessName}</strong><br/><span style="color:#64748b;font-size:10px;">${app.businessType}</span>` },
        { content: `<strong>${ownerName}</strong><br/><span style="color:#64748b;font-size:10px;">${ownerEmail}</span>` },
        { content: ownerPhone },
        { content: feeBadge, align: 'center' as const },
        { content: statusBadge, align: 'center' as const },
        { content: accountStatus, align: 'center' as const },
        { content: dateStr, align: 'right' as const },
      ];
    });

    const columns = [
      { header: 'Ref ID', width: '12%' },
      { header: 'Business / Entity', width: '22%' },
      { header: 'Owner / Contact', width: '22%' },
      { header: 'Phone', width: '12%' },
      { header: 'Fee Status', width: '10%', align: 'center' as const },
      { header: 'Review Status', width: '10%', align: 'center' as const },
      { header: 'Account', width: '8%', align: 'center' as const },
      { header: 'Created', width: '12%', align: 'right' as const },
    ];

    const tableHtml = createPdfManifestTable(columns, tableRows);

    openParkEasePdfPrintWindow({
      docTitle: 'Official Parking Owner Registry Manifest',
      docSubtitle: 'ParkEase Platform Administration & Partner Audit Ledger',
      documentId: `REG-MANIFEST-${new Date().toISOString().slice(0, 10)}`,
      statusPill: {
        text: `${currentStatus} (${applications.length} Records)`,
        variant: currentStatus === 'Approved' ? 'green' : currentStatus === 'Rejected' ? 'red' : 'blue',
      },
      metaCards: [
        { label: 'Total Owners', value: String(kpiMetrics.totalOwners), subtext: 'Registered across platform' },
        { label: 'Pending Approvals', value: String(kpiMetrics.pendingApprovals), subtext: 'Awaiting admin review' },
        { label: 'Approved Owners', value: String(kpiMetrics.approvedOwners), subtext: 'Active parking operators' },
        { label: 'Suspended Owners', value: String(kpiMetrics.suspendedOwners), subtext: 'Temporarily disabled' },
      ],
      bodyHtml: `
        <div style="margin-bottom:14px;font-size:12px;color:#475569;display:flex;justify-content:space-between;align-items:center;">
          <div><strong>Filter Scope:</strong> Status: ${currentStatus} &bull; Fee Status: ${currentFeeStatus} &bull; Account Status: ${currentAccountStatus}</div>
          <div>Page ${currentPage} of ${totalPages} (Total ${totalApplications} items)</div>
        </div>
        ${tableHtml}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management & Reservation System &bull; Admin Audit Directory',
        'Official record exported by authorized Administrator. Stored under IT compliance.',
      ],
    });
  };

  // Print / PDF Export for Dedicated Owner Payment Receipt
  const handlePrintPaymentReceipt = () => {
    if (!paymentDetails) return;

    const formattedAmount = `₹${Number(paymentDetails.amount).toFixed(2)}`;
    const paymentDateStr = paymentDetails.createdAt
      ? new Date(paymentDetails.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : 'N/A';

    const txSection = createPdfSectionBlock('Transaction & Gateway Information', [
      { label: 'Payment Reference', value: paymentDetails.paymentReference, isMono: true },
      { label: 'Payment Type', value: paymentDetails.paymentType || 'Parking Owner Registration Fee' },
      { label: 'Payment Method', value: paymentDetails.paymentMethod || 'Razorpay Online' },
      { label: 'Payment Status', value: paymentDetails.paymentStatus || 'Completed' },
      { label: 'Payment Recorded At', value: paymentDateStr },
      ...(paymentDetails.gatewayPaymentId
        ? [{ label: 'Gateway Payment ID', value: paymentDetails.gatewayPaymentId, isMono: true }]
        : []),
      ...(paymentDetails.gatewayOrderId
        ? [{ label: 'Gateway Order ID', value: paymentDetails.gatewayOrderId, isMono: true }]
        : []),
    ]);

    const partnerSection = createPdfSectionBlock('Partner Business & Account Information', [
      { label: 'Business / Facility Name', value: paymentDetails.businessName || 'N/A' },
      { label: 'Owner Full Name', value: paymentDetails.ownerName || 'N/A' },
      { label: 'Registered Email', value: paymentDetails.ownerEmail || 'N/A' },
      { label: 'Contact Phone', value: paymentDetails.ownerPhone || 'N/A' },
      { label: 'Application Reference', value: paymentDetails.applicationReference || 'N/A', isMono: true },
    ]);

    const settlementSection = createPdfSectionBlock('Financial Settlement Breakdown', [
      { label: 'Partner Onboarding & Verification Fee', value: formattedAmount },
      { label: 'Platform GST / Tax (Included)', value: '₹0.00' },
      { label: 'Total Amount Remitted', value: formattedAmount, isTotal: true },
    ]);

    openParkEasePdfPrintWindow({
      docTitle: 'Official Owner Registration Fee Receipt',
      docSubtitle: 'ParkEase Smart Parking Partner Network',
      documentId: paymentDetails.paymentReference,
      statusPill: {
        text: paymentDetails.paymentStatus || 'PAID',
        variant: 'green',
      },
      metaCards: [
        { label: 'Amount Paid', value: formattedAmount, subtext: '100% Verified' },
        { label: 'Payment Method', value: paymentDetails.paymentMethod || 'Razorpay', subtext: 'Gateway Verified' },
        { label: 'Application Ref', value: paymentDetails.applicationReference, subtext: 'Linked Dossier' },
        { label: 'Payment Status', value: paymentDetails.paymentStatus || 'SUCCESS', subtext: 'Settled' },
      ],
      bodyHtml: `
        ${txSection}
        ${partnerSection}
        ${settlementSection}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management & Reservation System &bull; Official Partner Onboarding Receipt',
        'Customer / Partner Support: support@parkease.com &nbsp;|&nbsp; Web: www.parkease.com',
        'This is a computer-generated tax-compliant invoice receipt for the mandatory ₹999 non-refundable partner onboarding & verification fee.',
      ],
    });
  };

  // Print / PDF Export for Owner Application Dossier
  const handlePrintApplicationDossier = () => {
    if (!selectedApp) return;

    const ownerUser = typeof selectedApp.applicantId === 'object' && selectedApp.applicantId ? selectedApp.applicantId : null;
    const ownerName = selectedApp.ownerName || ownerUser?.fullName || 'N/A';
    const ownerEmail = selectedApp.businessEmail || ownerUser?.email || 'N/A';
    const ownerPhone = selectedApp.businessPhone || ownerUser?.mobileNumber || 'N/A';
    const dateSubmitted = selectedApp.submittedAt || selectedApp.createdAt
      ? new Date(selectedApp.submittedAt || selectedApp.createdAt).toLocaleString('en-IN')
      : 'N/A';
    const dateReviewed = selectedApp.reviewedAt
      ? new Date(selectedApp.reviewedAt).toLocaleString('en-IN')
      : 'Pending Review';

    const businessSection = createPdfSectionBlock('Business & Facility Entity Profile', [
      { label: 'Business Entity Name', value: selectedApp.businessName },
      { label: 'Business Type', value: selectedApp.businessType },
      { label: 'Operating Address', value: `${selectedApp.businessAddress}, ${selectedApp.city}, ${selectedApp.state} - ${selectedApp.postalCode}` },
      { label: 'Stated Parking Capacity', value: `${selectedApp.parkingCapacity || 0} Vehicle Bays` },
      { label: 'Business Description', value: selectedApp.businessDescription || 'Commercial Parking Facility' },
    ]);

    const ownerSection = createPdfSectionBlock('Owner Identity & Verification Status', [
      { label: 'Owner Full Name', value: ownerName },
      { label: 'Business Email', value: ownerEmail },
      { label: 'Mobile Number', value: ownerPhone },
      { label: 'Government ID Type', value: selectedApp.governmentIdType || 'Government ID' },
      { label: 'Government ID Number', value: selectedApp.governmentIdNumber ? `•••• •••• ${selectedApp.governmentIdNumber.slice(-4)}` : 'Verified on File', isMono: true },
      { label: 'Email Verified', value: selectedApp.emailOtpVerified ? 'Yes (OTP Verified)' : 'Pending' },
      { label: 'Mobile Verified', value: selectedApp.mobileOtpVerified ? 'Yes (OTP Verified)' : 'Pending' },
      { label: 'Terms & Conditions Accepted', value: selectedApp.termsAccepted ? 'Accepted' : 'Pending' },
    ]);

    const reviewSection = createPdfSectionBlock('Administrative Review & Audit Trail', [
      { label: 'Application Status', value: selectedApp.applicationStatus },
      { label: 'Registration Fee (₹999)', value: selectedApp.paymentId ? 'Paid (Verified)' : 'Pending Payment' },
      { label: 'Submission Timestamp', value: dateSubmitted },
      { label: 'Review Timestamp', value: dateReviewed },
      { label: 'Reviewing Officer', value: selectedApp.reviewedBy?.fullName || selectedApp.reviewedBy?.email || 'Admin Team' },
      { label: 'Admin Audit Remarks', value: selectedApp.adminRemarks || 'None recorded' },
      ...(selectedApp.rejectionReason
        ? [{ label: 'Rejection Reason', value: selectedApp.rejectionReason }]
        : []),
    ]);

    openParkEasePdfPrintWindow({
      docTitle: 'Owner Onboarding Application Dossier',
      docSubtitle: 'ParkEase Partner Review & Verification Document',
      documentId: selectedApp.applicationReference || selectedApp._id,
      statusPill: {
        text: selectedApp.applicationStatus,
        variant: selectedApp.applicationStatus === 'Approved' ? 'green' : selectedApp.applicationStatus === 'Rejected' ? 'red' : 'blue',
      },
      metaCards: [
        { label: 'Entity Name', value: selectedApp.businessName, subtext: selectedApp.businessType },
        { label: 'Owner Name', value: ownerName, subtext: ownerEmail },
        { label: 'Capacity', value: `${selectedApp.parkingCapacity} Bays`, subtext: `${selectedApp.city}, ${selectedApp.state}` },
        { label: 'Registration Fee', value: selectedApp.paymentId ? '₹999 Paid' : 'Unpaid', subtext: selectedApp.applicationStatus },
      ],
      bodyHtml: `
        ${businessSection}
        ${ownerSection}
        ${reviewSection}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management & Reservation System &bull; Confidential Partner Dossier',
        'Official record for compliance, regulatory records, and partner verification.',
      ],
    });
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
    nextParams.set('page', '1');
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
        nextParams.set('page', '1');
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
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  // Filter dropdown changes
  const handleFeeStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextParams = new URLSearchParams(searchParams);
    if (e.target.value === 'All') {
      nextParams.delete('feeStatus');
    } else {
      nextParams.set('feeStatus', e.target.value);
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handleAccountStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextParams = new URLSearchParams(searchParams);
    if (e.target.value === 'All') {
      nextParams.delete('accountStatus');
    } else {
      nextParams.set('accountStatus', e.target.value);
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handleDateChange = (field: 'approvedFrom' | 'approvedTo', val: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (val) {
      nextParams.set(field, val);
    } else {
      nextParams.delete(field);
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handleClearDates = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('approvedFrom');
    nextParams.delete('approvedTo');
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(newPage));
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
        await Promise.all([loadApplications(), loadKpis()]);
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
        await Promise.all([loadApplications(), loadKpis()]);
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

  // Helper for Account Status badge
  const renderAccountBadge = (app: OwnerApplicationItem) => {
    const applicant = typeof app.applicantId === 'object' ? app.applicantId : null;
    const accountStatus = applicant?.accountStatus;

    if (app.applicationStatus !== 'Approved') {
      return (
        <Badge variant="outline" className="text-muted-foreground text-[10px]">
          Pending Approval
        </Badge>
      );
    }

    if (accountStatus === 'Suspended') {
      return (
        <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 gap-1 hover:bg-red-500/20 text-[10px]">
          <ShieldAlert className="h-3 w-3" />
          Suspended
        </Badge>
      );
    }

    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 hover:bg-emerald-500/20 text-[10px]">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </Badge>
    );
  };

  const isEligibleForReview =
    selectedApp?.applicationStatus === 'Pending Review' ||
    selectedApp?.applicationStatus === 'Submitted';

  const selectedApplicant = typeof selectedApp?.applicantId === 'object' ? selectedApp.applicantId : null;
  const isSelectedOwnerApproved = selectedApp?.applicationStatus === 'Approved';
  const isSelectedOwnerSuspended = selectedApplicant?.accountStatus === 'Suspended';
  const applicantUserId = selectedApplicant?._id || (typeof selectedApp?.applicantId === 'string' ? selectedApp.applicantId : '');

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
              Parking Owner Lifecycle &amp; Applications
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm mt-1">
              Review submitted credentials, verify platform registration fees (₹999), govern active accounts, and inspect associated parking facilities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading}
              className="gap-1.5 text-xs h-9"
              title="Export filtered directory to CSV"
            >
              <Download className={`h-4 w-4 ${exportingCsv ? 'animate-spin' : ''}`} />
              Export CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPdf}
              className="gap-1.5 text-xs h-9"
              title="Print or save as PDF"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="gap-1.5 font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors text-xs h-9"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </Button>
          </div>
        </div>

        {/* Unified People Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border/80 pb-2 mt-4">
          <Link
            to="/admin/users"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            Customers
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-xs">
            <Building className="h-3.5 w-3.5" />
            Parking Owners
          </div>
          <Link
            to="/admin/staff"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Security Staff
          </Link>
        </div>
      </div>

      {/* 2. OWNER KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Owners */}
        <Card className="border-border/80 bg-card shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Owners</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">
                {kpiLoading ? <Skeleton className="h-8 w-16" /> : kpiMetrics.totalOwners}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Platform registered</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Pending Approvals</p>
              <h3 className="text-2xl font-bold tracking-tight text-amber-800 dark:text-amber-300 mt-1">
                {kpiLoading ? <Skeleton className="h-8 w-16" /> : kpiMetrics.pendingApprovals}
              </h3>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Requires review</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Approved Owners */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Approved Owners</p>
              <h3 className="text-2xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 mt-1">
                {kpiLoading ? <Skeleton className="h-8 w-16" /> : kpiMetrics.approvedOwners}
              </h3>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Credentials approved</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Suspended Owners */}
        <Card className="border-red-500/30 bg-red-500/5 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Suspended Owners</p>
              <h3 className="text-2xl font-bold tracking-tight text-red-800 dark:text-red-300 mt-1">
                {kpiLoading ? <Skeleton className="h-8 w-16" /> : kpiMetrics.suspendedOwners}
              </h3>
              <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">Access revoked</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. SEARCH & ADVANCED FILTER TOOLBAR */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="p-4 space-y-3">
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

            {/* Live Debounced Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search ref, business, owner, city, payment ID..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 text-xs h-9 bg-background"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <Button type="submit" size="sm" variant="secondary" className="h-9 text-xs px-3 shrink-0">
                Search
              </Button>
            </form>
          </div>

          {/* Secondary Filters: Fee Status, Account Status, Date Range */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">Filters:</span>
            </div>

            {/* Fee Status Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="feeStatusSelect" className="text-[11px]">Fee Status:</label>
              <select
                id="feeStatusSelect"
                value={currentFeeStatus}
                onChange={handleFeeStatusChange}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="All">All Fees</option>
                <option value="Paid">Paid / Success</option>
                <option value="Pending">Pending Payment</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            {/* Account Status Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="accountStatusSelect" className="text-[11px]">Account Status:</label>
              <select
                id="accountStatusSelect"
                value={currentAccountStatus}
                onChange={handleAccountStatusChange}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="All">All Accounts</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Pending Approval">Pending Approval</option>
              </select>
            </div>

            {/* Approval Date Range */}
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px]">Approval Date:</span>
              <input
                type="date"
                value={currentApprovedFrom}
                onChange={(e) => handleDateChange('approvedFrom', e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                title="Approved From"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={currentApprovedTo}
                onChange={(e) => handleDateChange('approvedTo', e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                title="Approved To"
              />
              {(currentApprovedFrom || currentApprovedTo) && (
                <button
                  type="button"
                  onClick={handleClearDates}
                  className="text-[11px] text-destructive hover:underline ml-1 cursor-pointer"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ERROR ALERT */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center justify-between py-4 px-6 text-destructive">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadApplications()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. APPLICATIONS DATA TABLE */}
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
                  <th className="py-3.5 px-4">Application</th>
                  <th className="py-3.5 px-4">Account</th>
                  <th className="py-3.5 px-4">Submitted</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
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
                        <td className="py-4 px-4 space-y-1">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-3 w-20" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-5 w-20" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-5 w-16" />
                        </td>
                        <td className="py-4 px-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="py-4 px-4 text-right">
                          <Skeleton className="h-8 w-24 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </>
                )}

                {/* CANONICAL EMPTY STATE */}
                {!loading && applications.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 px-4 text-center">
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
                          {currentSearch || currentFeeStatus !== 'All' || currentAccountStatus !== 'All'
                            ? 'No records match the active filter criteria. Try resetting search filters.'
                            : currentStatus === 'Pending Review'
                              ? 'All partner registration submissions have been reviewed and processed.'
                              : 'No records exist under the selected category.'}
                        </p>
                        {(currentSearch || currentFeeStatus !== 'All' || currentAccountStatus !== 'All' || currentApprovedFrom || currentApprovedTo) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleClearSearch();
                              const nextParams = new URLSearchParams();
                              if (currentStatus !== 'All') nextParams.set('status', currentStatus);
                              setSearchParams(nextParams);
                            }}
                            className="mt-2 text-xs"
                          >
                            Reset Filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {/* REAL PERSISTED APPLICATIONS ROWS */}
                {!loading &&
                  applications.map((app) => {
                    const applicant = typeof app.applicantId === 'object' ? app.applicantId : null;
                    const isApproved = app.applicationStatus === 'Approved';
                    const isSuspended = applicant?.accountStatus === 'Suspended';

                    return (
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
                          <div className="flex items-center gap-1 mt-0.5">
                            {app.paymentId?.paymentStatus ? (
                              <span
                                className={`text-[10px] font-medium ${
                                  app.paymentId.paymentStatus === 'SUCCESSFUL' ||
                                  app.paymentId.paymentStatus === 'Success'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {app.paymentId.paymentStatus}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Paid</span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleOpenPayment(app._id);
                              }}
                              className="text-[10px] text-primary hover:underline ml-1 font-medium inline-flex items-center gap-0.5"
                              title="View Payment Details"
                            >
                              <CreditCard className="h-2.5 w-2.5" />
                              Details
                            </button>
                          </div>
                        </td>

                        {/* Application Status Badge */}
                        <td className="py-3.5 px-4">{renderStatusBadge(app.applicationStatus)}</td>

                        {/* Account Status Badge */}
                        <td className="py-3.5 px-4">{renderAccountBadge(app)}</td>

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

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDetail(app._id)}
                              className="text-xs h-7 gap-1"
                              title="Review Application"
                            >
                              <Eye className="h-3 w-3" />
                              Review
                            </Button>

                            {/* View Payment Action */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenPayment(app._id)}
                              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                              title="View Payment Details"
                            >
                              <CreditCard className="h-3.5 w-3.5 text-primary" />
                            </Button>

                            {/* Suspend / Reactivate Actions for Approved Owners */}
                            {isApproved && (
                              <>
                                {isSuspended ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenActivate(app)}
                                    className="text-xs h-7 px-2 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                                    title="Reactivate Owner Account"
                                  >
                                    <UserCheck className="h-3 w-3" />
                                    Activate
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenSuspend(app)}
                                    className="text-xs h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                                    title="Suspend Owner Account"
                                  >
                                    <UserX className="h-3 w-3" />
                                    Suspend
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER WITH PAGINATION */}
          {!loading && applications.length > 0 && (
            <div className="py-3 px-4 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                Showing {applications.length} of {totalApplications} record
                {totalApplications > 1 ? 's' : ''} (Page {currentPage} of {totalPages})
              </span>

              {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="text-xs h-7 px-2.5"
                >
                  Previous
                </Button>
                <span className="text-[11px] font-mono px-1">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="text-xs h-7 px-2.5"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. APPLICATION DETAIL & REVIEW DIALOG */}
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
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                          Application Approved
                        </p>
                        {isSelectedOwnerSuspended && (
                          <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                            Account Suspended
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5">
                        This applicant has been granted the Parking Owner role.
                        {isSelectedOwnerSuspended
                          ? ' Note: The account is currently suspended; active sessions are revoked.'
                          : ' Partner dashboard access is active.'}
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
                      <span className="text-muted-foreground">Full Name:</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedApp.ownerName}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium text-foreground mt-0.5">{selectedApp.businessEmail}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Mobile Phone:</span>
                      <p className="font-medium text-foreground mt-0.5">{selectedApp.businessPhone}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Government ID:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {selectedApp.governmentIdType}: {maskGovernmentId(selectedApp.governmentIdNumber)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SECTION B: BUSINESS & FACILITY INFORMATION */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-primary" />
                    B. Business &amp; Proposed Facility
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-border/80 bg-muted/10 text-xs">
                    <div>
                      <span className="text-muted-foreground">Business Legal Name:</span>
                      <p className="font-semibold text-foreground mt-0.5">{selectedApp.businessName}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Business Entity Type:</span>
                      <p className="font-medium text-foreground mt-0.5">{selectedApp.businessType}</p>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Facility Address:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {selectedApp.businessAddress}, {selectedApp.city}, {selectedApp.state} -{' '}
                        {selectedApp.postalCode}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Initial Parking Capacity:</span>
                      <p className="font-semibold text-foreground mt-0.5">
                        {selectedApp.parkingCapacity} vehicle slots
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Application Reference:</span>
                      <p className="font-mono text-foreground mt-0.5">
                        {selectedApp.applicationReference}
                      </p>
                    </div>

                    {selectedApp.businessDescription && (
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Business Description:</span>
                        <p className="mt-1 text-foreground leading-relaxed p-2.5 rounded bg-background/50 border border-border/50">
                          {selectedApp.businessDescription}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION C: SUBMITTED DOCUMENTS */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileCheck2 className="h-4 w-4 text-primary" />
                    C. Verification Documents
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Identity Proof */}
                    <div className="p-3.5 rounded-lg border border-border/80 bg-muted/10 space-y-2 text-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">Identity Proof</span>
                          <Badge variant="outline" className="text-[10px]">
                            {selectedApp.governmentIdType || 'Government ID'}
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground mt-1 truncate">
                          {selectedApp.identityProofUrl || 'No document on file'}
                        </p>
                      </div>

                      {selectedApp.identityProofUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            openDocumentInspector({
                              title: `Identity Proof — ${selectedApp.ownerName}`,
                              docType: 'identityProof',
                              urlOrPath: selectedApp.identityProofUrl,
                            })
                          }
                          className="w-full text-xs h-7 gap-1 mt-2 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect Document
                        </Button>
                      )}
                    </div>

                    {/* Business License */}
                    <div className="p-3.5 rounded-lg border border-border/80 bg-muted/10 space-y-2 text-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">Business License</span>
                          <Badge variant="outline" className="text-[10px]">
                            Registration
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground mt-1 truncate">
                          {selectedApp.businessLicenseUrl || 'No document on file'}
                        </p>
                      </div>

                      {selectedApp.businessLicenseUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            openDocumentInspector({
                              title: `Business License — ${selectedApp.businessName}`,
                              docType: 'businessLicense',
                              urlOrPath: selectedApp.businessLicenseUrl,
                            })
                          }
                          className="w-full text-xs h-7 gap-1 mt-2 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect Document
                        </Button>
                      )}
                    </div>

                    {/* Property Ownership Proof */}
                    <div className="p-3.5 rounded-lg border border-border/80 bg-muted/10 space-y-2 text-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">Property Ownership</span>
                          <Badge variant="outline" className="text-[10px]">
                            Title / Lease
                          </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground mt-1 truncate">
                          {selectedApp.propertyProofUrl || 'No document on file'}
                        </p>
                      </div>

                      {selectedApp.propertyProofUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            openDocumentInspector({
                              title: `Property Proof — ${selectedApp.businessName}`,
                              docType: 'propertyProof',
                              urlOrPath: selectedApp.propertyProofUrl,
                            })
                          }
                          className="w-full text-xs h-7 gap-1 mt-2 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect Document
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Parking Facility Images Gallery */}
                  {selectedApp.parkingImageUrls && selectedApp.parkingImageUrls.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-medium text-foreground">
                        Facility Site Photos ({selectedApp.parkingImageUrls.length}):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {selectedApp.parkingImageUrls.map((imgUrl, index) => (
                          <div
                            key={index}
                            className="p-2 rounded-lg border border-border/80 bg-muted/10 space-y-1 text-center"
                          >
                            <div className="text-[11px] font-medium text-foreground">
                              Photo #{index + 1}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                openDocumentInspector({
                                  title: `Facility Image #${index + 1} — ${selectedApp.businessName}`,
                                  docType: 'parkingImage',
                                  index,
                                  urlOrPath: imgUrl,
                                })
                              }
                              className="w-full text-xs h-7 gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION D: REGISTRATION PAYMENT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-primary" />
                      D. Platform Registration Fee
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleOpenPayment(selectedApp._id)}
                      className="text-xs h-7 gap-1"
                    >
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      View Full Payment
                    </Button>
                  </div>

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

                {/* SECTION F: ASSOCIATED PARKING FACILITIES */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-primary" />
                    F. Associated Parking Facilities &amp; Submissions
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Total Lots */}
                    <div
                      onClick={() => {
                        if (applicantUserId) {
                          navigate(`/admin/parking-lots?ownerId=${applicantUserId}`);
                        }
                      }}
                      className="p-3 rounded-lg border border-border/80 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors"
                    >
                      <span className="text-[11px] text-muted-foreground">Total Lots</span>
                      <p className="text-lg font-bold text-foreground mt-0.5">
                        {selectedApp.facilitiesSummary?.totalLots ?? 0}
                      </p>
                      <span className="text-[10px] text-primary hover:underline">View in lots →</span>
                    </div>

                    {/* Active Lots */}
                    <div
                      onClick={() => {
                        if (applicantUserId) {
                          navigate(`/admin/parking-lots?ownerId=${applicantUserId}&status=Active`);
                        }
                      }}
                      className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                    >
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">Active Lots</span>
                      <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                        {selectedApp.facilitiesSummary?.activeLots ?? 0}
                      </p>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline">Filter active →</span>
                    </div>

                    {/* Suspended Lots */}
                    <div
                      onClick={() => {
                        if (applicantUserId) {
                          navigate(`/admin/parking-lots?ownerId=${applicantUserId}&status=Suspended`);
                        }
                      }}
                      className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-colors"
                    >
                      <span className="text-[11px] text-red-700 dark:text-red-400">Suspended Lots</span>
                      <p className="text-lg font-bold text-red-800 dark:text-red-300 mt-0.5">
                        {selectedApp.facilitiesSummary?.suspendedLots ?? 0}
                      </p>
                      <span className="text-[10px] text-red-600 dark:text-red-400 hover:underline">Filter suspended →</span>
                    </div>

                    {/* Pending Submissions */}
                    <div
                      onClick={() => {
                        if (applicantUserId) {
                          navigate(`/admin/facilities?ownerId=${applicantUserId}`);
                        }
                      }}
                      className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-colors"
                    >
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">Pending Review</span>
                      <p className="text-lg font-bold text-amber-800 dark:text-amber-300 mt-0.5">
                        {selectedApp.facilitiesSummary?.pendingSubmissions ?? 0}
                      </p>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">View submissions →</span>
                    </div>
                  </div>
                </div>

                {/* SECTION G: ADMIN REMARKS & AUDIT NOTES */}
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

          {/* DIALOG FOOTER WITH APPROVE / REJECT / SUSPEND ACTIONS */}
          <DialogFooter className="p-6 pt-4 border-t border-border/80 sticky bottom-0 bg-background/95 backdrop-blur-xs flex sm:justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAppId(null)}
                className="text-xs"
              >
                Close
              </Button>

              {selectedApp && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintApplicationDossier}
                  className="gap-1.5 text-xs h-8"
                  title="Print official review dossier PDF"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Dossier (PDF)
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* If eligible for initial review (Pending Review) */}
              {isEligibleForReview && selectedApp && (
                <>
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
                </>
              )}

              {/* If already approved, show Suspend or Reactivate */}
              {isSelectedOwnerApproved && selectedApp && (
                <>
                  {isSelectedOwnerSuspended ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenActivate(selectedApp)}
                      className="text-xs font-semibold border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 gap-1"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Reactivate Account
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleOpenSuspend(selectedApp)}
                      className="text-xs font-semibold gap-1"
                    >
                      <UserX className="h-3.5 w-3.5" />
                      Suspend Account
                    </Button>
                  )}
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. APPROVAL CONFIRMATION MODAL */}
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

      {/* 7. REJECTION MODAL */}
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
                the applicant. Note: Registration fees are governed by the platform refund policy.
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

      {/* 8. SUSPEND OWNER MODAL */}
      <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Suspend Parking Owner Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Revoke partner privileges and immediately terminate all active sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {suspendTarget && (
              <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                <p className="font-semibold text-foreground">{suspendTarget.ownerName}</p>
                <p className="text-muted-foreground">{suspendTarget.businessName}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{suspendTarget.email}</p>
              </div>
            )}

            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 space-y-1">
              <p className="font-semibold text-red-700 dark:text-red-400">Security &amp; Operational Impact:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>All active web sessions in the database will be immediately revoked.</li>
                <li>Authentication requests will be rejected with HTTP 403 Forbidden.</li>
                <li>Access to the Parking Owner Dashboard is fully blocked.</li>
                <li>An automated security notice is dispatched via email and in-app alert.</li>
              </ul>
            </div>

            {suspendError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {suspendError}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="suspendReason" className="text-xs font-medium text-destructive">
                  Mandatory Suspension Reason *
                </Label>
                <span className="text-[10px] text-muted-foreground">min 5 chars</span>
              </div>
              <Textarea
                id="suspendReason"
                placeholder="State specific reason (e.g. Repeated violation of safety standards, pending legal dispute, unauthorized fee escalation)..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                required
                className="text-xs border-destructive/50 focus-visible:ring-destructive"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSuspendOpen(false)}
              disabled={suspendLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmSuspend}
              disabled={suspendLoading || suspendReason.trim().length < 5}
              className="text-xs font-semibold"
            >
              {suspendLoading ? 'Suspending...' : 'Confirm Suspension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. REACTIVATE OWNER MODAL */}
      <Dialog open={isActivateOpen} onOpenChange={setIsActivateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              Reactivate Parking Owner Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Restore partner dashboard access and permit authenticated operations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {activateTarget && (
              <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1">
                <p className="font-semibold text-foreground">{activateTarget.ownerName}</p>
                <p className="text-muted-foreground">{activateTarget.businessName}</p>
              </div>
            )}

            <p className="text-muted-foreground">
              Reactivating this account resets <code>accountStatus</code> to <strong>Active</strong>. The owner will be notified via email and in-app alert, allowing them to sign in again.
            </p>

            {activateError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {activateError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="activateRemarks" className="text-xs font-medium">
                Administrative Notes (Optional)
              </Label>
              <Textarea
                id="activateRemarks"
                placeholder="Optional explanation for reactivation (e.g. Compliance documents verified, review completed)..."
                value={activateRemarks}
                onChange={(e) => setActivateRemarks(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActivateOpen(false)}
              disabled={activateLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmActivate}
              disabled={activateLoading}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {activateLoading ? 'Reactivating...' : 'Confirm Reactivation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 10. DEDICATED VIEW PAYMENT DETAILS DIALOG */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Registration Fee Payment Record
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Auditable ledger transaction details for ₹999 platform registration fee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {paymentLoading && (
              <div className="space-y-3 py-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {paymentError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {paymentError}
              </div>
            )}

            {!paymentLoading && paymentDetails && (
              <div className="space-y-3">
                <div className="p-4 rounded-lg border border-border/80 bg-muted/10 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <span className="text-muted-foreground text-[11px]">Transaction Reference:</span>
                      <p className="font-mono font-bold text-sm text-foreground">
                        {paymentDetails.paymentReference}
                      </p>
                    </div>
                    <Badge
                      className={
                        paymentDetails.paymentStatus === 'SUCCESSFUL' ||
                        paymentDetails.paymentStatus === 'Success'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }
                    >
                      {paymentDetails.paymentStatus}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-muted-foreground text-[11px]">Fee Type:</span>
                      <p className="font-medium text-foreground">{paymentDetails.paymentType}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[11px]">Total Amount:</span>
                      <p className="font-bold text-base text-foreground">
                        ₹{paymentDetails.amount} {paymentDetails.currency}
                      </p>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[11px]">Payment Method:</span>
                      <p className="font-medium text-foreground">{paymentDetails.paymentMethod}</p>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[11px]">Recorded At:</span>
                      <p className="text-foreground">
                        {paymentDetails.createdAt
                          ? new Date(paymentDetails.createdAt).toLocaleString()
                          : '—'}
                      </p>
                    </div>

                    {paymentDetails.gatewayPaymentId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-[11px]">Gateway Payment ID:</span>
                        <p className="font-mono text-[11px] text-foreground">
                          {paymentDetails.gatewayPaymentId}
                        </p>
                      </div>
                    )}

                    {paymentDetails.gatewayOrderId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-[11px]">Gateway Order ID:</span>
                        <p className="font-mono text-[11px] text-foreground">
                          {paymentDetails.gatewayOrderId}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Associated Owner & Application context */}
                <div className="p-3.5 rounded-lg border border-border/80 bg-background space-y-1.5">
                  <span className="font-semibold text-foreground text-[11px]">Associated Partner Application:</span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                    <div>
                      <span>Business:</span> <strong className="text-foreground">{paymentDetails.businessName}</strong>
                    </div>
                    <div>
                      <span>Owner:</span> <strong className="text-foreground">{paymentDetails.ownerName}</strong>
                    </div>
                    <div>
                      <span>Email:</span> {paymentDetails.ownerEmail}
                    </div>
                    <div>
                      <span>Application Ref:</span> <span className="font-mono">{paymentDetails.applicationReference}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:justify-between items-center gap-2">
            {paymentDetails && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintPaymentReceipt}
                className="gap-1.5 text-xs h-8"
                title="Print or download official payment receipt PDF"
              >
                <Printer className="h-3.5 w-3.5" />
                Download Receipt (PDF)
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaymentOpen(false)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 11. SECURE DOCUMENT INSPECTOR MODAL */}
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
