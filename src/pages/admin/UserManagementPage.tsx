import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Eye,
  Edit2,
  Ban,
  CheckCircle,
  Trash2,
  Filter,
  Car,
  Phone,
  Mail,
  Shield,
  ShieldAlert,
  Building2,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import {
  adminUsersApi,
  type CustomerListItem,
  type CustomerSummaryCounters,
  type CustomerDetails,
  type CustomerBooking,
} from '@/api/adminUsers.api';
import { useLiveSync } from '@/hooks/useLiveSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

export const UserManagementPage: React.FC = () => {
  // State: List, Summary & Pagination
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [summary, setSummary] = useState<CustomerSummaryCounters>({
    totalCustomers: 0,
    activeCustomers: 0,
    suspendedCustomers: 0,
    deactivatedCustomers: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters State
  const [search, setSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [bookingActivityFilter, setBookingActivityFilter] = useState<'ALL' | 'HAS_BOOKINGS' | 'NO_BOOKINGS'>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Drawer / View Details State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [customerBookings, setCustomerBookings] = useState<CustomerBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(false);
  const [bookingsPage, setBookingsPage] = useState<number>(1);
  const [bookingsTotalPages, setBookingsTotalPages] = useState<number>(1);

  // Modal States
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    mobileNumber: '',
    gender: 'Prefer Not To Say' as 'Male' | 'Female' | 'Other' | 'Prefer Not To Say',
    preferredLanguage: 'English' as 'English' | 'Hindi' | 'Gujarati',
    timezone: 'Asia/Kolkata',
  });
  const [editSaving, setEditSaving] = useState<boolean>(false);

  // Suspension Modal State
  const [suspendModalOpen, setSuspendModalOpen] = useState<boolean>(false);
  const [suspendingCustomer, setSuspendingCustomer] = useState<CustomerListItem | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>('');
  const [suspendSubmitting, setSuspendSubmitting] = useState<boolean>(false);

  // Reactivate Modal State
  const [activateModalOpen, setActivateModalOpen] = useState<boolean>(false);
  const [activatingCustomer, setActivatingCustomer] = useState<CustomerListItem | null>(null);
  const [activationRemarks, setActivationRemarks] = useState<string>('');
  const [activateSubmitting, setActivateSubmitting] = useState<boolean>(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerListItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // Fetch Directory
  // -------------------------------------------------------------------------
  const fetchCustomers = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await adminUsersApi.getCustomers({
        page,
        limit,
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        bookingActivity: bookingActivityFilter !== 'ALL' ? bookingActivityFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      setCustomers(res.users);
      setSummary(res.summary);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: unknown) {
      if (!isSilent) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve customers';
        toast.error(msg);
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [page, limit, search, statusFilter, bookingActivityFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useLiveSync(() => {
    void fetchCustomers(true);
  });

  // -------------------------------------------------------------------------
  // Fetch Customer Details for Drawer
  // -------------------------------------------------------------------------
  const fetchCustomerDetails = useCallback(async (userId: string) => {
    try {
      setDetailsLoading(true);
      const details = await adminUsersApi.getCustomerDetails(userId);
      setCustomerDetails(details);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load customer details';
      toast.error(msg);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const fetchCustomerBookings = useCallback(async (userId: string, targetPage = 1) => {
    try {
      setBookingsLoading(true);
      const res = await adminUsersApi.getCustomerBookings(userId, {
        page: targetPage,
        limit: 5,
      });
      setCustomerBookings(res.bookings);
      setBookingsPage(res.pagination.page);
      setBookingsTotalPages(res.pagination.totalPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load bookings';
      toast.error(msg);
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  const openCustomerDrawer = (user: CustomerListItem) => {
    setSelectedCustomerId(user._id);
    fetchCustomerDetails(user._id);
    fetchCustomerBookings(user._id, 1);
  };

  // -------------------------------------------------------------------------
  // Action Handlers
  // -------------------------------------------------------------------------
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatusFilter('ALL');
    setBookingActivityFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Edit Profile
  const openEditModal = (user: CustomerListItem) => {
    setEditingCustomer(user);
    setEditForm({
      fullName: user.fullName || '',
      mobileNumber: user.mobileNumber || '',
      gender: (user.gender as any) || 'Prefer Not To Say',
      preferredLanguage: (user.preferredLanguage as any) || 'English',
      timezone: user.timezone || 'Asia/Kolkata',
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    try {
      setEditSaving(true);
      await adminUsersApi.updateProfile(editingCustomer._id, editForm);
      toast.success(`Profile for ${editForm.fullName} updated successfully.`);
      setEditModalOpen(false);
      fetchCustomers();
      if (selectedCustomerId === editingCustomer._id) {
        fetchCustomerDetails(editingCustomer._id);
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || (err instanceof Error ? err.message : 'Failed to update profile');
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  // Suspend
  const openSuspendModal = (user: CustomerListItem) => {
    setSuspendingCustomer(user);
    setSuspensionReason('');
    setSuspendModalOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendingCustomer) return;
    if (!suspensionReason.trim() || suspensionReason.trim().length < 5) {
      toast.error('Please specify a detailed suspension reason (at least 5 characters).');
      return;
    }

    try {
      setSuspendSubmitting(true);
      await adminUsersApi.suspendCustomer(suspendingCustomer._id, suspensionReason);
      toast.success(`Customer ${suspendingCustomer.fullName} has been suspended.`);
      setSuspendModalOpen(false);
      fetchCustomers();
      if (selectedCustomerId === suspendingCustomer._id) {
        fetchCustomerDetails(suspendingCustomer._id);
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || (err instanceof Error ? err.message : 'Failed to suspend account');
      toast.error(msg);
    } finally {
      setSuspendSubmitting(false);
    }
  };

  // Activate
  const openActivateModal = (user: CustomerListItem) => {
    setActivatingCustomer(user);
    setActivationRemarks('');
    setActivateModalOpen(true);
  };

  const handleConfirmActivate = async () => {
    if (!activatingCustomer) return;
    try {
      setActivateSubmitting(true);
      await adminUsersApi.activateCustomer(activatingCustomer._id, activationRemarks);
      toast.success(`Customer ${activatingCustomer.fullName} has been reactivated.`);
      setActivateModalOpen(false);
      fetchCustomers();
      if (selectedCustomerId === activatingCustomer._id) {
        fetchCustomerDetails(activatingCustomer._id);
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || (err instanceof Error ? err.message : 'Failed to reactivate account');
      toast.error(msg);
    } finally {
      setActivateSubmitting(false);
    }
  };

  // Delete
  const openDeleteModal = (user: CustomerListItem) => {
    setDeletingCustomer(user);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;
    try {
      setDeleteSubmitting(true);
      const res = await adminUsersApi.deleteCustomer(deletingCustomer._id);
      toast.success(res.message || `Customer account deleted.`);
      setDeleteModalOpen(false);
      if (selectedCustomerId === deletingCustomer._id) {
        setSelectedCustomerId(null);
      }
      fetchCustomers();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || (err instanceof Error ? err.message : 'Failed to delete account');
      toast.error(msg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Status Badge Helper
  // -------------------------------------------------------------------------
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
            Active
          </Badge>
        );
      case 'Suspended':
        return (
          <Badge variant="destructive" className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20 font-medium">
            Suspended
          </Badge>
        );
      case 'Deactivated':
        return (
          <Badge variant="secondary" className="bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20 font-medium">
            Deactivated
          </Badge>
        );
      case 'Pending Verification':
        return (
          <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* Page Title & Breadcrumb Header */}
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/admin/dashboard" className="hover:text-foreground transition-colors">
            Admin Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">People Management</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Customer Directory</span>
        </nav>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Customer Directory
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage customer accounts, inspect booking engagement, and enforce account governance.
              </p>
            </div>
          </div>

          {/* Unified People Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border/80 pb-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground shadow-xs">
              <Users className="h-3.5 w-3.5" />
              Customers
            </div>
            <Link
              to="/admin/owners"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Building2 className="h-3.5 w-3.5" />
              Parking Owners
            </Link>
            <Link
              to="/admin/staff"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              Security Staff
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Counters Summary Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold tracking-tight">{summary.totalCustomers}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Accounts</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {summary.activeCustomers}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Suspended</p>
              <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {summary.suspendedCustomers}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-zinc-500/10 rounded-xl text-zinc-600 dark:text-zinc-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Deactivated</p>
              <p className="text-2xl font-bold tracking-tight">{summary.deactivatedCustomers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone number, or User ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" className="gap-2">
              <Filter className="h-4 w-4" />
              Search
            </Button>
          </form>

          {/* Secondary Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border/50">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Account Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Deactivated">Deactivated</option>
                <option value="Pending Verification">Pending Verification</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Booking Activity</Label>
              <select
                value={bookingActivityFilter}
                onChange={(e) => {
                  setBookingActivityFilter(e.target.value as any);
                  setPage(1);
                }}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All Activity</option>
                <option value="HAS_BOOKINGS">Has Bookings (Active Bookers)</option>
                <option value="NO_BOOKINGS">No Bookings (Zero)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Registered From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Registered To</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 text-xs flex-1"
                />
                {(search || statusFilter !== 'ALL' || bookingActivityFilter !== 'ALL' || dateFrom || dateTo) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Directory Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Bookings</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-36 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-40 mb-1" />
                        <Skeleton className="h-3 w-28" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-16" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Skeleton className="h-8 w-24 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <Users className="mx-auto h-8 w-8 opacity-40 mb-2" />
                      <p className="font-medium">No customer accounts found</p>
                      <p className="text-xs text-muted-foreground/80 mt-1">
                        Try adjusting your search query or filter criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  customers.map((user) => {
                    const initials = user.fullName
                      ? user.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : 'U';

                    return (
                      <tr
                        key={user._id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Name & Initials */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground hover:underline cursor-pointer" onClick={() => openCustomerDrawer(user)}>
                                {user.fullName}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                ID: {user._id.slice(-6)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact Information */}
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-foreground">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span>{user.email}</span>
                              {user.emailVerified && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                  verified
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{user.mobileNumber}</span>
                              {user.mobileVerified && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                  verified
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Booking Count */}
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="font-medium">
                            {user.bookingCount} {user.bookingCount === 1 ? 'booking' : 'bookings'}
                          </Badge>
                        </td>

                        {/* Account Status */}
                        <td className="px-4 py-3">
                          {renderStatusBadge(user.accountStatus)}
                        </td>

                        {/* Registration Date */}
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {user.createdAt ? format(new Date(user.createdAt), 'dd MMM yyyy') : '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Details Drawer */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="View Customer Details"
                              onClick={() => openCustomerDrawer(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Edit Profile */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit Customer Profile"
                              onClick={() => openEditModal(user)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>

                            {/* Suspend or Reactivate */}
                            {user.accountStatus === 'Suspended' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Reactivate Account"
                                onClick={() => openActivateModal(user)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                title="Suspend Account"
                                onClick={() => openSuspendModal(user)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Delete (Permitted check handled by server) */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                              title="Delete Account"
                              onClick={() => openDeleteModal(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                Showing {total === 0 ? 0 : (page - 1) * limit + 1} to{' '}
                {Math.min(page * limit, total)} of {total} customer{total === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-8 px-2 gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="font-medium text-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="h-8 px-2 gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =================================================================== */}
      {/* Slide-out Customer Details Sheet (Drawer) */}
      {/* =================================================================== */}
      <Sheet
        open={!!selectedCustomerId}
        onOpenChange={(open) => !open && setSelectedCustomerId(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {detailsLoading || !customerDetails ? (
            <div className="p-6 space-y-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="p-6 border-b border-border bg-muted/20">
                <SheetHeader className="text-left space-y-1">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-xl font-bold">
                      {customerDetails.user.fullName}
                    </SheetTitle>
                    {renderStatusBadge(customerDetails.user.accountStatus)}
                  </div>
                  <SheetDescription className="text-xs font-mono">
                    ID: {customerDetails.user._id}
                  </SheetDescription>
                </SheetHeader>

                {/* Suspension Banner if Suspended */}
                {customerDetails.user.accountStatus === 'Suspended' && (
                  <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" /> Account is currently suspended
                    </p>
                    <p className="text-rose-700 dark:text-rose-300">
                      Reason: {customerDetails.user.suspensionReason || 'No reason specified'}
                    </p>
                    {customerDetails.user.suspendedAt && (
                      <p className="text-[11px] opacity-80">
                        Suspended on{' '}
                        {format(new Date(customerDetails.user.suspendedAt), 'dd MMM yyyy, hh:mm a')}
                        {customerDetails.user.suspendedBy && (
                          <span> by {customerDetails.user.suspendedBy.fullName}</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Tabs Container */}
              <Tabs defaultValue="overview" className="flex-1 flex flex-col p-6">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="overview">Overview & Profile</TabsTrigger>
                  <TabsTrigger value="bookings">Booking History</TabsTrigger>
                </TabsList>

                {/* TAB 1: Profile & Overview */}
                <TabsContent value="overview" className="space-y-6 flex-1">
                  {/* Booking KPI Metrics Grid */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Booking Engagement Metrics
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 bg-muted/40 rounded-lg border border-border">
                        <p className="text-[11px] text-muted-foreground">Total</p>
                        <p className="text-lg font-bold">{customerDetails.bookingSummary.totalBookings}</p>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg border border-border">
                        <p className="text-[11px] text-muted-foreground">Active</p>
                        <p className="text-lg font-bold text-primary">{customerDetails.bookingSummary.activeBookings}</p>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg border border-border">
                        <p className="text-[11px] text-muted-foreground">Completed</p>
                        <p className="text-lg font-bold text-emerald-600">{customerDetails.bookingSummary.completedBookings}</p>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg border border-border">
                        <p className="text-[11px] text-muted-foreground">Cancelled</p>
                        <p className="text-lg font-bold text-zinc-500">{customerDetails.bookingSummary.cancelledBookings}</p>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg border border-border">
                        <p className="text-[11px] text-muted-foreground">No Show</p>
                        <p className="text-lg font-bold text-amber-500">{customerDetails.bookingSummary.noShowBookings}</p>
                      </div>
                      <div className="p-3 bg-muted/40 rounded-lg border border-border">
                        <p className="text-[11px] text-muted-foreground">Overstay</p>
                        <p className="text-lg font-bold text-rose-500">{customerDetails.bookingSummary.overstayBookings}</p>
                      </div>
                    </div>
                  </div>

                  {/* Profile Attributes */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Account Attributes
                    </h3>
                    <div className="rounded-lg border border-border divide-y divide-border text-xs">
                      <div className="p-2.5 flex justify-between">
                        <span className="text-muted-foreground">Email Address</span>
                        <span className="font-medium text-foreground">{customerDetails.user.email}</span>
                      </div>
                      <div className="p-2.5 flex justify-between">
                        <span className="text-muted-foreground">Mobile Number</span>
                        <span className="font-medium text-foreground">{customerDetails.user.mobileNumber}</span>
                      </div>
                      <div className="p-2.5 flex justify-between">
                        <span className="text-muted-foreground">Gender</span>
                        <span className="font-medium text-foreground">{customerDetails.user.gender}</span>
                      </div>
                      <div className="p-2.5 flex justify-between">
                        <span className="text-muted-foreground">Language</span>
                        <span className="font-medium text-foreground">{customerDetails.user.preferredLanguage}</span>
                      </div>
                      <div className="p-2.5 flex justify-between">
                        <span className="text-muted-foreground">Timezone</span>
                        <span className="font-medium text-foreground">{customerDetails.user.timezone}</span>
                      </div>
                      <div className="p-2.5 flex justify-between">
                        <span className="text-muted-foreground">Registration Date</span>
                        <span className="font-medium text-foreground">
                          {customerDetails.user.createdAt ? format(new Date(customerDetails.user.createdAt), 'PPpp') : '—'}
                        </span>
                      </div>
                      <div className="p-2.5 flex justify-between">
                        <span className="text-muted-foreground">Last Login</span>
                        <span className="font-medium text-foreground">
                          {customerDetails.user.lastLogin ? format(new Date(customerDetails.user.lastLogin), 'PPpp') : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Registered Vehicles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Registered Vehicles ({customerDetails.vehicles.length})
                      </h3>
                    </div>
                    {customerDetails.vehicles.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No vehicles registered yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {customerDetails.vehicles.map((v) => (
                          <div
                            key={v._id}
                            className="p-3 rounded-lg border border-border bg-card flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-md text-primary">
                                <Car className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-bold tracking-wider">{v.vehicleNumber}</p>
                                <p className="text-muted-foreground">
                                  {v.vehicleBrand} {v.vehicleModel} • {v.vehicleType}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {v.isPrimary && <Badge variant="outline">Primary</Badge>}
                              <Badge variant="secondary">{v.vehicleStatus}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Sessions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Activity & Sessions
                    </h3>
                    {customerDetails.recentSessions.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No session logs found.</p>
                    ) : (
                      <div className="space-y-2">
                        {customerDetails.recentSessions.map((s) => (
                          <div
                            key={s.sessionId}
                            className="p-2.5 rounded-lg border border-border text-xs flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium">
                                {format(new Date(s.loginTime), 'dd MMM yyyy, hh:mm a')}
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                {s.deviceName || 'Web Browser'} • IP: {s.ipAddress || 'Unknown'}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                s.sessionStatus === 'Active'
                                  ? 'border-emerald-500/30 text-emerald-600'
                                  : 'text-muted-foreground'
                              }
                            >
                              {s.sessionStatus}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* TAB 2: Paginated Booking History */}
                <TabsContent value="bookings" className="space-y-4 flex-1">
                  {bookingsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : customerBookings.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <History className="h-8 w-8 mx-auto opacity-40 mb-2" />
                      <p className="text-sm font-medium">No bookings on record</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerBookings.map((b) => (
                        <div
                          key={b._id}
                          className="p-3 rounded-lg border border-border bg-card space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-foreground">
                              {b.bookingReference}
                            </span>
                            <Badge variant="outline">{b.bookingStatus}</Badge>
                          </div>

                          <div className="text-muted-foreground space-y-0.5">
                            <p className="font-medium text-foreground">
                              {b.parkingLotId?.facilityName || b.parkingLotId?.parkingName || 'Facility'}
                            </p>
                            <p>
                              Vehicle: {b.vehicleId?.vehicleNumber || '—'} ({b.vehicleId?.vehicleModel || ''})
                              {b.slotId && <span> • Bay: {b.slotId.slotNumber}</span>}
                            </p>
                            <p>
                              Duration: {format(new Date(b.startTime), 'dd MMM, hh:mm a')} –{' '}
                              {format(new Date(b.endTime), 'hh:mm a')}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                            <span className="text-muted-foreground">
                              Total: ₹{b.totalAmount || b.payment?.totalAmount || 0}
                            </span>
                            <span className="font-medium">
                              Payment: {b.payment?.paymentStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Booking History Pagination */}
                      {bookingsTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={bookingsPage <= 1 || bookingsLoading}
                            onClick={() => fetchCustomerBookings(customerDetails.user._id, bookingsPage - 1)}
                            className="h-7 text-xs"
                          >
                            Prev
                          </Button>
                          <span>
                            Page {bookingsPage} of {bookingsTotalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={bookingsPage >= bookingsTotalPages || bookingsLoading}
                            onClick={() => fetchCustomerBookings(customerDetails.user._id, bookingsPage + 1)}
                            className="h-7 text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* =================================================================== */}
      {/* Edit Profile Modal */}
      {/* =================================================================== */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer Profile</DialogTitle>
            <DialogDescription>
              Update permitted customer identity information. Transaction history and emails cannot be modified here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                placeholder="Full name"
              />
            </div>

            <div>
              <Label htmlFor="edit-phone">Mobile Number (+91 format)</Label>
              <Input
                id="edit-phone"
                value={editForm.mobileNumber}
                onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
                placeholder="+919876543210"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-gender">Gender</Label>
                <select
                  id="edit-gender"
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as any })}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 shadow-xs"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer Not To Say">Prefer Not To Say</option>
                </select>
              </div>

              <div>
                <Label htmlFor="edit-language">Language</Label>
                <select
                  id="edit-language"
                  value={editForm.preferredLanguage}
                  onChange={(e) => setEditForm({ ...editForm, preferredLanguage: e.target.value as any })}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 shadow-xs"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Gujarati">Gujarati</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-timezone">Timezone</Label>
              <Input
                id="edit-timezone"
                value={editForm.timezone}
                onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                placeholder="Asia/Kolkata"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* Suspend Account Modal */}
      {/* =================================================================== */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Ban className="h-5 w-5" /> Suspend Customer Account
            </DialogTitle>
            <DialogDescription>
              Enforce disciplinary or compliance suspension on this customer account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs space-y-1">
              <p className="font-semibold">Governance & Security Impact:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>All active sessions are terminated immediately.</li>
                <li>Customer is blocked from logging in or booking bays.</li>
                <li>Historical booking, payment, and audit records remain intact.</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="suspend-reason" className="text-xs font-semibold">
                Reason for Suspension <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="suspend-reason"
                rows={3}
                placeholder="Explain why this account is being suspended (minimum 5 characters)..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendModalOpen(false)}
              disabled={suspendSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmSuspend}
              disabled={suspendSubmitting}
            >
              {suspendSubmitting ? 'Suspending...' : 'Confirm Suspension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* Reactivate Account Modal */}
      {/* =================================================================== */}
      <Dialog open={activateModalOpen} onOpenChange={setActivateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-600 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" /> Reactivate Customer Account
            </DialogTitle>
            <DialogDescription>
              Restore full platform access for {activatingCustomer?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Reactivating this account will clear active suspension restrictions. The customer will be notified via email and in-app alert that they may log in and make bookings.
            </p>

            <div>
              <Label htmlFor="activate-remarks" className="text-xs font-semibold">
                Administrative Remarks (Optional)
              </Label>
              <Input
                id="activate-remarks"
                placeholder="Optional notes or condition of reactivation..."
                value={activationRemarks}
                onChange={(e) => setActivationRemarks(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActivateModalOpen(false)}
              disabled={activateSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmActivate}
              disabled={activateSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {activateSubmitting ? 'Reactivating...' : 'Reactivate Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* Delete Customer Account Modal */}
      {/* =================================================================== */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Customer Account
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {deletingCustomer?.fullName}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs text-muted-foreground">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Compliance & Audit Protection Rule:</p>
              <p>
                Platform policy strictly forbids deleting any customer account that has active bookings or past financial transaction history. If this customer has existing records, the system will reject deletion and advise suspension instead.
              </p>
            </div>
            <p>
              Only unutilized customer accounts (0 bookings and 0 payments) can be permanently removed from the database.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? 'Deleting...' : 'Proceed with Deletion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
