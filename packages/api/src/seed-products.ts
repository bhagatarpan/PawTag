import { connectDatabase, Product } from '@pawtag/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const products = [
  {
    name: 'Classic PawTag — Round',
    description: 'Our signature round QR-coded pet tag. Simply scan with any smartphone to view your pet\'s profile, medical info, and owner contact details. Made from durable stainless steel with a protective coating.',
    shortDescription: 'Durable stainless steel QR pet tag',
    price: 29.99,
    currency: 'NZD',
    images: [],
    category: 'Pet Tags',
    tags: ['qr', 'stainless-steel', 'round', 'classic'],
    isActive: true,
    stock: 150,
    sku: 'PT-CLASSIC-001',
    variants: [
      { name: 'Silver — Small', sku: 'PT-CLASSIC-001-SIL-S', price: 29.99, stock: 50, attributes: { color: 'Silver', size: 'Small' } },
      { name: 'Silver — Medium', sku: 'PT-CLASSIC-001-SIL-M', price: 29.99, stock: 50, attributes: { color: 'Silver', size: 'Medium' } },
      { name: 'Silver — Large', sku: 'PT-CLASSIC-001-SIL-L', price: 32.99, stock: 30, attributes: { color: 'Silver', size: 'Large' } },
      { name: 'Black — Small', sku: 'PT-CLASSIC-001-BLK-S', price: 29.99, stock: 20, attributes: { color: 'Black', size: 'Small' } },
      { name: 'Black — Medium', sku: 'PT-CLASSIC-001-BLK-M', price: 29.99, stock: 20, attributes: { color: 'Black', size: 'Medium' } },
    ],
    customizable: true,
    customizationPrice: 5.00,
  },
  {
    name: 'PawTag Pro — Bone Shape',
    description: 'Premium bone-shaped pet tag with engraved QR code. Extra durable with a brushed titanium finish. Perfect for active pets who love the outdoors.',
    shortDescription: 'Premium bone-shaped titanium tag',
    price: 39.99,
    currency: 'NZD',
    images: [],
    category: 'Pet Tags',
    tags: ['qr', 'titanium', 'bone', 'premium'],
    isActive: true,
    stock: 80,
    sku: 'PT-PRO-001',
    variants: [
      { name: 'Titanium — Small', sku: 'PT-PRO-001-TIT-S', price: 39.99, stock: 25, attributes: { color: 'Titanium', size: 'Small' } },
      { name: 'Titanium — Medium', sku: 'PT-PRO-001-TIT-M', price: 39.99, stock: 30, attributes: { color: 'Titanium', size: 'Medium' } },
      { name: 'Titanium — Large', sku: 'PT-PRO-001-TIT-L', price: 42.99, stock: 25, attributes: { color: 'Titanium', size: 'Large' } },
    ],
    customizable: true,
    customizationPrice: 7.50,
  },
  {
    name: 'PawTag Mini — Heart Shape',
    description: 'Adorable heart-shaped mini tag for small dogs and cats. Lightweight, hypoallergenic, and available in 6 vibrant colours.',
    shortDescription: 'Cute heart-shaped mini tag',
    price: 24.99,
    currency: 'NZD',
    images: [],
    category: 'Pet Tags',
    tags: ['qr', 'heart', 'mini', 'colourful'],
    isActive: true,
    stock: 200,
    sku: 'PT-MINI-001',
    variants: [
      { name: 'Pink — Small', sku: 'PT-MINI-001-PNK-S', price: 24.99, stock: 40, attributes: { color: 'Pink', size: 'Small' } },
      { name: 'Pink — Medium', sku: 'PT-MINI-001-PNK-M', price: 24.99, stock: 20, attributes: { color: 'Pink', size: 'Medium' } },
      { name: 'Blue — Small', sku: 'PT-MINI-001-BLU-S', price: 24.99, stock: 40, attributes: { color: 'Blue', size: 'Small' } },
      { name: 'Blue — Medium', sku: 'PT-MINI-001-BLU-M', price: 24.99, stock: 20, attributes: { color: 'Blue', size: 'Medium' } },
      { name: 'Red — Small', sku: 'PT-MINI-001-RED-S', price: 24.99, stock: 40, attributes: { color: 'Red', size: 'Small' } },
      { name: 'Green — Small', sku: 'PT-MINI-001-GRN-S', price: 24.99, stock: 40, attributes: { color: 'Green', size: 'Small' } },
    ],
    customizable: false,
    customizationPrice: 0,
  },
  {
    name: 'PawTag Clip — Collar Attachment',
    description: 'Easy clip-on attachment for collars without D-rings. Rotates 360° and stays secure. Works with any collar material.',
    shortDescription: '360° rotating collar clip tag',
    price: 34.99,
    currency: 'NZD',
    images: [],
    category: 'Accessories',
    tags: ['qr', 'clip', 'collar', 'rotating'],
    isActive: true,
    stock: 120,
    sku: 'PT-CLIP-001',
    variants: [
      { name: 'Black', sku: 'PT-CLIP-001-BLK', price: 34.99, stock: 60, attributes: { color: 'Black' } },
      { name: 'Silver', sku: 'PT-CLIP-001-SIL', price: 34.99, stock: 60, attributes: { color: 'Silver' } },
    ],
    customizable: false,
    customizationPrice: 0,
  },
  {
    name: 'PawTag Waterproof Case',
    description: 'Protective silicone case for PawTags. Adds extra durability and water resistance. Available in bright colours for extra visibility.',
    shortDescription: 'Silicone protective case for tags',
    price: 12.99,
    currency: 'NZD',
    images: [],
    category: 'Accessories',
    tags: ['waterproof', 'silicone', 'case', 'protection'],
    isActive: true,
    stock: 300,
    sku: 'PT-CASE-001',
    variants: [
      { name: 'Neon Green', sku: 'PT-CASE-001-GRN', price: 12.99, stock: 100, attributes: { color: 'Neon Green' } },
      { name: 'Neon Orange', sku: 'PT-CASE-001-ORG', price: 12.99, stock: 100, attributes: { color: 'Neon Orange' } },
      { name: 'Neon Pink', sku: 'PT-CASE-001-PNK', price: 12.99, stock: 100, attributes: { color: 'Neon Pink' } },
    ],
    customizable: false,
    customizationPrice: 0,
  },
  {
    name: 'PawTag Starter Kit',
    description: 'Everything you need to get started: 1 Classic PawTag, 1 Waterproof Case, and a collar clip. The perfect gift for new pet owners.',
    shortDescription: 'Complete starter bundle',
    price: 49.99,
    currency: 'NZD',
    images: [],
    category: 'Bundles',
    tags: ['bundle', 'starter', 'gift', 'value'],
    isActive: true,
    stock: 60,
    sku: 'PT-KIT-001',
    variants: [
      { name: 'Silver Tag + Green Case', sku: 'PT-KIT-001-SIL-GRN', price: 49.99, stock: 20, attributes: { tagColor: 'Silver', caseColor: 'Neon Green' } },
      { name: 'Silver Tag + Orange Case', sku: 'PT-KIT-001-SIL-ORG', price: 49.99, stock: 20, attributes: { tagColor: 'Silver', caseColor: 'Neon Orange' } },
      { name: 'Black Tag + Pink Case', sku: 'PT-KIT-001-BLK-PNK', price: 49.99, stock: 20, attributes: { tagColor: 'Black', caseColor: 'Neon Pink' } },
    ],
    customizable: true,
    customizationPrice: 5.00,
  },
];

async function seedProducts() {
  try {
    await connectDatabase();
    console.log('Connected to MongoDB');

    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');

    // Insert new products
    const result = await Product.insertMany(products);
    console.log(`Seeded ${result.length} products with variants`);

    for (const p of result) {
      console.log(`  - ${p.name} (${p.sku}) — ${(p as any).variants?.length || 0} variants, stock: ${p.stock}`);
    }

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedProducts();
