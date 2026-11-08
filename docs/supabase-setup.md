# Connect your own Supabase project

Use a dedicated development project containing fictional users while validating the implementation. No external project has been created by this repository.

1. Create a Supabase project under the school's approved account and region.
2. Copy `.env.example` to `.env.local`. Set `CAMPUSMARKET_DEMO=false`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` using values from your project. The service-role key stays on the server.
3. Apply every SQL file in `supabase/migrations` in lexical order through the SQL editor, or use the Supabase CLI linked to your own development project. Review each migration first. See [database](database.md).
4. Verify the `listing-images` bucket exists and is **private**. Do not make it public or add permissive Storage policies. The migration installs the bucket and policies.
5. In Auth, enable email/password signup and require email confirmation. Do not disable confirmation for a school deployment. Configure custom SMTP with a provider approved by the school.
6. Set the Auth Site URL to the exact canonical app origin. Add the app's `/auth/callback` URL to permitted redirect URLs, including the local origin used for testing. Use exact production URLs instead of broad wildcard patterns.
7. Register a fictional administrator through the app, verify the email, then use the privileged bootstrap procedure in [admin setup](admin-setup.md). Never grant roles using user-editable Auth metadata.
8. Register separate fictional approved students, a pending student and a suspended student. Execute the database/security tests and browser checks before adding real users.

For CLI-managed development, install the official [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), authenticate, link the intended project, and inspect the migration plan before pushing. Do not run a reset against a project with school data. Local CLI instances require Docker.

## Email callbacks

The callback exchanges the PKCE code for an SSR session and uses only allowed internal destinations. Recovery links return to the password-reset flow. Verify the templates and allowed URLs in the actual project: signup confirmation, expired link, recovery, resend limits, a new browser, and a recovery link opened in the browser that requested it. Provider configuration and email delivery cannot be verified without a real project.

## Verification checklist

- An anonymous browser cannot read listing rows or private images.
- A confirmed but pending account reaches pending approval, not the marketplace.
- An approved user can create a pending listing and upload permitted images.
- Only an approved administrator can activate that listing.
- A second student cannot edit/delete the first student's listing or access pending images.
- Editing a live listing sends it back to review.
- Suspended users lose restricted data access on subsequent requests.
- Reports and moderation events persist and are visible only to permitted roles.
- Images have no public download URL, and signed URLs expire.

Official references: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [signed downloads](https://supabase.com/docs/guides/storage/serving/downloads).
