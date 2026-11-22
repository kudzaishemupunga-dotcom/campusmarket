import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwlAidUser } from '@/lib/owlaid/auth';
import { isSupabaseConfigured } from '@/lib/server/config';
import { isMissingStudyTableError } from '@/lib/server/hub-data';
import { hasValidOrigin } from '@/lib/server/request-guards';
import { serverSupabase, studyServiceSupabase } from '@/lib/server/supabase';
import { CURATED_CARD_BY_KEY } from '@/lib/study/flashcards';
import { flashcardReviewSchema } from '@/lib/study/scoring';
import { calculateNextReview } from '@/lib/study/spaced-repetition';
import type { FlashcardReviewRecord, StudySubjectId } from '@/lib/study/types';

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
      return json({ error: 'Sign in with an approved school account to sync flashcard reviews.' }, 401);
    }

    if (Number(request.headers.get('content-length')) > 4000) {
      return json({ error: 'Request too large' }, 413);
    }
    const raw = await request.text();
    if (raw.length > 4000) return json({ error: 'Request too large' }, 413);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const input = flashcardReviewSchema.parse(parsedBody);

    // Authoritatively validate the referenced card before computing or writing any review schedule
    let verifiedSubjectId: StudySubjectId;
    const isCurated = input.cardKey.startsWith('curated:');

    if (isCurated) {
      const curatedCard = CURATED_CARD_BY_KEY.get(input.cardKey);
      if (!curatedCard) {
        return json({ error: 'Flashcard not found.' }, 404);
      }
      if (curatedCard.subjectId !== input.subjectId) {
        return json({ error: 'Flashcard subject mismatch.' }, 400);
      }
      verifiedSubjectId = curatedCard.subjectId;
    } else {
      verifiedSubjectId = input.subjectId;
    }

    if (!isSupabaseConfigured()) {
      const next = calculateNextReview({
        cardKey: input.cardKey,
        subjectId: verifiedSubjectId,
        rating: input.rating,
      });
      return json({ review: next, persisted: false });
    }

    // Use user-scoped authenticated client (enforcing RLS) to read owned custom cards & existing review state
    const userClient = await serverSupabase();

    if (!isCurated) {
      const customId = input.cardKey.slice('custom:'.length);
      const customCardRes = await userClient
        .from('study_flashcards')
        .select('id,subject_id')
        .eq('id', customId)
        .eq('user_id', user.id)
        .limit(1);

      if (customCardRes.error) {
        if (isMissingStudyTableError(customCardRes.error)) {
          const next = calculateNextReview({
            cardKey: input.cardKey,
            subjectId: verifiedSubjectId,
            rating: input.rating,
          });
          return json({ review: next, persisted: false, migrationRequired: true });
        }
        return json({ error: 'Could not verify custom flashcard.' }, 500);
      }

      const ownedCard = (customCardRes.data?.[0] ?? null) as { id: string; subject_id: StudySubjectId } | null;
      if (!ownedCard) {
        return json({ error: 'Flashcard not found.' }, 404);
      }
      if (ownedCard.subject_id !== input.subjectId) {
        return json({ error: 'Flashcard subject mismatch.' }, 400);
      }
      verifiedSubjectId = ownedCard.subject_id;
    }

    const existingRes = await userClient
      .from('study_flashcard_reviews')
      .select('box,ease_factor,interval_days,repetitions,lapses')
      .eq('user_id', user.id)
      .eq('card_key', input.cardKey)
      .limit(1);

    if (existingRes.error) {
      if (isMissingStudyTableError(existingRes.error)) {
        const next = calculateNextReview({
          cardKey: input.cardKey,
          subjectId: verifiedSubjectId,
          rating: input.rating,
        });
        return json({ review: next, persisted: false, migrationRequired: true });
      }
      return json({ error: 'Could not read flashcard review history.' }, 500);
    }

    const existingRow = (existingRes.data?.[0] ?? null) as Pick<
      FlashcardReviewRecord,
      'box' | 'ease_factor' | 'interval_days' | 'repetitions' | 'lapses'
    > | null;

    const next = calculateNextReview({
      cardKey: input.cardKey,
      subjectId: verifiedSubjectId,
      rating: input.rating,
      existing: existingRow,
    });

    // Hardened Migration 005 revokes direct authenticated INSERT/UPDATE/DELETE on study_flashcard_reviews.
    // Server-calculated review schedules are persisted strictly via the server-only service-role client
    // using the verified `user.id` and verified card/subject identity.
    let serviceClient: ReturnType<typeof studyServiceSupabase>;
    try {
      serviceClient = studyServiceSupabase();
    } catch {
      return json({ error: 'Study persistence service is not configured.' }, 503);
    }

    const upsertRes = await serviceClient
      .from('study_flashcard_reviews')
      .upsert(
        {
          user_id: user.id,
          card_key: next.card_key,
          subject_id: next.subject_id,
          box: next.box,
          ease_factor: next.ease_factor,
          interval_days: next.interval_days,
          repetitions: next.repetitions,
          lapses: next.lapses,
          last_rating: next.last_rating,
          next_review_at: next.next_review_at,
          reviewed_at: next.reviewed_at,
        },
        { onConflict: 'user_id,card_key' }
      )
      .select('card_key,subject_id,box,ease_factor,interval_days,repetitions,lapses,last_rating,next_review_at,reviewed_at')
      .single();

    if (upsertRes.error) {
      return json({ error: 'Could not save flashcard review.' }, 500);
    }

    const saved = upsertRes.data as Record<string, unknown>;
    const normalized: FlashcardReviewRecord = {
      card_key: String(saved.card_key),
      subject_id: saved.subject_id as FlashcardReviewRecord['subject_id'],
      box: Number(saved.box),
      ease_factor: Number(saved.ease_factor),
      interval_days: Number(saved.interval_days),
      repetitions: Number(saved.repetitions),
      lapses: Number(saved.lapses),
      last_rating: saved.last_rating as FlashcardReviewRecord['last_rating'],
      next_review_at: String(saved.next_review_at),
      reviewed_at: String(saved.reviewed_at),
    };

    return json({ review: normalized, persisted: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: error.issues[0]?.message || 'Invalid flashcard review payload.' }, 400);
    }
    return json({ error: 'Flashcard review service is currently unavailable.' }, 503);
  }
}
