# Security Model & School Safety Controls

## Enforced Access & Ownership Boundaries

1. **Approved School Membership Gate:** Catalog browsing (`/marketplace`, `/category/[slug]`, `/projects`, `/product/[id]`) and all authenticated mutations require both a confirmed Supabase Auth email (`email_confirmed_at IS NOT NULL`) and `profiles.verification_status = 'approved'`. Pending, rejected, and suspended accounts are isolated at both the Next.js server layer and PostgreSQL RLS.
2. **Seller & Group Authorization:**
   - Independent product creation requires `profiles.seller_approved = true` (granted only by an administrator).
   - Group product creation/editing requires `seller_groups.verification_status = 'approved'` and an `approved` membership row in `group_members` with `can_manage_products = true`.
   - Students requesting to join a group (`status = 'requested'`) **cannot** approve their own membership (`manage_group_member` restricts approval to the group `owner` or an approved school `admin`).
   - Users never share passwords to manage a group workspace; every collaborator authenticates with their own individual account.
3. **Mandatory Moderation & Re-Review:**
   - Student and group product submissions enter `draft` or `pending_review`; only an approved administrator (`moderate_listing` or `admin_create_product`) can publish a listing as `active`.
   - Substantive edits to an `active` product (title, description, price, category, project details, or photographs) automatically transition `status` back to `pending_review` via PostgreSQL trigger.
4. **Purchase Request Isolation & Atomic Stock Integrity:**
   - RLS restricts `purchase_requests` reads to the `buyer_id`, the product's `seller_id`, `approved` members of the product's `group_id`, and approved administrators. Unrelated students cannot view or mutate another learner's purchase requests.
   - Stock quantities are deducted inside a single `FOR UPDATE` row-locked database transaction only when a request transitions to `fulfilled`, preventing negative inventory and duplicate fulfillment.

## Student Privacy & Content Safety

- **Zero Exposed Contact Details:** Student email addresses, phone numbers, home addresses, and private schedules are never stored in public profile columns or rendered in the UI. Input validation (`src/lib/validation.ts`) actively blocks email addresses and phone numbers inside display names, project summaries, group descriptions, product listings, and purchase request notes.
- **No Online Payments:** CampusMarket coordinates supervised campus handovers only; no card numbers, mobile-money credentials, or payment gateways exist in the platform.
- **Honest School Branding:** Uses verified Wise Owl institutional colors without scraping unauthorized assets or claiming official school commercial endorsement, accompanied by a visible student-created platform disclaimer.

## Photograph Upload Security

- Maximum 5 photographs per product, max 5 MB per file, restricted to genuine `JPEG`, `PNG`, and `WebP` magic-byte signatures.
- Server-side `sharp` pipeline rejects corrupt/oversized pixel dimensions (`limitInputPixels: 20_000_000`), strips EXIF/GPS camera metadata, resizes within `1600×1600`, and re-encodes to `image/webp`.
- Stored in the private `listing-images` bucket under `<uploader_uuid>/<listing_uuid>/<random_uuid>.webp`. Direct client uploads to Storage are blocked by restrictive RLS policies; viewing uses short-lived (`60s`) signed URLs.

## Required Pre-Launch Review

Before any real school rollout at Wise Owl High School Westgate:
- Obtain formal written approval from Wise Owl High School Westgate administration for the platform rules, privacy notice, and supervised campus handover procedure.
- Configure school-controlled Supabase project, custom SMTP, Auth rate limits/CAPTCHA, HTTPS canonical domain, backups, and administrator key rotation.
- Re-run live hosted RLS and Storage checks against the staging Supabase project using non-personal test accounts.
