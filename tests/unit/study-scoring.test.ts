import { describe, expect, it } from 'vitest';
import { STUDY_SUBJECTS } from '@/lib/study/curriculum';
import { CURATED_FLASHCARDS } from '@/lib/study/flashcards';
import { getQuizQuestions, QUIZ_QUESTIONS } from '@/lib/study/quizzes';
import {
  customFlashcardCreateSchema,
  flashcardReviewSchema,
  gradeBandForPercentage,
  gradeQuizSubmission,
} from '@/lib/study/scoring';

describe('Cambridge IGCSE curriculum & question bank integrity', () => {
  it('provides 8 curated quiz questions and 8 flashcards for every one of the 8 IGCSE subjects', () => {
    expect(STUDY_SUBJECTS).toHaveLength(8);
    expect(QUIZ_QUESTIONS).toHaveLength(64);
    expect(CURATED_FLASHCARDS).toHaveLength(64);

    const uniqueQuestionIds = new Set(QUIZ_QUESTIONS.map((q) => q.id));
    expect(uniqueQuestionIds.size).toBe(QUIZ_QUESTIONS.length);

    const uniqueCardKeys = new Set(CURATED_FLASHCARDS.map((c) => c.cardKey));
    expect(uniqueCardKeys.size).toBe(CURATED_FLASHCARDS.length);

    for (const subject of STUDY_SUBJECTS) {
      expect(QUIZ_QUESTIONS.filter((q) => q.subjectId === subject.id)).toHaveLength(8);
      expect(CURATED_FLASHCARDS.filter((c) => c.subjectId === subject.id)).toHaveLength(8);
    }
  });

  it('interleaves multiple subjects in Mixed IGCSE Challenge queries', () => {
    const mixed = getQuizQuestions({ subjectId: 'mixed', limit: 8 });
    expect(mixed).toHaveLength(8);
    const subjects = new Set(mixed.map((q) => q.subjectId));
    expect(subjects.size).toBe(8);
  });
});

describe('Authoritative IGCSE quiz scoring & grade bands', () => {
  it('maps percentages accurately to Cambridge IGCSE grade bands', () => {
    expect(gradeBandForPercentage(100)).toBe('A*');
    expect(gradeBandForPercentage(90)).toBe('A*');
    expect(gradeBandForPercentage(85)).toBe('A');
    expect(gradeBandForPercentage(72)).toBe('B');
    expect(gradeBandForPercentage(60)).toBe('C');
    expect(gradeBandForPercentage(50)).toBe('D');
    expect(gradeBandForPercentage(42)).toBe('E');
    expect(gradeBandForPercentage(39)).toBe('U');
  });

  it('grades real submissions, computes topic breakdown, and flags weak topics (<70%)', () => {
    const bioQuestions = getQuizQuestions({ subjectId: 'biology', limit: 4 });
    const answers = bioQuestions.map((q, index) => ({
      questionId: q.id,
      // Answer first 3 correctly and 4th incorrectly
      selectedIndex: index < 3 ? q.correctIndex : ((q.correctIndex + 1) % 4),
    }));

    const summary = gradeQuizSubmission(answers);
    expect(summary.score).toBe(3);
    expect(summary.totalQuestions).toBe(4);
    expect(summary.percentage).toBe(75);
    expect(summary.gradeBand).toBe('B');
    expect(summary.results).toHaveLength(4);
    expect(summary.results[3].isCorrect).toBe(false);
    expect(summary.weakTopics).toContain(bioQuestions[3].topic);
  });

  it('rejects empty, duplicate, unknown, or out-of-range quiz submissions', () => {
    expect(() => gradeQuizSubmission([])).toThrow(/At least one/);
    expect(() =>
      gradeQuizSubmission([
        { questionId: 'bio-01', selectedIndex: 2 },
        { questionId: 'bio-01', selectedIndex: 2 },
      ])
    ).toThrow(/Duplicate question/);
    expect(() =>
      gradeQuizSubmission([{ questionId: 'does-not-exist', selectedIndex: 0 }])
    ).toThrow(/Unknown quiz question/);
    expect(() =>
      gradeQuizSubmission([{ questionId: 'bio-01', selectedIndex: 5 }])
    ).toThrow(/Invalid option index/);
  });
});

describe('Study flashcard input validation & privacy safety', () => {
  it('accepts clean IGCSE flashcards and blocks contact details or HTML tags', () => {
    const valid = customFlashcardCreateSchema.safeParse({
      subjectId: 'physics',
      topic: 'Motion & Forces',
      front: 'State Newtons second law equation.',
      back: 'F = ma (resultant force = mass x acceleration).',
      hint: 'Force in Newtons',
    });
    expect(valid.success).toBe(true);

    const withEmail = customFlashcardCreateSchema.safeParse({
      subjectId: 'physics',
      topic: 'Motion',
      front: 'Email me at student@wiseowl.zw for notes',
      back: 'Notes answer',
    });
    expect(withEmail.success).toBe(false);

    const withPhone = customFlashcardCreateSchema.safeParse({
      subjectId: 'physics',
      topic: 'Motion',
      front: 'Call +263 771 234 567',
      back: 'Notes answer',
    });
    expect(withPhone.success).toBe(false);

    const withHtml = customFlashcardCreateSchema.safeParse({
      subjectId: 'physics',
      topic: 'Motion',
      front: '<script>alert(1)</script>',
      back: 'Notes answer',
    });
    expect(withHtml.success).toBe(false);
  });

  it('validates flashcard review card keys strictly', () => {
    expect(
      flashcardReviewSchema.safeParse({
        cardKey: 'curated:fc-bio-1',
        subjectId: 'biology',
        rating: 'good',
      }).success
    ).toBe(true);

    expect(
      flashcardReviewSchema.safeParse({
        cardKey: 'custom:20000000-0000-4000-8000-000000000001',
        subjectId: 'biology',
        rating: 'easy',
      }).success
    ).toBe(true);

    expect(
      flashcardReviewSchema.safeParse({
        cardKey: '../evil',
        subjectId: 'biology',
        rating: 'good',
      }).success
    ).toBe(false);
  });
});
