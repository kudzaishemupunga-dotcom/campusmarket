import 'server-only';

export function isDemoMode(): boolean {
  return process.env.CAMPUSMARKET_DEMO === 'true' && process.env.NODE_ENV !== 'production';
}
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
export function siteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value && process.env.NODE_ENV === 'production') throw new Error('NEXT_PUBLIC_SITE_URL is required.');
  const url = new URL(value || 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid site URL.');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production requires an HTTPS site URL.');
  return url.origin;
}
