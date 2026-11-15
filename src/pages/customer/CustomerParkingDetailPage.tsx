import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  RotateCw,
  Search,
  Building2,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  getCustomerParkingFacilityDetails,
  getFacilityFavouriteStatus,
  type CustomerParkingLotResult,
} from '@/api/customerParking.api';

import { FacilityBreadcrumbs } from '@/components/customer/details/FacilityBreadcrumbs';
import { FacilityHeader } from '@/components/customer/details/FacilityHeader';
import { FacilityPhotoGallery } from '@/components/customer/details/FacilityPhotoGallery';
import { LiveAvailabilitySummary } from '@/components/customer/details/LiveAvailabilitySummary';
import { VehiclePricingSection } from '@/components/customer/details/VehiclePricingSection';
import { FacilityAmenitiesSection } from '@/components/customer/details/FacilityAmenitiesSection';
import { ParkingRulesAccordion } from '@/components/customer/details/ParkingRulesAccordion';
import { FacilityLocationMap } from '@/components/customer/details/FacilityLocationMap';
import { CustomerReviewsSection } from '@/components/customer/details/CustomerReviewsSection';
import { StickyBookingBar } from '@/components/customer/details/StickyBookingBar';

export const CustomerParkingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [facility, setFacility] = useState<CustomerParkingLotResult | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorStatus, setErrorStatus] = useState<'not-found' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat?: number; lng?: number }>({});

  // 1. Detect customer GPS position if permitted
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // GPS optional; continue without error
        },
        { timeout: 5000, enableHighAccuracy: false },
      );
    }
  }, []);

  // 2. Load facility details and favourite status
  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    async function fetchData() {
      try {
        const [data, favStatus] = await Promise.all([
          getCustomerParkingFacilityDetails(id!, userCoords.lat, userCoords.lng),
          getFacilityFavouriteStatus(id!).catch(() => false),
        ]);

        if (!isCancelled) {
          setFacility(data);
          setIsFavourite(favStatus);
          setErrorStatus(null);
          setErrorMessage(null);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const statusCode = (err as { response?: { status?: number } })?.response?.status;
          const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message;

          if (statusCode === 404) {
            setErrorStatus('not-found');
            setErrorMessage(
              serverMsg ||
                'This parking facility is currently not available for public discovery or booking.',
            );
          } else {
            setErrorStatus('error');
            setErrorMessage(
              serverMsg || 'An error occurred while fetching facility details. Please try again.',
            );
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [id, userCoords.lat, userCoords.lng]);

  const handleRefresh = useCallback(async () => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      const [data, favStatus] = await Promise.all([
        getCustomerParkingFacilityDetails(id, userCoords.lat, userCoords.lng),
        getFacilityFavouriteStatus(id).catch(() => false),
      ]);
      setFacility(data);
      setIsFavourite(favStatus);
    } catch {
      // keep current data on refresh error
    } finally {
      setIsRefreshing(false);
    }
  }, [id, userCoords.lat, userCoords.lng]);

  const handleRetry = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    getCustomerParkingFacilityDetails(id, userCoords.lat, userCoords.lng)
      .then((data) => {
        setFacility(data);
        getFacilityFavouriteStatus(id).then(setIsFavourite).catch(() => {});
      })
      .catch((err: unknown) => {
        const statusCode = (err as { response?: { status?: number } })?.response?.status;
        const serverMsg = (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        if (statusCode === 404) {
          setErrorStatus('not-found');
          setErrorMessage(serverMsg || 'This parking facility is not available.');
        } else {
          setErrorStatus('error');
          setErrorMessage(serverMsg || 'Failed to load details.');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, userCoords.lat, userCoords.lng]);

  // Missing ID early return
  if (!id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-2xl border-border/70 shadow-lg text-center p-6 sm:p-8 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-orange-50 text-primary flex items-center justify-center mx-auto border border-orange-200/60 shadow-xs">
            <Building2 className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              Invalid Facility Link
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Parking facility ID was not provided in the route.
            </p>
          </div>
          <Button asChild className="rounded-xl font-bold gap-2">
            <Link to="/customer/search">
              <Search className="h-4 w-4" />
              <span>Search Nearby Parking</span>
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Breadcrumbs Skeleton */}
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>

          {/* Header Skeleton */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-9 w-3/4 sm:w-1/2 rounded-xl" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>

          {/* Photo Gallery Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-72 sm:h-96">
            <Skeleton className="md:col-span-2 h-full rounded-2xl" />
            <div className="md:col-span-2 grid grid-cols-2 gap-3 h-full">
              <Skeleton className="h-full rounded-xl" />
              <Skeleton className="h-full rounded-xl" />
              <Skeleton className="h-full rounded-xl" />
              <Skeleton className="h-full rounded-xl" />
            </div>
          </div>

          {/* Body Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
            <div className="lg:col-span-8 space-y-6">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
            <div className="hidden lg:block lg:col-span-4">
              <Skeleton className="h-80 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not Found State (404 / Facility Inactive)
  if (errorStatus === 'not-found') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-2xl border-border/70 shadow-lg text-center p-6 sm:p-8 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-orange-50 text-primary flex items-center justify-center mx-auto border border-orange-200/60 shadow-xs">
            <Building2 className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              Facility Not Found or Inactive
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {errorMessage ||
                'This parking lot may be temporarily unlisted, undergoing maintenance, or awaiting official layout publication.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
            <Button asChild className="rounded-xl font-bold gap-2">
              <Link to="/customer/search">
                <Search className="h-4 w-4" />
                <span>Search Nearby Parking</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleRetry}
              className="rounded-xl gap-2 font-medium"
            >
              <RotateCw className="h-4 w-4" />
              <span>Retry</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Generic Error State
  if (errorStatus === 'error' || !facility) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full rounded-2xl border-rose-200 shadow-lg text-center p-6 sm:p-8 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
            <AlertCircle className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              Failed to Load Parking Details
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {errorMessage || 'A network or server communication error occurred. Please verify your connection.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
            <Button
              onClick={handleRetry}
              className="rounded-xl font-bold gap-2"
            >
              <RotateCw className="h-4 w-4" />
              <span>Retry Request</span>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-medium gap-2">
              <Link to="/customer/search">
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Search</span>
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        {/* 1. Breadcrumbs Navigation */}
        <FacilityBreadcrumbs
          parkingId={facility._id}
          parkingName={facility.parkingName}
          isFavouriteInitial={isFavourite}
        />

        {/* 2. Facility Header */}
        <FacilityHeader facility={facility} />

        {/* 3. Photo Gallery */}
        <FacilityPhotoGallery
          parkingName={facility.parkingName}
          images={facility.parkingImages || []}
        />

        {/* 4. Split Two-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
          {/* Main Left Column (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Live Availability Section */}
            <LiveAvailabilitySummary
              facility={facility}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />

            {/* About / Description Card */}
            {facility.description && (
              <Card className="rounded-2xl border-border/70 shadow-xs">
                <CardContent className="p-5 sm:p-6 space-y-2">
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    About this Parking Facility
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {facility.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Vehicle Pricing Section */}
            <VehiclePricingSection facility={facility} />

            {/* Facilities & Amenities Grid */}
            <FacilityAmenitiesSection amenities={facility.amenities || []} />

            {/* Parking Rules Accordion */}
            <ParkingRulesAccordion facility={facility} />

            {/* Interactive Leaflet Location Map */}
            <FacilityLocationMap facility={facility} />

            {/* Customer Reviews Section */}
            <CustomerReviewsSection
              parkingId={facility._id}
              initialAverageRating={facility.averageRating}
              initialTotalReviews={facility.totalReviews}
            />
          </div>

          {/* Right Column: Sticky Booking Card on Desktop (4 cols on lg) */}
          <div className="lg:col-span-4">
            <StickyBookingBar facility={facility} />
          </div>
        </div>
      </div>
    </div>
  );
};
export default CustomerParkingDetailPage;
