-- CampusMarket 1.0. Apply once using the Supabase SQL editor or `supabase db push`.
-- No student data is seeded. Public means an API schema, never public access.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.account_role as enum ('student', 'admin');
create type public.verification_state as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.listing_state as enum ('draft', 'pending_review', 'active', 'sold', 'removed');
create type public.product_condition as enum ('New', 'Like New', 'Good', 'Fair');
create type public.report_state as enum ('open', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 512),
  role public.account_role not null default 'student',
  verification_status public.verification_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null check (char_length(description) <= 300),
  display_order smallint not null unique check (display_order >= 0)
);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 4 and 100),
  description text not null check (char_length(btrim(description)) between 20 and 3000),
  price numeric(10,2) not null check (price between 0.50 and 5000.00),
  category_id uuid not null references public.categories(id),
  condition public.product_condition not null,
  status public.listing_state not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as
    (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) stored
);
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 512),
  display_order smallint not null check (display_order between 0 and 4),
  unique (listing_id, display_order)
);
create table public.saved_listings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  reason text not null check (reason in ('Prohibited item','Misleading listing','Personal information','Other concern')),
  details text not null check (char_length(btrim(details)) between 10 and 1000),
  status public.report_state not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'open' and resolved_at is null) or (status <> 'open' and resolved_at is not null))
);
create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'listing', 'report')),
  target_id uuid not null,
  action text not null check (char_length(action) between 1 and 100),
  created_at timestamptz not null default now()
);
create table private.rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_key text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, action_key, window_start)
);

create index profiles_verification_idx on public.profiles(verification_status, created_at);
create index listings_marketplace_idx on public.listings(status, created_at desc);
create index listings_category_price_idx on public.listings(category_id, status, price);
create index listings_seller_idx on public.listings(seller_id, status);
create index listings_search_idx on public.listings using gin(search_document);
create index saved_listings_listing_idx on public.saved_listings(listing_id);
create index reports_queue_idx on public.reports(status, created_at);
create index reports_listing_idx on public.reports(listing_id);
create index moderation_history_idx on public.moderation_events(created_at desc);
create unique index reports_one_open_per_member on public.reports(reporter_id, listing_id) where status = 'open';

