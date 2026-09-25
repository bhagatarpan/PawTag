import { connectDatabase, MembershipTier } from '@pawtag/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const membershipTiers = [
  {
    tier: 'gold',
    name: 'Gold Membership',
    displayName: 'Gold',
    description: 'Essential pet protection with core benefits for your furry family members.',
    price: 89,
    currency: 'NZD',
    benefits: {
      medicalAlert: true,
      petHealthRecords: true,
      emailNotifications: true,
      freeShippingThreshold: 100,
      pointsMultiplier: 1,
      inAppNotifications: false,
      criticalEmergencyContact: false,
      emergencyPersonEmail: false,
      emergencyPersonInApp: false,
      accessoryDiscount: 0,
      petRecovery: false,
      blackFridayDeal: false,
    },
    isActive: true,
    displayOrder: 1,
    icon: 'Crown',
    color: '#F59E0B',
    gradient: 'from-yellow-400 to-amber-500',
  },
  {
    tier: 'platinum',
    name: 'Platinum Membership',
    displayName: 'Platinum',
    description: 'Premium pet protection with emergency features and enhanced rewards.',
    price: 99,
    currency: 'NZD',
    benefits: {
      medicalAlert: true,
      petHealthRecords: true,
      emailNotifications: true,
      freeShippingThreshold: 80,
      pointsMultiplier: 2,
      inAppNotifications: true,
      criticalEmergencyContact: true,
      emergencyPersonEmail: true,
      emergencyPersonInApp: false,
      accessoryDiscount: 5,
      petRecovery: false,
      blackFridayDeal: false,
    },
    isActive: true,
    displayOrder: 2,
    icon: 'Diamond',
    color: '#9CA3AF',
    gradient: 'from-gray-300 to-gray-500',
  },
  {
    tier: 'black',
    name: 'Black Membership',
    displayName: 'Black',
    description: 'Elite pet protection with lifetime benefits and premium recovery service.',
    price: 199,
    currency: 'NZD',
    benefits: {
      medicalAlert: true,
      petHealthRecords: true,
      emailNotifications: true,
      freeShippingThreshold: 0, // Lifetime free shipping
      pointsMultiplier: 3,
      inAppNotifications: true,
      criticalEmergencyContact: true,
      emergencyPersonEmail: true,
      emergencyPersonInApp: true,
      accessoryDiscount: 10,
      petRecovery: true,
      blackFridayDeal: true,
    },
    isActive: true, // Active but CTA shows "Coming Soon" on frontend
    displayOrder: 3,
    icon: 'Shield',
    color: '#1F2937',
    gradient: 'from-gray-800 to-black',
  },
];

async function seedMembershipTiers() {
  console.log('--- Seeding Membership Tiers ---');
  
  for (const tierData of membershipTiers) {
    const existing = await MembershipTier.findOne({ tier: tierData.tier });
    
    if (existing) {
      // Update existing tier
      await MembershipTier.findOneAndUpdate(
        { tier: tierData.tier },
        { $set: tierData },
        { new: true }
      );
      console.log(`  Updated tier: ${tierData.displayName} ($${tierData.price}/yr)`);
    } else {
      // Create new tier
      await MembershipTier.create(tierData);
      console.log(`  Created tier: ${tierData.displayName} ($${tierData.price}/yr)`);
    }
  }
  
  console.log('✅ Membership tiers seeded successfully');
}

// Run if called directly
if (require.main === module) {
  connectDatabase()
    .then(() => seedMembershipTiers())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error seeding membership tiers:', err);
      process.exit(1);
    });
}

export { seedMembershipTiers };
