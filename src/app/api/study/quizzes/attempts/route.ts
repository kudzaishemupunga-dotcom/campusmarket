
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getOwlAidUser } from '@/lib/owlaid/auth';
import { isSupabaseConfigured } from '@/lib/server/config';
import { isMissingStudyTableError } from '@/lib/server/hub-data';
import { hasValidOrigin } from '@/lib/server/request-guards';
import { studyServiceSupabase } from '@/lib/server/supabase';

import {
  gradeQuizSubmission,
  quizAttemptSubmissionSchema,
} from '@/lib/study/scoring';

import type { QuizAttemptRecord } from '@/lib/study/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REQUEST_SIZE = 24_000;

function json(data: object, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function logDatabaseError(
  operation: string,
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  }
) {
  // Server-side diagnostics only.
  // Never expose database details or credentials to the browser.
  console.error(`[STUDY API] ${operation} failed`, {
    code: error.code ?? 'unknown',
    message: error.message ?? 'No message',
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

export async function POST(request: NextRequest) {
  // ---------------------------------------------------
  // 1. Validate request origin
  // ---------------------------------------------------

  if (!hasValidOrigin(request)) {
    return json(
      { error: 'Invalid request origin.' },
      403
    );
  }

  try {
    // ---------------------------------------------------
    // 2. Authenticate approved student
    // ---------------------------------------------------

    const user = await getOwlAidUser();

    if (!user) {
      return json(
        {
          error:
            'Sign in with an approved school account to save quiz scores.',
        },
        401
      );
    }

    // ---------------------------------------------------
    // 3. Validate request size
    // ---------------------------------------------------

    const contentLength = Number(
      request.headers.get('content-length') ?? 0
    );

    if (contentLength > MAX_REQUEST_SIZE) {
      return json(
        { error: 'Request too large.' },
        413
      );
    }

    const raw = await request.text();

    if (raw.length > MAX_REQUEST_SIZE) {
      return json(
        { error: 'Request too large.' },
        413
      );
    }

    // ---------------------------------------------------
    // 4. Parse JSON safely
    // ---------------------------------------------------

    let body: unknown;

    try {
      body = JSON.parse(raw);
    } catch {
      return json(
        { error: 'Invalid JSON request.' },
        400
      );
    }

    const input = quizAttemptSubmissionSchema.parse(body);

    // ---------------------------------------------------
    // 5. Grade answers on the server
    // ---------------------------------------------------

    // Never trust scores supplied by the browser.
    const grading = gradeQuizSubmission(input.answers);

    // ---------------------------------------------------
    // 6. Validate selected subject
    // ---------------------------------------------------

    if (input.subjectId !== 'mixed') {
      const subjectMismatch = grading.results.some(
        (result) =>
          result.subjectId !== input.subjectId
      );

      if (subjectMismatch) {
        return json(
          {
            error:
              'Submitted questions do not match the selected subject.',
          },
          400
        );
      }
    }

    // ---------------------------------------------------
    // 7. Validate Cambridge tier
    // ---------------------------------------------------

    if (input.tier !== 'all') {
      const tierMismatch = grading.results.some(
        (result) =>
          result.difficulty !== input.tier
      );

      if (tierMismatch) {
        return json(
          {
            error:
              'Submitted questions do not match the selected Cambridge tier.',
          },
          400
        );
      }
    }

    // ---------------------------------------------------
    // 8. Prepare fallback attempt
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // 9. Handle unconfigured Supabase
    // ---------------------------------------------------

    if (!isSupabaseConfigured()) {
      return json(
        {
          attempt: fallbackAttempt,
          grading,
          persisted: false,
        },
        201
      );
    }

    // ---------------------------------------------------
    // 10. Initialize privileged study client
    // ---------------------------------------------------

    let serviceClient: ReturnType<
      typeof studyServiceSupabase
    >;

    try {
      serviceClient = studyServiceSupabase();
    } catch (error) {
      console.error(
        '[STUDY API] Service client initialization failed',
        error instanceof Error
          ? error.message
          : 'Unknown initialization error'
      );

      return json(
        {
          error:
            'Study persistence service is not configured.',
        },
        503
      );
    }

    // ---------------------------------------------------
    // 11. Insert server-graded attempt
    // ---------------------------------------------------

    // IMPORTANT:
    // user_id comes from authenticated server context.
    // Score fields come from server-side grading.
    // Student input cannot set either value.

    const { data, error: databaseError } =
      await serviceClient
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
.select(
  'id,subject_id,tier,mode,score,total_questions,percentage,grade_band,duration_seconds,weak_topics,created_at'
)
.single();


    // ---------------------------------------------------
    // 12. Handle database failures
    // ---------------------------------------------------

    if (databaseError) {
      logDatabaseError(
        'QUIZ_ATTEMPT_INSERT',
        databaseError
      );

      if (isMissingStudyTableError(databaseError)) {
        return json(
          {
            attempt: fallbackAttempt,
            grading,
            persisted: false,
            migrationRequired: true,
          },
          201
        );
      }

      return json(
        {
          error:
            'Could not save quiz attempt. Please try again.',
        },
        500
      );
    }

    if (!data) {
      console.error(
        '[STUDY API] Insert returned no data.'
      );

      return json(
        {
          error:
            'Quiz attempt could not be confirmed.',
        },
        500
      );
    }

    // ---------------------------------------------------
    // 13. Format saved attempt
    // ---------------------------------------------------

    const savedAttempt: QuizAttemptRecord = {
      id: String(data.id),
      subject_id: data.subject_id,
      tier: data.tier,
      mode: data.mode,
      score: Number(data.score),
      total_questions: Number(data.total_questions),
      percentage: Number(data.percentage),
      grade_band: data.grade_band,
      duration_seconds: Number(
        data.duration_seconds ?? 0
      ),
      weak_topics: Array.isArray(data.weak_topics)
        ? data.weak_topics.map(String)
        : [],
      created_at: String(data.created_at),
    };

    // ---------------------------------------------------
    // 14. Return successful result
    // ---------------------------------------------------

    return json(
      {
        attempt: savedAttempt,
        grading,
        persisted: true,
      },
      201
    );
  } catch (error) {
    // ---------------------------------------------------
    // 15. Handle unexpected errors safely
    // ---------------------------------------------------

    if (error instanceof z.ZodError) {
      return json(
        {
          error:
            error.issues[0]?.message ??
            'Invalid quiz submission.',
        },
        400
      );
    }

    if (
      error instanceof Error &&
      /Unknown quiz question|Duplicate question|Invalid option|At least one/.test(
        error.message
      )
    ) {
      return json(
        { error: error.message },
        400
      );
    }

    console.error(
      '[STUDY API] Unexpected quiz submission failure',
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : 'Unknown error'
    );

    return json(
      {
        error:
          'Quiz service is currently unavailable.',
      },
      503
    );
  }
}
