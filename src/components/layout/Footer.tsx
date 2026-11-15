import * as React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FooterProps {
  variant?: 'public' | 'auth';
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ variant = 'public', className }) => {
  const currentYear = new Date().getFullYear();

  // 1. Auth Footer: Minimalist, clean, distraction-free
  if (variant === 'auth') {
    return (
      <footer
        data-slot="auth-footer"
        className={cn(
          'w-full border-t border-border/60 bg-background/60 px-6 py-4 text-center text-xs text-muted-foreground backdrop-blur-xs',
          className,
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-6">
          <span>&copy; {currentYear} ParkEase. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="transition-colors hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground hover:underline">
              Terms &amp; Conditions
            </Link>
            <Link to="/contact" className="transition-colors hover:text-foreground hover:underline">
              Support
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  // 2. Public Footer: Multi-column responsive layout per finalproject-5
  return (
    <footer
      data-slot="public-footer"
      className={cn(
        'w-full overflow-hidden border-t border-border/60 bg-background/90 text-foreground transition-colors',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="flex flex-col gap-4">
            <Link to="/" className="flex items-center transition-opacity hover:opacity-90">
              <img
                src="/brand/logo-light.png"
                alt="ParkEase"
                className="h-8 w-auto object-contain dark:hidden"
              />
              <img
                src="/brand/logo-dark.png"
                alt="ParkEase"
                className="hidden h-8 w-auto object-contain dark:block"
              />
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Smart parking made simple. Discover, reserve, and access verified parking spaces in
              real time with effortless QR entries and transparent rates.
            </p>
          </div>

          {/* Platform Links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Platform
            </h3>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link to="/" className="transition-colors hover:text-foreground">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="transition-colors hover:text-foreground">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/customer/search" className="transition-colors hover:text-foreground">
                  Search Parking
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="transition-colors hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/become-owner" className="transition-colors hover:text-foreground">
                  Become a Partner
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Support
            </h3>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link to="/faqs" className="transition-colors hover:text-foreground">
                  FAQs &amp; Help
                </Link>
              </li>
              <li>
                <Link to="/contact" className="transition-colors hover:text-foreground">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link
                  to="/owner/registration-status"
                  className="transition-colors hover:text-foreground"
                >
                  Registration Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Legal
            </h3>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link to="/privacy" className="transition-colors hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="transition-colors hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Official Contact Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Contact
            </h3>
            <div className="flex flex-col gap-2.5 text-xs text-muted-foreground">
              <a
                href="tel:+919099077378"
                className="inline-flex items-center gap-2 transition-colors hover:text-primary"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>+91 9099077378</span>
              </a>
              <a
                href="mailto:parkease@gmail.com"
                className="inline-flex items-center gap-2 transition-colors hover:text-primary"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>parkease@gmail.com</span>
              </a>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Support available for drivers, facility partners, and operations.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>&copy; {currentYear} ParkEase. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="transition-colors hover:text-foreground hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground hover:underline">
              Terms
            </Link>
            <Link to="/contact" className="transition-colors hover:text-foreground hover:underline">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
