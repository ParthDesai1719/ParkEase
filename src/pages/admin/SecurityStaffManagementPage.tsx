import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  History,
  MapPin,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  adminStaffApi,
  type AdminStaffDetailData,
  type AdminStaffItem,
  type AdminStaffOverview,
  type OwnerOption,
  type ParkingLotOption,
} from '@/api/adminStaff.api';
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
import { Textarea } from '@/components/ui/textarea';
import {
  createPdfManifestTable,
  createPdfSectionBlock,
  openParkEasePdfPrintWindow,
} from '@/lib/pdfThemeHelper';

export const SecurityStaffManagementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter state synced with URL
  const currentSearch = searchParams.get('search') || '';
  const currentOwner = searchParams.get('ownerId') || 'All';
  const currentLot = searchParams.get('lotId') || 'All';
  const currentStatus = searchParams.get('status') || 'All';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentLimit = Number(searchParams.get('limit')) || 10;

  // Overview metrics state
  const [overview, setOverview] = useState<AdminStaffOverview>({
    totalSecurityStaff: 0,
    activeSecurityStaff: 0,
    suspendedSecurityStaff: 0,
    recentlyAddedStaff: 0,
  });
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);

  // Directory listing state
  const [staffList, setStaffList] = useState<AdminStaffItem[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [listLoading, setListLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);

  // Dropdown options
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [lotOptions, setLotOptions] = useState<ParkingLotOption[]>([]);

  // Local search input for 350ms debounced search
  const [searchInput, setSearchInput] = useState<string>(currentSearch);

  // Detail Modal state
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffDetail, setStaffDetail] = useState<AdminStaffDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Create Staff Modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    ownerId: '',
    parkingLotId: '',
    employeeId: '',
    assignmentReason: '',
  });
  const [createLots, setCreateLots] = useState<ParkingLotOption[]>([]);
  const [createLotsLoading, setCreateLotsLoading] = useState<boolean>(false);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Staff Modal state
  const [editTarget, setEditTarget] = useState<AdminStaffItem | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', mobileNumber: '', employeeId: '' });
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Suspend Staff Modal state
  const [suspendTarget, setSuspendTarget] = useState<AdminStaffItem | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [suspendSubmitting, setSuspendSubmitting] = useState<boolean>(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);

  // Activate Staff Modal state
  const [activateTarget, setActivateTarget] = useState<AdminStaffItem | null>(null);
  const [activateSubmitting, setActivateSubmitting] = useState<boolean>(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Transfer Facility Modal state
  const [transferTarget, setTransferTarget] = useState<AdminStaffItem | null>(null);
  const [transferForm, setTransferForm] = useState({
    newOwnerId: '',
    newParkingLotId: '',
    transferReason: '',
  });
  const [transferLots, setTransferLots] = useState<ParkingLotOption[]>([]);
  const [transferLotsLoading, setTransferLotsLoading] = useState<boolean>(false);
  const [transferSubmitting, setTransferSubmitting] = useState<boolean>(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Delete Staff Modal state
  const [deleteTarget, setDeleteTarget] = useState<AdminStaffItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 1. Fetch Overview KPIs
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await adminStaffApi.getStaffOverview();
      setOverview(data);
    } catch (err: unknown) {
      console.warn('Failed to load staff overview KPIs:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // 2. Fetch Dropdown Options (Owners and initial Lots)
  const fetchOptions = useCallback(async () => {
    try {
      const [owners, lots] = await Promise.all([
        adminStaffApi.getOwnerOptions(),
        adminStaffApi.getParkingLotOptions(),
      ]);
      setOwnerOptions(owners);
      setLotOptions(lots);
    } catch (err: unknown) {
      console.warn('Failed to fetch filter options:', err);
    }
  }, []);

  // 3. Fetch Directory List
  const fetchStaffList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await adminStaffApi.getStaffList({
        page: currentPage,
        limit: currentLimit,
        search: currentSearch,
        ownerId: currentOwner,
        parkingLotId: currentLot,
        status: currentStatus,
      });
      setStaffList(res.staff);
      setTotalRecords(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve staff directory.';
      setListError(msg);
    } finally {
      setListLoading(false);
    }
  }, [currentPage, currentLimit, currentSearch, currentOwner, currentLot, currentStatus]);

  // Initial load
  useEffect(() => {
    void fetchOverview();
    void fetchOptions();
  }, [fetchOverview, fetchOptions]);

  // Load staff list when URL query parameters change
  useEffect(() => {
    void fetchStaffList();
  }, [fetchStaffList]);

  useLiveSync(() => {
    void fetchOverview();
    void fetchStaffList();
  });

  // 350ms Debounced search synchronization
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        const next = new URLSearchParams(searchParams);
        if (searchInput.trim()) {
          next.set('search', searchInput.trim());
        } else {
          next.delete('search');
        }
        next.set('page', '1');
        setSearchParams(next);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, searchParams, setSearchParams]);

  // When owner filter changes, update available lots in filter
  const handleOwnerFilterChange = async (ownerId: string) => {
    const next = new URLSearchParams(searchParams);
    if (ownerId && ownerId !== 'All') {
      next.set('ownerId', ownerId);
    } else {
      next.delete('ownerId');
    }
    next.delete('lotId');
    next.set('page', '1');
    setSearchParams(next);

    // Refresh lots dropdown for this owner
    try {
      const lots = await adminStaffApi.getParkingLotOptions(ownerId !== 'All' ? ownerId : undefined);
      setLotOptions(lots);
    } catch (e) {
      console.warn('Failed to load lots for owner filter:', e);
    }
  };

  const handleLotFilterChange = (lotId: string) => {
    const next = new URLSearchParams(searchParams);
    if (lotId && lotId !== 'All') {
      next.set('lotId', lotId);
    } else {
      next.delete('lotId');
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleStatusFilterChange = (status: string) => {
    const next = new URLSearchParams(searchParams);
    if (status && status !== 'All') {
      next.set('status', status);
    } else {
      next.delete('status');
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchParams({});
    void adminStaffApi.getParkingLotOptions().then(setLotOptions);
  };

  // Open Staff Detail Dialog
  const handleOpenDetail = async (id: string) => {
    setSelectedStaffId(id);
    setDetailLoading(true);
    setDetailError(null);
    setStaffDetail(null);
    try {
      const detail = await adminStaffApi.getStaffById(id);
      setStaffDetail(detail);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'Failed to retrieve staff details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Create Staff Modal: When Owner is selected, refresh lots
  const handleCreateOwnerChange = async (ownerId: string) => {
    setCreateForm((prev) => ({ ...prev, ownerId, parkingLotId: '' }));
    if (!ownerId) {
      setCreateLots([]);
      return;
    }
    setCreateLotsLoading(true);
    try {
      const lots = await adminStaffApi.getParkingLotOptions(ownerId);
      setCreateLots(lots);
    } catch {
      setCreateLots([]);
    } finally {
      setCreateLotsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setCreateForm({
      fullName: '',
      email: '',
      mobileNumber: '',
      ownerId: '',
      parkingLotId: '',
      employeeId: '',
      assignmentReason: '',
    });
    setCreateLots([]);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createForm.fullName.trim() || createForm.fullName.trim().length < 3) {
      setCreateError('Full name must be at least 3 characters.');
      return;
    }
    if (!createForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      setCreateError('A valid email address is required.');
      return;
    }
    if (!createForm.mobileNumber.trim()) {
      setCreateError('Mobile number is required.');
      return;
    }
    if (!createForm.ownerId) {
      setCreateError('Please select a Parking Owner.');
      return;
    }
    if (!createForm.parkingLotId) {
      setCreateError('Please select an authorized Parking Lot.');
      return;
    }

    setCreateSubmitting(true);
    try {
      await adminStaffApi.createStaff({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        mobileNumber: createForm.mobileNumber.trim(),
        ownerId: createForm.ownerId,
        parkingLotId: createForm.parkingLotId,
        employeeId: createForm.employeeId.trim() || undefined,
        assignmentReason: createForm.assignmentReason.trim() || undefined,
      });
      setIsCreateOpen(false);
      void fetchOverview();
      void fetchStaffList();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create security staff.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Edit Staff Modal
  const handleOpenEditModal = (staff: AdminStaffItem) => {
    setEditTarget(staff);
    setEditForm({
      fullName: staff.fullName,
      mobileNumber: staff.mobileNumber,
      employeeId: staff.employeeId || '',
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);

    if (!editForm.fullName.trim() || editForm.fullName.trim().length < 3) {
      setEditError('Full name must be at least 3 characters.');
      return;
    }

    setEditSubmitting(true);
    try {
      await adminStaffApi.updateStaff(editTarget._id, {
        fullName: editForm.fullName.trim(),
        mobileNumber: editForm.mobileNumber.trim(),
        employeeId: editForm.employeeId.trim() || undefined,
      });
      setEditTarget(null);
      void fetchStaffList();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update security staff.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Suspend Staff Modal
  const handleOpenSuspendModal = (staff: AdminStaffItem) => {
    setSuspendTarget(staff);
    setSuspendReason('');
    setSuspendError(null);
  };

  const handleSuspendSubmit = async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim() || suspendReason.trim().length < 5) {
      setSuspendError('Please provide a valid suspension reason (at least 5 characters).');
      return;
    }

    setSuspendSubmitting(true);
    setSuspendError(null);
    try {
      await adminStaffApi.suspendStaff(suspendTarget._id, suspendReason.trim());
      setSuspendTarget(null);
      void fetchOverview();
      void fetchStaffList();
    } catch (err: unknown) {
      setSuspendError(err instanceof Error ? err.message : 'Failed to suspend staff.');
    } finally {
      setSuspendSubmitting(false);
    }
  };

  // Activate Staff Modal
  const handleOpenActivateModal = (staff: AdminStaffItem) => {
    setActivateTarget(staff);
    setActivateError(null);
  };

  const handleActivateSubmit = async () => {
    if (!activateTarget) return;
    setActivateSubmitting(true);
    setActivateError(null);
    try {
      await adminStaffApi.activateStaff(activateTarget._id);
      setActivateTarget(null);
      void fetchOverview();
      void fetchStaffList();
    } catch (err: unknown) {
      setActivateError(err instanceof Error ? err.message : 'Failed to activate staff.');
    } finally {
      setActivateSubmitting(false);
    }
  };

  // Transfer Facility Modal
  const handleOpenTransferModal = (staff: AdminStaffItem) => {
    setTransferTarget(staff);
    setTransferForm({
      newOwnerId: staff.owner?._id || '',
      newParkingLotId: '',
      transferReason: '',
    });
    setTransferLots([]);
    setTransferError(null);
    if (staff.owner?._id) {
      void adminStaffApi.getParkingLotOptions(staff.owner._id).then(setTransferLots);
    }
  };

  const handleTransferOwnerChange = async (ownerId: string) => {
    setTransferForm((prev) => ({ ...prev, newOwnerId: ownerId, newParkingLotId: '' }));
    if (!ownerId) {
      setTransferLots([]);
      return;
    }
    setTransferLotsLoading(true);
    try {
      const lots = await adminStaffApi.getParkingLotOptions(ownerId);
      setTransferLots(lots);
    } catch {
      setTransferLots([]);
    } finally {
      setTransferLotsLoading(false);
    }
  };

  const handleTransferSubmit = async () => {
    if (!transferTarget) return;
    if (!transferForm.newOwnerId) {
      setTransferError('Please select a destination Parking Owner.');
      return;
    }
    if (!transferForm.newParkingLotId) {
      setTransferError('Please select a destination Parking Lot.');
      return;
    }

    setTransferSubmitting(true);
    setTransferError(null);
    try {
      await adminStaffApi.transferStaff(transferTarget._id, {
        newOwnerId: transferForm.newOwnerId,
        newParkingLotId: transferForm.newParkingLotId,
        transferReason: transferForm.transferReason.trim() || undefined,
      });
      setTransferTarget(null);
      void fetchStaffList();
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : 'Failed to transfer staff.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Delete Staff Modal
  const handleOpenDeleteModal = (staff: AdminStaffItem) => {
    setDeleteTarget(staff);
    setDeleteError(null);
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await adminStaffApi.deleteStaff(deleteTarget._id);
      setDeleteTarget(null);
      void fetchOverview();
      void fetchStaffList();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete staff account.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Standard Customer-themed PDF Directory Export
  const handlePrintStaffManifest = () => {
    if (staffList.length === 0) {
      alert('No security staff records available in current view to export.');
      return;
    }

    const tableRows = staffList.map((item) => {
      const statusPillHtml = `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase;${
        item.accountStatus === 'Active'
          ? 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
          : item.accountStatus === 'Suspended'
          ? 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;'
          : 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;'
      }">${item.accountStatus}</span>`;

      return [
        { content: item.employeeId, isMono: true },
        { content: `<strong>${item.fullName}</strong><br/><span style="color:#64748b;font-size:10px;">${item.email}</span>` },
        { content: item.owner?.businessName || item.owner?.fullName || '—' },
        { content: item.parkingLot?.parkingName ? `<strong>${item.parkingLot.parkingName}</strong><br/><span style="color:#64748b;font-size:10px;">${item.parkingLot.city || ''}</span>` : 'Unassigned' },
        { content: item.mobileNumber },
        { content: statusPillHtml, align: 'center' as const },
        { content: item.lastLogin ? new Date(item.lastLogin).toLocaleDateString() : 'Never', align: 'center' as const },
        { content: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—', align: 'right' as const },
      ];
    });

    const columns = [
      { header: 'Employee ID', width: '12%' },
      { header: 'Officer Name & Email', width: '22%' },
      { header: 'Parking Owner', width: '18%' },
      { header: 'Assigned Facility', width: '20%' },
      { header: 'Contact', width: '12%' },
      { header: 'Status', width: '8%', align: 'center' as const },
      { header: 'Last Login', width: '8%', align: 'center' as const },
      { header: 'Joined', width: '8%', align: 'right' as const },
    ];

    const tableHtml = createPdfManifestTable(columns, tableRows);

    openParkEasePdfPrintWindow({
      docTitle: 'Official Security Staff Roster Manifest',
      docSubtitle: 'ParkEase Platform Gate Security Directory',
      documentId: `STAFF-MANIFEST-${new Date().toISOString().slice(0, 10)}`,
      statusPill: {
        text: `${currentStatus} Records (${staffList.length})`,
        variant: currentStatus === 'Active' ? 'green' : currentStatus === 'Suspended' ? 'red' : 'blue',
      },
      metaCards: [
        { label: 'Total Security Staff', value: String(overview.totalSecurityStaff), subtext: 'Enrolled platform-wide' },
        { label: 'Active on Duty', value: String(overview.activeSecurityStaff), subtext: 'Barrier gate authorized' },
        { label: 'Suspended Accounts', value: String(overview.suspendedSecurityStaff), subtext: 'Access locked' },
        { label: 'Recent Additions', value: String(overview.recentlyAddedStaff), subtext: 'Last 30 days' },
      ],
      bodyHtml: `
        <div style="margin-bottom:14px;font-size:12px;color:#475569;display:flex;justify-content:space-between;align-items:center;">
          <div><strong>Filter Scope:</strong> Status: ${currentStatus} &bull; Owner: ${currentOwner === 'All' ? 'All Owners' : currentOwner} &bull; Lot: ${currentLot === 'All' ? 'All Facilities' : currentLot}</div>
          <div>Page ${currentPage} of ${totalPages} (Total ${totalRecords} items)</div>
        </div>
        ${tableHtml}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management & Reservation System &bull; Gate Security Directory',
        'Official record exported by authorized Administrator. Stored under IT compliance.',
      ],
    });
  };

  // Print Single Staff Dossier
  const handlePrintStaffDossier = () => {
    if (!staffDetail) return;

    const s = staffDetail.staff;
    const a = staffDetail.currentAssignment;
    const m = staffDetail.operationalMetrics;

    const accountBlock = createPdfSectionBlock('Officer Identity & Contact Information', [
      { label: 'Full Name', value: s.fullName },
      { label: 'Employee ID', value: s.employeeId, isMono: true },
      { label: 'Role Designation', value: 'Security Staff' },
      { label: 'Official Email', value: s.email },
      { label: 'Mobile Number', value: s.mobileNumber },
      { label: 'Account Status', value: s.accountStatus },
      { label: 'Enrolled On', value: new Date(s.createdAt).toLocaleDateString() },
      { label: 'Last Terminal Login', value: s.lastLogin ? new Date(s.lastLogin).toLocaleString() : 'Never' },
    ]);

    const assignmentBlock = createPdfSectionBlock('Current Facility Assignment Context', [
      { label: 'Assigned Facility', value: a?.parkingLotId.parkingName || 'Unassigned' },
      { label: 'Facility Address', value: a?.parkingLotId.address ? `${a.parkingLotId.address}, ${a.parkingLotId.city}` : '—' },
      { label: 'Facility Total Capacity', value: a?.parkingLotId.totalCapacity ? `${a.parkingLotId.totalCapacity} Bays` : '—' },
      { label: 'Parking Owner Entity', value: a?.ownerId.businessName || a?.ownerId.fullName || '—' },
      { label: 'Owner Contact', value: a?.ownerId.email ? `${a.ownerId.fullName} (${a.ownerId.email})` : '—' },
      { label: 'Assignment Timestamp', value: a?.assignedAt ? new Date(a.assignedAt).toLocaleString() : '—' },
      { label: 'Assignment Duty Notes', value: a?.assignmentReason || 'Standard operational assignment' },
    ]);

    const metricsBlock = createPdfSectionBlock('Operational Gate Audit Metrics', [
      { label: 'Total Inbound Gate Check-Ins Verified', value: m.totalCheckIns },
      { label: 'Total Outbound Gate Check-Outs Verified', value: m.totalCheckOuts },
      { label: 'Total Walk-In Cash Bookings Registered', value: m.totalWalkIns },
      { label: 'Total Security Incident Reports Filed', value: m.totalIncidents },
    ]);

    openParkEasePdfPrintWindow({
      docTitle: 'Security Staff Operational Dossier',
      docSubtitle: 'ParkEase Gate Officer Verification & Duty Ledger',
      documentId: s.employeeId,
      statusPill: {
        text: s.accountStatus,
        variant: s.accountStatus === 'Active' ? 'green' : s.accountStatus === 'Suspended' ? 'red' : 'blue',
      },
      metaCards: [
        { label: 'Employee ID', value: s.employeeId, subtext: s.role },
        { label: 'Facility', value: a?.parkingLotId.parkingName || 'Unassigned', subtext: a?.ownerId.fullName || '' },
        { label: 'Check-Ins', value: String(m.totalCheckIns), subtext: 'Inbound gate' },
        { label: 'Check-Outs', value: String(m.totalCheckOuts), subtext: 'Outbound gate' },
      ],
      bodyHtml: `
        ${accountBlock}
        ${assignmentBlock}
        ${metricsBlock}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management & Reservation System &bull; Confidential Security Staff Dossier',
        'Official record for operational audit compliance, security oversight, and partner records.',
      ],
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Active
          </Badge>
        );
      case 'Suspended':
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold gap-1">
            <ShieldAlert className="h-3 w-3" />
            Suspended
          </Badge>
        );
      case 'Pending Verification':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. BREADCRUMBS & CONSOLIDATED PEOPLE MANAGEMENT HEADER */}
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/admin/dashboard" className="hover:text-foreground transition-colors">
            Admin Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">People Management</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Security Staff</span>
        </nav>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Security Staff Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Platform-wide administration for Customer Accounts, Parking Owners, and Gate Security Staff.
              </p>
            </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintStaffManifest}
              disabled={listLoading || staffList.length === 0}
              className="gap-1.5 text-xs h-9"
              title="Export branded PDF manifest"
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>

            <Button
              size="sm"
              onClick={handleOpenCreateModal}
              className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground font-semibold shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              Add Security Staff
            </Button>
          </div>
        </div>

        {/* Unified People Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <Link
            to="/admin/users"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            Customers
          </Link>
          <Link
            to="/admin/owners"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            Parking Owners
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-xs">
            <Shield className="h-3.5 w-3.5" />
            Security Staff
          </div>
        </div>
      </div>
    </div>

      {/* 2. KPI OVERVIEW METRICS CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Security Staff</p>
              {overviewLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-foreground">{overview.totalSecurityStaff}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Staff</p>
              {overviewLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {overview.activeSecurityStaff}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Suspended Staff</p>
              {overviewLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                  {overview.suspendedSecurityStaff}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Recently Added</p>
              {overviewLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                  {overview.recentlyAddedStaff}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. SEARCH & FILTERS BAR */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, name, email, phone, lot..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Parking Owner Filter */}
            <div>
              <select
                aria-label="Filter by Parking Owner"
                value={currentOwner}
                onChange={(e) => void handleOwnerFilterChange(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="All">All Parking Owners</option>
                {ownerOptions.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.businessName ? `${o.businessName} (${o.fullName})` : o.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Parking Lot Filter (Dependent on selected owner) */}
            <div>
              <select
                aria-label="Filter by Assigned Parking Facility"
                value={currentLot}
                onChange={(e) => handleLotFilterChange(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="All">All Parking Facilities</option>
                {lotOptions.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.parkingName} ({l.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                aria-label="Filter by Account Status"
                value={currentStatus}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="All">All Account Statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Pending Verification">Pending Verification</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              <span>
                Showing <strong>{staffList.length}</strong> of <strong>{totalRecords}</strong> staff officers
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. STAFF DIRECTORY TABLE */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Officer Name &amp; Email</th>
                  <th className="py-3 px-4">Parking Owner</th>
                  <th className="py-3 px-4">Assigned Facility</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {listLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></td>
                      <td className="py-3.5 px-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : listError ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-rose-500">
                      <div className="flex flex-col items-center gap-2">
                        <XCircle className="h-8 w-8" />
                        <p className="font-semibold">{listError}</p>
                        <Button variant="outline" size="sm" onClick={() => void fetchStaffList()} className="mt-2 text-xs">
                          Retry
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
                        <div className="p-3 bg-muted rounded-full">
                          <Shield className="h-8 w-8 text-muted-foreground/60" />
                        </div>
                        <p className="font-bold text-foreground">No Security Staff Found</p>
                        <p className="text-xs">
                          {currentSearch || currentOwner !== 'All' || currentLot !== 'All' || currentStatus !== 'All'
                            ? 'No officers match your active filter criteria. Try resetting filters or search terms.'
                            : 'No Security Staff accounts are currently registered on the platform.'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="outline" size="sm" onClick={handleResetFilters} className="text-xs">
                            Reset Filters
                          </Button>
                          <Button size="sm" onClick={handleOpenCreateModal} className="text-xs gap-1">
                            <UserPlus className="h-3.5 w-3.5" />
                            Add Staff
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  staffList.map((item) => (
                    <tr key={item._id} className="hover:bg-muted/20 transition-colors">
                      {/* Employee ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        {item.employeeId}
                      </td>

                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">{item.fullName}</div>
                        <div className="text-[11px] text-muted-foreground">{item.email}</div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4">
                        {item.owner ? (
                          <div>
                            <span className="font-medium text-foreground">
                              {item.owner.businessName || item.owner.fullName}
                            </span>
                            {item.owner.businessName && (
                              <div className="text-[10px] text-muted-foreground">{item.owner.fullName}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Assigned Parking Lot */}
                      <td className="py-3.5 px-4">
                        {item.parkingLot ? (
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-foreground">{item.parkingLot.parkingName}</span>
                              {item.parkingLot.city && (
                                <div className="text-[10px] text-muted-foreground">{item.parkingLot.city}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Unassigned</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <Badge variant="secondary" className="font-medium text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          Security Staff
                        </Badge>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 font-mono text-[11.5px]">
                        {item.mobileNumber}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(item.accountStatus)}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {item.lastLogin ? new Date(item.lastLogin).toLocaleDateString() : 'Never'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleOpenDetail(item._id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="View Staff Profile & Activity"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(item)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit Staff Info"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenTransferModal(item)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                            title="Transfer Facility Assignment"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>

                          {item.accountStatus === 'Active' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSuspendModal(item)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                              title="Suspend Account"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          ) : item.accountStatus === 'Suspended' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenActivateModal(item)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600"
                              title="Reactivate Account"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          ) : null}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeleteModal(item)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                            title="Delete Account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> &bull; Total {totalRecords} records
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('page', String(Math.max(1, currentPage - 1)));
                    setSearchParams(next);
                  }}
                  disabled={currentPage <= 1 || listLoading}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('page', String(Math.min(totalPages, currentPage + 1)));
                    setSearchParams(next);
                  }}
                  disabled={currentPage >= totalPages || listLoading}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          5. MODAL DIALOGS
          ========================================================================= */}

      {/* A. VIEW STAFF DETAIL DIALOG */}
      <Dialog open={!!selectedStaffId} onOpenChange={(open) => !open && setSelectedStaffId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Security Staff Profile &amp; Audit Dossier
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Gate operator credentials, active facility post, activity metrics, and audit history.
                </DialogDescription>
              </div>

              {staffDetail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintStaffDossier}
                  className="gap-1.5 text-xs h-8 mr-6"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Dossier (PDF)
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : detailError ? (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs text-center">
                {detailError}
              </div>
            ) : staffDetail ? (
              <>
                {/* 1. Profile Top Card */}
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                    <div>
                      <span className="text-[11px] font-mono text-muted-foreground">EMPLOYEE ID</span>
                      <p className="text-lg font-bold font-mono text-foreground">
                        {staffDetail.staff.employeeId}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground">ACCOUNT STATUS</span>
                      <div className="mt-0.5">{getStatusBadge(staffDetail.staff.accountStatus)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[11px]">Officer Name:</span>
                      <p className="font-semibold text-foreground">{staffDetail.staff.fullName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px]">Official Email:</span>
                      <p className="font-semibold text-foreground">{staffDetail.staff.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px]">Mobile Number:</span>
                      <p className="font-semibold font-mono text-foreground">{staffDetail.staff.mobileNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px]">Enrolled On:</span>
                      <p className="text-foreground">{new Date(staffDetail.staff.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px]">Last Login:</span>
                      <p className="text-foreground">
                        {staffDetail.staff.lastLogin ? new Date(staffDetail.staff.lastLogin).toLocaleString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px]">Role:</span>
                      <p className="font-semibold text-blue-600 dark:text-blue-400">Security Staff</p>
                    </div>
                  </div>

                  {staffDetail.staff.accountStatus === 'Suspended' && staffDetail.staff.suspensionReason && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 mt-2">
                      <strong>Suspension Reason:</strong> {staffDetail.staff.suspensionReason}
                    </div>
                  )}
                </div>

                {/* 2. Current Assignment Card */}
                <div className="p-4 rounded-xl border border-border/80 bg-background space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    Active Facility Assignment
                  </h3>

                  {staffDetail.currentAssignment ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-muted-foreground text-[11px]">Assigned Parking Facility:</span>
                        <p className="font-bold text-foreground text-sm">
                          {staffDetail.currentAssignment.parkingLotId.parkingName}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {staffDetail.currentAssignment.parkingLotId.address}, {staffDetail.currentAssignment.parkingLotId.city}
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-[11px]">Parking Owner Entity:</span>
                        <p className="font-bold text-foreground text-sm">
                          {staffDetail.currentAssignment.ownerId.businessName || staffDetail.currentAssignment.ownerId.fullName}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {staffDetail.currentAssignment.ownerId.fullName} ({staffDetail.currentAssignment.ownerId.email})
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-[11px]">Assigned Date:</span>
                        <p className="text-foreground">
                          {new Date(staffDetail.currentAssignment.assignedAt).toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground text-[11px]">Assignment Duty Notes:</span>
                        <p className="text-foreground">
                          {staffDetail.currentAssignment.assignmentReason || 'Standard operational duty'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                      No active parking lot assignment currently established for this security officer.
                    </div>
                  )}
                </div>

                {/* 3. Operational Metrics */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <History className="h-4 w-4" />
                    Operational Gate Audit Metrics
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-border/80 bg-muted/10 text-center">
                      <p className="text-[11px] text-muted-foreground">Inbound Check-Ins</p>
                      <p className="text-xl font-bold text-foreground">
                        {staffDetail.operationalMetrics.totalCheckIns}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-border/80 bg-muted/10 text-center">
                      <p className="text-[11px] text-muted-foreground">Outbound Check-Outs</p>
                      <p className="text-xl font-bold text-foreground">
                        {staffDetail.operationalMetrics.totalCheckOuts}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-border/80 bg-muted/10 text-center">
                      <p className="text-[11px] text-muted-foreground">Walk-in Bookings</p>
                      <p className="text-xl font-bold text-foreground">
                        {staffDetail.operationalMetrics.totalWalkIns}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border border-border/80 bg-muted/10 text-center">
                      <p className="text-[11px] text-muted-foreground">Incident Reports</p>
                      <p className="text-xl font-bold text-foreground">
                        {staffDetail.operationalMetrics.totalIncidents}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Assignment History Timeline */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ArrowRightLeft className="h-4 w-4" />
                    Assignment History Timeline
                  </h3>

                  {staffDetail.assignmentHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No historical assignments recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {staffDetail.assignmentHistory.map((h) => (
                        <div key={h._id} className="p-3 rounded-lg border border-border/60 bg-muted/10 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-foreground">{h.parkingLotId.parkingName}</span>
                            <p className="text-[10px] text-muted-foreground">
                              Owner: {h.ownerId.businessName || h.ownerId.fullName} &bull; Assigned: {new Date(h.assignedAt).toLocaleDateString()}
                              {h.unassignedAt && ` &bull; Reassigned: ${new Date(h.unassignedAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          <Badge variant="outline" className={h.assignmentStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}>
                            {h.assignmentStatus}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Activity Logs */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <History className="h-4 w-4" />
                    Recent Operational Activity Logs
                  </h3>

                  {staffDetail.activityLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No recent audit log entries recorded.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/60 rounded-lg p-2 bg-muted/5">
                      {staffDetail.activityLogs.map((log) => (
                        <div key={log._id} className="p-2 rounded bg-background border border-border/40 text-[11px] flex items-center justify-between">
                          <div>
                            <strong className="text-foreground">{log.action}</strong>
                            <p className="text-muted-foreground">{log.description}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter className="p-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setSelectedStaffId(null)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* B. CREATE STAFF MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Security Staff Member
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Provision a new gate security officer and assign them to an authorized parking facility.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            {createError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input
                  placeholder="Officer Full Name"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Official Email Address *</Label>
                <Input
                  type="email"
                  placeholder="staff@parkease.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Mobile Number (+91) *</Label>
                <Input
                  placeholder="+919876543210"
                  value={createForm.mobileNumber}
                  onChange={(e) => setCreateForm({ ...createForm, mobileNumber: e.target.value })}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Employee ID (Optional)</Label>
                <Input
                  placeholder="e.g. SEC-1049"
                  value={createForm.employeeId}
                  onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Role designation (fixed & non-editable) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Platform Role</Label>
              <Input
                value="Security Staff (Gate Operator & Incident Reporter)"
                disabled
                className="h-9 text-xs bg-muted text-muted-foreground font-semibold cursor-not-allowed"
              />
              <p className="text-[10px] text-muted-foreground">
                Role changes are strictly controlled under the dedicated Roles &amp; Permissions workflow.
              </p>
            </div>

            {/* Owner & Facility Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Parking Owner *</Label>
                <select
                  aria-label="Parking Owner"
                  value={createForm.ownerId}
                  onChange={(e) => void handleCreateOwnerChange(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select Parking Owner...</option>
                  {ownerOptions.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.businessName ? `${o.businessName} (${o.fullName})` : o.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assigned Facility *</Label>
                <select
                  aria-label="Assigned Parking Facility"
                  value={createForm.parkingLotId}
                  onChange={(e) => setCreateForm({ ...createForm, parkingLotId: e.target.value })}
                  disabled={!createForm.ownerId || createLotsLoading}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:bg-muted"
                  required
                >
                  <option value="">
                    {!createForm.ownerId
                      ? 'Select an owner first...'
                      : createLotsLoading
                      ? 'Loading owner facilities...'
                      : createLots.length === 0
                      ? 'No facilities found for this owner'
                      : 'Select Parking Facility...'}
                  </option>
                  {createLots.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.parkingName} ({l.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Assignment / Post Notes (Optional)</Label>
              <Textarea
                placeholder="e.g. Inbound check-in lane, North gate duty shift"
                value={createForm.assignmentReason}
                onChange={(e) => setCreateForm({ ...createForm, assignmentReason: e.target.value })}
                className="text-xs h-16 resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createSubmitting} className="text-xs gap-1.5 font-semibold">
                {createSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                Create &amp; Assign Staff
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* C. EDIT STAFF MODAL */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Security Staff Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify permitted identity details for {editTarget?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            {editError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mobile Number (+91) *</Label>
              <Input
                value={editForm.mobileNumber}
                onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Employee ID</Label>
              <Input
                value={editForm.employeeId}
                onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                className="h-9 text-xs font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditTarget(null)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={editSubmitting} className="text-xs font-semibold">
                {editSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* D. SUSPEND STAFF MODAL */}
      <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Suspend Security Staff Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to suspend {suspendTarget?.fullName}? Active sessions will be immediately terminated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400">
              <strong>Security Impact:</strong> The officer will be immediately locked out of the gate terminal and cannot verify QR entries, process exits, or register walk-ins.
            </div>

            {suspendError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {suspendError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Suspension Reason (Required, min 5 chars) *</Label>
              <Textarea
                placeholder="State the disciplinary or operational reason for suspension..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="text-xs h-20 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setSuspendTarget(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSuspendSubmit}
              disabled={suspendSubmitting}
              className="text-xs font-semibold gap-1.5"
            >
              {suspendSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3" />}
              Confirm Suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E. ACTIVATE STAFF MODAL */}
      <Dialog open={!!activateTarget} onOpenChange={(open) => !open && setActivateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-emerald-600 flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Reactivate Security Staff Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Restore operational terminal access for {activateTarget?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1 text-xs">
            <p>
              Reactivating this account will clear the suspension flag and permit the officer to sign in and resume duty at their assigned parking facility.
            </p>

            {activateError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {activateError}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setActivateTarget(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleActivateSubmit}
              disabled={activateSubmitting}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {activateSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
              Confirm Activation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* F. TRANSFER FACILITY MODAL */}
      <Dialog open={!!transferTarget} onOpenChange={(open) => !open && setTransferTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Transfer Facility Assignment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Reassign {transferTarget?.fullName} to a new parking facility.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Current post banner */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/80 text-xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Current Assignment</span>
              <p className="font-semibold text-foreground">
                {transferTarget?.parkingLot?.parkingName || 'Unassigned'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Owner: {transferTarget?.owner?.businessName || transferTarget?.owner?.fullName || '—'}
              </p>
            </div>

            {transferError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                {transferError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destination Parking Owner *</Label>
                <select
                  aria-label="Destination Parking Owner"
                  value={transferForm.newOwnerId}
                  onChange={(e) => void handleTransferOwnerChange(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select Destination Owner...</option>
                  {ownerOptions.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.businessName ? `${o.businessName} (${o.fullName})` : o.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destination Parking Facility *</Label>
                <select
                  aria-label="Destination Parking Facility"
                  value={transferForm.newParkingLotId}
                  onChange={(e) => setTransferForm({ ...transferForm, newParkingLotId: e.target.value })}
                  disabled={!transferForm.newOwnerId || transferLotsLoading}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:bg-muted"
                >
                  <option value="">
                    {!transferForm.newOwnerId
                      ? 'Select destination owner first...'
                      : transferLotsLoading
                      ? 'Loading owner facilities...'
                      : transferLots.length === 0
                      ? 'No facilities found for this owner'
                      : 'Select Destination Facility...'}
                  </option>
                  {transferLots.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.parkingName} ({l.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Transfer Reason / Duty Orders (Optional)</Label>
                <Textarea
                  placeholder="e.g. Transferred to manage entry lanes at newly onboarded facility"
                  value={transferForm.transferReason}
                  onChange={(e) => setTransferForm({ ...transferForm, transferReason: e.target.value })}
                  className="text-xs h-16 resize-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setTransferTarget(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleTransferSubmit}
              disabled={transferSubmitting}
              className="text-xs font-semibold gap-1.5"
            >
              {transferSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />}
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* G. DELETE STAFF MODAL */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Security Staff Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Permanent deletion safety check for {deleteTarget?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1 text-xs">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400">
              <strong>Historical Data Safety Rule:</strong> Platform rules prohibit deleting staff accounts that have recorded operational gate movements, walk-in bookings, or incident reports. For unutilized accounts, deletion permanently purges credentials and active assignments.
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 font-medium">
                {deleteError}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSubmit}
              disabled={deleteSubmitting}
              className="text-xs font-semibold gap-1.5"
            >
              {deleteSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityStaffManagementPage;
