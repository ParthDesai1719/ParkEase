import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  getDashboardOverview,
  getAdminFacilitySubmissions,
  type DashboardOverviewMetrics,
  type AdminFacilitySubmissionItem,
  type FacilitySubmissionsStats,
} from '@/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/lib/socket';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<DashboardOverviewMetrics | null>(null);
  const [submissions, setSubmissions] = useState<AdminFacilitySubmissionItem[]>([]);
  const [facilityStats, setFacilityStats] = useState<FacilitySubmissionsStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      setError(null);

      const [overviewRes, facilitiesRes] = await Promise.allSettled([
        getDashboardOverview(),
        getAdminFacilitySubmissions({ limit: 6, sortBy: 'submittedAt', sortOrder: 'desc' }),
      ]);

      let errorMsg: string | null = null;

      if (overviewRes.status === 'fulfilled' && overviewRes.value.success && overviewRes.value.data) {
        setMetrics(overviewRes.value.data);
      } else if (overviewRes.status === 'rejected') {
        const err = overviewRes.reason;
        errorMsg = err instanceof Error ? err.message : 'Failed to retrieve overview metrics.';
      }

      if (facilitiesRes.status === 'fulfilled' && facilitiesRes.value.success && facilitiesRes.value.data) {
        setSubmissions(facilitiesRes.value.data.submissions);
        setFacilityStats(facilitiesRes.value.data.stats);
      } else if (facilitiesRes.status === 'rejected') {
        const err = facilitiesRes.reason;
        if (!errorMsg) {
          errorMsg = err instanceof Error ? err.message : 'Failed to retrieve facility submissions.';
        }
      }

      if (overviewRes.status === 'rejected' && facilitiesRes.status === 'rejected') {
        setError(errorMsg || 'Unable to connect to the server.');
      }

      if (isManual) {
        if (errorMsg) {
          toast.error(errorMsg);
        } else {
          toast.success('Governance metrics refreshed.');
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to connect to the server. Please check your network.';
      setError(msg);
      if (isManual) toast.error(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time synchronization via WebSocket and window focus
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join_admin');

    const handleRealtimeUpdate = () => {
      void fetchDashboardData();
    };

    socket.on('facility_status_changed', handleRealtimeUpdate);
    socket.on('new_notification', handleRealtimeUpdate);

    const onFocus = () => {
      void fetchDashboardData();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchDashboardData();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      socket.off('facility_status_changed', handleRealtimeUpdate);
      socket.off('new_notification', handleRealtimeUpdate);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchDashboardData]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Submitted':
        return <Badge className="bg-sky-600/10 text-sky-600 border-sky-600/30 text-[10px]">Submitted</Badge>;
      case 'Under Review':
      case 'Pending Review':
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

  const pendingFacilitiesCount = (facilityStats?.submitted ?? 0) + (facilityStats?.underReview ?? 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10 animate-in fade-in-50 duration-300">
      {/* 1. GREETING BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 px-2.5 py-0.5 text-xs font-semibold mb-1.5">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            Platform Administration
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Governance Overview &mdash; {user?.fullName || 'Administrator'}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Review partner registrations, evaluate physical facility setup proposals, and manage authoritative parking structures.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchDashboardData(true)}
            disabled={isRefreshing || loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center justify-between py-4 px-6 text-destructive">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void fetchDashboardData(true)} className="shrink-0">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2. STATS TILES */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Applications Card */}
        <Card
          className={`border transition-all duration-200 ${
            (metrics?.pendingApprovals ?? 0) > 0
              ? 'border-amber-500/50 bg-amber-500/5 shadow-xs ring-1 ring-amber-500/20'
              : 'border-border/80 bg-card'
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Owners
            </CardTitle>
            <Clock
              className={`h-4 w-4 ${
                (metrics?.pendingApprovals ?? 0) > 0 ? 'text-amber-500 animate-pulse' : 'text-muted-foreground'
              }`}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold text-foreground">
                  {metrics?.pendingApprovals ?? 0}
                </div>
                {(metrics?.pendingApprovals ?? 0) > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                    Action Required
                  </Badge>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Owner registrations awaiting review
            </p>
          </CardContent>
        </Card>

        {/* Facility Submissions Card */}
        <Card
          className={`border transition-all duration-200 ${
            pendingFacilitiesCount > 0
              ? 'border-sky-500/50 bg-sky-500/5 shadow-xs ring-1 ring-sky-500/20'
              : 'border-border/80 bg-card'
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Facility Reviews
            </CardTitle>
            <Building2
              className={`h-4 w-4 ${pendingFacilitiesCount > 0 ? 'text-sky-500 animate-pulse' : 'text-muted-foreground'}`}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold text-foreground">
                  {pendingFacilitiesCount}
                </div>
                {pendingFacilitiesCount > 0 && (
                  <Badge className="bg-sky-600 text-white text-[10px] px-1.5 py-0">
                    In Pipeline
                  </Badge>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Facility surveys submitted for setup
            </p>
          </CardContent>
        </Card>

        {/* Total Owners Card */}
        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Approved Owners
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                {metrics?.approvedOwners ?? 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Of {metrics?.totalOwners ?? 0} total registered partners
            </p>
          </CardContent>
        </Card>

        {/* Approved Facilities Card */}
        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Approved Facilities
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                {facilityStats?.approved ?? 0}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Ready for official structure creation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. CORE GOVERNANCE MODULES (Streamlined 3-column operational shortcuts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Module 1: Owner Applications */}
        <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors flex flex-col justify-between shadow-xs">
          <CardHeader className="pb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <UserCheck className="h-5 w-5" />
              </div>
              {(metrics?.pendingApprovals ?? 0) > 0 && (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-semibold">
                  {metrics?.pendingApprovals} Pending
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-bold text-foreground pt-1">
              Owner Onboarding
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Verify credentials, statutory business licenses, government identity proofs, and fee transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm" className="w-full justify-between text-xs font-semibold h-8">
              <Link to="/admin/owners">
                Review Applications
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Module 2: Facility Submissions */}
        <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors flex flex-col justify-between shadow-xs">
          <CardHeader className="pb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 border border-sky-500/20">
                <Building2 className="h-5 w-5" />
              </div>
              {pendingFacilitiesCount > 0 && (
                <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/30 text-[10px] font-semibold">
                  {pendingFacilitiesCount} To Review
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-bold text-foreground pt-1">
              Facility Setup Requests
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Evaluate physical facility survey data, floor breakdown declarations, zone references, and photos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm" className="w-full justify-between text-xs font-semibold h-8">
              <Link to="/admin/facilities">
                Review Facilities
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Module 3: Official Parking Lots */}
        <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors flex flex-col justify-between shadow-xs">
          <CardHeader className="pb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <Layers className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[10px] font-semibold">
                Official Structures
              </Badge>
            </div>
            <CardTitle className="text-base font-bold text-foreground pt-1">
              Parking Lots &amp; Hierarchy
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Convert approved submissions into official lots with multi-floor slots and zone hierarchies.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild variant="outline" size="sm" className="w-full justify-between text-xs font-semibold h-8">
              <Link to="/admin/parking-lots">
                Manage Parking Lots
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 4. RECENT FACILITY SUBMISSIONS (Actionable Pipeline Grid) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Facility Submissions Awaiting Action</h2>
            <p className="text-xs text-muted-foreground">
              Review and validate incoming physical parking setup requests from registered owners.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Link to="/admin/facilities">
              View All Facilities
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg bg-card/50">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
            Loading facility submissions pipeline...
          </div>
        ) : submissions.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submissions.map((sub) => {
              const ownerName =
                typeof sub.ownerId === 'object' && sub.ownerId !== null
                  ? sub.ownerId.fullName
                  : 'Registered Owner';

              return (
                <Card key={sub._id} className="border-border/80 bg-card hover:border-primary/40 transition-colors flex flex-col justify-between">
                  <CardHeader className="pb-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                        {sub.submissionReference}
                      </span>
                      {getStatusBadge(sub.submissionStatus)}
                    </div>
                    <CardTitle className="text-base font-bold text-foreground truncate">
                      {sub.facilityName}
                    </CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {sub.location?.city || 'Location'}, {sub.location?.state || 'India'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0 text-xs">
                    <div className="p-2.5 rounded bg-muted/40 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-semibold text-foreground">
                          {sub.capacity?.totalSlots || 0} Slots ({sub.floors?.length || 1} Floor{(sub.floors?.length || 1) > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Submitted By:</span>
                        <span className="font-medium text-foreground truncate max-w-[130px]" title={ownerName}>
                          {ownerName}
                        </span>
                      </div>
                      {sub.submittedAt && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="text-muted-foreground font-mono">
                            {format(new Date(sub.submittedAt), 'dd MMM yyyy')}
                          </span>
                        </div>
                      )}
                    </div>

                    <Button asChild size="sm" className="w-full gap-1.5 text-xs h-8 font-semibold">
                      <Link to={`/admin/facilities/${sub._id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        Inspect &amp; Review
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-border/80 bg-card/40 p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No Submissions Awaiting Action</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                All physical facility setup requests have been processed. New owner proposals will appear here as soon as they are submitted.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
