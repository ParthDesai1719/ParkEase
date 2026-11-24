import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Layers,
  Search,
  ChevronRight,
  ShieldAlert,
  Eye,
  MapPin,
  Car,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getOfficialParkingLots,
  type OfficialParkingLot,
} from '@/api/parkingLot.api';
import { useLiveSync } from '@/hooks/useLiveSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const OfficialParkingLotsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [parkingLots, setParkingLots] = useState<OfficialParkingLot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Pagination States
  const currentStatus = searchParams.get('status') || 'All';
  const currentSearch = searchParams.get('search') || '';
  const currentOwnerId = searchParams.get('ownerId') || '';
  const currentPage = Number(searchParams.get('page')) || 1;
  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const loadParkingLots = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
        setError(null);
      }

      const res = await getOfficialParkingLots({
        status: currentStatus !== 'All' ? currentStatus : undefined,
        search: currentSearch || undefined,
        ownerId: currentOwnerId || undefined,
        page: currentPage,
        limit: 10,
      });

      if (res.success && res.data) {
        setParkingLots(res.data.parkingLots);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.total);
      } else if (!isSilent) {
        setError(res.message || 'Failed to retrieve official parking lots.');
      }
    } catch (err: unknown) {
      if (!isSilent) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to connect to the server. Please check your network.',
        );
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [currentStatus, currentSearch, currentOwnerId, currentPage]);

  useEffect(() => {
    void loadParkingLots();
  }, [loadParkingLots]);

  useLiveSync(() => {
    void loadParkingLots(true);
  });

  const handleTabChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === 'All') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', value);
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

  const handleClearSearch = () => {
    setSearchInput('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', newPage.toString());
    setSearchParams(nextParams);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Inactive':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs font-semibold">
            Inactive (Staging)
          </Badge>
        );
      case 'Active':
        return (
          <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-xs font-semibold">
            Active
          </Badge>
        );
      case 'Under Maintenance':
        return (
          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs font-semibold">
            Under Maintenance
          </Badge>
        );
      case 'Closed':
        return (
          <Badge variant="destructive" className="text-xs font-semibold">
            Closed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  // Metrics calculation
  const totalCapacitySum = parkingLots.reduce((acc, lot) => acc + (lot.totalCapacity || 0), 0);
  const inactiveLotsCount = parkingLots.filter((lot) => lot.parkingStatus === 'Inactive').length;
  const activeLotsCount = parkingLots.filter((lot) => lot.parkingStatus === 'Active').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Link to="/admin/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <span className="font-semibold text-foreground">Official Parking Lots</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Official Parking Lots &amp; Structures
            </h1>
            <Badge variant="outline" className="text-xs">
              Phase 2: Lot &amp; Structure Creation
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
            Official ParkEase parking lots, floor hierarchies, zone allocations, and parking slot inventories generated from approved facility submissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button size="sm" asChild className="gap-1.5 font-semibold">
            <Link to="/admin/facilities?status=Approved">
              <Sparkles className="h-4 w-4" />
              Approved Submissions Ready
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Lots */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Official Lots
            </span>
            <div className="text-2xl font-extrabold text-foreground">{totalCount}</div>
            <p className="text-[10px] text-muted-foreground">Platform-managed lots</p>
          </CardContent>
        </Card>

        {/* Total Capacity */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Current Page Capacity
            </span>
            <div className="text-2xl font-extrabold text-primary">{totalCapacitySum}</div>
            <p className="text-[10px] text-muted-foreground">Total slots across listed lots</p>
          </CardContent>
        </Card>

        {/* Inactive Lots */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Inactive (Staging)
            </span>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {inactiveLotsCount}
            </div>
            <p className="text-[10px] text-muted-foreground">Structure ready; pre-activation</p>
          </CardContent>
        </Card>

        {/* Active Lots */}
        <Card className="border-border/80 bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Active Lots
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {activeLotsCount}
            </div>
            <p className="text-[10px] text-muted-foreground">Published &amp; operational</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. SEARCH & TABS FILTER BAR */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status Tabs */}
          <Tabs value={currentStatus} onValueChange={handleTabChange} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-2 sm:flex flex-wrap h-auto p-1 bg-muted/60">
              <TabsTrigger value="All" className="text-xs">
                All Lots ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="Inactive" className="text-xs">
                Inactive (Staging)
              </TabsTrigger>
              <TabsTrigger value="Active" className="text-xs">
                Active
              </TabsTrigger>
              <TabsTrigger value="Under Maintenance" className="text-xs">
                Maintenance
              </TabsTrigger>
              <TabsTrigger value="Closed" className="text-xs">
                Closed
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-sm w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search lot name, city, state..."
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

        {/* 4. PARKING LOTS LIST */}
        {error ? (
          <Card className="border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
            <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-destructive">Failed to Load Parking Lots</h3>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void loadParkingLots()}>
              Try Again
            </Button>
          </Card>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((idx) => (
              <Card key={idx} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-4 w-72" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </Card>
            ))}
          </div>
        ) : parkingLots.length === 0 ? (
          <Card className="border-border/80 bg-card p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-semibold text-foreground">
                {currentSearch || currentStatus !== 'All'
                  ? 'No matching parking lots found'
                  : 'No Official Parking Lots Created Yet'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentSearch || currentStatus !== 'All'
                  ? 'Try clearing or modifying your filter and search criteria.'
                  : 'Official Parking Lots are generated by Administrators from approved Owner Facility Submissions. Review approved facility submissions to create official structures.'}
              </p>
            </div>
            {currentSearch || currentStatus !== 'All' ? (
              <Button size="sm" variant="outline" onClick={handleClearSearch} className="text-xs">
                Clear Filters
              </Button>
            ) : (
              <Button size="sm" asChild className="gap-1.5 font-semibold text-xs">
                <Link to="/admin/facilities?status=Approved">
                  <Sparkles className="h-4 w-4" />
                  View Approved Submissions Ready for Conversion
                </Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {parkingLots.map((lot) => {
              const ownerInfo = typeof lot.ownerId === 'object' && lot.ownerId ? lot.ownerId : null;
              const submissionInfo =
                typeof lot.submissionId === 'object' && lot.submissionId ? lot.submissionId : null;

              return (
                <Card
                  key={lot._id}
                  className="border-border/80 bg-card hover:border-primary/40 transition-all duration-200 shadow-xs"
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {lot.parkingType}
                        </span>
                        {getStatusBadge(lot.parkingStatus)}
                        {lot.layoutReviewStatus === 'Owner Changes Requested' && (
                          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-semibold gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Owner Changes Requested
                          </Badge>
                        )}
                        {lot.layoutReviewStatus === 'Pending Owner Review' && (
                          <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 text-[11px] font-semibold gap-1">
                            <Clock className="h-3 w-3" />
                            Awaiting Owner Review
                          </Badge>
                        )}
                        {lot.layoutReviewStatus === 'Owner Confirmed' && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Owner Approved Layout
                          </Badge>
                        )}
                        {submissionInfo && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Ref: {submissionInfo.submissionReference}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-foreground truncate">
                        {lot.parkingName}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          {typeof lot.address === 'object' && lot.address !== null
                            ? [lot.address.street, lot.address.city, lot.address.state, lot.address.postalCode].filter(Boolean).join(', ')
                            : (lot.address ? [lot.address, lot.city, lot.state].filter(Boolean).join(', ') : 'Address Specified')}
                        </span>
                        {ownerInfo && (
                          <span className="font-medium text-foreground">
                            Owner: {ownerInfo.fullName} ({ownerInfo.email})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                          {lot.totalFloors} Floor{lot.totalFloors === 1 ? '' : 's'}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Car className="h-3.5 w-3.5 text-primary shrink-0" />
                          {lot.totalCapacity ?? lot.totalSlots ?? 0} Total Slots
                        </span>
                        <span className="text-muted-foreground">
                          Pricing: {lot.pricingModel} (₹{lot.hourlyRate}/hr)
                        </span>
                        <span className="text-muted-foreground">
                          Created:{' '}
                          {lot.createdAt ? format(new Date(lot.createdAt), 'MMM dd, yyyy') : '—'}
                        </span>
                      </div>

                      {lot.layoutReviewStatus === 'Owner Changes Requested' && lot.layoutReviewNotes && (
                        <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-rose-700 dark:text-rose-300">
                                Revision Requested by Owner{lot.layoutReviewFloorName ? ` for ${lot.layoutReviewFloorName}` : ''}:
                              </span>{' '}
                              <span className="italic font-medium">"{lot.layoutReviewNotes}"</span>
                            </div>
                          </div>
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 gap-1 shrink-0">
                            <Link to={`/admin/parking-lots/${lot._id}/layout${lot.layoutReviewFloorId ? `?floorId=${lot.layoutReviewFloorId}` : ''}`}>
                              <Layers className="h-3 w-3" />
                              Revise in 2D Designer
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Actions Column */}
                    <div className="flex items-center gap-2 lg:flex-col lg:items-end justify-between border-t lg:border-t-0 pt-3 lg:pt-0 border-border/40 shrink-0">
                      <Button asChild size="sm" className="gap-1.5 font-semibold">
                        <Link to={`/admin/parking-lots/${lot._id}`}>
                          <Layers className="h-4 w-4" />
                          View Structure &amp; Hierarchy
                        </Link>
                      </Button>
                      {submissionInfo && (
                        <Button asChild variant="outline" size="sm" className="gap-1 text-xs text-muted-foreground">
                          <Link to={`/admin/facilities/${submissionInfo._id}`}>
                            <Eye className="h-3.5 w-3.5" />
                            Source Submission
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <span className="text-xs text-muted-foreground">
                  Showing Page {currentPage} of {totalPages} ({totalCount} lots total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className="text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className="text-xs"
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
