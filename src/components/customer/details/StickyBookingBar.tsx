import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CustomerParkingLotResult } from '@/api/customerParking.api';

interface StickyBookingBarProps {
  facility: CustomerParkingLotResult;
}

export const StickyBookingBar: React.FC<StickyBookingBarProps> = ({ facility }) => {
  const {
    _id,
    hourlyRate,
    availableSlots,
    gracePeriodMinutes,
    pricing,
  } = facility;

  const carRate = pricing?.carHourlyRate ?? hourlyRate;
  const isAvailable = availableSlots > 0;

  return (
    <>
      {/* 1. Desktop Sticky Right Sidebar Card */}
      <div className="hidden lg:block sticky top-24 space-y-4">
        <Card className="rounded-2xl border-border/80 shadow-md bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500/10 via-primary/5 to-transparent p-5 pb-4 border-b border-border/40">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Starting From
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black text-foreground">
                    ₹{carRate}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    / hour
                  </span>
                </div>
              </div>

              <Badge
                variant="outline"
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isAvailable
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {isAvailable ? `${availableSlots} spots free` : 'Sold Out'}
              </Badge>
            </div>
          </div>

          <CardContent className="p-5 space-y-4">
            {/* Highlights List */}
            <div className="space-y-2 text-xs text-foreground/80">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{gracePeriodMinutes} min</strong> free grace period on arrival
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Instant QR pass confirmation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>2D Layout visual spot selection</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span>Guaranteed reserved bay upon booking</span>
              </div>
            </div>

            {/* Main Primary Booking CTA */}
            <Button
              asChild
              disabled={!isAvailable}
              className="w-full h-12 text-sm font-bold rounded-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/25 cursor-pointer"
            >
              <Link to={`/customer/parking/${_id}/book`}>
                <Sparkles className="h-4 w-4 text-primary-foreground/90" />
                <span>{isAvailable ? 'Book Parking Spot' : 'Facility Full'}</span>
                <ArrowRight className="h-4 w-4 ml-0.5" />
              </Link>
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              Select your vehicle bay on the 2D layout in the next step.
            </p>
          </CardContent>
        </Card>

        {/* Security & Support Guarantee Card */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground font-bold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>ParkEase Verified Guarantee</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Every booking is backed by live on-site barrier sync. If you encounter any arrival issue, our 24/7 support line will assist you immediately.
          </p>
        </div>
      </div>

      {/* 2. Mobile Bottom Fixed Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/80 px-4 py-3 shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-foreground">₹{carRate}</span>
              <span className="text-xs text-muted-foreground font-medium">/hr</span>
            </div>
            <span
              className={`text-[11px] font-bold block ${
                isAvailable ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {isAvailable ? `● ${availableSlots} spots available` : '● Fully booked'}
            </span>
          </div>

          <Button
            asChild
            disabled={!isAvailable}
            className="h-11 px-6 text-sm font-bold rounded-xl gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/30"
          >
            <Link to={`/customer/parking/${_id}/book`}>
              <span>{isAvailable ? 'Book Spot' : 'Sold Out'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
};
