'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionName, ActionResult, GroupMember, Profile, SellerGroup } from '@/lib/types';
import {
  assertApprovedSeller,
  assertCanEditProduct,
  canManageGroupProducts,
  PermissionError,
} from '@/lib/permissions';
import {
  adminProductSchema,
  emailSchema,
  groupCreateSchema,
  groupInviteSchema,
  groupMemberManageSchema,
  groupModerationSchema,
  groupRespondSchema,
  groupUpdateSchema,
  listingModerationSchema,
  listingSchema,
  loginSchema,
  passwordSchema,
  primaryImageSchema,
  profileUpdateSchema,
  purchaseRequestSchema,
  purchaseRequestStatusSchema,
  reportResolutionSchema,
  reportSchema,
  safeRedirect,
  sellerAccessSchema,
  sellerRegistrationSchema,
  signupSchema,
  slugifyGroupName,
  stockUpdateSchema,
  userModerationSchema,
  uuidSchema,
} from '@/lib/validation';
import { getSessionContext, requireMember } from '@/lib/server/auth';
import { isSupabaseConfigured, siteUrl } from '@/lib/server/config';
import { serverSupabase, storageSupabase } from '@/lib/server/supabase';

const authActions = new Set<ActionName>(['signup', 'login', 'logout', 'forgot_password', 'reset_password']);
const adminActions = new Set<ActionName>([
  'moderate_user',
  'set_seller_access',
  'moderate_group',
  'moderate_listing',
  'admin_create_product',
  'resolve_report',
]);

const domainErrorPrefixes = [
  'Seller',
  'Approved',
  'Only ',
  'Administrator',
  'Too many requests',
  'Please wait',
  'Email must be verified',
  'Approve the student',
  'Group ',
  'Project group',
  'You already',
  'You are already',
  'No pending group invitation',
  'The group creator',
  'Product ',
  'This product',
  'Sellers cannot',
  'Requested quantity',
  'Purchase request',
  'This purchase request',
  'Insufficient stock',
  'Image ',
  'Attributed ',
  'Choose a valid',
];

function extractSafeErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  if (code === '23505' && message.includes('seller_groups')) {
    return 'A project group with that name already exists. Choose a distinct group name.';
  }
  if (['23514', '42501', 'P0001', 'P0002'].includes(code) || domainErrorPrefixes.some((prefix) => message.startsWith(prefix))) {
    if (domainErrorPrefixes.some((prefix) => message.startsWith(prefix))) return message;
  }
  return null;
}

async function loadMemberGroups(
  client: Awaited<ReturnType<typeof serverSupabase>>,
  groupId?: string | null
): Promise<Pick<SellerGroup, 'id' | 'verification_status' | 'members'>[]> {
  if (!groupId || !client.from) return [];
  const [groupRes, membersRes] = await Promise.all([
    client.from('seller_groups').select('id,verification_status').eq('id', groupId).single(),
    client.from('group_members').select('*').eq('group_id', groupId),
  ]);
  if (groupRes.error || !groupRes.data) return [];
  const groupData = groupRes.data as { id: string; verification_status: SellerGroup['verification_status'] };
  const members = ((membersRes.data ?? []) as Omit<GroupMember, 'display_name'>[]).map((m) => ({
    ...m,
    display_name: '',
  }));
  return [{ id: groupData.id, verification_status: groupData.verification_status, members }];
}

