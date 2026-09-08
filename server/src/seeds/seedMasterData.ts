import 'dotenv/config';
import mongoose from 'mongoose';
import { PermissionModel, type Permission } from '../models/Permission.js';
import { RoleModel, type Role } from '../models/Role.js';
import { CANONICAL_PERMISSIONS, CANONICAL_ROLES } from './masterData.js';

export async function seedMasterData(): Promise<{ permissionsCount: number; rolesCount: number }> {
  const permModel = PermissionModel as unknown as mongoose.Model<Permission>;
  const roleModel = RoleModel as unknown as mongoose.Model<Role>;

  console.log('--- Starting ParkEase Master Data Seed ---');

  // Step 1: Ensure Permissions idempotently
  const permissionCodeToIdMap = new Map<string, mongoose.Types.ObjectId>();

  for (const permDef of CANONICAL_PERMISSIONS) {
    const existing = await permModel.findOne({ permissionCode: permDef.permissionCode }).exec();
    if (existing) {
      existing.permissionName = permDef.permissionName;
      existing.module = permDef.module;
      existing.description = permDef.description;
      existing.isActive = true;
      await existing.save();
      permissionCodeToIdMap.set(permDef.permissionCode, existing._id as mongoose.Types.ObjectId);
    } else {
      const created = await permModel.create({
        permissionName: permDef.permissionName,
        permissionCode: permDef.permissionCode,
        module: permDef.module,
        description: permDef.description,
        isActive: true,
      });
      permissionCodeToIdMap.set(permDef.permissionCode, created._id as mongoose.Types.ObjectId);
    }
  }

  console.log(`[PASS] Verified/Seeded ${permissionCodeToIdMap.size} Permissions.`);

  // Step 2: Ensure Roles idempotently referencing permission ObjectIds
  let rolesCount = 0;

  for (const roleDef of CANONICAL_ROLES) {
    const permissionIds = roleDef.permissionCodes.map((code) => {
      const id = permissionCodeToIdMap.get(code);
      if (!id) {
        throw new Error(
          `Permission code "${code}" required by role "${roleDef.roleCode}" was not found.`,
        );
      }
      return id;
    });

    const existingRole = await roleModel.findOne({ roleCode: roleDef.roleCode }).exec();
    if (existingRole) {
      existingRole.roleName = roleDef.roleName;
      existingRole.description = roleDef.description;
      existingRole.dashboardRoute = roleDef.dashboardRoute;
      existingRole.displayOrder = roleDef.displayOrder;
      existingRole.isSystemRole = roleDef.isSystemRole;
      existingRole.isActive = true;
      existingRole.permissions = permissionIds;
      await existingRole.save();
      rolesCount++;
    } else {
      await roleModel.create({
        roleName: roleDef.roleName,
        roleCode: roleDef.roleCode,
        description: roleDef.description,
        dashboardRoute: roleDef.dashboardRoute,
        displayOrder: roleDef.displayOrder,
        isSystemRole: roleDef.isSystemRole,
        isActive: true,
        permissions: permissionIds,
      });
      rolesCount++;
    }
  }

  console.log(`[PASS] Verified/Seeded ${rolesCount} Roles.`);
  console.log('--- Master Data Seeding Completed Successfully ---');

  return { permissionsCount: permissionCodeToIdMap.size, rolesCount };
}

// Standalone execution wrapper
const currentFile = import.meta.url;
if (process.argv[1] && currentFile.includes(process.argv[1].replace(/\\/g, '/'))) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI environment variable is required.');
    process.exit(1);
  }

  (async () => {
    try {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
      console.log('Connected to database.');

      await seedMasterData();

      await mongoose.disconnect();
      console.log('Database disconnected.');
      process.exit(0);
    } catch (error) {
      console.error('SEEDING FAILED:');
      console.error(error instanceof Error ? error.message : error);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    }
  })();
}
