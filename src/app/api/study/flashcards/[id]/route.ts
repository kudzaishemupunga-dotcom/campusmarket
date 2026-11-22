import { NextRequest, NextResponse } from 'next/server';
import { getOwlAidUser } from '@/lib/owlaid/auth';
import { isSupabaseConfigured } from '@/lib/server/config';
import { isMissingStudyTableError } from '@/lib/server/hub-data';
import { hasValidOrigin } from '@/lib/server/request-guards';
import { serverSupabase } from '@/lib/server/supabase';
import { uuidSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: object, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasValidOrigin(request)) {
    return json({ error: 'Invalid request origin' }, 403);
  }

  try {
    const user = await getOwlAidUser();
    if (!user) {
      return json({ error: 'Sign in with an approved school account to delete flashcards.' }, 401);
    }

    const { id } = await context.params;
    const parsedId = uuidSchema.safeParse(id);
    if (!parsedId.success) {
      return json({ error: 'Invalid flashcard ID.' }, 400);
    }

    if (!isSupabaseConfigured()) {
      return json({ deleted: true, persisted: false });
    }

    const client = await serverSupabase();
    const { data, error } = await client
      .from('study_flashcards')
      .delete()
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .select('id');

    if (error) {
      if (isMissingStudyTableError(error)) {
        return json({ deleted: true, persisted: false, migrationRequired: true });
      }
      return json({ error: 'Could not delete flashcard.' }, 500);
    }

    if (!data || data.length === 0) {
      return json({ error: 'Flashcard not found.' }, 404);
    }

    // Best-effort cleanup of review metadata for this custom card
    await client
      .from('study_flashcard_reviews')
      .delete()
      .eq('user_id', user.id)
      .eq('card_key', `custom:${parsedId.data}`);

    return json({ deleted: true, persisted: true });
  } catch {
    return json({ error: 'Flashcard service is currently unavailable.' }, 503);
  }
}
