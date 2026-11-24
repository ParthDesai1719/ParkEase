import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  Search,
  MapPin,
  Star,
  Car,
  Clock,
  ArrowUpDown,
  LayoutGrid,
  List,
  ExternalLink,
  CalendarCheck,
  AlertCircle,
  Navigation,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  getCustomerFavourites,
  removeFacilityFavourite,
  type CustomerParkingLotResult,
} from '@/api/customerParking.api';

type SortOption = 'distance' | 'rating' | 'price' | 'availableSlots';

export const CustomerFavouritesPage: React.FC = () => {
  const navigate = useNavigate();

  const [favourites, setFavourites] = useState<
    Array<CustomerParkingLotResult & { favouritedAt: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, filter, and view controls
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // User location for distance sorting
  const [userCoords, setUserCoords] = useState<{ latitude?: number; longitude?: number }>({});

  // Confirmation dialog for removal
  const [removingFacility, setRemovingFacility] = useState<
    (CustomerParkingLotResult & { favouritedAt: string }) | null
  >(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Request browser geolocation once for accurate distance calculation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          // Graceful fallback without coords
        },
        { timeout: 8000, maximumAge: 60000 },
      );
    }
  }, []);

  const loadFavourites = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCustomerFavourites(userCoords);
      setFavourites(data || []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load saved locations.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFavourites();
  }, [userCoords]);

  // Remove favourite handler
  const handleConfirmRemove = async () => {
    if (!removingFacility) return;
    try {
      setIsRemoving(true);
      await removeFacilityFavourite(removingFacility._id);
      setFavourites((prev) => prev.filter((f) => f._id !== removingFacility._id));
      toast.success(`${removingFacility.parkingName} removed from saved locations.`);
      setRemovingFacility(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to remove from favourites.';
      toast.error(msg);
    } finally {
      setIsRemoving(false);
    }
  };

  // Filtered & sorted locations
  const displayedFavourites = useMemo(() => {
    let result = [...favourites];

    // Search filter: parkingName or city
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.parkingName.toLowerCase().includes(q) ||
          f.city.toLowerCase().includes(q) ||
          f.address.toLowerCase().includes(q),
      );
    }

    // Sort options: distance, rating, price, availableSlots
    result.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          if (a.distanceKm != null && b.distanceKm != null) {
            return a.distanceKm - b.distanceKm;
          }
          if (a.distanceKm != null) return -1;
          if (b.distanceKm != null) return 1;
          return 0;
        case 'rating':
          return (b.averageRating ?? 0) - (a.averageRating ?? 0);
        case 'price':
          return (a.hourlyRate ?? 0) - (b.hourlyRate ?? 0);
        case 'availableSlots':
          return (b.availableSlots ?? 0) - (a.availableSlots ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [favourites, searchQuery, sortBy]);

  // Total free bays across all saved lots
  const totalAvailableBays = favourites.reduce((sum, f) => sum + (f.availableSlots || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Favourite Parking Locations
              </h1>
              <Badge variant="outline" className="text-xs font-mono font-medium">
                PAGE 13
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Quickly access, compare live bay availability, and book your preferred parking facilities.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Link to="/customer/search">
                <Search className="w-3.5 h-3.5" />
                <span>Explore Parking Map</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Saved Facilities</span>
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : favourites.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Quick-book favorites</p>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-xs bg-card/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Available Bays</span>
              <Car className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : totalAvailableBays}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Live unreserved slots</p>
          </Card>

          <Card className="col-span-2 sm:col-span-1 rounded-2xl border-border/70 shadow-xs bg-card/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Location Tracking</span>
              <Navigation className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-sm font-semibold text-foreground mt-1.5 flex items-center gap-1.5">
              {userCoords.latitude ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>GPS Proximity Active</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Default Sorting</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Accurate distance calculation</p>
          </Card>
        </div>

        {/* Search, Sort, and Layout Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved lots by parking name, city, or address..."
              className="pl-9 text-xs h-9 rounded-xl border-border/70 bg-card/60"
            />
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
              </span>
              <Select value={sortBy} onValueChange={(val: SortOption) => setSortBy(val)}>
                <SelectTrigger className="w-[160px] text-xs h-9 rounded-xl bg-card/60">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating" className="text-xs">
                    Highest Rating
                  </SelectItem>
                  <SelectItem value="price" className="text-xs">
                    Lowest Price
                  </SelectItem>
                  <SelectItem value="availableSlots" className="text-xs">
                    Most Available Bays
                  </SelectItem>
                  <SelectItem value="distance" className="text-xs">
                    Nearest Distance
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid / List View Toggle */}
            <div className="flex items-center rounded-xl border border-border/70 bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-background shadow-xs text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-background shadow-xs text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-3'
            }
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="rounded-2xl border-border/70 p-5 space-y-4">
                <Skeleton className="w-full h-32 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="w-3/4 h-5" />
                  <Skeleton className="w-1/2 h-3" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="w-20 h-6" />
                  <Skeleton className="w-24 h-8 rounded-xl" />
                </div>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center rounded-2xl border border-destructive/30 bg-destructive/5 space-y-3">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={loadFavourites} className="text-xs">
              Try Again
            </Button>
          </div>
        ) : displayedFavourites.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-border/70 bg-card/40 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <Heart className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-foreground">
                {searchQuery.trim()
                  ? 'No Matching Favourite Facilities Found'
                  : 'No Saved Locations Yet'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {searchQuery.trim()
                  ? `No saved parking facilities match "${searchQuery}". Try a different keyword.`
                  : 'Save your frequently visited parking facilities by clicking the heart icon on any parking card or detail page for quick one-click reservations.'}
              </p>
            </div>
            {searchQuery.trim() ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold"
              >
                Clear Search
              </Button>
            ) : (
              <Button asChild size="sm" className="text-xs font-semibold gap-1.5">
                <Link to="/customer/search">
                  <Search className="w-3.5 h-3.5" />
                  <span>Find Parking Nearby</span>
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5'
                : 'space-y-3'
            }
          >
            {displayedFavourites.map((facility) => {
              const hasAvailableSlots = facility.availableSlots > 0;
              const slotsColor =
                facility.availableSlots > 10
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : facility.availableSlots > 0
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';

              return (
                <Card
                  key={facility._id}
                  className="rounded-2xl border-border/70 shadow-xs hover:border-border hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group bg-card"
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Top Facility Header & Heart Action */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <Link
                          to={`/customer/parking/${facility._id}`}
                          className="font-bold text-base text-foreground hover:text-primary transition-colors line-clamp-1 group-hover:text-primary"
                        >
                          {facility.parkingName}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="line-clamp-1">
                            {facility.address}, {facility.city}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setRemovingFacility(facility)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                        title="Remove from Favourites"
                      >
                        <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                      </button>
                    </div>

                    {/* Facility Key Badges: Rating, Distance, Live Bays */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {/* Rating */}
                      <Badge variant="outline" className="gap-1 py-0.5 px-2 bg-amber-500/5 border-amber-500/20 text-foreground font-semibold">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{facility.averageRating > 0 ? facility.averageRating.toFixed(1) : 'New'}</span>
                        {facility.totalReviews > 0 && (
                          <span className="text-muted-foreground font-normal text-[10px]">
                            ({facility.totalReviews})
                          </span>
                        )}
                      </Badge>

                      {/* Distance */}
                      {facility.distanceKm != null && (
                        <Badge variant="outline" className="gap-1 py-0.5 px-2 text-muted-foreground font-medium">
                          <Navigation className="w-3 h-3 text-sky-500" />
                          <span>{facility.distanceKm.toFixed(1)} km</span>
                        </Badge>
                      )}

                      {/* Live Bay Counter */}
                      <Badge className={`gap-1 py-0.5 px-2 text-xs font-semibold ${slotsColor}`}>
                        <span>
                          {facility.availableSlots} / {facility.totalSlots} Bays Free
                        </span>
                      </Badge>
                    </div>

                    {/* Pricing and Operating Hours */}
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                          Tariff Rate
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-base font-bold text-foreground">
                            ₹{facility.hourlyRate}
                          </span>
                          <span className="text-[11px] text-muted-foreground">/ hour</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                          Operating Hours
                        </span>
                        <span className="text-xs font-medium text-foreground flex items-center gap-1 mt-0.5 justify-end">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {facility.isOpen24Hours
                            ? '24 / 7 Access'
                            : `${facility.openingTime} - ${facility.closingTime}`}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-9 gap-1 hover:bg-muted/50"
                      >
                        <Link to={`/customer/parking/${facility._id}`}>
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </Link>
                      </Button>

                      <Button
                        size="sm"
                        disabled={!hasAvailableSlots}
                        onClick={() => navigate(`/customer/parking/${facility._id}/book`)}
                        className="flex-1 text-xs h-9 font-semibold gap-1.5 shadow-sm"
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>{hasAvailableSlots ? 'Book Now' : 'Lot Full'}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={Boolean(removingFacility)}
        onOpenChange={(open) => !open && setRemovingFacility(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Remove Saved Facility?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-foreground">
                {removingFacility?.parkingName}
              </span>{' '}
              from your saved locations? You can easily re-add it anytime from the parking search or
              facility details page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemovingFacility(null)}
              disabled={isRemoving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              className="text-xs font-semibold gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isRemoving ? 'Removing...' : 'Remove Location'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
