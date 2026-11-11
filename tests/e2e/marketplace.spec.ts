import path from 'node:path';
import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

const PGLITE_ADMIN_URL = `http://127.0.0.1:${process.env.PGLITE_SUPABASE_PORT || '54329'}/__test__/admin`;
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'visual-qa');

async function testAdminAction(payload: Record<string, unknown>) {
  const res = await fetch(PGLITE_ADMIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  expect(res.ok).toBe(true);
  return res.json();
}

async function signIn(page: Page, email: string, password = 'wiseowl-test-password-123') {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.locator('.auth-form-panel').getByRole('button', { name: /Sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test.describe.configure({ mode: 'serial' });

let individualProductId = '';

test('1 & 2. Initial marketplace starts at ZERO products with no fictional demo fixtures', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Made by Students.');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Powered by Ideas.');
  await expect(page.getByText('Going an Extra Mile').first()).toBeVisible();
  await expect(page.getByTestId('listing-card')).toHaveCount(0);
  await expect(page.getByTestId('empty-state')).toContainText('No projects listed yet.');
  await expect(page.getByTestId('empty-state')).toContainText('Be among the first to showcase your project.');

  // Verify zero legacy second-hand demo items or demo banners exist anywhere
  const html = await page.content();
  for (const forbidden of ['Scientific Calculator', 'Mathematics Textbook', 'Nyasha K.', 'Local demo']) {
    expect(html).not.toContain(forbidden);
  }

  // Verify disclaimer is displayed honestly in footer and About page
  await expect(page.locator('footer')).toContainText('student-created platform');
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where Classroom Projects Become Real Enterprise.');
  await expect(page.locator('.disclaimer-panel')).toContainText('not an official commercial publication');

  // Create and promote initial school administrator, then confirm authenticated /marketplace also starts with 0 products
  await page.goto('/signup');
  await page.getByLabel('Display name').fill('Mrs Moyo Admin');
  await page.getByLabel('Email address').fill('admin@wiseowl.test');
  await page.getByLabel('Password').fill('wiseowl-test-password-123');
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: /Create member account/i }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');

  await testAdminAction({ action: 'promote_school_admin', email: 'admin@wiseowl.test' });
  await signIn(page, 'admin@wiseowl.test');

  await page.goto('/marketplace');
  await expect(page.getByTestId('listing-card')).toHaveCount(0);
  await expect(page.getByTestId('empty-state')).toContainText('No projects listed yet.');

  await page.goto('/projects');
  await expect(page.getByTestId('empty-state')).toContainText('No verified project groups listed yet.');
});

test('14. Responsive viewports (360, 390, 768, 1366, 1920), mobile navigation, and dark mode work cleanly', async ({
  page,
}) => {
  await signIn(page, 'admin@wiseowl.test');

  for (const width of [360, 390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['/', '/marketplace', '/seller', '/seller/register', '/about', '/admin']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${route} must not overflow horizontally at ${width}px`).toBe(false);
    }
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `home-${width}.png`), fullPage: true });
  }

  // Test mobile navigation & bottom bar at 360px
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  const mobileMenu = page.getByRole('navigation', { name: 'Expanded navigation' });
  await expect(mobileMenu).toBeVisible();
  await mobileMenu.getByRole('link', { name: 'Seller Portal' }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'seller-360.png'), fullPage: true });

  // Test dark mode toggle & persistence at 1366px
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'home-1366-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('3. Individual seller registration requires email confirmation and school admin approval', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/seller/register');
  await page.getByLabel('Student display name').fill('Tatenda M.');
  await page.getByLabel(/Email address/).fill('tatenda@wiseowl.test');
  await page.getByLabel('Password').fill('wiseowl-test-password-123');
  await page
    .getByLabel('Project summary')
    .fill('Designing and joining hardwood study desk organisers in Wood Technology.');
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Create Individual Seller Account' }).click();
  await expect(page.getByRole('status')).toContainText('School approval is required');

  await testAdminAction({ action: 'confirm_email', email: 'tatenda@wiseowl.test' });
  await signIn(page, 'tatenda@wiseowl.test');
  await expect(page).toHaveURL(/\/pending-approval$/);

  // Unapproved student cannot bypass pending approval to browse /marketplace
  await page.goto('/marketplace');
  await expect(page).toHaveURL(/\/pending-approval$/);

  // Admin approves membership (which approves requested seller access) and can toggle seller access
  await signIn(page, 'admin@wiseowl.test');
  await page.goto('/admin/users');
  const tatendaRow = page.getByTestId('admin-user-row').filter({ hasText: 'Tatenda M.' });
  await tatendaRow.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(tatendaRow).toContainText(/approved/i);
  await expect(tatendaRow).toContainText(/seller approved/i);

  // Verify admin can revoke and re-grant seller access cleanly
  await tatendaRow.getByRole('button', { name: 'Revoke Seller' }).click();
  await page.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(tatendaRow.getByRole('button', { name: 'Grant Seller' })).toBeVisible();
  await tatendaRow.getByRole('button', { name: 'Grant Seller' }).click();
  await page.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(tatendaRow).toContainText(/seller approved/i);
});

test('4 & 5. Shared project group creation, collaborator invitation, and unauthorized group access denial', async ({
  page,
}) => {
  // Register Collaborator B and Buyer C
  for (const [name, email] of [
    ['Chipo R.', 'chipo@wiseowl.test'],
    ['Farai B.', 'farai@wiseowl.test'],
  ]) {
    await page.context().clearCookies();
    await page.goto('/signup');
    await page.getByLabel('Display name').fill(name);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill('wiseowl-test-password-123');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /Create member account/i }).click();
    await expect(page.getByRole('status')).toContainText('Check your email');
    await testAdminAction({ action: 'confirm_email', email });
  }

  // Admin approves Chipo R. and Farai B. as school members (without individual seller access)
  await signIn(page, 'admin@wiseowl.test');
  await page.goto('/admin/users');
  for (const name of ['Chipo R.', 'Farai B.']) {
    const row = page.getByTestId('admin-user-row').filter({ hasText: name });
    await row.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('button', { name: 'Confirm decision' }).click();
    await expect(row).toContainText('approved');
  }

  // Tatenda M. creates project group "Westgate Solar Makers"
  await signIn(page, 'tatenda@wiseowl.test');
  await page.goto('/seller/group');
  await page.getByLabel('Group name').fill('Westgate Solar Makers');
  await page.getByLabel('Subject / learning area').fill('STEM, Robotics & Electronics');
  await page
    .getByLabel('Project description')
    .fill('Designing and assembling rechargeable solar study lamps for our Form 4 STEM practical project.');
  await page.getByRole('button', { name: 'Submit Group for Approval' }).click();
  await expect(page.getByTestId('group-card')).toContainText('Westgate Solar Makers');
  await expect(page.getByTestId('group-card')).toContainText('pending');

  // Admin approves "Westgate Solar Makers"
  await signIn(page, 'admin@wiseowl.test');
  await page.goto('/admin/groups');
  const groupCard = page.getByTestId('admin-group-row').filter({ hasText: 'Westgate Solar Makers' });
  await groupCard.getByRole('button', { name: 'Approve Group' }).click();
  await page.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(groupCard).toContainText('approved');

  // Tatenda M. invites Chipo R. as collaborator with product rights
  await signIn(page, 'tatenda@wiseowl.test');
  await page.goto('/seller/group');
  await page.getByRole('button', { name: 'Invite Member' }).click();
  await page.getByLabel('Approved Wise Owl member').selectOption({ label: 'Chipo R.' });
  await page.getByRole('button', { name: 'Send Invitation' }).click();

  // Chipo R. accepts invitation without needing shared passwords
  await signIn(page, 'chipo@wiseowl.test');
  await page.goto('/seller/group');
  await page.getByRole('button', { name: 'Accept Invitation' }).click();
  await expect(page.getByTestId('group-card')).toContainText('Westgate Solar Makers');

  // Farai B. (unrelated student) cannot list products and cannot self-approve group membership
  await signIn(page, 'farai@wiseowl.test');
  await page.goto('/seller/products/new');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Activate your seller workspace first.');

  await page.goto('/seller/group');
  await page.getByRole('button', { name: 'Request to Join' }).click();
  await expect(page.getByTestId('group-card')).toContainText('requested');
  // Still blocked from adding group products while membership is unapproved!
  await page.goto('/seller/products/new');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Activate your seller workspace first.');
});

test('6, 7, 8 & 15. Product creation, real photo uploads, choosing main photo, editing, and Seller Dashboard', async ({
  page,
}) => {
  const photoOne = await sharp({
    create: { width: 320, height: 240, channels: 3, background: '#4a2a19' },
  })
    .png()
    .toBuffer();
  const photoTwo = await sharp({
    create: { width: 320, height: 240, channels: 3, background: '#c2881a' },
  })
    .png()
    .toBuffer();

  // Tatenda M. creates an individual project product with 2 real photos
  await signIn(page, 'tatenda@wiseowl.test');
  await page.goto('/seller/products/new');
  await page.getByLabel('Project name').fill('Timber Craft Practical');
  await page.getByLabel('Product name').fill('Hardwood Study Desk Organiser');
  await page
    .getByLabel('Product description')
    .fill('Hand-joined pine and mukwa desk organiser crafted in the Wise Owl Westgate woodwork workshop.');
  await page.getByLabel('Category').selectOption({ label: 'Design & Technology' });
  await page.getByLabel('Price').fill('15.00');
  await page.getByLabel('Quantity available').fill('3');
  await page.getByLabel('Materials used').fill('Seasoned pine timber and natural beeswax polish');
  await page.getByLabel('Dimensions / size').fill('26 cm x 14 cm x 12 cm');

  await page.getByLabel('Product photographs').setInputFiles([
    { name: 'organiser-front.png', mimeType: 'image/png', buffer: photoOne },
    { name: 'organiser-detail.png', mimeType: 'image/png', buffer: photoTwo },
  ]);

  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page).toHaveURL(/\/seller\/products$/);
  const productRow = page.getByTestId('seller-product-row').filter({ hasText: 'Hardwood Study Desk Organiser' });
  await expect(productRow).toBeVisible();
  await expect(productRow).toContainText('pending review');

  // Extract product ID from link href
  const href = await productRow.locator('.management-title a').getAttribute('href');
  expect(href).toMatch(/^\/product\/[0-9a-f-]{36}$/);
  individualProductId = href!.slice('/product/'.length);

  // Edit product & choose second photo as main photo
  await productRow.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(new RegExp(`/seller/products/${individualProductId}/edit$`));
  await expect(page.locator('.photo-manager-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Set as main' }).click();
  await page
    .getByLabel('Production method')
    .fill('Mortise-and-tenon joinery sanded to 240-grit in the school workshop');
  await page.getByRole('button', { name: 'Save & submit for approval' }).click();
  await expect(page).toHaveURL(/\/seller\/products$/);

  // Collaborator Chipo R. submits a group product under "Westgate Solar Makers"
  await signIn(page, 'chipo@wiseowl.test');
  await page.goto('/seller/products/new');
  await page.getByLabel('Project name').fill('Clean Energy Prototype');
  await page.getByLabel('Product name').fill('Rechargeable Solar Study Lamp');
  await page
    .getByLabel('Product description')
    .fill('Portable 5V solar-charged LED reading lamp built and tested by the Westgate Solar Makers group.');
  await page.getByLabel('Category').selectOption({ label: 'Science & STEM Innovations' });
  await page.getByLabel('Price').fill('18.50');
  await page.getByLabel('Quantity available').fill('4');
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(page).toHaveURL(/\/seller\/products$/);
  await expect(page.getByTestId('seller-product-row')).toContainText('Rechargeable Solar Study Lamp');

  // Verify Seller Dashboard metrics for Tatenda M. (sees both individual + shared group products)
  await signIn(page, 'tatenda@wiseowl.test');
  await page.goto('/seller/dashboard');
  await expect(page.getByTestId('seller-metrics')).toBeVisible();
  await expect(page.getByTestId('seller-product-row')).toHaveCount(2);

  // Farai B. cannot see unapproved products in /marketplace and cannot access Tatenda's edit URL
  await signIn(page, 'farai@wiseowl.test');
  await page.goto('/marketplace');
  await expect(page.getByTestId('listing-card')).toHaveCount(0);
  const crossEdit = await page.goto(`/seller/products/${individualProductId}/edit`);
  expect([200, 404]).toContain(crossEdit?.status());
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'This page or project listing could not be found.'
  );
  await expect(page.locator('form.listing-form')).toHaveCount(0);
});

test('9. Admin product approval, verified manual product entry, and audit trail work end to end', async ({ page }) => {
  await signIn(page, 'admin@wiseowl.test');
  await page.goto('/admin/products');

  for (const title of ['Hardwood Study Desk Organiser', 'Rechargeable Solar Study Lamp']) {
    const row = page.getByTestId('admin-product-row').filter({ hasText: title });
    await row.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('button', { name: 'Confirm decision' }).click();
    await expect(row).toContainText('active');
  }

  // Admin publishes an actual verified school-project product via manual entry modal
  await page.getByRole('button', { name: 'Publish Verified Product' }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.locator('input[name="title"]').fill('Drip Irrigation Starter Kit');
  await dialog.locator('input[name="project_name"]').fill('Sustainable School Plot');
  await dialog
    .locator('textarea[name="description"]')
    .fill('Gravity-fed micro-drip emitter kit calibrated by Form 3 Agriculture learners.');
  await dialog.getByLabel('Product category').selectOption({ label: 'Agriculture & Agribusiness' });
  await dialog.locator('input[name="price"]').fill('9.50');
  await dialog.locator('input[name="stock_quantity"]').fill('5');
  await dialog.getByRole('button', { name: 'Publish Verified Product' }).click();

  await expect(
    page.getByTestId('admin-product-row').filter({ hasText: 'Drip Irrigation Starter Kit' })
  ).toContainText('active');

  // Verify immutable moderation audit events on /admin
  await page.goto('/admin');
  await expect(page.locator('.audit-list > div').first()).toBeVisible();

  // Capture populated catalog screenshot at 1366px
  await page.setViewportSize({ width: 1366, height: 960 });
  await page.goto('/marketplace');
  await expect(page.getByTestId('listing-card')).toHaveCount(3);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'marketplace-populated-1366.png'), fullPage: true });
});

test('10, 11, 12 & 13. Stock updates, safe purchase requests, cross-user request isolation, and atomic fulfillment', async ({
  page,
}) => {
  // Scenario 10: Tatenda M. updates stock of Hardwood Study Desk Organiser from 3 -> 2
  await signIn(page, 'tatenda@wiseowl.test');
  await page.goto('/seller/products');
  const sellerRow = page.getByTestId('seller-product-row').filter({ hasText: 'Hardwood Study Desk Organiser' });
  await sellerRow.getByRole('button', { name: 'Update Stock' }).click();
  const stockDialog = page.locator('dialog[open]');
  await stockDialog.getByLabel('Quantity available').fill('2');
  await stockDialog.getByRole('button', { name: 'Save stock' }).click();
  await expect(sellerRow).toContainText('2 available');

  // Scenario 11: Buyer Farai B. searches catalog, views product, and submits purchase request for 2 units
  await signIn(page, 'farai@wiseowl.test');
  await page.goto('/marketplace');
  await page.getByRole('searchbox', { name: 'Search listings' }).fill('Solar Makers');
  await page.getByRole('button', { name: 'Submit search' }).click();
  await expect(page.getByTestId('listing-card')).toHaveCount(1);
  await expect(page.getByTestId('listing-card')).toContainText('Rechargeable Solar Study Lamp');

  await page.goto(`/product/${individualProductId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hardwood Study Desk Organiser');
  await expect(page.getByTestId('detail-stock')).toContainText('2 units available');
  await expect(page.getByText('Mortise-and-tenon joinery')).toBeVisible();

  // Capture product detail screenshot
  await page.setViewportSize({ width: 1366, height: 960 });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'product-detail-1366.png'), fullPage: true });

  await page.getByLabel('Requested quantity').fill('2');
  await page.getByLabel('Optional note').fill('Available for supervised pickup at Friday break.');
  await page.getByRole('button', { name: 'Submit Request' }).click();

  await expect(page.getByTestId('buyer-request-item')).toContainText('2 units');
  await expect(page.getByTestId('buyer-request-item')).toContainText('pending');
  // Stock must NOT be deducted merely on request submission!
  await expect(page.getByTestId('detail-stock')).toContainText('2 units available');

  // Scenario 12: Cross-user purchase request access denial (Chipo R. is not seller of Tatenda's individual item)
  await signIn(page, 'chipo@wiseowl.test');
  await page.goto('/seller/dashboard');
  await expect(page.getByTestId('seller-request-row')).toHaveCount(0);
  await page.goto('/account');
  await expect(page.locator('.request-row')).toHaveCount(0);

  // Scenario 13: Seller Tatenda M. accepts & fulfills request -> atomic stock deduction 2 -> 0 -> Sold out!
  await signIn(page, 'tatenda@wiseowl.test');
  await page.goto('/seller/dashboard');
  const incomingRow = page.getByTestId('seller-request-row').filter({ hasText: 'Hardwood Study Desk Organiser' });
  await expect(incomingRow).toContainText('Farai B.');
  await incomingRow.getByRole('button', { name: 'Accept' }).click();
  await expect(incomingRow).toContainText('accepted');

  await incomingRow.getByRole('button', { name: 'Confirm Fulfilled' }).click();
  await expect(incomingRow).toContainText('fulfilled');

  // Verify product stock is now 0 and Sold out!
  await page.goto(`/product/${individualProductId}`);
  await expect(page.getByTestId('detail-stock')).toContainText('0 units available');
  await expect(page.locator('.detail-category .badge-cluster')).toContainText('sold out');

  // Buyer Farai B. sees fulfilled request and Sold out status
  await signIn(page, 'farai@wiseowl.test');
  await page.goto(`/product/${individualProductId}`);
  await expect(page.getByTestId('detail-stock')).toContainText('0 units available');
  await expect(page.locator('.detail-category .badge-cluster')).toContainText('sold out');
  await expect(page.getByText('All available units from this project batch have been fulfilled.')).toBeVisible();
});

test('Mobile audit: populated catalog, filters, product details, forms and dialogs fit touch viewports', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const assertFits = async (label: string) => {
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${label} has no horizontal overflow`).toBeLessThanOrEqual(dimensions.width + 1);
    const clippedFields = await page.locator('main input:not([type="file"]):not([type="hidden"]), main select, main textarea, dialog[open] input, dialog[open] select, dialog[open] textarea').evaluateAll((elements) => elements.flatMap((element) => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return [];
      return bounds.left < -1 || bounds.right > innerWidth + 1 ? [(element as HTMLInputElement).name || element.tagName] : [];
    }));
    expect(clippedFields, `${label} form controls fit screen`).toEqual([]);
  };
  try {
    for (const width of [360, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['/login', '/signup', '/forgot-password', '/seller/register']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await assertFits(`${route} at ${width}px`);
      }
    }

    await signIn(page, 'farai@wiseowl.test');
    for (const width of [360, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['/marketplace', `/product/${individualProductId}`, '/account', '/projects']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await assertFits(`${route} at ${width}px`);
      }
      if (width <= 390) {
        await page.goto('/marketplace');
        await expect(page.getByTestId('listing-card')).toHaveCount(3);
        await page.getByRole('button', { name: 'Filters', exact: true }).tap();
        await expect(page.getByLabel('Minimum price', { exact: true })).toBeVisible();
        await assertFits(`expanded filters at ${width}px`);
        await page.getByLabel('Minimum price', { exact: true }).fill('9');
        await page.getByLabel('Maximum price', { exact: true }).fill('10');
        await page.getByRole('button', { name: 'Apply filters' }).tap();
        await expect(page.getByTestId('listing-card')).toHaveCount(1);
        await expect(page.getByTestId('listing-card')).toContainText('Drip Irrigation Starter Kit');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `catalog-filtered-${width}.png`), fullPage: true });

        await page.goto(`/product/${individualProductId}`);
        await page.getByRole('button', { name: 'Report a concern with this listing' }).tap();
        await expect(page.getByRole('dialog')).toBeVisible();
        await assertFits(`report dialog at ${width}px`);
        await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `product-detail-${width}.png`), fullPage: true });
      }
    }

    await signIn(page, 'tatenda@wiseowl.test');
    for (const width of [360, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['/seller/dashboard', '/seller/products/new', `/seller/products/${individualProductId}/edit`, '/seller/group', '/seller/settings']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await assertFits(`${route} at ${width}px`);
      }
      await page.goto('/seller/products');
      const product = page.getByTestId('seller-product-row').filter({ hasText: 'Hardwood Study Desk Organiser' });
      await product.getByRole('button', { name: 'Update Stock' }).tap();
      await expect(page.getByRole('dialog')).toBeVisible();
      await assertFits(`stock dialog at ${width}px`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `stock-dialog-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Close dialog', exact: true }).tap();
    }

    await signIn(page, 'admin@wiseowl.test');
    for (const width of [360, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['/admin/users', '/admin/groups', '/admin/products', '/admin/requests', '/admin/reports']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await assertFits(`${route} at ${width}px`);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('OwlAid 4.0: navigation link, signed-out 401 guard, signed-in school facts, and mobile layout work end to end', async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/');

  // Shared navigation includes OwlAid link
  const navOwlAid = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'OwlAid' });
  await expect(navOwlAid).toBeVisible();
  await navOwlAid.click();
  await expect(page).toHaveURL(/\/owlaid$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('OwlAid');

  // Signed-out POST to /api/owlaid/chat returns 401 and UI surfaces sign-in notice
  const unauthRes = await page.request.post('/api/owlaid/chat', {
    data: { message: 'What is the school motto?', history: [] },
  });
  expect(unauthRes.status()).toBe(401);

  await page.getByRole('button', { name: 'School motto' }).click();
  await expect(page.getByRole('log')).toContainText('Sign in to your school account to use OwlAid.');

  // Sign in as approved learner and verify OwlAid local facts, unverified notices, and timetable refusal
  await signIn(page, 'farai@wiseowl.test');
  await page.goto('/owlaid');
  await page.getByRole('button', { name: 'School motto' }).click();
  await expect(page.getByRole('log')).toContainText('Going an Extra Mile');
  await expect(page.getByRole('log')).toContainText('School knowledge');

  await page.getByLabel('Ask OwlAid a question').fill('Who is the headmaster and what are the school hours?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('Mr. S. Dangah');
  await expect(page.getByRole('log')).toContainText('unverified');

  await page.getByLabel('Ask OwlAid a question').fill('When are the exam dates?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText("not in OwlAid's verified knowledge base yet");

  // Verify mobile layout at 360px, 390px, and 768px has zero horizontal overflow
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `/owlaid must not overflow horizontally at ${width}px`).toBe(false);
  }
});
