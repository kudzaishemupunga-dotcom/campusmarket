-- CampusMarket 2.0 — Wise Owl High School Westgate Student Project Marketplace
-- Extends CampusMarket 1.0 schema with seller verification, collaborative project groups,
-- project product metadata, stock & availability controls, main image ordering,
-- and safe school-supervised purchase requests with atomic fulfillment.
-- Preserves existing tables and real user records. Seeds zero products or accounts.

begin;

-- 1. Update categories to Zimbabwe Heritage-Based Curriculum school-project areas
insert into public.categories(id, name, slug, description, display_order) values
  ('10000000-0000-4000-8000-000000000001', 'Design & Technology', 'design-and-technology', 'Engineered prototypes, woodwork, metalwork, and practical student builds.', 1),
  ('10000000-0000-4000-8000-000000000002', 'Agriculture & Agribusiness', 'agriculture-and-agribusiness', 'Horticulture, seedlings, and sustainable school farm projects.', 2),
  ('10000000-0000-4000-8000-000000000003', 'Food Science & Nutrition', 'food-science-and-nutrition', 'School-inspected culinary, baking, and food-processing learner projects.', 3),
  ('10000000-0000-4000-8000-000000000004', 'Textiles, Fashion & Craft', 'textiles-fashion-and-craft', 'Garments, textiles, beadwork, and handcrafted student design work.', 4),
  ('10000000-0000-4000-8000-000000000005', 'Science & STEM Innovations', 'science-and-stem', 'Electronics, robotics, renewable energy, and applied science models.', 5),
  ('10000000-0000-4000-8000-000000000006', 'Visual & Creative Arts', 'visual-and-creative-arts', 'Original artwork, ceramics, printmaking, and creative studio pieces.', 6),
  ('10000000-0000-4000-8000-000000000007', 'ICT & Media Projects', 'ict-and-media', 'Student-authored guides, design prints, and educational project kits.', 7),
  ('10000000-0000-4000-8000-000000000008', 'Enterprise & Collaborative Goods', 'enterprise-and-collaborative', 'Interdisciplinary student enterprise products approved by the school.', 8)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  display_order = excluded.display_order;

-- 2. Extend profiles for individual & group seller onboarding
alter table public.profiles
  add column if not exists seller_type text not null default 'none'
    check (seller_type in ('none', 'individual', 'group')),
  add column if not exists seller_approved boolean not null default false,
  add column if not exists project_summary text
    check (project_summary is null or char_length(btrim(project_summary)) <= 500);

-- Preserve seller access for any real existing approved profiles that already own listings
update public.profiles p
set seller_approved = true,
    seller_type = case when p.seller_type = 'none' then 'individual' else p.seller_type end
where p.verification_status = 'approved'
  and exists (select 1 from public.listings l where l.seller_id = p.id);

grant update(display_name, seller_type, project_summary) on public.profiles to authenticated;

create or replace function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  proposed_name text;
  requested_seller_type text;
  proposed_summary text;
begin
  proposed_name := left(btrim(coalesce(new.raw_user_meta_data->>'display_name', 'Student')), 60);
  if char_length(proposed_name) < 2 then proposed_name := 'Student'; end if;
  requested_seller_type := coalesce(new.raw_user_meta_data->>'seller_type', 'none');
  if requested_seller_type not in ('none', 'individual', 'group') then
    requested_seller_type := 'none';
  end if;
  proposed_summary := nullif(left(btrim(coalesce(new.raw_user_meta_data->>'project_summary', '')), 500), '');
  -- Role, verification_status, and seller_approved strictly ignore client metadata.
  insert into public.profiles(id, display_name, role, verification_status, seller_type, seller_approved, project_summary)
    values (new.id, proposed_name, 'student', 'pending', requested_seller_type, false, proposed_summary);
  return new;
end;
$$;

create or replace function private.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'Profile identity cannot be changed.' using errcode = '42501';
  end if;
  if current_user in ('authenticated', 'anon') and
     (new.role is distinct from old.role
      or new.verification_status is distinct from old.verification_status
      or new.seller_approved is distinct from old.seller_approved
      or new.avatar_path is distinct from old.avatar_path) then
    raise exception 'Only privileged account administration may change permissions.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.is_approved_seller() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.seller_approved = true or p.role = 'admin')
  );
$$;

-- 3. Collaborative Seller Groups & Memberships
create type public.group_state as enum ('pending', 'approved', 'rejected', 'removed');
create type public.group_role as enum ('owner', 'member');
create type public.membership_state as enum ('invited', 'requested', 'approved', 'removed');
create type public.purchase_request_state as enum ('pending', 'accepted', 'declined', 'fulfilled', 'cancelled');

create table public.seller_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 3 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  project_description text not null check (char_length(btrim(project_description)) between 20 and 2000),
  learning_area text check (learning_area is null or char_length(btrim(learning_area)) <= 100),
  image_path text check (image_path is null or char_length(image_path) <= 512),
  created_by uuid not null references public.profiles(id) on delete cascade,
  verification_status public.group_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.seller_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role public.group_role not null default 'member',
  can_manage_products boolean not null default false,
  status public.membership_state not null default 'requested',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index seller_groups_status_idx on public.seller_groups(verification_status, created_at desc);
