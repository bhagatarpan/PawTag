import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createPetSchema,
  updatePetSchema,
  createProductSchema,
  updateProductSchema,
  createSettingSchema,
  updateUserStatusSchema,
  updateUserSchema,
  createTagSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../packages/api/src/middleware/schemas';

function validRegister() {
  return {
    email: 'test@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    fullName: 'John Doe',
    phoneNumber: '0211234567',
    acceptTerms: true as const,
  };
}

function validProduct() {
  return {
    name: 'QR Tag',
    description: 'A QR code tag for pets',
    price: 29.99,
    category: 'Tags',
    stock: 100,
    sku: 'TAG-001',
  };
}

function validPet() {
  return {
    name: 'Buddy',
    species: 'Canine',
    breed: 'Labrador',
    color: 'Golden',
  };
}

describe('registerSchema', () => {
  it('passes with valid data', () => {
    const result = registerSchema.safeParse(validRegister());
    expect(result.success).toBe(true);
  });

  it('fails with missing email', () => {
    const data = { ...validRegister(), email: '' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails with invalid email', () => {
    const data = { ...validRegister(), email: 'not-an-email' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails with short password', () => {
    const data = { ...validRegister(), password: 'short', confirmPassword: 'short' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails when passwords do not match', () => {
    const data = { ...validRegister(), confirmPassword: 'different123' };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain('Passwords do not match');
    }
  });

  it('fails when acceptTerms is false', () => {
    const data = { ...validRegister(), acceptTerms: false as const };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails with missing fullName', () => {
    const data = { ...validRegister(), fullName: '' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing uppercase', () => {
    const data = { ...validRegister(), password: 'password123!', confirmPassword: 'password123!' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing lowercase', () => {
    const data = { ...validRegister(), password: 'PASSWORD123!', confirmPassword: 'PASSWORD123!' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing digit', () => {
    const data = { ...validRegister(), password: 'PasswordWord!', confirmPassword: 'PasswordWord!' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing special character', () => {
    const data = { ...validRegister(), password: 'PasswordWord123', confirmPassword: 'PasswordWord123' };
    expect(registerSchema.safeParse(data).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('passes with valid email and password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'pass' }).success).toBe(true);
  });

  it('fails with missing password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('fails with invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'pass' }).success).toBe(false);
  });
});

describe('createPetSchema', () => {
  it('passes with valid pet data', () => {
    expect(createPetSchema.safeParse(validPet()).success).toBe(true);
  });

  it('fails with missing name', () => {
    const data = { ...validPet(), name: '' };
    expect(createPetSchema.safeParse(data).success).toBe(false);
  });

  it('fails with missing species', () => {
    const data = { ...validPet(), species: '' };
    expect(createPetSchema.safeParse(data).success).toBe(false);
  });

  it('fails with missing breed', () => {
    const data = { ...validPet(), breed: '' };
    expect(createPetSchema.safeParse(data).success).toBe(false);
  });

  it('fails with missing color', () => {
    const data = { ...validPet(), color: '' };
    expect(createPetSchema.safeParse(data).success).toBe(false);
  });

  it('accepts optional fields', () => {
    const data = { ...validPet(), petType: 'Dog' as const, gender: 'male' as const, age: 3 };
    expect(createPetSchema.safeParse(data).success).toBe(true);
  });
});

describe('updatePetSchema', () => {
  it('passes with partial update', () => {
    expect(updatePetSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  it('passes with empty object', () => {
    expect(updatePetSchema.safeParse({}).success).toBe(true);
  });

  it('fails with invalid petType', () => {
    expect(updatePetSchema.safeParse({ petType: 'Fish' }).success).toBe(false);
  });
});

describe('createProductSchema', () => {
  it('passes with valid product', () => {
    expect(createProductSchema.safeParse(validProduct()).success).toBe(true);
  });

  it('fails with missing name', () => {
    const data = { ...validProduct(), name: '' };
    expect(createProductSchema.safeParse(data).success).toBe(false);
  });

  it('fails with negative price', () => {
    const data = { ...validProduct(), price: -5 };
    expect(createProductSchema.safeParse(data).success).toBe(false);
  });

  it('fails with zero price', () => {
    const data = { ...validProduct(), price: 0 };
    expect(createProductSchema.safeParse(data).success).toBe(false);
  });
});

describe('updateProductSchema', () => {
  it('passes with partial update', () => {
    expect(updateProductSchema.safeParse({ name: 'Updated' }).success).toBe(true);
  });

  it('passes with empty object', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(true);
  });
});

describe('createSettingSchema', () => {
  it('passes with valid setting', () => {
    const data = { key: 'site.name', value: 'PawTag', category: 'general' };
    expect(createSettingSchema.safeParse(data).success).toBe(true);
  });

  it('fails with missing key', () => {
    expect(createSettingSchema.safeParse({ key: '', value: 'v', category: 'c' }).success).toBe(false);
  });

  it('fails with missing value', () => {
    expect(createSettingSchema.safeParse({ key: 'k', value: '', category: 'c' }).success).toBe(false);
  });
});

describe('updateUserStatusSchema', () => {
  it('passes with valid status "active"', () => {
    expect(updateUserStatusSchema.safeParse({ status: 'active' }).success).toBe(true);
  });

  it('passes with valid status "suspended"', () => {
    expect(updateUserStatusSchema.safeParse({ status: 'suspended' }).success).toBe(true);
  });

  it('passes with valid status "pending_verification"', () => {
    expect(updateUserStatusSchema.safeParse({ status: 'pending_verification' }).success).toBe(true);
  });

  it('fails with invalid status', () => {
    expect(updateUserStatusSchema.safeParse({ status: 'banned' }).success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('passes with partial update', () => {
    expect(updateUserSchema.safeParse({ fullName: 'Jane' }).success).toBe(true);
  });

  it('passes with empty object', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });

  it('fails with invalid email', () => {
    expect(updateUserSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

describe('createTagSchema', () => {
  it('passes with valid tag data', () => {
    const data = { petId: 'pet1', ownerId: 'user1', tagId: 'PT-123456' };
    expect(createTagSchema.safeParse(data).success).toBe(true);
  });

  it('passes without optional tagId', () => {
    const data = { petId: 'pet1', ownerId: 'user1' };
    expect(createTagSchema.safeParse(data).success).toBe(true);
  });

  it('fails with bad tagId format', () => {
    const data = { petId: 'pet1', ownerId: 'user1', tagId: 'BAD-FORMAT' };
    expect(createTagSchema.safeParse(data).success).toBe(false);
  });

  it('fails with tagId missing PT prefix', () => {
    const data = { petId: 'pet1', ownerId: 'user1', tagId: '123456' };
    expect(createTagSchema.safeParse(data).success).toBe(false);
  });

  it('fails with missing petId', () => {
    const data = { ownerId: 'user1' };
    expect(createTagSchema.safeParse(data).success).toBe(false);
  });

  it('fails with missing ownerId', () => {
    const data = { petId: 'pet1' };
    expect(createTagSchema.safeParse(data).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('passes with valid passwords', () => {
    const data = { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' };
    expect(changePasswordSchema.safeParse(data).success).toBe(true);
  });

  it('fails with short new password', () => {
    const data = { currentPassword: 'OldPass123!', newPassword: 'short' };
    expect(changePasswordSchema.safeParse(data).success).toBe(false);
  });

  it('fails with missing current password', () => {
    const data = { currentPassword: '', newPassword: 'NewPass123!' };
    expect(changePasswordSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing uppercase', () => {
    const data = { currentPassword: 'OldPass123!', newPassword: 'newpass123!' };
    expect(changePasswordSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing lowercase', () => {
    const data = { currentPassword: 'OldPass123!', newPassword: 'NEWPASS123!' };
    expect(changePasswordSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing digit', () => {
    const data = { currentPassword: 'OldPass123!', newPassword: 'NewPassWord!' };
    expect(changePasswordSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing special character', () => {
    const data = { currentPassword: 'OldPass123!', newPassword: 'NewPassWord123' };
    expect(changePasswordSchema.safeParse(data).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('passes with partial update', () => {
    expect(updateProfileSchema.safeParse({ fullName: 'Jane' }).success).toBe(true);
  });

  it('passes with empty object', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it('passes with nested address', () => {
    const data = { address: { line1: '123 Main St', city: 'Auckland' } };
    expect(updateProfileSchema.safeParse(data).success).toBe(true);
  });

  it('passes with nested emergencyContact', () => {
    const data = { emergencyContact: { name: 'Jane', phone: '0211234567', relationship: 'Spouse' } };
    expect(updateProfileSchema.safeParse(data).success).toBe(true);
  });

  it('fails with invalid email', () => {
    expect(updateProfileSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('passes with valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('fails with invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('fails with missing email', () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('passes with valid token and password', () => {
    const data = { token: 'valid-token-abc123', newPassword: 'NewPass123!' };
    expect(resetPasswordSchema.safeParse(data).success).toBe(true);
  });

  it('fails with missing token', () => {
    const data = { token: '', newPassword: 'NewPass123!' };
    expect(resetPasswordSchema.safeParse(data).success).toBe(false);
  });

  it('fails with weak password', () => {
    const data = { token: 'valid-token', newPassword: 'short' };
    expect(resetPasswordSchema.safeParse(data).success).toBe(false);
  });

  it('fails with password missing complexity', () => {
    const data = { token: 'valid-token', newPassword: 'alllowercase1!' };
    expect(resetPasswordSchema.safeParse(data).success).toBe(false);
  });
});
