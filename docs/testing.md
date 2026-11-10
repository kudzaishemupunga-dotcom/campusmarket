# Testing — CampusMarket 2.0 (Wise Owl High School Westgate)

## Commands

```sh
pnpm check                 # TypeScript (tsc --noEmit) + ESLint + Vitest unit/authorization suite
pnpm typecheck             # TypeScript compiler check
pnpm lint                  # ESLint check
pnpm test                  # Vitest unit & authorization tests
pnpm test:db               # Embedded PostgreSQL (PGlite) schema, trigger, RPC, rate-limit, and RLS suite
pnpm build                 # Next.js production compilation
pnpm exec playwright install chromium
pnpm test:e2e              # Playwright Chromium E2E suite against an isolated in-memory PGlite Supabase server
```

## Isolated Zero-Product E2E Architecture

Playwright (`pnpm test:e2e`) launches two isolated test processes:
1. **`tests/helpers/supabase-pglite-server.mjs`** (`http://127.0.0.1:54329`) — an in-memory `@electric-sql/pglite` PostgreSQL server that executes `supabase/tests/bootstrap.sql` and every migration in `supabase/migrations` in lexical order from scratch, booting with **0 users, 0 project groups, and 0 products**.
2. **`next dev`** (`http://127.0.0.1:3105`, using isolated build output `test-results/.next-e2e`) connected to the local PGlite server.

The application receives explicit fake test keys and the harness's loopback URL through its process environment. These overrides take precedence over local environment-file values. The suite rejects any `PLAYWRIGHT_BASE_URL` override and refuses to reuse existing servers, so it cannot be pointed at a live app. `PLAYWRIGHT_PORT` and `PGLITE_SUPABASE_PORT` may select unused local ports; they must be distinct integers from 1024 through 65535. Tests create data only inside their disposable test process, and never seed a real marketplace.

This setup checks:
- The live application codebase contains **zero demo fixtures, zero fictional products, and zero `localStorage` fallbacks**.
- E2E tests verify the real initial zero-product empty states first, and then test real account creation, email confirmation, admin seller approval, group creation, collaborator invitation, real WebP photo upload via `sharp`, primary image reordering, admin product moderation, manual verified product entry, stock updates, safe purchase requests, and atomic stock deduction on fulfillment.

## What Each Layer Establishes

- **Unit & Authorization Tests (`tests/unit/*.test.ts`)**:
  - `config.test.ts` & `network-config.test.ts`: Environment validation, `CAMPUSMARKET_DEV_ORIGINS` origin parsing, Content Security Policy generation, and automated repository scan asserting `src/lib/demo.ts`, `public/products/*.svg`, `scripts/generate-demo-art.mjs`, and `CAMPUSMARKET_DEMO` do not exist anywhere in the codebase.
  - `permissions.test.ts`: Strict boolean seller/collaborator verification (`seller_approved === true`, `can_manage_products === true`), project group owner/collaborator/viewer, buyer, and administrator authorization rules.
  - `validation.test.ts`: Zod schemas, strict boolean form parsing (`booleanFieldSchema`), contact-detail blocking (email/phone regex), USD pricing (`$0.50`–`$5,000.00`), stock quantities (`0`–`10,000`), and magic-byte image header validation (JPEG, PNG, non-animated WebP; SVG rejected).
  - `server-auth.test.ts`, `auth-callback.test.ts`, `server-routing.test.ts`, `data-failures.test.ts`: Session boundaries, unverified/pending/suspended redirects, open-redirect protection, legacy `/listing/*` compatibility redirects, and explicit database query failure propagation.
  - `actions.test.ts` & `upload-route.test.ts`: Server Actions, exact database error allowlist (`publicDatabaseErrors`), and `/api/upload` route handlers (`POST`, `PATCH`, and `DELETE`) with body size limits across individual sellers, group collaborators, buyers, and administrators.
- **Database & RLS Integration Suite (`supabase/tests/run.mjs` & `supabase/tests/security-regressions.mjs`)**:
  - Exercises real PostgreSQL triggers, column grants, `SECURITY DEFINER` RPCs, rate limits, storage policies, collaborative seller groups, and atomic purchase request fulfillment inside `@electric-sql/pglite`, including migration `202611090003_authorization_boundaries.sql` security regression audits.
- **Playwright Browser E2E Suite (`tests/e2e/marketplace.spec.ts` — 8 serial blocks)**:
  - Exercises the 15 user journeys and responsive viewports (`360px`, `390px`, `768px`, `1366px`, `1920px`, plus light and dark themes) in headless Chromium.
  - Adds touch-enabled mobile checks of populated catalog filters, product/report dialogs, seller forms/stock dialogs, account pages and administrator queues. See [mobile testing](mobile-testing.md).

## Current audit — 9 November 2026

Validated locally on Windows (Node.js v24.22.1, pnpm 11.25.0):

- `pnpm typecheck` (`tsc --noEmit`): **Passed** (0 errors).
- `pnpm lint` (`eslint .`): **Passed** (0 errors, 0 warnings).
- `pnpm test` (`vitest run`): **Passed** (10 test files, 188/188 unit and authorization tests).
- `pnpm test:db` (`node supabase/tests/run.mjs`): **Passed** (24/24 embedded PostgreSQL / PGlite schema, trigger, RPC, rate-limit, and RLS scenarios + 14/14 migration 003 security regression audit scenarios).
- `pnpm build` (`next build`): **Passed** (Next.js 16.4.5 production compilation and proxy bundle).
- `pnpm test:e2e` (`playwright test`): **Passed** (8/8 serial Chromium test blocks covering all 15 CampusMarket 2.0/3.0 scenarios plus the touch-enabled mobile audit at `360px`, `390px`, `768px`, `1366px`, and `1920px`).

The E2E helper emulates selected Supabase Auth/REST/Storage HTTP behavior and runs the real SQL migrations (`001`, `002`, and `003`) against PGlite. It has test-only email-confirmation and administrator-promotion shortcuts; it does not prove GoTrue PKCE/email delivery, PostgREST compatibility or cloud Storage behavior. Production compilation, browser flows and SQL authorization tests are separate checks. Live hosted Supabase cloud verification requires applying `supabase/migrations/202611090003_authorization_boundaries.sql` to the Wise Owl High School Westgate Supabase project when authorized.
