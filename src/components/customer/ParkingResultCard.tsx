import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Star,
  Navigation,
  Car,
  Bike,
  Zap,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Heart,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  type CustomerParkingLotResult,
  getFacilityImageUrl,
  toggleFacilityFavourite,
} from '@/api/customerParking.api';

interface ParkingResultCardProps {
  parkingLot: CustomerParkingLotResult;
  isSelected?: boolean;
  isFavourite?: boolean;
  onToggleFavourite?: (parkingLotId: string, isFav: boolean) => void;
  onSelect?: (lot: CustomerParkingLotResult) => void;
  onHover?: (lot: CustomerParkingLotResult | null) => void;
}

export const ParkingResultCard: React.FC<ParkingResultCardProps> = ({
  parkingLot,
  isSelected = false,
  isFavourite = false,
  onToggleFavourite,
  onSelect,
  onHover,
}) => {
  const {
    _id,
    parkingName,
    address,
    city,
    distanceKm,
    hourlyRate,
    availableSlots,
    totalSlots,
    occupancyPercentage,
    averageRating,
    totalReviews,
    amenities,
    parkingImages,
    isOpenNow,
    isOpen24Hours,
    vehicleAvailability,
  } = parkingLot;

  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(isFavourite);
  const [isFavLoading, setIsFavLoading] = useState(false);

  useEffect(() => {
    setIsFav(isFavourite);
  }, [isFavourite]);

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isFavLoading) return;

    const previousState = isFav;
    const optimisticState = !previousState;
    setIsFav(optimisticState);
    setIsFavLoading(true);

    try {
      const serverResult = await toggleFacilityFavourite(_id);
      setIsFav(serverResult);
      onToggleFavourite?.(_id, serverResult);
      if (serverResult) {
        toast.success(`Saved "${parkingName}" to favourite locations!`);
      } else {
        toast.info(`Removed "${parkingName}" from favourite locations.`);
      }
    } catch (err: unknown) {
      setIsFav(previousState);
      const msg = err instanceof Error ? err.message : 'Failed to update favourite location.';
      toast.error(msg);
    } finally {
      setIsFavLoading(false);
    }
  };

  const rawImage = parkingImages && parkingImages.length > 0 ? parkingImages[0] : null;
  const resolvedImageUrl = rawImage ? getFacilityImageUrl(rawImage) : null;
  const isImageFailed = Boolean(resolvedImageUrl && failedImageUrl === resolvedImageUrl);

  const isSoldOut = availableSlots <= 0;
  const isLowAvailability = !isSoldOut && availableSlots <= Math.max(3, Math.floor(totalSlots * 0.2));
  const availablePercentage = totalSlots > 0 ? Math.round((availableSlots / totalSlots) * 100) : 0;

  return (
    <Card
      onClick={() => onSelect?.(parkingLot)}
      onMouseEnter={() => onHover?.(parkingLot)}
      onMouseLeave={() => onHover?.(null)}
      className={`group overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-primary ring-2 ring-primary/30 shadow-md bg-card/95 -translate-y-0.5'
          : 'border-border/70 hover:border-primary/40 hover:shadow-md bg-card hover:-translate-y-0.5'
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        {/* Cover Photo Container */}
        <div className="relative sm:w-60 h-48 sm:h-auto shrink-0 bg-muted/30 overflow-hidden">
          {resolvedImageUrl && !isImageFailed ? (
            <img
              src={resolvedImageUrl}
              alt={parkingName}
              onError={() => setFailedImageUrl(resolvedImageUrl)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-muted/40 to-primary/5 p-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-card/80 border border-border/80 flex items-center justify-center text-primary mb-2 shadow-xs">
                <Car className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold text-foreground tracking-tight">
                {parkingName}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" /> Verified Facility
              </span>
            </div>
          )}

          {/* Floating Glassmorphism Price Badge */}
          <div className="absolute top-3 left-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-background/90 backdrop-blur-md text-foreground shadow-sm border border-border/70 flex items-center gap-1">
              ₹{hourlyRate}
              <span className="text-[10px] text-muted-foreground font-normal">/hr</span>
            </span>
          </div>

          {/* Floating Save / Favourite Heart Button */}
          <button
            type="button"
            onClick={handleToggleFavourite}
            disabled={isFavLoading}
            className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-sm border cursor-pointer ${
              isFav
                ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 shadow-rose-500/25 scale-105'
                : 'bg-background/85 text-muted-foreground border-border/80 hover:text-rose-500 hover:bg-background hover:scale-105'
            }`}
            title={isFav ? 'Remove from Favourites' : 'Save to Favourites'}
            aria-label={isFav ? 'Remove from Favourites' : 'Save to Favourites'}
          >
            <Heart
              className={`h-4 w-4 transition-transform active:scale-75 ${
                isFav ? 'fill-white text-white' : ''
              }`}
            />
          </button>

          {/* Floating Operational Status Pill */}
          <div className="absolute bottom-3 left-3">
            {isOpen24Hours ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600/90 text-white backdrop-blur-md shadow-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> 24×7 Open
              </span>
            ) : isOpenNow ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600/90 text-white backdrop-blur-md shadow-xs flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Open Now
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-900/85 text-zinc-300 backdrop-blur-md shadow-xs flex items-center gap-1">
                Closed
              </span>
            )}
          </div>
        </div>

        {/* Facility Information & Action Area */}
        <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5">
          <div className="space-y-2">
            {/* Title & Distance */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                  {parkingName}
                </h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 line-clamp-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  {address}, {city}
                </p>
              </div>

              {/* Distance Tag */}
              {distanceKm !== null && distanceKm !== undefined && (
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    <Navigation className="h-3 w-3" />
                    {distanceKm} km
                  </span>
                </div>
              )}
            </div>

            {/* Rating & Occupancy */}
            <div className="flex items-center gap-3 pt-0.5 text-xs">
              <div className="flex items-center gap-1 font-bold text-amber-500">
                <Star className="h-3.5 w-3.5 fill-amber-500" />
                <span>{averageRating > 0 ? averageRating.toFixed(1) : 'New'}</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  ({totalReviews})
                </span>
              </div>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-xs text-muted-foreground">
                <strong className="text-foreground font-semibold">{occupancyPercentage}%</strong> capacity in use
              </span>
            </div>

            {/* Live Visual Capacity Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold flex items-center gap-1.5 ${
                  isSoldOut
                    ? 'text-red-600 dark:text-red-400'
                    : isLowAvailability
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isSoldOut ? 'bg-red-500' : isLowAvailability ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}></span>
                  {isSoldOut
                    ? 'Sold Out — No Slots Open'
                    : `${availableSlots} of ${totalSlots} Spots Available`}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {availablePercentage}% free
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isSoldOut
                      ? 'bg-red-500 w-full'
                      : isLowAvailability
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(6, availablePercentage))}%` }}
                />
              </div>
            </div>

            {/* Vehicle Breakdown Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              {vehicleAvailability?.car?.available > 0 && (
                <span className="px-2 py-0.5 rounded-md font-medium bg-muted/40 text-muted-foreground border border-border/50 flex items-center gap-1">
                  <Car className="h-3 w-3 text-sky-500" /> {vehicleAvailability.car.available} Cars
                </span>
              )}
              {vehicleAvailability?.bike?.available > 0 && (
                <span className="px-2 py-0.5 rounded-md font-medium bg-muted/40 text-muted-foreground border border-border/50 flex items-center gap-1">
                  <Bike className="h-3 w-3 text-orange-500" /> {vehicleAvailability.bike.available} Bikes
                </span>
              )}
              {vehicleAvailability?.ev && vehicleAvailability.ev.total > 0 ? (
                <span className="px-2 py-0.5 rounded-md font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Zap className="h-3 w-3 text-emerald-500" /> {vehicleAvailability.ev.available} EV
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md font-medium bg-muted/40 text-muted-foreground/60 border border-border/40 flex items-center gap-1 opacity-75">
                  <Zap className="h-3 w-3 text-muted-foreground/50" /> EV Not Available
                </span>
              )}

              {/* Amenities */}
              {amenities && amenities.length > 0 && (
                <>
                  {amenities.slice(0, 3).map((amenity, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md font-normal bg-muted/30 text-muted-foreground border border-border/40"
                    >
                      {amenity}
                    </span>
                  ))}
                  {amenities.length > 3 && (
                    <span className="text-[10px] text-muted-foreground self-center">
                      +{amenities.length - 3}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="pt-2.5 border-t border-border/50 flex items-center justify-between gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold rounded-lg text-muted-foreground hover:text-foreground"
            >
              <Link to={`/customer/parking/${_id}`} onClick={(e) => e.stopPropagation()}>
                View Details
              </Link>
            </Button>

            <Button
              asChild
              size="sm"
              disabled={isSoldOut}
              className="h-8 px-4 text-xs font-bold rounded-lg gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Link to={`/customer/parking/${_id}/book`} onClick={(e) => e.stopPropagation()}>
                Reserve Spot
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};
