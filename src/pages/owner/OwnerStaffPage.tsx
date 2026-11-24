import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  UserPlus,
  MailQuestion,
  Search,
  Building2,
  Calendar,
  Send,
  Eye,
  PlusCircle,
  Edit2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  UserMinus,
  MoreHorizontal,
  X,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';

import { getOwnerParkingLots, type OfficialParkingLot } from '@/api/parkingLot.api';
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  ownerApi,
  type OwnerStaffItem,
  type OwnerStaffSummary,
  type OwnerStaffDetailData,
  type InviteOwnerStaffPayload,
  type AssignOwnerStaffPayload,
  type UpdateStaffInfoPayload,
} from '@/api/owner.api';
import { getSocket } from '@/lib/socket';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const STATUS_TABS = [
  { label: 'All Staff', value: 'ALL' },
  { label: 'Active', value: 'Active' },
  { label: 'Pending Verification', value: 'Pending Verification' },
  { label: 'Suspended', value: 'Suspended' },
] as const;

export function OwnerStaffPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const facilityParam = searchParams.get('facility') || 'ALL';
  const statusParam = searchParams.get('status') || 'ALL';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const searchParam = searchParams.get('search') || '';

  // Core state
  const [facilities, setFacilities] = useState<OfficialParkingLot[]>([]);
  const [staffList, setStaffList] = useState<OwnerStaffItem[]>([]);
  const [summary, setSummary] = useState<OwnerStaffSummary>({
    totalStaff: 0,
    activeStaff: 0,
    suspendedStaff: 0,
    pendingInvitations: 0,
    recentlyAdded: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Loading states
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [, setIsRefreshing] = useState(false);

  // Search local input
  const [searchInput, setSearchInput] = useState(searchParam);

  // Selected staff for details drawer
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffDetails, setStaffDetails] = useState<OwnerStaffDetailData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modals state
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [actionStaff, setActionStaff] = useState<OwnerStaffItem | null>(null);

  // Form states
  const [inviteForm, setInviteForm] = useState<InviteOwnerStaffPayload>({
    fullName: '',
    email: '',
    mobileNumber: '',
    parkingLotId: '',
    employeeId: '',
    assignmentReason: '',
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const [assignForm, setAssignForm] = useState<AssignOwnerStaffPayload>({
    parkingLotId: '',
    employeeId: '',
    assignmentReason: '',
  });
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [editForm, setEditForm] = useState<UpdateStaffInfoPayload>({
    fullName: '',
    mobileNumber: '',
    employeeId: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'Active' | 'Suspended'>('Active');

  // Deactivate lot assignment state inside drawer
  const [deactivatingLotId, setDeactivatingLotId] = useState<string | null>(null);

  // Sync search input with URL searchParam
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // Load facilities on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchLots() {
      try {
        setLoadingFacilities(true);
        const res = await getOwnerParkingLots();
        const lots = res.data?.parkingLots || [];
        if (isMounted) {
          setFacilities(lots);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load parking facilities';
          toast.error(msg);
        }
      } finally {
        if (isMounted) {
          setLoadingFacilities(false);
        }
      }
    }
    fetchLots();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch staff directory
  const fetchStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const res = await ownerApi.getOwnerStaff({
        parkingLotId: facilityParam !== 'ALL' ? facilityParam : undefined,
        accountStatus: statusParam !== 'ALL' ? statusParam : undefined,
        search: searchParam || undefined,
        page: pageParam,
        limit: 10,
      });

      setStaffList(res.staff);
      setSummary(res.summary);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve staff directory';
      toast.error(msg);
    } finally {
      setLoadingStaff(false);
      setIsRefreshing(false);
    }
  }, [facilityParam, statusParam, searchParam, pageParam]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useLiveSync(() => {
    void fetchStaff();
  });

  // Socket listener for live updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleStaffChange = () => {
      fetchStaff();
      if (selectedStaffId) {
        loadStaffDetails(selectedStaffId);
      }
    };

    socket.on('staff_status_changed', handleStaffChange);
    return () => {
      socket.off('staff_status_changed', handleStaffChange);
    };
  }, [fetchStaff, selectedStaffId]);

  // Load single staff member details
  const loadStaffDetails = async (staffId: string) => {
    try {
      setLoadingDetails(true);
      const data = await ownerApi.getOwnerStaffById(staffId);
      setStaffDetails(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load staff details';
      toast.error(msg);
      setSelectedStaffId(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenDetails = (staff: OwnerStaffItem) => {
    setSelectedStaffId(staff._id);
    loadStaffDetails(staff._id);
  };

  // Filter handlers
  const handleFacilityChange = (lotId: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (lotId === 'ALL') {
      newParams.delete('facility');
    } else {
      newParams.set('facility', lotId);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleStatusFilterChange = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (status === 'ALL') {
      newParams.delete('status');
    } else {
      newParams.set('status', status);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Debounce search input for live asynchronous searching
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQuery = searchParams.get('search') || '';
      const trimmed = searchInput.trim();
      if (trimmed !== currentQuery) {
        const newParams = new URLSearchParams(searchParams);
        if (trimmed) {
          newParams.set('search', trimmed);
        } else {
          newParams.delete('search');
        }
        newParams.set('page', '1');
        setSearchParams(newParams);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set('search', searchInput.trim());
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  // Invite Staff handler
  const handleOpenInvite = () => {
    setInviteForm({
      fullName: '',
      email: '',
      mobileNumber: '',
      parkingLotId: facilityParam !== 'ALL' ? facilityParam : (facilities[0]?._id || ''),
      employeeId: '',
      assignmentReason: '',
    });
    setIsInviteDialogOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.fullName || !inviteForm.email || !inviteForm.mobileNumber || !inviteForm.parkingLotId) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      setInviteSubmitting(true);
      await ownerApi.inviteOwnerStaff(inviteForm);
      toast.success('Security Staff invited successfully! Invitation email has been sent.');
      setIsInviteDialogOpen(false);
      fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to invite security staff';
      toast.error(msg);
    } finally {
      setInviteSubmitting(false);
    }
  };

  // Assign facility to existing staff
  const handleOpenAssign = (staff: OwnerStaffItem) => {
    setActionStaff(staff);
    // Find first facility not already actively assigned
    const assignedLotIds = new Set(staff.activeAssignments.map((a) => a.parkingLotId));
    const availableLot = facilities.find((f) => !assignedLotIds.has(f._id));

    setAssignForm({
      parkingLotId: availableLot?._id || '',
      employeeId: staff.employeeId || '',
      assignmentReason: '',
    });
    setIsAssignDialogOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionStaff || !assignForm.parkingLotId) {
      toast.error('Please select a parking facility.');
      return;
    }

    try {
      setAssignSubmitting(true);
      await ownerApi.assignOwnerStaff(actionStaff._id, assignForm);
      toast.success('Security Staff assigned to facility successfully!');
      setIsAssignDialogOpen(false);
      fetchStaff();
      if (selectedStaffId === actionStaff._id) {
        loadStaffDetails(actionStaff._id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign facility';
      toast.error(msg);
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Edit staff info
  const handleOpenEdit = (staff: OwnerStaffItem) => {
    setActionStaff(staff);
    setEditForm({
      fullName: staff.fullName,
      mobileNumber: staff.mobileNumber,
      employeeId: staff.employeeId || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionStaff) return;

    try {
      setEditSubmitting(true);
      await ownerApi.updateOwnerStaff(actionStaff._id, editForm);
      toast.success('Staff details updated successfully!');
      setIsEditDialogOpen(false);
      fetchStaff();
      if (selectedStaffId === actionStaff._id) {
        loadStaffDetails(actionStaff._id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update staff details';
      toast.error(msg);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Suspend / Activate staff account
  const handleOpenStatusDialog = (staff: OwnerStaffItem, newStatus: 'Active' | 'Suspended') => {
    setActionStaff(staff);
    setTargetStatus(newStatus);
    setStatusReason('');
    setIsStatusDialogOpen(true);
  };

  const handleStatusSubmit = async () => {
    if (!actionStaff) return;

    try {
      setStatusSubmitting(true);
      await ownerApi.updateOwnerStaffStatus(actionStaff._id, {
        accountStatus: targetStatus,
        reason: statusReason.trim() || undefined,
      });
      toast.success(
        targetStatus === 'Suspended'
          ? 'Staff account has been suspended.'
          : 'Staff account has been activated.',
      );
      setIsStatusDialogOpen(false);
      fetchStaff();
      if (selectedStaffId === actionStaff._id) {
        loadStaffDetails(actionStaff._id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update account status';
      toast.error(msg);
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Deactivate assignment from facility
  const handleDeactivateAssignment = async (parkingLotId: string) => {
    if (!selectedStaffId) return;
    try {
      setDeactivatingLotId(parkingLotId);
      await ownerApi.updateOwnerStaffStatus(selectedStaffId, {
        assignmentStatus: 'Inactive',
        parkingLotId,
        reason: 'Unassigned by facility owner',
      });
      toast.success('Staff member unassigned from facility.');
      loadStaffDetails(selectedStaffId);
      fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unassign staff member';
      toast.error(msg);
    } finally {
      setDeactivatingLotId(null);
    }
  };

  // Resend invitation
  const handleResendInvitation = async (staff: OwnerStaffItem) => {
    try {
      const res = await ownerApi.resendStaffInvitation(staff._id);
      toast.success(res.message || 'Invitation email resent successfully.');
      fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend invitation';
      toast.error(msg);
    }
  };

  // Status badge styling helper
  const getAccountStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Active
          </Badge>
        );
      case 'Suspended':
        return (
          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
            Suspended
          </Badge>
        );
      case 'Pending Verification':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Pending Verification
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case 'Accepted':
        return (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-medium">
            Accepted
          </Badge>
        );
      case 'Sent':
        return (
          <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-xs font-medium">
            Invitation Sent
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-border text-muted-foreground bg-muted/30 text-xs font-medium">
            {status || 'Pending'}
          </Badge>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Security Operations
            </Badge>
            <Badge variant="secondary" className="text-xs font-semibold">
              {summary.totalStaff} Authorized {summary.totalStaff === 1 ? 'Officer' : 'Officers'}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Staff Management
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
            Manage authorized security personnel, assign facilities, control operational gate access, and track live activity.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Facility Switcher */}
          <div className="w-56">
            {loadingFacilities ? (
              <Skeleton className="h-9 w-full rounded-md" />
            ) : (
              <Select
                value={facilityParam}
                onValueChange={handleFacilityChange}
                disabled={loadingFacilities}
              >
                <SelectTrigger className="w-full bg-card border-border/80 h-9 text-xs">
                  <Building2 className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Facilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Facilities (Consolidated)</SelectItem>
                  {facilities.map((fac) => (
                    <SelectItem key={fac._id} value={fac._id}>
                      {fac.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Invite Staff Button */}
          <Button
            size="sm"
            onClick={handleOpenInvite}
            className="h-9 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold flex items-center gap-1.5 text-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Security Staff</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Staff */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm hover:border-primary/40 hover:shadow-sm transition-all group">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Total Staff</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {loadingStaff ? <Skeleton className="w-10 h-6" /> : summary.totalStaff}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Authorized personnel</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Staff */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm hover:border-emerald-500/40 hover:shadow-sm transition-all group">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Active Staff</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold tracking-tight text-emerald-500">
                {loadingStaff ? <Skeleton className="w-10 h-6" /> : summary.activeStaff}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Operational at gates</p>
            </div>
          </CardContent>
        </Card>

        {/* Suspended Staff */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm hover:border-rose-500/40 hover:shadow-sm transition-all group">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Suspended</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold tracking-tight text-rose-500">
                {loadingStaff ? <Skeleton className="w-10 h-6" /> : summary.suspendedStaff}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Access disabled</p>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm hover:border-amber-500/40 hover:shadow-sm transition-all group">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Pending Invites</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MailQuestion className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold tracking-tight text-amber-500">
                {loadingStaff ? <Skeleton className="w-10 h-6" /> : summary.pendingInvitations}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting verification</p>
            </div>
          </CardContent>
        </Card>

        {/* Recently Added */}
        <Card className="border-border/70 bg-card/60 backdrop-blur-sm hover:border-purple-500/40 hover:shadow-sm transition-all group col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Recent (30d)</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold tracking-tight text-purple-500">
                {loadingStaff ? <Skeleton className="w-10 h-6" /> : summary.recentlyAdded}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">New additions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search & Status Toolbar */}
      <div className="bg-card border border-border/70 rounded-xl p-3 shadow-2xs space-y-3 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isActive = statusParam === tab.value;
            let count = summary.totalStaff;
            if (tab.value === 'Active') count = summary.activeStaff;
            else if (tab.value === 'Pending Verification') count = summary.pendingInvitations;
            else if (tab.value === 'Suspended') count = summary.suspendedStaff;

            return (
              <button
                key={tab.value}
                onClick={() => handleStatusFilterChange(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground border border-border/40'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input & Reset */}
        <div className="flex items-center gap-2 shrink-0">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72 md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, email, phone, ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 pr-8 h-9 text-xs bg-background border-border/80 focus-visible:ring-1"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('search');
                  newParams.set('page', '1');
                  setSearchParams(newParams);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {(searchParam || statusParam !== 'ALL' || facilityParam !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4. Staff Directory Table Card */}
      <Card className="border-border/70 bg-card shadow-xs rounded-xl overflow-hidden">
        {/* Directory Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/70 bg-muted/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Personnel Directory</h2>
            <Badge variant="outline" className="text-[10px] bg-background/80 px-2 py-0.5 border-border">
              {totalCount} Total
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Page {pageParam} of {totalPages}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5 min-w-[240px]">Security Staff</th>
                <th className="px-4 py-3.5 w-[120px] text-center">Employee ID</th>
                <th className="px-4 py-3.5 w-[150px]">Contact Number</th>
                <th className="px-4 py-3.5 min-w-[180px]">Assigned Facility</th>
                <th className="px-4 py-3.5 w-[160px] text-center">Account Status</th>
                <th className="px-4 py-3.5 w-[140px] text-center">Invitation</th>
                <th className="px-4 py-3.5 w-[150px]">Last Login / Added</th>
                <th className="px-5 py-3.5 w-[140px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loadingStaff ? (
                // Skeleton loading rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="w-9 h-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="w-28 h-3.5" />
                          <Skeleton className="w-36 h-3" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center"><Skeleton className="w-16 h-4 mx-auto" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="w-24 h-4" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="w-32 h-4" /></td>
                    <td className="px-4 py-3.5 text-center"><Skeleton className="w-20 h-5 rounded-full mx-auto" /></td>
                    <td className="px-4 py-3.5 text-center"><Skeleton className="w-20 h-5 rounded-full mx-auto" /></td>
                    <td className="px-4 py-3.5"><Skeleton className="w-24 h-4" /></td>
                    <td className="px-5 py-3.5 text-right"><Skeleton className="w-16 h-7 ml-auto" /></td>
                  </tr>
                ))
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 px-4">
                    <div className="max-w-sm mx-auto text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        No security personnel found
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {searchParam || statusParam !== 'ALL' || facilityParam !== 'ALL'
                          ? 'No staff members match the specified filters. Try clearing your search.'
                          : 'You have not added any security personnel yet. Invite security staff to manage facility check-ins.'}
                      </p>
                      {searchParam || statusParam !== 'ALL' || facilityParam !== 'ALL' ? (
                        <Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs">
                          Clear Filters
                        </Button>
                      ) : (
                        <Button size="sm" onClick={handleOpenInvite} className="text-xs">
                          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                          Invite Security Staff
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => {
                  const initials = staff.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={staff._id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-blue-500/20 text-primary border border-primary/30 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm leading-snug truncate">
                              {staff.fullName}
                            </p>
                            <p className="text-muted-foreground text-[11px] leading-normal truncate">{staff.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td className="px-4 py-3.5 text-center">
                        {staff.employeeId ? (
                          <span className="inline-flex items-center font-mono text-[11px] px-2 py-0.5 rounded bg-muted/60 border border-border/70 font-semibold text-foreground">
                            {staff.employeeId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Mobile */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-foreground font-medium text-xs">
                          <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>{staff.mobileNumber}</span>
                        </div>
                      </td>

                      {/* Facility */}
                      <td className="px-4 py-3.5">
                        {staff.assignedParkingLot ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-foreground text-xs truncate max-w-[180px]">
                                {staff.assignedParkingLot.lotName}
                              </span>
                            </div>
                            {staff.activeAssignments.length > 1 && (
                              <span className="text-[10px] text-primary font-medium pl-5">
                                +{staff.activeAssignments.length - 1} other facility
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Unassigned</span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="px-4 py-3.5 text-center">
                        {getAccountStatusBadge(staff.accountStatus)}
                      </td>

                      {/* Invitation Status */}
                      <td className="px-4 py-3.5 text-center">
                        {getInvitationStatusBadge(staff.invitationStatus)}
                      </td>

                      {/* Last Login / Added Date */}
                      <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                        {staff.lastLogin ? (
                          <div>
                            <span className="text-foreground font-medium block">
                              {new Date(staff.lastLogin).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(staff.lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Added {new Date(staff.createdAt).toLocaleDateString()}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Primary: View Details */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDetails(staff)}
                            className="h-8 px-2.5 text-xs font-semibold gap-1 text-foreground hover:text-primary hover:border-primary/50"
                            title="View Full Profile & History"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </Button>

                          {/* Secondary Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="More actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuItem onClick={() => handleOpenDetails(staff)}>
                                <Eye className="w-3.5 h-3.5 mr-2" />
                                View Full Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenAssign(staff)}>
                                <Building2 className="w-3.5 h-3.5 mr-2 text-primary" />
                                Assign Additional Lot
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(staff)}>
                                <Edit2 className="w-3.5 h-3.5 mr-2" />
                                Edit Staff Info
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {staff.accountStatus === 'Active' ? (
                                <DropdownMenuItem
                                  onClick={() => handleOpenStatusDialog(staff, 'Suspended')}
                                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10"
                                >
                                  <UserX className="w-3.5 h-3.5 mr-2 text-rose-500" />
                                  Suspend Account
                                </DropdownMenuItem>
                              ) : staff.accountStatus === 'Suspended' ? (
                                <DropdownMenuItem
                                  onClick={() => handleOpenStatusDialog(staff, 'Active')}
                                  className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10"
                                >
                                  <UserCheck className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                                  Reactivate Account
                                </DropdownMenuItem>
                              ) : null}
                              {staff.accountStatus === 'Pending Verification' && (
                                <DropdownMenuItem
                                  onClick={() => handleResendInvitation(staff)}
                                  className="text-amber-600 focus:text-amber-600 focus:bg-amber-500/10"
                                >
                                  <Send className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                  Resend Invitation
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {staffList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-muted/20 border-t border-border/70 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{(pageParam - 1) * 10 + 1}</span> to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(pageParam * 10, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{totalCount}</span> security personnel
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pageParam - 1)}
                disabled={pageParam <= 1 || loadingStaff}
                className="h-8 px-2.5 text-xs gap-1 border-border/80"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <span className="px-2.5 py-1 rounded bg-background border border-border/60 font-semibold text-foreground">
                {pageParam} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pageParam + 1)}
                disabled={pageParam >= totalPages || loadingStaff}
                className="h-8 px-2.5 text-xs gap-1 border-border/80"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ==================================================================== */}
      {/* 5. Invite Security Staff Dialog                                     */}
      {/* ==================================================================== */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Invite Security Staff
            </DialogTitle>
            <DialogDescription className="text-xs">
              Authorize a security officer to operate gate check-ins and verify vehicle movements. ParkEase uses passwordless authentication.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4 pt-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Ramesh Kumar"
                value={inviteForm.fullName}
                onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  type="email"
                  placeholder="ramesh@security.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="+919876543210"
                  value={inviteForm.mobileNumber}
                  onChange={(e) => setInviteForm({ ...inviteForm, mobileNumber: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Parking Facility */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assigned Facility <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={inviteForm.parkingLotId}
                  onValueChange={(val) => setInviteForm({ ...inviteForm, parkingLotId: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map((fac) => (
                      <SelectItem key={fac._id} value={fac._id}>
                        {fac.parkingName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Employee ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <Input
                  placeholder="e.g. SEC-042"
                  value={inviteForm.employeeId || ''}
                  onChange={(e) => setInviteForm({ ...inviteForm, employeeId: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Assignment Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assignment Notes / Shift Info <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Textarea
                placeholder="e.g. Day shift gate console supervisor"
                value={inviteForm.assignmentReason || ''}
                onChange={(e) => setInviteForm({ ...inviteForm, assignmentReason: e.target.value })}
                className="text-xs resize-none"
                rows={2}
              />
            </div>

            {/* Information Notice */}
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-lg border border-blue-200/60 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs flex gap-2.5 items-start">
              <KeyRound className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <span className="font-semibold">Passwordless Onboarding:</span> An official invitation email will be dispatched immediately. The security officer can log into the security dashboard using their registered email or phone OTP.
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInviteDialogOpen(false)}
                disabled={inviteSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={inviteSubmitting} className="bg-primary text-white">
                {inviteSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* 6. Assign Additional Facility Dialog                                 */}
      {/* ==================================================================== */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Assign Additional Facility
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign <strong className="text-slate-800 dark:text-slate-200">{actionStaff?.fullName}</strong> to an additional parking facility.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssignSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Facility <span className="text-rose-500">*</span>
              </label>
              <Select
                value={assignForm.parkingLotId}
                onValueChange={(val) => setAssignForm({ ...assignForm, parkingLotId: val })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Choose a facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((fac) => {
                    const isAlreadyAssigned = actionStaff?.activeAssignments.some(
                      (a) => a.parkingLotId === fac._id,
                    );
                    return (
                      <SelectItem
                        key={fac._id}
                        value={fac._id}
                        disabled={isAlreadyAssigned}
                      >
                        {fac.parkingName} {isAlreadyAssigned ? '(Already Assigned)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Employee ID for this Facility
              </label>
              <Input
                placeholder="e.g. SEC-042"
                value={assignForm.employeeId || ''}
                onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assignment Reason / Notes
              </label>
              <Textarea
                placeholder="e.g. Multi-facility rover or weekend shift coverage"
                value={assignForm.assignmentReason || ''}
                onChange={(e) => setAssignForm({ ...assignForm, assignmentReason: e.target.value })}
                className="text-xs resize-none"
                rows={2}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAssignDialogOpen(false)}
                disabled={assignSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={assignSubmitting} className="bg-primary text-white">
                {assignSubmitting ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* 7. Edit Staff Info Dialog                                            */}
      {/* ==================================================================== */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-slate-700" />
              Edit Staff Information
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update permitted staff details. Platform roles and email identity cannot be modified.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <Input
                required
                value={editForm.fullName || ''}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mobile Number (+91 format)
              </label>
              <Input
                required
                value={editForm.mobileNumber || ''}
                onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Employee ID
              </label>
              <Input
                placeholder="e.g. SEC-042"
                value={editForm.employeeId || ''}
                onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={editSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={editSubmitting} className="bg-primary text-white">
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* 8. Suspend / Activate Account Dialog                                 */}
      {/* ==================================================================== */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {targetStatus === 'Suspended' ? (
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              )}
              {targetStatus === 'Suspended' ? 'Suspend Staff Account' : 'Reactivate Staff Account'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {targetStatus === 'Suspended'
                ? `Suspending ${actionStaff?.fullName} will immediately revoke their access to security check-in consoles and mobile gates.`
                : `Reactivating ${actionStaff?.fullName} will restore their operational check-in permissions.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason for {targetStatus} <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <Textarea
                placeholder="e.g. Temporary leave of absence / disciplinary action"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="text-xs resize-none"
                rows={3}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsStatusDialogOpen(false)}
                disabled={statusSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleStatusSubmit}
                disabled={statusSubmitting}
                className={targetStatus === 'Suspended' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}
              >
                {statusSubmitting ? 'Updating...' : `Confirm ${targetStatus}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================================================================== */}
      {/* 9. Staff Details Sheet / Drawer                                      */}
      {/* ==================================================================== */}
      <Sheet open={Boolean(selectedStaffId)} onOpenChange={(open) => !open && setSelectedStaffId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6">
          {loadingDetails || !staffDetails ? (
            <div className="space-y-6 pt-4 animate-pulse">
              <div className="flex items-center gap-3">
                <Skeleton className="w-14 h-14 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="w-36 h-5" />
                  <Skeleton className="w-48 h-3.5" />
                </div>
              </div>
              <Skeleton className="w-full h-24 rounded-lg" />
              <Skeleton className="w-full h-40 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              <SheetHeader className="text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-base shrink-0">
                      {staffDetails.staff.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div>
                      <SheetTitle className="text-lg font-bold text-slate-900 dark:text-white">
                        {staffDetails.staff.fullName}
                      </SheetTitle>
                      <SheetDescription className="text-xs text-slate-500">
                        {staffDetails.staff.email} • {staffDetails.staff.mobileNumber}
                      </SheetDescription>
                    </div>
                  </div>
                  <div>
                    {getAccountStatusBadge(staffDetails.staff.accountStatus)}
                  </div>
                </div>
              </SheetHeader>

              {/* Profile Meta Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-800">
                  <span className="text-slate-400 font-medium">Role</span>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    Security Staff
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-800">
                  <span className="text-slate-400 font-medium">Employee ID</span>
                  <p className="font-semibold text-slate-900 dark:text-white font-mono mt-0.5">
                    {staffDetails.staff.employeeId || '—'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/70 dark:border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 font-medium">Invitation</span>
                  <div className="mt-0.5">
                    {getInvitationStatusBadge(staffDetails.staff.invitationStatus)}
                  </div>
                </div>
              </div>

              {/* Operational Stats */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                  Operational Gate Metrics
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      Verified Check-Ins
                    </span>
                    <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                      {staffDetails.operationalStats.totalCheckIns}
                    </h3>
                  </div>
                  <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">
                    <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                      Verified Check-Outs
                    </span>
                    <h3 className="text-xl font-bold text-blue-800 dark:text-blue-300 mt-1">
                      {staffDetails.operationalStats.totalCheckOuts}
                    </h3>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Active Facility Assignments */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Active Facility Posts ({staffDetails.staff.activeAssignments.length})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenAssign(staffDetails.staff)}
                    className="h-7 text-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1" />
                    Assign Another
                  </Button>
                </div>

                {staffDetails.staff.activeAssignments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No active facility posts.</p>
                ) : (
                  <div className="space-y-2">
                    {staffDetails.staff.activeAssignments.map((asg) => (
                      <div
                        key={asg._id}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-slate-900 dark:text-white">
                            {asg.lotName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Assigned on {new Date(asg.assignedAt).toLocaleDateString()}
                            {asg.employeeId ? ` • ID: ${asg.employeeId}` : ''}
                          </p>
                          {asg.assignmentReason && (
                            <p className="text-[10px] text-slate-500 italic">
                              "{asg.assignmentReason}"
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivateAssignment(asg.parkingLotId)}
                          disabled={deactivatingLotId === asg.parkingLotId}
                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs shrink-0"
                          title="Unassign from this facility"
                        >
                          <UserMinus className="w-3.5 h-3.5 mr-1" />
                          Unassign
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Complete Assignment History Timeline */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                  Assignment Audit History ({staffDetails.assignmentHistory.length})
                </h4>

                <div className="space-y-2.5">
                  {staffDetails.assignmentHistory.map((item) => (
                    <div
                      key={item._id}
                      className="p-3 bg-slate-50/70 dark:bg-slate-900/40 rounded-lg border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.lotName}
                        </span>
                        <Badge
                          variant="outline"
                          className={item.assignmentStatus === 'Active' ? 'text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]' : 'text-slate-500 text-[10px]'}
                        >
                          {item.assignmentStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        <div>
                          <span className="text-slate-400">Assigned: </span>
                          {new Date(item.assignedAt).toLocaleDateString()}
                          {item.assignedBy ? ` by ${item.assignedBy.fullName}` : ''}
                        </div>
                        {item.unassignedAt && (
                          <div>
                            <span className="text-slate-400">Unassigned: </span>
                            {new Date(item.unassignedAt).toLocaleDateString()}
                            {item.unassignedBy ? ` by ${item.unassignedBy.fullName}` : ''}
                          </div>
                        )}
                      </div>

                      {item.assignmentReason && (
                        <p className="text-[10px] text-slate-400 italic">
                          Note: {item.assignmentReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default OwnerStaffPage;
