import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwlAidUser } from '@/lib/owlaid/auth';
import { isSupabaseConfigured } from '@/lib/server/config';
import { isMissingStudyTableError } from '@/lib/server/hub-data';
import { hasValidOrigin } from '@/lib/server/request-guards';
import { serverSupabase } from '@/lib/server/supabase';
import { gradeQuizSubmission, quizAttemptSubmissionSchema } from '@/lib/study/scoring';
import type { QuizAttemptRecord } from '@/lib/study/types';

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
      return json({ error: 'Sign in with an approved school account to save quiz scores.' }, 401);
    }

    if (Number(request.headers.get('content-length')) > 24000) {
      return json({ error: 'Request too large' }, 413);
    }
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: 'Request too large' }, 413);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const input = quizAttemptSubmissionSchema.parse(parsedBody);
    const grading = gradeQuizSubmission(input.answers);

    // Ensure non-mixed quiz submissions only contain questions from the selected subject
    if (input.subjectId !== 'mixed') {
      const mismatch = grading.results.some((item) => item.subjectId !== input.subjectId);
      if (mismatch) {
        return json({ error: 'Submitted questions do not match the selected subject.' }, 400);
      }
    }

    const fallbackAttempt: QuizAttemptRecord = {
      id: `local-${Date.now()}`,
      subject_id: input.subjectId,
      tier: input.tier,
      mode: input.mode,
      score: grading.score,
      total_questions: grading.totalQuestions,
      percentage: grading.percentage,
      grade_band: grading.gradeBand,
      duration_seconds: input.durationSeconds,
      weak_topics: grading.weakTopics,
      created_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured()) {
      return json({ attempt: fallbackAttempt, grading, persisted: false }, 201);
    }

    const client = await serverSupabase();
    const { data, error } = await client
      .from('study_quiz_attempts')
      .insert({
        user_id: user.id,
        subject_id: input.subjectId,
        tier: input.tier,
        mode: input.mode,
        score: grading.score,
        total_questions: grading.totalQuestions,
        percentage: grading.percentage,
        grade_band: grading.gradeBand,
        duration_seconds: input.durationSeconds,
        weak_topics: grading.weakTopics,
      })
      .select('id,subject_id,tier,mode,score,total_questions,percentage,grade_band,duration_seconds,weak_topics,created_at')
      .single();

    if (error) {
      if (isMissingStudyTableError(error)) {
        return json({ attempt: fallbackAttempt, grading, persisted: false, migrationRequired: true }, 201);
      }
      return json({ error: 'Could not save quiz attempt. Please try again.' }, 500);
    }

    const savedAttempt: QuizAttemptRecord = {
      id: String(data.id),
      subject_id: data.subject_id,
      tier: data.tier,
      mode: data.mode,
      score: Number(data.score),
      total_questions: Number(data.total_questions),
      percentage: Number(data.percentage),
      grade_band: data.grade_band,
      duration_seconds: Number(data.duration_seconds ?? 0),
      weak_topics: Array.isArray(data.weak_topics) ? data.weak_topics.map(String) : [],
      created_at: String(data.created_at),
    };

    return json({ attempt: savedAttempt, grading, persisted: true }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: error.issues[0]?.message || 'Invalid quiz submission.' }, 400);
    }
    if (error instanceof Error && /Unknown quiz question|Duplicate question|Invalid option|At least one/.test(error.message)) {
      return json({ error: error.message }, 400);
    }
    return json({ error: 'Quiz service is currently unavailable.' }, 503);
  }
}
