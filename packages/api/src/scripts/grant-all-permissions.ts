import { connectDatabase, User, UserRole, Role, Permission, RolePermission } from '@pawtag/db';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function grantAllPermissionsToAdmin() {
  console.log('🔐 Granting all permissions to admin...\n');

  // Find admin user
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@pawtag.co.nz';
  const admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    console.error(`❌ Admin user not found: ${adminEmail}`);
    return;
  }
  console.log(`  Found admin: ${admin.email} (${admin._id})`);

  // Find SUPER_ADMIN role
  const superAdminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
  if (!superAdminRole) {
    console.error('❌ SUPER_ADMIN role not found');
    return;
  }
  console.log(`  Found SUPER_ADMIN role: ${superAdminRole._id}`);

  // Check if admin already has SUPER_ADMIN role
  const existingAssignment = await UserRole.findOne({
    userId: admin._id,
    roleId: superAdminRole._id,
  });

  if (existingAssignment) {
    console.log('  Admin already has SUPER_ADMIN role');
  } else {
    // Assign SUPER_ADMIN role
    await UserRole.create({
      userId: admin._id,
      roleId: superAdminRole._id,
      isActive: true,
    });
    console.log('  ✅ Assigned SUPER_ADMIN role to admin');
  }

  // Also ensure legacy role field is set
  if (admin.role !== 'super_admin') {
    await User.findByIdAndUpdate(admin._id, { role: 'super_admin' });
    console.log('  ✅ Updated legacy role field to super_admin');
  }

  // Count permissions
  const permissionCount = await Permission.countDocuments();
  const rolePermissionCount = await RolePermission.countDocuments({ roleId: superAdminRole._id });

  console.log(`\n📊 Summary:`);
  console.log(`  Total permissions in system: ${permissionCount}`);
  console.log(`  SUPER_ADMIN role permissions: ${rolePermissionCount}`);
  console.log(`  Admin has SUPER_ADMIN role: ✅`);
  console.log(`  Admin bypasses all permission checks: ✅ (isSuperAdmin: true)`);
}

// Run
connectDatabase()
  .then(() => grantAllPermissionsToAdmin())
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
