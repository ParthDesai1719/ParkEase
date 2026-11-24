import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  Loader2,
  Building2,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  submitCustomerReview,
  updateCustomerReview,
  type CustomerSubmittedReviewItem,
  type EligibleReviewBookingItem,
} from '@/api/customerParking.api';

interface CustomerReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: EligibleReviewBookingItem | {
    bookingId: string;
    bookingReference: string;
    parkingName: string;
    parkingAddress?: string;
    vehiclePlate?: string;
  } | null;
  eligibleBookings?: EligibleReviewBookingItem[];
  editingReview?: CustomerSubmittedReviewItem | null;
  onSuccess: () => void;
}

const RATING_DESCRIPTIONS: Record<number, { label: string; description: string }> = {
  1: { label: 'Terrible', description: 'Very poor experience, multiple issues encountered.' },
  2: { label: 'Poor', description: 'Substandard experience, needs noticeable improvements.' },
  3: { label: 'Average', description: 'Met basic expectations, standard parking facility.' },
  4: { label: 'Good', description: 'Great experience, clean, secure, and hassle-free.' },
  5: { label: 'Excellent', description: 'Outstanding! Seamless entry, pristine bays & fast checkout.' },
};

export const CustomerReviewModal: React.FC<CustomerReviewModalProps> = ({
  open,
  onOpenChange,
  booking,
  eligibleBookings = [],
  editingReview = null,
  onSuccess,
}) => {
  const isEditing = Boolean(editingReview);

  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form state whenever modal opens or editingReview/booking changes
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      if (editingReview) {
        setSelectedBookingId(editingReview.bookingId);
        setRating(editingReview.overallRating);
        setComment(editingReview.comment || '');
      } else if (booking) {
        setSelectedBookingId(booking.bookingId);
        setRating(5);
        setComment('');
      } else if (eligibleBookings.length > 0) {
        setSelectedBookingId(eligibleBookings[0].bookingId);
        setRating(5);
        setComment('');
      } else {
        setSelectedBookingId('');
        setRating(5);
        setComment('');
      }
    }
  }, [open, editingReview, booking, eligibleBookings]);

  // Derive target booking details
  const activeBooking =
    booking && booking.bookingId === selectedBookingId
      ? booking
      : eligibleBookings.find((b) => b.bookingId === selectedBookingId);

  const activeRating = hoveredRating ?? rating;
  const ratingInfo = RATING_DESCRIPTIONS[activeRating] || RATING_DESCRIPTIONS[5];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isEditing && !selectedBookingId) {
      setErrorMessage('Please select a completed booking to review.');
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      setErrorMessage('Please select a star rating between 1 and 5.');
      return;
    }

    if (comment.length > 1000) {
      setErrorMessage('Review comment cannot exceed 1000 characters.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (isEditing && editingReview) {
        await updateCustomerReview(editingReview._id, {
          overallRating: rating,
          comment: comment.trim() || undefined,
        });
        toast.success('Your review has been successfully updated.');
      } else {
        await submitCustomerReview({
          bookingId: selectedBookingId,
          overallRating: rating,
          comment: comment.trim() || undefined,
        });
        toast.success('Thank you! Your review has been published.');
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save your review. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden bg-background border-border/80 shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-6 pb-4 bg-muted/30 border-b border-border/60">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold"
                >
                  <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                  {isEditing ? 'Edit Feedback' : 'Verified Review'}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
                {isEditing ? 'Update Your Parking Review' : 'Rate Your Parking Experience'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Share your verified feedback to help fellow motorists and help parking operators
                improve their facilities.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Error Banner */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Target Booking Info or Selector */}
            {isEditing && editingReview ? (
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>{editingReview.parkingName}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-5">
                    {editingReview.parkingAddress}, {editingReview.parkingCity}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  Ref: {editingReview.bookingReference}
                </Badge>
              </div>
            ) : booking ? (
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>{booking.parkingName}</span>
                  </div>
                  {booking.parkingAddress && (
                    <p className="text-[11px] text-muted-foreground pl-5">
                      {booking.parkingAddress}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  Ref: {booking.bookingReference}
                </Badge>
              </div>
            ) : eligibleBookings.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Select Completed Booking to Review
                </Label>
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger className="w-full text-xs h-10">
                    <SelectValue placeholder="Choose a completed parking session..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {eligibleBookings.map((b) => (
                      <SelectItem key={b.bookingId} value={b.bookingId} className="text-xs py-2">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span className="font-medium text-foreground">{b.parkingName}</span>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {b.bookingReference} ({b.slotNumber})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeBooking && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pl-1">
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      Completed visit
                      {activeBooking.vehiclePlate ? ` • Plate: ${activeBooking.vehiclePlate}` : ''}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                You do not currently have any unreviewed completed bookings. Reviews can only be
                submitted after parking check-out has been verified.
              </div>
            )}

            {/* Interactive Star Rating */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Overall Star Rating <span className="text-rose-500">*</span>
                </Label>
                <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                  <span>{activeRating}.0</span>
                  <span className="text-muted-foreground font-normal">
                    — {ratingInfo.label}
                  </span>
                </span>
              </div>

              {/* Star Buttons */}
              <div className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-muted/10 justify-center">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = starVal <= activeRating;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setRating(starVal)}
                      onMouseEnter={() => setHoveredRating(starVal)}
                      onMouseLeave={() => setHoveredRating(null)}
                      className="p-1.5 rounded-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                          isFilled
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/30 hover:text-muted-foreground/60'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground text-center italic">
                "{ratingInfo.description}"
              </p>
            </div>

            {/* Written Feedback Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="review-comment" className="text-xs font-semibold text-foreground">
                  Written Feedback (Optional)
                </Label>
                <span
                  className={`text-[10px] font-mono ${
                    comment.length > 900
                      ? 'text-rose-500 font-bold'
                      : 'text-muted-foreground'
                  }`}
                >
                  {comment.length}/1000
                </span>
              </div>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share specific details about your parking visit: ease of finding your bay, lighting, cleanliness, safety, speed of gate entry/exit..."
                className="text-xs min-h-[110px] resize-y rounded-xl border-border/70 focus-visible:ring-primary/30"
                maxLength={1000}
              />
              <p className="text-[11px] text-muted-foreground">
                Your review helps maintain transparency across all ParkEase partner facilities.
              </p>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 px-6 bg-muted/20 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (!isEditing && !selectedBookingId)}
              className="text-xs h-9 font-semibold gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isEditing ? 'Updating Review...' : 'Publishing Review...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Save Changes' : 'Submit Review'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
