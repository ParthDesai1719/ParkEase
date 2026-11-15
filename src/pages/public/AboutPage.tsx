import React from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  Building2,
  Shield,
  UserCog,
  Compass,
  QrCode,
  Bell,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const AboutPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16 sm:space-y-20">
      {/* 1. PAGE HEADER */}
      <div className="max-w-3xl space-y-4">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
          Company &amp; Mission
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          About ParkEase
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg leading-relaxed">
          ParkEase is a smart parking management and reservation platform designed to make parking
          easier for customers while helping parking facility owners manage their operations
          efficiently and transparently.
        </p>
      </div>

      {/* 2. PURPOSE & APPROACH */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-bold text-foreground">Our Purpose</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            In busy urban centers, locating a vacant parking spot consumes valuable time,
            contributes to road congestion, and creates unnecessary travel friction. Traditional
            parking lots often suffer from unpredictable queues, uncertain slot availability, and
            manual paper ticketing.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ParkEase was built to eliminate this uncertainty by creating a centralized, digital
            ecosystem connecting drivers seeking dependable spaces with facility owners looking to
            optimize their parking infrastructure.
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-bold text-foreground">Our Approach</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Rather than treating parking as an afterthought, ParkEase connects customers, parking
            facility owners, security staff, and platform administrators through dedicated,
            role-based workflows.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By digitizing the entire lifecycle—from pre-booking and automated navigation to QR-based
            gate validation and digital payments—we establish clear accountability, fair pricing,
            and predictable arrival experiences for everyone involved.
          </p>
        </div>
      </div>

      {/* 3. PLATFORM CAPABILITIES */}
      <div className="space-y-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Core Architecture
          </h2>
          <h3 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            What the Platform Delivers
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Parking Discovery</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Filter verified parking facilities by city, vehicle compatibility, operating hours,
                and distance from your destination.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/60">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Car className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Vehicle Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Register multiple personal or commercial vehicles (Car, Bike, SUV, EV) under one
                account to expedite slot reservations.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/60">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <QrCode className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">QR Access Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every reservation generates a cryptographically signed QR code used by gate staff to
                log punctual check-in and check-out timestamps.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/60">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Automated Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Receive timely status updates for booking confirmation, 15-minute expiry warnings,
                and overstay notices via email and in-app alerts.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/60">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Facility Oversight</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Empower parking owners with operational control over floor layouts, active slot
                availability, security staff scheduling, and revenue logs.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/60">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Audited Accountability</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Strict administrative oversight ensures every facility submission, layout
                publication, and staff action is logged in an immutable audit ledger.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. USER ROLES */}
      <div className="space-y-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Unified Ecosystem
          </h2>
          <h3 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Designed for Four Distinct Roles
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Car className="h-5 w-5" />
                <Badge variant="secondary">Customer</Badge>
              </div>
              <CardTitle className="mt-2 text-base font-semibold">
                Drivers &amp; Commuters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Search available facilities, book slots in advance, manage vehicles, receive booking
                QR passes, request parking extensions, and download digital invoices.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-5 w-5" />
                <Badge variant="secondary">Parking Owner</Badge>
              </div>
              <CardTitle className="mt-2 text-base font-semibold">Facility Partners</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Submit property applications, configure operating schedules, assign security staff,
                monitor real-time slot occupancy, and track earnings across lots.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="h-5 w-5" />
                <Badge variant="secondary">Security Staff</Badge>
              </div>
              <CardTitle className="mt-2 text-base font-semibold">Gate Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Scan customer QR codes at entry and exit points, perform manual vehicle lookups,
                handle walk-in parking registrations, and log security incidents.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary">
                <UserCog className="h-5 w-5" />
                <Badge variant="secondary">Administrator</Badge>
              </div>
              <CardTitle className="mt-2 text-base font-semibold">System Governors</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Review owner onboarding applications, design and validate official 2D parking
                layouts, activate facilities, supervise user roles, and inspect security audit logs.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5. CLOSING CTA */}
      <div className="rounded-2xl border border-border bg-card p-8 text-center sm:p-12 space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Parking should be easier.
        </h2>
        <p className="max-w-xl mx-auto text-sm text-muted-foreground sm:text-base leading-relaxed">
          ParkEase brings parking discovery, reservation, and facility management together in one
          seamless platform.
        </p>
        <div className="pt-2 flex justify-center gap-4">
          <Button asChild>
            <Link to="/customer/search">
              Find Parking Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contact">Contact Support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
