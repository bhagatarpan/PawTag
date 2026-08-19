import { z } from 'zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/;
const passwordComplexityMessage = 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(passwordRegex, passwordComplexityMessage),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  fullName: z.string().min(2, 'Full name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and conditions' }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().optional(),
  captchaAnswer: z.number().int().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const resendEmailVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const sendPhoneOtpSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
});

// phoneNumber is optional so unauthenticated users (during registration) can verify by phone;
// the route falls back to auth-token-based lookup when present. Without it here the validate()
// middleware would strip the field from req.body before the route can read it.
export const verifyPhoneSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
  phoneNumber: z.string().min(1, 'Phone number is required').optional(),
});

export const resendPhoneOtpSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
});

export const verificationStatusSchema = z.object({
  email: z.string().email().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').regex(passwordRegex, passwordComplexityMessage),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').regex(passwordRegex, passwordComplexityMessage),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').regex(passwordRegex, passwordComplexityMessage),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1, 'Phone number is required').optional(),
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
  url: z.string().min(1, 'Photo URL is required'),
  caption: z.string().optional(),
  isMain: z.boolean().optional(),
  addedAt: z.string().optional(),
});

export const createPetSchema = z.object({
  name: z.string().min(1, 'Pet name is required'),
  petType: z.enum(['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird']).optional(),
  species: z.string().min(1, 'Species is required'),
  breed: z.string().min(1, 'Breed is required'),
  breedOrigin: z.enum(['Purebred', 'Mixed Breed', 'Designer Breed', 'Landrace', 'Unknown']).optional(),
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
  breedOrigin: z.enum(['Purebred', 'Mixed Breed', 'Designer Breed', 'Landrace', 'Unknown']).optional(),
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
  images: z.array(z.string()).optional(),
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
  isActive: z.boolean().optional(),
  customizable: z.boolean().optional(),
  customizationPrice: z.number().min(0).optional(),
  variants: z.array(z.object({
    name: z.string(),
    sku: z.string(),
    price: z.number().optional(),
    stock: z.number().int().min(0),
    image: z.string().optional(),
    attributes: z.record(z.string()).optional(),
  })).optional(),
  isSubscription: z.boolean().optional(),
  subscriptionConfig: z.object({
    type: z.string(),
    freePeriodMonths: z.number(),
    gracePeriodWeeks: z.number(),
    monthlyPrice: z.number().optional(),
    stripePriceId: z.string().optional(),
    features: z.array(z.string()).optional(),
  }).optional(),
  warrantyMonths: z.number().optional(),
  shippingCost: z.number().min(0).optional(),
});

export const updateProductSchema = createProductSchema.partial();

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
  displayValue: z.string().optional(),
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

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended', 'pending_verification']),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  responsibilityScore: z.number().min(0).max(10).optional(),
  mfaEnabled: z.boolean().optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    relationship: z.string().optional(),
  }).optional(),
  showOwnerNameInFinder: z.boolean().optional(),
  notificationPreferences: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    inApp: z.boolean().optional(),
    channels: z.object({
      petFound: z.boolean().optional(),
      orderUpdate: z.boolean().optional(),
      subscriptionReminder: z.boolean().optional(),
      referral: z.boolean().optional(),
      marketing: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

// --- Tag Schemas ---
export const createTagSchema = z.object({
  petId: z.string().min(1, 'Pet ID is required'),
  ownerId: z.string().min(1, 'Owner ID is required'),
  tagId: z.string().regex(/^PT-([A-Z2-9]{8}|\d{6})$/i, 'Tag ID must be in format PT-XXXXXXXX or PT-NNNNNN').optional(),
  tagType: z.enum(['qr', 'nfc']).optional(),
  status: z.enum(['active', 'inactive', 'lost']).optional(),
});

export const updateTagSchema = z.object({
  petId: z.string().optional(),
  ownerId: z.string().optional(),
  tagType: z.enum(['qr', 'nfc']).optional(),
  status: z.enum(['active', 'inactive', 'lost']).optional(),
});

// --- Subscription Schemas ---
export const cancelSubscriptionSchema = z.object({
  reason: z.string().optional(),
});

export const changePlanSchema = z.object({
  planType: z.enum(['annual', 'monthly'], { errorMap: () => ({ message: 'Plan type must be "annual" or "monthly"' }) }),
});

export const autoRenewSchema = z.object({
  autoRenew: z.boolean({ errorMap: () => ({ message: 'autoRenew must be a boolean' }) }),
});

export const adminUpdateSubscriptionStatusSchema = z.object({
  status: z.enum(['active', 'expired', 'grace_period', 'cancelled', 'pending_payment']),
  reason: z.string().optional(),
});

export const adminExtendSubscriptionSchema = z.object({
  days: z.number().min(1, 'Days must be at least 1').max(365, 'Days cannot exceed 365'),
  reason: z.string().optional(),
});

export const sendCheckoutOtpSchema = z.object({
  channel: z.enum(['email', 'sms'], { errorMap: () => ({ message: 'Channel must be "email" or "sms"' }) }),
});

export const verifyCheckoutOtpSchema = z.object({
  channel: z.enum(['email', 'sms'], { errorMap: () => ({ message: 'Channel must be "email" or "sms"' }) }),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});
