import 'server-only';
import type { Profile } from '@/lib/types';
import { isApprovedSeller } from '@/lib/permissions';
import type {
  CustomFlashcardRecord,
  FlashcardReviewRecord,
  HubMarketplaceSummary,
  QuizAttemptRecord,
  StudyProgressPayload,
} from '@/lib/study/types';
import { getSessionContext } from './auth';
import { isSupabaseConfigured } from './config';

export interface HubServerData {
  mode: 'supabase' | 'unconfigured';
  profile: Profile | null;
  study: StudyProgressPayload;
  marketplaceSummary: HubMarketplaceSummary | null;
}

const emptyStudy: StudyProgressPayload = {
  synced: false,
  attempts: [],
  customCards: [],
  reviews: [],
};

export function isMissingStudyTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation .*study_.* does not exist/i.test(message) ||
    /could not find the table .*study_/i.test(message) ||
    /unknown table study_/i.test(message)
  );
}

export async function loadStudyProgressForClient(
  client: Awaited<ReturnType<typeof getSessionContext>>['client'],
  userId: string
): Promise<StudyProgressPayload> {
  const [attemptsRes, cardsRes, reviewsRes] = await Promise.all([
    client
      .from('study_quiz_attempts')
      .select('id,subject_id,tier,mode,score,total_questions,percentage,grade_band,duration_seconds,weak_topics,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('study_flashcards')
      .select('id,subject_id,topic,front,back,hint,created_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    client
      .from('study_flashcard_reviews')
      .select('card_key,subject_id,box,ease_factor,interval_days,repetitions,lapses,last_rating,next_review_at,reviewed_at')
      .eq('user_id', userId)
      .order('reviewed_at', { ascending: false })
      .limit(500),
  ]);

  const firstError = attemptsRes.error || cardsRes.error || reviewsRes.error;
  if (firstError) {
    if (isMissingStudyTableError(firstError)) {
      return { ...emptyStudy, synced: false, migrationRequired: true };
    }
    throw new Error('Could not load study progress.');
  }

  const attempts = ((attemptsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    subject_id: row.subject_id as QuizAttemptRecord['subject_id'],
    tier: row.tier as QuizAttemptRecord['tier'],
    mode: row.mode as QuizAttemptRecord['mode'],
    score: Number(row.score),
    total_questions: Number(row.total_questions),
    percentage: Number(row.percentage),
    grade_band: row.grade_band as QuizAttemptRecord['grade_band'],
    duration_seconds: Number(row.duration_seconds ?? 0),
    weak_topics: Array.isArray(row.weak_topics) ? row.weak_topics.map(String) : [],
    created_at: String(row.created_at),
  }));

  const customCards = ((cardsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    subject_id: row.subject_id as CustomFlashcardRecord['subject_id'],
    topic: String(row.topic),
    front: String(row.front),
    back: String(row.back),
    hint: row.hint ? String(row.hint) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));

  const reviews = ((reviewsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    card_key: String(row.card_key),
    subject_id: row.subject_id as FlashcardReviewRecord['subject_id'],
    box: Number(row.box),
    ease_factor: Number(row.ease_factor),
    interval_days: Number(row.interval_days),
    repetitions: Number(row.repetitions),
    lapses: Number(row.lapses),
    last_rating: row.last_rating as FlashcardReviewRecord['last_rating'],
    next_review_at: String(row.next_review_at),
    reviewed_at: String(row.reviewed_at),
  }));

  return {
    synced: true,
    attempts,
    customCards,
    reviews,
  };
}

export async function getHubServerData(options: {
  includeStudy?: boolean;
  includeMarketplaceSummary?: boolean;
} = {}): Promise<HubServerData> {
  if (!isSupabaseConfigured()) {
    return {
      mode: 'unconfigured',
      profile: null,
      study: emptyStudy,
      marketplaceSummary: null,
    };
  }

  const { client, user, profile } = await getSessionContext();
  const isApproved = Boolean(user && profile?.verification_status === 'approved');

  if (!isApproved || !user || !profile) {
    return {
      mode: 'supabase',
      profile,
      study: emptyStudy,
      marketplaceSummary: null,
    };
  }

  let study = emptyStudy;
  if (options.includeStudy) {
    try {
      study = await loadStudyProgressForClient(client, user.id);
    } catch {
      study = { ...emptyStudy, synced: false };
    }
  }

  let marketplaceSummary: HubMarketplaceSummary | null = null;
  if (options.includeMarketplaceSummary) {
    try {
      const [activeListingsRes, groupsRes, savedRes, requestsRes, myListingsRes] = await Promise.all([
        client.from('listings').select('id', { count: 'exact' }).eq('status', 'active').limit(1),
        client.from('seller_groups').select('id', { count: 'exact' }).eq('verification_status', 'approved').limit(1),
        client.from('saved_listings').select('listing_id', { count: 'exact' }).eq('user_id', user.id).limit(1),
        client.from('purchase_requests').select('id,status').limit(100),
        client.from('listings').select('id', { count: 'exact' }).eq('seller_id', user.id).limit(1),
      ]);

      const pendingRequests = ((requestsRes.data ?? []) as Array<{ status: string }>).filter(
        (r) => r.status === 'pending' || r.status === 'accepted'
      ).length;

      marketplaceSummary = {
        activeProductsCount: activeListingsRes.count ?? 0,
        approvedGroupsCount: groupsRes.count ?? 0,
        mySavedCount: savedRes.count ?? 0,
        myPendingRequestsCount: pendingRequests,
        myProductsCount: myListingsRes.count ?? 0,
        isApprovedSeller: isApprovedSeller(profile),
      };
    } catch {
      marketplaceSummary = null;
    }
  }

  return {
    mode: 'supabase',
    profile,
    study,
    marketplaceSummary,
  };
}
