import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, CreditCard, Info, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const PricingPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16 sm:space-y-20">
      {/* 1. PAGE HEADER */}
      <div className="max-w-3xl space-y-4">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
          Transparent Rates
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Parking rates made clear.
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg leading-relaxed">
          At ParkEase, parking charges depend on the specific facility, your vehicle classification,
          and the duration of your stay. You always review the exact rates before confirming your
          booking.
        </p>
      </div>

      {/* 2. TRANSPARENT PRICING PILLARS */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Standard Booking</CardTitle>
              <p className="text-xs text-muted-foreground">Upfront per-hour charges</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every facility sets its hourly pricing per supported vehicle category (Bike, Car, SUV,
              EV). When you select your check-in time and duration, your total reservation cost is
              calculated automatically with no hidden surprise fees.
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Facility-specific hourly rates</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Vehicle-differentiated pricing</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Integrated digital payment with Razorpay</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Booking Extensions</CardTitle>
              <p className="text-xs text-muted-foreground">Add time before expiry</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Running late? If the slot remains available, you can extend your active reservation
              directly from your customer dashboard. Extension charges are calculated using the
              facility&apos;s hourly rate for the extra duration requested.
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>15-minute advance expiry reminder</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Seamless one-tap extension flow</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Updated digital QR exit pass</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="rounded-lg bg-destructive/10 p-2.5 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Overstay Policy</CardTitle>
              <p className="text-xs text-muted-foreground">Fair slot turnover rules</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              To ensure spots remain available for scheduled drivers, staying beyond your
              reservation window triggers overstay charges. Overstay fees are computed by the
              platform at checkout based on the additional elapsed time.
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span>Automated checkout time tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span>Disclosed in facility terms before booking</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span>Payable upon vehicle exit via QR</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 3. POLICY INFORMATION NOTICE */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="font-semibold text-foreground">How Facility Rates Work</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
          ParkEase does not charge recurring subscription fees or hidden service markups to drivers.
          All parking fees are established by individual approved facility owners and validated by
          platform administrators. You only pay for the reservations you make.
        </AlertDescription>
      </Alert>

      {/* 4. CLOSING CTA */}
      <div className="rounded-2xl border border-border bg-card p-8 text-center sm:p-12 space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Ready to explore parking near you?
        </h2>
        <p className="max-w-xl mx-auto text-sm text-muted-foreground leading-relaxed">
          Search facilities in your city to check live slot availability and verified hourly
          pricing.
        </p>
        <div className="pt-2 flex justify-center">
          <Button size="lg" className="gap-2 font-semibold" asChild>
            <Link to="/customer/search">
              Find Parking
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
