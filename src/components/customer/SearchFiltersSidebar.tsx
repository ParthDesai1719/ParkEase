import React from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  ShieldCheck,
  Zap,
  Clock,
  Car,
  Bike,
  Compass,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { CustomerParkingSearchParams } from '@/api/customerParking.api';

interface SearchFiltersSidebarProps {
  filters: CustomerParkingSearchParams;
  onFilterChange: (updated: Partial<CustomerParkingSearchParams>) => void;
  onResetFilters: () => void;
  hasUserLocation: boolean;
  totalResults: number;
}

const VEHICLE_TYPES = [
  { id: 'All', label: 'All', icon: Car },
  { id: 'Car', label: 'Car', icon: Car },
  { id: 'Bike', label: 'Bike', icon: Bike },
  { id: 'SUV', label: 'SUV', icon: Car },
  { id: 'EV', label: 'EV', icon: Zap },
] as const;

const DISTANCE_OPTIONS = [
  { label: 'Any', value: undefined },
  { label: '< 2 km', value: 2 },
  { label: '< 5 km', value: 5 },
  { label: '< 10 km', value: 10 },
  { label: '< 25 km', value: 25 },
  { label: '< 50 km', value: 50 },
];

const RATING_OPTIONS = [
  { label: 'Any', value: undefined },
  { label: '3.0+ ★', value: 3 },
  { label: '4.0+ ★', value: 4 },
  { label: '4.5+ ★', value: 4.5 },
];

export const SearchFiltersSidebar: React.FC<SearchFiltersSidebarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  hasUserLocation,
  totalResults,
}) => {
  const activeCount = [
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
    <Card className="border-border/80 bg-card/95 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold tracking-tight text-foreground">
              Filter Options
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">{totalResults} facilities found</p>
          </div>
        </div>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-7 px-2 text-xs text-primary font-semibold hover:bg-primary/10 gap-1 rounded-lg"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </Button>
        )}
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-5 text-xs">
        {/* 1. VEHICLE TYPE */}
        <div className="space-y-2">
          <label className="font-bold text-foreground flex items-center justify-between">
            <span>Vehicle Type</span>
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-medium border-border/80">
              {filters.vehicleType || 'All'}
            </Badge>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {VEHICLE_TYPES.map((v) => {
              const isSelected = (filters.vehicleType || 'All') === v.id;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onFilterChange({ vehicleType: v.id })}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* 2. PROXIMITY & DISTANCE */}
        <div className="space-y-2">
          <label className="font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-primary" />
              Distance Radius
            </span>
            {!hasUserLocation && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                Needs GPS
              </span>
            )}
          </label>

          <div className="grid grid-cols-3 gap-1.5">
            {DISTANCE_OPTIONS.map((opt, idx) => {
              const isSelected = filters.maxDistanceKm === opt.value;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!hasUserLocation && opt.value !== undefined}
                  onClick={() => onFilterChange({ maxDistanceKm: opt.value })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors text-center ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground'
                  } ${!hasUserLocation && opt.value !== undefined ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* 3. PRICE RANGE */}
        <div className="space-y-2">
          <label className="font-bold text-foreground flex items-center justify-between">
            <span>Hourly Rate</span>
            <span className="text-[11px] text-muted-foreground font-semibold">
              {filters.maxPrice ? `Up to ₹${filters.maxPrice}/hr` : 'Any Price'}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min ₹"
              min={0}
              max={500}
              value={filters.minPrice ?? ''}
              onChange={(e) =>
                onFilterChange({
                  minPrice: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-muted-foreground text-xs font-semibold">-</span>
            <input
              type="number"
              placeholder="Max ₹"
              min={0}
              max={1000}
              value={filters.maxPrice ?? ''}
              onChange={(e) =>
                onFilterChange({
                  maxPrice: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <Separator />

        {/* 4. MINIMUM RATING */}
        <div className="space-y-2">
          <label className="font-bold text-foreground flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            Customer Rating
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {RATING_OPTIONS.map((opt, idx) => {
              const isSelected = filters.minRating === opt.value;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onFilterChange({ minRating: opt.value })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors text-center cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* 5. FACILITY AMENITIES & FEATURES */}
        <div className="space-y-2.5">
          <label className="font-bold text-foreground">Facility Features</label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={Boolean(filters.coveredParking)}
              onChange={(e) => onFilterChange({ coveredParking: e.target.checked ? true : undefined })}
              className="rounded-md border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
              Covered Parking
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={Boolean(filters.evCharging)}
              onChange={(e) => onFilterChange({ evCharging: e.target.checked ? true : undefined })}
              className="rounded-md border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              EV Fast Charging
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={Boolean(filters.is24x7)}
              onChange={(e) => onFilterChange({ is24x7: e.target.checked ? true : undefined })}
              className="rounded-md border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              24×7 Availability
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={Boolean(filters.openNow)}
              onChange={(e) => onFilterChange({ openNow: e.target.checked ? true : undefined })}
              className="rounded-md border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
              Open Right Now
            </span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={filters.availability === 'Available'}
              onChange={(e) =>
                onFilterChange({ availability: e.target.checked ? 'Available' : 'All' })
              }
              className="rounded-md border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Available Slots Only
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
};
