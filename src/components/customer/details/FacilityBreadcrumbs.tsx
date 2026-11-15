import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Heart,
  Home,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { toggleFacilityFavourite } from '@/api/customerParking.api';

interface FacilityBreadcrumbsProps {
  parkingId: string;
  parkingName: string;
  isFavouriteInitial: boolean;
}

export const FacilityBreadcrumbs: React.FC<FacilityBreadcrumbsProps> = ({
  parkingId,
  parkingName,
  isFavouriteInitial,
}) => {
  const [toggledFavourite, setToggledFavourite] = useState<{ id: string; status: boolean } | null>(
    null,
  );
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const isFavourite =
    toggledFavourite && toggledFavourite.id === parkingId
      ? toggledFavourite.status
      : isFavouriteInitial;

  const handleShare = async () => {
    const shareData = {
      title: `${parkingName} | ParkEase`,
      text: `Book verified parking at ${parkingName} with live spot availability on ParkEase.`,
      url: window.location.href,
    };

    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      toast.success('Facility link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error('Could not copy link to clipboard.');
    }
  };

  const handleToggleFavourite = async () => {
    if (isTogglingFav) return;
    setIsTogglingFav(true);
    const previous = isFavourite;
    setToggledFavourite({ id: parkingId, status: !previous }); // Optimistic

    try {
      const nextStatus = await toggleFacilityFavourite(parkingId);
      setToggledFavourite({ id: parkingId, status: nextStatus });
      if (nextStatus) {
        toast.success('Saved to your favourite locations!');
      } else {
        toast.info('Removed from your favourite locations.');
      }
    } catch {
      setToggledFavourite({ id: parkingId, status: previous });
      toast.error('Could not update favourite status.');
    } finally {
      setIsTogglingFav(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
      {/* Left: Breadcrumbs & Back */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
        <Link
          to="/customer/search"
          className="inline-flex items-center gap-1 font-semibold text-foreground/80 hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Search</span>
        </Link>

        <span className="text-border">|</span>

        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 flex-wrap">
          <Link
            to="/"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only">Home</span>
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <Link
            to="/customer/search"
            className="hover:text-foreground transition-colors"
          >
            Find Parking
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[320px]">
            {parkingName}
          </span>
        </nav>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="h-8 text-xs font-medium rounded-lg gap-1.5 border-border/70 hover:bg-muted text-foreground"
        >
          {isCopied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Share</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleFavourite}
          disabled={isTogglingFav}
          className={`h-8 text-xs font-medium rounded-lg gap-1.5 border-border/70 hover:bg-muted ${
            isFavourite ? 'text-rose-600 bg-rose-50/50 border-rose-200' : 'text-foreground'
          }`}
        >
          <Heart
            className={`h-3.5 w-3.5 transition-colors ${
              isFavourite ? 'fill-rose-600 text-rose-600' : 'text-muted-foreground'
            }`}
          />
          <span>{isFavourite ? 'Saved' : 'Save'}</span>
        </Button>
      </div>
    </div>
  );
};
