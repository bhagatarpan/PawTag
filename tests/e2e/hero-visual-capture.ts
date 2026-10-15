import { test } from '@playwright/test';

/**
 * Opt-in visual capture of the homepage hero at representative viewports.
 * Not a test — an inspection aid for design review. Run:
 *   pnpm exec playwright test --config playwright.hero.config.ts --test-match=hero-visual-capture.ts
 * Screenshots land in test-results/hero-visual/.
 */

const HERO_STUB = [
  {
    _id: 'vis-1', sectionType: 'hero_slide', title: 'Hero — Pet Safety', subtitle: '', order: 0, isActive: true,
    content: {
      eyebrow: 'PET SAFETY, SIMPLIFIED',
      headline: "They can't tell someone where they live. Their tag can.",
      sub: 'Give your pet a simple way to be identified and help someone reach you if they wander.',
      ctaText: 'Shop PawTag', ctaUrl: '/shop',
      secondaryCtaText: 'How PawTag Works', secondaryCtaUrl: '/about',
      duration: 7, desktopImageUrl: '', mobileImageUrl: '', imageAlt: '', imageFocalPoint: 'center',
    },
  },
  {
    _id: 'vis-2', sectionType: 'hero_slide', title: 'Hero — Smart Identification', subtitle: '', order: 1, isActive: true,
    content: {
      eyebrow: 'SMART IDENTIFICATION',
      headline: 'One scan can make all the difference.',
      sub: 'Someone finds your pet, scans the tag with their phone, and can get in touch. No app required for the finder.',
      ctaText: 'See How It Works', ctaUrl: '/about',
      duration: 7, desktopImageUrl: '', mobileImageUrl: '', imageAlt: '', imageFocalPoint: 'center',
    },
  },
];

const VIEWPORTS = [
  { name: '320-compact', width: 320, height: 568 },
  { name: '375-mobile', width: 375, height: 812 },
  { name: '390-mobile', width: 390, height: 844 },
  { name: '430-mobile', width: 430, height: 932 },
  { name: '768-tablet', width: 768, height: 1024 },
  { name: '1280-laptop-short', width: 1280, height: 720 },
  { name: '1280-desktop', width: 1280, height: 800 },
  { name: '1440-desktop', width: 1440, height: 900 },
  { name: '1920-wide', width: 1920, height: 1080 },
];

test('capture hero at representative viewports', async ({ page }) => {
  await page.route('**/api/public/cms/homepage/sections*', (route) =>
    route.fulfill({ json: { success: true, data: HERO_STUB } }),
  );

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.waitForTimeout(600);
    const hero = page.locator('section[aria-roledescription="carousel"]');
    await hero.screenshot({ path: `test-results/hero-visual/${viewport.name}.png` });
  }

  // Also capture slide 2 on desktop to check crossfade content
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Next slide' }).click();
  await page.waitForTimeout(900);
  await page
    .locator('section[aria-roledescription="carousel"]')
    .screenshot({ path: 'test-results/hero-visual/1280-slide2.png' });
});
