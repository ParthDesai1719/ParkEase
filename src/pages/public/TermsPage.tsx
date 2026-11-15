import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const TermsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
      {/* HEADER */}
      <div className="space-y-3">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
          Agreement
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Terms of Service
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Effective Date: January 1, 2026 | Last Updated: September 2026
        </p>
      </div>

      {/* BODY CONTENT */}
      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        {/* Section 1 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the{' '}
            <strong>ParkEase</strong> platform, including our website, mobile interfaces, booking
            engines, and operational tools. By registering an account, reserving a parking space, or
            using our services, you acknowledge that you have read, understood, and agreed to be
            bound by these Terms.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">2. Using ParkEase</h2>
          <p>
            ParkEase operates as an integrated software intermediary connecting drivers seeking
            parking accommodations with verified parking facility owners and security gate
            operators. You agree to use ParkEase strictly in accordance with applicable municipal
            laws, facility rules, and safe driving practices.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            3. Customer Accounts &amp; Verification
          </h2>
          <p>
            To access booking services, customers must register with valid identification
            credentials, including their full name, email address, and an Indian mobile number
            (+91). Authentication is executed via One-Time Passcodes (OTPs). You are responsible for
            maintaining the confidentiality of your verification credentials and for all activities
            initiated through your account.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">4. Vehicle Information Accuracy</h2>
          <p>
            You agree to provide true, accurate vehicle registration numbers and correct vehicle
            types (Bike, Car, SUV, EV). Providing false or mismatched vehicle information may result
            in gate refusal by security staff without refund eligibility.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            5. Parking Reservations &amp; Check-In
          </h2>
          <p>
            A confirmed reservation guarantees access to a designated slot classification at the
            specified facility for the reserved duration. Drivers must arrive within the permitted
            check-in window and display their active booking pass and digital QR code to security
            personnel upon arrival.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            6. Parking Facility Availability &amp; Layouts
          </h2>
          <p>
            Official parking lot capacities, zones, floors, and 2D layouts are reviewed, validated,
            and structurally controlled by platform administrators. Real-time availability reflects
            current lot telemetry and verified bookings.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">7. Parking Charges &amp; Payments</h2>
          <p>
            Applicable rates are established by approved parking facility owners and displayed
            upfront prior to reservation confirmation. Online payments are conducted via our
            integrated payment gateway (Razorpay). An itemized digital invoice is generated upon
            successful payment.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">8. Extensions and Overstay Charges</h2>
          <p>
            Customers may request duration extensions prior to booking expiration if the slot
            remains unoccupied by upcoming bookings. If a vehicle remains in a facility past its
            authorized departure time without an approved extension, automated overstay charges will
            apply according to facility business rules and must be settled prior to or upon exit.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            9. QR-Based Access &amp; Gate Protocols
          </h2>
          <p>
            Entry and exit events require scanning the booking QR code by facility security staff.
            In the event of device failure or camera issues, security personnel may perform manual
            lookups using your registered vehicle number.
          </p>
        </section>

        {/* Section 10 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            10. Parking Facility Owner Responsibilities
          </h2>
          <p>
            Facility owners warrant that their properties comply with local zoning, fire safety, and
            municipal permits. Owners must maintain facility cleanliness, functional lighting, clear
            floor signage, and accurate operational schedules.
          </p>
        </section>

        {/* Section 11 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            11. Security and Operational Staff Conduct
          </h2>
          <p>
            Security personnel must conduct themselves professionally, verify digital credentials
            objectively, assist drivers with bay orientation, and report any physical or vehicle
            incidents through the platform&apos;s incident management tool.
          </p>
        </section>

        {/* Section 12 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">12. Prohibited Use</h2>
          <p>Users shall not:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Interfere with platform infrastructure or reverse-engineer booking APIs.</li>
            <li>Submit fraudulent, expired, or manipulated QR codes.</li>
            <li>
              Park unauthorized or hazardous vehicles carrying combustible or illegal materials.
            </li>
            <li>Double-park, obstruct driveways, or ignore facility safety instructions.</li>
          </ul>
        </section>

        {/* Section 13 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">13. Service Availability</h2>
          <p>
            While we strive for high service uptime, ParkEase does not warrant that services will be
            uninterrupted or error-free during scheduled maintenance, system upgrades, or network
            outages.
          </p>
        </section>

        {/* Section 14 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">14. Limitation of Liability</h2>
          <p>
            ParkEase operates as an enabling technology platform. Drivers park their vehicles at
            their own risk. To the maximum extent permitted by law, ParkEase shall not be liable for
            vehicle theft, accidental scratches, natural weather damage, or personal property left
            inside vehicles within partner lots.
          </p>
        </section>

        {/* Section 15 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">
            15. Changes to the Service &amp; Terms
          </h2>
          <p>
            We reserve the right to modify these Terms and platform features at any time. Continued
            use of the platform following updates constitutes acceptance of the modified Terms.
          </p>
        </section>

        {/* Section 16 */}
        <section className="space-y-4 pt-4 border-t border-border/80">
          <h2 className="text-lg font-bold text-foreground">16. Contact and Support Information</h2>
          <p>
            For legal notices, service clarifications, or support inquiries regarding these Terms,
            please contact:
          </p>

          <Card className="border-border/80 bg-card/60">
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>
                  Phone:{' '}
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
                  Email:{' '}
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
