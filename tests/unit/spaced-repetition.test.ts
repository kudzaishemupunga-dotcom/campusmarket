import { describe, expect, it } from 'vitest';
import { CURATED_FLASHCARDS } from '@/lib/study/flashcards';
import {
  calculateNextReview,
  computeStudyStreakDays,
  computeSubjectReadiness,
  isCardDue,
  isCardMastered,
  needsPractice,
} from '@/lib/study/spaced-repetition';
import type { FlashcardReviewRecord, QuizAttemptRecord } from '@/lib/study/types';

describe('Spaced-repetition review scheduler', () => {
  const baseNow = new Date('2026-11-22T12:00:00.000Z');

  it('advances box and interval across Good and Easy ratings and resets cleanly on Again', () => {
    const first = calculateNextReview({
      cardKey: 'curated:fc-bio-1',
      subjectId: 'biology',
      rating: 'good',
      now: baseNow,
    });
    expect(first.box).toBe(1);
    expect(first.interval_days).toBe(1);
    expect(first.repetitions).toBe(1);
    expect(first.lapses).toBe(0);

    const second = calculateNextReview({
      cardKey: 'curated:fc-bio-1',
      subjectId: 'biology',
      rating: 'good',
      existing: first,
      now: baseNow,
    });
    expect(second.box).toBe(2);
    expect(second.interval_days).toBe(3);

    const third = calculateNextReview({
      cardKey: 'curated:fc-bio-1',
      subjectId: 'biology',
      rating: 'easy',
      existing: second,
      now: baseNow,
    });
    expect(third.box).toBe(4);
    expect(third.interval_days).toBeGreaterThanOrEqual(8);
    expect(isCardMastered(third)).toBe(true);
    expect(isCardDue(third, baseNow)).toBe(false);

    // Lapse on Again resets box to 1 and makes card due immediately
    const lapsed = calculateNextReview({
      cardKey: 'curated:fc-bio-1',
      subjectId: 'biology',
      rating: 'again',
      existing: third,
      now: baseNow,
    });
    expect(lapsed.box).toBe(1);
    expect(lapsed.interval_days).toBe(0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.repetitions).toBe(0);
    expect(isCardDue(lapsed, baseNow)).toBe(true);
    expect(needsPractice(lapsed)).toBe(true);
    expect(isCardMastered(lapsed)).toBe(false);
  });

  it('computes realistic subject readiness and active study streaks from real records', () => {
    const reviews: FlashcardReviewRecord[] = CURATED_FLASHCARDS.filter((c) => c.subjectId === 'biology')
      .slice(0, 4)
      .map((card) => ({
        card_key: card.cardKey,
        subject_id: 'biology',
        box: 4,
        ease_factor: 2.6,
        interval_days: 14,
        repetitions: 3,
        lapses: 0,
        last_rating: 'good',
        next_review_at: '2026-12-06T12:00:00.000Z',
        reviewed_at: '2026-11-22T11:00:00.000Z',
      }));

    const attempts: QuizAttemptRecord[] = [
      {
        id: 'attempt-1',
        subject_id: 'biology',
        tier: 'extended',
        mode: 'practice',
        score: 7,
        total_questions: 8,
        percentage: 88,
        grade_band: 'A',
        duration_seconds: 120,
        weak_topics: ['Genetics & Inheritance'],
        created_at: '2026-11-21T15:00:00.000Z',
      },
      {
        id: 'attempt-2',
        subject_id: 'biology',
        tier: 'all',
        mode: 'exam',
        score: 8,
        total_questions: 8,
        percentage: 100,
        grade_band: 'A*',
        duration_seconds: 95,
        weak_topics: [],
        created_at: '2026-11-20T15:00:00.000Z',
      },
    ];

    const readiness = computeSubjectReadiness(CURATED_FLASHCARDS, reviews, attempts, baseNow);
    const bio = readiness.find((r) => r.subjectId === 'biology')!;
    expect(bio.attemptsCount).toBe(2);
    expect(bio.averageQuizPercent).toBe(94);
    expect(bio.masteredCards).toBe(4);
    expect(bio.dueCards).toBe(4);
    expect(bio.readinessPercent).toBeGreaterThan(70);

    const streak = computeStudyStreakDays(attempts, reviews, baseNow);
    expect(streak).toBe(3); // Nov 22 (reviews) + Nov 21 + Nov 20 (attempts)
  });
});
