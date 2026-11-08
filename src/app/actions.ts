'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionName, ActionResult } from '@/lib/types';
import { assertOwner, PermissionError } from '@/lib/permissions';
import { displayNameSchema, emailSchema, listingModerationSchema, listingSchema, loginSchema, passwordSchema, reportResolutionSchema, reportSchema, signupSchema, userModerationSchema, uuidSchema } from '@/lib/validation';
import { getSessionContext, requireMember } from '@/lib/server/auth';
import { isDemoMode, isSupabaseConfigured, siteUrl } from '@/lib/server/config';
import { serverSupabase, storageSupabase } from '@/lib/server/supabase';

const authActions = new Set(['signup', 'login', 'logout', 'forgot_password', 'reset_password']);

export async function runAction(action: ActionName, payload: Record<string, unknown>): Promise<ActionResult> {
  if (isDemoMode()) return { ok: false, message: 'Demo mode uses fictional browser-only data. No real accounts or server changes are made.' };
  if (!isSupabaseConfigured()) return { ok: false, message: 'Connect Supabase before using real accounts or saving data.' };
  try {
    if (authActions.has(action)) return await authenticationAction(action, payload);
    const administrative = ['moderate_user', 'moderate_listing', 'resolve_report'].includes(action);
    const { client, profile } = await requireMember(administrative);
    let result: ActionResult;
    switch (action) {
      case 'save_listing': {
        const { id, ...values } = listingSchema.parse(payload);
        if (id) {
          const { data: existing, error } = await client.from('listings').select('seller_id,status').eq('id', id).single();
          if (error) throw new PermissionError();
          assertOwner(profile, existing);
          if (['removed', 'sold'].includes(existing.status)) return { ok: false, message: 'Sold and removed listings cannot be edited.' };
          const { error: updateError } = await client.from('listings').update(values).eq('id', id).eq('seller_id', profile.id).select('id').single();
          if (updateError) throw updateError;
          result = { ok: true, id, message: values.status === 'draft' ? 'Draft saved.' : 'Listing sent for school review.' };
        } else {
          const { data, error } = await client.from('listings').insert({ ...values, seller_id: profile.id }).select('id').single();
          if (error || !data) throw error || new Error('No listing returned.');
          result = { ok: true, id: data.id, message: values.status === 'draft' ? 'Draft saved.' : 'Listing sent for school review.' };
        }
        break;
      }
      case 'delete_listing': {
        const id = uuidSchema.parse(payload.id);
        const { data: listing, error: readError } = await client.from('listings').select('seller_id,listing_images(storage_path)').eq('id', id).single();
        if (readError) throw new PermissionError();
        assertOwner(profile, listing);
        const { error } = await client.from('listings').delete().eq('id', id).eq('seller_id', profile.id).select('id').single();
        if (error) throw error;
        // Database visibility is removed first. A failed cleanup leaves an inaccessible orphan, never a public object.
        const paths = (listing.listing_images as { storage_path: string }[]).map((image) => image.storage_path);
        if (paths.length && process.env.SUPABASE_SERVICE_ROLE_KEY) await storageSupabase().storage.from('listing-images').remove(paths);
        result = { ok: true, message: 'Listing deleted.', redirect: '/dashboard/listings' };
        break;
      }
      case 'mark_sold': {
        const id = uuidSchema.parse(payload.id);
        const { data: existing, error: readError } = await client.from('listings').select('seller_id,status').eq('id', id).single();
        if (readError) throw new PermissionError();
        assertOwner(profile, existing);
        if (existing.status !== 'active') return { ok: false, message: 'Only an active listing can be marked as sold.' };
        const { error } = await client.from('listings').update({ status: 'sold' }).eq('id', id).eq('seller_id', profile.id).eq('status', 'active').select('id').single();
        if (error) throw error;
        result = { ok: true, message: 'Listing marked as sold.' };
        break;
      }
      case 'toggle_saved': {
        const id = uuidSchema.parse(payload.id);
        const saved = z.boolean().parse(payload.saved);
        const response = saved
          ? await client.from('saved_listings').upsert({ user_id: profile.id, listing_id: id }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true })
          : await client.from('saved_listings').delete().eq('user_id', profile.id).eq('listing_id', id);
        if (response.error) throw response.error;
        result = { ok: true, message: saved ? 'Added to saved items.' : 'Removed from saved items.' };
        break;
      }
      case 'report_listing': {
        const values = reportSchema.parse(payload);
        const { error } = await client.from('reports').insert({ ...values, reporter_id: profile.id });
        if (error?.code === '23505') return { ok: false, message: 'You have already reported this listing. The school is reviewing it.' };
        if (error) throw error;
        result = { ok: true, message: 'Your report has been sent to the school moderation team.' };
        break;
      }
      case 'update_profile': {
        const display_name = displayNameSchema.parse(payload.display_name);
        const { error } = await client.from('profiles').update({ display_name }).eq('id', profile.id).select('id').single();
        if (error) throw error;
        result = { ok: true, message: 'Your display name has been updated.' };
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
      case 'moderate_listing': {
        const { id, status } = listingModerationSchema.parse(payload);
        const { error } = await client.rpc('moderate_listing', { target_id: id, new_status: status });
        if (error) throw error;
        result = { ok: true, message: status === 'active' ? 'Listing approved.' : 'Listing removed.' };
        break;
      }
      case 'resolve_report': {
        const { id, status } = reportResolutionSchema.parse(payload);
        const { error } = await client.rpc('resolve_report', { target_id: id, new_status: status });
        if (error) throw error;
        result = { ok: true, message: 'Report updated and recorded in the audit history.' };
        break;
      }
      default: return { ok: false, message: 'This action is not supported.' };
    }
    revalidatePath('/', 'layout');
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message || 'Check the information you entered.' };
    if (error instanceof PermissionError) return { ok: false, message: error.message };
    return { ok: false, message: 'Your request could not be completed. Please check your connection and try again.' };
  }
}

async function authenticationAction(action: ActionName, payload: Record<string, unknown>): Promise<ActionResult> {
  const client = await serverSupabase();
  if (action === 'signup') {
    const { email, password, display_name } = signupSchema.parse(payload);
    const { error } = await client.auth.signUp({ email, password, options: { data: { display_name }, emailRedirectTo: `${siteUrl()}/auth/callback?next=/pending-approval` } });
    if (error) return { ok: false, message: 'We could not create your account. Please try again later or contact your school administrator.' };
    return { ok: true, message: 'Check your email to verify your account. School approval is required before marketplace access.' };
  }
  if (action === 'login') {
    const values = loginSchema.parse(payload);
    const { data, error } = await client.auth.signInWithPassword(values);
    if (error || !data.user?.email_confirmed_at) return { ok: false, message: 'Sign-in failed. Check your email and password, and verify your email first.' };
    const { data: profile } = await client.from('profiles').select('verification_status').eq('id', data.user.id).single();
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Signed in.', redirect: profile?.verification_status === 'approved' ? '/' : '/pending-approval' };
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
