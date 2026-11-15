import React, { useState } from 'react';
import {
  Activity,
  Car,
  Bike,
  Zap,
  RotateCw,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CustomerParkingLotResult } from '@/api/customerParking.api';

interface LiveAvailabilitySummaryProps {
  facility: CustomerParkingLotResult;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export const LiveAvailabilitySummary: React.FC<LiveAvailabilitySummaryProps> = ({
  facility,
  onRefresh,
  isRefreshing = false,
}) => {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const {
    totalSlots,
    availableSlots,
    occupiedSlots,
    reservedSlots,
    occupancyPercentage,
    vehicleAvailability,
    totalFloors,
  } = facility;

  const handleManualRefresh = async () => {
    if (onRefresh) {
      await onRefresh();
      setLastRefreshedAt(new Date());
    }
  };

  // Determine Occupancy Level
  let occupancyBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let occupancyBarColor = 'bg-emerald-500';
  let occupancyText = 'Low Occupancy';

  if (occupancyPercentage >= 80) {
    occupancyBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    occupancyBarColor = 'bg-rose-500';
    occupancyText = 'High Occupancy — Spots Filling Fast';
  } else if (occupancyPercentage >= 50) {
    occupancyBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    occupancyBarColor = 'bg-amber-500';
    occupancyText = 'Moderate Occupancy';
  }

  const vehicleStats = [
    {
      type: 'Car',
      icon: Car,
      color: 'text-blue-600 bg-blue-50 border-blue-200/60',
      available: vehicleAvailability?.car?.available ?? 0,
      total: vehicleAvailability?.car?.total ?? 0,
    },
    {
      type: 'Bike',
      icon: Bike,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200/60',
      available: vehicleAvailability?.bike?.available ?? 0,
      total: vehicleAvailability?.bike?.total ?? 0,
    },
    {
      type: 'SUV',
      icon: Car,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200/60',
      available: vehicleAvailability?.suv?.available ?? 0,
      total: vehicleAvailability?.suv?.total ?? 0,
    },
    {
      type: 'EV',
      icon: Zap,
      color: 'text-amber-600 bg-amber-50 border-amber-200/60',
      available: vehicleAvailability?.ev?.available ?? 0,
      total: vehicleAvailability?.ev?.total ?? 0,
    },
  ];

  const offeredVehicles = vehicleStats.filter((item) => item.total > 0);
  const unofferedVehicles = vehicleStats.filter((item) => item.total === 0);

  return (
    <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Header with Live Pulse and Refresh */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Live Slot Availability
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-full border-border/70 text-foreground">
              <Layers className="h-3 w-3 text-primary mr-1" />
              <span>{totalFloors} {totalFloors === 1 ? 'Floor' : 'Floors'}</span>
            </Badge>

            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
              >
                <RotateCw className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
                <span>Refresh</span>
              </Button>
            )}
          </div>
        </div>

        {/* 4 Big Slot Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Available Slots */}
          <div className="rounded-xl p-4 bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-xs font-bold uppercase tracking-wider">Available</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                {availableSlots}
              </span>
              <span className="text-xs text-emerald-700/80 font-medium ml-1">spots</span>
            </div>
          </div>

          {/* Occupied Slots */}
          <div className="rounded-xl p-4 bg-muted/60 border border-border/70 flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase tracking-wider">Occupied</span>
              <span className="h-2 w-2 rounded-full bg-slate-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                {occupiedSlots}
              </span>
              <span className="text-xs text-muted-foreground font-medium ml-1">spots</span>
            </div>
          </div>

          {/* Reserved Slots */}
          <div className="rounded-xl p-4 bg-amber-50/70 border border-amber-200/70 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-xs font-bold uppercase tracking-wider">Reserved</span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700">
                {reservedSlots}
              </span>
              <span className="text-xs text-amber-700/80 font-medium ml-1">spots</span>
            </div>
          </div>

          {/* Total Operational Capacity */}
          <div className="rounded-xl p-4 bg-primary/5 border border-primary/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-primary">
              <span className="text-xs font-bold uppercase tracking-wider">Total Capacity</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                {totalSlots}
              </span>
              <span className="text-xs text-primary/80 font-medium ml-1">bays</span>
            </div>
          </div>
        </div>

        {/* Live Occupancy Gauge Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Facility Occupancy Rate:</span>
              <Badge variant="outline" className={`font-semibold text-xs px-2 py-0.5 rounded-full ${occupancyBadgeColor}`}>
                {occupancyText}
              </Badge>
            </div>
            <span className="font-extrabold text-foreground">{occupancyPercentage}%</span>
          </div>

          {/* Bar track */}
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden p-0.5 border border-border/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ${occupancyBarColor}`}
              style={{ width: `${Math.min(100, Math.max(2, occupancyPercentage))}%` }}
            />
          </div>
        </div>

        {/* Vehicle-Type Breakdown Grid */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Offered Bays by Vehicle Type
            </h3>
            {offeredVehicles.length > 0 && (
              <span className="text-[11px] text-muted-foreground font-medium">
                {offeredVehicles.length} vehicle {offeredVehicles.length === 1 ? 'type' : 'types'} supported
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {vehicleStats.map((item) => {
              const Icon = item.icon;
              const isConfigured = item.total > 0;
              const isFull = isConfigured && item.available <= 0;

              return (
                <div
                  key={item.type}
                  className={`rounded-xl border p-3 flex items-center justify-between shadow-2xs ${
                    isConfigured
                      ? 'border-border/60 bg-card'
                      : 'border-dashed border-border/60 bg-muted/20 opacity-60 select-none cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center border ${
                        isConfigured ? item.color : 'bg-muted text-muted-foreground border-border/50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold block ${
                          isConfigured ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {isConfigured ? `${item.available} / ${item.total} free` : '0 bays'}
                      </span>
                    </div>
                  </div>

                  {isConfigured ? (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        !isFull
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {!isFull ? `${item.available} open` : 'Full'}
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/60">
                      Not Available
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Unoffered Vehicle Types clearly marked as Not Available */}
          {unofferedVehicles.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
              <span className="text-[11px] font-semibold text-foreground/70">
                Not Available:
              </span>
              {unofferedVehicles.map((u) => (
                <span
                  key={u.type}
                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-md border border-border/50"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{u.type === 'EV' ? 'EV Charging Bays' : `${u.type} Parking`} (Not Offered)</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
