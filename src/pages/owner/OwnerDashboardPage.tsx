import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  LayoutGrid,
  Eye,
  Edit3,
  RefreshCw,
  Trash2,
  PlusCircle,
  CheckCircle2,
  Car,
  IndianRupee,
  Activity,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/authStore';
import {
  getOwnerSubmissions,
  deleteDraftSubmission,
  type FacilitySubmissionData,
} from '@/api/facilitySubmission.api';
import {
  getOwnerParkingLots,
  type OfficialParkingLot,
} from '@/api/parkingLot.api';
import {
  getOwnerDashboardStats,
  type OwnerDashboardStatsData,
} from '@/api/owner.api';
import { getSocket } from '@/lib/socket';

const formatAddress = (addr: OfficialParkingLot['address']): string => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.street, addr.city, addr.state].filter(Boolean).join(', ');
};

export const OwnerDashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  // States
  const [selectedLotFilter, setSelectedLotFilter] = useState<string>('all');
  const [stats, setStats] = useState<OwnerDashboardStatsData | null>(null);
  const [submissions, setSubmissions] = useState<FacilitySubmissionData[]>([]);
  const [parkingLots, setParkingLots] = useState<OfficialParkingLot[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<FacilitySubmissionData | null>(null);
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);

  // Fetch Dashboard Stats & Lists
  const fetchData = useCallback(async (isManual = false) => {
    try {
      if (isManual) {
        setIsRefreshing(true);
      }
      const [statsRes, subsRes, lotsRes] = await Promise.allSettled([
        getOwnerDashboardStats(selectedLotFilter),
        getOwnerSubmissions(),
        getOwnerParkingLots({ limit: 50 }),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
      if (subsRes.status === 'fulfilled') {
        setSubmissions(subsRes.value);
      }
      if (
        lotsRes.status === 'fulfilled' &&
        lotsRes.value?.success &&
        lotsRes.value?.data?.parkingLots
      ) {
        setParkingLots(lotsRes.value.data.parkingLots);
      }

      if (isManual) {
        toast.success('Dashboard metrics refreshed.');
      }
    } catch {
      // Handled silently
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLotFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Real-time socket updates and visibility polling
  useEffect(() => {
    const socket = getSocket();
    if (user?._id) {
      socket.emit('join_owner', user._id);
    }

    const handleStatusChanged = () => {
      void fetchData();
    };

    socket.on('facility_status_changed', handleStatusChanged);
    socket.on('booking_status_updated', handleStatusChanged);

    const onFocus = () => {
      void fetchData();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchData();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchData();
      }
    }, 10000);

    return () => {
      socket.off('facility_status_changed', handleStatusChanged);
      socket.off('booking_status_updated', handleStatusChanged);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(interval);
    };
  }, [user?._id, fetchData]);

  const confirmDeleteDraft = async () => {
    if (!draftToDelete?._id) return;
    setIsDeletingDraft(true);
    try {
      await deleteDraftSubmission(draftToDelete._id);
      setSubmissions((prev) => prev.filter((s) => s._id !== draftToDelete._id));
      toast.success(`Draft "${draftToDelete.facilityName || 'Draft'}" deleted successfully.`);
      setDraftToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete draft.';
      toast.error(msg);
    } finally {
      setIsDeletingDraft(false);
    }
  };

  const pendingReviewLots = parkingLots.filter((l) => l.layoutReviewStatus === 'Pending Owner Review');
  const confirmedReadyLots = parkingLots.filter(
    (l) => l.layoutReviewStatus === 'Owner Confirmed' && l.parkingStatus !== 'Active',
  );

  const getBookingStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className="bg-sky-600/10 text-sky-600 border-sky-600/30 text-[10px]">Confirmed</Badge>;
      case 'Active':
      case 'Checked In':
        return <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-[10px]">Checked In</Badge>;
      case 'Completed':
        return <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/30 text-[10px]">Completed</Badge>;
      case 'Cancelled':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Cancelled</Badge>;
      case 'No Show':
        return <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30 text-[10px]">No Show</Badge>;
      case 'Overstay':
        return <Badge className="bg-rose-600/10 text-rose-600 border-rose-600/30 text-[10px]">Overstay</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  const getSubmissionStatusBadge = (status?: string) => {
    switch (status) {
      case 'Submitted':
        return <Badge className="bg-sky-600/10 text-sky-600 border-sky-600/30 text-[10px]">Submitted</Badge>;
      case 'Under Review':
        return <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/30 text-[10px]">Under Review</Badge>;
      case 'Changes Requested':
        return <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30 text-[10px]">Changes Requested</Badge>;
      case 'Approved':
        return <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-[10px]">Approved</Badge>;
      case 'Rejected':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">{status || 'Draft'}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. TOP HEADER & PARKING LOT SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
              Parking Owner Portal
            </Badge>
            {stats && stats.parkingLotsSummary.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stats.parkingLotsSummary.length} Active {stats.parkingLotsSummary.length === 1 ? 'Facility' : 'Facilities'}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Operational Dashboard
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Live slot occupancy, daily bookings, revenue figures, and parking lot management.
          </p>
        </div>

        {/* PARKING LOT SWITCHER & REFRESH */}
        <div className="flex flex-wrap items-center gap-3">
          {stats && stats.parkingLotsSummary.length > 0 && (
            <div className="min-w-[220px]">
              <Select value={selectedLotFilter} onValueChange={setSelectedLotFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Facility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Facilities (Consolidated)</SelectItem>
                  {stats.parkingLotsSummary.map((lot) => (
                    <SelectItem key={lot._id} value={lot._id}>
                      {lot.parkingName} ({lot.totalSlots} Slots)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData(true)}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
            <Link to="/owner/parking/submissions/new">
              <PlusCircle className="h-3.5 w-3.5" />
              New Facility
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. ACTION REQUIRED ALERTS */}
      {pendingReviewLots.length > 0 && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-sky-500/20 p-2 text-sky-600 dark:text-sky-400 shrink-0">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Action Required: 2D Layout Plan Ready for Review ({pendingReviewLots.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The platform administration has published an official 2D layout. Please inspect and confirm the layout to unlock live activation.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pendingReviewLots.map((lot) => (
              <Button asChild key={lot._id} size="sm" className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5 text-xs font-semibold">
                <Link to={`/owner/parking-lots/${lot._id}/layout`}>
                  <Eye className="h-3.5 w-3.5" />
                  Review {lot.parkingName}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {confirmedReadyLots.length > 0 && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Layout Confirmed &mdash; Facility Ready for Go-Live Activation ({confirmedReadyLots.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Layout review is complete. You may now activate this parking facility to make it publicly discoverable to customers.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {confirmedReadyLots.map((lot) => (
              <Button asChild key={lot._id} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold">
                <Link to={`/owner/parking-lots/${lot._id}/layout`}>
                  <Activity className="h-3.5 w-3.5" />
                  Activate {lot.parkingName}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 3. REAL-TIME KPI METRICS (TASK 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Slots */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Slots</span>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <LayoutGrid className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : (stats?.totalSlots ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.availableSlots ?? 0} Available &bull; {stats?.occupiedSlots ?? 0} Occupied
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Live Occupancy Rate */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Occupancy Rate</span>
              <div className="rounded-lg bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : `${stats?.occupancyPercentage ?? 0}%`}
              </div>
              <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, stats?.occupancyPercentage ?? 0)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Bookings */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Today's Bookings</span>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <Car className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : (stats?.todayBookingsCount ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Reservations scheduled today
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Today's Revenue</span>
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? '...' : `₹${stats?.todayRevenue?.toLocaleString('en-IN') ?? 0}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active Staff: <span className="font-semibold text-foreground">{stats?.activeSecurityStaffCount ?? 0}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. RECENT BOOKINGS TABLE (TASK 2) */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base font-bold text-foreground">Recent Bookings</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Live reservations and visitor movements across your parking facilities
            </CardDescription>
          </div>
          {stats && stats.recentBookings.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal">
              Latest {stats.recentBookings.length}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading recent bookings...
            </div>
          ) : !stats?.recentBookings || stats.recentBookings.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No bookings recorded yet for this facility.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Reference</th>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Vehicle</th>
                    <th className="py-3 px-4 font-semibold">Slot / Facility</th>
                    <th className="py-3 px-4 font-semibold">Schedule</th>
                    <th className="py-3 px-4 font-semibold">Amount</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {stats.recentBookings.map((b) => (
                    <tr key={b._id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {b.bookingReference}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">{b.customer?.fullName || 'Guest'}</div>
                        <div className="text-[11px] text-muted-foreground">{b.customer?.mobileNumber || b.customer?.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-medium text-foreground">{b.vehicle?.vehicleNumber || '—'}</span>
                        <span className="text-[11px] text-muted-foreground ml-1.5">({b.vehicle?.vehicleType || 'Car'})</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">
                          Slot {b.slot?.slotNumber || b.slot?.slotLabel || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {b.parkingLot?.parkingName || 'Facility'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <div>{format(new Date(b.scheduledEntryTime), 'dd MMM, HH:mm')}</div>
                        <div className="text-[11px]">&rarr; {format(new Date(b.scheduledExitTime), 'HH:mm')}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        ₹{b.totalAmount}
                      </td>
                      <td className="py-3 px-4">
                        {getBookingStatusBadge(b.bookingStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. OFFICIAL PARKING LOTS QUICK ACCESS (TASK 3) */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base font-bold text-foreground">My Official Parking Lots</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Official facilities created, published, and managed under your account
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs gap-1">
            <Link to="/owner/parking-lots">
              View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {parkingLots.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No official parking lots created yet. Official lots are provisioned upon approval of facility submissions.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {parkingLots.map((lot) => (
                <div
                  key={lot._id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs hover:border-primary/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant="outline"
                        className={
                          lot.parkingStatus === 'Active'
                            ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]'
                            : 'border-muted text-muted-foreground text-[10px]'
                        }
                      >
                        {lot.parkingStatus}
                      </Badge>
                      <span className="text-xs font-semibold text-primary">₹{lot.hourlyRate}/hr</span>
                    </div>
                    <h3 className="font-bold text-sm text-foreground truncate">{lot.parkingName}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{formatAddress(lot.address)}, {lot.city}</p>

                    <div className="grid grid-cols-3 gap-2 text-center my-3 py-2 bg-muted/30 rounded-lg">
                      <div>
                        <div className="text-xs font-bold text-foreground">{lot.totalSlots}</div>
                        <div className="text-[10px] text-muted-foreground">Total Bays</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-600">{lot.availableSlots}</div>
                        <div className="text-[10px] text-muted-foreground">Available</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{lot.occupancyPercentage ?? 0}%</div>
                        <div className="text-[10px] text-muted-foreground">Occupancy</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <Button asChild variant="outline" size="sm" className="flex-1 text-xs h-8">
                      <Link to={`/owner/parking-lots/${lot._id}`}>
                        <Building2 className="h-3 w-3 mr-1" /> Details
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="text-xs h-8">
                      <Link to={`/owner/parking-lots/${lot._id}/layout`}>
                        <Eye className="h-3 w-3 mr-1" /> Layout
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. FACILITY SETUP SUBMISSIONS TRACKING (PRESERVED) */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
          <div>
            <CardTitle className="text-base font-bold text-foreground">Facility Setup Submissions</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Review requests and formal facility specifications submitted for platform verification
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="text-xs gap-1">
            <Link to="/owner/parking/submissions/new">
              <PlusCircle className="h-3.5 w-3.5" /> Submit Request
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              No facility setup requests submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Facility Name</th>
                    <th className="py-3 px-4 font-semibold">City / State</th>
                    <th className="py-3 px-4 font-semibold">Capacity</th>
                    <th className="py-3 px-4 font-semibold">Submission Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {submissions.map((s) => (
                    <tr key={s._id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        {s.facilityName || 'Untitled Facility'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {s.location?.city || '—'}, {s.location?.state || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {s.capacity?.totalSlots || 0} slots ({s.floors?.length || 1} {s.floors?.length === 1 ? 'floor' : 'floors'})
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {s.submittedAt ? format(new Date(s.submittedAt), 'dd MMM yyyy') : 'Draft'}
                      </td>
                      <td className="py-3 px-4">
                        {getSubmissionStatusBadge(s.submissionStatus)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {s.submissionStatus === 'Draft' ? (
                            <>
                              <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                                <Link to={`/owner/parking/submissions/${s._id}/edit`}>
                                  <Edit3 className="h-3 w-3 mr-1" /> Edit
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDraftToDelete(s)}
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                              <Link to={`/owner/parking/submissions/${s._id}`}>
                                <Eye className="h-3 w-3 mr-1" /> View Status
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DELETE DRAFT CONFIRMATION DIALOG */}
      <Dialog open={!!draftToDelete} onOpenChange={(open) => !open && setDraftToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft Submission?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the draft for &quot;{draftToDelete?.facilityName || 'Draft'}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDraftToDelete(null)} disabled={isDeletingDraft}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteDraft} disabled={isDeletingDraft}>
              {isDeletingDraft ? 'Deleting...' : 'Delete Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
