# CampusMarket

A school-exclusive second-hand marketplace for one secondary school in Zimbabwe. Prices are in USD. This is an implementation for local evaluation, **not an authorization for public launch**. No production deployment is performed.

The application uses Next.js App Router, React, strict TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/private Storage, Zod, Lucide, and Sonner. The local demo uses fictional names and products. Connected mode requires email verification and manual school approval before marketplace access.

## Run locally

Install Node.js 22 or newer and pnpm. From this directory:

```sh
pnpm install
```

Copy `.env.example` to `.env.local`, keeping `CAMPUSMARKET_DEMO=true` for the local demo, then run:

```sh
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Demo interactions are labeled simulations and stored only in the local browser. They create no real accounts and do not write to Supabase. Demo mode is disabled when `NODE_ENV=production`; an unconfigured production server does not expose a marketplace.

To connect a real development Supabase project, set `CAMPUSMARKET_DEMO=false`, configure the environment variables below, apply the SQL migration, configure email URLs, and bootstrap an administrator through privileged SQL. Follow [Supabase setup](docs/supabase-setup.md) and [admin setup](docs/admin-setup.md).

## Environment

| Variable | Purpose |
| --- | --- |
| `CAMPUSMARKET_DEMO` | Explicit local demo opt-in; ignored in production |
| `NEXT_PUBLIC_SUPABASE_URL` | Your project's HTTPS API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your project's publishable API key; authorization remains enforced by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key for verified image uploads; never share with clients |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical app origin for email callbacks and redirect safety |

No Supabase project, credentials, or email provider is included or invented. Keep `.env.local` out of version control.

## Application flows

- Browse, search, filter and sort approved listings; view image galleries and limited seller display names.
- Save listings, create and edit owned listings, submit for review, delete, and mark active listings sold.
- Register, verify email, log in, request password recovery, and await manual school approval.
- Manage personal listings, saved products, and display name.
- Administrators approve/reject/suspend users, moderate listings, review reports, and inspect audit events.
- School rules, privacy notice, and exchange procedure are explicitly awaiting school review.

There are no payments, direct messages, anonymous messaging, or displayed student contact details.

## Verification

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

See [testing](docs/testing.md) for test scopes, environment requirements, and recorded execution results. A successful demo test does not verify hosted Supabase RLS, email delivery, or Storage policies.

## Project map

| Path | Purpose |
| --- | --- |
| `src/app` | Server-rendered routing, server actions, callback and upload handlers |
| `src/components` | Marketplace, account, seller, and moderation interfaces |
| `src/lib/server` | Supabase SSR clients, authoritative access checks, and data queries |
| `src/lib/validation.ts` | Shared input validation |
| `src/lib/permissions.ts` | Pure permission helpers used by server checks and tests |
| `src/lib/demo.ts` | Fictional demonstration fixtures |
| `supabase/migrations` | Database schema, constraints, RLS, RPCs and private bucket policies |
| `tests` | Unit, integration and browser test suites |

Read [architecture](docs/architecture.md), [database](docs/database.md), [security](docs/security.md), and [deployment preparation](docs/deployment.md) before configuring a school environment.

## Before school launch

Configure and independently test Supabase, SMTP and email verification; run database integration tests using fictional accounts; approve the school rules/privacy notice and supervised exchange method; establish administrator ownership, incident response, retention, backups and abuse controls; complete school authorization and the launch checklist. Live integration and public-launch readiness must not be inferred from the local demo.
