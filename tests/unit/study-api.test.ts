import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/types';

const mock = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  serverSupabase: vi.fn(),
  isSupabaseConfigured: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/auth', () => ({
  getSessionContext: mock.getSessionContext,
}));
vi.mock('@/lib/server/supabase', () => ({
  serverSupabase: mock.serverSupabase,
}));
vi.mock('@/lib/server/config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/config')>('@/lib/server/config');
  return {
    ...actual,
    isSupabaseConfigured: mock.isSupabaseConfigured,
  };
});

import { POST as postOwlAid } from '@/app/api/owlaid/chat/route';
import { GET as getProgress } from '@/app/api/study/progress/route';
import { POST as postAttempt } from '@/app/api/study/quizzes/attempts/route';
import { POST as postFlashcard } from '@/app/api/study/flashcards/route';
import { DELETE as deleteFlashcard } from '@/app/api/study/flashcards/[id]/route';
import { POST as postReview } from '@/app/api/study/flashcards/review/route';

const approvedProfile: Profile = {
  id: '20000000-0000-4000-8000-000000000001',
  display_name: 'Private Student Name',
  role: 'student',
  avatar_path: null,
  verification_status: 'approved',
  seller_type: 'none',
  seller_approved: false,
  project_summary: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

function makeJsonRequest(
  url: string,
  method: string,
  body?: unknown,
  options: { origin?: string; secFetchSite?: string; rawBody?: string } = {}
): NextRequest {
  const headers = new Headers({
    origin: options.origin ?? 'http://127.0.0.1:3000',
  });
  if (method !== 'GET' && method !== 'DELETE') {
    headers.set('content-type', 'application/json');
  }
  if (options.secFetchSite) headers.set('sec-fetch-site', options.secFetchSite);
  return new NextRequest(url, {
    method,
    headers,
    body: options.rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54329');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
  mock.isSupabaseConfigured.mockReturnValue(true);
  mock.getSessionContext.mockResolvedValue({
    user: { id: approvedProfile.id, email: 'student@wiseowl.test' },
    profile: approvedProfile,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('OwlAid 5.0 IGCSE Study Mode API', () => {
  it('rejects malformed study mode options with HTTP 400', async () => {
    const res = await postOwlAid(
      makeJsonRequest('http://127.0.0.1:3000/api/owlaid/chat', 'POST', {
        message: 'Explain osmosis',
        history: [],
        study: { enabled: true, subjectId: 'astrology', coachMode: 'explain', tier: 'extended' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('serves curated offline IGCSE reference when GEMINI_API_KEY is missing in IGCSE Study Mode', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = await postOwlAid(
      makeJsonRequest('http://127.0.0.1:3000/api/owlaid/chat', 'POST', {
        message: 'Explain osmosis and water potential in plant cells',
        history: [],
        study: { enabled: true, subjectId: 'biology', coachMode: 'mark-scheme', tier: 'extended' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('local');
    expect(body.notice).toBe('Offline IGCSE reference');
    expect(body.reply).toContain('Biology (IGCSE 0610');
    expect(body.reply).toMatch(/water potential/i);
  });

  it('still refuses to fabricate Wise Owl exam dates inside IGCSE Study Mode', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await postOwlAid(
      makeJsonRequest('http://127.0.0.1:3000/api/owlaid/chat', 'POST', {
        message: 'When are the school exam dates?',
        history: [],
        study: { enabled: true, subjectId: 'biology', coachMode: 'explain', tier: 'core' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('local');
    expect(body.reply).toContain("not in OwlAid's verified knowledge base yet");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends Cambridge IGCSE syllabus system instructions to Gemini without private student details', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-server-key');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(true), { status: 200, headers: { 'content-type': 'application/json' } })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Active site shape changes when bonds break.' }] } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    const res = await postOwlAid(
      makeJsonRequest('http://127.0.0.1:3000/api/owlaid/chat', 'POST', {
        message: 'Explain enzyme denaturation for 4 marks',
        history: [],
        study: { enabled: true, subjectId: 'biology', coachMode: 'mark-scheme', tier: 'extended' },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('ai');
    expect(body.reply).toContain('Active site');

    const sentBody = String((fetchSpy.mock.calls[1]?.[1] as RequestInit)?.body ?? '');
    expect(sentBody).toContain('Biology (IGCSE 0610)');
    expect(sentBody).toContain('Extended');
    expect(sentBody).not.toContain('Private Student Name');
    expect(sentBody).not.toContain('student@wiseowl.test');
  });
});

describe('Study Progress, Quizzes & Flashcards API security boundaries', () => {
  it('enforces 401 for unauthenticated callers and 403 for untrusted origins across all study endpoints', async () => {
    mock.getSessionContext.mockResolvedValue({ user: null, profile: null });

    expect((await getProgress(makeJsonRequest('http://127.0.0.1:3000/api/study/progress', 'GET'))).status).toBe(401);
    expect(
      (
        await postAttempt(
          makeJsonRequest('http://127.0.0.1:3000/api/study/quizzes/attempts', 'POST', {
            subjectId: 'biology',
            answers: [{ questionId: 'bio-01', selectedIndex: 2 }],
          })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await postFlashcard(
          makeJsonRequest('http://127.0.0.1:3000/api/study/flashcards', 'POST', {
            subjectId: 'biology',
            topic: 'Cells',
            front: 'Front?',
            back: 'Back answer',
          })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await postReview(
          makeJsonRequest('http://127.0.0.1:3000/api/study/flashcards/review', 'POST', {
            cardKey: 'curated:fc-bio-1',
            subjectId: 'biology',
            rating: 'good',
          })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await deleteFlashcard(
          makeJsonRequest('http://127.0.0.1:3000/api/study/flashcards/20000000-0000-4000-8000-000000000099', 'DELETE'),
          { params: Promise.resolve({ id: '20000000-0000-4000-8000-000000000099' }) }
        )
      ).status
    ).toBe(401);

    // Cross-site / untrusted Origin blocked with 403 even before auth
    expect(
      (
        await postAttempt(
          makeJsonRequest(
            'http://127.0.0.1:3000/api/study/quizzes/attempts',
            'POST',
            { subjectId: 'biology', answers: [{ questionId: 'bio-01', selectedIndex: 2 }] },
            { origin: 'https://evil.example' }
          )
        )
      ).status
    ).toBe(403);
  });

  it('grades quiz submissions authoritatively on the server and rejects subject mismatches', async () => {
    const insertedRow = {
      id: '30000000-0000-4000-8000-000000000010',
      subject_id: 'biology',
      tier: 'all',
      mode: 'practice',
      score: 1,
      total_questions: 2,
      percentage: 50,
      grade_band: 'D',
      duration_seconds: 30,
      weak_topics: ['Cell Structure & Transport'],
      created_at: '2026-11-22T12:00:00.000Z',
    };
    const insertSpy = vi.fn().mockReturnValue({
      select: () => ({ single: async () => ({ data: insertedRow, error: null }) }),
    });
    mock.serverSupabase.mockResolvedValue({
      from: () => ({ insert: insertSpy }),
    });

    // Rejects submitting a physics question under biology
    const mismatch = await postAttempt(
      makeJsonRequest('http://127.0.0.1:3000/api/study/quizzes/attempts', 'POST', {
        subjectId: 'biology',
        tier: 'all',
        mode: 'practice',
        durationSeconds: 12,
        answers: [{ questionId: 'phys-01', selectedIndex: 1 }],
      })
    );
    expect(mismatch.status).toBe(400);

    // Server computes authoritative score (bio-01 correct=2, bio-02 correct=1; submit 2 and 0 => 1/2 = 50% D)
    const okRes = await postAttempt(
      makeJsonRequest('http://127.0.0.1:3000/api/study/quizzes/attempts', 'POST', {
        subjectId: 'biology',
        tier: 'all',
        mode: 'practice',
        durationSeconds: 30,
        answers: [
          { questionId: 'bio-01', selectedIndex: 2 },
          { questionId: 'bio-02', selectedIndex: 0 },
        ],
      })
    );
    expect(okRes.status).toBe(201);
    const body = await okRes.json();
    expect(body.persisted).toBe(true);
    expect(body.grading.score).toBe(1);
    expect(body.grading.percentage).toBe(50);
    expect(body.grading.gradeBand).toBe('D');
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: approvedProfile.id,
        score: 1,
        total_questions: 2,
        percentage: 50,
        grade_band: 'D',
      })
    );
  });

  it('degrades gracefully when the study migration table has not yet been applied (42P01)', async () => {
    mock.serverSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: null,
                error: { code: '42P01', message: 'relation "public.study_quiz_attempts" does not exist' },
              }),
            }),
          }),
        }),
      }),
    });

    const res = await getProgress(makeJsonRequest('http://127.0.0.1:3000/api/study/progress', 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(false);
    expect(body.migrationRequired).toBe(true);
  });

  it('blocks personal contact info in custom flashcards and supports spaced-repetition review upsert', async () => {
    const blocked = await postFlashcard(
      makeJsonRequest('http://127.0.0.1:3000/api/study/flashcards', 'POST', {
        subjectId: 'chemistry',
        topic: 'Acids',
        front: 'Message me on 0771 234 567',
        back: 'Carbon dioxide is released',
      })
    );
    expect(blocked.status).toBe(400);

    const savedReview = {
      card_key: 'curated:fc-chem-1',
      subject_id: 'chemistry',
      box: 1,
      ease_factor: 2.55,
      interval_days: 1,
      repetitions: 1,
      lapses: 0,
      last_rating: 'good',
      next_review_at: '2026-11-23T12:00:00.000Z',
      reviewed_at: '2026-11-22T12:00:00.000Z',
    };
    mock.serverSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: savedReview, error: null }),
          }),
        }),
      }),
    });

    const reviewRes = await postReview(
      makeJsonRequest('http://127.0.0.1:3000/api/study/flashcards/review', 'POST', {
        cardKey: 'curated:fc-chem-1',
        subjectId: 'chemistry',
        rating: 'good',
      })
    );
    expect(reviewRes.status).toBe(200);
    const body = await reviewRes.json();
    expect(body.persisted).toBe(true);
    expect(body.review.box).toBe(1);
    expect(body.review.interval_days).toBe(1);
  });
});
