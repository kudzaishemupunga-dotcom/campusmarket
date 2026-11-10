# Mobile and local-network testing

The application remains a local development project unless the school authorizes deployment. A phone preview on the same trusted Wi-Fi network is separate from publishing a public website.

## Desktop preview

Run `pnpm dev` and open `http://127.0.0.1:3000`. This default binds to loopback, so other devices cannot reach it. No Supabase credentials are needed for public pages and honest empty states; private workflows require a configured development project or the isolated automated test harness.

## Phone on the same Wi-Fi

1. Connect the Windows PC and phone to the same trusted private network. Find the PC's current Wi-Fi IPv4 address with `ipconfig`; do not assume an address from a previous session still applies.
2. In your local development environment, set the canonical origin to that PC address and port. For example, replace the example address below with the actual current address:

   ```dotenv
   NEXT_PUBLIC_SITE_URL=http://192.168.1.20:3000
   CAMPUSMARKET_DEV_ORIGINS=http://192.168.1.20:3000,http://127.0.0.1:3000
   ```

   `CAMPUSMARKET_DEV_ORIGINS` is a comma-separated list of exact development origins, including scheme and port. It is ignored in production. Do not use wildcards, public hostnames you do not control, or a list of arbitrary networks.
3. Stop the existing local server and run `pnpm dev:lan`. This explicitly listens on `0.0.0.0`; visit the canonical LAN URL on the phone, not `localhost`, `127.0.0.1`, or `0.0.0.0`.
4. If Windows Firewall asks, allow the development server only on the intended private network. Do not disable the firewall, open public-network access, forward a router port, or create a public tunnel for this check. Guest Wi-Fi/client isolation may prevent device-to-device connections.
5. For actual account confirmation/recovery in a designated development Supabase project, add the **exact** canonical `/auth/callback` URL to Auth's allowed redirects and configure the project's Site URL consistently. The application constructs email callbacks from `NEXT_PUBLIC_SITE_URL`; an extra allowed development origin does not change those email links. Restart after environment changes.
6. Stop the LAN server when testing ends. Restore the loopback canonical origin for desktop-only development as appropriate. Changing an origin can require signing in again because browser cookies are origin-specific.

The origin configuration permits matching development requests; it does not bypass membership, group, owner or administrator authorization. Production accepts only the HTTPS canonical app origin for upload requests and does not honor the development allowlist.

## Automated checks

`pnpm test:e2e` owns two fresh loopback servers: an empty in-memory PGlite compatibility harness and a Next.js development server with explicit fake keys. Process-level overrides prevent it from using live Supabase values from `.env.local`. The configuration rejects `PLAYWRIGHT_BASE_URL` so the mutating suite cannot accidentally be redirected to a live website. Test fixtures are created through test-only signup and product workflows after verifying the initial empty marketplace; they are never seeded into the application or a live project.

The browser suite checks:

- 360, 390, 768, 1366 and 1920-pixel viewport layouts on the homepage and main navigation.
- Touch-enabled Chromium at 360 and 390 pixels for expanded catalog filters, filtering, product details and report dialogs.
- Login, signup, recovery, seller registration, seller dashboard, product forms, group/settings pages and stock dialogs.
- Populated administrator queues, form-control clipping and uncaught browser exceptions.
- Dark-theme persistence and mobile-menu navigation.

Screenshots are written under `test-results/visual-qa`; failure traces and screenshots are retained under `test-results`, and the report is in `playwright-report`. These are local test artifacts, not deployment assets.

## Real-device acceptance still required

Viewport/touch emulation is not a physical-phone or mobile-Safari test. On at least one iPhone and one Android phone, check portrait and landscape, the on-screen keyboard, browser address-bar resizing, pinch zoom, safe-area spacing, text enlargement, focus movement, camera/photo-picker behavior, large images, a slow connection and session expiry. Verify the primary action stays reachable when the keyboard is open and that a failed upload can be retried without duplicate products. Test email links on the intended device/browser and obtain school approval before involving real student data.

See [testing](testing.md) for the current executed results and their limits. No physical-device, Safari, Lighthouse or hosted Supabase result is implied by a Chromium test pass.
