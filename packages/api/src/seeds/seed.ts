import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase, mongoose } from '@pawtag/db';
import {
  Role,
  Permission,
  PermissionGroup,
  PermissionScope,
  UserRole,
  RolePermission,
  User,
} from '@pawtag/db';
import bcrypt from 'bcryptjs';

interface PermissionDef {
  name: string;
  displayName: string;
  description: string;
  resource: string;
  action: string;
  groupIndex: number;
}

interface RolePermDef {
  permissionName: string;
  scopeCode?: string;
}

async function seed() {
  console.log('Connecting to database...');
  await connectDatabase(process.env.DB_URL!);
  console.log('Connected.');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Permission Scopes ──
    console.log('\n--- Seeding Permission Scopes ---');
    const scopes = [
      { code: 'GLOBAL', name: 'Global', description: 'Access across the entire system without restriction' },
      { code: 'ALL', name: 'All Records', description: 'Access to all records of this resource type' },
      { code: 'OWN', name: 'Own Records', description: 'Access only to records owned by the user' },
      { code: 'ASSIGNED', name: 'Assigned Records', description: 'Access only to records assigned to the user' },
    ];

    const scopeMap: Record<string, string> = {};
    for (const s of scopes) {
      const existing = await PermissionScope.findOne({ code: s.code }).session(session);
      if (existing) {
        scopeMap[s.code] = existing._id.toString();
        console.log(`  Existing scope: ${s.code}`);
      } else {
        const created = await PermissionScope.create([s], { session });
        scopeMap[s.code] = created[0]._id.toString();
        console.log(`  Created scope: ${s.code}`);
      }
    }

    // ── 2. Permission Groups ──
    console.log('\n--- Seeding Permission Groups ---');
    const groupDefs = [
      { name: 'USER_MANAGEMENT', displayName: 'User Management', description: 'Manage platform users', icon: 'Users', sortOrder: 10 },
      { name: 'ROLE_MANAGEMENT', displayName: 'Role Management', description: 'Manage roles and permissions', icon: 'Shield', sortOrder: 20 },
      { name: 'PERMISSION_GROUP_MANAGEMENT', displayName: 'Permission Group Management', description: 'Manage permission groups', icon: 'FolderTree', sortOrder: 30 },
      { name: 'PERMISSION_MANAGEMENT', displayName: 'Permission Management', description: 'Manage permissions', icon: 'Key', sortOrder: 40 },
      { name: 'CUSTOMER_MANAGEMENT', displayName: 'Customer Management', description: 'Manage pet owners', icon: 'UserCheck', sortOrder: 50 },
      { name: 'PET_MANAGEMENT', displayName: 'Pet Management', description: 'Manage pets', icon: 'PawPrint', sortOrder: 60 },
      { name: 'PET_HEALTH_RECORDS', displayName: 'Pet Health Records', description: 'Manage pet medical records', icon: 'HeartPulse', sortOrder: 70 },
      { name: 'VACCINATION_MANAGEMENT', displayName: 'Vaccination Management', description: 'Manage pet vaccinations', icon: 'Syringe', sortOrder: 80 },
      { name: 'MEDICATION_MANAGEMENT', displayName: 'Medication Management', description: 'Manage pet medications', icon: 'Pill', sortOrder: 90 },
      { name: 'ALLERGY_MANAGEMENT', displayName: 'Allergy Management', description: 'Manage pet allergies', icon: 'AlertTriangle', sortOrder: 100 },
      { name: 'VET_VISIT_MANAGEMENT', displayName: 'Vet Visit Management', description: 'Manage vet visits', icon: 'Stethoscope', sortOrder: 110 },
      { name: 'SURGERY_MANAGEMENT', displayName: 'Surgery Management', description: 'Manage pet surgeries', icon: 'Scissors', sortOrder: 120 },
      { name: 'DESEXING_MANAGEMENT', displayName: 'Desexing Management', description: 'Manage desexing records', icon: 'Activity', sortOrder: 130 },
      { name: 'MICROCHIP_MANAGEMENT', displayName: 'Microchip Management', description: 'Manage pet microchips', icon: 'Chip', sortOrder: 140 },
      { name: 'WEIGHT_MANAGEMENT', displayName: 'Weight Management', description: 'Manage weight history', icon: 'Scale', sortOrder: 150 },
      { name: 'HEALTH_DOCUMENT_MANAGEMENT', displayName: 'Health Document Management', description: 'Manage health documents', icon: 'FileText', sortOrder: 160 },
      { name: 'WEBSITE_CONTENT', displayName: 'Website Content', description: 'Manage public website content', icon: 'Newspaper', sortOrder: 170 },
      { name: 'REPORTS', displayName: 'Reports & Analytics', description: 'Generate and view reports', icon: 'BarChart3', sortOrder: 180 },
      { name: 'SYSTEM_CONFIGURATION', displayName: 'System Configuration', description: 'Manage system settings and configuration', icon: 'Settings', sortOrder: 190 },
      { name: 'AUDIT_SECURITY', displayName: 'Audit & Security', description: 'View audit logs and security events', icon: 'ScrollText', sortOrder: 200 },
      { name: 'NOTIFICATION_MANAGEMENT', displayName: 'Notification Management', description: 'Manage notifications and templates', icon: 'Bell', sortOrder: 210 },
      { name: 'CMS_MANAGEMENT', displayName: 'CMS Management', description: 'Manage website pages, navigation, footer, media, and announcements', icon: 'Layout', sortOrder: 220 },
    ];

    const groupMap: Record<string, string> = {};
    for (const g of groupDefs) {
      const existing = await PermissionGroup.findOne({ name: g.name }).session(session);
      if (existing) {
        groupMap[g.name] = existing._id.toString();
      } else {
        const created = await PermissionGroup.create([{ ...g, isActive: true }], { session });
        groupMap[g.name] = created[0]._id.toString();
      }
    }
    console.log(`  ${Object.keys(groupMap).length} permission groups ready`);

    // ── 3. Permissions ──
    console.log('\n--- Seeding Permissions ---');
    const permDefs: PermissionDef[] = [
      // Dashboard & Analytics
      { name: 'dashboard.read', displayName: 'View Dashboard', description: 'View admin dashboard and overview stats', resource: 'dashboard', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'stats.read', displayName: 'View Statistics', description: 'View lost/found statistics and analytics', resource: 'stats', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },

      // Tag Management
      { name: 'tag.read', displayName: 'Read Tags', description: 'View tag details and lists', resource: 'tag', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'tag.create', displayName: 'Create Tags', description: 'Create new tags', resource: 'tag', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'tag.update', displayName: 'Update Tags', description: 'Update existing tags', resource: 'tag', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'tag.delete', displayName: 'Delete Tags', description: 'Delete tags', resource: 'tag', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'tag.generate_qr', displayName: 'Generate QR Codes', description: 'Generate QR codes for tags', resource: 'tag', action: 'generate_qr', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'tag.generate_sticker', displayName: 'Generate Stickers', description: 'Generate printable stickers for tags', resource: 'tag', action: 'generate_sticker', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },

      // Product Management
      { name: 'product.read', displayName: 'Read Products', description: 'View product details and lists', resource: 'product', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'product.create', displayName: 'Create Products', description: 'Create new products', resource: 'product', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'product.update', displayName: 'Update Products', description: 'Update existing products', resource: 'product', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'product.delete', displayName: 'Delete Products', description: 'Delete products', resource: 'product', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },

      // Order Management
      { name: 'order.read', displayName: 'Read Orders', description: 'View order details and lists', resource: 'order', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'order.create', displayName: 'Create Orders', description: 'Create new orders', resource: 'order', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'order.update', displayName: 'Update Orders', description: 'Update order status and details', resource: 'order', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },

      // Settings Management
      { name: 'setting.read', displayName: 'Read Settings', description: 'View system settings', resource: 'setting', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },
      { name: 'setting.create', displayName: 'Create Settings', description: 'Create new system settings', resource: 'setting', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },
      { name: 'setting.update', displayName: 'Update Settings', description: 'Update system settings', resource: 'setting', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },

      // Feature Flags
      { name: 'feature_flag.read', displayName: 'Read Feature Flags', description: 'View feature flags', resource: 'feature_flag', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },
      { name: 'feature_flag.create', displayName: 'Create Feature Flags', description: 'Create new feature flags', resource: 'feature_flag', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },
      { name: 'feature_flag.update', displayName: 'Update Feature Flags', description: 'Update feature flags', resource: 'feature_flag', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },
      { name: 'feature_flag.delete', displayName: 'Delete Feature Flags', description: 'Delete feature flags', resource: 'feature_flag', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },

      // Finder Scans
      { name: 'finder_scan.read', displayName: 'Read Finder Scans', description: 'View finder scan events', resource: 'finder_scan', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'AUDIT_SECURITY') },

      // Location Events
      { name: 'location_event.read', displayName: 'Read Location Events', description: 'View location events', resource: 'location_event', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'AUDIT_SECURITY') },

      // User Management
      { name: 'user.read', displayName: 'Read Users', description: 'View user details and lists', resource: 'user', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.create', displayName: 'Create Users', description: 'Create new user accounts', resource: 'user', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.update', displayName: 'Update Users', description: 'Update existing user details', resource: 'user', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.delete', displayName: 'Delete Users', description: 'Delete user accounts', resource: 'user', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.activate', displayName: 'Activate Users', description: 'Activate user accounts', resource: 'user', action: 'activate', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.deactivate', displayName: 'Deactivate Users', description: 'Deactivate user accounts', resource: 'user', action: 'deactivate', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.invite', displayName: 'Invite Users', description: 'Send invitations to new users', resource: 'user', action: 'invite', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.resend_invitation', displayName: 'Resend Invitation', description: 'Resend invitation emails', resource: 'user', action: 'resend_invitation', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.reset_password', displayName: 'Reset User Password', description: 'Force reset a user password', resource: 'user', action: 'reset_password', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.change_password', displayName: 'Change Password', description: 'Change own password', resource: 'user', action: 'change_password', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.verify_email', displayName: 'Verify Email', description: 'Verify user email addresses', resource: 'user', action: 'verify_email', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.assign_role', displayName: 'Assign Roles', description: 'Assign roles to users', resource: 'user', action: 'assign_role', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.remove_role', displayName: 'Remove Roles', description: 'Remove roles from users', resource: 'user', action: 'remove_role', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.view_activity', displayName: 'View User Activity', description: 'View user activity history', resource: 'user', action: 'view_activity', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },
      { name: 'user.export', displayName: 'Export Users', description: 'Export user data', resource: 'user', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'USER_MANAGEMENT') },

      // Role Management
      { name: 'role.read', displayName: 'Read Roles', description: 'View roles and their details', resource: 'role', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.create', displayName: 'Create Roles', description: 'Create new roles', resource: 'role', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.update', displayName: 'Update Roles', description: 'Update existing roles', resource: 'role', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.delete', displayName: 'Delete Roles', description: 'Delete roles', resource: 'role', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.activate', displayName: 'Activate Roles', description: 'Activate roles', resource: 'role', action: 'activate', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.deactivate', displayName: 'Deactivate Roles', description: 'Deactivate roles', resource: 'role', action: 'deactivate', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.clone', displayName: 'Clone Roles', description: 'Duplicate roles with all permissions', resource: 'role', action: 'clone', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.assign_permission', displayName: 'Assign Permissions', description: 'Assign permissions to roles', resource: 'role', action: 'assign_permission', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },
      { name: 'role.remove_permission', displayName: 'Remove Permissions', description: 'Remove permissions from roles', resource: 'role', action: 'remove_permission', groupIndex: groupDefs.findIndex(g => g.name === 'ROLE_MANAGEMENT') },

      // Permission Group Management
      { name: 'permission_group.read', displayName: 'Read Permission Groups', description: 'View permission groups', resource: 'permission_group', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_GROUP_MANAGEMENT') },
      { name: 'permission_group.create', displayName: 'Create Permission Groups', description: 'Create new permission groups', resource: 'permission_group', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_GROUP_MANAGEMENT') },
      { name: 'permission_group.update', displayName: 'Update Permission Groups', description: 'Update existing permission groups', resource: 'permission_group', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_GROUP_MANAGEMENT') },
      { name: 'permission_group.delete', displayName: 'Delete Permission Groups', description: 'Delete permission groups', resource: 'permission_group', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_GROUP_MANAGEMENT') },
      { name: 'permission_group.activate', displayName: 'Activate Permission Groups', description: 'Activate permission groups', resource: 'permission_group', action: 'activate', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_GROUP_MANAGEMENT') },
      { name: 'permission_group.deactivate', displayName: 'Deactivate Permission Groups', description: 'Deactivate permission groups', resource: 'permission_group', action: 'deactivate', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_GROUP_MANAGEMENT') },

      // Permission Management
      { name: 'permission.read', displayName: 'Read Permissions', description: 'View permissions', resource: 'permission', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_MANAGEMENT') },
      { name: 'permission.create', displayName: 'Create Permissions', description: 'Create new permissions', resource: 'permission', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_MANAGEMENT') },
      { name: 'permission.update', displayName: 'Update Permissions', description: 'Update existing permissions', resource: 'permission', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_MANAGEMENT') },
      { name: 'permission.delete', displayName: 'Delete Permissions', description: 'Delete permissions', resource: 'permission', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_MANAGEMENT') },
      { name: 'permission.activate', displayName: 'Activate Permissions', description: 'Activate permissions', resource: 'permission', action: 'activate', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_MANAGEMENT') },
      { name: 'permission.deactivate', displayName: 'Deactivate Permissions', description: 'Deactivate permissions', resource: 'permission', action: 'deactivate', groupIndex: groupDefs.findIndex(g => g.name === 'PERMISSION_MANAGEMENT') },

      // Customer Management
      { name: 'customer.read', displayName: 'Read Customers', description: 'View customer details', resource: 'customer', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },
      { name: 'customer.create', displayName: 'Create Customers', description: 'Create new customer accounts', resource: 'customer', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },
      { name: 'customer.update', displayName: 'Update Customers', description: 'Update customer details', resource: 'customer', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },
      { name: 'customer.delete', displayName: 'Delete Customers', description: 'Delete customer accounts', resource: 'customer', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },
      { name: 'customer.activate', displayName: 'Activate Customers', description: 'Activate customer accounts', resource: 'customer', action: 'activate', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },
      { name: 'customer.deactivate', displayName: 'Deactivate Customers', description: 'Deactivate customer accounts', resource: 'customer', action: 'deactivate', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },
      { name: 'customer.export', displayName: 'Export Customers', description: 'Export customer data', resource: 'customer', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },
      { name: 'customer.view_activity', displayName: 'View Customer Activity', description: 'View customer activity history', resource: 'customer', action: 'view_activity', groupIndex: groupDefs.findIndex(g => g.name === 'CUSTOMER_MANAGEMENT') },

      // Pet Management
      { name: 'pet.read', displayName: 'Read Pets', description: 'View pet details', resource: 'pet', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'pet.create', displayName: 'Create Pets', description: 'Create new pet records', resource: 'pet', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'pet.update', displayName: 'Update Pets', description: 'Update existing pet records', resource: 'pet', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'pet.delete', displayName: 'Delete Pets', description: 'Delete pet records', resource: 'pet', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'pet.archive', displayName: 'Archive Pets', description: 'Archive pet records', resource: 'pet', action: 'archive', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'pet.restore', displayName: 'Restore Pets', description: 'Restore archived pet records', resource: 'pet', action: 'restore', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'pet.transfer', displayName: 'Transfer Pets', description: 'Transfer pet ownership', resource: 'pet', action: 'transfer', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },
      { name: 'pet.export', displayName: 'Export Pets', description: 'Export pet data', resource: 'pet', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'PET_MANAGEMENT') },

      // Health Records
      { name: 'medical_record.read', displayName: 'Read Medical Records', description: 'View medical records', resource: 'medical_record', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'PET_HEALTH_RECORDS') },
      { name: 'medical_record.create', displayName: 'Create Medical Records', description: 'Create new medical records', resource: 'medical_record', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'PET_HEALTH_RECORDS') },
      { name: 'medical_record.update', displayName: 'Update Medical Records', description: 'Update existing medical records', resource: 'medical_record', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'PET_HEALTH_RECORDS') },
      { name: 'medical_record.delete', displayName: 'Delete Medical Records', description: 'Delete medical records', resource: 'medical_record', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'PET_HEALTH_RECORDS') },
      { name: 'medical_record.archive', displayName: 'Archive Medical Records', description: 'Archive medical records', resource: 'medical_record', action: 'archive', groupIndex: groupDefs.findIndex(g => g.name === 'PET_HEALTH_RECORDS') },
      { name: 'medical_record.export', displayName: 'Export Medical Records', description: 'Export medical record data', resource: 'medical_record', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'PET_HEALTH_RECORDS') },

      // Vaccinations
      { name: 'vaccination.read', displayName: 'Read Vaccinations', description: 'View vaccination records', resource: 'vaccination', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'VACCINATION_MANAGEMENT') },
      { name: 'vaccination.create', displayName: 'Create Vaccinations', description: 'Create new vaccination records', resource: 'vaccination', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'VACCINATION_MANAGEMENT') },
      { name: 'vaccination.update', displayName: 'Update Vaccinations', description: 'Update vaccination records', resource: 'vaccination', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'VACCINATION_MANAGEMENT') },
      { name: 'vaccination.delete', displayName: 'Delete Vaccinations', description: 'Delete vaccination records', resource: 'vaccination', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'VACCINATION_MANAGEMENT') },
      { name: 'vaccination.export', displayName: 'Export Vaccinations', description: 'Export vaccination data', resource: 'vaccination', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'VACCINATION_MANAGEMENT') },

      // Medications
      { name: 'medication.read', displayName: 'Read Medications', description: 'View medication records', resource: 'medication', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'MEDICATION_MANAGEMENT') },
      { name: 'medication.create', displayName: 'Create Medications', description: 'Create new medication records', resource: 'medication', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'MEDICATION_MANAGEMENT') },
      { name: 'medication.update', displayName: 'Update Medications', description: 'Update medication records', resource: 'medication', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'MEDICATION_MANAGEMENT') },
      { name: 'medication.delete', displayName: 'Delete Medications', description: 'Delete medication records', resource: 'medication', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'MEDICATION_MANAGEMENT') },

      // Allergies
      { name: 'allergy.read', displayName: 'Read Allergies', description: 'View allergy records', resource: 'allergy', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'ALLERGY_MANAGEMENT') },
      { name: 'allergy.create', displayName: 'Create Allergies', description: 'Create new allergy records', resource: 'allergy', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'ALLERGY_MANAGEMENT') },
      { name: 'allergy.update', displayName: 'Update Allergies', description: 'Update allergy records', resource: 'allergy', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'ALLERGY_MANAGEMENT') },
      { name: 'allergy.delete', displayName: 'Delete Allergies', description: 'Delete allergy records', resource: 'allergy', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'ALLERGY_MANAGEMENT') },

      // Vet Visits
      { name: 'vet_visit.read', displayName: 'Read Vet Visits', description: 'View vet visit records', resource: 'vet_visit', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'VET_VISIT_MANAGEMENT') },
      { name: 'vet_visit.create', displayName: 'Create Vet Visits', description: 'Create new vet visit records', resource: 'vet_visit', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'VET_VISIT_MANAGEMENT') },
      { name: 'vet_visit.update', displayName: 'Update Vet Visits', description: 'Update vet visit records', resource: 'vet_visit', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'VET_VISIT_MANAGEMENT') },
      { name: 'vet_visit.delete', displayName: 'Delete Vet Visits', description: 'Delete vet visit records', resource: 'vet_visit', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'VET_VISIT_MANAGEMENT') },
      { name: 'vet_visit.export', displayName: 'Export Vet Visits', description: 'Export vet visit data', resource: 'vet_visit', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'VET_VISIT_MANAGEMENT') },

      // Surgeries
      { name: 'surgery.read', displayName: 'Read Surgeries', description: 'View surgery records', resource: 'surgery', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'SURGERY_MANAGEMENT') },
      { name: 'surgery.create', displayName: 'Create Surgeries', description: 'Create new surgery records', resource: 'surgery', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'SURGERY_MANAGEMENT') },
      { name: 'surgery.update', displayName: 'Update Surgeries', description: 'Update surgery records', resource: 'surgery', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'SURGERY_MANAGEMENT') },
      { name: 'surgery.delete', displayName: 'Delete Surgeries', description: 'Delete surgery records', resource: 'surgery', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'SURGERY_MANAGEMENT') },

      // Desexing
      { name: 'desexing.read', displayName: 'Read Desexing Records', description: 'View desexing records', resource: 'desexing', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'DESEXING_MANAGEMENT') },
      { name: 'desexing.create', displayName: 'Create Desexing Records', description: 'Create new desexing records', resource: 'desexing', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'DESEXING_MANAGEMENT') },
      { name: 'desexing.update', displayName: 'Update Desexing Records', description: 'Update desexing records', resource: 'desexing', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'DESEXING_MANAGEMENT') },
      { name: 'desexing.delete', displayName: 'Delete Desexing Records', description: 'Delete desexing records', resource: 'desexing', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'DESEXING_MANAGEMENT') },

      // Microchips
      { name: 'microchip.read', displayName: 'Read Microchips', description: 'View microchip records', resource: 'microchip', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'MICROCHIP_MANAGEMENT') },
      { name: 'microchip.create', displayName: 'Create Microchips', description: 'Create new microchip records', resource: 'microchip', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'MICROCHIP_MANAGEMENT') },
      { name: 'microchip.update', displayName: 'Update Microchips', description: 'Update microchip records', resource: 'microchip', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'MICROCHIP_MANAGEMENT') },
      { name: 'microchip.delete', displayName: 'Delete Microchips', description: 'Delete microchip records', resource: 'microchip', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'MICROCHIP_MANAGEMENT') },
      { name: 'microchip.export', displayName: 'Export Microchips', description: 'Export microchip data', resource: 'microchip', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'MICROCHIP_MANAGEMENT') },

      // Weight History
      { name: 'weight.read', displayName: 'Read Weight History', description: 'View weight records', resource: 'weight', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'WEIGHT_MANAGEMENT') },
      { name: 'weight.create', displayName: 'Create Weight Records', description: 'Create new weight records', resource: 'weight', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'WEIGHT_MANAGEMENT') },
      { name: 'weight.update', displayName: 'Update Weight Records', description: 'Update weight records', resource: 'weight', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'WEIGHT_MANAGEMENT') },
      { name: 'weight.delete', displayName: 'Delete Weight Records', description: 'Delete weight records', resource: 'weight', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'WEIGHT_MANAGEMENT') },
      { name: 'weight.export', displayName: 'Export Weight History', description: 'Export weight data', resource: 'weight', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'WEIGHT_MANAGEMENT') },

      // Health Documents
      { name: 'health_document.read', displayName: 'Read Health Documents', description: 'View health documents', resource: 'health_document', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'HEALTH_DOCUMENT_MANAGEMENT') },
      { name: 'health_document.upload', displayName: 'Upload Health Documents', description: 'Upload health documents', resource: 'health_document', action: 'upload', groupIndex: groupDefs.findIndex(g => g.name === 'HEALTH_DOCUMENT_MANAGEMENT') },
      { name: 'health_document.update', displayName: 'Update Health Documents', description: 'Update health document metadata', resource: 'health_document', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'HEALTH_DOCUMENT_MANAGEMENT') },
      { name: 'health_document.delete', displayName: 'Delete Health Documents', description: 'Delete health documents', resource: 'health_document', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'HEALTH_DOCUMENT_MANAGEMENT') },
      { name: 'health_document.download', displayName: 'Download Health Documents', description: 'Download health documents', resource: 'health_document', action: 'download', groupIndex: groupDefs.findIndex(g => g.name === 'HEALTH_DOCUMENT_MANAGEMENT') },
      { name: 'health_document.export', displayName: 'Export Health Documents', description: 'Export health document data', resource: 'health_document', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'HEALTH_DOCUMENT_MANAGEMENT') },

      // Website Content
      { name: 'content.read', displayName: 'Read Content', description: 'View website content', resource: 'content', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.create', displayName: 'Create Content', description: 'Create new website content', resource: 'content', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.update', displayName: 'Update Content', description: 'Update website content', resource: 'content', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.delete', displayName: 'Delete Content', description: 'Delete website content', resource: 'content', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.publish', displayName: 'Publish Content', description: 'Publish website content', resource: 'content', action: 'publish', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.unpublish', displayName: 'Unpublish Content', description: 'Unpublish website content', resource: 'content', action: 'unpublish', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.archive', displayName: 'Archive Content', description: 'Archive website content', resource: 'content', action: 'archive', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.restore', displayName: 'Restore Content', description: 'Restore archived content', resource: 'content', action: 'restore', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },
      { name: 'content.upload_media', displayName: 'Upload Media', description: 'Upload media files for content', resource: 'content', action: 'upload_media', groupIndex: groupDefs.findIndex(g => g.name === 'WEBSITE_CONTENT') },

      // Reports
      { name: 'report.read', displayName: 'Read Reports', description: 'View reports', resource: 'report', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'report.create', displayName: 'Create Reports', description: 'Generate new reports', resource: 'report', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'report.update', displayName: 'Update Reports', description: 'Modify report configurations', resource: 'report', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'report.delete', displayName: 'Delete Reports', description: 'Delete reports', resource: 'report', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },
      { name: 'report.export', displayName: 'Export Reports', description: 'Export report data', resource: 'report', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'REPORTS') },

      // System Configuration
      { name: 'system_config.read', displayName: 'Read System Config', description: 'View system configuration', resource: 'system_config', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },
      { name: 'system_config.update', displayName: 'Update System Config', description: 'Update system configuration', resource: 'system_config', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'SYSTEM_CONFIGURATION') },

      // Audit & Security
      { name: 'audit_log.read', displayName: 'Read Audit Logs', description: 'View audit log entries', resource: 'audit_log', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'AUDIT_SECURITY') },
      { name: 'audit_log.export', displayName: 'Export Audit Logs', description: 'Export audit log data', resource: 'audit_log', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'AUDIT_SECURITY') },
      { name: 'security_log.read', displayName: 'Read Security Logs', description: 'View security log entries', resource: 'security_log', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'AUDIT_SECURITY') },
      { name: 'security_log.export', displayName: 'Export Security Logs', description: 'Export security log data', resource: 'security_log', action: 'export', groupIndex: groupDefs.findIndex(g => g.name === 'AUDIT_SECURITY') },

      // Notifications
      { name: 'notification.read', displayName: 'Read Notifications', description: 'View notifications', resource: 'notification', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'NOTIFICATION_MANAGEMENT') },
      { name: 'notification.create', displayName: 'Create Notifications', description: 'Create new notifications', resource: 'notification', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'NOTIFICATION_MANAGEMENT') },
      { name: 'notification.update', displayName: 'Update Notifications', description: 'Modify notifications', resource: 'notification', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'NOTIFICATION_MANAGEMENT') },
      { name: 'notification.delete', displayName: 'Delete Notifications', description: 'Delete notifications', resource: 'notification', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'NOTIFICATION_MANAGEMENT') },
      { name: 'notification.send', displayName: 'Send Notifications', description: 'Send notifications to users', resource: 'notification', action: 'send', groupIndex: groupDefs.findIndex(g => g.name === 'NOTIFICATION_MANAGEMENT') },
      { name: 'notification.template_manage', displayName: 'Manage Templates', description: 'Create and edit notification templates', resource: 'notification', action: 'template_manage', groupIndex: groupDefs.findIndex(g => g.name === 'NOTIFICATION_MANAGEMENT') },

      // CMS — Pages
      { name: 'cms.page.read', displayName: 'Read Pages', description: 'View CMS pages', resource: 'cms.page', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.page.create', displayName: 'Create Pages', description: 'Create new CMS pages', resource: 'cms.page', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.page.update', displayName: 'Update Pages', description: 'Update CMS pages', resource: 'cms.page', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.page.delete', displayName: 'Delete Pages', description: 'Delete CMS pages', resource: 'cms.page', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.page.publish', displayName: 'Publish Pages', description: 'Publish CMS pages', resource: 'cms.page', action: 'publish', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Navigation
      { name: 'cms.navigation.read', displayName: 'Read Navigation', description: 'View CMS navigation menus', resource: 'cms.navigation', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.navigation.create', displayName: 'Create Navigation', description: 'Create CMS navigation menus', resource: 'cms.navigation', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.navigation.update', displayName: 'Update Navigation', description: 'Update CMS navigation menus', resource: 'cms.navigation', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.navigation.delete', displayName: 'Delete Navigation', description: 'Delete CMS navigation menus', resource: 'cms.navigation', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Footer
      { name: 'cms.footer.read', displayName: 'Read Footer', description: 'View CMS footer configurations', resource: 'cms.footer', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.footer.create', displayName: 'Create Footer', description: 'Create CMS footer configurations', resource: 'cms.footer', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.footer.update', displayName: 'Update Footer', description: 'Update CMS footer configurations', resource: 'cms.footer', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.footer.delete', displayName: 'Delete Footer', description: 'Delete CMS footer configurations', resource: 'cms.footer', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Media
      { name: 'cms.media.read', displayName: 'Read Media', description: 'View media library', resource: 'cms.media', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.media.upload', displayName: 'Upload Media', description: 'Upload files to media library', resource: 'cms.media', action: 'upload', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.media.update', displayName: 'Update Media', description: 'Update media metadata', resource: 'cms.media', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.media.delete', displayName: 'Delete Media', description: 'Delete media files', resource: 'cms.media', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Announcements
      { name: 'cms.announcement.read', displayName: 'Read Announcements', description: 'View announcements', resource: 'cms.announcement', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.announcement.create', displayName: 'Create Announcements', description: 'Create announcements', resource: 'cms.announcement', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.announcement.update', displayName: 'Update Announcements', description: 'Update announcements', resource: 'cms.announcement', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.announcement.delete', displayName: 'Delete Announcements', description: 'Delete announcements', resource: 'cms.announcement', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Redirects
      { name: 'cms.redirect.read', displayName: 'Read Redirects', description: 'View URL redirects', resource: 'cms.redirect', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.redirect.create', displayName: 'Create Redirects', description: 'Create URL redirects', resource: 'cms.redirect', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.redirect.update', displayName: 'Update Redirects', description: 'Update URL redirects', resource: 'cms.redirect', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.redirect.delete', displayName: 'Delete Redirects', description: 'Delete URL redirects', resource: 'cms.redirect', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Settings
      { name: 'cms.settings.read', displayName: 'Read CMS Settings', description: 'View CMS settings', resource: 'cms.settings', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.settings.update', displayName: 'Update CMS Settings', description: 'Update CMS settings', resource: 'cms.settings', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Email Templates
      { name: 'cms.email_template.read', displayName: 'Read Email Templates', description: 'View email templates', resource: 'cms.email_template', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.email_template.create', displayName: 'Create Email Templates', description: 'Create email templates', resource: 'cms.email_template', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.email_template.update', displayName: 'Update Email Templates', description: 'Update email templates', resource: 'cms.email_template', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.email_template.delete', displayName: 'Delete Email Templates', description: 'Delete email templates', resource: 'cms.email_template', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — SMS Templates
      { name: 'cms.sms_template.read', displayName: 'Read SMS Templates', description: 'View SMS templates', resource: 'cms.sms_template', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.sms_template.create', displayName: 'Create SMS Templates', description: 'Create SMS templates', resource: 'cms.sms_template', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.sms_template.update', displayName: 'Update SMS Templates', description: 'Update SMS templates', resource: 'cms.sms_template', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.sms_template.delete', displayName: 'Delete SMS Templates', description: 'Delete SMS templates', resource: 'cms.sms_template', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      // CMS — Pet References
      { name: 'cms.pet_reference.read', displayName: 'Read Pet References', description: 'View pet reference data', resource: 'cms.pet_reference', action: 'read', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.pet_reference.create', displayName: 'Create Pet References', description: 'Create pet reference data', resource: 'cms.pet_reference', action: 'create', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.pet_reference.update', displayName: 'Update Pet References', description: 'Update pet reference data', resource: 'cms.pet_reference', action: 'update', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
      { name: 'cms.pet_reference.delete', displayName: 'Delete Pet References', description: 'Delete pet reference data', resource: 'cms.pet_reference', action: 'delete', groupIndex: groupDefs.findIndex(g => g.name === 'CMS_MANAGEMENT') },
    ];

    const permMap: Record<string, string> = {};
    for (const p of permDefs) {
      const groupId = groupMap[groupDefs[p.groupIndex]?.name];
      if (!groupId) {
        console.error(`  ERROR: No group mapping for ${p.name}`);
        continue;
      }
      const existing = await Permission.findOne({ name: p.name }).session(session);
      if (existing) {
        permMap[p.name] = existing._id.toString();
      } else {
        const created = await Permission.create([{
          name: p.name,
          displayName: p.displayName,
          description: p.description,
          resource: p.resource,
          action: p.action,
          permissionGroupId: groupId,
          isActive: true,
        }], { session });
        permMap[p.name] = created[0]._id.toString();
      }
    }
    console.log(`  ${Object.keys(permMap).length} permissions ready`);

    // ── 4. Roles ──
    console.log('\n--- Seeding Roles ---');
    const roleDefs = [
      { name: 'SUPER_ADMIN', displayName: 'Super Admin', description: 'Full unrestricted platform access', roleType: 'system', isSystemRole: true, isSuperAdmin: true },
      { name: 'ADMIN', displayName: 'Admin', description: 'Manage platform and business operations', roleType: 'system', isSystemRole: true, isSuperAdmin: false },
      { name: 'CUSTOMER_SERVICE', displayName: 'Customer Service', description: 'Manage customer support operations', roleType: 'system', isSystemRole: true, isSuperAdmin: false },
      { name: 'PET_OWNER', displayName: 'Pet Owner', description: 'Manage own pets and data', roleType: 'system', isSystemRole: true, isSuperAdmin: false },
      { name: 'CUSTOMER', displayName: 'Customer', description: 'Site visitor who becomes a customer — manages own pets, browses shop, and places orders', roleType: 'system', isSystemRole: true, isSuperAdmin: false },
      { name: 'WEBSITE_EDITOR', displayName: 'Website Editor', description: 'Manage public website content', roleType: 'system', isSystemRole: true, isSuperAdmin: false },
    ];

    const roleMap: Record<string, string> = {};
    for (const r of roleDefs) {
      const existing = await Role.findOne({ name: r.name }).session(session);
      if (existing) {
        roleMap[r.name] = existing._id.toString();
      } else {
        const created = await Role.create([r], { session });
        roleMap[r.name] = created[0]._id.toString();
      }
    }
    console.log(`  ${Object.keys(roleMap).length} roles ready`);

    // ── 5. Role-Permission Assignments ──
    console.log('\n--- Assigning Permissions to Roles ---');

    const rolePermAssignments: Record<string, RolePermDef[]> = {
      // Super Admin gets no explicit permissions (isSuperAdmin bypass)
      SUPER_ADMIN: [],

      ADMIN: [
        // Dashboard & Analytics
        { permissionName: 'dashboard.read' },
        { permissionName: 'stats.read' },
        // User Management
        { permissionName: 'user.read' },
        { permissionName: 'user.create' },
        { permissionName: 'user.update' },
        { permissionName: 'user.activate' },
        { permissionName: 'user.deactivate' },
        { permissionName: 'user.invite' },
        { permissionName: 'user.assign_role' },
        // Customer Management
        { permissionName: 'customer.read' },
        { permissionName: 'customer.create' },
        { permissionName: 'customer.update' },
        { permissionName: 'customer.activate' },
        { permissionName: 'customer.deactivate' },
        // Pet Management
        { permissionName: 'pet.read' },
        { permissionName: 'pet.create' },
        { permissionName: 'pet.update' },
        { permissionName: 'pet.archive' },
        { permissionName: 'pet.restore' },
        // Tag Management
        { permissionName: 'tag.read' },
        { permissionName: 'tag.create' },
        { permissionName: 'tag.update' },
        { permissionName: 'tag.delete' },
        { permissionName: 'tag.generate_qr' },
        { permissionName: 'tag.generate_sticker' },
        // Health Records
        { permissionName: 'medical_record.read' },
        { permissionName: 'medical_record.create' },
        { permissionName: 'medical_record.update' },
        // Vaccinations
        { permissionName: 'vaccination.read' },
        { permissionName: 'vaccination.create' },
        { permissionName: 'vaccination.update' },
        // Microchips
        { permissionName: 'microchip.read' },
        { permissionName: 'microchip.create' },
        { permissionName: 'microchip.update' },
        // Product Management
        { permissionName: 'product.read' },
        { permissionName: 'product.create' },
        { permissionName: 'product.update' },
        { permissionName: 'product.delete' },
        // Order Management
        { permissionName: 'order.read' },
        { permissionName: 'order.update' },
        // Reports
        { permissionName: 'report.read' },
        { permissionName: 'report.create' },
        { permissionName: 'report.export' },
        // Content
        { permissionName: 'content.read' },
        { permissionName: 'content.create' },
        { permissionName: 'content.update' },
        { permissionName: 'content.publish' },
        // Settings
        { permissionName: 'setting.read' },
        { permissionName: 'setting.create' },
        { permissionName: 'setting.update' },
        // Feature Flags
        { permissionName: 'feature_flag.read' },
        { permissionName: 'feature_flag.create' },
        { permissionName: 'feature_flag.update' },
        // Audit
        { permissionName: 'audit_log.read' },
        // Finder Scans
        { permissionName: 'finder_scan.read' },
        // Location Events
        { permissionName: 'location_event.read' },
        // Roles (read only)
        { permissionName: 'role.read' },
        // Permissions (read only)
        { permissionName: 'permission.read' },
        { permissionName: 'permission_group.read' },
        // System Config (read only)
        { permissionName: 'system_config.read' },
        // Notifications
        { permissionName: 'notification.read' },
        { permissionName: 'notification.create' },
        { permissionName: 'notification.update' },
        { permissionName: 'notification.send' },
        // CMS
        { permissionName: 'cms.page.read' },
        { permissionName: 'cms.page.create' },
        { permissionName: 'cms.page.update' },
        { permissionName: 'cms.page.delete' },
        { permissionName: 'cms.page.publish' },
        { permissionName: 'cms.navigation.read' },
        { permissionName: 'cms.navigation.create' },
        { permissionName: 'cms.navigation.update' },
        { permissionName: 'cms.navigation.delete' },
        { permissionName: 'cms.footer.read' },
        { permissionName: 'cms.footer.create' },
        { permissionName: 'cms.footer.update' },
        { permissionName: 'cms.footer.delete' },
        { permissionName: 'cms.media.read' },
        { permissionName: 'cms.media.upload' },
        { permissionName: 'cms.media.update' },
        { permissionName: 'cms.media.delete' },
        { permissionName: 'cms.announcement.read' },
        { permissionName: 'cms.announcement.create' },
        { permissionName: 'cms.announcement.update' },
        { permissionName: 'cms.announcement.delete' },
        { permissionName: 'cms.redirect.read' },
        { permissionName: 'cms.redirect.create' },
        { permissionName: 'cms.redirect.update' },
        { permissionName: 'cms.redirect.delete' },
        { permissionName: 'cms.settings.read' },
        { permissionName: 'cms.settings.update' },
        { permissionName: 'cms.email_template.read' },
        { permissionName: 'cms.email_template.create' },
        { permissionName: 'cms.email_template.update' },
        { permissionName: 'cms.email_template.delete' },
        { permissionName: 'cms.sms_template.read' },
        { permissionName: 'cms.sms_template.create' },
        { permissionName: 'cms.sms_template.update' },
        { permissionName: 'cms.sms_template.delete' },
        { permissionName: 'cms.pet_reference.read' },
        { permissionName: 'cms.pet_reference.create' },
        { permissionName: 'cms.pet_reference.update' },
        { permissionName: 'cms.pet_reference.delete' },
      ],

      CUSTOMER_SERVICE: [
        { permissionName: 'customer.read' },
        { permissionName: 'customer.update' },
        { permissionName: 'customer.view_activity' },
        { permissionName: 'pet.read' },
        { permissionName: 'pet.update' },
        { permissionName: 'tag.read' },
        { permissionName: 'medical_record.read' },
        { permissionName: 'vaccination.read' },
        { permissionName: 'microchip.read' },
        { permissionName: 'health_document.read' },
        { permissionName: 'health_document.download' },
        { permissionName: 'user.read' },
        { permissionName: 'order.read' },
        { permissionName: 'finder_scan.read' },
      ],

      PET_OWNER: [
        { permissionName: 'customer.read', scopeCode: 'OWN' },
        { permissionName: 'customer.update', scopeCode: 'OWN' },
        { permissionName: 'pet.read', scopeCode: 'OWN' },
        { permissionName: 'pet.create', scopeCode: 'OWN' },
        { permissionName: 'pet.update', scopeCode: 'OWN' },
        { permissionName: 'pet.delete', scopeCode: 'OWN' },
        { permissionName: 'tag.read', scopeCode: 'OWN' },
        { permissionName: 'medical_record.read', scopeCode: 'OWN' },
        { permissionName: 'vaccination.read', scopeCode: 'OWN' },
        { permissionName: 'medication.read', scopeCode: 'OWN' },
        { permissionName: 'allergy.read', scopeCode: 'OWN' },
        { permissionName: 'vet_visit.read', scopeCode: 'OWN' },
        { permissionName: 'surgery.read', scopeCode: 'OWN' },
        { permissionName: 'desexing.read', scopeCode: 'OWN' },
        { permissionName: 'microchip.read', scopeCode: 'OWN' },
        { permissionName: 'weight.read', scopeCode: 'OWN' },
        { permissionName: 'weight.create', scopeCode: 'OWN' },
        { permissionName: 'health_document.read', scopeCode: 'OWN' },
        { permissionName: 'health_document.upload', scopeCode: 'OWN' },
        { permissionName: 'health_document.download', scopeCode: 'OWN' },
        { permissionName: 'order.read', scopeCode: 'OWN' },
        { permissionName: 'notification.read', scopeCode: 'OWN' },
        { permissionName: 'notification.update', scopeCode: 'OWN' },
      ],

      CUSTOMER: [
        // Profile (own)
        { permissionName: 'customer.read', scopeCode: 'OWN' },
        { permissionName: 'customer.update', scopeCode: 'OWN' },
        // Pets (own) — full CRUD
        { permissionName: 'pet.read', scopeCode: 'OWN' },
        { permissionName: 'pet.create', scopeCode: 'OWN' },
        { permissionName: 'pet.update', scopeCode: 'OWN' },
        { permissionName: 'pet.delete', scopeCode: 'OWN' },
        // Tags (own)
        { permissionName: 'tag.read', scopeCode: 'OWN' },
        // Health Records (own)
        { permissionName: 'medical_record.read', scopeCode: 'OWN' },
        { permissionName: 'medical_record.create', scopeCode: 'OWN' },
        { permissionName: 'medical_record.update', scopeCode: 'OWN' },
        // Vaccinations (own)
        { permissionName: 'vaccination.read', scopeCode: 'OWN' },
        { permissionName: 'vaccination.create', scopeCode: 'OWN' },
        { permissionName: 'vaccination.update', scopeCode: 'OWN' },
        // Medications (own)
        { permissionName: 'medication.read', scopeCode: 'OWN' },
        { permissionName: 'medication.create', scopeCode: 'OWN' },
        { permissionName: 'medication.update', scopeCode: 'OWN' },
        // Allergies (own)
        { permissionName: 'allergy.read', scopeCode: 'OWN' },
        { permissionName: 'allergy.create', scopeCode: 'OWN' },
        { permissionName: 'allergy.update', scopeCode: 'OWN' },
        // Vet Visits (own)
        { permissionName: 'vet_visit.read', scopeCode: 'OWN' },
        { permissionName: 'vet_visit.create', scopeCode: 'OWN' },
        { permissionName: 'vet_visit.update', scopeCode: 'OWN' },
        // Surgeries (own)
        { permissionName: 'surgery.read', scopeCode: 'OWN' },
        // Desexing (own)
        { permissionName: 'desexing.read', scopeCode: 'OWN' },
        // Microchips (own)
        { permissionName: 'microchip.read', scopeCode: 'OWN' },
        // Weight (own)
        { permissionName: 'weight.read', scopeCode: 'OWN' },
        { permissionName: 'weight.create', scopeCode: 'OWN' },
        // Health Documents (own)
        { permissionName: 'health_document.read', scopeCode: 'OWN' },
        { permissionName: 'health_document.upload', scopeCode: 'OWN' },
        { permissionName: 'health_document.download', scopeCode: 'OWN' },
        // Products — browse shop
        { permissionName: 'product.read' },
        // Orders (own)
        { permissionName: 'order.read', scopeCode: 'OWN' },
        { permissionName: 'order.create', scopeCode: 'OWN' },
        { permissionName: 'order.update', scopeCode: 'OWN' },
        // Finder — scan tags when finding pets
        { permissionName: 'finder_scan.read' },
        { permissionName: 'location_event.read' },
        // Notifications (own)
        { permissionName: 'notification.read', scopeCode: 'OWN' },
        { permissionName: 'notification.update', scopeCode: 'OWN' },
      ],

      WEBSITE_EDITOR: [
        { permissionName: 'content.read' },
        { permissionName: 'content.create' },
        { permissionName: 'content.update' },
        { permissionName: 'content.delete' },
        { permissionName: 'content.publish' },
        { permissionName: 'content.unpublish' },
        { permissionName: 'content.archive' },
        { permissionName: 'content.restore' },
        { permissionName: 'content.upload_media' },
        // CMS
        { permissionName: 'cms.page.read' },
        { permissionName: 'cms.page.create' },
        { permissionName: 'cms.page.update' },
        { permissionName: 'cms.page.delete' },
        { permissionName: 'cms.page.publish' },
        { permissionName: 'cms.navigation.read' },
        { permissionName: 'cms.navigation.create' },
        { permissionName: 'cms.navigation.update' },
        { permissionName: 'cms.navigation.delete' },
        { permissionName: 'cms.footer.read' },
        { permissionName: 'cms.footer.create' },
        { permissionName: 'cms.footer.update' },
        { permissionName: 'cms.footer.delete' },
        { permissionName: 'cms.media.read' },
        { permissionName: 'cms.media.upload' },
        { permissionName: 'cms.media.update' },
        { permissionName: 'cms.media.delete' },
        { permissionName: 'cms.announcement.read' },
        { permissionName: 'cms.announcement.create' },
        { permissionName: 'cms.announcement.update' },
        { permissionName: 'cms.announcement.delete' },
        { permissionName: 'cms.redirect.read' },
        { permissionName: 'cms.redirect.create' },
        { permissionName: 'cms.redirect.update' },
        { permissionName: 'cms.redirect.delete' },
        { permissionName: 'cms.settings.read' },
        { permissionName: 'cms.settings.update' },
        { permissionName: 'cms.email_template.read' },
        { permissionName: 'cms.email_template.create' },
        { permissionName: 'cms.email_template.update' },
        { permissionName: 'cms.email_template.delete' },
        { permissionName: 'cms.sms_template.read' },
        { permissionName: 'cms.sms_template.create' },
        { permissionName: 'cms.sms_template.update' },
        { permissionName: 'cms.sms_template.delete' },
        { permissionName: 'cms.pet_reference.read' },
        { permissionName: 'cms.pet_reference.create' },
        { permissionName: 'cms.pet_reference.update' },
        { permissionName: 'cms.pet_reference.delete' },
      ],
    };

    let assignmentCount = 0;
    for (const [roleName, perms] of Object.entries(rolePermAssignments)) {
      const roleId = roleMap[roleName];
      if (!roleId) continue;

      for (const rp of perms) {
        const permId = permMap[rp.permissionName];
        if (!permId) {
          console.warn(`  WARNING: Permission "${rp.permissionName}" not found, skipping for ${roleName}`);
          continue;
        }

        const existingAssign = await RolePermission.findOne({
          roleId,
          permissionId: permId,
        }).session(session);

        if (existingAssign) {
          if (rp.scopeCode && scopeMap[rp.scopeCode]) {
            existingAssign.scopeId = scopeMap[rp.scopeCode] as any;
            await existingAssign.save({ session });
          }
          continue;
        }

        await RolePermission.create([{
          roleId,
          permissionId: permId,
          scopeId: rp.scopeCode ? scopeMap[rp.scopeCode] : undefined,
        }], { session });
        assignmentCount++;
      }
    }
    console.log(`  ${assignmentCount} new role-permission assignments created`);

    // ── 6. Bootstrap Admin User ──
    console.log('\n--- Bootstrapping Admin User ---');
    const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@pawtag.co.nz').toLowerCase();
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'PawTagAdmin2024!';

    let adminUser = await User.findOne({ email: adminEmail }).session(session);

    if (!adminUser) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      adminUser = (await User.create([{
        email: adminEmail,
        passwordHash,
        fullName: 'Super Admin',
        phoneNumber: '+64000000000',
        role: 'super_admin',
        status: 'active',
        emailVerified: true,
        phoneVerified: false,
      }], { session }))[0];
      console.log(`  Created admin user: ${adminEmail}`);
    } else {
      console.log(`  Admin user already exists: ${adminEmail}`);
    }

    // Assign Super Admin role to admin user
    const superAdminRoleId = roleMap['SUPER_ADMIN'];
    if (superAdminRoleId) {
      const existingAssignment = await UserRole.findOne({
        userId: adminUser._id,
        roleId: superAdminRoleId,
      }).session(session);

      if (!existingAssignment) {
        await UserRole.create([{
          userId: adminUser._id,
          roleId: superAdminRoleId,
          assignedBy: adminUser._id,
          isActive: true,
        }], { session });
        console.log('  Assigned Super Admin role to admin user');
      } else if (!existingAssignment.isActive) {
        existingAssignment.isActive = true;
        await existingAssignment.save({ session });
        console.log('  Reactivated Super Admin role for admin user');
      } else {
        console.log('  Super Admin role already assigned');
      }
    }

    // ── 7. Bootstrap Test Customer ──
    console.log('\n--- Bootstrapping Test Customer ---');
    const testCustomerEmail = 'john@example.com';
    const testCustomerPassword = 'TestPass123!';

    let testCustomer = await User.findOne({ email: testCustomerEmail }).session(session);

    if (!testCustomer) {
      const passwordHash = await bcrypt.hash(testCustomerPassword, 12);
      testCustomer = (await User.create([{
        email: testCustomerEmail,
        passwordHash,
        fullName: 'John Smith',
        phoneNumber: '+64211234567',
        role: 'customer',
        status: 'active',
        emailVerified: true,
        phoneVerified: false,
      }], { session }))[0];
      console.log(`  Created test customer: ${testCustomerEmail}`);
    } else {
      console.log(`  Test customer already exists: ${testCustomerEmail}`);
    }

    // Assign CUSTOMER role to test customer
    const customerRoleId = roleMap['CUSTOMER'];
    if (customerRoleId && testCustomer) {
      const existingCustomerRole = await UserRole.findOne({
        userId: testCustomer._id,
        roleId: customerRoleId,
      }).session(session);

      if (!existingCustomerRole) {
        await UserRole.create([{
          userId: testCustomer._id,
          roleId: customerRoleId,
          assignedBy: adminUser._id,
          isActive: true,
        }], { session });
        console.log('  Assigned CUSTOMER role to test customer');
      } else if (!existingCustomerRole.isActive) {
        existingCustomerRole.isActive = true;
        await existingCustomerRole.save({ session });
        console.log('  Reactivated CUSTOMER role for test customer');
      } else {
        console.log('  CUSTOMER role already assigned to test customer');
      }
    }

    await session.commitTransaction();
    console.log('\n✅ Seed completed successfully!\n');

  } catch (error) {
    await session.abortTransaction();
    console.error('\n❌ Seed failed:', error);
    throw error;
  } finally {
    session.endSession();
    await disconnectDatabase();
  }
}

seed().catch((error: Error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
