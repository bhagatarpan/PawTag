import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  phoneNumber: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  address: z
    .object({
      line1: z.string().min(1).optional(),
      line2: z.string().optional(),
      city: z.string().min(1).optional(),
      state: z.string().min(1).optional(),
      zip: z.string().min(1).optional(),
      country: z.string().min(1).optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1).optional(),
      phone: z.string().min(1).optional(),
      email: z.string().email().optional(),
      relationship: z.string().min(1).optional(),
    })
    .optional(),
});

const petPhotoSchema = z.object({
  url: z.string().url('Valid photo URL is required'),
  caption: z.string().optional(),
  isMain: z.boolean().optional(),
  addedAt: z.string().optional(),
});

export const createPetSchema = z.object({
  name: z.string().min(1, 'Pet name is required'),
  petType: z.enum(['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird']).optional(),
  species: z.string().min(1, 'Species is required'),
  breed: z.string().min(1, 'Breed is required'),
  secondaryBreed: z.string().optional(),
  gender: z.enum(['male', 'female', 'unknown']).optional(),
  dateOfBirth: z.string().optional(),
  age: z.number().min(0).max(30).optional(),
  weight: z.number().positive().optional(),
  color: z.string().min(1, 'Color is required'),
  pattern: z.string().optional(),
  favouriteFood: z.string().optional(),
  photos: z.array(petPhotoSchema).max(5, 'Maximum 5 photos allowed').optional(),
  photoUrl: z.string().url().optional(),
  medicalAlerts: z.string().optional(),
  microchipId: z.string().optional(),
  isNeutered: z.boolean().optional(),
  notes: z.string().optional(),
});

export const updatePetSchema = z.object({
  petId: z.string().optional(),
  name: z.string().min(1).optional(),
  petType: z.enum(['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird']).optional(),
  species: z.string().min(1).optional(),
  breed: z.string().min(1).optional(),
  secondaryBreed: z.string().optional(),
  gender: z.enum(['male', 'female', 'unknown']).optional(),
  dateOfBirth: z.string().optional(),
  age: z.number().min(0).max(30).optional(),
  weight: z.number().positive().optional(),
  color: z.string().min(1).optional(),
  pattern: z.string().optional(),
  favouriteFood: z.string().optional(),
  photos: z.array(petPhotoSchema).max(5, 'Maximum 5 photos allowed').optional(),
  photoUrl: z.string().url().optional(),
  medicalAlerts: z.string().optional(),
  microchipId: z.string().optional(),
  isNeutered: z.boolean().optional(),
  notes: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  shortDescription: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  stock: z.number().int().min(0),
  sku: z.string().min(1),
  weight: z.number().positive().optional(),
  dimensions: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      unit: z.enum(['cm', 'in']),
    })
    .optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
  shippingAddress: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
  }),
  billingAddress: z
    .object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      zip: z.string().min(1),
      country: z.string().min(1),
    })
    .optional(),
  notes: z.string().optional(),
});

export const createContentSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export const updateContentSchema = createContentSchema.partial();

export const createSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
});

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
  allowedRoles: z.array(z.string()).optional(),
  percentage: z.number().min(0).max(100).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'support', 'customer']),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended', 'pending_verification']),
});
