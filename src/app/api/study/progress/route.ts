import { NextRequest, NextResponse } from 'next/server';
import { getOwlAidUser } from '@/lib/owlaid/auth';
import { isSupabaseConfigured } from '@/lib/server/config';
import { loadStudyProgressForClient } from '@/lib/server/hub-data';
import { hasValidOrigin } from '@/lib/server/request-guards';
import { serverSupabase } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: object, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return json({ error: 'Invalid request origin' }, 403);
  }
  if (!isSupabaseConfigured()) {
    return json({ synced: false, attempts: [], customCards: [], reviews: [] });
  }

  try {
    const user = await getOwlAidUser();
    if (!user) return json({ error: 'Sign in with an approved school account to load study progress.' }, 401);

    const client = await serverSupabase();
    const progress = await loadStudyProgressForClient(client, user.id);
    return json(progress);
  } catch {
    return json({ error: 'Could not load study progress right now.' }, 503);
  }
}
