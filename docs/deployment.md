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

## Mandatory School Launch Gates

1. **Formal School Authorization:** Written approval from Wise Owl High School Westgate administration covering platform governance, official branding/disclaimer wording, staff moderators, and launch scope.
2. **Policy & Handover Sign-Off:** Finalize the school rules (`/rules`), privacy notice (`/privacy`), data retention/deletion policy, and the exact supervised campus handover location/schedule for fulfilled Purchase Requests.
3. **Database & Auth Hardening:** Apply both migrations to the school’s production Supabase project, bootstrap designated staff administrators, enable custom SMTP, and configure Auth/IP rate limits and CAPTCHA.
4. **Live Staging Security Audit:** Verify RLS, private `listing-images` bucket isolation, group collaboration boundaries, and atomic purchase fulfillment against the hosted Supabase staging instance using non-personal test accounts.
5. **Operational Readiness:** Establish database backup verification, moderation queue SLAs, report escalation procedures, and credential rotation schedules.
