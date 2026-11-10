-- CampusMarket security corrections. Review and apply AFTER migrations 001 and 002.
-- No rows are deleted, no credentials are required, and existing applied migrations
-- remain unchanged. This migration replaces authorization policies/functions only.
begin;

-- A seller must remain school-approved and email-verified at the time of access.
-- Individual seller approval and explicit group product authority are separate.
create or replace function private.is_approved_user(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = uid and p.verification_status = 'approved' and u.email_confirmed_at is not null);
$$;

create function private.listing_seller_is_eligible(seller_uuid uuid, group_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_approved_user(seller_uuid) and exists (
    select 1 from public.profiles p where p.id = seller_uuid and (
      (group_uuid is null and (p.seller_approved or p.role = 'admin'))
      or (group_uuid is not null and private.is_approved_group(group_uuid))
    )
  );
$$;

-- Administrative image assistance is restricted to the administrator who authored
-- the attributed product. Other products still require owner/group authority.
create function private.can_edit_listing_images(listing_uuid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_listing(listing_uuid) or (private.is_admin() and exists(
    select 1 from public.listings where id = listing_uuid and created_by_admin = auth.uid()
  ));
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
        and private.listing_seller_is_eligible(l.seller_id, l.group_id)
      )
    )
  );
$$;

drop policy listings_member_read on public.listings;
create policy listings_member_read on public.listings for select to authenticated
  using (
    private.is_approved() and (
      seller_id = auth.uid()
      or (group_id is not null and private.is_group_member(group_id))
      or private.is_admin()
      or (
        status in ('active', 'sold')
        and private.listing_seller_is_eligible(seller_id, group_id)
      )
    )
  );
drop policy images_seller_insert on public.listing_images;
drop policy images_seller_delete on public.listing_images;
create policy images_seller_insert on public.listing_images for insert to authenticated
  with check (private.can_edit_listing_images(listing_id));
create policy images_seller_delete on public.listing_images for delete to authenticated
  using (private.can_edit_listing_images(listing_id));

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
    if private.is_admin() and old.created_by_admin = auth.uid() and not substantive
       and old.status = 'active' and new.status = 'pending_review' then
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
    or (private.is_admin() and listing_record.created_by_admin = auth.uid())
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

  if listing_record.status = 'active' then
    update public.listings set status = 'pending_review' where id = listing_record.id;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Updating previously reviewed public group text withdraws the group until review.
create or replace function public.update_seller_group(
  target_group_id uuid, group_name text, description text, area text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  old_group public.seller_groups;
  substantive boolean;
begin
  if not private.is_group_owner(target_group_id) and not private.is_admin() then
    raise exception 'Only the group owner may update group details.' using errcode = '42501';
  end if;
  if not public.consume_rate_limit('group_write', 10, 60) then
    raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001';
  end if;
  select * into old_group from public.seller_groups where id = target_group_id for update;
  if not found or old_group.verification_status = 'removed' then
    raise exception 'Group not found or unavailable.' using errcode = 'P0002';
  end if;
  substantive := row(old_group.name, old_group.project_description, old_group.learning_area)
    is distinct from row(btrim(group_name), btrim(description), nullif(btrim(coalesce(area, '')), ''));
  update public.seller_groups set name = btrim(group_name), project_description = btrim(description),
    learning_area = nullif(btrim(coalesce(area, '')), ''),
    verification_status = case when substantive and old_group.verification_status in ('approved','rejected')
      then 'pending'::public.group_state else old_group.verification_status end,
    updated_at = now() where id = target_group_id;
  if substantive then
    insert into public.moderation_events(actor_id,target_type,target_id,action)
      values(auth.uid(),'group',target_group_id,'group details updated; renewed review required');
  end if;
end;
$$;

create or replace function public.set_primary_listing_image(target_listing_id uuid, target_image_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.listings;
begin
  if not private.can_edit_listing_images(target_listing_id) then
    raise exception 'Only an authorized seller may reorder product images.' using errcode = '42501';
  end if;
  if not public.consume_rate_limit('listing_write', 20, 60) then
    raise exception 'Too many requests. Please wait a minute.' using errcode = 'P0001';
  end if;

  select * into item from public.listings where id = target_listing_id for update;
  if not found or item.status not in ('draft','pending_review','active') then
    raise exception 'This listing can no longer be edited.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.listing_images where id = target_image_id and listing_id = target_listing_id) then
    raise exception 'Image not found for this product.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.listing_images where id = target_image_id and display_order = 0) then return; end if;
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
  if item.status = 'active' then
    update public.listings set status = 'pending_review' where id = target_listing_id;
  end if;
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

  if new_status = 'active' and not exists (
    select 1 from public.listings l where l.id = target_id
      and private.listing_seller_is_eligible(l.seller_id, l.group_id)
  ) then
    raise exception 'Seller and project group must be approved before publishing.' using errcode = '23514';
  end if;

  update public.listings set status = new_status::public.listing_state where id = target_id;
  insert into public.moderation_events(actor_id, target_type, target_id, action)
    values(auth.uid(), 'listing', target_id, old_status::text || ' -> ' || new_status);
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

  if not private.listing_seller_is_eligible(owner_id, target_group_id) then
    raise exception 'Attributed seller must have verified email and current seller or group approval.' using errcode = '23514';
  end if;
  if target_group_id is not null and not exists (
    select 1 from public.group_members where group_id = target_group_id and user_id = owner_id and status = 'approved'
  ) then
    raise exception 'Attributed seller must be an approved member of this project group.' using errcode = '23514';
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

  select * into item from public.listings where id = target_listing_id for share;
  if not found or not private.can_read_listing(target_listing_id)
    or not private.listing_seller_is_eligible(item.seller_id, item.group_id) then
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
    if private.is_admin() then
      insert into public.moderation_events(actor_id,target_type,target_id,action)
        values(auth.uid(),'purchase_request',target_request_id,req.status::text || ' -> cancelled');
    end if;
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

  -- An administrator's broad read access is not permission to transact on withdrawn
  -- inventory. Recheck both participants and group approval at acceptance/fulfillment.
  if new_status in ('accepted','fulfilled') then
    select * into item from public.listings where id = req.listing_id for update;
    if not found or item.status <> 'active' or item.availability <> 'available'
      or not private.is_approved_user(req.buyer_id)
      or not private.listing_seller_is_eligible(item.seller_id, item.group_id) then
      raise exception 'Buyer, seller, group and product must remain approved and available.' using errcode = '23514';
    end if;
  end if;

  if new_status = 'fulfilled' then
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

revoke all on function private.listing_seller_is_eligible(uuid,uuid), private.can_edit_listing_images(uuid) from public,anon,authenticated;
grant execute on function private.listing_seller_is_eligible(uuid,uuid), private.can_edit_listing_images(uuid) to authenticated;
-- Replaced functions retain the explicit execution grants/revocations from 001/002.
commit;
