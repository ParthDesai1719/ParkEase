import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  X,
  Compass,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCw,
  AlertCircle,
  Map as MapIcon,
  List as ListIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Car,
  Bike,
  Zap,
  ShieldCheck,
  Clock,
  Star,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import {
  searchCustomerParkingLots,
  type CustomerParkingLotResult,
  type CustomerParkingSearchParams,
} from '@/api/customerParking.api';
import { SearchFiltersSidebar } from '@/components/customer/SearchFiltersSidebar';
import { ParkingResultCard } from '@/components/customer/ParkingResultCard';
import { ParkingSearchMap } from '@/components/customer/ParkingSearchMap';

export const SearchParkingPage: React.FC = () => {
  // 1. Search Query & Geolocation State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'
  >('idle');
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  // 2. Active Filters & Sorting State
  const [filters, setFilters] = useState<CustomerParkingSearchParams>({
    vehicleType: 'All',
    sortBy: 'lowestPrice',
    sortOrder: 'asc',
    page: 1,
    limit: 10,
  });

  // 3. UI State
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [mobileViewTab, setMobileViewTab] = useState<'list' | 'map'>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 4. Data Fetching State
  const [parkingLots, setParkingLots] = useState<CustomerParkingLotResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resultsListRef = useRef<HTMLDivElement>(null);

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Request Browser Geolocation
  const handleRequestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationErrorMessage('Geolocation is not supported by your browser.');
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setLocationStatus('requesting');
    setLocationErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        setUserLocation(coords);
        setLocationStatus('granted');
        toast.success('Location detected! Nearby parking facilities updated.');

        setFilters((prev) => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude,
          sortBy: 'distance',
          sortOrder: 'asc',
          page: 1,
        }));
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setLocationErrorMessage('Location access was denied. You can still search by city or address.');
          toast.info('Location permission denied. Searching by city/address is still available.');
        } else {
          setLocationStatus('error');
          setLocationErrorMessage('Unable to retrieve your current location. Please try again.');
          toast.error('Unable to retrieve location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  // Fetch Parking Lots from Backend API
  const fetchParkingLots = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);

    try {
      const response = await searchCustomerParkingLots(filters);
      setParkingLots(response.parkingLots);
      setTotalResults(response.total);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);

      if (response.parkingLots.length > 0 && !selectedLotId) {
        setSelectedLotId(response.parkingLots[0]._id);
      }
    } catch (err: unknown) {
      setHasError(true);
      const msg = err instanceof Error ? err.message : 'Failed to search parking facilities.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [filters, selectedLotId]);

  useEffect(() => {
    let isMounted = true;

    searchCustomerParkingLots(filters)
      .then((response) => {
        if (!isMounted) return;
        setParkingLots(response.parkingLots);
        setTotalResults(response.total);
        setTotalPages(response.totalPages);
        setCurrentPage(response.page);
        if (response.parkingLots.length > 0 && !selectedLotId) {
          setSelectedLotId(response.parkingLots[0]._id);
        }
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setHasError(true);
        const msg = err instanceof Error ? err.message : 'Failed to search parking facilities.';
        setErrorMessage(msg);
        toast.error(msg);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filters, selectedLotId]);

  // Filter Update Handler
  const handleFilterChange = (updated: Partial<CustomerParkingSearchParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...updated,
      page: 1,
    }));
  };

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setFilters({
      vehicleType: 'All',
      sortBy: userLocation ? 'distance' : 'lowestPrice',
      sortOrder: 'asc',
      latitude: userLocation?.latitude,
      longitude: userLocation?.longitude,
      page: 1,
      limit: 10,
    });
  };

  // Card Selection Handler
  const handleSelectLot = (lot: CustomerParkingLotResult) => {
    setSelectedLotId(lot._id);
  };

  // Active Filter Count
  const activeFilterCount = [
    filters.vehicleType && filters.vehicleType !== 'All',
    filters.maxDistanceKm !== undefined,
    filters.minPrice !== undefined || filters.maxPrice !== undefined,
    filters.minRating !== undefined,
    Boolean(filters.coveredParking),
    Boolean(filters.evCharging),
    Boolean(filters.is24x7),
    Boolean(filters.openNow),
    filters.availability === 'Available',
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* 1. SAAS ELEVATED SEARCH HERO */}
      <div className="relative rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/90 to-background p-5 sm:p-7 shadow-xs">
        <div className="max-w-3xl space-y-2 mb-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3 w-3" /> Live Smart Parking Discovery
            </span>
            {locationStatus === 'granted' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" /> GPS Connected
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Find Your Next Parking Spot. <span className="text-primary">Instantly.</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Real-time occupancy across verified multi-level parking facilities. Reserve bays in advance, navigate seamlessly, and check in via QR code.
          </p>
        </div>

        {/* Location Notice Banner if Denied */}
        {locationStatus === 'denied' && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{locationErrorMessage}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocationStatus('idle')}
              className="h-6 px-2 text-[11px] text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Unified SaaS Search Capsule */}
        <div className="flex flex-col lg:flex-row items-center gap-3 bg-muted/40 p-2 sm:p-2.5 rounded-2xl border border-border/80 shadow-inner">
          {/* Destination Query Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by area, commercial hub, city or street address..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 pr-9 h-11 text-sm bg-card border-border/70 rounded-xl shadow-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Vehicle Type Segmented Pill */}
          <div className="flex items-center gap-1 bg-card/90 border border-border/70 p-1 rounded-xl w-full lg:w-auto shrink-0 justify-between sm:justify-start">
            {[
              { id: 'All', label: 'All', icon: Car },
              { id: 'Car', label: 'Car', icon: Car },
              { id: 'Bike', label: 'Bike', icon: Bike },
              { id: 'EV', label: 'EV', icon: Zap },
            ].map((v) => {
              const isSelected = (filters.vehicleType || 'All') === v.id;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleFilterChange({ vehicleType: v.id as 'All' | 'Car' | 'Bike' | 'EV' })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>

          {/* Location Trigger & Search Button */}
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={locationStatus === 'requesting'}
              onClick={handleRequestLocation}
              className={`h-11 px-3.5 rounded-xl text-xs font-semibold gap-1.5 bg-card border-border/70 shadow-xs shrink-0 ${
                locationStatus === 'granted'
                  ? 'text-emerald-600 border-emerald-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Use current location"
            >
              {locationStatus === 'requesting' ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <Compass className={`h-3.5 w-3.5 ${locationStatus === 'granted' ? 'text-emerald-500' : 'text-primary'}`} />
              )}
              <span className="hidden sm:inline">
                {locationStatus === 'granted' ? 'Location Active' : 'Near Me'}
              </span>
            </Button>
          </div>
        </div>

        {/* 2. QUICK FILTER CHIPS BAR */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto no-scrollbar text-xs">
          {/* Main Filter Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeFilterCount > 0
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-card border-border text-foreground hover:bg-muted/60'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>All Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* EV Charging Quick Chip */}
          <button
            type="button"
            onClick={() => handleFilterChange({ evCharging: filters.evCharging ? undefined : true })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              filters.evCharging
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Zap className="h-3 w-3 text-emerald-500" />
            <span>EV Charging</span>
          </button>

          {/* Covered Parking Quick Chip */}
          <button
            type="button"
            onClick={() => handleFilterChange({ coveredParking: filters.coveredParking ? undefined : true })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              filters.coveredParking
                ? 'bg-sky-500/15 border-sky-500 text-sky-700 dark:text-sky-400'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <ShieldCheck className="h-3 w-3 text-sky-500" />
            <span>Covered Parking</span>
          </button>

          {/* 24x7 Quick Chip */}
          <button
            type="button"
            onClick={() => handleFilterChange({ is24x7: filters.is24x7 ? undefined : true })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              filters.is24x7
                ? 'bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Clock className="h-3 w-3 text-indigo-500" />
            <span>24×7 Open</span>
          </button>

          {/* Open Right Now Quick Chip */}
          <button
            type="button"
            onClick={() => handleFilterChange({ openNow: filters.openNow ? undefined : true })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              filters.openNow
                ? 'bg-teal-500/15 border-teal-500 text-teal-700 dark:text-teal-400'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <CheckCircle2 className="h-3 w-3 text-teal-500" />
            <span>Open Now</span>
          </button>

          {/* Available Slots Only Quick Chip */}
          <button
            type="button"
            onClick={() => handleFilterChange({ availability: filters.availability === 'Available' ? 'All' : 'Available' })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              filters.availability === 'Available'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Available Spots Only</span>
          </button>

          {/* 4+ Stars Quick Chip */}
          <button
            type="button"
            onClick={() => handleFilterChange({ minRating: filters.minRating === 4 ? undefined : 4 })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              filters.minRating === 4
                ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span>4.0+ Stars</span>
          </button>

          {/* Under ₹50/hr Quick Chip */}
          <button
            type="button"
            onClick={() => handleFilterChange({ maxPrice: filters.maxPrice === 50 ? undefined : 50 })}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              filters.maxPrice === 50
                ? 'bg-primary/15 border-primary text-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <span>Under ₹50/hr</span>
          </button>

          {/* Reset Action */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-primary font-bold hover:underline shrink-0 ml-1 cursor-pointer"
            >
              Reset All
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Mobile/Desktop Filter Drawer if toggled */}
      {isSidebarOpen && (
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
          <SearchFiltersSidebar
            filters={filters}
            onFilterChange={(updated) => {
              handleFilterChange(updated);
            }}
            onResetFilters={() => {
              handleResetFilters();
              setIsSidebarOpen(false);
            }}
            hasUserLocation={Boolean(userLocation)}
            totalResults={totalResults}
          />
        </div>
      )}

      {/* 3. MAIN WORKSPACE: 2-COLUMN SPLIT (FEED + STICKY MAP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Results Feed & Sorter (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Feed Sub-Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 py-1">
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                {totalResults} {totalResults === 1 ? 'Parking Facility' : 'Parking Facilities'} Available
              </h2>
              <p className="text-xs text-muted-foreground">
                {debouncedSearch
                  ? `Showing results matching "${debouncedSearch}"`
                  : 'Displaying approved, live facilities with verified bay layouts'}
              </p>
            </div>

            {/* Sort Dropdown & View Mode Switcher */}
            <div className="flex items-center gap-2">
              <div className="w-48">
                <Select
                  value={filters.sortBy || 'lowestPrice'}
                  onValueChange={(val) =>
                    handleFilterChange({
                      sortBy: val as CustomerParkingSearchParams['sortBy'],
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs bg-card rounded-xl">
                    <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance" disabled={!userLocation}>
                      Nearest Distance
                    </SelectItem>
                    <SelectItem value="lowestPrice">Price: Low to High</SelectItem>
                    <SelectItem value="highestRated">Highest Rated (★)</SelectItem>
                    <SelectItem value="availableSlots">Most Spots Available</SelectItem>
                    <SelectItem value="occupancyPercentage">Least Crowded (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile View Toggle */}
              <div className="flex lg:hidden rounded-xl border border-border bg-muted/40 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileViewTab('list')}
                  className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    mobileViewTab === 'list'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="List View"
                >
                  <ListIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileViewTab('map')}
                  className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    mobileViewTab === 'map'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Map View"
                >
                  <MapIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Feed States */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border/70 rounded-2xl bg-card p-5 space-y-3">
                  <div className="flex gap-4">
                    <Skeleton className="w-56 h-36 rounded-xl shrink-0 hidden sm:block" />
                    <div className="flex-1 space-y-2.5">
                      <Skeleton className="h-5 w-3/4 rounded-md" />
                      <Skeleton className="h-4 w-1/2 rounded-md" />
                      <div className="flex gap-2 pt-2">
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <Skeleton className="h-5 w-24 rounded-md" />
                      </div>
                      <Skeleton className="h-8 w-full rounded-md pt-2" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : hasError ? (
            <Card className="border-destructive/30 rounded-2xl bg-destructive/5 text-center p-12 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  Unable to connect to parking directory
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {errorMessage || 'There was a network error fetching facilities.'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchParkingLots()}
                className="gap-2 text-xs rounded-xl"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Retry Search
              </Button>
            </Card>
          ) : parkingLots.length === 0 ? (
            <Card className="border-dashed border-border/80 rounded-3xl bg-card/40 text-center p-12 sm:p-16 space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                <Compass className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">No parking facilities found</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  We couldn&apos;t find any verified parking facilities matching your criteria. Try widening your search radius, selecting different vehicle types, or clearing filters.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="gap-1.5 text-xs font-bold rounded-xl"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Clear All Filters
                </Button>
              </div>
            </Card>
          ) : (
            <div
              ref={resultsListRef}
              className={`${mobileViewTab === 'map' ? 'hidden lg:block' : 'block'} space-y-4`}
            >
              {parkingLots.map((lot) => (
                <ParkingResultCard
                  key={lot._id}
                  parkingLot={lot}
                  isSelected={lot._id === selectedLotId}
                  onSelect={handleSelectLot}
                  onHover={(hoveredLot) => {
                    if (hoveredLot) setSelectedLotId(hoveredLot._id);
                  }}
                />
              ))}

              {/* Server-Side Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1 || isLoading}
                    onClick={() => handleFilterChange({ page: currentPage - 1 })}
                    className="gap-1 text-xs rounded-xl"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleFilterChange({ page: p })}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          p === currentPage
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages || isLoading}
                    onClick={() => handleFilterChange({ page: currentPage + 1 })}
                    className="gap-1 text-xs rounded-xl"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Full-Height Interactive Map (5 cols) */}
        <div
          className={`${
            mobileViewTab === 'list' ? 'hidden lg:block' : 'block'
          } lg:col-span-5 sticky top-20 h-[calc(100vh-140px)] min-h-[460px]`}
        >
          <ParkingSearchMap
            parkingLots={parkingLots}
            userLocation={userLocation}
            selectedLotId={selectedLotId}
            onSelectLot={handleSelectLot}
            onRequestUserLocation={handleRequestLocation}
            className="w-full h-full rounded-3xl border border-border/80 shadow-md"
          />
        </div>
      </div>
    </div>
  );
};
