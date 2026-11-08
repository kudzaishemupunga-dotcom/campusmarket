# First Administrator Setup

School administrator privileges must be granted out-of-band by a trusted project operator using privileged SQL access. Students cannot request the `admin` role in signup metadata, self-approve membership or seller access, or call a public bootstrap endpoint.

1. Apply both migrations (`202611080001_campusmarket.sql` and `202611080002_wise_owl_projects.sql`) and configure Supabase Auth email verification.
2. Have the designated Wise Owl High School Westgate administrator register normally at `/signup` and click their email confirmation link. Their profile starts as `student` / `pending`.
3. Verify their identity outside the application, inspect the corresponding user in **Supabase Auth → Users**, and copy their exact UUID.
4. Run the guarded transaction below in the Supabase SQL Editor, replacing `REPLACE_WITH_VERIFIED_AUTH_USER_UUID`:

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
  update public.profiles
     set role = 'admin',
         verification_status = 'approved',
         seller_approved = true
   where id = verified_admin_id;
  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(verified_admin_id, 'profile', verified_admin_id, 'privileged first-admin bootstrap');
end $$;
commit;
```

5. Sign in as that administrator and confirm `/admin`, `/admin/users`, `/admin/groups`, `/admin/products`, `/admin/requests`, and `/admin/reports` are accessible, while non-admin students are redirected away from `/admin/*`.
6. When using **Publish Verified Product** on `/admin/products`, only enter actual, physically verified Wise Owl learner or group school-project products with explicit school authorization.
