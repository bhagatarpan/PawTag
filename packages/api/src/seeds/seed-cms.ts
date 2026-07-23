import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { config } from '../config';
import {
  connectDatabase,
  disconnectDatabase,
  User,
  Setting,
  CmsNavigation,
  CmsFooter,
  CmsPage,
  CmsHomepageSection,
  CmsEmailTemplate,
  CmsSmsTemplate,
  CmsPetReference,
  CmsShopPage,
  CmsAuthPage,
} from '@pawtag/db';

async function run() {
  console.log(' CMS Seed Script');
  console.log('═══════════════════════════════════════\n');

  await connectDatabase(config.dbUrl);
  console.log('Connected to database\n');

  const adminUser = await User.findOne({ email: 'admin@pawtag.co.nz' });
  if (!adminUser) {
    console.error('Admin user not found. Run seed.ts first.');
    process.exit(1);
  }
  const adminId = adminUser._id;
  console.log(`Admin user: ${adminUser.email} (${adminUser._id})\n`);

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // ═══════════════════════════════════════
      // 1. SETTINGS
      // ═══════════════════════════════════════
      console.log('--- Seeding Settings ---');
      const settings: Array<{ key: string; value: string; category: string }> = [
        { key: 'site.name', value: 'PawTag', category: 'site' },
        { key: 'site.tagline', value: 'Never Lose Your Pet Again', category: 'site' },
        { key: 'site.description', value: 'Smart QR-coded pet recovery tags. Because every pet deserves a safe way home.', category: 'site' },
        { key: 'company.name', value: 'PawTag', category: 'company' },
        { key: 'company.email', value: 'support@pawtag.co.nz', category: 'company' },
        { key: 'company.phone', value: '+64 21 123 4567', category: 'company' },
        { key: 'company.address', value: 'Auckland, New Zealand', category: 'company' },
        { key: 'contact.email', value: 'support@pawtag.co.nz', category: 'contact' },
        { key: 'contact.phone', value: '+64 21 123 4567', category: 'contact' },
        { key: 'contact.address', value: 'Auckland, New Zealand', category: 'contact' },
        { key: 'seo.defaultTitle', value: 'PawTag - Never Lose Your Pet Again', category: 'seo' },
        { key: 'seo.defaultDescription', value: 'Smart QR-coded pet recovery tags. Because every pet deserves a safe way home.', category: 'seo' },
        { key: 'seo.defaultKeywords', value: 'pet recovery, QR code, pet tag, lost pet, found pet, pet safety, New Zealand', category: 'seo' },
        { key: 'social.facebook', value: 'https://facebook.com/pawtag', category: 'social' },
        { key: 'social.instagram', value: 'https://instagram.com/pawtag', category: 'social' },
        { key: 'urls.customerPortal', value: 'http://localhost:3002', category: 'urls' },
        { key: 'urls.finderPortal', value: 'http://localhost:3003', category: 'urls' },
        { key: 'urls.frontend', value: 'http://localhost:3000', category: 'urls' },
        { key: 'emails.senderName', value: 'PawTag', category: 'emails' },
        { key: 'emails.senderEmail', value: 'no-reply@pawtag.co.nz', category: 'emails' },
        { key: 'emails.supportEmail', value: 'support@pawtag.co.nz', category: 'emails' },
        { key: 'checkout.defaultCountry', value: 'NZ', category: 'checkout' },
        { key: 'checkout.currencyLabel', value: 'NZD', category: 'checkout' },
      ];

      let settingsCreated = 0;
      for (const s of settings) {
        const existing = await Setting.findOne({ key: s.key }).session(session);
        if (!existing) {
          await Setting.create([{ ...s, updatedBy: adminId }], { session });
          settingsCreated++;
        }
      }
      console.log(`  ${settingsCreated} new settings created (${settings.length} total)\n`);

      // ═══════════════════════════════════════
      // 2. NAVIGATION
      // ═══════════════════════════════════════
      console.log('--- Seeding Navigation ---');
      const existingNav = await CmsNavigation.findOne({ location: 'header', deletedAt: null }).session(session);
      if (!existingNav) {
        await CmsNavigation.create([{
          name: 'Main Navigation',
          slug: 'main-navigation',
          location: 'header',
          items: [
            { label: 'Home', url: '/', order: 0, visible: true },
            { label: 'Shop', url: '/shop', order: 1, visible: true },
            { label: 'About', url: '/about', order: 2, visible: true },
            { label: 'FAQ', url: '/faq', order: 3, visible: true },
            { label: 'Contact', url: '/contact', order: 4, visible: true },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created header navigation');
      } else {
        console.log('  Header navigation already exists');
      }

      const existingFooterNav = await CmsNavigation.findOne({ location: 'footer', deletedAt: null }).session(session);
      if (!existingFooterNav) {
        await CmsNavigation.create([{
          name: 'Footer Navigation',
          slug: 'footer-navigation',
          location: 'footer',
          items: [
            { label: 'Privacy', url: '/privacy', order: 0, visible: true },
            { label: 'Terms', url: '/terms', order: 1, visible: true },
            { label: 'FAQ', url: '/faq', order: 2, visible: true },
            { label: 'Contact', url: '/contact', order: 3, visible: true },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created footer navigation');
      } else {
        console.log('  Footer navigation already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 3. FOOTER
      // ═══════════════════════════════════════
      console.log('--- Seeding Footer ---');
      const existingFooter = await CmsFooter.findOne({ deletedAt: null }).session(session);
      if (!existingFooter) {
        await CmsFooter.create([{
          name: 'Main Footer',
          groups: [
            {
              groupId: 'quick-links',
              title: 'Quick Links',
              visible: true,
              order: 0,
              links: [
                { label: 'Shop', url: '/shop', order: 0, visible: true },
                { label: 'About', url: '/about', order: 1, visible: true },
                { label: 'FAQ', url: '/faq', order: 2, visible: true },
                { label: 'Contact', url: '/contact', order: 3, visible: true },
                { label: 'Sign In', url: '/login', order: 4, visible: true },
              ],
            },
            {
              groupId: 'support',
              title: 'Support',
              visible: true,
              order: 1,
              links: [
                { label: 'support@pawtag.co.nz', url: 'mailto:support@pawtag.co.nz', order: 0, visible: true },
                { label: '+64 21 123 4567', url: 'tel:+64211234567', order: 1, visible: true },
              ],
            },
          ],
          copyright: 'PawTag. All rights reserved.',
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created footer configuration');
      } else {
        console.log('  Footer configuration already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 4. HOMEPAGE SECTIONS
      // ═══════════════════════════════════════
      console.log('--- Seeding Homepage Sections ---');
      const existingHero = await CmsHomepageSection.findOne({ sectionType: 'hero_slide', deletedAt: null }).session(session);
      if (!existingHero) {
        await CmsHomepageSection.create([
          {
            sectionType: 'hero_slide',
            title: 'Hero Slide 1',
            content: {
              tag: 'Emotional',
              headline: "They can't tell anyone where they live.",
              sub: "Let their tag do the talking.",
              ctaText: 'Protect Your Pet',
              ctaUrl: '/shop',
              bg: 'from-primary-700 via-primary-600 to-primary-800',
            },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'hero_slide',
            title: 'Hero Slide 2',
            content: {
              tag: 'Functional',
              headline: 'Scan. Locate. Reunite.',
              sub: 'From lost to home in three simple steps.',
              ctaText: 'Shop QR Tags',
              ctaUrl: '/shop',
              bg: 'from-primary-800 via-primary-700 to-primary-600',
            },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'hero_slide',
            title: 'Hero Slide 3',
            content: {
              tag: 'Trust',
              headline: 'Trusted by thousands of pet owners',
              sub: 'Join a community that never stops looking out for each other.',
              ctaText: 'See How It Works',
              ctaUrl: '/about',
              bg: 'from-primary-600 via-primary-700 to-primary-800',
            },
            order: 2,
            isActive: true,
          },
        ], { session });
        console.log('  Created 3 hero slides');
      } else {
        console.log('  Hero slides already exist');
      }

      const existingHowItWorks = await CmsHomepageSection.findOne({ sectionType: 'how_it_works', deletedAt: null }).session(session);
      if (!existingHowItWorks) {
        await CmsHomepageSection.create([
          {
            sectionType: 'how_it_works',
            title: 'Register Your Pet',
            content: { icon: 'UserPlus', title: 'Register Your Pet', desc: "Create a secure profile with your pet's name, photo, medical needs, and your contact details.", iconBg: 'bg-primary-600' },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'how_it_works',
            title: 'Attach Your PawTag',
            content: { icon: 'Tag', title: 'Attach Your PawTag', desc: "Clip the durable QR tag onto your pet's collar. It's waterproof, scratch-resistant, and built to last.", iconBg: 'bg-amber-500' },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'how_it_works',
            title: 'A Finder Scans',
            content: { icon: 'Scan', title: 'A Finder Scans', desc: "Anyone with a smartphone can scan the QR code — no app needed. They instantly see your pet's profile.", iconBg: 'bg-sky-500' },
            order: 2,
            isActive: true,
          },
          {
            sectionType: 'how_it_works',
            title: 'Get Your Pet Home',
            content: { icon: 'Home', title: 'Get Your Pet Home', desc: 'The finder contacts you directly, and you get an instant notification with their location. Reunion in minutes.', iconBg: 'bg-rose-500' },
            order: 3,
            isActive: true,
          },
        ], { session });
        console.log('  Created 4 how-it-works steps');
      } else {
        console.log('  How-it-works already exists');
      }

      const existingTrust = await CmsHomepageSection.findOne({ sectionType: 'trust', deletedAt: null }).session(session);
      if (!existingTrust) {
        await CmsHomepageSection.create([
          {
            sectionType: 'trust',
            title: 'Secure Accounts',
            content: { icon: 'ShieldCheck', title: 'Secure Accounts', desc: 'Every account is protected with encrypted passwords and optional two-factor authentication.', color: 'bg-primary-50 text-primary-600' },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'trust',
            title: 'Data Privacy',
            content: { icon: 'Eye', title: 'Data Privacy', desc: 'Your address and personal details are only shared when you choose to. You stay in control.', color: 'bg-violet-50 text-violet-600' },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'trust',
            title: 'Encrypted Payments',
            content: { icon: 'Lock', title: 'Encrypted Payments', desc: 'All transactions are processed through Stripe with bank-level encryption. We never store card data.', color: 'bg-amber-50 text-amber-600' },
            order: 2,
            isActive: true,
          },
          {
            sectionType: 'trust',
            title: 'Reliable Recovery',
            content: { icon: 'RotateCcw', title: 'Reliable Recovery', desc: 'Our tags are waterproof, scratch-resistant, and built to last the lifetime of your pet.', color: 'bg-emerald-50 text-emerald-600' },
            order: 3,
            isActive: true,
          },
        ], { session });
        console.log('  Created 4 trust badges');
      } else {
        console.log('  Trust badges already exist');
      }

      const existingTestimonials = await CmsHomepageSection.findOne({ sectionType: 'testimonial', deletedAt: null }).session(session);
      if (!existingTestimonials) {
        await CmsHomepageSection.create([
          {
            sectionType: 'testimonial',
            title: 'Sarah M.',
            content: { name: 'Sarah M.', initials: 'SM', color: 'bg-primary-500', pet: 'Golden Retriever', quote: "My dog Max got out during a storm last month. A neighbor found him 3 blocks away and scanned his PawTag. I had him back within 20 minutes. I can't imagine what would have happened without it.", focus: 'Fast Reunion' },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'testimonial',
            title: 'James K.',
            content: { name: 'James K.', initials: 'JK', color: 'bg-sky-500', pet: 'Tabby Cat', quote: "Setting up Luna's profile took less than 5 minutes. The peace of mind knowing that anyone who finds her can instantly see her info and contact me — it's worth every penny.", focus: 'Easy Setup' },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'testimonial',
            title: 'Priya D.',
            content: { name: 'Priya D.', initials: 'PD', color: 'bg-violet-500', pet: 'Cocker Spaniel', quote: "We travel a lot with our dog, and having PawTag gives me confidence that no matter where we are, if he slips his leash, someone can scan his tag and get him home safely.", focus: 'Peace of Mind' },
            order: 2,
            isActive: true,
          },
        ], { session });
        console.log('  Created 3 testimonials');
      } else {
        console.log('  Testimonials already exist');
      }

      const existingRespScore = await CmsHomepageSection.findOne({ sectionType: 'responsibility_score', deletedAt: null }).session(session);
      if (!existingRespScore) {
        await CmsHomepageSection.create([{
          sectionType: 'responsibility_score',
          title: 'Responsibility Score',
          content: {
            score: '820',
            scoreLabel: 'Excellent',
            title: 'Earn points for being a great pet parent',
            desc: "PawTag Responsibility Score rewards you for keeping your pet's profile complete and up to date. The higher your score, the more trusted your profile appears to potential finders.",
            activities: [
              { icon: 'ClipboardCheck', points: '+10', label: 'Complete Profile', color: 'text-primary-600 bg-primary-50' },
              { icon: 'Camera', points: '+15', label: 'Upload Pet Photo', color: 'text-sky-600 bg-sky-50' },
              { icon: 'Syringe', points: '+20', label: 'Add Vaccination Record', color: 'text-emerald-600 bg-emerald-50' },
              { icon: 'Star', points: '+25', label: 'Keep Info Updated', color: 'text-amber-600 bg-amber-50' },
            ],
          },
          order: 0,
          isActive: true,
        }], { session });
        console.log('  Created responsibility score section');
      } else {
        console.log('  Responsibility score already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 5. CMS PAGES
      // ═══════════════════════════════════════
      console.log('--- Seeding CMS Pages ---');

      // About
      const existingAbout = await CmsPage.findOne({ slug: 'about', deletedAt: null }).session(session);
      if (!existingAbout) {
        await CmsPage.create([{
          slug: 'about',
          title: 'About PawTag',
          metaTitle: 'About PawTag - Our Mission & Story',
          metaDescription: 'Learn about PawTag - a New Zealand company dedicated to pet safety and reunification through QR-coded recovery tags.',
          metaKeywords: ['about pawtag', 'pet safety', 'pet recovery', 'QR code tags', 'New Zealand'],
          sections: [
            {
              sectionId: 'about-intro',
              type: 'text',
              title: '',
              content: {
                body: '<p class="text-lg text-gray-600 mb-4">PawTag is a New Zealand company dedicated to pet safety and reunification.</p><p class="text-gray-600 mb-4">Every year, thousands of pets go missing in New Zealand. Traditional ID tags can fall off or become unreadable. PawTag solves this problem with durable, scannable QR code tags that link directly to your pet\'s online profile.</p><p class="text-gray-600 mb-4">When someone finds your pet, they simply scan the QR code with their smartphone camera. No app download required. They see your pet\'s photo, name, and medical alerts, and can notify you immediately with their location.</p>',
              },
              visible: true,
              order: 0,
              status: 'published',
            },
            {
              sectionId: 'about-mission',
              type: 'text',
              title: 'Our Mission',
              content: {
                body: '<p class="text-gray-600">To make pet recovery fast, simple, and reliable. We believe every pet deserves a safe way home.</p>',
              },
              visible: true,
              order: 1,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created About page');
      } else {
        console.log('  About page already exists');
      }

      // Privacy Policy
      const existingPrivacy = await CmsPage.findOne({ slug: 'privacy-policy', deletedAt: null }).session(session);
      if (!existingPrivacy) {
        await CmsPage.create([{
          slug: 'privacy-policy',
          title: 'Privacy Policy',
          metaTitle: 'Privacy Policy - PawTag',
          metaDescription: 'PawTag Privacy Policy - Learn how we collect, use, and protect your personal information.',
          metaKeywords: ['privacy policy', 'data protection', 'personal information', 'PawTag'],
          sections: [
            {
              sectionId: 'privacy-body',
              type: 'text',
              title: '',
              content: {
                body: `<p class="text-lg text-gray-600 mb-4">Last updated: ${new Date().toLocaleDateString()}</p>
<h2 class="text-xl font-semibold mt-6">1. Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, register a pet, purchase a tag, or contact us for support.</p>
<h2 class="text-xl font-semibold mt-6">2. How We Use Your Information</h2>
<p>We use the information we collect to provide, maintain, and improve our services, to process transactions, and to send you technical notices and support messages.</p>
<h2 class="text-xl font-semibold mt-6">3. Information Sharing</h2>
<p>We do not sell your personal information. We may share your information only when you direct us to (such as when a finder scans your pet's tag) or as required by law.</p>
<h2 class="text-xl font-semibold mt-6">4. Data Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
<h2 class="text-xl font-semibold mt-6">5. Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at support@pawtag.co.nz.</p>`,
              },
              visible: true,
              order: 0,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created Privacy Policy page');
      } else {
        console.log('  Privacy Policy page already exists');
      }

      // Terms of Service
      const existingTerms = await CmsPage.findOne({ slug: 'terms-of-service', deletedAt: null }).session(session);
      if (!existingTerms) {
        await CmsPage.create([{
          slug: 'terms-of-service',
          title: 'Terms of Service',
          metaTitle: 'Terms of Service - PawTag',
          metaDescription: 'PawTag Terms of Service - Read our terms and conditions for using our pet recovery services.',
          metaKeywords: ['terms of service', 'terms and conditions', 'user agreement', 'PawTag'],
          sections: [
            {
              sectionId: 'terms-body',
              type: 'text',
              title: '',
              content: {
                body: `<p class="text-lg text-gray-600 mb-4">Last updated: ${new Date().toLocaleDateString()}</p>
<h2 class="text-xl font-semibold mt-6">1. Acceptance of Terms</h2>
<p>By accessing or using PawTag's services, you agree to be bound by these Terms of Service.</p>
<h2 class="text-xl font-semibold mt-6">2. Description of Service</h2>
<p>PawTag provides QR-coded pet recovery tags and associated online profiles to help reunite lost pets with their owners.</p>
<h2 class="text-xl font-semibold mt-6">3. User Responsibilities</h2>
<p>You are responsible for maintaining the accuracy of your pet's profile information and keeping your account credentials secure.</p>
<h2 class="text-xl font-semibold mt-6">4. Purchases and Refunds</h2>
<p>All purchases are final. Refunds may be issued at our discretion for defective products within 30 days of purchase.</p>
<h2 class="text-xl font-semibold mt-6">5. Limitation of Liability</h2>
<p>PawTag is not responsible for the recovery of lost pets. Our service facilitates communication between finders and owners but does not guarantee reunification.</p>
<h2 class="text-xl font-semibold mt-6">6. Contact Us</h2>
<p>If you have questions about these Terms, please contact us at support@pawtag.co.nz.</p>`,
              },
              visible: true,
              order: 0,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created Terms of Service page');
      } else {
        console.log('  Terms of Service page already exists');
      }

      // FAQ
      const existingFaq = await CmsPage.findOne({ slug: 'faq', deletedAt: null }).session(session);
      if (!existingFaq) {
        await CmsPage.create([{
          slug: 'faq',
          title: 'Frequently Asked Questions',
          metaTitle: 'FAQ - PawTag Help Center',
          metaDescription: 'Everything you need to know about PawTag pet recovery tags.',
          metaKeywords: ['FAQ', 'help', 'support', 'questions', 'PawTag'],
          sections: [
            {
              sectionId: 'faq-body',
              type: 'faq',
              title: 'Frequently Asked Questions',
              content: {
                description: 'Everything you need to know about PawTag.',
                faqs: [
                  { q: 'How does PawTag work?', a: "Each PawTag has a unique QR code. When someone finds your pet, they scan the tag with their phone and instantly see your pet's profile with your contact details. No app is needed." },
                  { q: 'Do finders need an app to scan the tag?', a: 'No. The QR code works with any smartphone camera. Simply point your camera at the tag and a link will appear to view the pet\'s profile.' },
                  { q: 'What information is visible to finders?', a: "Only what you choose to share: your pet's name, photo, medical alerts, and a contact number or email. Your home address is never shown unless you add it." },
                  { q: 'Is my personal data secure?', a: 'Yes. All data is encrypted and stored securely. We never sell or share your personal information. You control exactly what finders can see.' },
                  { q: 'How long does the tag last?', a: 'PawTag QR tags are waterproof, scratch-resistant, and built to last the lifetime of your pet. They do not require batteries or charging.' },
                  { q: "Can I update my pet's profile after purchasing?", a: "Yes. You can update your pet's photo, contact details, medical information, and any other profile data at any time from your account dashboard." },
                  { q: 'What happens if my pet goes missing?', a: "When someone scans the tag, you'll receive an instant notification with the finder's location. You can then contact them directly to arrange a reunion." },
                  { q: 'Do you ship internationally?', a: 'Currently we ship within New Zealand. International shipping is coming soon.' },
                ],
              },
              visible: true,
              order: 0,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created FAQ page');
      } else {
        console.log('  FAQ page already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 6. EMAIL TEMPLATES
      // ═══════════════════════════════════════
      console.log('--- Seeding Email Templates ---');
      const emailTemplates = [
        {
          name: 'Welcome',
          slug: 'welcome',
          subject: 'Welcome to PawTag!',
          title: 'Welcome to PawTag!',
          subtitle: 'Your account is ready',
          body: 'Hi {{name}},\n\nYour account has been verified and is now active! Welcome to the PawTag community.\n\nYou can now register your pets, order QR-coded recovery tags, and get notified when someone finds your pet.\n\nGo to My Account: {{accountUrl}}\n\nNeed help? Contact us at support@pawtag.co.nz',
          ctaText: 'Go to My Account',
          ctaUrl: '{{accountUrl}}',
          preheader: 'Your PawTag account is verified and active. Start protecting your pets today.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'accountUrl'],
          status: 'active' as const,
        },
        {
          name: 'Email Verification',
          slug: 'verification-email',
          subject: 'Verify your email address',
          title: 'Verify your email address',
          subtitle: 'One step closer to protecting your pet',
          body: 'Hi {{name}},\n\nWelcome to PawTag! Please verify your email address to activate your account and start protecting your pets.\n\nVerify My Email: {{verificationUrl}}\n\nThis link expires in 24 hours.\nIf you didn\'t create a PawTag account, you can safely ignore this email.',
          ctaText: 'Verify My Email',
          ctaUrl: '{{verificationUrl}}',
          preheader: 'Verify your email to activate your PawTag account. Link expires in 24 hours.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'verificationUrl'],
          status: 'active' as const,
        },
        {
          name: 'Password Reset',
          slug: 'password-reset',
          subject: 'Reset your password',
          title: 'Reset your password',
          subtitle: 'Password reset request',
          body: 'Hi {{name}},\n\nWe received a request to reset your password. Click the button below to choose a new one.\n\nReset Password: {{resetUrl}}\n\nThis link expires in 1 hour.\nIf you didn\'t request a password reset, ignore this email. Your password will not change.',
          ctaText: 'Reset Password',
          ctaUrl: '{{resetUrl}}',
          preheader: 'Reset your PawTag password. Link expires in 1 hour.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'resetUrl'],
          status: 'active' as const,
        },
        {
          name: 'Pet Found',
          slug: 'pet-found',
          subject: 'Someone found {{petName}}!',
          title: 'Someone found {{petName}}',
          subtitle: 'Lost pet alert',
          body: 'Hi {{ownerName}},\n\nSomeone found {{petName}}!\n\nSomeone scanned {{petName}}\'s tag and wants to help reunite you.\n\n{{#finderMessage}}Finder\'s message: "{{finderMessage}}"{{/finderMessage}}\n\n{{#finderContact}}Finder\'s contact: {{finderContact}}{{/finderContact}}\n\n{{#scanLocation}}Location: {{scanLocation}}{{/scanLocation}}\n\nView Details: {{viewDetailsUrl}}\n\nTime is critical. Reach out to the finder as soon as possible to arrange a reunion.',
          ctaText: 'View Details',
          ctaUrl: '{{viewDetailsUrl}}',
          preheader: 'Great news! Someone found your pet and wants to help reunite you.',
          senderEmail: 'alerts@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['ownerName', 'petName', 'finderMessage', 'finderContact', 'scanLocation', 'viewDetailsUrl'],
          status: 'active' as const,
        },
        {
          name: 'Order Confirmation',
          slug: 'order-confirmation',
          subject: 'Order Confirmed - {{orderNumber}}',
          title: 'Order Confirmed',
          subtitle: 'Order {{orderNumber}}',
          body: 'Hi {{name}},\n\nThank you for your order! We\'re processing it now and will notify you when it ships.\n\nOrder: {{orderNumber}}\nTotal: ${{total}}\n\nShipping to:\n{{shippingAddress.line1}}\n{{shippingAddress.city}}, {{shippingAddress.state}} {{shippingAddress.zip}}\n\nView Order: {{viewOrderUrl}}\n\nQuestions? Reply to this email or contact support@pawtag.co.nz',
          ctaText: 'View Order',
          ctaUrl: '{{viewOrderUrl}}',
          preheader: 'Your PawTag order has been confirmed.',
          senderEmail: 'orders@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'orderNumber', 'total', 'shippingAddress', 'viewOrderUrl'],
          status: 'active' as const,
        },
        {
          name: 'Shipping Notification',
          slug: 'shipping-notification',
          subject: 'Your Order Has Shipped - {{orderNumber}}',
          title: 'Your Order Has Shipped',
          subtitle: 'Order {{orderNumber}}',
          body: 'Hi {{name}},\n\nGreat news! Your order has been shipped and is on its way to you.\n\nTracking Number: {{trackingNumber}}\nOrder: {{orderNumber}}\n\nView Order: {{viewOrderUrl}}',
          ctaText: 'View Order',
          ctaUrl: '{{viewOrderUrl}}',
          preheader: 'Your PawTag order has been shipped.',
          senderEmail: 'shipping@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'orderNumber', 'trackingNumber', 'viewOrderUrl'],
          status: 'active' as const,
        },
        {
          name: 'Account Status Update',
          slug: 'account-status',
          subject: 'Account Status Update',
          title: 'Account Status Update',
          subtitle: 'PawTag account notification',
          body: 'Hi {{name}},\n\nYour PawTag account status has been updated to: {{status}}\n\n{{#reason}}Reason: {{reason}}{{/reason}}\n\nIf you believe this is an error, please contact support@pawtag.co.nz.',
          ctaText: '',
          ctaUrl: '',
          preheader: 'Your PawTag account status has been updated.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'status', 'reason'],
          status: 'active' as const,
        },
      ];

      let emailCreated = 0;
      for (const t of emailTemplates) {
        const existing = await CmsEmailTemplate.findOne({ slug: t.slug }).session(session);
        if (!existing) {
          await CmsEmailTemplate.create([{ ...t, createdBy: adminId, updatedBy: adminId }], { session });
          emailCreated++;
        }
      }
      console.log(`  ${emailCreated} new email templates created (${emailTemplates.length} total)\n`);

      // ═══════════════════════════════════════
      // 7. SMS TEMPLATES
      // ═══════════════════════════════════════
      console.log('--- Seeding SMS Templates ---');
      const existingSms = await CmsSmsTemplate.findOne({ slug: 'phone-otp' }).session(session);
      if (!existingSms) {
        await CmsSmsTemplate.create([{
          name: 'Phone OTP',
          slug: 'phone-otp',
          message: 'Your PawTag verification code is: {{otp}}\n\nIt expires in 10 minutes. Do not share this code.',
          variables: ['otp'],
          status: 'active',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created phone OTP SMS template');
      } else {
        console.log('  Phone OTP SMS template already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 8. PET REFERENCES
      // ═══════════════════════════════════════
      console.log('--- Seeding Pet References ---');
      const petTypes = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'];

      const petColors: Record<string, string[]> = {
        Dog: ['Black', 'White', 'Brown', 'Cream', 'Golden', 'Red', 'Blue (Gray)', 'Fawn', 'Brindle', 'Merle', 'Sable', 'Chocolate', 'Liver', 'Tan', 'Silver'],
        Cat: ['Black', 'White', 'Gray', 'Blue', 'Orange (Ginger)', 'Cream', 'Brown', 'Chocolate', 'Lilac', 'Cinnamon', 'Fawn'],
        Rabbit: ['White', 'Black', 'Blue', 'Chocolate', 'Lilac', 'Chestnut', 'Chinchilla', 'Sable', 'Tortoise', 'Agouti'],
        Hamster: ['Golden', 'White', 'Black', 'Gray', 'Cream', 'Cinnamon', 'Sable', 'Silver'],
        'Guinea Pig': ['White', 'Black', 'Brown', 'Red', 'Cream', 'Buff', 'Chocolate', 'Lilac', 'Slate'],
        Bird: ['Green', 'Blue', 'Yellow', 'White', 'Gray', 'Black', 'Red', 'Violet', 'Turquoise', 'Lutino', 'Albino'],
      };

      const petPatterns: Record<string, string[]> = {
        Dog: ['Solid', 'Merle', 'Brindle', 'Sable', 'Tan Points', 'Tricolor', 'Piebald', 'Tuxedo', 'Harlequin', 'Spotted', 'Roan'],
        Cat: ['Solid', 'Tabby', 'Calico', 'Tortoiseshell', 'Bicolor', 'Tricolor', 'Colorpoint', 'Ticked', 'Spotted', 'Mackerel', 'Classic Tabby'],
        Rabbit: ['Solid', 'Broken', 'Dutch', 'Himalayan', 'Otter', 'Chinchilla', 'Fox', 'Steel', 'Butterfly', 'Magpie'],
        Hamster: ['Solid', 'Banded', 'Sanded', 'Ticked', 'Agouti', 'Spotted'],
        'Guinea Pig': ['Solid', 'Roan', 'Dalmatian', 'Brindle', 'Himalayan', 'Dutch', 'Orange', 'Ticked', 'Agouti'],
        Bird: ['Solid', 'Pied', 'Lutino', 'Albino', 'Opaline', 'Spangle', 'Clearwing', 'Crested', 'Dominant Pied'],
      };

      const petBreeds: Record<string, string[]> = {
        Dog: ['Mixed Breed', 'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'French Bulldog', 'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Dachshund', 'German Shorthaired Pointer', 'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier', 'Cavalier King Charles Spaniel', 'Doberman Pinscher', 'Boxer', 'Miniature Schnauzer', 'Cocker Spaniel', 'Shih Tzu', 'Border Collie', 'Belgian Malinois', 'Alaskan Malamute', 'Siberian Husky', 'Bernese Mountain Dog', 'Great Dane', 'Saint Bernard', 'Old English Sheepdog', 'Samoyed', 'Akita', 'Mastiff', 'Newfoundland', 'West Highland White Terrier', 'Scottish Terrier', 'Bull Terrier', 'Jack Russell Terrier', 'Staffordshire Bull Terrier', 'Airedale Terrier', 'Chihuahua', 'Pomeranian', 'Maltese', 'Pug', 'Papillon', 'Italian Greyhound', 'Chinese Crested', 'Basset Hound', 'Bloodhound', 'Greyhound', 'Whippet', 'Rhodesian Ridgeback', 'Afghan Hound', 'Basenji', 'Shiba Inu', 'Shar Pei', 'Chow Chow', 'Lhasa Apso', 'Sheltie', 'Collie', 'Dalmatian', 'Weimaraner', 'Vizsla', 'Brittany Spaniel', 'Setter (Irish)', 'Setter (English)', 'Pointer', 'Havanese', 'Bichon Frise', 'Maltepoo', 'Goldendoodle', 'Labradoodle', 'Cockapoo', 'Pomsky'],
        Cat: ['Mixed Breed', 'Domestic Shorthair', 'Domestic Longhair', 'Ragdoll', 'Maine Coon', 'Persian', 'British Shorthair', 'Bengal', 'Abyssinian', 'Siamese', 'Russian Blue', 'Scottish Fold', 'Sphynx', 'Birman', 'Norwegian Forest Cat', 'Ragamuffin', 'Himalayan', 'American Shorthair', 'Exotic Shorthair', 'Oriental Shorthair', 'Tonkinese', 'Burmese', 'Cornish Rex', 'Devon Rex', 'Selkirk Rex', 'Somali', 'Balinese', 'Chartreux', 'Korat', 'LaPerm', 'Manx', 'Munchkin', 'Singapura', 'Snowshoe', 'Turkish Angora', 'Turkish Van'],
        Rabbit: ['Mixed Breed', 'Holland Lop', 'Mini Lop', 'English Lop', 'French Lop', 'Netherland Dwarf', 'Mini Rex', 'Standard Rex', 'Velveteen Lop', 'Himalayan', 'Dutch', 'English Spot', 'Checkered Giant', 'Flemish Giant', 'Lionhead', 'Angora', 'Jersey Wooly', 'Californian', 'New Zealand', 'American', 'Chinchilla', 'Argente', 'Belgian Hare', 'English Angora', 'French Angora'],
        Hamster: ['Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White', 'Roborovski', 'Chinese', "Campbell's Dwarf"],
        'Guinea Pig': ['American', 'Peruvian', 'Silkie (Sheltie)', 'Teddy', 'Texel', 'Rex', 'American Crested', 'Peruvian Crested', 'Skinny Pig', 'Baldwin', 'Sheba', 'White Crested', 'Merino', 'Lunkarya'],
        Bird: ['Budgerigar (Budgie)', 'Cockatiel', 'Lovebird', 'African Grey', 'Amazon Parrot', 'Macaw', 'Cockatoo', 'Conure', 'Canary', 'Finch', 'Parrotlet', 'Quaker Parrot', 'Ringneck Dove', 'Pionus', 'Caique', 'Lorikeet', 'Mynah', "Bourke's Parakeet", 'Lineolated Parakeet'],
      };

      const petGenders = [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'unknown', label: 'Unknown' },
      ];

      const existingPetTypes = await CmsPetReference.countDocuments({ type: 'pet_type', deletedAt: null }).session(session);
      if (existingPetTypes === 0) {
        let refCount = 0;
        const refs: Array<Record<string, unknown>> = [];

        // Pet Types
        petTypes.forEach((t, i) => {
          refs.push({ type: 'pet_type', label: t, value: t.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
        });

        // Colors
        for (const [species, colors] of Object.entries(petColors)) {
          colors.forEach((c, i) => {
            refs.push({ type: 'color', petSpecies: species, label: c, value: c.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
          });
        }

        // Patterns
        for (const [species, patterns] of Object.entries(petPatterns)) {
          patterns.forEach((p, i) => {
            refs.push({ type: 'pattern', petSpecies: species, label: p, value: p.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
          });
        }

        // Breeds
        for (const [species, breeds] of Object.entries(petBreeds)) {
          breeds.forEach((b, i) => {
            refs.push({ type: 'breed', petSpecies: species, label: b, value: b.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
          });
        }

        // Genders
        petGenders.forEach((g, i) => {
          refs.push({ type: 'gender', label: g.label, value: g.value, order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
        });

        // Insert in batches
        const batchSize = 100;
        for (let i = 0; i < refs.length; i += batchSize) {
          const batch = refs.slice(i, i + batchSize);
          await CmsPetReference.create(batch, { session });
          refCount += batch.length;
        }
        console.log(`  Created ${refCount} pet reference records`);
      } else {
        console.log(`  Pet references already exist (${existingPetTypes} types found)`);
      }
      console.log('');

      // ═══════════════════════════════════════
      // 9. SHOP PAGE
      // ═══════════════════════════════════════
      console.log('--- Seeding Shop Page ---');
      const existingShop = await CmsShopPage.findOne({ slug: 'shop', deletedAt: null }).session(session);
      if (!existingShop) {
        await CmsShopPage.create([{
          slug: 'shop',
          title: 'Shop PawTag Products',
          subtitle: 'Browse our range of QR-coded pet recovery tags. Each tag links to your pet\'s online profile, helping them get home faster.',
          content: {
            heroTitle: 'Shop PawTag Products',
            heroDescription: 'Browse our range of QR-coded pet recovery tags. Each tag links to your pet\'s online profile, helping them get home faster.',
          },
          metaTitle: 'Shop - PawTag QR Pet Recovery Tags',
          metaDescription: 'Browse our range of QR-coded pet recovery tags. Each tag links to your pet\'s online profile, helping them get home faster.',
          isActive: true,
        }], { session });
        console.log('  Created shop page');
      } else {
        console.log('  Shop page already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 10. AUTH PAGES
      // ═══════════════════════════════════════
      console.log('--- Seeding Auth Pages ---');
      const authPages = [
        { pageType: 'login', title: 'Welcome back', subtitle: 'Sign in to your PawTag account', content: {} },
        { pageType: 'register', title: 'Create your account', subtitle: 'Join thousands of pet owners protecting their companions', content: {} },
        { pageType: 'forgot_password', title: 'Forgot your password?', subtitle: "Enter your email and we'll send you a reset link.", content: {} },
        { pageType: 'reset_password', title: 'Reset your password', subtitle: 'Enter your new password below.', content: {} },
      ];

      let authCreated = 0;
      for (const p of authPages) {
        const existing = await CmsAuthPage.findOne({ pageType: p.pageType }).session(session);
        if (!existing) {
          await CmsAuthPage.create([{ ...p, isActive: true }], { session });
          authCreated++;
        }
      }
      console.log(`  ${authCreated} new auth pages created (${authPages.length} total)\n`);

    });

    console.log('═══════════════════════════════════════');
    console.log('CMS Seed completed successfully!');
    console.log('═══════════════════════════════════════');
  } catch (error) {
    console.error('CMS Seed failed:', error);
    throw error;
  } finally {
    session.endSession();
    await disconnectDatabase();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
