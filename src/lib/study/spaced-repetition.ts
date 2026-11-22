import type {
  FlashcardRating,
  FlashcardReviewRecord,
  QuizAttemptRecord,
  StudyFlashcardItem,
  StudySubjectId,
} from './types';
import { STUDY_SUBJECTS } from './curriculum';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NextReviewInput {
  cardKey: string;
  subjectId: StudySubjectId;
  rating: FlashcardRating;
  existing?: Pick<
    FlashcardReviewRecord,
    'box' | 'ease_factor' | 'interval_days' | 'repetitions' | 'lapses'
  > | null;
  now?: Date;
}

/**
 * Deterministic Leitner + SM-2 hybrid scheduler.
 * - again: resets box to 1, logs a lapse, due immediately (0 days) for same-session re-review.
 * - hard: keeps/steps gently (box >= 1), schedules 1 day (or 1.2x previous interval, capped).
 * - good: advances box up to 5, schedules 1 -> 3 -> 7 -> 14 -> 30+ days scaled by ease factor.
 * - easy: accelerates box up to 5, boosts ease factor, schedules 4 -> 10 -> 21 -> 45+ days.
 */
export function calculateNextReview({
  cardKey,
  subjectId,
  rating,
  existing,
  now = new Date(),
}: NextReviewInput): FlashcardReviewRecord {
  const prevBox = existing ? Math.max(0, Math.min(5, existing.box)) : 0;
  const prevEase = existing ? Math.max(1.3, Math.min(3.5, Number(existing.ease_factor))) : 2.5;
  const prevInterval = existing ? Math.max(0, existing.interval_days) : 0;
  const prevReps = existing ? Math.max(0, existing.repetitions) : 0;
  const prevLapses = existing ? Math.max(0, existing.lapses) : 0;

  let box = prevBox;
  let ease = prevEase;
  let intervalDays = 0;
  let repetitions = prevReps;
  let lapses = prevLapses;

  if (rating === 'again') {
    box = 1;
    ease = Math.max(1.3, Number((prevEase - 0.2).toFixed(2)));
    intervalDays = 0;
    repetitions = 0;
    lapses = prevLapses + 1;
  } else if (rating === 'hard') {
    box = Math.max(1, Math.min(4, prevBox === 0 ? 1 : prevBox));
    ease = Math.max(1.3, Number((prevEase - 0.1).toFixed(2)));
    intervalDays = prevInterval <= 1 ? 1 : Math.min(365, Math.max(2, Math.round(prevInterval * 1.2)));
    repetitions = prevReps + 1;
  } else if (rating === 'good') {
    box = Math.min(5, Math.max(1, prevBox + 1));
    ease = Math.min(3.5, Number((prevEase + 0.05).toFixed(2)));
    if (prevReps === 0) intervalDays = 1;
    else if (prevReps === 1) intervalDays = 3;
    else if (prevReps === 2) intervalDays = 7;
    else intervalDays = Math.min(365, Math.max(prevInterval + 2, Math.round(prevInterval * ease)));
    repetitions = prevReps + 1;
  } else {
    // easy
    box = Math.min(5, Math.max(2, prevBox + 2));
    ease = Math.min(3.5, Number((prevEase + 0.15).toFixed(2)));
    if (prevReps === 0) intervalDays = 4;
    else if (prevReps === 1) intervalDays = 10;
    else intervalDays = Math.min(365, Math.max(prevInterval + 5, Math.round(prevInterval * ease * 1.3)));
    repetitions = prevReps + 1;
  }

  const reviewedAt = now.toISOString();
  const nextReviewAt = new Date(now.getTime() + intervalDays * DAY_MS).toISOString();

  return {
    card_key: cardKey,
    subject_id: subjectId,
    box,
    ease_factor: ease,
    interval_days: intervalDays,
    repetitions,
    lapses,
    last_rating: rating,
    next_review_at: nextReviewAt,
    reviewed_at: reviewedAt,
  };
}

export function isCardDue(review: FlashcardReviewRecord | undefined, now: Date = new Date()): boolean {
  if (!review) return true;
  return new Date(review.next_review_at).getTime() <= now.getTime();
}

