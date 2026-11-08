# Architecture

CampusMarket 2.0 is a single Next.js App Router application tailored for **Wise Owl High School Westgate** student projects. Server Components load authorized data via `@supabase/ssr`. Client Components handle interactive forms, workspace switching, photo staging, search/filter controls, and theme persistence. Server Actions (`src/app/actions.ts`) execute validated mutations, and Route Handlers (`src/app/auth/callback/route.ts`, `src/app/api/upload/route.ts`) handle PKCE/OTP callbacks and binary photograph ingestion.

## Trust Boundaries

1. **Input Validation:** Every Server Action and Route Handler validates user-controlled inputs with strict Zod schemas (`src/lib/validation.ts`), enforcing fixed-point USD prices, non-negative integer stock (`0..10000`), UUID checks, and contact-detail guards that reject embedded phone numbers or email addresses.
2. **Authoritative Server Identity:** `src/lib/server/auth.ts` verifies the Supabase Auth user (`auth.getUser()`) with a confirmed email and loads `role`, `verification_status`, `seller_type`, and `seller_approved` from `public.profiles`. User-editable Auth metadata never grants privileges.
3. **Database Enforcement (RLS & Triggers):** PostgreSQL Row Level Security, column grants, triggers, and `SECURITY DEFINER` RPCs independently enforce school membership, individual seller approval, shared project group permissions, product moderation transitions, and row-locked atomic stock updates.
4. **Verified Image Pipeline:** `/api/upload` verifies origin, rate limits, and individual or group product edit rights before decoding images via `sharp`, stripping EXIF/GPS metadata, bounding dimensions (`1600×1600`), and re-encoding to WebP inside the private `listing-images` bucket.
5. **Private Image Delivery:** Product photographs are never stored in a public bucket; authorized viewers receive short-lived signed URLs (`60s`).

## Runtime Modes (Zero Invented Data)

- **Connected Supabase Mode (`mode: 'supabase'`):** Active when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured. Public informational routes (`/`, `/about`, `/seller`, `/seller/register`, `/rules`, `/privacy`) are accessible to visitors without exposing student catalog records; approved Wise Owl members access `/marketplace`, `/projects`, `/product/[id]`, `/seller/*`, and `/account`.
- **Unconfigured Mode (`mode: 'unconfigured'`):** Active when Supabase environment variables are absent. Renders public informational pages and honest empty states with **zero** fictional products, sellers, or simulated mutations.

## Individual & Shared Group Workspaces

- **Individual Sellers:** Require `verification_status = 'approved'` and `seller_approved = true` (granted by a school administrator via `set_seller_access`).
- **Project Groups:** Students create a `seller_groups` record (`verification_status = 'pending'`), becoming the group `owner` in `group_members`. Once an administrator approves the group (`moderate_group`), the owner or an administrator can invite approved school members (`invite_group_member`) or approve join requests (`manage_group_member`) with granular `can_manage_products` rights—eliminating any need for shared passwords. Multiple group memberships per learner are supported.

## Product & Purchase Request Lifecycle

- New student/group submissions enter `draft` or `pending_review`. Substantive edits to an `active` product (title, description, price, category, project details, or photographs) automatically return the listing to `pending_review` for renewed school moderation. Stock-only or availability updates (`update_stock`) keep an approved product `active` while syncing `stock_quantity = 0` (when not `made_to_order`) to `availability = 'sold_out'`.
- Buyers submit supervised Purchase Requests (`submit_purchase_request`). Stock is **not** deducted when a request is `pending` or `accepted`. When the seller, authorized group member, or school administrator marks a request `fulfilled` (`update_purchase_request_status`), PostgreSQL locks the request and product rows (`FOR UPDATE`), verifies sufficient stock, deducts `stock_quantity` atomically, prevents negative stock or duplicate fulfillment, and sets `availability = 'sold_out'` when stock reaches zero.
