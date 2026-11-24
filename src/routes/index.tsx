import React from 'react';
import { createBrowserRouter, Link, Outlet } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthLayout } from '../layouts/AuthLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { HomePage } from '../pages/public/HomePage';
import { AboutPage } from '../pages/public/AboutPage';
import { ContactPage } from '../pages/public/ContactPage';
import { PrivacyPolicyPage } from '../pages/public/PrivacyPolicyPage';
import { TermsPage } from '../pages/public/TermsPage';
import { FaqPage } from '../pages/public/FaqPage';
import { PricingPage } from '../pages/public/PricingPage';
import { BecomeOwnerPage } from '../pages/public/BecomeOwnerPage';
import { OwnerRegistrationStatusPage } from '../pages/public/OwnerRegistrationStatusPage';
import { OwnerRegisterPage } from '../pages/public/OwnerRegisterPage';
import { SearchParkingPage } from '../pages/customer/SearchParkingPage';
import { CustomerParkingDetailPage } from '../pages/customer/CustomerParkingDetailPage';
import { CustomerBookingPage } from '../pages/customer/CustomerBookingPage';
import { CustomerDashboardPage } from '../pages/customer/CustomerDashboardPage';
import { CustomerBookingsPage } from '../pages/customer/CustomerBookingsPage';
import { CustomerBookingDetailPage } from '../pages/customer/CustomerBookingDetailPage';
import { CustomerProfilePage } from '../pages/customer/CustomerProfilePage';
import { CustomerReviewsPage } from '../pages/customer/CustomerReviewsPage';
import { CustomerFavouritesPage } from '../pages/customer/CustomerFavouritesPage';
import { CustomerHelplinePage } from '../pages/customer/CustomerHelplinePage';
import { OwnerDashboardPage } from '../pages/owner/OwnerDashboardPage';
import { OwnerProfilePage } from '../pages/owner/OwnerProfilePage';
import { FacilitySubmissionPage } from '../pages/owner/FacilitySubmissionPage';
import { FacilitySubmissionDetailPage } from '../pages/owner/FacilitySubmissionDetailPage';
import { OwnerLayoutReviewPage } from '../pages/owner/OwnerLayoutReviewPage';
import { OwnerParkingLotsPage } from '../pages/owner/OwnerParkingLotsPage';
import { OwnerParkingLotDetailPage } from '../pages/owner/OwnerParkingLotDetailPage';
import { OwnerSlotsPage } from '../pages/owner/OwnerSlotsPage';
import { OwnerBookingsPage } from '../pages/owner/OwnerBookingsPage';
import { OwnerBookingDetailPage } from '../pages/owner/OwnerBookingDetailPage';
import { OwnerStaffPage } from '../pages/owner/OwnerStaffPage';
import { OwnerRevenuePage } from '../pages/owner/OwnerRevenuePage';
import { OwnerVehiclesPage } from '../pages/owner/OwnerVehiclesPage';
import { OwnerLiveLocatorPage } from '../pages/owner/OwnerLiveLocatorPage';
import { OwnerReviewsPage } from '../pages/owner/OwnerReviewsPage';
import { OwnerSettingsPage } from '../pages/owner/OwnerSettingsPage';
import { OwnerIncidentsPage } from '../pages/owner/OwnerIncidentsPage';
import { OwnerEmailCenterPage } from '../pages/owner/OwnerEmailCenterPage';
import { SecurityDashboardPage } from '../pages/security/SecurityDashboardPage';
import { SecurityProfilePage } from '../pages/security/SecurityProfilePage';
import { SecurityScanPage } from '../pages/security/SecurityScanPage';
import { SecurityWalkInPage } from '../pages/security/SecurityWalkInPage';
import { SecurityMovementLogsPage } from '../pages/security/SecurityMovementLogsPage';
import { SecurityIncidentsPage } from '../pages/security/SecurityIncidentsPage';
import { SecurityManualLookupPage } from '../pages/security/SecurityManualLookupPage';
import { SecurityEmailerPage } from '../pages/security/SecurityEmailerPage';
import { SecurityLiveViewerPage } from '../pages/security/SecurityLiveViewerPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminProfilePage } from '../pages/admin/AdminProfilePage';
import { OwnerManagementPage } from '../pages/admin/OwnerManagementPage';
import { FacilitySubmissionsListPage } from '../pages/admin/FacilitySubmissionsListPage';
import { FacilitySubmissionReviewPage } from '../pages/admin/FacilitySubmissionReviewPage';
import { OfficialParkingLotsListPage } from '../pages/admin/OfficialParkingLotsListPage';
import { OfficialParkingLotDetailPage } from '../pages/admin/OfficialParkingLotDetailPage';
import { ParkingLayoutDesignerPage } from '../pages/admin/ParkingLayoutDesignerPage';
import { PlatformSettingsPage } from '../pages/admin/PlatformSettingsPage';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { SecurityStaffManagementPage } from '../pages/admin/SecurityStaffManagementPage';
import { AdminOperationsPage } from '../pages/admin/AdminOperationsPage';
import { AdminFinancePage } from '../pages/admin/AdminFinancePage';
import { AdminEmailCenterPage } from '../pages/admin/AdminEmailCenterPage';
import { AdminReviewsPage } from '../pages/admin/AdminReviewsPage';
import { AdminReportsPage } from '../pages/admin/AdminReportsPage';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { NotificationsPage } from '../pages/common/NotificationsPage';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { SplashScreen } from '../components/common/SplashScreen';
import { ParkingSimulatorPage } from '../pages/simulator/ParkingSimulatorPage';

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
  // Public Informational Pages & Landing (wrapped in PublicLayout with Header and Footer)
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/about',
        element: <AboutPage />,
      },
      {
        path: '/contact',
        element: <ContactPage />,
      },
      {
        path: '/privacy',
        element: <PrivacyPolicyPage />,
      },
      {
        path: '/terms',
        element: <TermsPage />,
      },
      {
        path: '/faqs',
        element: <FaqPage />,
      },
      {
        path: '/pricing',
        element: <PricingPage />,
      },
      {
        path: '/become-owner',
        element: <BecomeOwnerPage />,
      },
      {
        path: '/owner/register',
        element: <OwnerRegisterPage />,
      },
      {
        path: '/owner/registration-status',
        element: <OwnerRegistrationStatusPage />,
      },
    ],
  },

  // Standalone Splash Screen route if navigated to directly
  {
    path: '/splash',
    element: <SplashScreen redirectTo="/" />,
  },
  // Standalone Hardware Simulator (Active development hardware controller)
  {
    path: '/parking-simulator',
    element: <ParkingSimulatorPage />,
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
            element: <LoginPage />,
          },
          {
            path: '/register',
            element: <RegisterPage />,
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
        element: <DashboardLayout />,
        children: [
          {
            path: 'dashboard',
            element: <CustomerDashboardPage />,
          },
          {
            path: 'search',
            element: <SearchParkingPage />,
          },
          {
            path: 'bookings',
            element: <CustomerBookingsPage />,
          },
          {
            path: 'booking/:id',
            element: <CustomerBookingDetailPage />,
          },
          {
            path: 'reviews',
            element: <CustomerReviewsPage />,
          },
          {
            path: 'favourites',
            element: <CustomerFavouritesPage />,
          },
          {
            path: 'helpline',
            element: <CustomerHelplinePage />,
          },
          {
            path: 'profile',
            element: <CustomerProfilePage />,
          },
          {
            path: 'parking/:id',
            element: <CustomerParkingDetailPage />,
          },
          {
            path: 'parking/:id/book',
            element: <CustomerBookingPage />,
          },
          {
            path: 'notifications',
            element: <NotificationsPage />,
          },
          {
            path: '*',
            element: <Outlet />,
          },
        ],
      },
    ],
  },

  // Role-Protected Parking Owner Dashboard Routes
  {
    path: '/owner',
    element: <ProtectedRoute allowedRoles={['PARKING_OWNER', 'OWNER']} />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: 'dashboard',
            element: <OwnerDashboardPage />,
          },
          {
            path: 'parking-lots',
            element: <OwnerParkingLotsPage />,
          },
          {
            path: 'parking-lots/:id',
            element: <OwnerParkingLotDetailPage />,
          },
          {
            path: 'slots',
            element: <OwnerSlotsPage />,
          },
          {
            path: 'bookings',
            element: <OwnerBookingsPage />,
          },
          {
            path: 'bookings/:id',
            element: <OwnerBookingDetailPage />,
          },
          {
            path: 'revenue',
            element: <OwnerRevenuePage />,
          },
          {
            path: 'vehicles',
            element: <OwnerVehiclesPage />,
          },
          {
            path: 'live-vehicles',
            element: <OwnerLiveLocatorPage />,
          },
          {
            path: 'reviews',
            element: <OwnerReviewsPage />,
          },
          {
            path: 'incidents',
            element: <OwnerIncidentsPage />,
          },
          {
            path: 'email-center',
            element: <OwnerEmailCenterPage />,
          },
          {
            path: 'staff',
            element: <OwnerStaffPage />,
          },
          {
            path: 'profile',
            element: <OwnerProfilePage />,
          },
          {
            path: 'settings',
            element: <OwnerSettingsPage />,
          },
          {
            path: 'parking/submissions/new',
            element: <FacilitySubmissionPage />,
          },
          {
            path: 'parking/submissions/:id/edit',
            element: <FacilitySubmissionPage />,
          },
          {
            path: 'parking/submissions/:id',
            element: <FacilitySubmissionDetailPage />,
          },
          {
            path: 'parking-lots/:id/layout',
            element: <OwnerLayoutReviewPage />,
          },
          {
            path: 'notifications',
            element: <NotificationsPage />,
          },
          {
            path: '*',
            element: <Outlet />,
          },
        ],
      },
    ],
  },

  // Role-Protected Security Staff Dashboard Routes
  {
    path: '/security',
    element: <ProtectedRoute allowedRoles={['SECURITY_STAFF', 'SECURITY']} />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: 'dashboard',
            element: <SecurityDashboardPage />,
          },
          {
            path: 'scan',
            element: <SecurityScanPage />,
          },
          {
            path: 'walk-in',
            element: <SecurityWalkInPage />,
          },
          {
            path: 'movement-logs',
            element: <SecurityMovementLogsPage />,
          },
          {
            path: 'incidents',
            element: <SecurityIncidentsPage />,
          },
          {
            path: 'manual-lookup',
            element: <SecurityManualLookupPage />,
          },
          {
            path: 'live-viewer',
            element: <SecurityLiveViewerPage />,
          },
          {
            path: 'emailer',
            element: <SecurityEmailerPage />,
          },
          {
            path: 'profile',
            element: <SecurityProfilePage />,
          },
          {
            path: 'notifications',
            element: <NotificationsPage />,
          },
          {
            path: '*',
            element: <Outlet />,
          },
        ],
      },
    ],
  },

  // Role-Protected Administrator Dashboard Routes
  {
    path: '/admin',
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: 'dashboard',
            element: <AdminDashboardPage />,
          },
          {
            path: 'profile',
            element: <AdminProfilePage />,
          },
          {
            path: 'users',
            element: <UserManagementPage />,
          },
          {
            path: 'owners',
            element: <OwnerManagementPage />,
          },
          {
            path: 'staff',
            element: <SecurityStaffManagementPage />,
          },
          {
            path: 'operations',
            element: <AdminOperationsPage />,
          },
          {
            path: 'bookings',
            element: <AdminOperationsPage />,
          },
          {
            path: 'live-vehicles',
            element: <AdminOperationsPage />,
          },
          {
            path: 'finance',
            element: <AdminFinancePage />,
          },
          {
            path: 'payments',
            element: <AdminFinancePage />,
          },
          {
            path: 'email-center',
            element: <AdminEmailCenterPage />,
          },
          {
            path: 'communications',
            element: <AdminEmailCenterPage />,
          },
          {
            path: 'reviews',
            element: <AdminReviewsPage />,
          },
          {
            path: 'analytics',
            element: <AdminAnalyticsPage />,
          },
          {
            path: 'reports',
            element: <AdminReportsPage />,
          },
          {
            path: 'facilities',
            element: <FacilitySubmissionsListPage />,
          },
          {
            path: 'facilities/:id',
            element: <FacilitySubmissionReviewPage />,
          },
          {
            path: 'parking-lots',
            element: <OfficialParkingLotsListPage />,
          },
          {
            path: 'parking-lots/:id',
            element: <OfficialParkingLotDetailPage />,
          },
          {
            path: 'parking-lots/:id/layout',
            element: <ParkingLayoutDesignerPage />,
          },
          {
            path: 'settings',
            element: <PlatformSettingsPage />,
          },
          {
            path: 'notifications',
            element: <NotificationsPage />,
          },
          {
            path: '*',
            element: <Outlet />,
          },
        ],
      },
    ],
  },

  // Unified Notifications Route for all authenticated roles
  {
    path: '/notifications',
    element: (
      <ProtectedRoute
        allowedRoles={['CUSTOMER', 'OWNER', 'PARKING_OWNER', 'ADMIN', 'SECURITY_STAFF', 'SECURITY']}
      />
    ),
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: '',
            element: <NotificationsPage />,
          },
        ],
      },
    ],
  },

  // Fallback Catch-All
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