export function isCardMastered(review: FlashcardReviewRecord | undefined): boolean {
  if (!review) return false;
  return review.box >= 4 && review.last_rating !== 'again';
}

export function needsPractice(review: FlashcardReviewRecord | undefined): boolean {
  if (!review) return false;
  return review.last_rating === 'again' || review.last_rating === 'hard' || review.box <= 1;
}

export function formatNextReviewLabel(review: FlashcardReviewRecord | undefined, now: Date = new Date()): string {
  if (!review) return 'New card';
  const diffMs = new Date(review.next_review_at).getTime() - now.getTime();
  if (diffMs <= 0) return 'Due now';
  const days = Math.ceil(diffMs / DAY_MS);
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

export interface SubjectReadiness {
  subjectId: StudySubjectId;
  attemptsCount: number;
  averageQuizPercent: number | null;
  bestQuizPercent: number | null;
  latestGrade: string | null;
  totalCards: number;
  reviewedCards: number;
  masteredCards: number;
  dueCards: number;
  readinessPercent: number;
  weakTopics: string[];
}

export function computeSubjectReadiness(
  allCards: readonly StudyFlashcardItem[],
  reviews: readonly FlashcardReviewRecord[],
  attempts: readonly QuizAttemptRecord[],
  now: Date = new Date()
): SubjectReadiness[] {
  const reviewMap = new Map(reviews.map((r) => [r.card_key, r]));

  return STUDY_SUBJECTS.map((subject) => {
    const subjectCards = allCards.filter((card) => card.subjectId === subject.id);
    const subjectAttempts = attempts.filter((attempt) => attempt.subject_id === subject.id);

    const reviewedCards = subjectCards.filter((card) => reviewMap.has(card.cardKey)).length;
    const masteredCards = subjectCards.filter((card) => isCardMastered(reviewMap.get(card.cardKey))).length;
    const dueCards = subjectCards.filter((card) => isCardDue(reviewMap.get(card.cardKey), now)).length;

    const attemptsCount = subjectAttempts.length;
    const averageQuizPercent = attemptsCount
      ? Math.round(subjectAttempts.reduce((sum, item) => sum + item.percentage, 0) / attemptsCount)
      : null;
    const bestQuizPercent = attemptsCount
      ? Math.max(...subjectAttempts.map((item) => item.percentage))
      : null;
    const latestGrade = subjectAttempts[0]?.grade_band ?? null;

    const cardMasteryRatio = subjectCards.length ? Math.round((masteredCards / subjectCards.length) * 100) : 0;
    const readinessPercent =
      averageQuizPercent !== null
        ? Math.round(averageQuizPercent * 0.65 + cardMasteryRatio * 0.35)
        : Math.round(cardMasteryRatio * 0.5);

    const weakTopicSet = new Set<string>();
    for (const attempt of subjectAttempts.slice(0, 3)) {
      for (const topic of attempt.weak_topics) {
        weakTopicSet.add(topic);
      }
    }

    return {
      subjectId: subject.id,
      attemptsCount,
      averageQuizPercent,
      bestQuizPercent,
      latestGrade,
      totalCards: subjectCards.length,
      reviewedCards,
      masteredCards,
      dueCards,
      readinessPercent,
      weakTopics: [...weakTopicSet].slice(0, 3),
    };
  });
}

export function computeStudyStreakDays(
  attempts: readonly QuizAttemptRecord[],
  reviews: readonly FlashcardReviewRecord[],
  now: Date = new Date()
): number {
  const activeDates = new Set<string>();
  const toUtcDay = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };
  for (const a of attempts) {
    const day = toUtcDay(a.created_at);
    if (day) activeDates.add(day);
  }
  for (const r of reviews) {
    const day = toUtcDay(r.reviewed_at);
    if (day) activeDates.add(day);
  }
  if (!activeDates.size) return 0;

  let streak = 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!activeDates.has(todayKey)) {
    // Allow yesterday to continue an active streak before today's session.
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
