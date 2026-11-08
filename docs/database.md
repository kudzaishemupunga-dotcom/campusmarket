# Database Design

Apply migrations in lexical order to a Supabase project:

1. `supabase/migrations/202611080001_campusmarket.sql` — Core profiles, categories, listings, listing images, saved listings, reports, moderation audit events, rate limits, private `listing-images` bucket, and baseline RLS.
2. `supabase/migrations/202611080002_wise_owl_projects.sql` — CampusMarket 2.0 Wise Owl Student Project Marketplace schema: curriculum project categories, individual seller verification columns, shared `seller_groups` & `group_members` workspaces, project/stock/availability/admin-attribution columns on `listings`, primary image selection, `purchase_requests` with atomic stock fulfillment, and audited admin/group RPCs.

Neither migration creates fake users, demo groups, or invented product listings.

## Tables

| Table | Purpose & Key Constraints |
| --- | --- |
| `profiles` | One row per `auth.users` ID: `display_name`, `role` (`student` \| `admin`), `verification_status` (`pending` \| `approved` \| `rejected` \| `suspended`), `seller_type` (`none` \| `individual` \| `group`), `seller_approved` (`boolean`), and `project_summary`. |
| `categories` | Eight Heritage-Based Curriculum project categories (STEM/Robotics, Agriculture/Food, Design/Textiles, Woodwork/Metalwork/Craft, Visual Arts, Heritage/Natural Products, ICT/Print Media, Enterprise Prototypes). |
| `seller_groups` | Collaborative student project groups (`name`, unique `slug`, `project_description`, `learning_area`, `created_by`, `verification_status`). |
| `group_members` | Composite `(group_id, user_id)` membership with `member_role` (`owner` \| `member`), `can_manage_products` (`boolean`), `status` (`invited` \| `requested` \| `approved` \| `removed`), and `invited_by`. Non-self-approvable by join requesters. |
| `listings` | Real student/group project products: `seller_id`, optional `group_id`, `created_by_admin`, `title`, `description`, `price` (`numeric(10,2)`), `stock_quantity` (`integer >= 0`), `availability` (`available` \| `sold_out` \| `unavailable`), `project_name`, `materials`, `dimensions`, `production_method`, `learning_area`, `made_to_order`, `status`, and generated `search_document` GIN index. |
| `listing_images` | Up to 5 private WebP image references per product (`display_order` `0..4`, deferrable unique `(listing_id, display_order)` constraint so `display_order = 0` main cover photo can be swapped atomically). |
| `purchase_requests` | Supervised purchase coordination (`listing_id`, `buyer_id`, `seller_id`, `group_id`, `quantity` `1..1000`, `note`, `status` `pending` \| `accepted` \| `declined` \| `fulfilled` \| `cancelled`, `fulfilled_at`). |
| `saved_listings` | Composite `(user_id, listing_id)` shortlist. |
| `reports` | Community safety/moderation reports (`open` \| `resolved` \| `dismissed`); partial unique index limits one open report per reporter/product. |
| `moderation_events` | Immutable audit log of user approvals, seller access changes, group moderations, product reviews, verified admin product publications, and report resolutions. |
| `private.rate_limits` | Per-user fixed-window write quotas enforced inside PostgreSQL triggers and RPCs. |

## Key Security-Definer RPCs

| Function | Authorization & Behavior |
| --- | --- |
| `get_seller_names(ids uuid[])` | Approved members resolve `id` and `display_name` for visible sellers, group creators, group members, and shared purchase request participants—never exposing emails. |
| `find_school_members(search_term text)` | Approved members search approved school member display names for group invitations or catalog seller search. |
| `set_seller_access(target_id uuid, approved boolean)` | Approved admin grants or revokes `profiles.seller_approved` and logs to `moderation_events`. |
| `create_seller_group(...)`, `update_seller_group(...)` | Approved student creates a `pending` group (becoming `owner`) or updates group details (re-queuing `approved` groups to `pending` on substantive edits). |
| `invite_group_member(...)`, `request_group_membership(...)`, `respond_group_invite(...)`, `manage_group_member(...)` | Role-checked group collaboration workflow preventing self-approval of join requests while letting invited students accept invitations and owners/admins manage `can_manage_products`. |
| `moderate_group(target_id uuid, new_status text)` | Approved admin sets group status (`approved`, `rejected`, `removed`) and records audit event. |
| `set_primary_listing_image(target_listing_id uuid, target_image_id uuid)` | Authorized individual seller, permitted group collaborator, or admin swaps the chosen image into `display_order = 0`. |
| `submit_purchase_request(...)` | Approved buyer (blocked from requesting own/group products) creates a `pending` request after validating active product status, availability, and stock ceiling—without prematurely deducting stock. |
| `update_purchase_request_status(target_request_id uuid, new_status text)` | Buyer may `cancel`; seller, approved group member, or admin may `accept`, `decline`, or `fulfill`. On `fulfilled`, locks request and listing rows (`FOR UPDATE`), deducts `stock_quantity` atomically, blocks over-fulfillment, and marks `sold_out` at `0` stock. |
| `admin_create_product(...)` | Approved admin publishes a physically verified student or group project product directly as `active`, attributing `created_by_admin` and recording an immutable `moderation_events` entry. |
| `moderate_user(...)`, `moderate_listing(...)`, `resolve_report(...)` | Audited admin moderation of student accounts, product submissions, and safety reports. |

## Embedded PostgreSQL Security Suite

Run `pnpm test:db` (`node supabase/tests/run.mjs`) to execute all 24 SQL/RLS/trigger/concurrency security scenarios inside PGlite against the real migrations without requiring external cloud credentials.