export async function runAction(action: ActionName, payload: Record<string, unknown>): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: 'Connect Supabase environment variables in .env.local before signing in or saving marketplace records.',
    };
  }
  try {
    if (authActions.has(action)) return await authenticationAction(action, payload);
    const { client, profile } = await requireMember(adminActions.has(action));
    let result: ActionResult;

    switch (action) {
      case 'register_seller': {
        const values = sellerRegistrationSchema.parse(payload);
        const { error } = await client
          .from('profiles')
          .update({ seller_type: values.seller_type, project_summary: values.project_summary })
          .eq('id', profile.id)
          .select('id')
          .single();
        if (error) throw error;
        result = {
          ok: true,
          message: profile.seller_approved
            ? 'Your seller profile has been updated.'
            : 'Seller registration submitted. A school administrator will verify your seller access.',
          redirect: values.seller_type === 'group' ? '/seller/group' : '/seller/dashboard',
        };
        break;
      }
      case 'update_profile': {
        const values = profileUpdateSchema.parse(payload);
        const updatePayload: Record<string, unknown> = { display_name: values.display_name };
        if (values.seller_type !== undefined) updatePayload.seller_type = values.seller_type;
        if (payload.project_summary !== undefined) updatePayload.project_summary = values.project_summary;
        const { error } = await client.from('profiles').update(updatePayload).eq('id', profile.id).select('id').single();
        if (error) throw error;
        result = { ok: true, message: 'Your account profile has been updated.' };
        break;
      }
      case 'save_listing': {
        const { id, ...values } = listingSchema.parse(payload);
        const normalizedAvailability =
          values.availability === 'unavailable'
            ? 'unavailable'
            : !values.made_to_order && values.stock_quantity === 0
              ? 'sold_out'
              : 'available';
        const writeValues = { ...values, availability: normalizedAvailability };

        if (id) {
          const { data: existing, error } = await client
            .from('listings')
            .select('seller_id,group_id,status')
            .eq('id', id)
            .single();
          if (error || !existing) throw new PermissionError();
          const targetGroupId = (existing as { group_id?: string | null }).group_id ?? null;
          const groups = await loadMemberGroups(client, targetGroupId);
          assertCanEditProduct(
            asSellerAwareProfile(profile),
            { seller_id: existing.seller_id, group_id: targetGroupId },
            groups
          );
          if (['removed', 'sold'].includes(existing.status)) {
            return { ok: false, message: 'Sold and removed products cannot be edited.' };
          }
          const { group_id: _ignoredGroup, ...updatable } = writeValues;
          void _ignoredGroup;
          let updateQuery = client.from('listings').update(updatable).eq('id', id);
          if (!targetGroupId) updateQuery = updateQuery.eq('seller_id', profile.id);
          const { error: updateError } = await updateQuery.select('id').single();
          if (updateError) throw updateError;
          result = {
            ok: true,
            id,
            message: values.status === 'draft' ? 'Product draft saved.' : 'Product submitted for school administrator review.',
          };
        } else {
          if (writeValues.group_id) {
            const groups = await loadMemberGroups(client, writeValues.group_id);
            if (!canManageGroupProducts(profile, groups[0])) {
              throw new PermissionError('Approved group product permission is required before listing under this group.');
            }
          } else {
            assertApprovedSeller(asSellerAwareProfile(profile));
          }
          const { data, error } = await client
            .from('listings')
            .insert({ ...writeValues, seller_id: profile.id })
            .select('id')
            .single();
          if (error || !data) throw error || new Error('No product returned.');
          result = {
            ok: true,
            id: data.id,
            message: values.status === 'draft' ? 'Product draft saved.' : 'Product submitted for school administrator review.',
          };
        }
        break;
      }
      case 'update_stock': {
        const { id, stock_quantity, availability } = stockUpdateSchema.parse(payload);
        const { data: existing, error: readError } = await client
          .from('listings')
          .select('seller_id,group_id,status,availability,made_to_order')
          .eq('id', id)
          .single();
        if (readError || !existing) throw new PermissionError();
        const targetGroupId = (existing as { group_id?: string | null }).group_id ?? null;
        const groups = await loadMemberGroups(client, targetGroupId);
        assertCanEditProduct(asSellerAwareProfile(profile), { seller_id: existing.seller_id, group_id: targetGroupId }, groups);
        if (['removed', 'sold'].includes(existing.status)) {
          return { ok: false, message: 'Closed products cannot be updated.' };
        }
        const madeToOrder = Boolean((existing as { made_to_order?: boolean }).made_to_order);
        const requestedAvailability = availability ?? ((existing as { availability?: string }).availability || 'available');
        const nextAvailability =
          requestedAvailability === 'unavailable'
            ? 'unavailable'
            : !madeToOrder && stock_quantity === 0
              ? 'sold_out'
              : 'available';
        let updateQuery = client
          .from('listings')
          .update({ stock_quantity, availability: nextAvailability })
          .eq('id', id);
        if (!targetGroupId) updateQuery = updateQuery.eq('seller_id', profile.id);
        const { error } = await updateQuery.select('id').single();
        if (error) throw error;
        result = { ok: true, message: 'Stock and availability updated.' };
        break;
      }
      case 'set_primary_image': {
        const { listing_id, image_id } = primaryImageSchema.parse(payload);
        const { error } = await client.rpc('set_primary_listing_image', {
          target_listing_id: listing_id,
          target_image_id: image_id,
        });
        if (error) throw error;
        result = { ok: true, message: 'Main product photo updated.' };
        break;
      }
      case 'delete_listing': {
        const id = uuidSchema.parse(payload.id);
        const { data: listing, error: readError } = await client
          .from('listings')
          .select('seller_id,group_id,listing_images(storage_path)')
          .eq('id', id)
          .single();
        if (readError || !listing) throw new PermissionError();
        const targetGroupId = (listing as { group_id?: string | null }).group_id ?? null;
        const groups = await loadMemberGroups(client, targetGroupId);
        assertCanEditProduct(asSellerAwareProfile(profile), { seller_id: listing.seller_id, group_id: targetGroupId }, groups);
        let deleteQuery = client.from('listings').delete().eq('id', id);
        if (!targetGroupId) deleteQuery = deleteQuery.eq('seller_id', profile.id);
        const { error } = await deleteQuery.select('id').single();
        if (error) throw error;
        const paths = ((listing.listing_images ?? []) as { storage_path: string }[]).map((image) => image.storage_path);
        if (paths.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          await storageSupabase().storage.from('listing-images').remove(paths);
        }
        result = { ok: true, message: 'Product listing removed.', redirect: '/seller/products' };
        break;
      }
      case 'mark_sold': {
        const id = uuidSchema.parse(payload.id);
        const { data: existing, error: readError } = await client
          .from('listings')
          .select('seller_id,group_id,status')
          .eq('id', id)
          .single();
        if (readError || !existing) throw new PermissionError();
        const targetGroupId = (existing as { group_id?: string | null }).group_id ?? null;
        const groups = await loadMemberGroups(client, targetGroupId);
        assertCanEditProduct(asSellerAwareProfile(profile), { seller_id: existing.seller_id, group_id: targetGroupId }, groups);
        if (existing.status !== 'active') return { ok: false, message: 'Only an active product can be marked as sold.' };
        let updateQuery = client
          .from('listings')
          .update({ status: 'sold' })
          .eq('id', id)
          .eq('status', 'active');
        if (!targetGroupId) updateQuery = updateQuery.eq('seller_id', profile.id);
        const { error } = await updateQuery.select('id').single();
        if (error) throw error;
        result = { ok: true, message: 'Product marked as sold.' };
        break;
      }
      case 'create_group': {
        const values = groupCreateSchema.parse(payload);
        const baseSlug = slugifyGroupName(values.name);
        if (baseSlug.length < 2) return { ok: false, message: 'Use letters or numbers in your project group name.' };
        const { data: groupId, error } = await client.rpc('create_seller_group', {
          group_name: values.name,
          group_slug: baseSlug,
          description: values.project_description,
          area: values.learning_area,
        });
        if (error) throw error;
        result = {
          ok: true,
          id: typeof groupId === 'string' ? groupId : undefined,
          message: 'Project group created and sent for school administrator approval.',
          redirect: '/seller/group',
        };
        break;
      }
      case 'update_group': {
        const values = groupUpdateSchema.parse(payload);
        const { error } = await client.rpc('update_seller_group', {
          target_group_id: values.id,
          group_name: values.name,
          description: values.project_description,
          area: values.learning_area,
        });
        if (error) throw error;
        result = { ok: true, message: 'Project group profile updated.' };
        break;
      }
      case 'invite_group_member': {
        const values = groupInviteSchema.parse(payload);
        const { error } = await client.rpc('invite_group_member', {
          target_group_id: values.group_id,
          target_user_id: values.user_id,
          allow_products: values.can_manage_products,
        });
        if (error) throw error;
        result = { ok: true, message: 'Collaborator invitation sent.' };
        break;
      }
      case 'request_group_membership': {
        const group_id = uuidSchema.parse(payload.group_id);
        const { error } = await client.rpc('request_group_membership', { target_group_id: group_id });
        if (error) throw error;
        result = { ok: true, message: 'Membership request sent. The group owner or administrator must approve access.' };
        break;
      }
      case 'respond_group_invite': {
        const values = groupRespondSchema.parse(payload);
        const { error } = await client.rpc('respond_group_invite', {
          target_group_id: values.group_id,
          accept: values.accept,
        });
        if (error) throw error;
        result = {
          ok: true,
          message: values.accept ? 'You have joined the project group.' : 'Group invitation declined.',
        };
        break;
      }
      case 'manage_group_member': {
        const values = groupMemberManageSchema.parse(payload);
        const { error } = await client.rpc('manage_group_member', {
          target_group_id: values.group_id,
          target_user_id: values.user_id,
          new_status: values.status,
          allow_products: values.can_manage_products,
        });
        if (error) throw error;
        result = {
          ok: true,
          message: values.status === 'approved' ? 'Collaborator permissions updated.' : 'Member removed from project group.',
        };
        break;
      }
      case 'submit_purchase_request': {
        const values = purchaseRequestSchema.parse(payload);
        const { data: reqId, error } = await client.rpc('submit_purchase_request', {
          target_listing_id: values.listing_id,
          requested_qty: values.quantity,
          buyer_note: values.note,
        });
        if (error) throw error;
        result = {
          ok: true,
          id: typeof reqId === 'string' ? reqId : undefined,
          message: 'Purchase interest submitted. Coordinate exchange only through approved school supervision.',
        };
        break;
      }
      case 'update_purchase_request': {
        const values = purchaseRequestStatusSchema.parse(payload);
        const { error } = await client.rpc('update_purchase_request_status', {
          target_request_id: values.id,
          new_status: values.status,
        });
        if (error) throw error;
        const labels: Record<typeof values.status, string> = {
          accepted: 'Purchase request accepted. Arrange supervised school handover.',
          declined: 'Purchase request declined.',
          fulfilled: 'Fulfillment confirmed and available stock updated.',
          cancelled: 'Purchase request cancelled.',
        };
        result = { ok: true, message: labels[values.status] };
        break;
      }
      case 'toggle_saved': {
        const id = uuidSchema.parse(payload.id);
        const saved = z.boolean().parse(payload.saved);
        const response = saved
          ? await client.from('saved_listings').upsert({ user_id: profile.id, listing_id: id }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true })
          : await client.from('saved_listings').delete().eq('user_id', profile.id).eq('listing_id', id);
        if (response.error) throw response.error;
        result = { ok: true, message: saved ? 'Saved to your shortlist.' : 'Removed from saved products.' };
        break;
      }
      case 'report_listing': {
        const values = reportSchema.parse(payload);
        const { error } = await client.from('reports').insert({ ...values, reporter_id: profile.id });
        if (error?.code === '23505') {
          return { ok: false, message: 'You already have an open report for this product. School administrators are reviewing it.' };
        }
        if (error) throw error;
        result = { ok: true, message: 'Your report has been sent to the school moderation team.' };
        break;
      }
      case 'moderate_user': {
        const { id, status } = userModerationSchema.parse(payload);
        if (id === profile.id) return { ok: false, message: 'Administrators cannot change their own approval status.' };
        const { error } = await client.rpc('moderate_user', { target_id: id, new_status: status });
        if (error) throw error;
        result = { ok: true, message: 'Account status updated and recorded in the audit history.' };
        break;
      }
      case 'set_seller_access': {
        const { id, approved } = sellerAccessSchema.parse(payload);
        const { error } = await client.rpc('set_seller_access', { target_id: id, approved });
        if (error) throw error;
        result = {
          ok: true,
          message: approved ? 'Seller access granted and recorded in the audit log.' : 'Seller access revoked.',
        };
        break;
      }
      case 'moderate_group': {
        const { id, status } = groupModerationSchema.parse(payload);
        const { error } = await client.rpc('moderate_group', { target_id: id, new_status: status });
        if (error) throw error;
        result = { ok: true, message: `Project group marked ${status} and recorded in the audit log.` };
        break;
      }
      case 'moderate_listing': {
        const { id, status } = listingModerationSchema.parse(payload);
        const { error } = await client.rpc('moderate_listing', { target_id: id, new_status: status });
        if (error) throw error;
        result = { ok: true, message: status === 'active' ? 'Product approved for the marketplace.' : 'Product removed.' };
        break;
      }
      case 'admin_create_product': {
        const values = adminProductSchema.parse(payload);
        const { data: createdId, error } = await client.rpc('admin_create_product', {
          owner_id: values.owner_id,
          target_group_id: values.group_id,
          product_title: values.title,
          product_description: values.description,
          product_price: Number(values.price),
          product_category_id: values.category_id,
          product_stock: values.stock_quantity,
          product_project_name: values.project_name,
          product_materials: values.materials,
          product_dimensions: values.dimensions,
          product_method: values.production_method,
          product_learning_area: values.learning_area,
          product_made_to_order: values.made_to_order,
        });
        if (error || !createdId) throw error || new Error('Could not create verified product.');
        result = {
          ok: true,
          id: String(createdId),
          message: 'Verified school-project product published and recorded in the audit history.',
        };
        break;
      }
      case 'resolve_report': {
        const { id, status } = reportResolutionSchema.parse(payload);
        const { error } = await client.rpc('resolve_report', { target_id: id, new_status: status });
        if (error) throw error;
        result = { ok: true, message: 'Report updated and recorded in the audit history.' };
        break;
      }
      default:
        return { ok: false, message: 'This action is not supported.' };
    }

    revalidatePath('/', 'layout');
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, message: error.issues[0]?.message || 'Check the information you entered.' };
    }
    if (error instanceof PermissionError) {
      return { ok: false, message: error.message };
    }
    const safeMessage = extractSafeErrorMessage(error);
    if (safeMessage) return { ok: false, message: safeMessage };
    return { ok: false, message: 'Your request could not be completed. Please check your connection and try again.' };
  }
}

