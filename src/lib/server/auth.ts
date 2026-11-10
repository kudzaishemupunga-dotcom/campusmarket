import 'server-only';
import { cache } from 'react';
import type { Profile } from '@/lib/types';
import { PermissionError, assertAdmin, assertApproved } from '@/lib/permissions';
import { serverSupabase } from './supabase';

export const getSessionContext = cache(async () => {
  const client = await serverSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return { client, user: null, profile: null };
  const { data, error: profileError } = await client
    .from('profiles')
    .select('id,display_name,avatar_path,role,verification_status,seller_type,seller_approved,project_summary,created_at,updated_at')
    .eq('id', user.id)
    .single();
  if (profileError || !data || data.id !== user.id || !['student', 'admin'].includes(data.role) || !['pending', 'approved', 'rejected', 'suspended'].includes(data.verification_status)) {
    return { client, user, profile: null };
  }
  const normalized: Profile = {
    ...(data as Profile),
    seller_type: (data as Partial<Profile>).seller_type ?? 'none',
    seller_approved: (data as Partial<Profile>).seller_approved === true,
    project_summary: (data as Partial<Profile>).project_summary ?? null,
  };
  return { client, user, profile: normalized };
});

export async function requireMember(admin = false) {
  const context = await getSessionContext();
  if (!context.user) throw new PermissionError('Please sign in to continue.');
  if (admin) assertAdmin(context.profile);
  else assertApproved(context.profile);
  return { ...context, profile: context.profile! };
}
