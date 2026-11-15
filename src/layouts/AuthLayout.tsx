import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

/**
 * AuthLayout:
 * Standard layout for authentication screens (/login, /register).
 * Adheres strictly to the ParkEase theme, brand assets, and responsive standards.
 * Uses dedicated AuthHeader (with ThemeToggle) and AuthFooter to keep the experience focused.
 */
export const AuthLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-transparent text-foreground">
      {/* Reusable Auth Header */}
      <Header variant="auth" />

      {/* Main Content Card Container */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm transition-all sm:p-8">
          <Outlet />
        </div>
      </main>

      {/* Reusable Auth Footer */}
      <Footer variant="auth" />
    </div>
  );
};
