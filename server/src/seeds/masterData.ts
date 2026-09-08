/**
 * Authoritative V1 Master Data: Permissions and System Roles
 *
 * Sources:
 * - dbproject-5.txt (Sections C.2, C.3)
 * - appendix-8.txt (Sections C.2, C.3)
 * - finalproject-5.txt
 */

export interface CanonicalPermission {
  permissionName: string;
  permissionCode: string;
  module:
    | 'Authentication'
    | 'Dashboard'
    | 'Parking Lots'
    | 'Parking Slots'
    | 'Vehicles'
    | 'Bookings'
    | 'Payments'
    | 'Reviews'
    | 'Notifications'
    | 'Staff Management'
    | 'Owner Applications'
    | 'Analytics'
    | 'Reports'
    | 'Audit Logs'
    | 'Email Center'
    | 'Settings'
    | 'Users'
    | 'Roles & Permissions';
  description: string;
}

export const CANONICAL_PERMISSIONS: readonly CanonicalPermission[] = [
  {
    permissionName: 'View Dashboard',
    permissionCode: 'DASHBOARD_VIEW',
    module: 'Dashboard',
    description: 'Allows viewing the role-specific analytics and overview dashboard.',
  },
  {
    permissionName: 'View Booking',
    permissionCode: 'BOOKING_VIEW',
    module: 'Bookings',
    description: 'Allows viewing booking details within authorized scope.',
  },
  {
    permissionName: 'Create Booking',
    permissionCode: 'BOOKING_CREATE',
    module: 'Bookings',
    description: 'Allows creating parking reservations and bookings.',
  },
  {
    permissionName: 'Cancel Booking',
    permissionCode: 'BOOKING_CANCEL',
    module: 'Bookings',
    description: 'Allows cancelling eligible parking bookings.',
  },
  {
    permissionName: 'Extend Booking',
    permissionCode: 'BOOKING_EXTEND',
    module: 'Bookings',
    description: 'Allows extending active parking reservation duration.',
  },
  {
    permissionName: 'Verify Entry',
    permissionCode: 'ENTRY_VERIFY',
    module: 'Bookings',
    description: 'Allows verifying vehicle check-in and QR entry.',
  },
  {
    permissionName: 'Verify Exit',
    permissionCode: 'EXIT_VERIFY',
    module: 'Bookings',
    description: 'Allows verifying vehicle check-out, overstay, and QR exit.',
  },
  {
    permissionName: 'Manage Parking Lots',
    permissionCode: 'PARKING_MANAGE',
    module: 'Parking Lots',
    description: 'Allows creating, updating, and managing parking lots.',
  },
  {
    permissionName: 'Manage Parking Slots',
    permissionCode: 'SLOT_MANAGE',
    module: 'Parking Slots',
    description: 'Allows creating and updating parking slots, floors, and zones.',
  },
  {
    permissionName: 'Manage Staff',
    permissionCode: 'STAFF_MANAGE',
    module: 'Staff Management',
    description: 'Allows managing security staff invitations and assignments.',
  },
  {
    permissionName: 'Manage Vehicles',
    permissionCode: 'VEHICLE_MANAGE',
    module: 'Vehicles',
    description: 'Allows adding, updating, and managing registered vehicles.',
  },
  {
    permissionName: 'View Payments',
    permissionCode: 'PAYMENT_VIEW',
    module: 'Payments',
    description: 'Allows viewing payment transactions and receipts.',
  },
  {
    permissionName: 'Manage Payments',
    permissionCode: 'PAYMENT_MANAGE',
    module: 'Payments',
    description: 'Allows processing refunds, offline cash collection, and payment workflows.',
  },
  {
    permissionName: 'Manage Reviews',
    permissionCode: 'REVIEW_MANAGE',
    module: 'Reviews',
    description: 'Allows moderating, viewing, and managing parking facility reviews.',
  },
  {
    permissionName: 'View Notifications',
    permissionCode: 'NOTIFICATION_VIEW',
    module: 'Notifications',
    description: 'Allows viewing in-app notifications and alerts.',
  },
  {
    permissionName: 'Manage Notifications',
    permissionCode: 'NOTIFICATION_MANAGE',
    module: 'Notifications',
    description: 'Allows creating, broadcasting, and managing system notifications.',
  },
  {
    permissionName: 'View Owner Applications',
    permissionCode: 'OWNER_APPLICATION_VIEW',
    module: 'Owner Applications',
    description: 'Allows viewing parking owner registration applications.',
  },
  {
    permissionName: 'Manage Owner Applications',
    permissionCode: 'OWNER_APPLICATION_MANAGE',
    module: 'Owner Applications',
    description: 'Allows reviewing, approving, or rejecting owner applications.',
  },
  {
    permissionName: 'View Analytics',
    permissionCode: 'ANALYTICS_VIEW',
    module: 'Analytics',
    description: 'Allows viewing performance metrics and occupancy analytics.',
  },
  {
    permissionName: 'View Reports',
    permissionCode: 'REPORT_VIEW',
    module: 'Reports',
    description: 'Allows generating and viewing financial and operational reports.',
  },
  {
    permissionName: 'Send Emails',
    permissionCode: 'EMAIL_SEND',
    module: 'Email Center',
    description: 'Allows sending customer communications and operational emails.',
  },
  {
    permissionName: 'View Email History',
    permissionCode: 'EMAIL_HISTORY_VIEW',
    module: 'Email Center',
    description: 'Allows viewing email logs and delivery status history.',
  },
  {
    permissionName: 'Manage Users',
    permissionCode: 'USER_MANAGE',
    module: 'Users',
    description: 'Allows managing user accounts, statuses, and profiles.',
  },
  {
    permissionName: 'Manage Roles',
    permissionCode: 'ROLE_MANAGE',
    module: 'Roles & Permissions',
    description: 'Allows managing system roles and permission assignments.',
  },
  {
    permissionName: 'View Audit Logs',
    permissionCode: 'AUDIT_VIEW',
    module: 'Audit Logs',
    description: 'Allows viewing immutable system audit trail and activity logs.',
  },
  {
    permissionName: 'Manage Settings',
    permissionCode: 'SETTINGS_MANAGE',
    module: 'Settings',
    description: 'Allows configuring system-wide settings and operational parameters.',
  },
] as const;

