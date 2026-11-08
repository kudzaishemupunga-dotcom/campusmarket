# CampusMarket 2.0 — Wise Owl High School Westgate Student Project Marketplace

A school-specific digital marketplace where learners at **Wise Owl High School Westgate (Harare, Zimbabwe)** showcase and sell real goods produced through their **School-Based Projects** under Zimbabwe’s Heritage-Based Curriculum Framework (2024–2030). Prices are in USD. This repository is prepared for local evaluation and school review—**no public deployment is performed without explicit school authorization**.

> **Disclaimer:** CampusMarket is a student-created platform developed for Wise Owl High School Westgate learners to showcase real school-project products. Unless formally established otherwise by school administration, it is not an official commercial publication of Wise Owl Group of Schools.

## Core Principles

- **Zero Invented Products:** The runtime application and database migrations contain **zero** fake products, fictional sellers, fabricated counts, or illustrative listings. An empty catalog renders a purposeful zero-product empty state until real school-approved products are published.
- **Individual & Shared Group Seller Workspaces:** Students register as Individual Sellers or form collaborative Project Groups (`owner` / `member` roles with `can_manage_products` permissions) **without ever sharing passwords**.
- **Safe, Supervised Coordination:** Buyers submit structured Purchase Requests (`pending` → `accepted` / `declined` → `fulfilled` / `cancelled`). Stock is deducted atomically only upon confirmed fulfillment. No online payments are processed and no student phone numbers, emails, or home addresses are displayed publicly.
- **Strict Defense-in-Depth:** Next.js App Router + TypeScript + Zod validation + server-verified Supabase SSR sessions + PostgreSQL Row Level Security (RLS) + Sharp metadata-stripping private WebP image storage.

## Run Locally

Install Node.js 22+ and `pnpm`. From `campusmarket/`:

```sh
pnpm install
```

Copy `.env.example` to `.env.local`. Without Supabase credentials, public informational pages (`/`, `/about`, `/seller`, `/seller/register`, `/rules`, `/privacy`) and empty-state previews render cleanly with zero invented data, while account and database operations remain safely disabled until configured:

```sh
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

To connect a real development Supabase project, configure `.env.local`, apply both migrations in `supabase/migrations/` in lexical order, configure Auth redirect URLs, and bootstrap the first school administrator via privileged SQL. Follow [Supabase setup](docs/supabase-setup.md) and [Admin setup](docs/admin-setup.md).

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project HTTPS API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable/anon API key (all data access enforced by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key used strictly after ownership/group verification for private Storage writes |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical app origin (e.g. `http://127.0.0.1:3000` locally, HTTPS in production) |

Keep `.env.local` out of version control.

## Key Routes

| Route | Purpose |
| --- | --- |
| `/` | Wise Owl Westgate Student Project Marketplace homepage (Hero, Sections A–E) |
| `/marketplace`, `/category/[slug]` | Approved-member catalog with search, curriculum category, availability, price, and sort filters |
| `/projects`, `/projects/[slug]` | Verified collaborative student project groups and team rosters |
| `/product/[id]` | Product gallery, project craft/engineering specifications, and Safe Purchase Request panel |
| `/seller`, `/seller/register` | Dedicated Seller Portal overview and Individual / Group Seller registration |
| `/seller/dashboard`, `/seller/products` | Real database metrics, workspace switcher, product management, stock modal, and incoming requests |
| `/seller/products/new`, `/seller/products/[id]/edit` | Real product submission & editing (up to 5 photos, choose main photo, USD price, integer stock, project specs) |
| `/seller/group`, `/seller/settings` | Shared Project Group workspaces, invitations, join requests, and seller profile settings |
| `/account` | Buyer purchase requests, saved shortlist, and account settings |
| `/admin`, `/admin/users`, `/admin/groups`, `/admin/products`, `/admin/requests`, `/admin/reports` | School administration verification, group moderation, product review, verified manual product entry, purchase request oversight, and immutable audit log |

## Verification Commands

```sh
pnpm check       # TypeScript + ESLint + Vitest unit/authorization suite
pnpm test:db     # Embedded PostgreSQL (PGlite) migration, trigger, RPC & RLS security suite
pnpm build       # Production Next.js build
pnpm test:e2e    # Isolated PGlite + Chromium end-to-end browser suite (starts from 0 products)
```

See [testing](docs/testing.md), [architecture](docs/architecture.md), [database](docs/database.md), [security](docs/security.md), and [deployment preparation](docs/deployment.md).
