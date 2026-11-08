# Deployment preparation — no automatic launch

This project is for local evaluation until the school explicitly approves launch. No Site, public deployment, production database, or student account has been created as part of local implementation.

## Build and runtime

Use a maintained Node.js runtime supported by the installed Next.js version. Install dependencies from the committed lockfile, run the documented checks, and build:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm start
```

Supply the Supabase environment variables and canonical `NEXT_PUBLIC_SITE_URL` for the intended environment. Public-prefixed variables are incorporated into the build; rebuild if they change. `SUPABASE_SERVICE_ROLE_KEY` is a runtime server secret. Do not copy `.env.local` into an image or publish it as a static asset.

Demo mode does not activate in production even if its flag is set. Production requires actual Supabase setup. The app is server-backed; a static HTML export cannot implement its authentication, server actions, private queries or uploads.

## Launch gates

1. School leadership approves participation, administrator ownership and the launch date.
2. Administrators approve the rules, privacy notice, retention/deletion policy and supervised goods exchange method. Replace all pending-review placeholders.
3. Supabase migrations pass in an isolated environment and are reviewed for the production project. Bootstrap only designated administrators through privileged setup.
4. Confirm email delivery and recovery with school-approved SMTP; configure CAPTCHA/Auth rate limits and deployment ingress limits.
5. Run live RLS/Storage tests and cross-user checks with fictional accounts, including suspended sessions and expired signed URLs.
6. Verify HTTPS, canonical callback URLs, security headers, secure cookies, no shared caching of authenticated data, and secret isolation.
7. Define backups, restore drills, audit review, abuse reporting response, account suspension ownership and data deletion procedures.
8. Complete keyboard, screen-reader, mobile-device and representative network testing. Run Lighthouse if scores are needed; no score is implied by the repository.
9. Review dependencies and the exact deployed commit. Keep production logs free of student content, passwords and tokens.

Approval of source code or a local demo is not approval to publish student data. Obtain explicit launch authorization before making the service reachable by students.
