import React from 'react';
import { createBrowserRouter, Link, Outlet } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthLayout } from '../layouts/AuthLayout';

// Lightweight foundation placeholder components
const PlaceholderPage: React.FC<{ title: string; description?: string }> = ({
  title,
  description,
}) => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
    {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    <Link to="/" className="mt-6 text-sm font-medium text-primary hover:underline">
      &larr; Back to Home
    </Link>
  </div>
);

const AccessDeniedPage: React.FC = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
    <div className="rounded-full bg-destructive/10 p-4 text-destructive">
      <span className="text-2xl font-bold">403</span>
    </div>
    <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Access Denied</h1>
    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
      You do not have the required permissions to view this resource.
    </p>
    <Link to="/" className="mt-6 text-sm font-medium text-primary hover:underline">
      Return to Home
    </Link>
  </div>
);

const NotFoundPage: React.FC = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
    <span className="text-4xl font-extrabold text-muted-foreground/50">404</span>
    <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Page Not Found</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      The page you are looking for does not exist or has been moved.
    </p>
    <Link to="/" className="mt-6 text-sm font-medium text-primary hover:underline">
      Return to Home
    </Link>
  </div>
);

/**
 * Authoritative ParkEase React Router v7 Configuration
 */
export const router = createBrowserRouter([
  // Public Routes
  {
    path: '/',
    element: (
      <PlaceholderPage
        title="ParkEase — Smart Parking Platform"
        description="Public landing page foundation."
      />
    ),
  },
  {
    path: '/about',
    element: <PlaceholderPage title="About Us" description="About ParkEase." />,
  },
  {
    path: '/contact',
    element: <PlaceholderPage title="Contact Us" description="Customer support and inquiries." />,
  },
  {
    path: '/privacy',
    element: <PlaceholderPage title="Privacy Policy" description="ParkEase Privacy Policy." />,
  },
  {
    path: '/terms',
    element: (
      <PlaceholderPage title="Terms & Conditions" description="ParkEase Terms of Service." />
    ),
  },
  {
    path: '/faqs',
    element: (
      <PlaceholderPage
        title="Frequently Asked Questions"
        description="Help and answers for ParkEase."
      />
    ),
  },
  {
    path: '/pricing',
    element: (
      <PlaceholderPage title="Pricing" description="Transparent parking fees and pricing plans." />
    ),
  },
  {
    path: '/become-owner',
    element: (
      <PlaceholderPage
        title="Become a Parking Owner"
        description="Partner with ParkEase to monetize your parking facilities."
      />
    ),
  },
  {
    path: '/owner/registration-status',
    element: (
      <PlaceholderPage
        title="Owner Application Status"
        description="Track your Parking Owner onboarding application status."
      />
    ),
  },
  {
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },

  // Authentication Routes (Guest-Only, wrapped in AuthLayout)
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            element: (
              <PlaceholderPage
                title="Login"
                description="Passwordless authentication via Email or Mobile OTP (UI to be implemented)."
              />
            ),
          },
          {
            path: '/register',
            element: (
              <PlaceholderPage
                title="Register"
                description="Customer account and vehicle registration (UI to be implemented)."
              />
            ),
          },
        ],
      },
    ],
  },

  // Role-Protected Customer Dashboard Routes
  {
    path: '/customer',
    element: <ProtectedRoute allowedRoles={['CUSTOMER']} />,
    children: [
      {
        path: 'dashboard',
        element: (
          <PlaceholderPage
            title="Customer Dashboard"
            description="Active bookings, search, and vehicle management."
          />
        ),
      },
      {
        path: '*',
        element: <Outlet />,
      },
    ],
  },

  // Role-Protected Parking Owner Dashboard Routes
  {
    path: '/owner',
    element: <ProtectedRoute allowedRoles={['PARKING_OWNER']} />,
    children: [
      {
        path: 'dashboard',
        element: (
          <PlaceholderPage
            title="Parking Owner Dashboard"
            description="Facility management, slots, staff, and revenue."
          />
        ),
      },
      {
        path: '*',
        element: <Outlet />,
      },
    ],
  },

  // Role-Protected Security Staff Dashboard Routes
  {
    path: '/security',
    element: <ProtectedRoute allowedRoles={['SECURITY_STAFF']} />,
    children: [
      {
        path: 'dashboard',
        element: (
          <PlaceholderPage
            title="Security Staff Dashboard"
            description="QR verification, entry/exit logging, and incident reporting."
          />
        ),
      },
      {
        path: '*',
        element: <Outlet />,
      },
    ],
  },

  // Role-Protected Administrator Dashboard Routes
  {
    path: '/admin',
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [
      {
        path: 'dashboard',
        element: (
          <PlaceholderPage
            title="Administrator Dashboard"
            description="Platform administration, user management, and owner approval."
          />
        ),
      },
      {
        path: '*',
        element: <Outlet />,
      },
    ],
  },

  // Fallback Catch-All
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
