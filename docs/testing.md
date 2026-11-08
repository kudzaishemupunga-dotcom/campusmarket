# Testing

## Commands

```sh
pnpm check                 # TypeScript
pnpm lint                  # ESLint
pnpm test                  # Vitest unit tests and optional live integration tests
pnpm build                 # Next.js production compilation
pnpm exec playwright install chromium
pnpm test:e2e              # Playwright local development demo
```

Playwright starts a local development server with explicit demo mode. Set `PLAYWRIGHT_BASE_URL` only when a suitable demo server is already running. Tests use isolated browser contexts and fictional data. The tests must never target a school production environment.

## What the layers establish

- Unit tests validate inputs and pure authorization rules against malformed, unauthorized and boundary cases.
- Browser tests exercise rendered navigation, search/filter/sort, forms, saved items, seller/moderator flows, theme persistence and responsive layout.
- Live database tests require a configured Supabase development project. They establish RLS and database trigger behavior independently of UI guards. SQL tests are in `supabase/tests` when provided.
- A production build verifies compilation and route generation. It does not verify external Auth, email delivery, hosted database migrations, storage permissions or deployment readiness.

## Execution record

Validated locally on Windows (Node.js v24.22.1, pnpm 11.25.0):

- `pnpm typecheck` (`tsc --noEmit`): Passed (0 errors).
- `pnpm lint` (`eslint .`): Passed (0 errors, 0 warnings).
- `pnpm test` (`vitest run`): Passed (8 test files, 115 unit and authorization tests).
- `pnpm test:db` (`node supabase/tests/run.mjs`): Passed (20 embedded PostgreSQL / PGlite schema, trigger, RPC, rate-limit, and RLS scenarios).
- `pnpm build` (`next build`): Passed (production App Router compilation, static/dynamic route generation, and proxy bundle).
- `pnpm test:e2e` (`playwright test`): Passed (14 Chromium browser scenarios across 360px, 768px, 1366px, and 1920px viewports covering marketplace browse/search/filter/sort, saves, dark mode, seller pending-review lifecycle, admin user verification, report resolution, audit log, and 404 handling).

Live hosted Supabase verification (GoTrue SMTP delivery, hosted PostgREST, and cloud Storage HTTP endpoints) was **not executed** because no external Supabase project credentials are configured in this local environment.

## Manual acceptance before launch

Test actual email signup/confirmation/login/recovery/logout with fictional accounts. Verify pending/rejected/suspended states, direct admin requests as a student, cross-user edit/delete attempts, image signature spoofing and size/count limits, listing re-review, report resolution and audit entries. Recheck private Storage with anonymous and unapproved tokens. Test keyboard-only operation and a screen reader, real mobile devices, slow network failures and session expiry. Approve the school exchange process and policy placeholders before launch.