-- These helpers read current database state, not user-editable JWT metadata.
create function private.is_approved() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.verification_status = 'approved' and u.email_confirmed_at is not null);
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
create function private.can_read_listing(listing_uuid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (
    select 1 from public.listings l join public.profiles seller on seller.id = l.seller_id
    where l.id = listing_uuid and (l.seller_id = auth.uid() or private.is_admin()
      or (l.status in ('active', 'sold') and seller.verification_status = 'approved')));
$$;
create function private.can_read_image(object_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listing_images i
    where i.storage_path = object_name and private.can_read_listing(i.listing_id));
$$;

create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare proposed_name text;
begin
  proposed_name := left(btrim(coalesce(new.raw_user_meta_data->>'display_name', 'Student')), 60);
  if char_length(proposed_name) < 2 then proposed_name := 'Student'; end if;
  -- Role and verification deliberately ignore supplied metadata.
  insert into public.profiles(id, display_name, role, verification_status)
    values (new.id, proposed_name, 'student', 'pending');
  return new;
end;
$$;
create trigger campusmarket_profile_on_signup after insert on auth.users
  for each row execute function private.create_profile();

create function private.guard_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'Profile identity cannot be changed.' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and
     (new.role is distinct from old.role or new.verification_status is distinct from old.verification_status
      or new.avatar_path is distinct from old.avatar_path) then
    raise exception 'Only privileged account administration may change permissions.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_profile before update on public.profiles
  for each row execute function private.guard_profile();

create function private.guard_listing() returns trigger language plpgsql set search_path = '' as $$
declare substantive boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and (not private.is_approved() or new.seller_id <> auth.uid()
      or new.status not in ('draft', 'pending_review')) then
      raise exception 'Listings require an approved owner and review.' using errcode = '42501';
    end if;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  if new.id <> old.id or new.seller_id <> old.seller_id or new.created_at <> old.created_at then
    raise exception 'Listing identity cannot be changed.' using errcode = '42501';
  end if;
  substantive := row(new.title, new.description, new.price, new.category_id, new.condition)
    is distinct from row(old.title, old.description, old.price, old.category_id, old.condition);
  if auth.uid() is null and current_user not in ('authenticated', 'anon') then
    new.updated_at := now(); return new; -- SQL owner maintenance / migrations only.
  end if;
  if not private.is_approved() then raise exception 'Approved membership required.' using errcode = '42501'; end if;
  if current_user not in ('authenticated', 'anon') and private.is_admin() and not substantive and new.status in ('active','removed') and new.status <> old.status then
    if not ((old.status = 'pending_review' and new.status = 'active')
       or (old.status in ('draft', 'pending_review', 'active', 'sold') and new.status = 'removed')) then
      raise exception 'Invalid moderation transition.' using errcode = '23514';
    end if;
  else
    if old.seller_id <> auth.uid() then raise exception 'Only the owner may edit a listing.' using errcode = '42501'; end if;
    if old.status in ('removed', 'sold') then raise exception 'This listing can no longer be edited.' using errcode = '23514'; end if;
    if substantive and old.status = 'active' and new.status <> 'draft' then new.status := 'pending_review'; end if;
    if not ((old.status = 'draft' and new.status in ('draft', 'pending_review'))
      or (old.status = 'pending_review' and new.status in ('draft', 'pending_review'))
      or (old.status = 'active' and new.status in ('draft', 'active', 'pending_review', 'sold'))) then
      raise exception 'Invalid listing transition.' using errcode = '23514';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger guard_listing before insert or update on public.listings
  for each row execute function private.guard_listing();

create function private.guard_listing_image() returns trigger language plpgsql security definer set search_path = '' as $$
declare listing_record public.listings; image_record public.listing_images;
begin
  if tg_op = 'DELETE' then image_record := old; else image_record := new; end if;
  select * into listing_record from public.listings where id = image_record.listing_id for update;
  if not found and tg_op = 'DELETE' then return old; end if; -- parent deletion cascade
  if not private.is_approved() or listing_record.seller_id <> auth.uid()
    or listing_record.status not in ('draft', 'pending_review', 'active') then
    raise exception 'Only the approved owner may change listing images.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if image_record.storage_path !~ ('^' || listing_record.seller_id::text || '/' || listing_record.id::text || '/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$')
      or not exists (select 1 from storage.objects where bucket_id = 'listing-images' and name = image_record.storage_path) then
      raise exception 'Image must be a verified upload owned by this listing.' using errcode = '23514';
    end if;
  end if;
  if listing_record.status = 'active' then
    update public.listings set status = 'pending_review' where id = listing_record.id;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger guard_listing_image before insert or delete on public.listing_images
  for each row execute function private.guard_listing_image();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.saved_listings enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_events enable row level security;
alter table private.rate_limits enable row level security;

create policy profile_read on public.profiles for select to authenticated using (id = auth.uid() or private.is_admin());
create policy profile_name_update on public.profiles for update to authenticated
  using (id = auth.uid() and verification_status not in ('suspended', 'rejected'))
  with check (id = auth.uid() and verification_status not in ('suspended', 'rejected'));
create policy categories_member_read on public.categories for select to authenticated using (private.is_approved());
create policy listings_member_read on public.listings for select to authenticated using (private.can_read_listing(id));
create policy listings_owner_insert on public.listings for insert to authenticated
  with check (private.is_approved() and seller_id = auth.uid() and status in ('draft', 'pending_review'));
create policy listings_owner_update on public.listings for update to authenticated
  using (private.is_approved() and seller_id = auth.uid())
  with check (private.is_approved() and seller_id = auth.uid());
create policy listings_owner_delete on public.listings for delete to authenticated using (private.is_approved() and seller_id = auth.uid());
create policy images_member_read on public.listing_images for select to authenticated using (private.can_read_listing(listing_id));
create policy images_owner_insert on public.listing_images for insert to authenticated
  with check (private.is_approved() and exists(select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy images_owner_delete on public.listing_images for delete to authenticated
  using (private.is_approved() and exists(select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy saved_owner_read on public.saved_listings for select to authenticated
  using (private.is_approved() and user_id = auth.uid() and private.can_read_listing(listing_id));
create policy saved_owner_insert on public.saved_listings for insert to authenticated
  with check (private.is_approved() and user_id = auth.uid() and private.can_read_listing(listing_id));
create policy saved_owner_delete on public.saved_listings for delete to authenticated using (private.is_approved() and user_id = auth.uid());
create policy reports_owner_or_admin_read on public.reports for select to authenticated
  using (private.is_approved() and (reporter_id = auth.uid() or private.is_admin()));
create policy reports_member_insert on public.reports for insert to authenticated
  with check (private.is_approved() and reporter_id = auth.uid() and private.can_read_listing(listing_id) and status = 'open' and resolved_at is null);
create policy moderation_admin_read on public.moderation_events for select to authenticated using (private.is_admin());

-- Column grants are a second boundary in addition to triggers and RLS.
revoke all on public.profiles, public.categories, public.listings, public.listing_images,
  public.saved_listings, public.reports, public.moderation_events from anon, authenticated;
grant select on public.profiles, public.categories, public.listings, public.listing_images,
  public.saved_listings, public.reports, public.moderation_events to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert(id, seller_id, title, description, price, category_id, condition, status),
  update(title, description, price, category_id, condition, status), delete on public.listings to authenticated;
grant insert(id, listing_id, storage_path, display_order), delete on public.listing_images to authenticated;
grant insert(user_id, listing_id), delete on public.saved_listings to authenticated;
grant insert(reporter_id, listing_id, reason, details) on public.reports to authenticated;

-- Never expose other profile columns through seller lookups.
create function public.get_seller_names(ids uuid[]) returns table(id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name from public.profiles p where private.is_approved() and p.id = any(ids)
    and exists (select 1 from public.listings l where l.seller_id = p.id and private.can_read_listing(l.id));
$$;

create function public.moderate_user(target_id uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare old_status public.verification_state;
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation',30,60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;
  if target_id = auth.uid() then raise exception 'Administrators cannot moderate their own account.' using errcode = '42501'; end if;
  if new_status not in ('approved', 'rejected', 'suspended') then raise exception 'Invalid account status.' using errcode = '23514'; end if;
  select verification_status into old_status from public.profiles where id = target_id and role = 'student' for update;
  if not found then raise exception 'Student account not found.' using errcode = 'P0002'; end if;
  if old_status::text = new_status then raise exception 'Account already has this status.' using errcode = '23514'; end if;
  if new_status = 'approved' and not exists(select 1 from auth.users where id = target_id and email_confirmed_at is not null) then
    raise exception 'Email must be verified before school approval.' using errcode = '23514';
  end if;
  update public.profiles set verification_status = new_status::public.verification_state where id = target_id;
  insert into public.moderation_events(actor_id,target_type,target_id,action)
    values(auth.uid(),'profile',target_id,old_status::text || ' -> ' || new_status);
end;
$$;
create function public.moderate_listing(target_id uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare old_status public.listing_state;
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation',30,60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;
  if new_status not in ('active','removed') then raise exception 'Invalid moderation status.' using errcode = '23514'; end if;
  select status into old_status from public.listings where id = target_id for update;
  if not found then raise exception 'Listing not found.' using errcode = 'P0002'; end if;
  if new_status = 'active' and not exists(select 1 from public.listings l join public.profiles p on l.seller_id = p.id
    where l.id = target_id and p.verification_status = 'approved') then
    raise exception 'Seller must be approved.' using errcode = '23514';
  end if;
  update public.listings set status = new_status::public.listing_state where id = target_id;
  insert into public.moderation_events(actor_id,target_type,target_id,action)
    values(auth.uid(),'listing',target_id,old_status::text || ' -> ' || new_status);
end;
$$;
create function public.resolve_report(target_id uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation',30,60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;
  if new_status not in ('resolved','dismissed') then raise exception 'Invalid report status.' using errcode = '23514'; end if;
  update public.reports set status = new_status::public.report_state,resolved_at = now()
    where id = target_id and status = 'open';
  if not found then raise exception 'Open report not found.' using errcode = 'P0002'; end if;
  insert into public.moderation_events(actor_id,target_type,target_id,action)
    values(auth.uid(),'report',target_id,new_status);
end;
$$;

-- Shared, atomic abuse limits across app instances. Arguments may only tighten caps.
create function public.consume_rate_limit(action_key text, max_requests integer, window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare cap integer; requested_count integer; boundary timestamptz; seconds integer;
begin
  if not private.is_approved() and not (action_key = 'profile_update' and exists(
    select 1 from public.profiles where id = auth.uid() and verification_status = 'pending'
  )) then return false; end if;
  cap := case action_key when 'listing_write' then 20 when 'saved_toggle' then 60
    when 'report' then 5 when 'profile_update' then 10 when 'moderation' then 30 when 'upload' then 15 else 0 end;
  if cap = 0 or max_requests is null or max_requests < 1 or window_seconds is null or window_seconds < 1 then return false; end if;
  -- Always enforce one fixed 60-second bucket; callers cannot fragment the bucket by choosing windows.
  seconds := 60;
  cap := least(cap, max_requests);
  boundary := to_timestamp(floor(extract(epoch from now()) / seconds) * seconds);
  insert into private.rate_limits(user_id,action_key,window_start,request_count)
    values(auth.uid(),consume_rate_limit.action_key,boundary,1)
    on conflict on constraint rate_limits_pkey do update
      set request_count = private.rate_limits.request_count + 1
    returning request_count into requested_count;
  -- Bound retained counters to the recent window without a scheduled job.
  delete from private.rate_limits where user_id = auth.uid() and window_start < now() - interval '2 minutes';
  return requested_count <= cap;
end;
$$;

-- These triggers also cover direct REST requests, which need not visit Next.js.
-- Cascading deletes/automatic image review updates do not consume a second quota.
create function private.limit_mutation() returns trigger language plpgsql set search_path = '' as $$
declare key_name text;
begin
  if auth.uid() is not null and current_user = 'authenticated' then
    key_name := case tg_table_name when 'listings' then 'listing_write'
      when 'listing_images' then 'upload' when 'saved_listings' then 'saved_toggle'
      when 'reports' then 'report' when 'profiles' then 'profile_update' end;
    if not public.consume_rate_limit(key_name,1000000,60) then
      raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
create trigger limit_listing_mutation before insert or update or delete on public.listings
  for each row execute function private.limit_mutation();
create trigger limit_image_mutation before insert or delete on public.listing_images
  for each row execute function private.limit_mutation();
create trigger limit_saved_mutation before insert or delete on public.saved_listings
  for each row execute function private.limit_mutation();
create trigger limit_report_mutation before insert on public.reports
  for each row execute function private.limit_mutation();
create trigger limit_profile_mutation before update on public.profiles
  for each row execute function private.limit_mutation();

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_approved(), private.is_admin(), private.can_read_listing(uuid), private.can_read_image(text) to authenticated;
revoke all on function public.get_seller_names(uuid[]), public.moderate_user(uuid,text),
  public.moderate_listing(uuid,text), public.resolve_report(uuid,text), public.consume_rate_limit(text,integer,integer) from public, anon;
grant execute on function public.get_seller_names(uuid[]), public.moderate_user(uuid,text),
  public.moderate_listing(uuid,text), public.resolve_report(uuid,text), public.consume_rate_limit(text,integer,integer) to authenticated;

insert into public.categories(id,name,slug,description,display_order) values
  ('10000000-0000-4000-8000-000000000001','Textbooks','textbooks','A new chapter for pre-loved books.',1),
  ('10000000-0000-4000-8000-000000000002','Calculators','calculators','Scientific calculators for your next lesson.',2),
  ('10000000-0000-4000-8000-000000000003','Stationery','stationery','Small essentials for big ideas.',3),
  ('10000000-0000-4000-8000-000000000004','School Supplies','school-supplies','Everyday classroom essentials.',4),
  ('10000000-0000-4000-8000-000000000005','Electronics','electronics','School-appropriate learning technology.',5),
  ('10000000-0000-4000-8000-000000000006','Bags','bags','Carry your school day comfortably.',6),
  ('10000000-0000-4000-8000-000000000007','Sports Equipment','sports-equipment','Find your next game-day essential.',7),
  ('10000000-0000-4000-8000-000000000008','Other Approved Items','other-approved-items','Other goods approved by your school.',8);

-- Uploads must pass the server's byte sniffing and re-encoding. No authenticated
-- INSERT/UPDATE/DELETE policy is intentionally defined for storage.objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('listing-images','listing-images',false,5242880,array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
create policy campusmarket_private_images_read on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and private.can_read_image(name));
-- Restrictive policies also close access if an existing project has broad,
-- permissive policies intended for a different bucket. Other buckets are untouched.
create policy campusmarket_storage_read_boundary on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'listing-images' or private.can_read_image(name));
create policy campusmarket_storage_anon_boundary on storage.objects as restrictive for all to anon
  using (bucket_id <> 'listing-images') with check (bucket_id <> 'listing-images');
create policy campusmarket_storage_insert_boundary on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'listing-images');
create policy campusmarket_storage_update_boundary on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'listing-images') with check (bucket_id <> 'listing-images');
create policy campusmarket_storage_delete_boundary on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'listing-images');

commit;
