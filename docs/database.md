# Database design

Apply `supabase/migrations/202611080001_campusmarket.sql` to a new Supabase project. It creates the schema, constraints, indexes, signup trigger, RLS policies, private image bucket, server-checked moderation functions and initial category records in one transaction. It does not create accounts or seed real student information. UUIDs identify records; USD values use PostgreSQL `numeric(10,2)`.

## Tables

| Table | Purpose and constraints |
| --- | --- |
| `profiles` | One row per `auth.users` ID; display name, optional avatar path, trusted role and school-verification state. Email, password and other private authentication details remain in Supabase Auth. |
| `categories` | Eight fixed UUID categories with unique name, slug and display order. |
| `listings` | Owner, validated product details, decimal price, category, condition, status and timestamps. Indexed by status/date, category/status/price, owner/status, and a generated full-text GIN search document. |
| `listing_images` | Private storage path and position. Positions 0–4 and a unique listing/position constraint enforce five images, including concurrent requests. Paths are unique and must refer to an existing verified upload within the owner's listing folder. |
| `saved_listings` | Composite user/listing primary key prevents duplicate saves. |
| `reports` | Reporter, listing, constrained reason, details, resolution state and timestamps. Only one open report per reporter/listing. |
| `moderation_events` | Append-only application audit history; no authenticated insert/update/delete privilege. RPCs record actor, target, transition and time in the same transaction. Deleted actors become null without erasing the event. |
| `private.rate_limits` | Atomic per-user counters; no direct client access. Old counters for the active user are removed during consumption. |

Foreign keys cascade owned listings, image metadata, saves and reports when their parent is deleted. Storage objects do not cascade with SQL metadata: run a privileged orphan cleanup after verifying no `listing_images.storage_path` references the object. Never delete storage by an unvalidated client-supplied path. Orphan objects remain inaccessible because reads require linked metadata.

## Listing lifecycle

- Approved members create `draft` or `pending_review` records only.
- Owners may move drafts and review submissions between `draft` and `pending_review`.
- Only an approved administrator can approve `pending_review → active` through `moderate_listing`.
- Substantive edits to active listings change their state to `pending_review`, or preserve an explicitly requested `draft` while uploads are staged. Students cannot keep changed content active.
- Changing images on an active listing sends it back to review. Reordering is intentionally not exposed; the v1 uploader appends images to available positions.
- Owners may mark `active → sold` or withdraw `active → draft`. Sold and removed listings cannot be edited or restored by their owners.
- Administrators may remove draft, pending, active or sold listings. Rejection is represented by `removed`; removed listings cannot be restored through the MVP. Owners may permanently delete owned listings, including removed/sold records.
- Admins cannot edit another owner's product details. Their RPCs only apply the documented status transitions.

## Access model

Every application table enables RLS. Anonymous requests have no table access. A member must have both a verified email in Auth and an `approved` profile to read marketplace data or make marketplace mutations. Pending, rejected and suspended accounts cannot read listings, categories or image objects. Pending users may read their own profile to see their approval state and edit their own display name.

Approved members see active/sold listings from approved sellers, plus their own unpublished listings. Approved admins see all listings for moderation. Suspending a seller hides their inventory from other members immediately at the next authorized read. Profiles are readable only by their owner or approved admins. `get_seller_names(uuid[])` returns **only ID and display name** when the caller can read a listing from that seller.

Profile column grants permit only `display_name` updates. Triggers additionally guard identity, role, verification and avatar fields. Signup always stores `student`/`pending` regardless of user-provided metadata. Use the privileged bootstrap instructions in `admin-setup.md`; there is no public role-assignment RPC.

All helper and moderation functions have fixed empty search paths and schema-qualified relations. Security-definer functions explicitly validate the caller. Anonymous execution is revoked. SQL-owner maintenance and the server's storage service key remain privileged and must not be exposed to browsers.

## RPC contract

| Function | Behavior |
| --- | --- |
| `get_seller_names(ids uuid[])` | Approved viewer lookup of visible seller IDs and names only. |
| `moderate_user(target_id uuid, new_status text)` | Approved admin changes a student's state to `approved`, `rejected` or `suspended`; requires verified email before approval and forbids self/admin-target moderation. |
| `moderate_listing(target_id uuid, new_status text)` | Approved admin applies `active` or `removed` under the lifecycle rules. |
| `resolve_report(target_id uuid, new_status text)` | Approved admin resolves/dismisses an open report and records audit history. |
| `consume_rate_limit(action_key text, max_requests integer, window_seconds integer)` | Returns boolean using a fixed 60-second bucket and hardcoded limits. Caller-supplied limits can tighten the cap; changing the window cannot create extra buckets. |

Limits per member per minute: listing writes 20, saved changes 60, reports 5, profile updates 10, moderation 30, uploads 15. Table triggers enforce mutation quotas even for direct REST requests. The upload endpoint consumes the upload quota before writing an object; adding metadata also consumes it. These limits complement Auth's email/login protections and host-level limits, rather than replacing them. Failed transactions roll back counters; sustained rejected-request abuse must be limited at the host/Auth layer.

## Storage

The `listing-images` bucket is private, limited to 5 MB and JPEG/PNG/WebP MIME types. Authenticated clients cannot insert/update/delete objects directly, even if a pre-existing broad permissive policy applies to other buckets: restrictive bucket-boundary policies close that route. The server validates actual bytes and re-encodes images before a privileged storage upload. Metadata insertion verifies owner, listing, path and existing object. Signed read URLs should be short lived; already-issued URLs may continue working until expiry after a suspension or moderation change. A URL is a bearer capability and must not be logged or shared.

## Executed database tests

Run `pnpm test:db` (or `node supabase/tests/run.mjs`). It applies the actual migration to PGlite's embedded PostgreSQL engine, using test-only minimal `auth` and `storage` schemas from `supabase/tests/bootstrap.sql`. Tests set database roles and authenticated subjects and execute real RLS, privilege, constraint, trigger and RPC behavior. No credentials or Docker daemon are required.

These tests are not a hosted Supabase integration: they do not exercise GoTrue emails, PKCE delivery, PostgREST schema discovery, Storage HTTP/signing or cloud configuration. Complete those checks against a private staging project before school launch. The bootstrap fixture is never a production migration.
