import 'server-only';
import { cache } from 'react';
import type { Profile } from '@/lib/types';
import { PermissionError, assertAdmin, assertApproved } from '@/lib/permissions';
import { serverSupabase } from './supabase';

export const getSessionContext = cache(async () => {
  const client = await serverSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return { client, user: null, profile: null };
  const { data, error: profileError } = await client.from('profiles').select('id,display_name,avatar_path,role,verification_status,created_at,updated_at').eq('id', user.id).single();
  if (profileError) return { client, user, profile: null };
  return { client, user, profile: data as Profile };
});

export async function requireMember(admin = false) {
  const context = await getSessionContext();
  if (!context.user) throw new PermissionError('Please sign in to continue.');
  if (admin) assertAdmin(context.profile); else assertApproved(context.profile);
  return { ...context, profile: context.profile! };
}
