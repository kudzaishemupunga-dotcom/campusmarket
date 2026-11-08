# Connect Your Own Supabase Project

Use a dedicated school-controlled development project while validating CampusMarket 2.0. No external cloud project or credentials have been pre-configured in this repository.

1. Create a Supabase project under Wise Owl High School Westgate’s approved account and region.
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only secret; never expose to clients)
   - `NEXT_PUBLIC_SITE_URL` (exact canonical origin, e.g. `http://127.0.0.1:3000` locally or HTTPS in production)
3. Apply **both** SQL migrations in `supabase/migrations/` in lexical order (`202611080001_campusmarket.sql`, then `202611080002_wise_owl_projects.sql`) via the Supabase SQL Editor or linked Supabase CLI.
4. Confirm the `listing-images` Storage bucket exists and remains **private**. Do not make it public or add permissive Storage policies.
5. In Supabase Auth, enable Email/Password authentication with **Confirm email** required, and configure custom school-approved SMTP.
6. Set the Auth **Site URL** to your exact canonical origin and add `<NEXT_PUBLIC_SITE_URL>/auth/callback` to **Redirect URLs**.
7. Register the designated school administrator through `/signup`, verify their email link, and run the privileged bootstrap SQL in [admin-setup.md](admin-setup.md).

## Verification Checklist

- An unauthenticated visitor can view `/`, `/about`, `/seller`, and `/seller/register`, sees **0 products** (`"No projects listed yet."`), and cannot read catalog rows or private photographs.
- A verified but unapproved student is routed to `/pending-approval` and cannot browse `/marketplace` or `/projects`.
- An approved Individual Seller or permitted Project Group collaborator can submit a product with up to 5 real photographs and choose the main cover photo.
- New and substantively edited products stay in `pending_review` until an approved administrator activates them on `/admin/products`.
- Buyer Purchase Requests do not deduct stock until confirmed `fulfilled`, at which point stock updates atomically and transitions `0` stock to `Sold out`.
