import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('demo-banner')).toContainText('Local demo');
});

test('homepage links, school categories and listing details work', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('possibility');
  await expect(page.getByTestId('listing-card')).toHaveCount(8);
  await page.getByRole('link', { name: 'Calculators', exact: true }).click();
  await expect(page).toHaveURL(/\/category\/calculators$/);
  await expect(page.getByTestId('listing-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Scientific Calculator', exact: true }).click();
  await expect(page).toHaveURL(/\/listing\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Scientific Calculator');
  await expect(page.getByText('Nyasha K.', { exact: true })).toBeVisible();
});

test('search matches descriptions and has a useful empty state', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search listings' }).fill('protective slide cover');
  await page.getByRole('button', { name: 'Submit search' }).click();
  await expect(page.getByTestId('listing-card')).toHaveCount(1);
  await expect(page.getByTestId('listing-card')).toContainText('Scientific Calculator');
  await page.getByRole('searchbox', { name: 'Search listings' }).fill('nonexistent fictional item xyz');
  await page.getByRole('button', { name: 'Submit search' }).click();
  await expect(page.getByRole('heading', { name: 'No finds just yet.' })).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(page.getByTestId('listing-card')).toHaveCount(8);
});

test('category, condition and price filters compose and reset', async ({ page }) => {
  await page.goto('/explore');
  await page.getByLabel('Category', { exact: true }).selectOption('textbooks');
  await page.getByLabel('Condition', { exact: true }).selectOption('Good');
  await page.getByLabel('Minimum price').fill('7');
  await page.getByLabel('Maximum price').fill('9');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByTestId('listing-card')).toHaveCount(1);
  await expect(page.getByTestId('listing-card')).toContainText('Mathematics Textbook');
  await page.getByRole('link', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('listing-card')).toHaveCount(8);
});

test('sort produces numeric price order in both directions', async ({ page }) => {
  await page.goto('/explore');
  for (const [value, descending] of [['price_asc', false], ['price_desc', true]] as const) {
    await page.getByLabel('Sort by').selectOption(value);
    await expect(page).toHaveURL(new RegExp(`sort=${value}`));
    const prices = (await page.getByTestId('listing-price').allTextContents()).map((price) => Number(price.replace(/[^0-9.]/g, '')));
    expect(prices).toEqual([...prices].sort((a, b) => descending ? b - a : a - b));
  }
});

test('save and unsave persist in this browser and appear in saved products', async ({ page }) => {
  await page.getByRole('button', { name: 'Save Scientific Calculator', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unsave Scientific Calculator', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unsave Scientific Calculator', exact: true })).toBeVisible();
  await page.goto('/dashboard/saved');
  await expect(page.getByRole('link', { name: 'Scientific Calculator', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Unsave Scientific Calculator', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Scientific Calculator', exact: true })).toHaveCount(0);
});

test('dark mode persists after navigation and reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/explore');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('all required screens render without uncaught browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const paths = ['/explore', '/category/textbooks', '/listing/30000000-0000-4000-8000-000000000003', '/login', '/signup', '/forgot-password', '/reset-password', '/pending-approval', '/sell', '/listing/30000000-0000-4000-8000-000000000003/edit', '/dashboard', '/dashboard/listings', '/dashboard/saved', '/profile', '/admin', '/admin/users', '/admin/listings', '/admin/reports', '/rules', '/privacy'];
  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible();
  }
  expect(errors).toEqual([]);
});

for (const width of [360, 768, 1366, 1920]) {
  test(`layout fits ${width}px viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', '/explore', '/sell', '/dashboard/listings', '/admin/users', '/login']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${path} must not overflow at ${width}px`).toBe(false);
    }
    await page.goto('/');
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
    if (width === 360) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.getByRole('navigation', { name: 'Expanded navigation' })).toBeVisible();
      await page.getByRole('link', { name: 'Explore marketplace', exact: true }).click();
      await expect(page).toHaveURL(/\/explore$/);
    }
  });
}

test('unknown routes show the custom not-found state', async ({ page }) => {
  await page.goto('/not-a-campusmarket-route');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /marketplace|home/i }).first()).toBeVisible();
});
