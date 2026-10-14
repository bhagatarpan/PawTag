import { test, expect } from '@playwright/test';

test.describe('Emergency lost-pet widget + finder landing', () => {
  test('lost modal opens with sign-in link; escape closes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Lost pet help/ }).click();
    await page.getByRole('button', { name: /I Lost My Pet/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("We're here to help");
    await expect(dialog.getByRole('link', { name: /Sign in to continue/ })).toHaveAttribute('href', '/login');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('found modal offers the finder portal and cancel closes it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Lost pet help/ }).click();
    await page.getByRole('button', { name: /I Found a Pet/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('doing great work');
    const finderLink = dialog.getByRole('link', { name: /Open the Finder Portal/ });
    await expect(finderLink).toHaveAttribute('href', /finder/);

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('FAB can be dragged and the position persists across reload', async ({ page }) => {
    await page.goto('/');
    const fab = page.getByRole('button', { name: /Lost pet help/ });
    const box = (await fab.boundingBox())!;
    expect(box.x).toBeGreaterThan(1000); // starts bottom-right

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 400, box.y + box.height / 2 - 300, { steps: 10 });
    await page.mouse.up();

    const moved = (await fab.boundingBox())!;
    expect(moved.x).toBeLessThan(box.x - 300);
    expect(moved.y).toBeLessThan(box.y - 200);

    // Regression (real-device bug): the position must be APPLIED as actual
    // CSS coordinates — {x,y} passed to style is silently ignored and the
    // control sinks out of view.
    const wrapper = fab.locator('..');
    const inlineLeft = await wrapper.evaluate((el) => (el as HTMLElement).style.left);
    const inlineTop = await wrapper.evaluate((el) => (el as HTMLElement).style.top);
    expect(inlineLeft).toMatch(/^\d+(\.\d+)?px$/);
    expect(inlineTop).toMatch(/^\d+(\.\d+)?px$/);
    const viewport = page.viewportSize()!;
    expect(moved.x + moved.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(moved.y + moved.height).toBeLessThanOrEqual(viewport.height + 1);

    // Drag was NOT interpreted as a click (panel stays closed)
    await expect(page.getByRole('button', { name: /I Lost My Pet/ })).toBeHidden();

    await page.reload();
    const fabAfter = page.getByRole('button', { name: /Lost pet help/ });
    const restored = (await fabAfter.boundingBox())!;
    expect(Math.abs(restored.x - moved.x)).toBeLessThanOrEqual(2);
    const restoredLeft = await fabAfter.locator('..').evaluate((el) => (el as HTMLElement).style.left);
    expect(restoredLeft).toMatch(/^\d+(\.\d+)?px$/);
  });

  test('FAB collapses to a mini dot and expands again', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Collapse emergency help' }).click();
    const mini = page.getByRole('button', { name: 'Show lost pet help' });
    await expect(mini).toBeVisible();
    await mini.click();
    await expect(page.getByRole('button', { name: /Lost pet help/ })).toBeVisible();
  });

  test('an off-screen saved position is rescued on load (no clearing storage needed)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('pawtag_emergency_fab_pos', JSON.stringify({ x: 99999, y: 99999 }));
    });
    await page.reload();

    const fab = page.getByRole('button', { name: /Lost pet help/ });
    const box = (await fab.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  });

  test('shrinking the viewport pulls the FAB back on-screen', async ({ page }) => {
    await page.goto('/');
    const fab = page.getByRole('button', { name: /Lost pet help/ });
    const box = (await fab.boundingBox())!;

    // Drag to the bottom-right corner, then shrink the window drastically
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 500, box.y + box.height / 2 + 500, { steps: 10 });
    await page.mouse.up();
    await page.setViewportSize({ width: 500, height: 400 });

    const moved = (await fab.boundingBox())!;
    expect(moved.x + moved.width).toBeLessThanOrEqual(501);
    expect(moved.y + moved.height).toBeLessThanOrEqual(401);
  });

  test('a cancelled drag ends cleanly and persists a valid position', async ({ page }) => {
    await page.goto('/');
    const fab = page.getByRole('button', { name: /Lost pet help/ });
    const box = (await fab.boundingBox())!;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 150, { steps: 8 });
    // Safari-style gesture takeover mid-drag
    await fab.evaluate((el) => el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })));
    await page.mouse.up();

    await expect(fab).toBeVisible();
    await page.reload();
    const restored = page.getByRole('button', { name: /Lost pet help/ });
    await expect(restored).toBeVisible();
    const viewport = page.viewportSize()!;
    const rbox = (await restored.boundingBox())!;
    expect(rbox.x + rbox.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('finder landing accepts a tag id and navigates to the tag view', async ({ page }) => {
    await page.goto('http://127.0.0.1:3113/');
    await expect(page.getByRole('heading', { name: "Find a Pet's Owner" })).toBeVisible();
    await page.getByLabel('Tag ID').fill('pt-123456');
    await page.getByRole('button', { name: /Find Pet/ }).click();
    await page.waitForURL('**/PT-123456');
  });

  test('finder 404 offers "Enter a different tag ID" back to the entry form', async ({ page }) => {
    await page.route('**/api/finder/**', (route) =>
      route.fulfill({ status: 404, json: { success: false, error: 'Tag not found' } }),
    );
    await page.goto('http://127.0.0.1:3113/PT-DOES-NOT-EXIST');

    await expect(page.getByRole('heading', { name: 'Tag Not Found' })).toBeVisible();
    const back = page.getByRole('button', { name: /Enter a different tag ID/ });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByRole('heading', { name: "Find a Pet's Owner" })).toBeVisible();
  });
});
