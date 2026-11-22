import { z } from 'zod';
import { containsContactInfo } from '@/lib/validation';
import { QUESTION_BY_ID } from './quizzes';
import {
  STUDY_SUBJECT_IDS,
  type GradeBand,
  type GradedQuestionResult,
  type QuizAnswerSubmission,
  type QuizGradingSummary,
  type TopicAccuracy,
} from './types';

export function gradeBandForPercentage(percentage: number): GradeBand {
  if (percentage >= 90) return 'A*';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'U';
}

export function gradeQuizSubmission(answers: readonly QuizAnswerSubmission[]): QuizGradingSummary {
  if (!answers.length) {
    throw new Error('At least one answered question is required to score a quiz.');
  }

  const seen = new Set<string>();
  const results: GradedQuestionResult[] = [];
  const topicTotals = new Map<string, { correct: number; total: number }>();

  for (const answer of answers) {
    if (seen.has(answer.questionId)) {
      throw new Error(`Duplicate question submission: ${answer.questionId}`);
    }
    seen.add(answer.questionId);

    const question = QUESTION_BY_ID.get(answer.questionId);
    if (!question) {
      throw new Error(`Unknown quiz question: ${answer.questionId}`);
    }
    if (!Number.isInteger(answer.selectedIndex) || answer.selectedIndex < 0 || answer.selectedIndex > 3) {
      throw new Error(`Invalid option index for question ${answer.questionId}`);
    }

    const isCorrect = answer.selectedIndex === question.correctIndex;
    results.push({
      questionId: question.id,
      subjectId: question.subjectId,
      topic: question.topic,
      difficulty: question.difficulty,
      syllabusRef: question.syllabusRef,
      prompt: question.prompt,
      options: question.options,
      selectedIndex: answer.selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect,
      explanation: question.explanation,
      examTip: question.examTip,
    });

    const prev = topicTotals.get(question.topic) ?? { correct: 0, total: 0 };
    prev.total += 1;
    if (isCorrect) prev.correct += 1;
    topicTotals.set(question.topic, prev);
  }

  const score = results.filter((r) => r.isCorrect).length;
  const totalQuestions = results.length;
  const percentage = Math.round((score / totalQuestions) * 100);
  const gradeBand = gradeBandForPercentage(percentage);

  const topicBreakdown: TopicAccuracy[] = [...topicTotals.entries()]
    .map(([topic, stat]) => ({
      topic,
      correct: stat.correct,
      total: stat.total,
      percentage: Math.round((stat.correct / stat.total) * 100),
    }))
    .sort((a, b) => a.percentage - b.percentage || a.topic.localeCompare(b.topic));

  const weakTopics = topicBreakdown.filter((item) => item.percentage < 70).map((item) => item.topic);

  return {
    score,
    totalQuestions,
    percentage,
    gradeBand,
    weakTopics,
    topicBreakdown,
    results,
  };
}

const studySubjectEnum = z.enum(STUDY_SUBJECT_IDS);

export const quizAttemptSubmissionSchema = z.object({
  subjectId: z.union([studySubjectEnum, z.literal('mixed')]),
  tier: z.enum(['all', 'core', 'extended']).default('all'),
  mode: z.enum(['practice', 'exam']).default('practice'),
  durationSeconds: z.number().int().min(0).max(7200).default(0),
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(2).max(60),
        selectedIndex: z.number().int().min(0).max(3),
      })
    )
    .min(1, 'Answer at least one question before submitting.')
    .max(64, 'Too many quiz answers in a single attempt.'),
});

const safeStudyText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Use at least ${min} characters for ${label}.`)
    .max(max, `Keep ${label} within ${max} characters.`)
    .refine((value) => !/[<>\x00-\x1f]/.test(value), `Use plain text for ${label}.`)
    .refine(
      (value) => !containsContactInfo(value),
      `Do not include email addresses or phone numbers in ${label}.`
    );

export const customFlashcardCreateSchema = z.object({
  subjectId: studySubjectEnum,
  topic: safeStudyText('the topic', 2, 80),
  front: safeStudyText('the question/prompt side', 3, 400),
  back: safeStudyText('the answer side', 3, 800),
  hint: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value ?? null),
    safeStudyText('the hint', 2, 240).nullable().default(null)
  ),
});

export const flashcardReviewSchema = z.object({
  cardKey: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^(curated:[a-z0-9-]+|custom:[0-9a-f-]{36})$/i, 'Choose a valid flashcard.'),
  subjectId: studySubjectEnum,
  rating: z.enum(['again', 'hard', 'good', 'easy']),
});
