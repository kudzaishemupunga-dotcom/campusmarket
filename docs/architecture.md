# Architecture

CampusMarket is a single Next.js App Router application. Server rendering supplies authorized page data. Client components handle forms, search/filter controls, galleries, theme persistence and the explicitly simulated development experience. Server Actions handle mutations; Route Handlers handle authentication callbacks and binary image upload requests.

## Trust boundaries

1. User-controlled input is validated by Zod before use.
2. Server code validates the current Supabase Auth identity and loads role/verification status from the database. User-editable Auth metadata never grants privileges.
3. PostgreSQL row policies and triggers independently enforce membership, ownership and moderation rules.
4. Image endpoints verify the current approved owner before accessing the server-only privileged Storage client. File bytes are validated and images are decoded/re-encoded before storage.
5. Image downloads use short-lived signed URLs for a private bucket. URL holders can use an issued URL until it expires; do not treat signed URLs as revocable sessions.

## Modes

`CAMPUSMARKET_DEMO=true` and a non-production runtime enables local fictional data. Browser-local state permits UI exploration without Supabase. Every simulated action is identified as demo behavior. Demo credentials are never sent to a real service, and server mutation entry points do not accept demo identities.

Supabase mode requires the configured project URL and publishable key. Failure to configure a production runtime does not silently enable demo access. Missing external resources are surfaced as configuration limitations.

## Data lifecycle

New Auth users receive a pending student profile. Email verification precedes administrator approval. Approved members can read active listings and their own work; administrators can review pending listings. New submissions enter review, substantive edits to approved listings require review again, and only administrators can make listings active. Sellers can mark active owned listings sold.

The database is the authority for listing state transitions. Moderation RPCs validate the administrator and write their audit event in the same transaction. Profile security columns cannot be changed through student updates.

## Privacy and scope

The application exposes a seller's display name, not their email, phone, exact location or timetable. Authentication details remain in Supabase Auth. No payments or conversations are implemented. The exchange process is a visible placeholder pending a school-approved supervised method.

## Performance

Authenticated data is rendered dynamically and must not be cached between users. Database indexes support seller/status/category lookup and search. Images are bounded in size and count, and image metadata is stripped at ingestion. No external analytics or third-party student tracking is configured. No Lighthouse measurement is claimed without running it.

## Official references

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals)
