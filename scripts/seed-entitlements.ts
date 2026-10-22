/**
 * Seed the Membership Entitlement Registry from existing MembershipTier data.
 *
 * This script reads the current MembershipTier documents and creates
 * MembershipBenefit + MembershipTierBenefit records to establish the
 * new single source of truth for all membership benefits.
 *
 * Run: npx tsx scripts/seed-entitlements.ts
 * Or via pnpm: pnpm --filter @pawtag/api seed:entitlements
 */

import mongoose from 'mongoose';
import { ACTIVATION_ENTITLEMENT_DEFAULTS } from './lib/activation-entitlement-defaults';

const MONGO_URI = process.env.DB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/pawtag';

interface SeedBenefit {
  key: string;
  name: string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  category: string;
  defaultValue: boolean | number | string | null;
  displayOrder: number;
  tierValues: {
    gold: { enabled: boolean; value: boolean | number | string | null };
    platinum: { enabled: boolean; value: boolean | number | string | null };
    black: { enabled: boolean; value: boolean | number | string | null };
  };
  /**
   * Free 3-Month Activation context (docs/ACTIVATION-ENTITLEMENTS.md):
   * founder decision — all features EXCEPT money perks, Black exclusives
   * stay paid-only.
   */
  activation: { enabled: boolean; value: boolean | number | string | null };
}

