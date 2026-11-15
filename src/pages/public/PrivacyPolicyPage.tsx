import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
      {/* HEADER */}
      <div className="space-y-3">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
          Legal &amp; Trust
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Privacy Policy
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Effective Date: January 1, 2026 | Last Updated: September 2026
        </p>
      </div>

      {/* BODY CONTENT */}
      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        {/* Section 1 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">1. Introduction</h2>
          <p>
            Welcome to <strong>ParkEase</strong> (&quot;we,&quot; &quot;our,&quot; or &quot;the
            platform&quot;). ParkEase is a smart parking management and reservation system dedicated
            to simplifying vehicle parking for drivers while helping facility owners administer lot
            operations. This Privacy Policy describes how we collect, use, process, and protect your
            information when you access our website, web applications, and associated services.
          </p>
          <p>
            ParkEase uses the information strictly required to provide its parking, booking,
            authentication, and account-management functionality in accordance with documented
            platform architecture.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">2. Information We Collect</h2>
          <p>
            To deliver real-time parking discovery, reliable spot reservations, and gate validation,
            ParkEase collects personal and transactional information you provide directly through
            registration and booking flows.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            3. Account and Registration Information
          </h2>
          <p>
            When registering an account as a Customer or submitting a Parking Owner application, we
            collect:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Full Name</li>
            <li>Email Address</li>
            <li>Mobile Number (validated in Indian +91 format)</li>
            <li>Role assignment (Customer, Parking Owner, Security Staff, or Administrator)</li>
            <li>Profile preferences and notification settings</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">4. Vehicle Information</h2>
          <p>
            To assign appropriately sized parking bays and permit gate security to verify legitimate
            parking, we record vehicle details associated with your account:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Vehicle Registration Number (e.g., state plate code)</li>
            <li>Vehicle Classification (Bike, Car, SUV, EV)</li>
            <li>Vehicle Brand and Model (optional)</li>
            <li>Default vehicle preferences</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">5. Parking and Booking Information</h2>
          <p>
            When reservations are created, extended, or completed, the system generates and stores:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Booking identification number and QR pass payload</li>
            <li>Selected parking facility, floor, zone, and slot assignment</li>
            <li>Scheduled check-in time and reserved duration</li>
            <li>Actual entry and exit timestamps recorded at the gate</li>
            <li>Extension requests and applicable overstay calculations</li>
            <li>Booking cancellation and status logs</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            6. Authentication and OTP Information
          </h2>
          <p>ParkEase uses a secure, passwordless authentication architecture. When signing in:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              One-Time Passcodes (OTPs) are generated cryptographically and hashed before storage.
            </li>
            <li>
              OTPs have an immutable 5-minute validity window and a 30-second resend cooldown.
            </li>
            <li>
              Failed verification attempts are monitored (maximum 3 attempts per code) to guard
              against brute-force attacks.
            </li>
            <li>
              Successful logins generate short-lived JWT access tokens stored strictly in client
              memory.
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">7. Notifications and Communications</h2>
          <p>
            We send transactional notifications regarding your account and parking activities,
            including booking confirmations, payment receipts, 15-minute expiration alerts, and
            security alerts. You may adjust optional communication preferences in your profile
            settings.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">8. Payment-Related Information</h2>
          <p>
            Online reservation payments are processed through Razorpay (Test integration). ParkEase
            does not store sensitive credit card, debit card, or UPI credentials on its servers. We
            retain only the transaction reference ID, payment status (Pending, Success, Failed), and
            payment amount for accounting and receipt issuance.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">9. How Information Is Used</h2>
          <p>We process collected data exclusively to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Facilitate real-time parking discovery, reservations, and slot allocations.</li>
            <li>Authenticate user sessions and maintain role-based access control (RBAC).</li>
            <li>Provide contactless QR-based gate verification and checkout reconciliation.</li>
            <li>Generate itemized digital receipts and tax-compliant records.</li>
            <li>Maintain platform security and prevent unauthorized access or fraud.</li>
            <li>Review and verify parking facility owner registration applications.</li>
          </ul>
        </section>

        {/* Section 10 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">10. Data Security</h2>
          <p>
            We implement industry-standard technical safeguards, including HTTPS TLS encryption in
            transit, secure bcrypt hashing for OTP credentials, memory-only storage for access
            tokens, and HttpOnly Secure SameSite cookies for session refresh tokens. Internal
            administrative actions are recorded in an immutable audit log.
          </p>
        </section>

        {/* Section 11 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">11. Data Retention</h2>
          <p>
            Account and vehicle details are maintained for as long as your account remains active.
            Completed booking logs, receipts, and audit trail entries are retained for operational
            history and reporting purposes according to standard data retention schedules.
          </p>
        </section>

        {/* Section 12 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">12. Sharing of Information</h2>
          <p>
            ParkEase does not sell, lease, or monetize your personal information to third parties.
            Data is shared only with:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Assigned Parking Facilities &amp; Security Staff:</strong> Gate staff receive
              your vehicle number, booking pass ID, and slot assignment solely to permit entry and
              exit.
            </li>
            <li>
              <strong>Service Providers:</strong> Integrated transactional providers such as
              Razorpay (payments) and Nodemailer/SMTP (email delivery) to fulfill service
              operations.
            </li>
            <li>
              <strong>Legal Compliance:</strong> When required by lawful judicial or governmental
              request.
            </li>
          </ul>
        </section>

        {/* Section 13 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">13. User Choices and Rights</h2>
          <p>
            You have full control to view and update your personal information, manage registered
            vehicles, and inspect your complete reservation history directly through your Customer
            Dashboard. Contact support if you require assistance or wish to request account
            deletion.
          </p>
        </section>

        {/* Section 14 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">14. Cookies and Session Storage</h2>
          <p>
            ParkEase uses essential cookies and local browser storage strictly for system operation:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Refresh Token Cookie:</strong> A secure HttpOnly cookie used exclusively to
              refresh short-lived access tokens without exposing credentials to client-side scripts.
            </li>
            <li>
              <strong>Theme Preference:</strong> Local storage saves your preferred Light, Dark, or
              System visual theme across browser sessions.
            </li>
          </ul>
          <p>We do not use third-party tracking, advertising, or profiling cookies.</p>
        </section>

        {/* Section 15 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">15. Changes to This Privacy Policy</h2>
          <p>
            We may periodically update this Privacy Policy to reflect platform enhancements or
            regulatory changes. Material changes will be notified via our website or email
            notification.
          </p>
        </section>

        {/* Section 16 */}
        <section className="space-y-4 pt-4 border-t border-border/80">
          <h2 className="text-lg font-bold text-foreground">16. Contact and Support Information</h2>
          <p>
            If you have questions, feedback, or concerns regarding your privacy or data handling on
            ParkEase, please contact our support desk:
          </p>

          <Card className="border-border/80 bg-card/60">
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>
                  Phone Support:{' '}
                  <a
                    href="tel:+919099077378"
                    className="font-semibold text-primary hover:underline"
                  >
                    +91 9099077378
                  </a>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>
                  Email Support:{' '}
                  <a
                    href="mailto:parkease@gmail.com"
                    className="font-semibold text-primary hover:underline"
                  >
                    parkease@gmail.com
                  </a>
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};