export interface CanonicalRole {
  roleName: string;
  roleCode: 'CUSTOMER' | 'OWNER' | 'SECURITY' | 'ADMIN';
  description: string;
  dashboardRoute: string;
  displayOrder: number;
  isSystemRole: boolean;
  permissionCodes: readonly string[];
}

export const CANONICAL_ROLES: readonly CanonicalRole[] = [
  {
    roleName: 'Customer',
    roleCode: 'CUSTOMER',
    description:
      'Standard role for registered customers to search parking, create and manage bookings, vehicles, and profile.',
    dashboardRoute: '/customer/dashboard',
    displayOrder: 1,
    isSystemRole: true,
    permissionCodes: [
      'DASHBOARD_VIEW',
      'BOOKING_VIEW',
      'BOOKING_CREATE',
      'BOOKING_CANCEL',
      'BOOKING_EXTEND',
      'VEHICLE_MANAGE',
      'PAYMENT_VIEW',
      'NOTIFICATION_VIEW',
    ],
  },
  {
    roleName: 'Parking Owner',
    roleCode: 'OWNER',
    description:
      'Role for verified parking facility owners to manage parking lots, slots, staff assignments, and view earnings.',
    dashboardRoute: '/owner/dashboard',
    displayOrder: 2,
    isSystemRole: true,
    permissionCodes: [
      'DASHBOARD_VIEW',
      'BOOKING_VIEW',
      'PARKING_MANAGE',
      'SLOT_MANAGE',
      'STAFF_MANAGE',
      'PAYMENT_VIEW',
      'PAYMENT_MANAGE',
      'REVIEW_MANAGE',
      'ANALYTICS_VIEW',
      'REPORT_VIEW',
      'EMAIL_SEND',
      'EMAIL_HISTORY_VIEW',
      'NOTIFICATION_VIEW',
      'NOTIFICATION_MANAGE',
    ],
  },
  {
    roleName: 'Security Staff',
    roleCode: 'SECURITY',
    description:
      'Operational role for security personnel assigned to parking facilities to verify vehicle check-in and check-out.',
    dashboardRoute: '/security/dashboard',
    displayOrder: 3,
    isSystemRole: true,
    permissionCodes: [
      'DASHBOARD_VIEW',
      'BOOKING_VIEW',
      'ENTRY_VERIFY',
      'EXIT_VERIFY',
      'NOTIFICATION_VIEW',
    ],
  },
  {
    roleName: 'Administrator',
    roleCode: 'ADMIN',
    description:
      'Platform-level administrative access to manage users, facilities, financial records, audit logs, and settings.',
    dashboardRoute: '/admin/dashboard',
    displayOrder: 4,
    isSystemRole: true,
    permissionCodes: [
      'DASHBOARD_VIEW',
      'BOOKING_VIEW',
      'BOOKING_CREATE',
      'BOOKING_CANCEL',
      'BOOKING_EXTEND',
      'ENTRY_VERIFY',
      'EXIT_VERIFY',
      'PARKING_MANAGE',
      'SLOT_MANAGE',
      'STAFF_MANAGE',
      'VEHICLE_MANAGE',
      'PAYMENT_VIEW',
      'PAYMENT_MANAGE',
      'REVIEW_MANAGE',
      'NOTIFICATION_VIEW',
      'NOTIFICATION_MANAGE',
      'OWNER_APPLICATION_VIEW',
      'OWNER_APPLICATION_MANAGE',
      'ANALYTICS_VIEW',
      'REPORT_VIEW',
      'EMAIL_SEND',
      'EMAIL_HISTORY_VIEW',
      'USER_MANAGE',
      'ROLE_MANAGE',
      'AUDIT_VIEW',
      'SETTINGS_MANAGE',
    ],
  },
] as const;
