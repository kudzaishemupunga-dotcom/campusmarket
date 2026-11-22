import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwlAidUser } from '@/lib/owlaid/auth';
import { isSupabaseConfigured } from '@/lib/server/config';
import { isMissingStudyTableError } from '@/lib/server/hub-data';
import { hasValidOrigin } from '@/lib/server/request-guards';
import { serverSupabase } from '@/lib/server/supabase';
import { customFlashcardCreateSchema } from '@/lib/study/scoring';
import type { CustomFlashcardRecord } from '@/lib/study/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: object, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return json({ error: 'Invalid request origin' }, 403);
  }

  try {
    const user = await getOwlAidUser();
    if (!user) {
      return json({ error: 'Sign in with an approved school account to save custom flashcards.' }, 401);
    }

    if (Number(request.headers.get('content-length')) > 10000) {
      return json({ error: 'Request too large' }, 413);
    }
    const raw = await request.text();
    if (raw.length > 10000) return json({ error: 'Request too large' }, 413);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const input = customFlashcardCreateSchema.parse(parsedBody);
    const nowIso = new Date().toISOString();

    if (!isSupabaseConfigured()) {
      const localCard: CustomFlashcardRecord = {
        id: crypto.randomUUID(),
        subject_id: input.subjectId,
        topic: input.topic,
        front: input.front,
        back: input.back,
        hint: input.hint,
        created_at: nowIso,
        updated_at: nowIso,
      };
      return json({ card: localCard, persisted: false }, 201);
    }

    const client = await serverSupabase();
    const { data, error } = await client
      .from('study_flashcards')
      .insert({
        user_id: user.id,
        subject_id: input.subjectId,
        topic: input.topic,
        front: input.front,
        back: input.back,
        hint: input.hint,
      })
      .select('id,subject_id,topic,front,back,hint,created_at,updated_at')
      .single();

    if (error) {
      if (isMissingStudyTableError(error)) {
        const localCard: CustomFlashcardRecord = {
          id: crypto.randomUUID(),
          subject_id: input.subjectId,
          topic: input.topic,
          front: input.front,
          back: input.back,
          hint: input.hint,
          created_at: nowIso,
          updated_at: nowIso,
        };
        return json({ card: localCard, persisted: false, migrationRequired: true }, 201);
      }
      if (error.code === '23514' && error.message?.includes('200 cards')) {
        return json({ error: 'Custom flashcard limit reached (200 cards per learner).' }, 400);
      }
      return json({ error: 'Could not create flashcard. Please try again.' }, 500);
    }

    return json({ card: data as CustomFlashcardRecord, persisted: true }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: error.issues[0]?.message || 'Check your flashcard text and try again.' }, 400);
    }
    return json({ error: 'Flashcard service is currently unavailable.' }, 503);
  }
}
