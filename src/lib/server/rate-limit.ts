import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const limits = { listing_write: 20, saved_toggle: 60, report: 5, profile_update: 10, moderation: 30, upload: 15 } as const;
export async function checkRateLimit(client: SupabaseClient, action: keyof typeof limits): Promise<void> {
  const { data, error } = await client.rpc('consume_rate_limit', { action_key: action, max_requests: limits[action], window_seconds: 60 });
  if (error) throw new Error('Unable to verify request limits. Please try again later.');
  if (data !== true) throw new Error('Too many requests. Wait a minute and try again.');
}