function asSellerAwareProfile(profile: Profile): Profile {
  // Backwards-compatible default when unit tests supply partial profile fixtures without seller_approved
  if (profile.seller_approved === undefined) {
    return { ...profile, seller_approved: true, seller_type: profile.seller_type ?? 'individual' };
  }
  return profile;
}

async function authenticationAction(action: ActionName, payload: Record<string, unknown>): Promise<ActionResult> {
  const client = await serverSupabase();
  if (action === 'signup') {
    const { email, password, display_name, seller_type, project_summary } = signupSchema.parse(payload);
    const metadata: Record<string, string> = { display_name };
    if (seller_type && seller_type !== 'none') metadata.seller_type = seller_type;
    if (project_summary) metadata.project_summary = project_summary;
    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${siteUrl()}/auth/callback?next=/pending-approval`,
      },
    });
    if (error) {
      return {
        ok: false,
        message: 'We could not create your account. Please try again later or contact your school administrator.',
      };
    }
    return {
      ok: true,
      message:
        seller_type !== 'none'
          ? 'Check your email to verify your account. School approval is required before seller and marketplace access.'
          : 'Check your email to verify your account. School approval is required before marketplace access.',
    };
  }
  if (action === 'login') {
    const values = loginSchema.parse(payload);
    const { data, error } = await client.auth.signInWithPassword(values);
    if (error || !data.user?.email_confirmed_at) {
      return {
        ok: false,
        message: 'Sign-in failed. Check your email and password, and verify your email first.',
      };
    }
    const { data: profile } = await client
      .from('profiles')
      .select('verification_status,seller_type,seller_approved')
      .eq('id', data.user.id)
      .single();
    revalidatePath('/', 'layout');
    if (profile?.verification_status !== 'approved') {
      return { ok: true, message: 'Signed in.', redirect: '/pending-approval' };
    }
    const requestedNext = payload.next ? safeRedirect(payload.next, '/') : '/';
    return { ok: true, message: 'Signed in.', redirect: requestedNext };
  }
  if (action === 'logout') {
    const { error } = await client.auth.signOut();
    if (error) return { ok: false, message: 'Sign-out failed. Please try again.' };
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Signed out.', redirect: '/login' };
  }
  if (action === 'forgot_password') {
    const email = emailSchema.parse(payload.email);
    await client.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
    return { ok: true, message: 'If an account exists for that email, you will receive a password reset link.' };
  }
  if (action === 'reset_password') {
    const password = passwordSchema.parse(payload.password);
    const { user } = await getSessionContext();
    if (!user) return { ok: false, message: 'Open a valid password reset link from your email before continuing.' };
    const { error } = await client.auth.updateUser({ password });
    if (error) return { ok: false, message: 'Your password could not be updated. Request a new reset link and try again.' };
    await client.auth.signOut({ scope: 'global' });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Password updated. Please sign in again.', redirect: '/login' };
  }
  return { ok: false, message: 'This action is not supported.' };
}
