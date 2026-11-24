import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  History,
  Info,
  MapPin,
  MessageCircle,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  adminReviewsApi,
  type AdminReviewDetailData,
  type AdminReviewListItem,
  type AdminReviewOverview,
  type ReviewFilterOptions,
} from '@/api/adminReviews.api';
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
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export const AdminReviewsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // STATE: OVERVIEW & FILTERS
  // ---------------------------------------------------------------------------
  const [overview, setOverview] = useState<AdminReviewOverview>({
    totalReviews: 0,
    publishedReviews: 0,
    underReviewReviews: 0,
    hiddenReviews: 0,
    averageRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    recentActivity: [],
  });

  const [filterOptions, setFilterOptions] = useState<ReviewFilterOptions>({
    parkingLots: [],
    owners: [],
  });

  // Query state derived from searchParams or defaults
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [ratingFilter, setRatingFilter] = useState<string>(searchParams.get('rating') || 'ALL');
  const [parkingLotIdFilter, setParkingLotIdFilter] = useState<string>(
    searchParams.get('parkingLotId') || 'ALL',
  );
  const [ownerIdFilter, setOwnerIdFilter] = useState<string>(searchParams.get('ownerId') || 'ALL');
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState<string>(searchParams.get('dateTo') || '');

  // Pagination state
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [limit, setLimit] = useState<number>(Number(searchParams.get('limit')) || 10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Table Data & Loading state
  const [reviews, setReviews] = useState<AdminReviewListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setRefreshing] = useState<boolean>(false);

  // Modal inspection & action states
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedReview, setSelectedReview] = useState<AdminReviewDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Action Modals: Approve, Hide, Delete
  const [actionReview, setActionReview] = useState<AdminReviewListItem | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState<boolean>(false);
  const [approveReason, setApproveReason] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);

  const [hideModalOpen, setHideModalOpen] = useState<boolean>(false);
  const [hideReason, setHideReason] = useState<string>('');
  const [isHiding, setIsHiding] = useState<boolean>(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 350ms DEBOUNCED SEARCH
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync state to URL search parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
    if (ratingFilter && ratingFilter !== 'ALL') params.set('rating', ratingFilter);
    if (parkingLotIdFilter && parkingLotIdFilter !== 'ALL')
      params.set('parkingLotId', parkingLotIdFilter);
    if (ownerIdFilter && ownerIdFilter !== 'ALL') params.set('ownerId', ownerIdFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (page > 1) params.set('page', String(page));
    if (limit !== 10) params.set('limit', String(limit));
    setSearchParams(params, { replace: true });
  }, [
    debouncedSearch,
    statusFilter,
    ratingFilter,
    parkingLotIdFilter,
    ownerIdFilter,
    dateFrom,
    dateTo,
    page,
    limit,
    setSearchParams,
  ]);

  // ---------------------------------------------------------------------------
  // DATA FETCHING: OVERVIEW & FILTER OPTIONS
  // ---------------------------------------------------------------------------
  const fetchOverview = useCallback(async () => {
    try {
      const data = await adminReviewsApi.getOverview();
      setOverview(data);
    } catch (err: any) {
      console.error('Failed to load review overview metrics:', err);
    }
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const data = await adminReviewsApi.getFilterOptions();
      setFilterOptions(data);
    } catch (err: any) {
      console.error('Failed to load review filter options:', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // DATA FETCHING: REVIEW DIRECTORY
  // ---------------------------------------------------------------------------
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = {
        page,
        limit,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        rating: ratingFilter !== 'ALL' ? Number(ratingFilter) : undefined,
        parkingLotId: parkingLotIdFilter !== 'ALL' ? parkingLotIdFilter : undefined,
        ownerId: ownerIdFilter !== 'ALL' ? ownerIdFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };

      const res = await adminReviewsApi.getReviews(queryParams);
      setReviews(res.reviews);
      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      console.error('Failed to fetch reviews:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch reviews.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    statusFilter,
    ratingFilter,
    parkingLotIdFilter,
    ownerIdFilter,
    dateFrom,
    dateTo,
  ]);

  // Initial load
  useEffect(() => {
    fetchOverview();
    fetchFilterOptions();
  }, [fetchOverview, fetchFilterOptions]);

  // Trigger search on parameter change
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useLiveSync(() => {
    void fetchOverview();
    void fetchReviews();
  });

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setRatingFilter('ALL');
    setParkingLotIdFilter('ALL');
    setOwnerIdFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    debouncedSearch ||
      statusFilter !== 'ALL' ||
      ratingFilter !== 'ALL' ||
      parkingLotIdFilter !== 'ALL' ||
      ownerIdFilter !== 'ALL' ||
      dateFrom ||
      dateTo,
  );

  // ---------------------------------------------------------------------------
  // MODAL HANDLERS: VIEW DETAILS
  // ---------------------------------------------------------------------------
  const handleOpenDetailModal = async (reviewId: string) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const data = await adminReviewsApi.getReviewById(reviewId);
      setSelectedReview(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load review dossier.');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODAL HANDLERS: APPROVE REVIEW
  // ---------------------------------------------------------------------------
  const handleOpenApproveModal = (review: AdminReviewListItem) => {
    setActionReview(review);
    setApproveReason('');
    setApproveModalOpen(true);
  };

  const handleExecuteApprove = async () => {
    if (!actionReview) return;
    setIsApproving(true);
    try {
      const res = await adminReviewsApi.approveReview(
        actionReview._id,
        approveReason.trim() || undefined,
      );
      toast.success(res.message || 'Review approved and published successfully.');
      setApproveModalOpen(false);
      setActionReview(null);
      fetchReviews();
      fetchOverview();
      if (selectedReview && selectedReview._id === actionReview._id) {
        handleOpenDetailModal(actionReview._id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve review.');
    } finally {
      setIsApproving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODAL HANDLERS: HIDE REVIEW
  // ---------------------------------------------------------------------------
  const handleOpenHideModal = (review: AdminReviewListItem) => {
    setActionReview(review);
    setHideReason('');
    setHideModalOpen(true);
  };

  const handleExecuteHide = async () => {
    if (!actionReview) return;
    if (hideReason.trim().length < 5) {
      toast.error('A moderation reason of at least 5 characters is required.');
      return;
    }
    setIsHiding(true);
    try {
      const res = await adminReviewsApi.hideReview(actionReview._id, hideReason.trim());
      toast.success(res.message || 'Review hidden successfully.');
      setHideModalOpen(false);
      setActionReview(null);
      fetchReviews();
      fetchOverview();
      if (selectedReview && selectedReview._id === actionReview._id) {
        handleOpenDetailModal(actionReview._id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to hide review.');
    } finally {
      setIsHiding(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODAL HANDLERS: DELETE REVIEW (WITH HISTORICAL PROTECTION)
  // ---------------------------------------------------------------------------
  const handleOpenDeleteModal = (review: AdminReviewListItem) => {
    setActionReview(review);
    setDeleteReason('');
    setDeleteModalOpen(true);
  };

  const handleExecuteDelete = async () => {
    if (!actionReview) return;
    if (deleteReason.trim().length < 5) {
      toast.error('A deletion confirmation reason of at least 5 characters is required.');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await adminReviewsApi.deleteReview(actionReview._id, deleteReason.trim());
      toast.success(res.message || 'Review successfully deleted from the platform.');
      setDeleteModalOpen(false);
      setActionReview(null);
      if (detailModalOpen && selectedReview?._id === actionReview._id) {
        setDetailModalOpen(false);
      }
      fetchReviews();
      fetchOverview();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete review.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper for copying text
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard.`);
  };

  // Render Stars Component
  const renderStars = (rating: number, sizeClass = 'h-4 w-4') => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= Math.round(rating)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Published':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" />
            Published
          </Badge>
        );
      case 'Under Review':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20 gap-1 font-medium">
            <Clock className="h-3 w-3" />
            Under Review
          </Badge>
        );
      case 'Hidden':
        return (
          <Badge className="bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border-slate-500/20 gap-1 font-medium">
            <EyeOff className="h-3 w-3" />
            Hidden
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* --------------------------------------------------------------------- */}
      {/* 1. BREADCRUMBS & PAGE HEADER */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link to="/admin/dashboard" className="hover:text-primary transition-colors">
            Admin Dashboard
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>Governance & Quality</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Reviews & Moderation</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <MessageSquareQuote className="h-7 w-7 text-primary" />
              Customer Reviews & Moderation
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Monitor, evaluate, and moderate customer ratings, written reviews, and partner responses
              across all registered facilities while enforcing historical review protection.
            </p>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. OVERVIEW KPI CARDS */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Reviews */}
        <Card className="shadow-xs border border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Reviews</p>
              <p className="text-2xl font-bold text-foreground">
                {overview.totalReviews.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Platform-wide feedback</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquareQuote className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Published */}
        <Card className="shadow-xs border border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Published</p>
              <p className="text-2xl font-bold text-emerald-600">
                {overview.publishedReviews.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Publicly visible</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Under Review */}
        <Card className="shadow-xs border border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Under Review</p>
              <p className="text-2xl font-bold text-amber-600">
                {overview.underReviewReviews.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Requires moderation</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Hidden */}
        <Card className="shadow-xs border border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Hidden</p>
              <p className="text-2xl font-bold text-slate-600">
                {overview.hiddenReviews.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Unpublished / suppressed</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-600">
              <EyeOff className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Average Rating & Star Distribution */}
        <Card className="shadow-xs border border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Average Rating</p>
              <div className="flex items-center gap-1.5">
                <p className="text-2xl font-bold text-foreground">
                  {overview.averageRating ? overview.averageRating.toFixed(1) : '0.0'}
                </p>
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                5★:{overview.ratingDistribution?.[5] || 0} | 1★:{overview.ratingDistribution?.[1] || 0}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Star className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. SEARCH & FILTERS BAR */}
      {/* --------------------------------------------------------------------- */}
      <Card className="shadow-xs border border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Review ID, customer, lot name, owner, booking ref, or comment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick Status Select */}
            <div className="w-full lg:w-44">
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Rating Select */}
            <div className="w-full lg:w-36">
              <Select value={ratingFilter} onValueChange={(val) => { setRatingFilter(val); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Secondary Filters row */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 pt-1 border-t border-border/60">
            {/* Facility Selector */}
            <div className="w-full sm:w-56">
              <Select
                value={parkingLotIdFilter}
                onValueChange={(val) => { setParkingLotIdFilter(val); setPage(1); }}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Filter by Facility" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="ALL">All Facilities</SelectItem>
                  {filterOptions.parkingLots.map((lot) => (
                    <SelectItem key={lot._id} value={lot._id}>
                      {lot.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Owner Selector */}
            <div className="w-full sm:w-52">
              <Select
                value={ownerIdFilter}
                onValueChange={(val) => { setOwnerIdFilter(val); setPage(1); }}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Filter by Owner" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="ALL">All Owners</SelectItem>
                  {filterOptions.owners.map((owner) => (
                    <SelectItem key={owner._id} value={owner._id}>
                      {owner.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="w-full sm:w-36">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="text-xs h-9"
                title="Created Date From"
              />
            </div>

            {/* Date To */}
            <div className="w-full sm:w-36">
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="text-xs h-9"
                title="Created Date To"
              />
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-9 gap-1.5 ml-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* 4. REVIEWS DIRECTORY TABLE */}
      {/* --------------------------------------------------------------------- */}
      <Card className="shadow-xs border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                <th className="py-3 px-4">Review ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Parking Facility & Owner</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4 max-w-xs">Feedback & Reply</th>
                <th className="py-3 px-4">Booking Ref</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading reviews directory...
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <MessageSquareQuote className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No customer reviews found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasActiveFilters
                        ? 'Try adjusting your search query or active filter selections.'
                        : 'No reviews have been submitted on the platform yet.'}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="mt-3 gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear All Filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                reviews.map((rev) => (
                  <tr key={rev._id} className="hover:bg-muted/30 transition-colors">
                    {/* Review ID */}
                    <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {rev._id.slice(-8).toUpperCase()}
                        </span>
                        <button
                          onClick={() => copyToClipboard(rev._id, 'Review ID')}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy full Review ID"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                          {rev.customer?.fullName
                            ? rev.customer.fullName.charAt(0).toUpperCase()
                            : 'C'}
                        </div>
                        <div>
                          <p className="font-medium text-foreground leading-tight">
                            {rev.customer?.fullName || 'Anonymous Customer'}
                          </p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                            {rev.customer?.email || 'No email'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Facility & Owner */}
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-medium text-foreground leading-tight flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {rev.parkingLot?.parkingName || 'Unknown Lot'}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                          Owner: {rev.owner?.fullName || 'N/A'}
                        </p>
                      </div>
                    </td>

                    {/* Rating */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-foreground">
                            {rev.overallRating}.0
                          </span>
                        </div>
                        {renderStars(rev.overallRating)}
                      </div>
                    </td>

                    {/* Feedback & Reply */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-xs text-foreground line-clamp-2 italic">
                        "{rev.comment || 'No written comment'}"
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {rev.ownerReply && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary bg-primary/5">
                            Partner Replied
                          </Badge>
                        )}
                        {rev.isEdited && (
                          <span className="text-[10px] text-muted-foreground">(edited)</span>
                        )}
                      </div>
                    </td>

                    {/* Booking Ref */}
                    <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                      {rev.booking?.bookingReference ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="font-mono text-[11px]">
                            {rev.booking.bookingReference}
                          </Badge>
                          <button
                            onClick={() =>
                              copyToClipboard(rev.booking!.bookingReference, 'Booking Reference')
                            }
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy booking reference"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Direct / None</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(rev.moderationStatus)}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(rev.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Dossier */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleOpenDetailModal(rev._id)}
                          title="Inspect Review Dossier"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Approve Button (if not published) */}
                        {rev.moderationStatus !== 'Published' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            onClick={() => handleOpenApproveModal(rev)}
                            title="Approve & Publish Review"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Hide Button (if not hidden) */}
                        {rev.moderationStatus !== 'Hidden' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            onClick={() => handleOpenHideModal(rev)}
                            title="Hide Review from Public"
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Delete / Protection Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${
                            rev.ownerReply || rev.moderationStatus === 'Published'
                              ? 'text-muted-foreground/40 hover:text-muted-foreground'
                              : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                          }`}
                          onClick={() => handleOpenDeleteModal(rev)}
                          title={
                            rev.ownerReply
                              ? 'Protected: Review has partner reply. Use Hide instead.'
                              : rev.moderationStatus === 'Published'
                              ? 'Protected: Published review. Use Hide instead.'
                              : 'Permanently Delete Review'
                          }
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

        {/* Server-side Pagination Bar */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing {totalCount === 0 ? 0 : (page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, totalCount)} of {totalCount} reviews
            </span>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 text-xs rounded border border-border bg-background px-1.5 focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
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
              className="h-8 px-2.5 text-xs gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <span className="text-xs font-medium text-foreground px-2">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 px-2.5 text-xs gap-1"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* 5. MODAL: DETAILED REVIEW INSPECTION DOSSIER */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-primary" />
                Review Inspection Dossier
              </DialogTitle>
              {selectedReview && renderStatusBadge(selectedReview.moderationStatus)}
            </div>
            <DialogDescription className="text-xs">
              Complete review audit trail, customer verification, and partner dispute history.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !selectedReview ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading review details...
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              {/* Rating & Review Text Block */}
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderStars(selectedReview.overallRating, 'h-5 w-5')}
                    <span className="text-lg font-bold text-foreground">
                      {selectedReview.overallRating}.0 / 5.0
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Submitted on {new Date(selectedReview.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-foreground text-sm bg-background/80 p-3 rounded-md border border-border/60">
                  <p className="italic">
                    "{selectedReview.comment || 'No written commentary provided with this rating.'}"
                  </p>
                  {selectedReview.isEdited && (
                    <p className="text-[11px] text-muted-foreground mt-1 text-right">
                      (Customer edited this review)
                    </p>
                  )}
                </div>

                {selectedReview.moderationReason && (
                  <div className="flex items-start gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Current Moderation Note:</p>
                      <p>{selectedReview.moderationReason}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Associations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Information */}
                <div className="p-3.5 rounded-lg border border-border space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    <User className="h-3.5 w-3.5 text-primary" />
                    Customer Details
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {selectedReview.customer?.fullName || 'Anonymous Customer'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedReview.customer?.email || 'No email registered'}
                    </p>
                    {selectedReview.customer?.mobileNumber && (
                      <p className="text-xs text-muted-foreground">
                        Phone: {selectedReview.customer.mobileNumber}
                      </p>
                    )}
                  </div>
                </div>

                {/* Facility & Owner Information */}
                <div className="p-3.5 rounded-lg border border-border space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Facility & Owner
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {selectedReview.parkingLot?.parkingName || 'Unknown Parking Facility'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Owner: {selectedReview.owner?.fullName || 'N/A'} ({selectedReview.owner?.email || 'No email'})
                    </p>
                    {selectedReview.parkingLot?.city && (
                      <p className="text-xs text-muted-foreground">
                        Location: {selectedReview.parkingLot.city}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Booking Reference Block */}
              <div className="p-3.5 rounded-lg border border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Verified Customer Stay</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Booking: {selectedReview.booking?.bookingReference || 'N/A'}
                    </p>
                  </div>
                </div>
                {selectedReview.booking?.bookingStatus && (
                  <Badge variant="secondary" className="text-xs">
                    Status: {selectedReview.booking.bookingStatus}
                  </Badge>
                )}
              </div>

              {/* Owner Reply Block */}
              {selectedReview.ownerReply ? (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
                      <MessageCircle className="h-4 w-4" />
                      Parking Owner Official Response
                    </div>
                    {selectedReview.replyDate && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(selectedReview.replyDate).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground italic bg-background/80 p-2.5 rounded border border-border/40">
                    "{selectedReview.ownerReply}"
                  </p>
                  {selectedReview.replyEdited && (
                    <p className="text-[10px] text-muted-foreground text-right">(Partner edited response)</p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                  The facility owner has not submitted an official reply to this review yet.
                </div>
              )}

              {/* Moderation History Timeline */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  <History className="h-3.5 w-3.5 text-primary" />
                  Chronological Moderation Audit Trail
                </div>

                {selectedReview.moderationHistory && selectedReview.moderationHistory.length > 0 ? (
                  <div className="space-y-2.5 pl-3 border-l-2 border-primary/30">
                    {selectedReview.moderationHistory.map((hist, idx) => (
                      <div key={idx} className="relative text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {hist.action}:
                          </span>
                          <span className="text-muted-foreground">
                            {hist.previousStatus} <ArrowRight className="inline h-2.5 w-2.5" />{' '}
                            <span className="font-medium text-foreground">{hist.newStatus}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(hist.moderatedAt).toLocaleString()}
                          </span>
                        </div>
                        {hist.reason && (
                          <p className="text-muted-foreground italic pl-2 border-l border-border text-[11px]">
                            Remarks: "{hist.reason}"
                          </p>
                        )}
                        {hist.moderatedBy && (
                          <p className="text-[10px] text-muted-foreground">
                            Moderator: {hist.moderatedBy.fullName} ({hist.moderatedBy.email})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No prior moderation actions logged on this review.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            {selectedReview && (
              <div className="flex items-center gap-2 mr-auto">
                {selectedReview.moderationStatus !== 'Published' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5"
                    onClick={() => handleOpenApproveModal(selectedReview)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                )}
                {selectedReview.moderationStatus !== 'Hidden' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 gap-1.5"
                    onClick={() => handleOpenHideModal(selectedReview)}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  onClick={() => handleOpenDeleteModal(selectedReview)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={() => setDetailModalOpen(false)}>
              Close Dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* 6. MODAL: APPROVE REVIEW */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              Approve & Publish Review
            </DialogTitle>
            <DialogDescription className="text-xs">
              This review will be published immediately to public parking search pages and facility
              showcases.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {actionReview && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
                <p className="font-semibold text-foreground">
                  Review #{actionReview._id.slice(-8).toUpperCase()}
                </p>
                <p className="text-muted-foreground italic">"{actionReview.comment || 'No text'}"</p>
                <div className="flex items-center gap-1 pt-1">
                  {renderStars(actionReview.overallRating, 'h-3.5 w-3.5')}
                  <span className="font-bold text-foreground ml-1">
                    {actionReview.overallRating} stars
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Optional Approval Remarks / Notes:
              </label>
              <Textarea
                placeholder="Optional notes regarding why this review was approved..."
                value={approveReason}
                onChange={(e) => setApproveReason(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApproveModalOpen(false)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleExecuteApprove}
              disabled={isApproving}
            >
              {isApproving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm & Publish
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* 7. MODAL: HIDE REVIEW */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={hideModalOpen} onOpenChange={setHideModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 font-bold">
              <EyeOff className="h-5 w-5" />
              Hide Review from Public Visibility
            </DialogTitle>
            <DialogDescription className="text-xs">
              Hiding immediately suppresses this review from public listings without altering the
              underlying booking or financial record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {actionReview && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1.5">
                <p className="font-semibold text-foreground">
                  Review #{actionReview._id.slice(-8).toUpperCase()}
                </p>
                <p className="text-muted-foreground italic">"{actionReview.comment || 'No text'}"</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Mandatory Moderation Reason *</span>
                <span className="text-[10px] text-muted-foreground">Minimum 5 characters</span>
              </label>
              <Textarea
                placeholder="Specify policy violation (e.g., offensive language, commercial advertisement, competitor spam, defamatory content)..."
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded bg-muted text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span>
                The reason will be permanently recorded in the moderation history and audit log.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideModalOpen(false)}
              disabled={isHiding}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={handleExecuteHide}
              disabled={isHiding || hideReason.trim().length < 5}
            >
              {isHiding ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Hiding...
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Confirm & Hide Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------------------------- */}
      {/* 8. MODAL: DELETE REVIEW (HISTORICAL PROTECTION ARCHITECTURE) */}
      {/* --------------------------------------------------------------------- */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <Trash2 className="h-5 w-5" />
              Permanent Review Deletion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enforcing ParkEase Historical Review Protection & Partner Integrity Policy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {actionReview?.ownerReply ? (
              // Blocked due to Owner Reply
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-xs space-y-3">
                <div className="flex items-start gap-2 text-destructive font-semibold">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm">Deletion Blocked by Platform Governance</p>
                    <p className="font-normal text-muted-foreground mt-1">
                      This review contains an official <strong>Partner Response</strong>. To protect
                      partner transparency and dispute records, permanent deletion is strictly prohibited.
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-destructive/20 text-foreground">
                  <p className="font-medium">Recommended Action:</p>
                  <p className="text-muted-foreground">
                    Use <strong>Hide Review</strong> instead to immediately remove both the review and
                    reply from public view while preserving audit integrity.
                  </p>
                </div>
              </div>
            ) : actionReview?.moderationStatus === 'Published' ? (
              // Blocked due to Published Status
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 font-semibold">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm">Historical Review Protection Active</p>
                    <p className="font-normal text-muted-foreground mt-1">
                      This review is currently in <strong>Published</strong> status and represents
                      a verified customer stay. Published reviews cannot be purged directly.
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-amber-500/20 text-foreground">
                  <p className="font-medium">Governance Policy:</p>
                  <p className="text-muted-foreground">
                    Please transition this review to <strong>Hidden</strong> status with a mandatory
                    moderation reason first.
                  </p>
                </div>
              </div>
            ) : (
              // Permitted Deletion Flow for Hidden, Un-replied Reviews
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Warning: This action permanently removes this review record from the platform
                    database. A complete snapshot will be preserved in the audit log.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Mandatory Deletion Confirmation Reason *</span>
                    <span className="text-[10px] text-muted-foreground">Minimum 5 characters</span>
                  </label>
                  <Textarea
                    placeholder="Specify justification for permanent database deletion (e.g., confirmed duplicate testing record, formal legal takedown notice)..."
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>

            {actionReview?.ownerReply || actionReview?.moderationStatus === 'Published' ? (
              <Button
                variant="default"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                onClick={() => {
                  setDeleteModalOpen(false);
                  if (actionReview) handleOpenHideModal(actionReview);
                }}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Proceed to Hide Instead
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleExecuteDelete}
                disabled={isDeleting || deleteReason.trim().length < 5}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviewsPage;
