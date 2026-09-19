import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '@pawtag/db';
import { User, Pet, Tag, Subscription, Order, PromoCode, Product } from '@pawtag/db';

async function seedDemoData() {
  console.log('Connecting to database...');
  await connectDatabase(process.env.DB_URL!);
  console.log('Connected.\n');

  try {
    // ── 1. Find test customer ──
    const testEmail = process.env.BOOTSTRAP_TEST_EMAIL || 'arpanbhagat@yahoo.com';
    const testCustomer = await User.findOne({ email: testEmail });
    if (!testCustomer) {
      console.error(`Test customer not found: ${testEmail}`);
      console.error('Run "pnpm seed" first to create the test customer.');
      process.exit(1);
    }
    console.log(`Found test customer: ${testCustomer.email} (${testCustomer._id})`);

    // ── 2. Create Pets ──
    console.log('\n--- Creating Pets ---');

    const pets = [
      {
        petId: `PET-${Date.now().toString(36).toUpperCase()}-BELLA`,
        ownerId: testCustomer._id,
        name: 'Bella',
        petType: 'Dog',
        species: 'Canine',
        breed: 'Golden Retriever',
        gender: 'female',
        dateOfBirth: new Date('2021-06-15'),
        color: 'Golden',
        pattern: 'Solid',
        weight: 30,
        isNeutered: true,
        status: 'safe',
        photos: [],
      },
      {
        petId: `PET-${Date.now().toString(36).toUpperCase()}-WHISKERS`,
        ownerId: testCustomer._id,
        name: 'Whiskers',
        petType: 'Cat',
        species: 'Feline',
        breed: 'Siamese',
        gender: 'male',
        dateOfBirth: new Date('2022-03-20'),
        color: 'Cream',
        pattern: 'Pointed',
        weight: 5,
        isNeutered: true,
        status: 'safe',
        photos: [],
      },
    ];

    const createdPets = [];
    for (const petData of pets) {
      const existing = await Pet.findOne({ name: petData.name, ownerId: testCustomer._id });
      if (existing) {
        console.log(`  Pet already exists: ${existing.name}`);
        createdPets.push(existing);
      } else {
        const pet = await Pet.create(petData);
        console.log(`  Created pet: ${pet.name} (${pet.petId})`);
        createdPets.push(pet);
      }
    }

    // ── 3. Create Tags ──
    console.log('\n--- Creating Tags ---');

    const tags = [
      {
        tagId: `PT-TAG-${Date.now().toString(36).toUpperCase()}-001`,
        tagType: 'qr' as const,
        petId: createdPets[0]._id,
        ownerId: testCustomer._id,
        status: 'active' as const,
        subscriptionStatus: 'active' as const,
        activatedAt: new Date(),
      },
      {
        tagId: `PT-TAG-${Date.now().toString(36).toUpperCase()}-002`,
        tagType: 'qr' as const,
        petId: createdPets[1]._id,
        ownerId: testCustomer._id,
        status: 'inactive' as const,
        subscriptionStatus: 'none' as const,
      },
    ];

    const createdTags = [];
    for (const tagData of tags) {
      const existing = await Tag.findOne({ tagId: tagData.tagId });
      if (existing) {
        console.log(`  Tag already exists: ${existing.tagId}`);
        createdTags.push(existing);
      } else {
        const tag = await Tag.create(tagData);
        console.log(`  Created tag: ${tag.tagId}`);
        createdTags.push(tag);
      }
    }

    // ── 4. Create Subscription for first tag ──
    console.log('\n--- Creating Subscription ---');

    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const existingSub = await Subscription.findOne({ userId: testCustomer._id, tagId: createdTags[0]._id });
    let subscription;
    if (existingSub) {
      console.log(`  Subscription already exists for tag ${createdTags[0].tagId}`);
      subscription = existingSub;
    } else {
      subscription = await Subscription.create({
        userId: testCustomer._id,
        tagId: createdTags[0]._id,
        planName: 'PawTag Classic',
        planType: 'annual',
        status: 'active',
        price: 20.99,
        currency: 'NZD',
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: oneYearLater,
        freePeriodEndsAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        renewalMethod: 'annual',
      });
      console.log(`  Created subscription for tag ${createdTags[0].tagId}`);
    }

    // Link subscription to tag
    if (createdTags[0].subscriptionId?.toString() !== subscription._id.toString()) {
      await Tag.findByIdAndUpdate(createdTags[0]._id, {
        subscriptionId: subscription._id,
        subscriptionStatus: 'active',
        activatedAt: now,
        status: 'active',
      });
      console.log(`  Linked subscription to tag ${createdTags[0].tagId}`);
    }

    // ── 5. Create Promo Codes ──
    console.log('\n--- Creating Promo Codes ---');

    const promoCodes = [
      {
        code: 'SAFEPT10',
        description: '10% off your order',
        discountType: 'percentage' as const,
        discountValue: 10,
        maxDiscountAmount: 50,
        minOrderAmount: 0,
        usageLimit: 1000,
        usageCount: 0,
        perUserLimit: 5,
        isActive: true,
        createdBy: testCustomer._id,
      },
      {
        code: 'FREESHIP',
        description: 'Free shipping on your order',
        discountType: 'fixed' as const,
        discountValue: 0,
        minOrderAmount: 0,
        usageLimit: 1000,
        usageCount: 0,
        perUserLimit: 5,
        isActive: true,
        createdBy: testCustomer._id,
      },
      {
        code: 'WELCOME15',
        description: '15% off for new customers',
        discountType: 'percentage' as const,
        discountValue: 15,
        maxDiscountAmount: 75,
        minOrderAmount: 30,
        usageLimit: 500,
        usageCount: 0,
        perUserLimit: 1,
        isActive: true,
        startsAt: new Date('2026-01-01'),
        expiresAt: new Date('2026-12-31'),
        createdBy: testCustomer._id,
      },
    ];

    for (const promoData of promoCodes) {
      const existing = await PromoCode.findOne({ code: promoData.code });
      if (existing) {
        console.log(`  Promo code already exists: ${existing.code}`);
      } else {
        await PromoCode.create(promoData);
        console.log(`  Created promo code: ${promoData.code}`);
      }
    }

    // ── 6. Create Sample Order ──
    console.log('\n--- Creating Sample Order ---');

    const orderNumber = `PT-${Date.now().toString(36).toUpperCase()}`;
    const existingOrder = await Order.findOne({ orderNumber });
    if (existingOrder) {
      console.log(`  Order already exists: ${existingOrder.orderNumber}`);
    } else {
      // Find a product to reference
      const product = await Product.findOne({ sku: 'PT-CLASSIC-001' });
      if (product) {
        await Order.create({
          orderNumber,
          userId: testCustomer._id,
          items: [
            {
              productId: product._id,
              productName: product.name,
              sku: product.sku,
              quantity: 1,
              unitPrice: product.price,
              totalPrice: product.price,
              customizationTotal: 0,
              customisationTexts: [],
            },
          ],
          subtotal: product.price,
          shippingCost: 0,
          tax: 0,
          status: 'delivered',
          payment: {
            method: 'card',
            status: 'succeeded',
            amount: product.price,
            currency: 'NZD',
            cardBrand: 'visa',
            cardLast4: '4242',
            paidAt: new Date(),
          },
          shippingAddress: {
            line1: '123 Test Street',
            city: 'Auckland',
            state: 'Auckland',
            zip: '1010',
            country: 'NZ',
          },
        });
        console.log(`  Created sample order: ${orderNumber}`);
      } else {
        console.log('  Skipping sample order — no products found');
      }
    }

    // ── Summary ──
    console.log('\n--- Seed Summary ---');
    console.log(`  Pets: ${createdPets.length}`);
    console.log(`  Tags: ${createdTags.length}`);
    console.log(`  Subscriptions: 1`);
    console.log(`  Promo Codes: ${promoCodes.length}`);
    console.log(`  Sample Orders: 1`);
    console.log('\nDone!');

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

seedDemoData();
