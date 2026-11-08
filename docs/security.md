# Security model and limitations

## Enforced boundaries

Marketplace authorization requires a verified Auth identity and an approved profile. Server-side checks load trusted database permissions for protected pages and every mutation. Pending, rejected and suspended users cannot obtain marketplace data through normal app routes. PostgreSQL RLS is a second independent boundary against direct API calls.

Students cannot update their profile role or verification state, approve listings, perform admin RPCs or modify another seller's goods. A database trigger validates listing transitions and forces renewed review after substantive edits. Administrative actions validate an approved admin role and are recorded in a database audit trail.

Private Auth fields are not duplicated into marketplace profile records. The app returns only the limited seller information needed to evaluate a listing. Error responses must not expose SQL errors, tokens or private account data; passwords and tokens must never be logged.

## Uploads

At most five images belong to a listing. The server accepts JPEG, PNG and WebP, rejects files over 5 MB, verifies signatures and actual decoding, limits image dimensions, and re-encodes images to remove metadata. Paths contain trusted user/listing IDs and a random file name. Client-provided paths and extensions do not grant access.

The bucket is private. Browser credentials cannot upload directly; only the server's validated pipeline can use privileged upload access. The service-role key is restricted to server code and must never use a `NEXT_PUBLIC_` prefix. Read access is tied to listing visibility. Signed URLs expire shortly after issue but may be copied and used until expiration; account suspension does not revoke an already-issued URL immediately.

## Sessions and request safety

SSR cookies and Proxy refresh the Supabase session. Server authorization uses a verified Auth identity, not an unverified session payload. Authenticated pages must not be shared-cacheable. Redirect destinations are restricted to safe internal destinations and the canonical site origin. Next.js Server Action origin checks and explicit upload endpoint origin checks reduce cross-site mutation risk.

Configure HTTPS and a trustworthy canonical origin in any hosted environment. The application must remain inaccessible to unapproved users even if navigation or client state is manipulated.

## Abuse prevention

Authenticated write operations use database-backed limits so limits are shared across application workers. Supabase's Auth limits protect authentication endpoints; configure SMTP, email resend/reset limits and CAPTCHA in the project before launch. Apply ingress/IP rate limits for the actual deployment platform, particularly uploads and authentication. Do not regard a local development server as an internet-facing abuse boundary.

## Development demo

The local demo contains fictional people and listings and explicitly labels simulated changes. Browser storage is not authentication. Production runtime ignores the demo flag. Neither demo accounts nor client-provided admin status can authorize a Supabase mutation.

## Required independent review

Live Supabase behavior is not proven until the migrations and security test suite run against the intended project. Review RLS with student, pending, suspended, administrator and anonymous sessions. Verify public Storage access fails, student role changes fail, and direct administrator RPC calls fail. Test token expiry, suspension during a session, and recovery email handling.

Before school launch, approve the school rules, privacy notice and exchange procedure; assess the school's data/child-safety obligations; establish data retention and deletion procedures; restrict and rotate administrator credentials; enable monitoring and backups; review dependencies; and obtain school authorization. This repository supplies implementation controls, not legal approval or a security certification.
