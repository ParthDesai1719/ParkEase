import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { Role, RoleCode, User } from '../../types/auth';

/**
 * Extract normalized RoleCode from User object.
 */
export function getRoleCode(user: User | null): RoleCode | string | null {
  if (!user) return null;

  // 1. user.role object
  if (user.role && typeof user.role === 'object' && user.role.roleCode) {
    return user.role.roleCode;
  }

  // 2. user.role as direct string
  if (user.role && typeof user.role === 'string') {
    return user.role;
  }

  // 3. user.roleId object
  if (user.roleId && typeof user.roleId === 'object' && (user.roleId as Role).roleCode) {
    return (user.roleId as Role).roleCode;
  }

  // 4. user.roleId as direct string matching a standard RoleCode
  if (
    typeof user.roleId === 'string' &&
    ['CUSTOMER', 'OWNER', 'PARKING_OWNER', 'SECURITY', 'SECURITY_STAFF', 'ADMIN'].includes(
      user.roleId,
    )
  ) {
    return user.roleId;
  }

  return null;
}

/**
 * Determine the authoritative dashboard route for a given user role.
 */
export function getDashboardRoute(roleCode?: RoleCode | string | null, user?: User | null): string {
  if (user?.role?.dashboardRoute) {
    return user.role.dashboardRoute;
  }
  if (user?.roleId && typeof user.roleId === 'object' && (user.roleId as Role).dashboardRoute) {
    return (user.roleId as Role).dashboardRoute;
  }

  switch (roleCode) {
    case 'CUSTOMER':
      return '/customer/dashboard';
    case 'OWNER':
    case 'PARKING_OWNER':
      return '/owner/dashboard';
    case 'SECURITY':
    case 'SECURITY_STAFF':
      return '/security/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/';
  }
}

interface ProtectedRouteProps {
  allowedRoles?: (RoleCode | string)[];
  children?: React.ReactNode;
}

/**
 * ProtectedRoute:
 * 1. Shows a loading fallback while auth status is being verified.
 * 2. Redirects unauthenticated visitors to /login preserving target location.
 * 3. Redirects authenticated users without the required role to /access-denied.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleCode = getRoleCode(user);

  if (allowedRoles && allowedRoles.length > 0) {
    if (!roleCode) {
      // Role is still resolving during session hydration; show spinner rather than kicking to /access-denied
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Verifying role permissions...</p>
          </div>
        </div>
      );
    }

    const hasRole = allowedRoles.includes(roleCode);
    if (!hasRole) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};

interface GuestRouteProps {
  children?: React.ReactNode;
}

/**
 * GuestRoute:
 * Ensures public auth routes (/login, /register) are only accessible to unauthenticated visitors.
 * Authenticated users are automatically redirected to their role-specific dashboard.
 */
export const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const roleCode = getRoleCode(user);
    const destination = getDashboardRoute(roleCode, user);
    return <Navigate to={destination} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
