import mongoose, { type InferSchemaType } from 'mongoose';

const permissionModules = [
  'Authentication',
  'Dashboard',
  'Parking Lots',
  'Parking Slots',
  'Vehicles',
  'Bookings',
  'Payments',
  'Reviews',
  'Notifications',
  'Staff Management',
  'Owner Applications',
  'Analytics',
  'Reports',
  'Audit Logs',
  'Email Center',
  'Settings',
  'Users',
  'Roles & Permissions',
] as const;

const permissionSchema = new mongoose.Schema(
  {
    permissionName: {
      type: String,
      required: true,
      maxlength: 100,
    },

    permissionCode: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-Z][A-Z_]*$/,
    },

    module: {
      type: String,
      required: true,
      enum: permissionModules,
    },

    description: {
      type: String,
      required: true,
      maxlength: 250,
    },

    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    collection: 'permissions',
    timestamps: true,
  },
);

permissionSchema.index(
  { permissionCode: 1 },
  {
    name: 'IDX_PermissionCode',
    unique: true,
  },
);

permissionSchema.index(
  { permissionName: 1 },
  {
    name: 'IDX_PermissionName',
    unique: true,
  },
);

permissionSchema.index(
  { module: 1 },
  {
    name: 'IDX_Module',
  },
);

permissionSchema.index(
  { isActive: 1 },
  {
    name: 'IDX_Status',
  },
);

export type Permission = InferSchemaType<typeof permissionSchema>;

export const PermissionModel =
  mongoose.models.Permission ?? mongoose.model<Permission>('Permission', permissionSchema);
