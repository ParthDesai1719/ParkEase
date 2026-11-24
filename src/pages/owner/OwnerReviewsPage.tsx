import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  MessageSquareQuote,
  Reply,
  Edit3,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
  Send,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  getOwnerReviews,
  submitOwnerReviewReply,
  type OwnerReviewItem,
  type OwnerReviewsQueryParams,
} from '@/api/ownerReviews.api';
import { cn } from '@/lib/utils';
import { useLiveSync } from '@/hooks/useLiveSync';

export const OwnerReviewsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters state
  const [selectedLotId, setSelectedLotId] = useState<string>('all');
  const [starRating, setStarRating] = useState<string>('all');
  const [replyStatus, setReplyStatus] = useState<'all' | 'awaiting' | 'replied'>('all');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Dialog State for Reply
  const [replyModalOpen, setReplyModalOpen] = useState<boolean>(false);
  const [activeReview, setActiveReview] = useState<OwnerReviewItem | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const MAX_REPLY_CHARS = 1000;

  // Query Params
  const queryParams: OwnerReviewsQueryParams = {
    parkingLotId: selectedLotId !== 'all' ? selectedLotId : undefined,
    starRating: starRating !== 'all' ? starRating : undefined,
    replyStatus: replyStatus,
    search: debouncedSearch || undefined,
    page,
    limit,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['owner-reviews', queryParams],
    queryFn: () => getOwnerReviews(queryParams),
  });

  useLiveSync(() => {
    void queryClient.invalidateQueries({ queryKey: ['owner-reviews'] });
  });

  const reviews = data?.reviews || [];
  const summary = data?.summary || {
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    awaitingReplyCount: 0,
    repliedCount: 0,
  };
  const ownerLots = data?.ownerLots || [];
  const totalPages = data?.totalPages || 1;

  // Mutation for submitting reply
  const replyMutation = useMutation({
    mutationFn: ({ reviewId, text }: { reviewId: string; text: string }) =>
      submitOwnerReviewReply(reviewId, text),
    onSuccess: (res) => {
      toast.success(res.message || 'Owner reply saved and customer notified successfully.');
      void queryClient.invalidateQueries({ queryKey: ['owner-reviews'] });
      setReplyModalOpen(false);
      setActiveReview(null);
      setReplyText('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to submit response.';
      toast.error(msg);
    },
  });

  const handleOpenReplyDialog = (review: OwnerReviewItem) => {
    setActiveReview(review);
    setReplyText(review.ownerReply || '');
    setReplyModalOpen(true);
  };

  const handleSubmitReply = () => {
    if (!activeReview) return;
    const trimmed = replyText.trim();
    if (!trimmed) {
      toast.error('Reply text cannot be empty.');
      return;
    }
    if (trimmed.length > MAX_REPLY_CHARS) {
      toast.error(`Reply cannot exceed ${MAX_REPLY_CHARS} characters.`);
      return;
    }
    replyMutation.mutate({ reviewId: activeReview._id, text: trimmed });
  };

  // Star display helper
  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const starClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              starClass,
              star <= rating
                ? 'fill-amber-400 text-amber-400 drop-shadow-2xs'
                : 'fill-muted text-muted-foreground/30',
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-in fade-in-50 duration-300 pb-16">
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 font-bold text-xs">
              Customer Feedback &amp; Reputation
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs font-bold">
              {summary.totalReviews} Total Verified Reviews
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <MessageSquareQuote className="h-7 w-7 text-primary" />
            Reviews &amp; Ratings
          </h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            Monitor customer satisfaction, review verified parking experiences, and publish authoritative owner replies.
          </p>
        </div>
      </div>

      {/* 2. KPI CARDS & RATING DISTRIBUTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left: Overall Score Card */}
        <Card className="lg:col-span-4 rounded-xl border border-border/80 bg-card p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Overall Satisfaction Score
              </span>
              <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500">
                <Star className="w-4 h-4 fill-amber-500" />
              </div>
            </div>

            <div className="flex items-baseline gap-3 my-3">
              <span className="text-5xl font-black text-foreground tracking-tight">
                {summary.averageRating.toFixed(1)}
              </span>
              <span className="text-muted-foreground font-bold text-lg">/ 5.0</span>
            </div>

            <div className="mb-4">{renderStars(Math.round(summary.averageRating), 'md')}</div>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border/70 pt-3 font-medium">
            Based on <span className="font-extrabold text-foreground">{summary.totalReviews}</span> verified
            checkout ratings across your facilities.
          </p>
        </Card>

        {/* Center: Star Distribution Bars */}
        <Card className="lg:col-span-5 rounded-xl border border-border/80 bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Rating Breakdown
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">Volume &amp; %</span>
          </div>

          <div className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.ratingDistribution[stars] || 0;
              const percentage =
                summary.totalReviews > 0 ? Math.round((count / summary.totalReviews) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-14 font-bold text-foreground">
                    <span>{stars}</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        stars >= 4
                          ? 'bg-amber-400 dark:bg-amber-500'
                          : stars === 3
                            ? 'bg-amber-300 dark:bg-amber-400'
                            : 'bg-rose-500',
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono font-bold text-foreground text-[11px]">
                    {count} ({percentage}%)
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right: Response Status Counters */}
        <Card className="md:col-span-2 lg:col-span-3 rounded-xl border border-border/80 bg-card p-5 shadow-2xs flex flex-col justify-between gap-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
            Reply Status Metrics
          </span>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* Awaiting Reply */}
            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between shadow-2xs">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                  Awaiting Reply
                </p>
                <p className="text-2xl font-black text-foreground mt-0.5">
                  {summary.awaitingReplyCount}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Replied */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between shadow-2xs">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Replied
                </p>
                <p className="text-2xl font-black text-foreground mt-0.5">
                  {summary.repliedCount}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. MULTI-PARAMETER FILTER & SEARCH BAR */}
      <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by customer name, review keyword, booking ref..."
              className="pl-9 h-9 text-xs font-medium border-border bg-background shadow-2xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Facility Filter */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <select
              value={selectedLotId}
              onChange={(e) => {
                setSelectedLotId(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-border bg-background px-3 py-1 text-xs font-bold text-foreground shadow-2xs focus:border-primary focus:outline-none"
            >
              <option value="all">All Parking Facilities ({ownerLots.length})</option>
              {ownerLots.map((lot) => (
                <option key={lot._id} value={lot._id}>
                  {lot.parkingName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub Filters: Reply Status & Star Rating Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/70">
          {/* Reply Status Chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-muted-foreground mr-1">Status:</span>
            {(
              [
                { id: 'all', label: 'All Reviews' },
                { id: 'awaiting', label: `Awaiting Reply (${summary.awaitingReplyCount})` },
                { id: 'replied', label: `Replied (${summary.repliedCount})` },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                onClick={() => {
                  setReplyStatus(chip.id);
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer shadow-2xs',
                  replyStatus === chip.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted/70',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Star Rating Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-muted-foreground mr-1">Rating:</span>
            {[
              { id: 'all', label: 'All' },
              { id: '5', label: '5 ★' },
              { id: '4', label: '4 ★' },
              { id: '3', label: '3 ★' },
              { id: '2', label: '2 ★' },
              { id: '1', label: '1 ★' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => {
                  setStarRating(chip.id);
                  setPage(1);
                }}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer shadow-2xs',
                  starRating === chip.id
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-card text-foreground border-border hover:bg-muted/70',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 4. REVIEWS LIST */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <Card className="rounded-xl border border-border/80 bg-card p-12 text-center shadow-2xs">
            <MessageSquareQuote className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground">No Customer Reviews Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 font-medium">
              There are no reviews matching your search and filter criteria.
            </p>
            {(search || selectedLotId !== 'all' || starRating !== 'all' || replyStatus !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedLotId('all');
                  setStarRating('all');
                  setReplyStatus('all');
                  setPage(1);
                }}
                className="mt-4 text-xs font-bold"
              >
                Reset All Filters
              </Button>
            )}
          </Card>
        ) : (
          reviews.map((review) => {
            const hasReply = !!review.ownerReply;

            return (
              <Card
                key={review._id}
                className={cn(
                  'rounded-xl border transition-all shadow-2xs overflow-hidden',
                  hasReply
                    ? 'border-border/80 bg-card hover:border-border'
                    : 'border-primary/40 bg-primary/5 hover:border-primary/60',
                )}
              >
                <CardContent className="p-5 sm:p-6 space-y-4">
                  {/* Top Customer Info & Rating Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-primary/25 flex items-center justify-center font-black text-sm shrink-0">
                        {review.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-foreground">
                            {review.customerName}
                          </h4>
                          <span className="text-muted-foreground text-xs">&bull;</span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <span className="font-bold text-foreground">{review.parkingLotName}</span>
                          {review.bookingReference && (
                            <>
                              <span className="text-muted-foreground">&bull;</span>
                              <span className="font-mono font-bold text-primary">
                                Ref: {review.bookingReference}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {renderStars(review.overallRating)}
                      <span className="font-black text-sm text-foreground">
                        {review.overallRating}.0
                      </span>
                    </div>
                  </div>

                  {/* Customer Review Comment */}
                  <div className="text-sm font-medium text-foreground leading-relaxed pl-1">
                    &ldquo;{review.comment}&rdquo;
                  </div>

                  {/* Owner Response Block or Reply CTA */}
                  {hasReply ? (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/30 space-y-2 mt-3 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-primary/20 text-primary">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-extrabold text-xs text-foreground">
                            Your Official Response
                          </span>
                          {review.replyEdited && (
                            <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground py-0">
                              Edited
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {review.replyDate && (
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {new Date(review.replyDate).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReplyDialog(review)}
                            className="h-7 px-2.5 text-xs font-bold text-primary hover:text-primary/90 hover:bg-primary/10 gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit Reply
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-foreground leading-normal pl-6">
                        {review.ownerReply}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                      <span className="text-xs text-primary font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        This review is awaiting your response. Replying promptly improves customer trust.
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleOpenReplyDialog(review)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 h-9 shadow-xs shrink-0"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        Reply to Customer &rarr;
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border/80">
            <span className="text-xs font-bold text-muted-foreground">
              Showing page {page} of {totalPages} ({data?.total || 0} reviews)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs font-bold h-8"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-xs font-bold h-8"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reply Dialog Modal */}
      <Dialog open={replyModalOpen} onOpenChange={setReplyModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Reply className="w-4 h-4 text-primary" />
              {activeReview?.ownerReply ? 'Edit Official Response' : 'Reply to Customer Review'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium">
              Your response will be visible on the public listing and sent directly as a notification to{' '}
              <span className="font-bold text-foreground">{activeReview?.customerName}</span>.
            </DialogDescription>
          </DialogHeader>

          {activeReview && (
            <div className="space-y-4 my-2">
              {/* Customer Review Quote Snippet */}
              <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-foreground">{activeReview.customerName}</span>
                  {renderStars(activeReview.overallRating)}
                </div>
                <p className="text-foreground/80 italic font-medium">&ldquo;{activeReview.comment}&rdquo;</p>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-foreground">
                  Your Response <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Thank the customer for parking with us, address their feedback politely, and share any improvements..."
                  rows={5}
                  className="text-xs text-foreground font-medium resize-none border-border bg-background"
                  maxLength={MAX_REPLY_CHARS}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Professional and courteous tone recommended.</span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      replyText.length > MAX_REPLY_CHARS - 50 ? 'text-rose-500' : 'text-muted-foreground',
                    )}
                  >
                    {replyText.length} / {MAX_REPLY_CHARS}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReplyModalOpen(false)}
              disabled={replyMutation.isPending}
              className="text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitReply}
              disabled={replyMutation.isPending || !replyText.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 shadow-xs"
            >
              {replyMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  {activeReview?.ownerReply ? 'Update Response' : 'Publish Response'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerReviewsPage;
