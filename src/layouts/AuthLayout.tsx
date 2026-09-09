import React from 'react';
import { Link, Outlet } from 'react-router-dom';

/**
 * AuthLayout:
 * Standard layout for authentication screens (/login, /register).
 * Adheres strictly to the ParkEase theme, brand assets, and responsive standards.
 */
export const AuthLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-background text-foreground">
      {/* Brand Header */}
      <header className="flex w-full items-center justify-between px-6 py-4 border-b border-border/60">
        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <img
            src="/brand/icon-dark.png"
            alt="ParkEase"
            className="h-9 w-9 rounded-md object-contain dark:hidden"
          />
          <img
            src="/brand/icon-light.png"
            alt="ParkEase"
            className="hidden h-9 w-9 rounded-md object-contain dark:block"
          />
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-foreground">
              Park<span className="text-primary">Ease</span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Smart Parking
            </span>
          </div>
        </Link>
      </header>

      {/* Main Content Card Container */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm transition-all sm:p-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/60 px-6 py-4 text-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-6">
          <span>&copy; 2026 ParkEase. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground hover:underline">
              Terms &amp; Conditions
            </Link>
            <Link to="/contact" className="hover:text-foreground hover:underline">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
