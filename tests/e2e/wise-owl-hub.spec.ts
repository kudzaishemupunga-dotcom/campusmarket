import path from 'node:path';
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

test('Wise Owl Hub 5.0: Student Dashboard, OwlAid IGCSE Study Mode, Scored Quizzes & Spaced Flashcards persist end to end', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });

  // 1. Register and approve a dedicated Wise Owl Hub learner + admin helper if needed
  await page.context().clearCookies();
  await page.goto('/signup');
  await page.getByLabel('Display name').fill('Hub Admin');
  await page.getByLabel('Email address').fill('hubadmin@wiseowl.test');
  await page.getByLabel('Password').fill('wiseowl-test-password-123');
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: /Create member account/i }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await testAdminAction({ action: 'promote_school_admin', email: 'hubadmin@wiseowl.test' });

  await page.context().clearCookies();
  await page.goto('/signup');
  await page.getByLabel('Display name').fill('Nyasha T.');
  await page.getByLabel('Email address').fill('hublearner@wiseowl.test');
  await page.getByLabel('Password').fill('wiseowl-test-password-123');
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: /Create member account/i }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await testAdminAction({ action: 'confirm_email', email: 'hublearner@wiseowl.test' });

  // Approve Nyasha T. as school member
  await signIn(page, 'hubadmin@wiseowl.test');
  await page.goto('/admin/users');
  const learnerRow = page.getByTestId('admin-user-row').filter({ hasText: 'Nyasha T.' });
  await learnerRow.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(learnerRow).toContainText(/approved/i);

  // 2. Sign in as approved learner and inspect unified Student Dashboard (/hub)
  await signIn(page, 'hublearner@wiseowl.test');
  await page.goto('/hub');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back, Nyasha T');
  await expect(page.getByTestId('hub-metrics')).toBeVisible();
  await expect(page.getByTestId('subject-card-biology')).toBeVisible();
  await expect(page.getByTestId('subject-card-biology')).toContainText('Not started');
  await expect(page.getByTestId('subject-card-mathematics')).toBeVisible();

  // Verify simplified navigation exposes Hub, Study menu (OwlAid, Quizzes, Flashcards), Marketplace, Projects, and Account menu
  const mainNav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(mainNav.getByRole('link', { name: 'Hub' })).toBeVisible();
  await expect(mainNav.getByRole('link', { name: 'Marketplace' })).toBeVisible();
  await expect(mainNav.getByRole('link', { name: 'Projects' })).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitem', { name: /Seller Portal/i })).toBeVisible();
  await page.keyboard.press('Escape');

  await mainNav.getByRole('button', { name: 'Study' }).click();
  await expect(mainNav.getByRole('menuitem', { name: /OwlAid/i })).toBeVisible();
  await expect(mainNav.getByRole('menuitem', { name: /Quizzes/i })).toBeVisible();
  await expect(mainNav.getByRole('menuitem', { name: /Flashcards/i })).toBeVisible();

  // 3. OwlAid IGCSE Study Mode works end-to-end
  await mainNav.getByRole('menuitem', { name: /OwlAid/i }).click();
  await expect(page).toHaveURL(/\/owlaid$/);
  await page.getByTestId('owlaid-mode-igcse').click();
  await expect(page.getByTestId('igcse-study-controls')).toBeVisible();
  await page.getByLabel('IGCSE Subject').selectOption('biology');
  await page.getByLabel('Coaching Style').selectOption('mark-scheme');
  await page.getByLabel('Ask OwlAid a question').fill('Explain osmosis and water potential in plant cells');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('IGCSE 0610');
  await expect(page.getByRole('log')).toContainText(/water potential/i);

  // 4. Interactive Subject Quiz with real server-authoritative scoring & cloud persistence
  await mainNav.getByRole('button', { name: 'Study' }).click();
  await mainNav.getByRole('menuitem', { name: /Quizzes/i }).click();
  await expect(page).toHaveURL(/\/quizzes$/);
  await page.getByTestId('quiz-subject-biology').click();
  await page.getByTestId('start-quiz-button').click();
  await expect(page.getByTestId('quiz-runner')).toBeVisible();

  // Answer all 5 questions in Biology sprint (check instant feedback on Q1, answer remaining)
  for (let i = 0; i < 5; i += 1) {
    await page.getByTestId('quiz-option-2').click();
    if (i === 0) {
      await page.getByTestId('check-answer-button').click();
      await expect(page.getByTestId('quiz-instant-feedback')).toBeVisible();
    }
    if (i < 4) {
      await page.getByTestId('next-question-button').click();
    } else {
      await page.getByTestId('finish-quiz-button').click();
    }
  }

  await expect(page.getByTestId('quiz-results')).toBeVisible();
  await expect(page.getByTestId('quiz-score-heading')).toContainText('/ 5');
  await expect(page.getByTestId('quiz-grade-band')).toBeVisible();
  await expect(page.getByText('Verified & saved to your Wise Owl cloud record')).toBeVisible();

  // Confirm score persists to Student Dashboard across reload!
  await page.goto('/hub');
  await expect(page.getByTestId('hub-metrics')).toContainText('1 scored attempt');
  await expect(page.getByTestId('subject-card-biology')).toContainText('Quiz avg');

  // Verify authenticated client cannot forge quiz scores or spaced-repetition schedules via API
  const forgedQuiz = await page.request.post('/api/study/quizzes/attempts', {
    data: {
      subjectId: 'biology',
      tier: 'all',
      mode: 'practice',
      durationSeconds: 10,
      score: 100,
      grade_band: 'A*',
      answers: [{ questionId: 'bio-01', selectedIndex: 2 }],
    },
  });
  expect(forgedQuiz.status()).toBe(400);

  const forgedReview = await page.request.post('/api/study/flashcards/review', {
    data: {
      cardKey: 'curated:fc-bio-1',
      subjectId: 'biology',
      rating: 'good',
      box: 5,
      interval_days: 365,
    },
  });
  expect(forgedReview.status()).toBe(400);

  // 5. Interactive Flashcards with spaced-repetition rating & custom card creation
  await page.goto('/flashcards?subject=biology');
  await expect(page.getByTestId('active-flashcard')).toBeVisible();
  const initialFront = await page.getByTestId('flashcard-front').textContent();
  await page.getByTestId('flip-card-button').click();
  await expect(page.getByTestId('flashcard-back')).toBeVisible();
  await page.getByTestId('rate-good').click();
  // Should advance to the next card
  await expect(page.getByTestId('flashcard-front')).not.toHaveText(initialFront ?? '');

  // Confirm spaced-repetition review persisted to hardened DB across reload (due count for Biology dropped from 8 -> 7)
  await page.reload();
  await expect(page.getByTestId('flashcard-subject-biology')).toContainText('7 due');

  // Create a custom flashcard and verify cloud persistence across page reload
  await page.getByTestId('open-create-card-button').click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByLabel('Topic').fill('Photosynthesis Formula');
  await dialog.getByLabel('Front (Question or Term)').fill('What are the two raw materials of photosynthesis?');
  await dialog.getByLabel('Back (Exam-Ready Answer)').fill('Carbon dioxide and water in the presence of light and chlorophyll.');
  await dialog.getByRole('button', { name: 'Save Flashcard' }).click();
  await expect(page.getByTestId('custom-flashcards-list')).toContainText('Photosynthesis Formula');

  await page.reload();
  await expect(page.getByTestId('custom-flashcards-list')).toContainText('Photosynthesis Formula');

  // Delete custom flashcard cleanly
  await page.getByRole('button', { name: 'Delete custom flashcard Photosynthesis Formula' }).click();
  await expect(page.getByTestId('custom-flashcards-list')).toHaveCount(0);
});

