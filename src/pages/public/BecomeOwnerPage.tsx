import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CreditCard,
  FileCheck,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const BecomeOwnerPage: React.FC = () => {
  const onboardingSteps = [
    {
      number: '01',
      title: 'Complete Registration Form',
      phase: 'Application Details',
      desc: 'Provide verified business details (Name, Entity Type, Address, City, State, PIN Code, Capacity, Description) and owner contact credentials (Full Name, Email, Mobile).',
      badge: 'Step 1',
    },
    {
      number: '02',
      title: 'Upload Business Documents',
      phase: 'Documentation',
      desc: 'Upload official verification files: Government ID Proof, Business Registration / License, Property Ownership or Rental Agreement, and Facility Photographs.',
      badge: 'Step 2',
    },
    {
      number: '03',
      title: 'Verify Email OTP',
      phase: 'Dual Verification',
      desc: 'A secure 6-digit verification code is sent to your registered email address. Valid for 5 minutes with a 30-second resend cooldown and maximum 3 attempts.',
      badge: 'Step 3',
    },
    {
      number: '04',
      title: 'Verify Mobile OTP',
      phase: 'Dual Verification',
      desc: 'Verify your +91 mobile number through a secondary OTP. Note for Version 1: the mobile verification code is also delivered to your registered email address.',
      badge: 'Step 4',
    },
    {
      number: '05',
      title: 'Pay ₹999 Platform Registration Fee',
      phase: 'Platform Onboarding',
      desc: 'Unlocked only after dual OTP verification. A one-time, non-refundable platform fee: Registration Fee ₹999 + Tax ₹0 = Total ₹999.',
      badge: 'Step 5',
    },
    {
      number: '06',
      title: 'Payment Verification',
      phase: 'Platform Onboarding',
      desc: 'Automated Razorpay checkout with server-side signature verification, payment logging, and instant generation of your payment receipt.',
      badge: 'Step 6',
    },
    {
      number: '07',
      title: 'Application Submitted',
      phase: 'Review Stage',
      desc: 'Your application and payment reference are officially submitted. Important: Successful payment confirms application receipt, not approval.',
      badge: 'Step 7',
    },
    {
      number: '08',
      title: 'Pending Administrator Approval',
      phase: 'Review Stage',
      desc: 'A ParkEase Administrator thoroughly audits your legal documents and facility parameters. The Owner Dashboard remains locked during review.',
      badge: 'Step 8',
    },
    {
      number: '09',
      title: 'Administrator Approval or Rejection',
      phase: 'Administrative Decision',
      desc: 'Approved applications become eligible for activation. If rejected, compliance remarks and specific reasons are displayed in the status tracker.',
      badge: 'Step 9',
    },
    {
      number: '10',
      title: 'Owner Account Activated',
      phase: 'Account Activation',
      desc: 'Following Administrator approval, your Parking Owner profile is officially provisioned in the ParkEase system.',
      badge: 'Step 10',
    },
    {
      number: '11',
      title: 'Owner Authentication',
      phase: 'Secure Sign-In',
      desc: 'Authenticate through the official passwordless OTP login system using your registered and verified email or mobile number.',
      badge: 'Step 11',
    },
    {
      number: '12',
      title: 'Owner Dashboard Access',
      phase: 'Live Operations',
      desc: 'Access your dedicated management portal to monitor assigned facilities, configure staff accounts, oversee live occupancy, and review earnings.',
      badge: 'Step 12',
    },
  ];

  const requirementsList = [
    {
      icon: Building2,
      title: 'Business Information',
      desc: 'Registered business name, entity type, facility address, city, state, PIN code, and total vehicle capacity.',
    },
    {
      icon: UserCheck,
      title: 'Owner Contact Details',
      desc: 'Authorized owner or representative full name, active email address, and 10-digit mobile number.',
    },
    {
      icon: FileCheck,
      title: 'Government ID Proof',
      desc: 'Valid government-issued identity document (Aadhaar, PAN card, Passport, or Voter ID).',
    },
    {
      icon: FileText,
      title: 'Business Registration / License',
      desc: 'Municipal trade license, shop & establishment certificate, or company incorporation certificate.',
    },
    {
      icon: ShieldCheck,
      title: 'Property Proof or Lease',
      desc: 'Official property ownership deed, electricity bill, or valid commercial lease/rental agreement.',
    },
    {
      icon: ImageIcon,
      title: 'Facility Photographs',
      desc: 'Clear visual photos of entry gates, exit lanes, parking bays, signage, and surface conditions.',
    },
    {
      icon: Mail,
      title: 'Verified Email Address',
      desc: 'Accessible email account to receive application notices, Email OTP, and Version 1 Mobile OTP.',
    },
    {
      icon: Smartphone,
      title: 'Registered Mobile Number',
      desc: 'Valid +91 Indian mobile number for administrative notifications, security alerts, and sign-in.',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card/80 via-card/50 to-background p-8 sm:p-12 lg:p-16">
        <div className="max-w-3xl space-y-5">
          <Badge
            variant="outline"
            className="border-primary/30 text-primary bg-primary/5 px-3 py-1 text-xs font-semibold"
          >
            Official Parking Owner Onboarding
          </Badge>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
            Become a Parking Partner
          </h1>

          <p className="text-base text-muted-foreground sm:text-lg md:text-xl leading-relaxed">
            Bring your parking facility to ParkEase and start your journey through a secure,
            review-based owner onboarding process. Transform physical parking space into a
            structured, digitally managed asset with real-time occupancy and automated operations.
          </p>

          <div className="pt-3 flex flex-col sm:flex-row flex-wrap gap-4">
            <Button size="lg" className="font-semibold shadow-sm" asChild>
              <Link to="/owner/register">
                Apply to Become a Parking Partner
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold" asChild>
              <Link to="/owner/registration-status">Track Registration Status</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            Have questions before starting?{' '}
            <Link to="/contact" className="text-primary underline hover:text-primary/80">
              Contact ParkEase Support
            </Link>{' '}
            or call{' '}
            <a href="tel:+919099077378" className="font-semibold text-foreground hover:underline">
              +91 9099077378
            </a>
            .
          </p>
        </div>
      </section>

      {/* 2. WHAT YOU'LL NEED SECTION */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-2">
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
            Prerequisites
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What You&apos;ll Need Before You Apply
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please prepare the following business information and verification documents to ensure a
            smooth and uninterrupted registration process.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {requirementsList.map((req, idx) => {
            const Icon = req.icon;
            return (
              <Card
                key={idx}
                className="border-border/80 bg-card hover:border-primary/40 transition-colors"
              >
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-semibold">{req.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{req.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 3. DOCUMENTED 12-STAGE ONBOARDING PROCESS */}
      <section className="space-y-10">
        <div className="max-w-3xl space-y-2">
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
            Full Lifecycle
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            The 12-Stage Onboarding Process
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every Parking Owner application follows this strict, documented lifecycle to guarantee
            legal compliance, vehicle security, and platform reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {onboardingSteps.map((step) => (
            <Card
              key={step.number}
              className="relative flex flex-col justify-between border-border/80 bg-card hover:border-primary/40 transition-all shadow-xs"
            >
              <CardHeader className="pb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-primary/70">{step.number}</span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium uppercase tracking-wider"
                  >
                    {step.phase}
                  </Badge>
                </div>
                <CardTitle className="text-base font-semibold leading-snug">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. REGISTRATION FEE & APPROVAL RULE CARD */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left: Fee Card (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="border-primary/30 bg-card shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="pb-4">
              <Badge
                variant="outline"
                className="w-fit border-primary/40 text-primary bg-primary/5 text-xs font-semibold"
              >
                Mandatory Platform Fee
              </Badge>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-black text-foreground">₹999</span>
                <span className="text-xs font-medium text-muted-foreground">one-time payment</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                One-time, non-refundable platform registration fee.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform Registration Fee</span>
                  <span className="font-semibold text-foreground">₹999</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Applicable Tax</span>
                  <span className="font-semibold text-foreground">₹0</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
                  <span>Total Amount Payable</span>
                  <span className="text-primary font-extrabold text-sm">₹999</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>Secure Razorpay test-mode checkout with signature verification.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Automated payment receipt generated instantly upon successful confirmation.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Mandatory Business Rules Alert (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          <Alert className="border-amber-500/30 bg-amber-500/5 text-foreground">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-sm font-bold text-amber-700 dark:text-amber-300">
              Mandatory Business Rules: Payment Does Not Equal Approval
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground mt-2 space-y-2 leading-relaxed">
              <p>
                <strong className="text-foreground">Payment Access Rule:</strong> The ₹999 platform
                registration payment becomes accessible <em>only</em> after the applicant has
                successfully completed both Email OTP and Mobile OTP verifications. Razorpay orders
                cannot be initiated before identity verification.
              </p>
              <p>
                <strong className="text-foreground">Review Requirement:</strong> Successful payment
                of the registration fee does <strong>not</strong> grant immediate access to the
                Owner Dashboard or activate the owner account. An application is submitted for
                comprehensive Administrator review upon payment.
              </p>
              <p>
                <strong className="text-foreground">Session Restriction:</strong> The Parking Owner
                shall not receive an authenticated Owner session or access the Owner Dashboard
                before formal Administrator approval.
              </p>
            </AlertDescription>
          </Alert>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">
                  Owner Onboarding vs. Parking Facility Setup
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Completing owner registration qualifies your organization as an accredited Parking
                Owner. However, official physical parking infrastructure — including Parking Lots,
                Floors, Zones, individual Parking Slots, and 2D spatial layouts — are created and
                structurally controlled in collaboration with platform Administrators. Registering
                as an owner does not immediately publish physical parking slots to drivers.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 5. WHAT HAPPENS AFTER YOU APPLY? */}
      <section className="space-y-6">
        <div className="max-w-2xl space-y-2">
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
            Post-Submission
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What Happens After You Apply?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Transparency is central to the ParkEase onboarding workflow. Here is how your
            application moves from submission to operational launch.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Stage 1
              </span>
              <CardTitle className="text-base font-semibold">Application Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You receive an official Application Reference ID and downloadable payment receipt.
                Your submission is placed in the Administrator review queue.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Stage 2
              </span>
              <CardTitle className="text-base font-semibold">Administrative Audit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Platform administrators inspect property ownership, trade licensing, fire/safety
                standards, and vehicle ingress/egress lanes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Stage 3
              </span>
              <CardTitle className="text-base font-semibold">Decision Notification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Receive formal notification of the outcome. If approved, your account becomes
                eligible for activation. If rejected, detailed remarks explain any discrepancies.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Stage 4
              </span>
              <CardTitle className="text-base font-semibold">Sign In &amp; Launch</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Once approved, sign in using passwordless OTP to access the Owner Dashboard, assign
                security personnel, and begin managing operations.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Already submitted an application?
            </h3>
            <p className="text-xs text-muted-foreground">
              Track your real-time review status using your Application Reference ID or registered
              mobile number.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/owner/registration-status">
              Track Registration Status
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* 6. PARTNER ADVANTAGES */}
      <section className="space-y-8">
        <div className="space-y-2">
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
            Operational Capabilities
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Built for Professional Parking Management
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="border-border/80 bg-card">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">Interactive 2D Bay Layouts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Collaborate with administrators to supervise multi-floor layouts, specialized EV
                bays, accessible parking slots, and designated entry/exit gates.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">Security Staff Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Provision gate security accounts with instant QR scanner tools for fast check-in,
                real-time barrier control, and vehicle arrival logging.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold">
                Live Turnover &amp; Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Monitor real-time bay occupancy, peak reservation trends, and net revenue breakdowns
                directly through your verified Owner Dashboard.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 7. SECONDARY SUPPORT SECTION */}
      <section className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Need Assistance Before Applying?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our partner operations team is available to assist with eligibility criteria, property
              documentation standards, and platform requirements.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs font-semibold">
              <a
                href="tel:+919099077378"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                +91 9099077378
              </a>
              <a
                href="mailto:parkease@gmail.com"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                parkease@gmail.com
              </a>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/contact">Contact Support</Link>
          </Button>
        </div>
      </section>

      {/* 8. CLOSING CTA BANNER */}
      <section className="rounded-3xl border border-border bg-gradient-to-b from-card to-background p-8 text-center sm:p-12 space-y-5">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
          Start Your Application
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          Ready to partner with ParkEase?
        </h2>
        <p className="max-w-xl mx-auto text-sm text-muted-foreground leading-relaxed">
          Begin your application to register your parking facility. Follow the 12-stage onboarding
          journey to become an accredited Parking Partner.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row justify-center gap-4">
          <Button size="lg" className="font-semibold shadow-sm" asChild>
            <Link to="/owner/register">
              Apply to Become a Parking Partner
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="font-semibold" asChild>
            <Link to="/owner/registration-status">Track Registration Status</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};
