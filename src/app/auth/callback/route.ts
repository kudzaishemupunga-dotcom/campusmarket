import { NextResponse, type NextRequest } from 'next/server';
import { safeRedirect } from '@/lib/validation';
import { isSupabaseConfigured, siteUrl } from '@/lib/server/config';
import { serverSupabase } from '@/lib/server/supabase';

export async function GET(request: NextRequest) {
  const origin = siteUrl();
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL('/login?notice=configuration-required', origin));
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const hash = params.get('token_hash');
  const type = params.get('type');
  const client = await serverSupabase();
  let success = false;
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    success = !error;
  } else if (hash && (type === 'email' || type === 'signup' || type === 'recovery')) {
    const { error } = await client.auth.verifyOtp({ token_hash: hash, type });
    success = !error;
  }
  const next = type === 'recovery' ? '/reset-password' : safeRedirect(params.get('next'));
  return NextResponse.redirect(new URL(success ? next : '/login?notice=invalid-link', origin));
}