const BENEFITS: SeedBenefit[] = [
  {
    key: 'free_shipping_threshold',
    name: 'Free Shipping Threshold',
    description: 'Minimum cart subtotal (NZD) for free shipping. 0 = lifetime free shipping.',
    type: 'number',
    category: 'shipping',
    defaultValue: null,
    displayOrder: 1,
    tierValues: {
      gold: { enabled: true, value: 100 },
      platinum: { enabled: true, value: 80 },
      black: { enabled: true, value: 0 },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['free_shipping_threshold'], // money perk — base behaviour
  },
  {
    key: 'points_multiplier',
    name: 'Guardian Points Multiplier',
    description: 'Multiplier applied to all Guardian points earned.',
    type: 'number',
    category: 'loyalty',
    defaultValue: 1,
    displayOrder: 2,
    tierValues: {
      gold: { enabled: true, value: 1 },
      platinum: { enabled: true, value: 2 },
      black: { enabled: true, value: 3 },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['points_multiplier'], // money perk — base 1× rate
  },
  {
    key: 'in_app_notifications',
    name: 'In-App Notifications',
    description: 'Access to in-app notification delivery channel.',
    type: 'boolean',
    category: 'notifications',
    defaultValue: true,
    displayOrder: 3,
    tierValues: {
      gold: { enabled: true, value: false },
      platinum: { enabled: true, value: true },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['in_app_notifications'],
  },
  {
    key: 'email_notifications',
    name: 'Email Notifications',
    description: 'Access to email notification delivery channel.',
    type: 'boolean',
    category: 'notifications',
    defaultValue: true,
    displayOrder: 4,
    tierValues: {
      gold: { enabled: true, value: true },
      platinum: { enabled: true, value: true },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['email_notifications'],
  },
  {
    key: 'accessory_discount',
    name: 'Accessory Discount',
    description: 'Percentage discount on accessory products.',
    type: 'number',
    category: 'exclusive',
    defaultValue: 0,
    displayOrder: 5,
    tierValues: {
      gold: { enabled: true, value: 0 },
      platinum: { enabled: true, value: 5 },
      black: { enabled: true, value: 10 },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['accessory_discount'], // money perk — base behaviour
  },
  {
    key: 'emergency_contact',
    name: 'Emergency Contact Access',
    description: 'Ability to configure an emergency contact for pet recovery escalation.',
    type: 'boolean',
    category: 'recovery',
    defaultValue: true,
    displayOrder: 6,
    tierValues: {
      gold: { enabled: true, value: false },
      platinum: { enabled: true, value: true },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['emergency_contact'],
  },
  {
    key: 'emergency_person_email',
    name: 'Emergency Person Email',
    description: 'Emergency contact receives email notifications during escalation.',
    type: 'boolean',
    category: 'recovery',
    defaultValue: false,
    displayOrder: 7,
    tierValues: {
      gold: { enabled: true, value: false },
      platinum: { enabled: true, value: true },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['emergency_person_email'],
  },
  {
    key: 'emergency_person_in_app',
    name: 'Emergency Person In-App',
    description: 'Emergency contact receives in-app notifications during escalation.',
    type: 'boolean',
    category: 'recovery',
    defaultValue: false,
    displayOrder: 8,
    tierValues: {
      gold: { enabled: true, value: false },
      platinum: { enabled: true, value: false },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['emergency_person_in_app'], // "as if Black" feature
  },
  {
    key: 'medical_alerts',
    name: 'Medical Alerts',
    description: 'Ability to set medical alert information visible to finders.',
    type: 'boolean',
    category: 'health',
    defaultValue: true,
    displayOrder: 9,
    tierValues: {
      gold: { enabled: true, value: true },
      platinum: { enabled: true, value: true },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['medical_alerts'],
  },
  {
    key: 'pet_health_records',
    name: 'Pet Health Records',
    description: 'Full access to pet health records (vaccinations, medications, allergies, conditions).',
    type: 'boolean',
    category: 'health',
    defaultValue: true,
    displayOrder: 10,
    tierValues: {
      gold: { enabled: true, value: true },
      platinum: { enabled: true, value: true },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['pet_health_records'],
  },
  {
    key: 'pet_recovery',
    name: 'Pet Recovery Assistance',
    description: 'Access to full pet recovery and finder-assisted reunion features. Includes PawTag team intervention when owner and emergency contact are unreachable.',
    type: 'boolean',
    category: 'recovery',
    defaultValue: false,
    displayOrder: 11,
    tierValues: {
      gold: { enabled: false, value: false },
      platinum: { enabled: false, value: false },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['pet_recovery'], // "as if Black" feature
  },
  {
    key: 'black_friday_deal',
    name: 'Black Friday Deal Access',
    description: 'Exclusive access to Black Friday promotions and deals.',
    type: 'boolean',
    category: 'exclusive',
    defaultValue: false,
    displayOrder: 12,
    tierValues: {
      gold: { enabled: true, value: false },
      platinum: { enabled: true, value: false },
      black: { enabled: true, value: true },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['black_friday_deal'], // paid-tier exclusive stays paid
  },
  {
    key: 'tag_limit',
    name: 'Tag Limit',
    description: 'Maximum number of tags covered by this membership.',
    type: 'number',
    category: 'general',
    defaultValue: 1,
    displayOrder: 13,
    tierValues: {
      gold: { enabled: true, value: 3 },
      platinum: { enabled: true, value: 10 },
      black: { enabled: true, value: 999 },
    },
    activation: ACTIVATION_ENTITLEMENT_DEFAULTS['tag_limit'], // only matters with a paid membership
  },
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const db = mongoose.connection.db!;
  const benefitsCol = db.collection('membershipbenefits');
  const tierBenefitsCol = db.collection('membershiptierbenefits');

  let created = 0;
  let updated = 0;

  for (const benefit of BENEFITS) {
    // Upsert benefit definition
    const existing = await benefitsCol.findOne({ key: benefit.key });
    if (existing) {
      await benefitsCol.updateOne(
        { key: benefit.key },
        {
          $set: {
            name: benefit.name,
            description: benefit.description,
            type: benefit.type,
            category: benefit.category,
            defaultValue: benefit.defaultValue,
            displayOrder: benefit.displayOrder,
            enabled: true,
          },
        }
      );
      updated++;
      console.log(`  Updated benefit: ${benefit.key}`);
    } else {
      await benefitsCol.insertOne({
        key: benefit.key,
        name: benefit.name,
        description: benefit.description,
        type: benefit.type,
        category: benefit.category,
        defaultValue: benefit.defaultValue,
        enabled: true,
        displayOrder: benefit.displayOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      created++;
      console.log(`  Created benefit: ${benefit.key}`);
    }

    // Upsert tier values — paid tiers plus the activation context
    const contexts: Record<string, { enabled: boolean; value: boolean | number | string | null }> = {
      ...benefit.tierValues,
      activation: benefit.activation,
    };
    for (const [tier, tv] of Object.entries(contexts)) {
      await tierBenefitsCol.updateOne(
        { benefitKey: benefit.key, tier },
        {
          $set: {
            enabled: tv.enabled,
            value: tv.value,
          },
          $setOnInsert: {
            benefitKey: benefit.key,
            tier,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
  console.log(`Tier benefit entries: ${BENEFITS.length} benefits × 4 contexts (gold, platinum, black, activation) = ${BENEFITS.length * 4} entries`);

  await mongoose.disconnect();
  console.log('Disconnected.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
