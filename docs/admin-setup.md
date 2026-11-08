# First administrator setup

Administrator privileges must be granted by a trusted project operator with privileged SQL access. A student cannot request the role in signup metadata, update the profile role through the API, approve themself, or invoke a public bootstrap endpoint. Do not put a service-role key in a browser or use it for routine application requests.

1. Apply the migration and configure Supabase Auth email verification.
2. Have the intended school administrator register normally and verify the email link. The resulting account remains pending.
3. Verify their identity and authority through the school's established process, outside this application. Inspect the corresponding user in Supabase Auth, and copy that exact user UUID. Never select an administrator by a user-submitted display name.
4. In the Supabase SQL editor using privileged project access, replace the single UUID placeholder below and execute the transaction. The guard intentionally refuses to run if an administrator already exists or the user's email is not verified.

```sql
begin;
select pg_advisory_xact_lock(728340119);
do $$
declare
  verified_admin_id uuid := 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'An administrator already exists. Use a reviewed privileged change instead.';
  end if;
  if not exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = verified_admin_id and u.email_confirmed_at is not null
  ) then
    raise exception 'The specified account must exist and have a verified email.';
  end if;
  update public.profiles set role = 'admin', verification_status = 'approved'
    where id = verified_admin_id;
  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(verified_admin_id, 'profile', verified_admin_id, 'privileged first-admin bootstrap');
end $$;
commit;
```

5. Sign in as that user and verify `/admin` is available. Confirm a separate pending student cannot access `/`, `/explore`, `/sell` or administrative data in connected mode.
6. Approve school membership manually only after checking the school's approved roster/process. The application deliberately stores no roster, schedule, telephone number or identity documents in public profiles.

Additional administrator appointments, revocation and emergency recovery require reviewed privileged SQL access and an accompanying `moderation_events` record. The student-approval interface does not promote anyone to administrator and cannot change an existing administrator. Keep the project's privileged operator access protected with the provider's available account security controls.

The demo admin preview contains fictional accounts and simulated actions only. It neither creates a real administrator nor grants Supabase privileges.
