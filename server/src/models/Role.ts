import mongoose, { type InferSchemaType } from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      required: true,
      maxlength: 50,
    },

    roleCode: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-Z]+$/,
      immutable: true,
    },

    description: {
      type: String,
      required: true,
      maxlength: 250,
    },

    permissions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Permission',
        },
      ],
      required: true,
      default: [],
      validate: {
        validator: (permissions: mongoose.Types.ObjectId[]) => {
          const ids = permissions.map((permission) => permission.toString());
          return new Set(ids).size === ids.length;
        },
        message: 'Duplicate permission ObjectIds are not allowed.',
      },
    },

    dashboardRoute: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) => value.startsWith('/'),
        message: 'dashboardRoute must begin with "/".',
      },
    },

    isSystemRole: {
      type: Boolean,
      required: true,
      default: true,
    },

    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },

    displayOrder: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    collection: 'roles',
    timestamps: true,
  },
);

roleSchema.index(
  { roleCode: 1 },
  {
    name: 'IDX_RoleCode',
    unique: true,
  },
);

roleSchema.index(
  { roleName: 1 },
  {
    name: 'IDX_RoleName',
    unique: true,
  },
);

roleSchema.index(
  { isActive: 1 },
  {
    name: 'IDX_IsActive',
  },
);

export type Role = InferSchemaType<typeof roleSchema>;

export const RoleModel = mongoose.models.Role ?? mongoose.model<Role>('Role', roleSchema);
