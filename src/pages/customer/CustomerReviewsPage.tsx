import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Star,
  MessageSquareQuote,
  Building2,
  CalendarCheck,
  Edit2,
  Trash2,
  PlusCircle,
  ExternalLink,
  CornerDownRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  getCustomerReviews,
  getEligibleBookingsForReview,
  deleteCustomerReview,
  type CustomerSubmittedReviewItem,
  type EligibleReviewBookingItem,
} from '@/api/customerParking.api';
import { CustomerReviewModal } from '@/components/customer/CustomerReviewModal';
import { useLiveSync } from '@/hooks/useLiveSync';

export const CustomerReviewsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const targetBookingIdParam = searchParams.get('bookingId');

  const [reviews, setReviews] = useState<CustomerSubmittedReviewItem[]>([]);
  const [eligibleBookings, setEligibleBookings] = useState<EligibleReviewBookingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | 'ALL'>('ALL');

  // Modal states
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedTargetBooking, setSelectedTargetBooking] = useState<EligibleReviewBookingItem | null>(null);
  const [editingReview, setEditingReview] = useState<CustomerSubmittedReviewItem | null>(null);

  // Delete confirmation dialog state
  const [deletingReview, setDeletingReview] = useState<CustomerSubmittedReviewItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load data
  const loadReviewsData = async (isSilent = false) => {
    try {
      if (!isSilent) {
        setIsLoading(true);
        setError(null);
      }
      const [reviewsData, eligibleData] = await Promise.all([
        getCustomerReviews(),
        getEligibleBookingsForReview(),
      ]);
      setReviews(reviewsData || []);
      setEligibleBookings(eligibleData || []);

      // If bookingId query parameter is provided from completion email, auto-open review modal
      if (!isSilent && targetBookingIdParam && eligibleData?.length) {
        const found = eligibleData.find((b) => b.bookingId === targetBookingIdParam);
        if (found) {
          setSelectedTargetBooking(found);
          setEditingReview(null);
          setIsReviewModalOpen(true);
        }
      }
    } catch (err: any) {
      if (!isSilent) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to load reviews.';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadReviewsData();
  }, []);

  useLiveSync(() => {
    void loadReviewsData(true);
  });

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    if (selectedRatingFilter === 'ALL') {
      return reviews;
    }
    return reviews.filter((r) => r.overallRating === selectedRatingFilter);
  }, [reviews, selectedRatingFilter]);

  // Derived metrics
  const totalReviewsCount = reviews.length;
  const averageRatingGiven =
    totalReviewsCount > 0
      ? (reviews.reduce((sum, r) => sum + r.overallRating, 0) / totalReviewsCount).toFixed(1)
      : '0.0';
  const fiveStarReviewsCount = reviews.filter((r) => r.overallRating === 5).length;
  const awaitingReviewCount = eligibleBookings.length;

  const handleOpenNewReview = (bookingItem?: EligibleReviewBookingItem) => {
    setEditingReview(null);
    setSelectedTargetBooking(bookingItem || null);
    setIsReviewModalOpen(true);
  };

  const handleOpenEditReview = (review: CustomerSubmittedReviewItem) => {
    setSelectedTargetBooking(null);
    setEditingReview(review);
    setIsReviewModalOpen(true);
  };

  const handleDeleteReview = async () => {
    if (!deletingReview) return;
    try {
      setIsDeleting(true);
      await deleteCustomerReview(deletingReview._id);
      toast.success('Review has been deleted and parking facility stats updated.');
      setDeletingReview(null);
      loadReviewsData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete review.';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Container with standard max-w for dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                My Reviews & Ratings
              </h1>
              <Badge variant="outline" className="text-xs font-mono font-medium">
                PAGE 11
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Review your completed parking experiences, manage feedback, and view operator replies.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => handleOpenNewReview()}
              disabled={awaitingReviewCount === 0}
              className="gap-2 text-xs font-semibold shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Write a Review</span>
              {awaitingReviewCount > 0 && (
                <Badge className="bg-primary-foreground text-primary text-[10px] h-4 px-1.5 ml-0.5">
                  {awaitingReviewCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">Reviews Submitted</span>
              <MessageSquareQuote className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? <Skeleton className="h-7 w-12" /> : totalReviewsCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Total feedback recorded</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">Average Rating</span>
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tracking-tight text-foreground flex items-baseline gap-1">
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <>
                    <span>{averageRatingGiven}</span>
                    <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Across all visited facilities</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">5-Star Ratings</span>
              <Sparkles className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? <Skeleton className="h-7 w-12" /> : fiveStarReviewsCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Exceptional experiences</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 backdrop-blur-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-medium text-muted-foreground">Awaiting Review</span>
              <CalendarCheck className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {isLoading ? <Skeleton className="h-7 w-12" /> : awaitingReviewCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Eligible completed visits</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Callout Banner for Completed Bookings Ready for Review */}
        {!isLoading && eligibleBookings.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl border border-sky-500/30 bg-sky-500/10 dark:bg-sky-500/5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Star className="w-5 h-5 fill-sky-500 text-sky-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    You have {eligibleBookings.length} completed parking{' '}
                    {eligibleBookings.length === 1 ? 'visit' : 'visits'} ready for review!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share your experience for your recent stay at{' '}
                    <span className="font-semibold text-foreground">
                      {eligibleBookings[0].parkingName}
                    </span>{' '}
                    (Bay {eligibleBookings[0].slotNumber}).
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => handleOpenNewReview(eligibleBookings[0])}
                className="text-xs font-semibold shrink-0 gap-1.5 self-start sm:self-auto"
              >
                <span>Review Now</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            <Button
              variant={selectedRatingFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRatingFilter('ALL')}
              className="text-xs h-8 px-3 rounded-xl"
            >
              All ({totalReviewsCount})
            </Button>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = reviews.filter((r) => r.overallRating === stars).length;
              return (
                <Button
                  key={stars}
                  variant={selectedRatingFilter === stars ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRatingFilter(stars)}
                  className="text-xs h-8 px-2.5 rounded-xl gap-1"
                >
                  <span>{stars}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-[10px] opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>

          <span className="text-xs text-muted-foreground">
            Showing {filteredReviews.length} of {totalReviewsCount} reviews
          </span>
        </div>

        {/* Reviews List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-2xl border-border/70 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="space-y-1.5">
                      <Skeleton className="w-48 h-4" />
                      <Skeleton className="w-32 h-3" />
                    </div>
                  </div>
                  <Skeleton className="w-24 h-6 rounded-full" />
                </div>
                <Skeleton className="w-full h-12" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center rounded-2xl border border-destructive/30 bg-destructive/5 space-y-3">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadReviewsData()} className="text-xs">
              Try Again
            </Button>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-border/70 bg-card/40 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <MessageSquareQuote className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-foreground">
                {selectedRatingFilter !== 'ALL'
                  ? `No ${selectedRatingFilter}-Star Reviews Found`
                  : 'No Reviews Submitted Yet'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedRatingFilter !== 'ALL'
                  ? `You haven't submitted any reviews with a ${selectedRatingFilter}-star rating.`
                  : 'You can submit feedback for any completed parking visit to share your experience with parking operators and fellow motorists.'}
              </p>
            </div>
            {awaitingReviewCount > 0 ? (
              <Button
                onClick={() => handleOpenNewReview()}
                size="sm"
                className="text-xs font-semibold gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Review Completed Parking ({awaitingReviewCount} Available)</span>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="text-xs">
                <Link to="/customer/bookings">View My Bookings</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <Card
                key={review._id}
                className="rounded-2xl border-border/70 shadow-xs hover:border-border transition-all overflow-hidden"
              >
                <CardContent className="p-5 sm:p-6 space-y-4">
                  {/* Top Bar: Facility Info & Moderation Status */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/customer/parking/${review.parkingLotId}`}
                            className="font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                          >
                            <span>{review.parkingName}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          </Link>
                          {review.isEdited && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">
                              Edited
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {review.parkingAddress}, {review.parkingCity}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                      {/* Booking link badge */}
                      <Link to={`/customer/booking/${review.bookingId}`}>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-mono hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          Ref: {review.bookingReference}
                        </Badge>
                      </Link>

                      {/* Moderation Status */}
                      {review.moderationStatus === 'Published' && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Published
                        </Badge>
                      )}
                      {review.moderationStatus === 'Under Review' && (
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px]">
                          <Clock className="w-3 h-3 mr-1" />
                          Under Review
                        </Badge>
                      )}
                      {review.moderationStatus === 'Hidden' && (
                        <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px]">
                          Hidden by Moderator
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Rating Stars and Date */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((starVal) => (
                          <Star
                            key={starVal}
                            className={`w-4 h-4 ${
                              starVal <= review.overallRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {review.overallRating}.0
                      </span>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      Submitted on {formatDate(review.createdAt)}
                    </span>
                  </div>

                  {/* Written Feedback Comment */}
                  {review.comment ? (
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/20 p-3.5 rounded-xl border border-border/40">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No written feedback comment provided.
                    </p>
                  )}

                  {/* Owner Reply Inset Card if present */}
                  {review.ownerReply && (
                    <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5 ml-3 sm:ml-6">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-primary">
                          <CornerDownRight className="w-3.5 h-3.5" />
                          <span>Response from Parking Operator</span>
                        </div>
                        {review.replyDate && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(review.replyDate)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/90 pl-5 leading-relaxed">
                        {review.ownerReply}
                      </p>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditReview(review)}
                      className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingReview(review)}
                      className="text-xs h-8 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review Create/Edit Modal */}
      <CustomerReviewModal
        open={isReviewModalOpen}
        onOpenChange={setIsReviewModalOpen}
        booking={selectedTargetBooking}
        eligibleBookings={eligibleBookings}
        editingReview={editingReview}
        onSuccess={loadReviewsData}
      />

      {/* Delete Review Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingReview)}
        onOpenChange={(open) => !open && setDeletingReview(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Delete Your Review?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete your review for{' '}
              <span className="font-semibold text-foreground">
                {deletingReview?.parkingName}
              </span>
              ? This action will immediately remove your feedback and update the parking facility's
              average rating.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingReview(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteReview}
              disabled={isDeleting}
              className="text-xs font-semibold"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
