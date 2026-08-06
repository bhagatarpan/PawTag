import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../packages/api/src/config';

/**
 * Create a user with full super-admin RBAC setup.
 * This creates Role (isSuperAdmin), UserRole, and assigns to user.
 * All permission checks will be bypassed for super admins.
 */
export async function createSuperAdmin(overrides: Partial<{ email: string; password: string; fullName: string; phoneNumber: string; role: string }> = {}) {
  const email = overrides.email || 'admin@example.com';
  const password = overrides.password || 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Test Admin',
    phoneNumber: overrides.phoneNumber || '+64210000000',
    role: overrides.role || 'admin',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = user.insertedId.toString();

  // Create a super admin role
  const role = await mongoose.connection.collections.roles.insertOne({
    name: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Full system access',
    roleType: 'system',
    isSystemRole: true,
    isSuperAdmin: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const roleId = role.insertedId.toString();

  // Link user to role
  await mongoose.connection.collections.userroles.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleId: new mongoose.Types.ObjectId(roleId),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const token = jwt.sign(
    { id: userId, email, role: overrides.role || 'admin' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  return { userId, token, email, roleId };
}

/**
 * Create a regular customer user (no RBAC roles — only works on non-RBAC-protected routes or needs direct DB setup).
 */
export async function createCustomer(overrides: Partial<{ email: string; password: string; fullName: string; phoneNumber: string }> = {}) {
  const email = overrides.email || 'customer@example.com';
  const password = overrides.password || 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Test Customer',
    phoneNumber: overrides.phoneNumber || '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = user.insertedId.toString();
  const token = jwt.sign(
    { id: userId, email, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  return { userId, token, email };
}

/**
 * Create a customer with full RBAC setup (for customer-protected routes).
 */
export async function createCustomerWithRBAC(overrides: Partial<{ email: string; fullName: string }> = {}) {
  const email = overrides.email || 'customer@example.com';
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Test Customer',
    phoneNumber: '+64219999999',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = user.insertedId.toString();

  // Create customer role (reuse if exists to avoid duplicate key errors)
  let role = await mongoose.connection.collections.roles.findOne({ name: 'CUSTOMER' });
  if (!role) {
    const result = await mongoose.connection.collections.roles.insertOne({
      name: 'CUSTOMER',
      displayName: 'Customer',
      description: 'Standard customer',
      roleType: 'system',
      isSystemRole: true,
      isSuperAdmin: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    role = await mongoose.connection.collections.roles.findOne({ _id: result.insertedId });
  }

  const roleId = role!._id.toString();

  // Create permissions needed for customer routes
  const permNames = [
    'pet.read', 'pet.create', 'pet.update', 'pet.delete',
    'tag.read',
    'order.read', 'order.create',
    'notification.read', 'notification.update',
    'customer.read',
    'subscription.read', 'subscription.update',
  ];

  const permIds: string[] = [];
  for (const permName of permNames) {
    const [resource, action] = permName.split('.');
    const perm = await mongoose.connection.collections.permissions.insertOne({
      name: permName,
      displayName: permName,
      resource,
      action,
      permissionGroupId: new mongoose.Types.ObjectId(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    permIds.push(perm.insertedId.toString());
  }

  // Link role to all permissions
  for (const permId of permIds) {
    await mongoose.connection.collections.rolepermissions.insertOne({
      roleId: new mongoose.Types.ObjectId(roleId),
      permissionId: new mongoose.Types.ObjectId(permId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Link user to role
  await mongoose.connection.collections.userroles.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleId: new mongoose.Types.ObjectId(roleId),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const token = jwt.sign(
    { id: userId, email, role: 'customer' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  return { userId, token, email };
}

export async function createPet(ownerId: string, overrides: Record<string, any> = {}) {
  const pet = await mongoose.connection.collections.pets.insertOne({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    petId: overrides.petId || 'PET-TEST-001',
    name: overrides.name || 'Buddy',
    petType: overrides.petType || 'Dog',
    species: overrides.species || 'dog',
    breed: overrides.breed || 'Golden Retriever',
    color: overrides.color || 'Golden',
    gender: overrides.gender || 'male',
    status: overrides.status || 'safe',
    lostCount: overrides.lostCount || 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return pet.insertedId.toString();
}

export async function createTag(ownerId: string, petId: string, overrides: Record<string, any> = {}) {
  const tag = await mongoose.connection.collections.tags.insertOne({
    tagId: overrides.tagId || 'TAG-TEST-001',
    petId: new mongoose.Types.ObjectId(petId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    status: overrides.status || 'active',
    tagType: 'qr',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return tag.insertedId.toString();
}
