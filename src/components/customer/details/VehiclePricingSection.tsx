import React from 'react';
import {
  Car,
  Bike,
  Zap,
  Moon,
  Sun,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CustomerParkingLotResult } from '@/api/customerParking.api';

interface VehiclePricingSectionProps {
  facility: CustomerParkingLotResult;
}

export const VehiclePricingSection: React.FC<VehiclePricingSectionProps> = ({
  facility,
}) => {
  const { hourlyRate, gracePeriodMinutes, pricing, vehicleAvailability } = facility;

  const carRate = pricing?.carHourlyRate && pricing.carHourlyRate > 0 ? pricing.carHourlyRate : hourlyRate;
  const suvRate = pricing?.suvHourlyRate && pricing.suvHourlyRate > 0 ? pricing.suvHourlyRate : carRate;
  const bikeRate =
    pricing?.bikeHourlyRate && pricing.bikeHourlyRate > 0
      ? pricing.bikeHourlyRate
      : Math.max(10, Math.round(carRate * 0.5));
  const dailyRate = pricing?.dailyRate && pricing.dailyRate > 0 ? pricing.dailyRate : carRate * 8;
  const overnightRate =
    pricing?.overnightRate && pricing.overnightRate > 0 ? pricing.overnightRate : carRate * 10;
  const evRate =
    pricing?.evChargingRatePerHour && pricing.evChargingRatePerHour > 0
      ? pricing.evChargingRatePerHour
      : carRate;
  const graceMinutes = pricing?.gracePeriodMinutes ?? gracePeriodMinutes;
  const minDuration = pricing?.minParkingDurationHours ?? 1;
  const maxDuration = pricing?.maxParkingDurationHours ?? 24;
  const notes = pricing?.additionalPricingNotes;

  const isCarOffered = (vehicleAvailability?.car?.total ?? 0) > 0;
  const isSuvOffered = (vehicleAvailability?.suv?.total ?? 0) > 0;
  const isBikeOffered = (vehicleAvailability?.bike?.total ?? 0) > 0;
  const isEvOffered = (vehicleAvailability?.ev?.total ?? 0) > 0;

  // Fallback: if no vehicle availability breakdowns exist, allow standard car
  const hasAnyBreakdown = isCarOffered || isSuvOffered || isBikeOffered || isEvOffered;

  const vehicleRates = [
    {
      vehicle: 'Car / Hatchback / Sedan',
      badge: 'Most Popular',
      rate: carRate,
      icon: Car,
      unit: '/ hour',
      desc: 'Standard passenger vehicles and compact cars',
      isOffered: hasAnyBreakdown ? isCarOffered : true,
    },
    {
      vehicle: 'SUV / MUV / Van',
      rate: suvRate,
      icon: Car,
      unit: '/ hour',
      desc: 'Larger vehicles, full-size SUVs, and family vans',
      isOffered: hasAnyBreakdown ? isSuvOffered : false,
    },
    {
      vehicle: 'Motorcycle / Scooter',
      rate: bikeRate,
      icon: Bike,
      unit: '/ hour',
      desc: 'Two-wheelers with dedicated paved bays',
      isOffered: hasAnyBreakdown ? isBikeOffered : false,
    },
    {
      vehicle: 'Electric Vehicle (EV)',
      rate: evRate,
      icon: Zap,
      unit: '/ hour',
      desc: isEvOffered
        ? 'Dedicated EV parking bays with charging access'
        : 'Electric vehicle charging bays are not available at this facility',
      isOffered: isEvOffered,
    },
  ];

  return (
    <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Vehicle Types & Rates
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clear, transparent pricing approved by ParkEase. No surge or hidden checkout fees.
            </p>
          </div>

          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full gap-1"
          >
            <CheckCircle className="h-3 w-3 text-emerald-600" />
            <span>{graceMinutes} min Free Grace Period</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Vehicle Hourly Rates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vehicleRates.map((item) => {
            const Icon = item.icon;
            const isAvailable = item.isOffered;

            return (
              <div
                key={item.vehicle}
                className={`relative rounded-xl border p-4 flex flex-col justify-between transition-all ${
                  isAvailable
                    ? 'border-border/70 bg-card hover:border-primary/40 hover:shadow-xs group'
                    : 'border-dashed border-border/60 bg-muted/20 opacity-60 select-none cursor-not-allowed'
                }`}
              >
                {isAvailable && item.badge && (
                  <Badge className="absolute -top-2.5 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                    {item.badge}
                  </Badge>
                )}
                {!isAvailable && (
                  <Badge
                    variant="outline"
                    className="absolute -top-2.5 right-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  >
                    Not Available
                  </Badge>
                )}

                <div className="flex items-start gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                      isAvailable
                        ? 'bg-primary/10 text-primary group-hover:scale-105'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-bold ${
                        isAvailable ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {item.vehicle}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Standard Rate</span>
                  <div className="text-right">
                    {isAvailable ? (
                      <>
                        <span className="text-xl font-extrabold text-foreground">
                          ₹{item.rate}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium ml-0.5">
                          {item.unit}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground bg-muted/70 px-2 py-1 rounded border border-border/60">
                        Not Available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily & Overnight Passes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Full-Day Pass (24h)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Unlimited in & out during operating hours
                </span>
              </div>
            </div>
            <span className="text-base font-extrabold text-foreground">
              ₹{dailyRate}
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center">
                <Moon className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Overnight Parking
                </span>
                <span className="text-[11px] text-muted-foreground">
                  8:00 PM to 8:00 AM secure parking
                </span>
              </div>
            </div>
            <span className="text-base font-extrabold text-foreground">
              ₹{overnightRate}
            </span>
          </div>
        </div>

        {/* Pricing Policies & Footnote */}
        <div className="rounded-xl bg-orange-50/50 border border-orange-200/60 p-3.5 flex items-start gap-2.5 text-xs text-foreground/80">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Pricing Guidelines & Billing Rules:
            </p>
            <p className="text-muted-foreground">
              • Minimum parking reservation duration is {minDuration} hour; maximum continuous duration is {maxDuration} hours.
            </p>
            <p className="text-muted-foreground">
              • {graceMinutes} minutes complimentary grace period permitted before entry billing commences.
            </p>
            {notes && (
              <p className="text-muted-foreground">
                • {notes}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
