import React, { useState, useEffect } from 'react';
import {
  Star,
  MessageSquare,
  CornerDownRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getFacilityReviews,
  type FacilityReviewsResponse,
} from '@/api/customerParking.api';

interface CustomerReviewsSectionProps {
  parkingId: string;
  initialAverageRating: number;
  initialTotalReviews: number;
}

export const CustomerReviewsSection: React.FC<CustomerReviewsSectionProps> = ({
  parkingId,
  initialAverageRating,
  initialTotalReviews,
}) => {
  const [reviewsData, setReviewsData] = useState<FacilityReviewsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchReviews() {
      try {
        setIsLoading(true);
        const data = await getFacilityReviews(parkingId);
        if (isMounted) {
          setReviewsData(data);
        }
      } catch {
        // Fall back gracefully
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (parkingId) {
      fetchReviews();
    }

    return () => {
      isMounted = false;
    };
  }, [parkingId]);

  const avgRating = reviewsData?.averageRating ?? initialAverageRating;
  const totalCount = reviewsData?.totalReviews ?? initialTotalReviews;
  const reviews = reviewsData?.reviews ?? [];
  const distribution = reviewsData?.ratingDistribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]?.charAt(0) || ''}${parts[1]?.charAt(0) || ''}`.toUpperCase();
    }
    return (name.charAt(0) || 'U').toUpperCase();
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
    <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Customer Reviews & Ratings
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified feedback submitted by real motorists after completing their parking reservation.
            </p>
          </div>

          <Badge
            variant="outline"
            className="bg-primary/5 text-primary border-primary/20 text-xs font-semibold px-2.5 py-0.5 rounded-full gap-1"
          >
            <ShieldCheck className="h-3 w-3 text-primary" />
            <span>Verified Bookings Only</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Rating Breakdown Header */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center p-4 sm:p-5 rounded-xl bg-muted/30 border border-border/60">
          {/* Left: Overall Score */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-2">
            <span className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </span>

            {/* Stars */}
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.round(avgRating)
                      ? 'fill-amber-500 text-amber-500'
                      : 'fill-muted text-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            <span className="text-xs font-medium text-muted-foreground mt-1.5">
              Based on {totalCount} verified {totalCount === 1 ? 'review' : 'reviews'}
            </span>
          </div>

          {/* Right: Distribution Bars (5 to 1 star) */}
          <div className="md:col-span-8 space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars as 1 | 2 | 3 | 4 | 5] || 0;
              const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

              return (
                <div key={stars} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-12 font-medium text-muted-foreground shrink-0">
                    <span>{stars}</span>
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  </div>

                  {/* Progress Bar Track */}
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <span className="w-9 text-right font-semibold text-muted-foreground shrink-0">
                    {percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reviews List or Empty State */}
        {isLoading ? (
          <div className="space-y-4 pt-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-border/70 bg-card">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-foreground">
              No customer reviews yet
            </h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Be the first customer to reserve a spot at this verified facility and share your experience!
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {reviews.map((rev) => (
              <div
                key={rev._id}
                className="p-4 sm:p-5 rounded-xl border border-border/60 bg-card hover:border-border transition-colors space-y-3"
              >
                {/* Reviewer Header */}
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {getInitials(rev.customerName)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-foreground">
                          {rev.customerName}
                        </span>
                        <CheckCircle className="h-3 w-3 text-emerald-600" />
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        Verified Motorist • {formatDate(rev.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Stars Badge */}
                  <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3 w-3 ${
                          star <= rev.rating
                            ? 'fill-amber-500 text-amber-500'
                            : 'fill-muted text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment Text */}
                {rev.comment && (
                  <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed pl-1">
                    "{rev.comment}"
                  </p>
                )}

                {/* Owner Reply if present */}
                {rev.ownerReply && (
                  <div className="ml-4 sm:ml-6 mt-3 p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/60 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <CornerDownRight className="h-3.5 w-3.5" />
                      <span>Response from Parking Management</span>
                      {rev.replyDate && (
                        <span className="text-[11px] font-normal text-muted-foreground">
                          • {formatDate(rev.replyDate)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed pl-5">
                      {rev.ownerReply}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
