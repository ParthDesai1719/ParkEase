import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Star,
  Clock,
  ShieldCheck,
  Navigation,
  ArrowRight,
  Building2,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CustomerParkingLotResult } from '@/api/customerParking.api';

interface FacilityHeaderProps {
  facility: CustomerParkingLotResult;
}

export const FacilityHeader: React.FC<FacilityHeaderProps> = ({ facility }) => {
  const {
    _id,
    parkingName,
    address,
    city,
    state,
    postalCode,
    country,
    latitude,
    longitude,
    distanceKm,
    averageRating,
    totalReviews,
    isOpenNow,
    isOpen24Hours,
    openingTime,
    closingTime,
    facilityType = 'Commercial Parking',
    isVerified,
    hourlyRate,
  } = facility;

  const fullAddress = `${address}, ${city}, ${state} ${postalCode}, ${country}`;

  const openNavigationInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Badges Row */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Badge
          variant="outline"
          className="bg-primary/5 text-primary border-primary/20 font-semibold gap-1 px-2.5 py-0.5 rounded-full"
        >
          <Building2 className="h-3 w-3" />
          <span>{facilityType}</span>
        </Badge>

        {isVerified && (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold gap-1 px-2.5 py-0.5 rounded-full"
          >
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            <span>Verified Facility</span>
          </Badge>
        )}

        {isOpen24Hours ? (
          <Badge
            variant="outline"
            className="bg-sky-50 text-sky-700 border-sky-200 font-semibold gap-1 px-2.5 py-0.5 rounded-full"
          >
            <Clock className="h-3 w-3 text-sky-600" />
            <span>Open 24/7</span>
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={`font-semibold gap-1 px-2.5 py-0.5 rounded-full ${
              isOpenNow
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOpenNow ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>
              {isOpenNow
                ? `Open Now (${openingTime} - ${closingTime})`
                : `Closed (Opens ${openingTime})`}
            </span>
          </Badge>
        )}

        {distanceKm !== null && distanceKm !== undefined && (
          <Badge
            variant="outline"
            className="bg-muted/80 text-foreground/80 border-border/60 font-medium gap-1 px-2.5 py-0.5 rounded-full"
          >
            <Navigation className="h-3 w-3 text-primary" />
            <span>{distanceKm.toFixed(1)} km away</span>
          </Badge>
        )}
      </div>

      {/* Main Title & Action Row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            {parkingName}
          </h1>

          {/* Location & Reviews Subtitle */}
          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-sm text-muted-foreground">
            {/* Rating */}
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="flex items-center gap-0.5 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span className="text-xs font-bold">{averageRating > 0 ? averageRating.toFixed(1) : 'New'}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
              </span>
            </div>

            <span className="text-border hidden sm:inline">•</span>

            {/* Address */}
            <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[280px] sm:max-w-md" title={fullAddress}>
                {address}, {city}
              </span>
            </div>
          </div>
        </div>

        {/* Right CTA Group (Desktop Header Quick Action) */}
        <div className="hidden sm:flex items-center gap-3 shrink-0 self-start lg:self-center">
          <Button
            variant="outline"
            onClick={openNavigationInMaps}
            className="h-10 px-4 text-xs font-semibold rounded-xl gap-2 border-border/80 hover:bg-muted text-foreground"
          >
            <Navigation className="h-4 w-4 text-primary" />
            <span>Get Directions</span>
          </Button>

          <Button
            asChild
            className="h-10 px-5 text-sm font-bold rounded-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/25"
          >
            <Link to={`/customer/parking/${_id}/book`}>
              <Sparkles className="h-4 w-4 text-primary-foreground/90" />
              <span>Book Spot (₹{hourlyRate}/hr)</span>
              <ArrowRight className="h-4 w-4 ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
