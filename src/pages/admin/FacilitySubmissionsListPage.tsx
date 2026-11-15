import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  getAdminFacilitySubmissions,
  type AdminFacilitySubmissionItem,
  type FacilitySubmissionsStats,
} from '@/api/admin.api';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

export const FacilitySubmissionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [submissions, setSubmissions] = useState<AdminFacilitySubmissionItem[]>([]);
  const [stats, setStats] = useState<FacilitySubmissionsStats>({
    total: 0,
    submitted: 0,
    underReview: 0,
    changesRequested: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination States from URL
  const currentStatus = searchParams.get('status') || 'All';
  const currentSearch = searchParams.get('search') || '';
  const currentPage = Number(searchParams.get('page')) || 1;
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminFacilitySubmissions({
        status: currentStatus === 'All' ? undefined : currentStatus,
        search: currentSearch || undefined,
        page: currentPage,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (res.success && res.data) {
        setSubmissions(res.data.submissions);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.total);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      } else {
        setError(res.message || 'Failed to load facility submissions.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error connecting to the server.');
    } finally {
      setLoading(false);
    }
  }, [currentStatus, currentSearch, currentPage]);

  useEffect(() => {
    let isSubscribed = true;

    const fetchInitial = async () => {
      try {
        const res = await getAdminFacilitySubmissions({
          status: currentStatus === 'All' ? undefined : currentStatus,
          search: currentSearch || undefined,
          page: currentPage,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        if (isSubscribed && res.success && res.data) {
          setSubmissions(res.data.submissions);
          setTotalPages(res.data.totalPages);
          setTotalCount(res.data.total);
          if (res.data.stats) {
            setStats(res.data.stats);
          }
          setError(null);
        } else if (isSubscribed) {
          setError(res.message || 'Failed to load facility submissions.');
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
  }, [currentStatus, currentSearch, currentPage]);

  const handleTabChange = (status: string) => {
    const params = new URLSearchParams(searchParams);
    if (status === 'All') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  // Debounce search input for live asynchronous searching
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQuery = searchParams.get('search') || '';
      const trimmed = searchInput.trim();
      if (trimmed !== currentQuery) {
        const params = new URLSearchParams(searchParams);
        if (trimmed) {
          params.set('search', trimmed);
        } else {
          params.delete('search');
        }
        params.set('page', '1');
        setSearchParams(params);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('search', searchInput.trim());
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    const params = new URLSearchParams(searchParams);
    params.delete('search');
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

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
        return (
          <Badge variant="secondary" className="text-xs">
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to="/admin/dashboard"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <Badge
              variant="outline"
              className="border-primary/40 text-primary bg-primary/10 px-2 py-0.5 text-xs font-semibold"
            >
              <Building2 className="h-3.5 w-3.5 mr-1" />
              Parking Facilities
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Parking Facility Submissions
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-1 max-w-2xl">
            Review incoming parking facility survey records from owners. Inspect capacity breakdowns,
            operating rules, and reference photos before approving for administrative layout design.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSubmissions()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/admin/parking-lots">
              <Building2 className="h-4 w-4" />
              Official Lots
            </Link>
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/admin/owners">
              <User className="h-4 w-4" />
              Owner Accounts
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="gap-1.5 font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Logging out...' : 'Log Out'}
          </Button>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Submissions */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Facilities
            </span>
            <div className="text-2xl font-bold text-foreground">
              {stats.total}
            </div>
            <p className="text-[10px] text-muted-foreground">All onboarding records</p>
          </CardContent>
        </Card>

        {/* Submitted (Pending Review) */}
        <Card
          className={`border transition-all ${
            stats.submitted > 0
              ? 'border-sky-500/50 bg-sky-500/5 shadow-xs ring-1 ring-sky-500/20'
              : 'border-border/80 bg-card'
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                Submitted
              </span>
              {stats.submitted > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-ping" />
              )}
            </div>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {stats.submitted}
            </div>
            <p className="text-[10px] text-muted-foreground">Awaiting review start</p>
          </CardContent>
        </Card>

        {/* Under Review */}
        <Card
          className={`border transition-all ${
            stats.underReview > 0
              ? 'border-blue-500/50 bg-blue-500/5 shadow-xs ring-1 ring-blue-500/20'
              : 'border-border/80 bg-card'
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Under Review
            </span>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.underReview}
            </div>
            <p className="text-[10px] text-muted-foreground">In active inspection</p>
          </CardContent>
        </Card>

        {/* Changes Requested */}
        <Card
          className={`border transition-all ${
            stats.changesRequested > 0
              ? 'border-amber-500/50 bg-amber-500/5 shadow-xs ring-1 ring-amber-500/20'
              : 'border-border/80 bg-card'
          }`}
        >
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Action Req.
            </span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.changesRequested}
            </div>
            <p className="text-[10px] text-muted-foreground">Returned for edit</p>
          </CardContent>
        </Card>

        {/* Approved */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Approved
            </span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.approved}
            </div>
            <p className="text-[10px] text-muted-foreground">Survey verified</p>
          </CardContent>
        </Card>

        {/* Rejected */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider block">
              Rejected
            </span>
            <div className="text-2xl font-bold text-destructive">
              {stats.rejected}
            </div>
            <p className="text-[10px] text-muted-foreground">Declined facilities</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. SEARCH & TABS FILTER BAR */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status Tabs */}
          <Tabs value={currentStatus} onValueChange={handleTabChange} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-3 sm:flex flex-wrap h-auto p-1 bg-muted/60">
              <TabsTrigger value="All" className="text-xs">
                All ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="Submitted" className="text-xs">
                Submitted ({stats.submitted})
              </TabsTrigger>
              <TabsTrigger value="Under Review" className="text-xs">
                Under Review ({stats.underReview})
              </TabsTrigger>
              <TabsTrigger value="Changes Requested" className="text-xs">
                Changes ({stats.changesRequested})
              </TabsTrigger>
              <TabsTrigger value="Approved" className="text-xs">
                Approved ({stats.approved})
              </TabsTrigger>
              <TabsTrigger value="Rejected" className="text-xs">
                Rejected ({stats.rejected})
              </TabsTrigger>
              <TabsTrigger value="Draft" className="text-xs">
                Drafts ({stats.draft})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-sm w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search facility, ref, owner..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 text-xs h-9 bg-card"
              />
            </div>
            <Button type="submit" size="sm" className="h-9 text-xs">
              Search
            </Button>
            {currentSearch && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="h-9 text-xs"
              >
                Clear
              </Button>
            )}
          </form>
        </div>

        {/* 4. SUBMISSIONS LIST / TABLE */}
        {error ? (
          <Card className="border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
            <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadSubmissions()}>
              Try Again
            </Button>
          </Card>
        ) : loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4 border-border/80">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-80" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-9 w-28 shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <Card className="border-dashed border-border/80 p-12 text-center space-y-3 bg-muted/10">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-bold text-foreground">No Facility Submissions Found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {currentSearch || currentStatus !== 'All'
                ? 'No facility setup requests match your current filters. Try resetting the search or filter.'
                : 'There are currently no parking facility setup requests submitted by owners.'}
            </p>
            {(currentSearch || currentStatus !== 'All') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  setSearchParams(new URLSearchParams());
                }}
                className="text-xs"
              >
                Reset Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => {
              const ownerInfo = typeof sub.ownerId === 'object' && sub.ownerId ? sub.ownerId : null;
              return (
                <Card
                  key={sub._id}
                  className="border-border/80 bg-card hover:border-primary/40 transition-colors shadow-xs"
                >
                  <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Facility Info Column */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                          {sub.submissionReference}
                        </span>
                        {getStatusBadge(sub.submissionStatus)}
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          {sub.facilityType}
                        </Badge>
                      </div>

                      <h3 className="text-lg font-bold text-foreground truncate">
                        {sub.facilityName}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {ownerInfo && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <User className="h-3.5 w-3.5 text-primary" />
                            {ownerInfo.fullName} ({ownerInfo.email})
                          </span>
                        )}
                        <span>
                          {sub.location?.city ? `${sub.location.city}, ${sub.location.state}` : 'Location Set'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Car className="h-3.5 w-3.5 text-primary" />
                          <strong>{sub.capacity?.totalSlots || 0}</strong> Total Slots
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground/80 pt-1">
                        <span>
                          Submitted:{' '}
                          {sub.submittedAt
                            ? format(new Date(sub.submittedAt), 'MMM dd, yyyy HH:mm')
                            : 'Draft (Not Submitted)'}
                        </span>
                        {sub.reviewedAt && (
                          <span>
                            Reviewed: {format(new Date(sub.reviewedAt), 'MMM dd, yyyy')}
                          </span>
                        )}
                        {sub.photos && (
                          <span>{sub.photos.length} Photo{sub.photos.length === 1 ? '' : 's'}</span>
                        )}
                        {sub.parkingPlanPdf && (
                          <span className="text-primary font-medium">PDF Plan Attached</span>
                        )}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex items-center gap-2 lg:flex-col lg:items-end justify-between border-t lg:border-t-0 pt-3 lg:pt-0 border-border/40 shrink-0">
                      <Button asChild size="sm" className="gap-1.5 font-semibold">
                        <Link to={`/admin/facilities/${sub._id}`}>
                          <Eye className="h-4 w-4" />
                          Review Details
                        </Link>
                      </Button>
                      {sub.submissionStatus === 'Approved' ? (
                        sub.officialParkingLotId ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            Lot Created
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                            Ready for Conversion
                          </Badge>
                        )
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {sub.submissionStatus === 'Submitted'
                            ? 'Review Pending'
                            : sub.submissionStatus === 'Under Review'
                            ? 'In Review'
                            : sub.submissionStatus}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                <div>
                  Showing {submissions.length} of {totalCount} records (Page {currentPage} of{' '}
                  {totalPages})
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="text-xs h-8"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="text-xs h-8"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
