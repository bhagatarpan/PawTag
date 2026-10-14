import { test, expect, type Page } from '@playwright/test';

/**
 * Homepage hero slider — browser E2E.
 *
 * The CMS endpoint is stubbed per-test so the suite is deterministic in any
 * environment (the web preview proxies /api to a running API, which may
 * serve live CMS data). CMS mapping itself is pinned by unit + integration
 * tests; this spec covers real-browser behavior: navigation, wraparound,
 * autoplay, pause/play, keyboard, reduced motion, CTA links, and the
 * mobile composition.
 */

const SLIDE_SELECTOR = '[aria-roledescription="slide"]';

const HERO_STUB = [
  {
    _id: 'e2e-1',
    sectionType: 'hero_slide',
    title: 'Hero — Pet Safety',
    subtitle: '',
    order: 0,
    isActive: true,
    content: {
      eyebrow: 'PET SAFETY, SIMPLIFIED',
      headline: "They can't tell someone where they live. Their tag can.",
      sub: 'Give your pet a simple way to be identified.',
      ctaText: 'Shop PawTag',
      ctaUrl: '/shop',
      secondaryCtaText: 'How PawTag Works',
      secondaryCtaUrl: '/about',
      duration: 7,
      desktopImageUrl: '',
      mobileImageUrl: '',
      imageAlt: '',
      imageFocalPoint: 'center',
    },
  },
  {
    _id: 'e2e-2',
    sectionType: 'hero_slide',
    title: 'Hero — Smart Identification',
    subtitle: '',
    order: 1,
    isActive: true,
    content: {
      eyebrow: 'SMART IDENTIFICATION',
      headline: 'One scan can make all the difference.',
      sub: 'Someone finds your pet and can get in touch.',
      ctaText: 'See How It Works',
      ctaUrl: '/about',
      duration: 7,
      desktopImageUrl: '',
      mobileImageUrl: '',
      imageAlt: '',
      imageFocalPoint: 'center',
    },
  },
  {
    _id: 'e2e-3',
    sectionType: 'hero_slide',
    title: 'Hero — Pet Profiles',
    subtitle: '',
    order: 2,
    isActive: true,
    content: {
      eyebrow: 'MORE THAN A NAME TAG',
      headline: 'Their important details, always close.',
      sub: 'Create a pet profile for your companion.',
      ctaText: 'Discover Pet Profiles',
      ctaUrl: '/pet-recovery',
      duration: 7,
      desktopImageUrl: '',
      mobileImageUrl: '',
      imageAlt: '',
      imageFocalPoint: 'center',
    },
  },
];

async function stubHero(page: Page) {
  await page.route('**/api/public/cms/homepage/sections*', (route) =>
    route.fulfill({ json: { success: true, data: HERO_STUB } }),
  );
}

async function activeSlideIndex(page: Page): Promise<number> {
  return page.evaluate((selector) => {
    const slides = Array.from(document.querySelectorAll(selector));
    return slides.findIndex((slide) => slide.getAttribute('aria-hidden') === 'false');
  }, SLIDE_SELECTOR);
}

test.describe('Homepage hero slider', () => {
  test('renders the stubbed slides with valid CTA navigation', async ({ page }) => {
    await stubHero(page);
    await page.goto('/');

    await expect(page.locator(SLIDE_SELECTOR)).toHaveCount(3);
    expect(await activeSlideIndex(page)).toBe(0);
    await expect(page.getByRole('heading', { level: 2 }).first()).toContainText("They can't tell someone where they live");

    const shopLink = page.getByRole('link', { name: /Shop PawTag/ }).first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('next/previous navigate with wraparound', async ({ page }) => {
    await stubHero(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Next slide' }).click();
    expect(await activeSlideIndex(page)).toBe(1);

    await page.getByRole('button', { name: 'Previous slide' }).click();
    expect(await activeSlideIndex(page)).toBe(0);

    // Wrap backwards from the first slide
    await page.getByRole('button', { name: 'Previous slide' }).click();
    expect(await activeSlideIndex(page)).toBe(2);
  });

  test('indicator buttons select slides directly', async ({ page }) => {
    await stubHero(page);
    await page.goto('/');

    await page.getByRole('tab', { name: 'Go to slide 3 of 3' }).click();
    expect(await activeSlideIndex(page)).toBe(2);
    await expect(page.getByRole('tab', { name: 'Go to slide 3 of 3' })).toHaveAttribute('aria-selected', 'true');
  });

  test('pause/play control stops and resumes autoplay', async ({ page }) => {
    await stubHero(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Pause auto-rotation' }).click();
    const play = page.getByRole('button', { name: 'Resume auto-rotation' });
    await expect(play).toHaveAttribute('aria-pressed', 'true');

    const indexWhilePaused = await activeSlideIndex(page);
    await page.waitForTimeout(2500);
    expect(await activeSlideIndex(page)).toBe(indexWhilePaused);
  });

  test('autoplay advances approximately every 7 seconds', async ({ page }) => {
    await stubHero(page);
    await page.goto('/');

    await expect
      .poll(async () => activeSlideIndex(page), { timeout: 12_000, intervals: [500] })
      .toBe(1);
  });

  test('reduced motion disables autoplay', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stubHero(page);
    await page.goto('/');

    await page.waitForTimeout(9_000);
    expect(await activeSlideIndex(page)).toBe(0);
  });

  test('carousel controls are keyboard operable', async ({ page }) => {
    await stubHero(page);
    await page.goto('/');

    const next = page.getByRole('button', { name: 'Next slide' });
    await next.focus();
    await page.keyboard.press('Enter');
    expect(await activeSlideIndex(page)).toBe(1);
  });

  test('mobile composition stacks image and content without hero overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await stubHero(page);
    await page.goto('/');

    // Media is visible on mobile — the old implementation hid it entirely
    const media = page.locator('[aria-roledescription="slide"][aria-hidden="false"] .from-primary-600').first();
    await expect(media).toBeVisible();

    // Measure the hero's own box (page-level overflow can come from other
    // homepage sections, which are outside this workstream's scope)
    const heroOverflow = await page.evaluate((selector) => {
      const section = document.querySelector(selector);
      if (!section) return -1;
      const rect = section.getBoundingClientRect();
      return Math.max(0, Math.round(rect.right - document.documentElement.clientWidth));
    }, 'section[aria-roledescription="carousel"]');
    expect(heroOverflow).toBeLessThanOrEqual(1);

    await expect(page.getByRole('link', { name: /Shop PawTag/ }).first()).toBeVisible();
  });
});
