import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SplashScreen } from '@/components/common/SplashScreen';

export const HomePage: React.FC = () => {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('parkease_splash_shown');
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('parkease_splash_shown', 'true');
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <div className="flex flex-col gap-16 pb-16 sm:gap-24 sm:pb-24">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <Badge
              variant="outline"
              className="mb-4 gap-1.5 border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary font-medium"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Smart Parking Management &amp; Reservation Platform
            </Badge>

            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:leading-tight">
              Parking made simple.
            </h1>

            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl leading-relaxed">
              Discover, reserve, and access parking spaces in real time with ParkEase. Eliminate the
              guesswork of city parking with instant reservations and seamless QR check-ins.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button
                size="lg"
                className="gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 font-semibold"
                asChild
              >
                <Link to="/customer/search">
                  Find Parking
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button size="lg" variant="outline" className="font-semibold" asChild>
                <Link to="/become-owner">Become a Parking Partner</Link>
              </Button>
            </div>

            {/* Visual Hero Mockup Banner */}
            <div className="mt-12 w-full max-w-4xl rounded-2xl border border-border/80 bg-card p-4 shadow-xl sm:p-6 backdrop-blur-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 p-4 text-left">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Verified Lots</h2>
                    <p className="text-xs text-muted-foreground">
                      Officially surveyed parking layouts
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 p-4 text-left">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Real-Time Slots</h2>
                    <p className="text-xs text-muted-foreground">
                      Up-to-the-minute spot availability
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 p-4 text-left">
                  <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Contactless Entry</h2>
                    <p className="text-xs text-muted-foreground">
                      Scan QR code at entry and exit gates
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW PARKEASE WORKS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Simple Workflow
          </h2>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How ParkEase works
          </h3>
          <p className="mt-3 max-w-2xl mx-auto text-sm text-muted-foreground sm:text-base">
            From search to spot, follow five straightforward steps to a guaranteed parking spot.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              step: '1',
              title: 'Find a Facility',
              desc: 'Search by city, landmark, or facility name to see verified parking lots near your destination.',
            },
            {
              step: '2',
              title: 'Choose Your Spot',
              desc: 'Select suitable options based on supported vehicle types (Car, Bike, SUV, EV) and rates.',
            },
            {
              step: '3',
              title: 'Make a Reservation',
              desc: 'Pick your check-in time and duration, then complete transparent payment via Razorpay.',
            },
            {
              step: '4',
              title: 'Access the Facility',
              desc: 'Arrive at the gate and present your digital booking QR code to security staff for swift entry.',
            },
            {
              step: '5',
              title: 'Manage Bookings',
              desc: 'Request extensions if your plans change, track receipts, and review past visits easily.',
            },
          ].map((item) => (
            <Card key={item.step} className="relative overflow-hidden border-border/80 bg-card/60">
              <div className="absolute top-3 right-3 text-3xl font-black text-muted-foreground/15">
                {item.step}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. PLATFORM FEATURES */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Core Capabilities
          </h2>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for modern parking needs
          </h3>
          <p className="mt-3 max-w-2xl mx-auto text-sm text-muted-foreground sm:text-base">
            Everything you need for dependable parking management in one integrated platform.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">Find Parking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Discover available parking facilities and choose a space that fits your exact
                vehicle dimensions and destination requirements.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">Reserve in Advance</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Reserve your parking space before you arrive to eliminate circling congested blocks
                and make your daily commute predictable.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <QrCode className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">QR-Based Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Use your digital booking pass and verified QR code for a contactless check-in and
                check-out process managed by trained security staff.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">Real-Time Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                View dynamic parking capacity updates and make informed decisions backed by
                real-time lot occupancy tracking.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">Transparent Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Understand applicable parking fees upfront before confirming your booking. Clear
                per-hour pricing with no hidden surcharges.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">Easy Booking Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                Keep track of active reservations, download GST receipts, view navigation
                directions, and review parking history from a unified customer dashboard.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 4. CUSTOMER VALUE & OWNER SECTION */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Customer Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 sm:p-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="text-xs">
                For Drivers
              </Badge>
              <h3 className="text-2xl font-bold text-foreground">Save time on every trip</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Whether commuting for work, heading to an event, or managing everyday errands,
                ParkEase gives you guaranteed parking spaces with digital receipts and live
                navigation guidance.
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Passwordless, secure one-time passcode (OTP) sign-in</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Register multiple vehicles (Car, Bike, SUV, EV)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Instant notifications and digital receipt downloads</span>
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button asChild>
                <Link to="/customer/search">Explore Available Parking</Link>
              </Button>
            </div>
          </div>

          {/* Owner Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-6 sm:p-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="text-xs">
                For Facility Owners
              </Badge>
              <h3 className="text-2xl font-bold text-foreground">Monetize your parking facility</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Bring your commercial, residential, or private parking facility onto ParkEase.
                Manage operational slots, monitor incoming bookings, oversee security staff, and
                track revenue.
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>Structured onboarding with administrative review &amp; verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Official 2D layout survey and floor/zone slot mapping</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>
                    Dedicated owner dashboard for real-time analytics &amp; staff supervision
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-8">
              <Button variant="outline" asChild>
                <Link to="/become-owner">Apply as Parking Partner</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CLOSING CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to make parking easier?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Find your next parking space with ParkEase and arrive with complete peace of mind.
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              asChild
            >
              <Link to="/customer/search">Search Parking</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
