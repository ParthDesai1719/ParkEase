import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

/**
 * PublicLayout:
 * Standard layout for public website pages (/about, /contact, /pricing, /faqs, /terms, /privacy).
 * Provides the sticky Public Header and multi-column responsive Public Footer.
 */
export const PublicLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-transparent text-foreground">
      <Header variant="public" />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer variant="public" />
    </div>
  );
};
