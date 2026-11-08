# Testing — CampusMarket 2.0 (Wise Owl High School Westgate)

## Commands

```sh
pnpm check                 # TypeScript (tsc --noEmit) + ESLint + Vitest unit/authorization suite
pnpm typecheck             # TypeScript compiler check
pnpm lint                  # ESLint check
pnpm test                  # Vitest unit & authorization tests (8 files, 135 tests)
pnpm test:db               # Embedded PostgreSQL (PGlite) schema, trigger, RPC, rate-limit, and RLS suite (24 scenarios)
pnpm build                 # Next.js production compilation
pnpm exec playwright install chromium
pnpm test:e2e              # Playwright Chromium E2E suite against an isolated in-memory PGlite Supabase server
```

## Isolated Zero-Product E2E Architecture

Playwright (`pnpm test:e2e`) launches two isolated test processes:
1. **`tests/helpers/supabase-pglite-server.mjs`** (`http://127.0.0.1:54329`) — an in-memory `@electric-sql/pglite` PostgreSQL server that executes `supabase/tests/bootstrap.sql`, `202611080001_campusmarket.sql`, and `202611080002_wise_owl_projects.sql` from scratch, booting with **0 users, 0 project groups, and 0 products**.
2. **`next dev`** (`http://127.0.0.1:3105`, using isolated build output `test-results/.next-e2e`) connected to the local PGlite server.

This guarantees:
- The live application codebase contains **zero demo fixtures, zero fictional products, and zero `localStorage` fallbacks**.
- E2E tests verify the real initial zero-product empty states first, and then test real account creation, email confirmation, admin seller approval, group creation, collaborator invitation, real WebP photo upload via `sharp`, primary image reordering, admin product moderation, manual verified product entry, stock updates, safe purchase requests, and atomic stock deduction on fulfillment.

## What Each Layer Establishes

- **Unit & Authorization Tests (`tests/unit/*.test.ts` — 135 tests)**:
  - `config.test.ts`: Environment validation and automated repository scan asserting `src/lib/demo.ts`, `public/products/*.svg`, `scripts/generate-demo-art.mjs`, and `CAMPUSMARKET_DEMO` do not exist anywhere in the codebase.
  - `permissions.test.ts`: Individual seller, project group owner/collaborator/viewer, buyer, and administrator authorization rules.
  - `validation.test.ts`: Zod schemas, contact-detail blocking (email/phone regex), USD pricing (`$0.50`–`$5,000.00`), stock quantities (`0`–`10,000`), and magic-byte image header validation (JPEG, PNG, non-animated WebP; SVG rejected).
  - `server-auth.test.ts`, `auth-callback.test.ts`, `server-routing.test.ts`: Session boundaries, unverified/pending/suspended redirects, open-redirect protection, and legacy `/listing/*` compatibility redirects.
  - `actions.test.ts` & `upload-route.test.ts`: Server Actions and `/api/upload` route handlers (`POST` & `DELETE`) across individual sellers, group collaborators, buyers, and administrators.
- **Database & RLS Integration Suite (`supabase/tests/run.mjs` — 24 scenarios)**:
  - Exercises real PostgreSQL triggers, column grants, `SECURITY DEFINER` RPCs, rate limits, storage policies, collaborative seller groups, and atomic purchase request fulfillment inside `@electric-sql/pglite`.
- **Playwright Browser E2E Suite (`tests/e2e/marketplace.spec.ts` — 7 serial test blocks covering 15 scenarios)**:
  - Exercises all 15 required user journeys and responsive viewports (`360px`, `768px`, `1366px`, `1920px`, plus light and dark themes) in headless Chromium.

## Execution Record

Validated locally on Windows (Node.js v24.22.1, pnpm 11.25.0):

- `pnpm typecheck` (`tsc --noEmit`): **Passed** (0 errors).
- `pnpm lint` (`eslint .`): **Passed** (0 errors, 0 warnings).
- `pnpm test` (`vitest run`): **Passed** (8 test files, 135/135 unit and authorization tests).
- `pnpm test:db` (`node supabase/tests/run.mjs`): **Passed** (24/24 embedded PostgreSQL / PGlite schema, trigger, RPC, rate-limit, and RLS scenarios).
- `pnpm build` (`next build`): **Passed** (Next.js 16.4.5 production compilation and proxy bundle).
- `pnpm test:e2e` (`playwright test`): **Passed** (7/7 serial Chromium test blocks covering all 15 required CampusMarket 2.0 scenarios and `360px` / `768px` / `1366px` / `1920px` responsive checks).

Live hosted Supabase cloud verification (GoTrue SMTP delivery, hosted PostgREST, and cloud Storage buckets) requires connecting a real Wise Owl High School Westgate Supabase project in `.env.local`.
