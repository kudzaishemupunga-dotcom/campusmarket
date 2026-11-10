# Deployment Preparation — No Automatic Public Launch

CampusMarket 2.0 is prepared for local evaluation and Wise Owl High School Westgate review. No public deployment, hosted database, or live student account has been created during development.

## Build & Runtime Verification

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:db
pnpm build
pnpm start
```

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and an HTTPS `NEXT_PUBLIC_SITE_URL` in your server environment. Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.

Set the public-prefixed variables before building; Next.js can embed these values in browser bundles, so rebuild when the target environment changes. `NEXT_PUBLIC_SITE_URL` is the canonical origin used for email callbacks and upload request validation. Register the exact HTTPS `/auth/callback` URL in Supabase Auth. `CAMPUSMARKET_DEV_ORIGINS` is for local development only and is ignored by production; a LAN allowlist is not a production cross-origin policy.

The app uses server actions, dynamic SSR sessions, Route Handlers, private storage signing and database RPCs. Deploy it on a supported Node.js host; do not treat it as a static export. The local `start` command binds to loopback. Use the chosen host's documented proxy/listening configuration, HTTPS termination and secret injection, and prevent shared caching of authenticated responses. Do not publish `tests/helpers`, test reports, `.env*`, or local private credentials as public assets.

The test harness is a loopback-only development tool with an intentionally privileged test-administration endpoint. It must never be deployed or used as an authentication service. Browser test passes exercise application flows against that isolated substitute; hosted Supabase behavior remains a separate launch gate.

## Mandatory School Launch Gates

1. **Formal School Authorization:** Written approval from Wise Owl High School Westgate administration covering platform governance, official branding/disclaimer wording, staff moderators, and launch scope.
2. **Policy & Handover Sign-Off:** Finalize the school rules (`/rules`), privacy notice (`/privacy`), data retention/deletion policy, and the exact supervised campus handover location/schedule for fulfilled Purchase Requests.
3. **Database & Auth Hardening:** Review and apply all committed migrations in lexical order to an approved staging project first, then the authorized production project. Bootstrap designated staff administrators, enable custom SMTP, and configure Auth/IP rate limits and CAPTCHA. Do not reset or seed a project containing school data as part of testing.
4. **Live Staging Security Audit:** Verify RLS, private `listing-images` bucket isolation, group collaboration boundaries, and atomic purchase fulfillment against the hosted Supabase staging instance using non-personal test accounts.
5. **Operational Readiness:** Establish database backup verification, moderation queue SLAs, report escalation procedures, and credential rotation schedules.

6. **Mobile Acceptance:** Complete the physical-phone checks in [mobile testing](mobile-testing.md), including keyboard, photo selection, recovery links, slow-network failures and accessibility. Automated viewport screenshots alone do not establish mobile Safari behavior or real-device readiness.
