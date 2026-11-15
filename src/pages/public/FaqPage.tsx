import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Mail, Phone, ShieldCheck, UserCheck } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const FaqPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
      {/* 1. HEADER */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
          Knowledge Base
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
          Find straightforward answers regarding driver reservations, passwordless authentication,
          facility onboarding, and operational workflows.
        </p>
      </div>

      {/* 2. FAQS BY CATEGORY */}
      <div className="space-y-10">
        {/* Category 1: Driver & Customer Experience */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/80 pb-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Driver &amp; Booking FAQs</h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is ParkEase?</AccordionTrigger>
              <AccordionContent>
                ParkEase is a full-stack smart parking management and reservation platform designed
                to connect drivers searching for parking spaces with parking owners managing private
                or commercial lots. It provides real-time slot visibility, contactless QR-based
                entry, and digital payment processing.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>How do I find parking?</AccordionTrigger>
              <AccordionContent>
                Navigate to &quot;Search Parking&quot; to search facilities by city, area, or
                landmark. You can filter results by supported vehicle types (Car, Bike, SUV, EV),
                amenities (covered parking, CCTV, EV charging), and hourly rates.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>How do I reserve a parking space?</AccordionTrigger>
              <AccordionContent>
                Once you select an available facility and your desired slot, choose your expected
                check-in time and booking duration. You can pay securely online using Razorpay (Test
                mode), after which a digital reservation confirmation and access QR pass are
                generated instantly.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>How do I manage my booking?</AccordionTrigger>
              <AccordionContent>
                All your active, completed, and cancelled bookings are stored in your Customer
                Dashboard under &quot;My Bookings&quot;. Here you can view directions, download GST
                receipts, request duration extensions, or cancel upcoming bookings according to
                facility cancellation rules.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>Can I manage multiple vehicles?</AccordionTrigger>
              <AccordionContent>
                Yes. Under your customer profile, you can register and save multiple vehicles (such
                as your family car, two-wheeler, or EV) with their vehicle numbers and default
                designations to streamline slot booking.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>How does QR-based parking access work?</AccordionTrigger>
              <AccordionContent>
                When you arrive at the facility gate, present the dynamic QR code from your booking
                pass to the on-site security staff. The staff scans your code to verify your booking
                and time-stamp your entry. The same QR code is scanned upon departure to record exit
                time.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger>
                What happens if my parking time needs to be extended?
              </AccordionTrigger>
              <AccordionContent>
                If your slot has not been reserved by another customer for the subsequent period,
                you can request an extension through your dashboard before your active session
                expires. Extension charges are calculated based on the additional hours requested.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger>What happens if I overstay my reserved duration?</AccordionTrigger>
              <AccordionContent>
                If you exceed your booked period without requesting an extension, the system
                calculates an overstay fee based on the extra time elapsed until your vehicle exit
                is logged by gate staff. Overstay charges ensure fair slot turnover for fellow
                drivers.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9">
              <AccordionTrigger>How will I receive notifications?</AccordionTrigger>
              <AccordionContent>
                ParkEase automatically sends transactional email notifications and in-app alerts for
                booking confirmations, 15-minute expiration warnings, payment receipts, and security
                check-ins.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Category 2: Passwordless Authentication */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/80 pb-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Authentication &amp; Security</h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="auth-1">
              <AccordionTrigger>How do I log in without a password?</AccordionTrigger>
              <AccordionContent>
                ParkEase uses a secure, passwordless authentication model. Simply enter your
                registered email address or mobile number (+91 format). The system generates a
                cryptographic 6-digit One-Time Passcode (OTP) delivered directly to you.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="auth-2">
              <AccordionTrigger>Where is my verification code delivered?</AccordionTrigger>
              <AccordionContent>
                Verification codes are dispatched to your registered email address associated with
                your account to ensure immediate and reliable delivery across all devices.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="auth-3">
              <AccordionTrigger>How long is an OTP valid?</AccordionTrigger>
              <AccordionContent>
                Each verification code is valid for exactly 5 minutes (300 seconds). If you do not
                enter the code within this timeframe, it expires automatically for your security.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="auth-4">
              <AccordionTrigger>Can I request another OTP if mine expires?</AccordionTrigger>
              <AccordionContent>
                Yes. If your code expires or is not received, a &quot;Resend Verification Code&quot;
                button becomes active after a 30-second cooldown period. Each session allows up to 3
                verification attempts.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Category 3: Facility Partners & Operations */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/80 pb-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              Facility Owners &amp; Security Operations
            </h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="partner-1">
              <AccordionTrigger>
                How can I become a parking facility owner on ParkEase?
              </AccordionTrigger>
              <AccordionContent>
                Visit the &quot;Become a Partner&quot; page and complete the owner registration
                application. Provide property ownership proof, address, business registration, and
                preliminary capacity details.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="partner-2">
              <AccordionTrigger>
                What happens after submitting an owner application?
              </AccordionTrigger>
              <AccordionContent>
                Platform administrators carefully review your property documentation and compliance
                details. Once approved, you receive access to the Parking Owner Dashboard where you
                can manage operating hours, assign staff, and collaborate with administrators to
                publish your official layout.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="partner-3">
              <AccordionTrigger>How can I check my application status?</AccordionTrigger>
              <AccordionContent>
                Visit the &quot;Registration Status&quot; page linked in the footer and header.
                Enter your application reference ID or mobile number to review real-time review
                progress (Submitted, Under Review, Approved, Changes Requested, or Rejected).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="partner-4">
              <AccordionTrigger>How do security staff handle walk-in drivers?</AccordionTrigger>
              <AccordionContent>
                Security personnel have dedicated dashboard access to log walk-in vehicles directly
                on-site, assigning an immediately available vacant slot and generating a temporary
                physical or digital pass.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* 3. CONTACT BANNER */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold text-foreground">Still have questions?</h3>
          <p className="text-xs text-muted-foreground">
            Our support team is available to assist drivers, facility owners, and security teams.
          </p>
          <div className="pt-2 flex flex-wrap gap-4 text-xs font-medium text-foreground justify-center sm:justify-start">
            <a
              href="tel:+919099077378"
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span>+91 9099077378</span>
            </a>
            <a
              href="mailto:parkease@gmail.com"
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-primary" />
              <span>parkease@gmail.com</span>
            </a>
          </div>
        </div>

        <Button asChild>
          <Link to="/contact">Get in Touch</Link>
        </Button>
      </div>
    </div>
  );
};