test('Wise Owl Hub 5.0: Responsive layout (360, 390, 768, 1366, 1920) and dark mode work cleanly across all new routes', async ({
  page,
}) => {
  await signIn(page, 'hublearner@wiseowl.test');

  const routes = ['/hub', '/owlaid?mode=igcse', '/quizzes', '/flashcards'];
  for (const width of [360, 390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${route} must not overflow horizontally at ${width}px`).toBe(false);
    }
  }

  // Verify dark mode toggle persists across /hub -> /owlaid -> /quizzes -> /flashcards
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/hub');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const route of ['/owlaid', '/quizzes', '/flashcards']) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('Wise Owl High School Westgate official logo, favicon assets, and browser tab title render cleanly across major pages', async ({
  page,
}) => {
  await signIn(page, 'hublearner@wiseowl.test');
  await page.setViewportSize({ width: 1366, height: 900 });

  // 1. Verify browser tab title and favicon <link> tags + HTTP 200 responses
  const exactTitleRoutes = ['/', '/hub', '/marketplace', '/about', '/rules'];
  for (const route of exactTitleRoutes) {
    await page.goto(route);
    await expect(page).toHaveTitle('Wise Owl Hub | Wise Owl Westgate');
  }

  for (const route of ['/owlaid', '/quizzes', '/flashcards']) {
    await page.goto(route);
    await expect(page).toHaveTitle(/Wise Owl Hub \| Wise Owl Westgate$/);
  }

  await page.goto('/hub');
  const iconLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')).map((el) => ({
      rel: el.rel,
      href: el.getAttribute('href') || '',
      type: el.type || '',
      sizes: el.getAttribute('sizes') || '',
    }))
  );

  expect(iconLinks.some((l) => l.rel === 'icon' && l.href.includes('/favicon.ico'))).toBe(true);
  expect(iconLinks.some((l) => l.rel === 'icon' && l.href.includes('/icon.png'))).toBe(true);
  expect(iconLinks.some((l) => l.rel === 'apple-touch-icon' && l.href.includes('/apple-icon.png'))).toBe(true);

  for (const link of iconLinks) {
    const res = await page.request.get(link.href);
    expect(res.status(), `Favicon asset ${link.href} must return HTTP 200`).toBe(200);
    const contentType = res.headers()['content-type'] || '';
    expect(contentType, `Favicon asset ${link.href} must be an image`).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon|png)/);
    const body = await res.body();
    expect(body.length, `Favicon asset ${link.href} must be non-empty`).toBeGreaterThan(500);
  }

  // 2. Verify official Wise Owl logo loads with valid aspect ratio across all key routes
  const assertLogosHealthy = async (routeLabel: string, minVisibleCount: number) => {
    const logos = page.locator('img[alt="Wise Owl High School Westgate logo"]');
    const count = await logos.count();
    expect(count, `${routeLabel} should render at least ${minVisibleCount} official logos`).toBeGreaterThanOrEqual(
      minVisibleCount
    );
    const stats = await logos.evaluateAll((imgs) =>
      imgs.map((el) => {
        const img = el as HTMLImageElement;
        const rect = img.getBoundingClientRect();
        return {
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          width: rect.width,
          height: rect.height,
        };
      })
    );
    for (const s of stats) {
      expect(s.complete && s.naturalWidth > 0 && s.naturalHeight > 0, `${routeLabel} logo must load`).toBe(true);
      if (s.width > 0 && s.height > 0) {
        const naturalRatio = s.naturalWidth / s.naturalHeight;
        const renderedRatio = s.width / s.height;
        expect(
          Math.abs(renderedRatio - naturalRatio) / naturalRatio,
          `${routeLabel} logo aspect ratio must not be distorted`
        ).toBeLessThan(0.05);
      }
    }
  };

  const afterDir = path.join(SCREENSHOT_DIR, 'after');
  for (const [route, name, minLogos] of [
    ['/', 'home', 3],
    ['/hub', 'hub', 2],
    ['/owlaid', 'owlaid', 2],
    ['/quizzes', 'quizzes', 2],
    ['/flashcards', 'flashcards', 2],
    ['/marketplace', 'marketplace', 2],
    ['/about', 'about', 2],
  ] as const) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await assertLogosHealthy(route, minLogos);
    await page.screenshot({ path: path.join(afterDir, `${name}-desktop.png`), fullPage: false });
  }

  // 3. Check signed-out Auth pages (/login, /signup) branding & title
  await page.context().clearCookies();
  for (const route of ['/login', '/signup']) {
    await page.goto(route);
    await expect(page).toHaveTitle('Wise Owl Hub | Wise Owl Westgate');
    await page.waitForLoadState('networkidle');
    await assertLogosHealthy(route, 4); // header + auth story + auth form + footer
  }
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(afterDir, 'login-desktop.png'), fullPage: false });

  // 4. Mobile 360px AFTER snapshots for all 6 key pages + dark mode
  await signIn(page, 'hublearner@wiseowl.test');
  await page.setViewportSize({ width: 360, height: 800 });
  for (const [route, name] of [
    ['/', 'home'],
    ['/hub', 'hub'],
    ['/owlaid', 'owlaid'],
    ['/quizzes', 'quizzes'],
    ['/flashcards', 'flashcards'],
    ['/marketplace', 'marketplace'],
  ] as const) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${route} must not overflow at 360px`).toBe(false);
    await page.screenshot({ path: path.join(afterDir, `${name}-mobile.png`), fullPage: false });
  }

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/hub');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(afterDir, 'hub-desktop-dark.png'), fullPage: false });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
});