create index group_members_user_idx on public.group_members(user_id, status);

create or replace function private.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (
    select 1 from public.group_members m
    join public.seller_groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = auth.uid() and m.status = 'approved'
      and g.verification_status <> 'removed'
  );
$$;

create or replace function private.is_group_owner(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (
    select 1 from public.group_members m
    join public.seller_groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = auth.uid()
      and m.status = 'approved' and m.member_role = 'owner'
      and g.verification_status <> 'removed'
  );
$$;

create or replace function private.can_manage_group_products(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (
    select 1 from public.seller_groups g
    join public.group_members m on m.group_id = g.id
    where g.id = gid and g.verification_status = 'approved'
      and m.user_id = auth.uid() and m.status = 'approved'
      and (m.member_role = 'owner' or m.can_manage_products = true)
  );
$$;

create or replace function private.has_group_relation(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = auth.uid() and m.status in ('approved', 'invited', 'requested')
  );
$$;

create or replace function private.is_approved_group(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.seller_groups g
    where g.id = gid and g.verification_status = 'approved'
  );
$$;

-- 4. Extend listings and listing_images for real school-project products
alter table public.listings
  add column if not exists group_id uuid references public.seller_groups(id) on delete set null,
  add column if not exists project_name text check (project_name is null or char_length(btrim(project_name)) between 2 and 120),
  add column if not exists stock_quantity integer not null default 1 check (stock_quantity between 0 and 10000),
  add column if not exists availability text not null default 'available' check (availability in ('available', 'sold_out', 'unavailable')),
  add column if not exists materials text check (materials is null or char_length(btrim(materials)) <= 500),
  add column if not exists dimensions text check (dimensions is null or char_length(btrim(dimensions)) <= 160),
  add column if not exists production_method text check (production_method is null or char_length(btrim(production_method)) <= 500),
  add column if not exists learning_area text check (learning_area is null or char_length(btrim(learning_area)) <= 100),
  add column if not exists made_to_order boolean not null default false,
  add column if not exists created_by_admin uuid references public.profiles(id) on delete set null;

create index if not exists listings_group_idx on public.listings(group_id, status);
create index if not exists listings_availability_idx on public.listings(status, availability, created_at desc);

alter table public.listing_images
  drop constraint if exists listing_images_listing_id_display_order_key;
alter table public.listing_images
  add constraint listing_images_listing_id_display_order_key
  unique (listing_id, display_order) deferrable initially immediate;

grant insert(id, seller_id, group_id, title, description, price, category_id, condition, status,
             project_name, stock_quantity, availability, materials, dimensions, production_method, learning_area, made_to_order),
      update(title, description, price, category_id, condition, status,
             project_name, stock_quantity, availability, materials, dimensions, production_method, learning_area, made_to_order),
      delete on public.listings to authenticated;

create or replace function private.can_edit_listing(listing_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l
    where l.id = listing_uuid and (
      (l.group_id is null and private.is_approved_seller() and l.seller_id = auth.uid())
      or (l.group_id is not null and private.can_manage_group_products(l.group_id))
    )
  );
$$;

create or replace function private.is_approved_user(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.verification_status = 'approved'
  );
$$;

create or replace function private.can_read_listing(listing_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_approved() and exists (
    select 1 from public.listings l
    join public.profiles seller on seller.id = l.seller_id
    left join public.seller_groups g on g.id = l.group_id
    where l.id = listing_uuid and (
      l.seller_id = auth.uid()
      or (l.group_id is not null and private.is_group_member(l.group_id))
      or private.is_admin()
      or (
        l.status in ('active', 'sold')
        and seller.verification_status = 'approved'
        and (l.group_id is null or g.verification_status = 'approved')
      )
    )
  );
$$;

drop policy if exists listings_member_read on public.listings;
drop policy if exists listings_owner_insert on public.listings;
drop policy if exists listings_owner_update on public.listings;
drop policy if exists listings_owner_delete on public.listings;

create policy listings_member_read on public.listings for select to authenticated
  using (
    private.is_approved() and (
      seller_id = auth.uid()
      or (group_id is not null and private.is_group_member(group_id))
      or private.is_admin()
      or (
        status in ('active', 'sold')
        and private.is_approved_user(seller_id)
        and (group_id is null or private.is_approved_group(group_id))
      )
    )
  );

create policy listings_seller_insert on public.listings for insert to authenticated
  with check (
    seller_id = auth.uid()
    and status in ('draft', 'pending_review')
    and (
      (group_id is null and private.is_approved_seller())
      or (group_id is not null and private.can_manage_group_products(group_id))
    )
  );

create policy listings_seller_update on public.listings for update to authenticated
  using (
    (group_id is null and private.is_approved_seller() and seller_id = auth.uid())
    or (group_id is not null and private.can_manage_group_products(group_id))
  )
  with check (
    (group_id is null and private.is_approved_seller() and seller_id = auth.uid())
    or (group_id is not null and private.can_manage_group_products(group_id))
  );

create policy listings_seller_delete on public.listings for delete to authenticated
  using (
    (group_id is null and private.is_approved() and seller_id = auth.uid())
    or (group_id is not null and private.can_manage_group_products(group_id))
  );

drop policy if exists images_owner_insert on public.listing_images;
drop policy if exists images_owner_delete on public.listing_images;

create policy images_seller_insert on public.listing_images for insert to authenticated
  with check (private.can_edit_listing(listing_id));

create policy images_seller_delete on public.listing_images for delete to authenticated
  using (private.can_edit_listing(listing_id));

create or replace function private.guard_listing() returns trigger
language plpgsql set search_path = '' as $$
declare
  substantive boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and current_user in ('authenticated', 'anon') then
      if new.seller_id <> auth.uid() or new.status not in ('draft', 'pending_review') or new.created_by_admin is not null then
        raise exception 'Listings require an approved seller and school review.' using errcode = '42501';
      end if;
      if new.group_id is null and not private.is_approved_seller() then
        raise exception 'Seller access must be approved before creating products.' using errcode = '42501';
      end if;
      if new.group_id is not null and not private.can_manage_group_products(new.group_id) then
        raise exception 'Approved group product permission required.' using errcode = '42501';
      end if;
    end if;
    if new.status = 'sold' then
      new.stock_quantity := 0;
      new.availability := 'sold_out';
    elsif new.availability <> 'unavailable' then
      if not new.made_to_order and new.stock_quantity = 0 then
        new.availability := 'sold_out';
      else
        new.availability := 'available';
      end if;
    end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id
     or new.seller_id <> old.seller_id
     or new.group_id is distinct from old.group_id
     or new.created_at <> old.created_at
     or new.created_by_admin is distinct from old.created_by_admin then
    raise exception 'Listing identity cannot be changed.' using errcode = '42501';
  end if;

  substantive := row(
    new.title, new.description, new.price, new.category_id, new.condition,
    new.project_name, new.materials, new.dimensions, new.production_method, new.learning_area, new.made_to_order
  ) is distinct from row(
    old.title, old.description, old.price, old.category_id, old.condition,
    old.project_name, old.materials, old.dimensions, old.production_method, old.learning_area, old.made_to_order
  );

  if auth.uid() is null and current_user not in ('authenticated', 'anon') then
    new.updated_at := now();
    return new;
  end if;

  if not private.is_approved() then
    raise exception 'Approved membership required.' using errcode = '42501';
  end if;

  -- Privileged security-definer RPCs (moderation and atomic purchase fulfillment)
  if current_user not in ('authenticated', 'anon') then
    if private.is_admin() and not substantive and new.status in ('active', 'removed') and new.status <> old.status then
      if not ((old.status = 'pending_review' and new.status = 'active')
         or (old.status in ('draft', 'pending_review', 'active', 'sold') and new.status = 'removed')) then
        raise exception 'Invalid moderation transition.' using errcode = '23514';
      end if;
      new.updated_at := now();
      return new;
    end if;
    if not substantive and new.status = old.status then
      new.updated_at := now();
      return new;
    end if;
  end if;

  if (old.group_id is null and (not private.is_approved_seller() or old.seller_id <> auth.uid()))
     or (old.group_id is not null and not private.can_manage_group_products(old.group_id)) then
    raise exception 'Only an authorized seller may edit this product.' using errcode = '42501';
  end if;

  if old.status in ('removed', 'sold') then
    raise exception 'This listing can no longer be edited.' using errcode = '23514';
  end if;

  if substantive and old.status = 'active' and new.status <> 'draft' then
    new.status := 'pending_review';
  end if;

  if not ((old.status = 'draft' and new.status in ('draft', 'pending_review'))
    or (old.status = 'pending_review' and new.status in ('draft', 'pending_review'))
    or (old.status = 'active' and new.status in ('draft', 'active', 'pending_review', 'sold'))) then
    raise exception 'Invalid listing transition.' using errcode = '23514';
  end if;

  if new.status = 'sold' then
    new.stock_quantity := 0;
    new.availability := 'sold_out';
  elsif new.availability <> 'unavailable' then
    if not new.made_to_order and new.stock_quantity = 0 then
      new.availability := 'sold_out';
    else
      new.availability := 'available';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.guard_listing_image() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  listing_record public.listings;
  image_record public.listing_images;
begin
  if tg_op = 'DELETE' then image_record := old; else image_record := new; end if;
  select * into listing_record from public.listings where id = image_record.listing_id for update;
  if not found and tg_op = 'DELETE' then return old; end if;

  if not (
    (listing_record.group_id is null and private.is_approved_seller() and listing_record.seller_id = auth.uid())
    or (listing_record.group_id is not null and private.can_manage_group_products(listing_record.group_id))
    or private.is_admin()
  ) or listing_record.status not in ('draft', 'pending_review', 'active') then
    raise exception 'Only an authorized seller may change product images.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if (
      image_record.storage_path !~ ('^' || listing_record.seller_id::text || '/' || listing_record.id::text || '/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$')
      and image_record.storage_path !~ ('^' || auth.uid()::text || '/' || listing_record.id::text || '/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$')
    ) or not exists (
      select 1 from storage.objects where bucket_id = 'listing-images' and name = image_record.storage_path
    ) then
      raise exception 'Image must be a verified upload owned by this listing.' using errcode = '23514';
    end if;
  end if;

  if listing_record.status = 'active' and not (listing_record.created_by_admin is not null and private.is_admin()) then
    update public.listings set status = 'pending_review' where id = listing_record.id;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- 5. Safe Purchase Requests
create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.seller_groups(id) on delete set null,
  quantity integer not null check (quantity between 1 and 500),
  note text check (note is null or char_length(btrim(note)) <= 500),
  status public.purchase_request_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid references public.profiles(id) on delete set null,
  check ((status = 'fulfilled' and fulfilled_at is not null) or (status <> 'fulfilled' and fulfilled_at is null))
);

create index purchase_requests_buyer_idx on public.purchase_requests(buyer_id, created_at desc);
create index purchase_requests_seller_idx on public.purchase_requests(seller_id, status, created_at desc);
create index purchase_requests_group_idx on public.purchase_requests(group_id, status, created_at desc);
create index purchase_requests_listing_idx on public.purchase_requests(listing_id, status);

-- 6. Extend moderation_events target types
alter table public.moderation_events drop constraint if exists moderation_events_target_type_check;
alter table public.moderation_events add constraint moderation_events_target_type_check
  check (target_type in ('profile', 'listing', 'report', 'group', 'group_member', 'purchase_request'));

-- 7. Enable RLS & define policies for new tables
alter table public.seller_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.purchase_requests enable row level security;

revoke all on public.seller_groups, public.group_members, public.purchase_requests from anon, authenticated;
grant select on public.seller_groups, public.group_members, public.purchase_requests to authenticated;

create policy seller_groups_read on public.seller_groups for select to authenticated
  using (
    private.is_approved() and (
      verification_status = 'approved'
      or created_by = auth.uid()
      or private.has_group_relation(id)
      or private.is_admin()
    )
  );

create policy group_members_read on public.group_members for select to authenticated
  using (
    private.is_approved() and (
      user_id = auth.uid()
      or private.is_group_member(group_id)
      or (status = 'approved' and private.is_approved_group(group_id))
      or private.is_admin()
    )
  );

create policy purchase_requests_read on public.purchase_requests for select to authenticated
  using (
    private.is_approved() and (
      buyer_id = auth.uid()
      or (group_id is null and seller_id = auth.uid())
      or (group_id is not null and private.is_group_member(group_id))
      or private.is_admin()
    )
  );

-- 8. Extend consume_rate_limit with group_write and purchase_request caps
create or replace function public.consume_rate_limit(action_key text, max_requests integer, window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  cap integer;
  requested_count integer;
  boundary timestamptz;
  seconds integer;
begin
  if not private.is_approved() and not (action_key = 'profile_update' and exists(
    select 1 from public.profiles where id = auth.uid() and verification_status = 'pending'
  )) then return false; end if;

  cap := case action_key
    when 'listing_write' then 20
    when 'saved_toggle' then 60
    when 'report' then 5
    when 'profile_update' then 10
    when 'moderation' then 30
    when 'upload' then 15
    when 'group_write' then 10
    when 'purchase_request' then 15
    else 0
  end;

  if cap = 0 or max_requests is null or max_requests < 1 or window_seconds is null or window_seconds < 1 then
    return false;
  end if;

  seconds := 60;
  cap := least(cap, max_requests);
  boundary := to_timestamp(floor(extract(epoch from now()) / seconds) * seconds);

  insert into private.rate_limits(user_id, action_key, window_start, request_count)
    values(auth.uid(), consume_rate_limit.action_key, boundary, 1)
    on conflict on constraint rate_limits_pkey do update
      set request_count = private.rate_limits.request_count + 1
    returning request_count into requested_count;

  delete from private.rate_limits where user_id = auth.uid() and window_start < now() - interval '2 minutes';
  return requested_count <= cap;
end;
$$;

-- 9. Update moderation & member lookup RPCs and add Group, Image Order, Admin Product & Purchase Request RPCs
create or replace function public.get_seller_names(ids uuid[]) returns table(id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name
  from public.profiles p
  where private.is_approved()
    and p.id = any(ids)
    and (
      p.id = auth.uid()
      or private.is_admin()
      or exists (select 1 from public.listings l where l.seller_id = p.id and private.can_read_listing(l.id))
      or exists (
        select 1 from public.group_members m
        join public.seller_groups g on g.id = m.group_id
        where m.user_id = p.id
          and (g.verification_status = 'approved' or private.is_group_member(g.id))
      )
      or exists (
        select 1 from public.purchase_requests r
        where (r.buyer_id = p.id or r.seller_id = p.id)
          and (r.buyer_id = auth.uid() or r.seller_id = auth.uid() or (r.group_id is not null and private.is_group_member(r.group_id)))
      )
    );
$$;

create or replace function public.find_school_members(search_term text default '') returns table(id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where private.is_approved()
    and p.verification_status = 'approved'
    and u.email_confirmed_at is not null
    and (
      char_length(btrim(coalesce(search_term, ''))) = 0
      or p.display_name ilike ('%' || left(btrim(search_term), 60) || '%')
    )
  order by p.display_name asc
  limit 25;
$$;

create or replace function public.moderate_user(target_id uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  old_status public.verification_state;
  target_seller_type text;
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation', 30, 60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;
  if target_id = auth.uid() then raise exception 'Administrators cannot moderate their own account.' using errcode = '42501'; end if;
  if new_status not in ('approved', 'rejected', 'suspended') then raise exception 'Invalid account status.' using errcode = '23514'; end if;

  select verification_status, seller_type into old_status, target_seller_type
  from public.profiles where id = target_id and role = 'student' for update;
  if not found then raise exception 'Student account not found.' using errcode = 'P0002'; end if;
  if old_status::text = new_status then raise exception 'Account already has this status.' using errcode = '23514'; end if;

  if new_status = 'approved' and not exists(select 1 from auth.users where id = target_id and email_confirmed_at is not null) then
    raise exception 'Email must be verified before school approval.' using errcode = '23514';
  end if;

  update public.profiles
  set verification_status = new_status::public.verification_state,
      seller_approved = case
        when new_status <> 'approved' then false
        when target_seller_type in ('individual', 'group') then true
        else seller_approved
      end
  where id = target_id;

  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(auth.uid(), 'profile', target_id, old_status::text || ' -> ' || new_status);
end;
$$;

create or replace function public.set_seller_access(target_id uuid, approved boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_profile public.profiles;
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation', 30, 60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;

  select * into target_profile from public.profiles where id = target_id for update;
  if not found then raise exception 'Account not found.' using errcode = 'P0002'; end if;

  if approved and (
    target_profile.verification_status <> 'approved'
    or not exists (select 1 from auth.users where id = target_id and email_confirmed_at is not null)
  ) then
    raise exception 'Approve the student membership and verify email before enabling seller access.' using errcode = '23514';
  end if;

  update public.profiles
  set seller_approved = approved,
      seller_type = case when approved and seller_type = 'none' then 'individual' else seller_type end
  where id = target_id;

  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(auth.uid(), 'profile', target_id, case when approved then 'seller access granted' else 'seller access revoked' end);
end;
$$;

create or replace function public.moderate_listing(target_id uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  old_status public.listing_state;
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation', 30, 60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;
  if new_status not in ('active', 'removed') then raise exception 'Invalid moderation status.' using errcode = '23514'; end if;

  select status into old_status from public.listings where id = target_id for update;
  if not found then raise exception 'Listing not found.' using errcode = 'P0002'; end if;

  if new_status = 'active' and not exists(
    select 1 from public.listings l
    join public.profiles p on l.seller_id = p.id
    left join public.seller_groups g on l.group_id = g.id
    where l.id = target_id
      and p.verification_status = 'approved'
      and (
        (l.group_id is null and (p.seller_approved = true or p.role = 'admin'))
        or (l.group_id is not null and g.verification_status = 'approved')
      )
  ) then
    raise exception 'Seller and project group must be approved before publishing.' using errcode = '23514';
  end if;

  update public.listings set status = new_status::public.listing_state where id = target_id;
  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(auth.uid(), 'listing', target_id, old_status::text || ' -> ' || new_status);
end;
$$;

create or replace function public.create_seller_group(
  group_name text,
  group_slug text,
  description text,
  area text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  created_group_id uuid;
begin
  if not private.is_approved() then raise exception 'Approved school membership required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('group_write', 10, 60) then raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001'; end if;

  insert into public.seller_groups(name, slug, project_description, learning_area, created_by, verification_status)
  values (btrim(group_name), btrim(group_slug), btrim(description), nullif(btrim(coalesce(area, '')), ''), auth.uid(), 'pending')
  returning id into created_group_id;

  insert into public.group_members(group_id, user_id, member_role, can_manage_products, status, invited_by)
  values (created_group_id, auth.uid(), 'owner', true, 'approved', auth.uid());

  update public.profiles
  set seller_type = case when seller_type = 'none' then 'group' else seller_type end
  where id = auth.uid();

  return created_group_id;
end;
$$;

create or replace function public.update_seller_group(
  target_group_id uuid,
  group_name text,
  description text,
  area text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_group_owner(target_group_id) and not private.is_admin() then
    raise exception 'Only the group owner may update group details.' using errcode = '42501';
  end if;
  if not public.consume_rate_limit('group_write', 10, 60) then
    raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001';
  end if;

  update public.seller_groups
  set name = btrim(group_name),
      project_description = btrim(description),
      learning_area = nullif(btrim(coalesce(area, '')), ''),
      updated_at = now()
  where id = target_group_id and verification_status <> 'removed';

  if not found then raise exception 'Group not found or unavailable.' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.invite_group_member(
  target_group_id uuid,
  target_user_id uuid,
  allow_products boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_group_owner(target_group_id) and not private.is_admin() then
    raise exception 'Only the group owner or an administrator may invite members.' using errcode = '42501';
  end if;
  if not public.consume_rate_limit('group_write', 10, 60) then
    raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You are already in this group.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = target_user_id and p.verification_status = 'approved' and u.email_confirmed_at is not null
  ) then
    raise exception 'Only approved school members with verified emails can be invited.' using errcode = '23514';
  end if;

  insert into public.group_members(group_id, user_id, member_role, can_manage_products, status, invited_by)
  values (target_group_id, target_user_id, 'member', coalesce(allow_products, false), 'invited', auth.uid())
  on conflict (group_id, user_id) do update
    set status = case when public.group_members.status = 'approved' then 'approved'::public.membership_state else 'invited'::public.membership_state end,
        can_manage_products = coalesce(allow_products, public.group_members.can_manage_products),
        invited_by = auth.uid(),
        updated_at = now()
    where public.group_members.member_role <> 'owner';
end;
$$;

create or replace function public.request_group_membership(target_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_approved() then raise exception 'Approved school membership required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('group_write', 10, 60) then raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001'; end if;

  if not exists (select 1 from public.seller_groups where id = target_group_id and verification_status in ('pending', 'approved')) then
    raise exception 'Project group not found.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.group_members where group_id = target_group_id and user_id = auth.uid() and status in ('approved', 'invited', 'requested')) then
    raise exception 'You already have an active or pending membership for this group.' using errcode = '23514';
  end if;

  insert into public.group_members(group_id, user_id, member_role, can_manage_products, status, invited_by)
  values (target_group_id, auth.uid(), 'member', false, 'requested', null)
  on conflict (group_id, user_id) do update
    set status = 'requested',
        can_manage_products = false,
        invited_by = null,
        updated_at = now()
    where public.group_members.member_role <> 'owner';
end;
$$;

create or replace function public.respond_group_invite(target_group_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_approved() then raise exception 'Approved school membership required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('group_write', 10, 60) then raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001'; end if;

  update public.group_members
  set status = case when accept then 'approved'::public.membership_state else 'removed'::public.membership_state end,
      updated_at = now()
  where group_id = target_group_id
    and user_id = auth.uid()
    and status = 'invited';

  if not found then
    raise exception 'No pending group invitation found. Membership requests require owner or administrator approval.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.manage_group_member(
  target_group_id uuid,
  target_user_id uuid,
  new_status text,
  allow_products boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_member public.group_members;
begin
  if not private.is_group_owner(target_group_id) and not private.is_admin() then
    raise exception 'Only the group owner or an administrator may manage members.' using errcode = '42501';
  end if;
  if not public.consume_rate_limit('group_write', 10, 60) then
    raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001';
  end if;
  if new_status not in ('approved', 'removed') then
    raise exception 'Invalid membership status.' using errcode = '23514';
  end if;

  select * into target_member from public.group_members
  where group_id = target_group_id and user_id = target_user_id for update;
  if not found then raise exception 'Group member record not found.' using errcode = 'P0002'; end if;

  if target_member.member_role = 'owner' then
    raise exception 'The group creator role cannot be removed or modified here.' using errcode = '42501';
  end if;

  -- A requester can never self-approve because they are not the group owner or admin.
  update public.group_members
  set status = new_status::public.membership_state,
      can_manage_products = case when new_status = 'approved' then coalesce(allow_products, false) else false end,
      updated_at = now()
  where group_id = target_group_id and user_id = target_user_id;

  if private.is_admin() then
    insert into public.moderation_events(actor_id, target_type, target_id, action)
      values(auth.uid(), 'group_member', target_group_id, 'member ' || left(target_user_id::text, 8) || ' -> ' || new_status);
  end if;
end;
$$;

create or replace function public.moderate_group(target_id uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  old_group public.seller_groups;
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation', 30, 60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;
  if new_status not in ('approved', 'rejected', 'removed') then raise exception 'Invalid group status.' using errcode = '23514'; end if;

  select * into old_group from public.seller_groups where id = target_id for update;
  if not found then raise exception 'Project group not found.' using errcode = 'P0002'; end if;

  if new_status = 'approved' and not exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = old_group.created_by and p.verification_status = 'approved' and u.email_confirmed_at is not null
  ) then
    raise exception 'Group creator must have a verified email and approved school account.' using errcode = '23514';
  end if;

  update public.seller_groups
  set verification_status = new_status::public.group_state,
      updated_at = now()
  where id = target_id;

  if new_status = 'approved' then
    update public.profiles set seller_approved = true where id = old_group.created_by and verification_status = 'approved';
  end if;

  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(auth.uid(), 'group', target_id, old_group.verification_status::text || ' -> ' || new_status);
end;
$$;

create or replace function public.set_primary_listing_image(target_listing_id uuid, target_image_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_listing(target_listing_id) and not private.is_admin() then
    raise exception 'Only an authorized seller may reorder product images.' using errcode = '42501';
  end if;
  if not public.consume_rate_limit('listing_write', 20, 60) then
    raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.listing_images where id = target_image_id and listing_id = target_listing_id) then
    raise exception 'Image not found for this product.' using errcode = 'P0002';
  end if;

  set constraints public.listing_images_listing_id_display_order_key deferred;

  with ordered as (
    select id,
           (row_number() over (order by case when id = target_image_id then 0 else 1 end, display_order asc) - 1)::smallint as next_order
    from public.listing_images
    where listing_id = target_listing_id
  )
  update public.listing_images i
  set display_order = ordered.next_order
  from ordered
  where i.id = ordered.id;
end;
$$;

create or replace function public.admin_create_product(
  owner_id uuid,
  target_group_id uuid,
  product_title text,
  product_description text,
  product_price numeric,
  product_category_id uuid,
  product_stock integer,
  product_project_name text default null,
  product_materials text default null,
  product_dimensions text default null,
  product_method text default null,
  product_learning_area text default null,
  product_made_to_order boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  created_id uuid;
begin
  if not private.is_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('moderation', 30, 60) then raise exception 'Please wait before moderating again.' using errcode = 'P0001'; end if;

  if not exists (select 1 from public.profiles where id = owner_id and verification_status = 'approved') then
    raise exception 'Attributed student or staff member must be an approved profile.' using errcode = '23514';
  end if;

  if target_group_id is not null and not exists (
    select 1 from public.seller_groups where id = target_group_id and verification_status = 'approved'
  ) then
    raise exception 'Attributed project group must be approved.' using errcode = '23514';
  end if;

  insert into public.listings(
    seller_id, group_id, title, description, price, category_id, condition, status,
    stock_quantity, availability, project_name, materials, dimensions, production_method,
    learning_area, made_to_order, created_by_admin
  ) values (
    owner_id,
    target_group_id,
    btrim(product_title),
    btrim(product_description),
    product_price,
    product_category_id,
    'New',
    'active',
    product_stock,
    case when not coalesce(product_made_to_order, false) and product_stock = 0 then 'sold_out' else 'available' end,
    nullif(btrim(coalesce(product_project_name, '')), ''),
    nullif(btrim(coalesce(product_materials, '')), ''),
    nullif(btrim(coalesce(product_dimensions, '')), ''),
    nullif(btrim(coalesce(product_method, '')), ''),
    nullif(btrim(coalesce(product_learning_area, '')), ''),
    coalesce(product_made_to_order, false),
    auth.uid()
  ) returning id into created_id;

  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(auth.uid(), 'listing', created_id, 'admin published verified product');

  return created_id;
end;
$$;

create or replace function public.submit_purchase_request(
  target_listing_id uuid,
  requested_qty integer,
  buyer_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  item public.listings;
  created_request_id uuid;
begin
  if not private.is_approved() then raise exception 'Approved school membership required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('purchase_request', 15, 60) then raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001'; end if;
  if requested_qty is null or requested_qty < 1 or requested_qty > 500 then
    raise exception 'Choose a valid quantity.' using errcode = '23514';
  end if;

  select * into item from public.listings where id = target_listing_id;
  if not found or not private.can_read_listing(target_listing_id) then
    raise exception 'Product is not available.' using errcode = 'P0002';
  end if;

  if item.status <> 'active' or item.availability <> 'available' then
    raise exception 'This product is not currently open for purchase requests.' using errcode = '23514';
  end if;

  if item.seller_id = auth.uid() or (item.group_id is not null and private.is_group_member(item.group_id)) then
    raise exception 'Sellers cannot submit purchase requests for their own products.' using errcode = '23514';
  end if;

  if not item.made_to_order and requested_qty > item.stock_quantity then
    raise exception 'Requested quantity exceeds available stock.' using errcode = '23514';
  end if;

  -- Stock is intentionally NOT deducted until fulfillment is confirmed.
  insert into public.purchase_requests(buyer_id, listing_id, seller_id, group_id, quantity, note, status)
  values (auth.uid(), item.id, item.seller_id, item.group_id, requested_qty, nullif(btrim(coalesce(buyer_note, '')), ''), 'pending')
  returning id into created_request_id;

  return created_request_id;
end;
$$;

create or replace function public.update_purchase_request_status(
  target_request_id uuid,
  new_status text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  req public.purchase_requests;
  item public.listings;
  can_manage boolean;
begin
  if not private.is_approved() then raise exception 'Approved school membership required.' using errcode = '42501'; end if;
  if not public.consume_rate_limit('purchase_request', 15, 60) then raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001'; end if;
  if new_status not in ('accepted', 'declined', 'fulfilled', 'cancelled') then
    raise exception 'Invalid request status.' using errcode = '23514';
  end if;

  select * into req from public.purchase_requests where id = target_request_id for update;
  if not found then raise exception 'Purchase request not found.' using errcode = 'P0002'; end if;

  if req.status in ('declined', 'fulfilled', 'cancelled') then
    raise exception 'This purchase request has already been finalized.' using errcode = '23514';
  end if;

  if new_status = 'cancelled' then
    if req.buyer_id <> auth.uid() and not private.is_admin() then
      raise exception 'Only the buyer may cancel this purchase request.' using errcode = '42501';
    end if;
    update public.purchase_requests
    set status = 'cancelled', updated_at = now()
    where id = target_request_id;
    return;
  end if;

  can_manage := private.is_admin()
    or (req.group_id is null and private.is_approved_seller() and req.seller_id = auth.uid())
    or (req.group_id is not null and private.can_manage_group_products(req.group_id));

  if not can_manage then
    raise exception 'Only the authorized seller or an administrator may update this request.' using errcode = '42501';
  end if;

  if new_status = 'accepted' and req.status <> 'pending' then
    raise exception 'Only a pending request can be accepted.' using errcode = '23514';
  end if;

  if new_status = 'fulfilled' then
    select * into item from public.listings where id = req.listing_id for update;
    if not found or item.status <> 'active' then
      raise exception 'Product must be active to fulfill a purchase request.' using errcode = '23514';
    end if;
    if not item.made_to_order then
      if item.stock_quantity < req.quantity then
        raise exception 'Insufficient stock available to fulfill this request.' using errcode = '23514';
      end if;
      update public.listings
      set stock_quantity = item.stock_quantity - req.quantity,
          availability = case
            when item.stock_quantity - req.quantity = 0 and item.availability <> 'unavailable' then 'sold_out'
            else item.availability
          end
      where id = item.id;
    end if;
    update public.purchase_requests
    set status = 'fulfilled',
        fulfilled_at = now(),
        fulfilled_by = auth.uid(),
        updated_at = now()
    where id = target_request_id;
  else
    update public.purchase_requests
    set status = new_status::public.purchase_request_state,
        updated_at = now()
    where id = target_request_id;
  end if;

  if private.is_admin() then
    insert into public.moderation_events(actor_id, target_type, target_id, action)
      values(auth.uid(), 'purchase_request', target_request_id, req.status::text || ' -> ' || new_status);
  end if;
end;
$$;

-- 10. Function execution privileges
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_approved(),
  private.is_approved_user(uuid),
  private.is_admin(),
  private.is_approved_seller(),
  private.is_group_member(uuid),
  private.is_group_owner(uuid),
  private.can_manage_group_products(uuid),
  private.has_group_relation(uuid),
  private.is_approved_group(uuid),
  private.can_edit_listing(uuid),
  private.can_read_listing(uuid),
  private.can_read_image(text)
to authenticated;

revoke all on function
  public.get_seller_names(uuid[]),
  public.find_school_members(text),
  public.moderate_user(uuid, text),
  public.set_seller_access(uuid, boolean),
  public.moderate_listing(uuid, text),
  public.resolve_report(uuid, text),
  public.consume_rate_limit(text, integer, integer),
  public.create_seller_group(text, text, text, text),
  public.update_seller_group(uuid, text, text, text),
  public.invite_group_member(uuid, uuid, boolean),
  public.request_group_membership(uuid),
  public.respond_group_invite(uuid, boolean),
  public.manage_group_member(uuid, uuid, text, boolean),
  public.moderate_group(uuid, text),
  public.set_primary_listing_image(uuid, uuid),
  public.admin_create_product(uuid, uuid, text, text, numeric, uuid, integer, text, text, text, text, text, boolean),
  public.submit_purchase_request(uuid, integer, text),
  public.update_purchase_request_status(uuid, text)
from public, anon;

grant execute on function
  public.get_seller_names(uuid[]),
  public.find_school_members(text),
  public.moderate_user(uuid, text),
  public.set_seller_access(uuid, boolean),
  public.moderate_listing(uuid, text),
  public.resolve_report(uuid, text),
  public.consume_rate_limit(text, integer, integer),
  public.create_seller_group(text, text, text, text),
  public.update_seller_group(uuid, text, text, text),
  public.invite_group_member(uuid, uuid, boolean),
  public.request_group_membership(uuid),
  public.respond_group_invite(uuid, boolean),
  public.manage_group_member(uuid, uuid, text, boolean),
  public.moderate_group(uuid, text),
  public.set_primary_listing_image(uuid, uuid),
  public.admin_create_product(uuid, uuid, text, text, numeric, uuid, integer, text, text, text, text, text, boolean),
  public.submit_purchase_request(uuid, integer, text),
  public.update_purchase_request_status(uuid, text)
to authenticated;

commit;
