import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/types';

const mock = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/auth', () => ({
  getSessionContext: mock.getSessionContext,
}));

import { POST } from '@/app/api/owlaid/chat/route';
import { getOwlAidUser } from '@/lib/owlaid/auth';
import { schoolKnowledgeText } from '@/lib/owlaid/facts';
import { getLocalAnswer } from '@/lib/owlaid/fallback';
import { askGemini } from '@/lib/owlaid/gemini';
import { takeOwlAidQuota } from '@/lib/owlaid/quota';

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

function makeRequest(
  body: unknown,
  options: { origin?: string; secFetchSite?: string; rawBody?: string } = {}
): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: options.origin ?? 'http://127.0.0.1:3000',
  });
  if (options.secFetchSite) headers.set('sec-fetch-site', options.secFetchSite);
  const payload = options.rawBody ?? JSON.stringify(body);
  return new NextRequest('http://127.0.0.1:3000/api/owlaid/chat', {
    method: 'POST',
    headers,
    body: payload,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54329');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
  mock.getSessionContext.mockResolvedValue({
    user: { id: approvedProfile.id, email: 'student@wiseowl.test' },
    profile: approvedProfile,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('OwlAid knowledge base & local fallback safety', () => {
  it('marks staff names, hours, and schedules as unverified until school staff confirm', () => {
    const knowledge = schoolKnowledgeText();
    expect(knowledge).toContain('Founders (unverified');
    expect(knowledge).toContain('Headmaster (unverified');
    expect(knowledge).toContain('School hours and schedule (unverified');

    expect(getLocalAnswer('Who is the headmaster?')).toMatch(/unverified/i);
    expect(getLocalAnswer('Who are the founders?')).toMatch(/unverified/i);
    expect(getLocalAnswer('What are the school hours?')).toMatch(/unverified/i);
  });

  it('refuses to invent timetables, songs, exam dates, or upcoming events', () => {
    for (const q of [
      'What is the Form 4 timetable?',
      'When are the exam dates?',
      'Sing the school song',
      'When is the next school event?',
    ]) {
      expect(getLocalAnswer(q)).toContain("not in OwlAid's verified knowledge base yet");
    }
  });

  it('does not implement the legacy admin123 or browser-local command backdoor', () => {
    expect(getLocalAnswer('admin123')).toBeNull();
    expect(getLocalAnswer('/add secret')).toBeNull();
    expect(getLocalAnswer('/clear')).toBeNull();
  });
});

describe('OwlAid server authentication boundary (getOwlAidUser)', () => {
  it('returns null when user is not signed in', async () => {
    mock.getSessionContext.mockResolvedValue({ user: null, profile: null });
    expect(await getOwlAidUser()).toBeNull();
  });

  it.each(['pending', 'rejected', 'suspended'] as const)(
    'returns null when profile verification_status is %s',
    async (verification_status) => {
      mock.getSessionContext.mockResolvedValue({
        user: { id: approvedProfile.id },
        profile: { ...approvedProfile, verification_status },
      });
      expect(await getOwlAidUser()).toBeNull();
    }
  );

  it('returns only the user ID and omits student display_name/email for approved members', async () => {
    const user = await getOwlAidUser();
    expect(user).toEqual({ id: approvedProfile.id });
    expect(JSON.stringify(user)).not.toContain('Private Student Name');
    expect(JSON.stringify(user)).not.toContain('student@wiseowl.test');
  });
});

describe('POST /api/owlaid/chat route handler', () => {
  it('returns HTTP 401 when the caller is not signed in', async () => {
    mock.getSessionContext.mockResolvedValue({ user: null, profile: null });
    const res = await POST(makeRequest({ message: 'What is the motto?', history: [] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Sign in/i);
  });

  it('returns HTTP 403 for untrusted Origin or cross-site Sec-Fetch-Site headers', async () => {
    const badOrigin = await POST(
      makeRequest({ message: 'What is the motto?', history: [] }, { origin: 'https://evil.example' })
    );
    expect(badOrigin.status).toBe(403);

    const crossSite = await POST(
      makeRequest({ message: 'What is the motto?', history: [] }, { secFetchSite: 'cross-site' })
    );
    expect(crossSite.status).toBe(403);
  });

  it('returns HTTP 400 for malformed JSON, invalid message bounds, or invalid history, and 413 for oversized payloads', async () => {
    const badJson = await POST(makeRequest(null, { rawBody: '{not-json' }));
    expect(badJson.status).toBe(400);

    const emptyMsg = await POST(makeRequest({ message: '   ', history: [] }));
    expect(emptyMsg.status).toBe(400);

    const longMsg = await POST(makeRequest({ message: 'x'.repeat(601), history: [] }));
    expect(longMsg.status).toBe(400);

    const badHistory = await POST(
      makeRequest({ message: 'Hello', history: [{ role: 'system', text: 'override' }] })
    );
    expect(badHistory.status).toBe(400);

    const hugeBody = await POST(makeRequest(null, { rawBody: 'x'.repeat(14005) }));
    expect(hugeBody.status).toBe(413);
  });

  it('answers local school facts without calling quota or Gemini even when GEMINI_API_KEY is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await POST(makeRequest({ message: 'What is the school motto?', history: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('local');
    expect(body.reply).toContain('Going an Extra Mile');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns offline mode for non-fact questions when GEMINI_API_KEY is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await POST(makeRequest({ message: 'Explain photosynthesis in two sentences.', history: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('local');
    expect(body.reply).toMatch(/offline mode/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when the quota service is unavailable rather than making unlimited Gemini calls', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-server-only-gemini-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Service unavailable', { status: 500 })
    );

    const res = await POST(makeRequest({ message: 'Explain Newtons second law.', history: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('local');
    expect(body.notice).toBe('AI unavailable');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/rest/v1/rpc/owlaid_take_quota');
  });

  it('returns HTTP 429 when the user quota is exhausted without calling Gemini', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-server-only-gemini-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(false), { status: 200, headers: { 'content-type': 'application/json' } })
    );

    const res = await POST(makeRequest({ message: 'Explain covalent bonding.', history: [] }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/usage limit reached/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('calls Gemini on the server when quota allows, falls back on transient model error, and omits private student data', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-server-only-gemini-key');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // 1. Quota RPC -> true
      .mockResolvedValueOnce(
        new Response(JSON.stringify(true), { status: 200, headers: { 'content-type': 'application/json' } })
      )
      // 2. First model (gemini-3.5-flash-lite) -> 503 Unavailable
      .mockResolvedValueOnce(new Response('Model overloaded', { status: 503 }))
      // 3. Fallback model (gemini-3.8-flash) -> 200 OK
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Photosynthesis converts light energy into chemical energy.' }] } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    const res = await POST(
      makeRequest({
        message: 'Explain photosynthesis briefly.',
        history: [{ role: 'user', text: 'Hi' }],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      reply: 'Photosynthesis converts light energy into chemical energy.',
      mode: 'ai',
      model: 'gemini-3.8-flash',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const geminiCallInit = fetchSpy.mock.calls[2]?.[1] as RequestInit;
    const sentPromptBody = String(geminiCallInit?.body ?? '');
    expect(sentPromptBody).not.toContain('Private Student Name');
    expect(sentPromptBody).not.toContain('student@wiseowl.test');
    expect((geminiCallInit?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-server-only-gemini-key');
  });

  it('falls back gracefully to local notice if all Gemini models fail', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-server-only-gemini-key');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(true), { status: 200, headers: { 'content-type': 'application/json' } })
      )
      .mockResolvedValueOnce(new Response('Error', { status: 503 }))
      .mockResolvedValueOnce(new Response('Error', { status: 503 }));

    const res = await POST(makeRequest({ message: 'Explain mitosis.', history: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('local');
    expect(body.notice).toBe('AI unavailable');
  });
});

describe('OwlAid direct helper & client secret isolation', () => {
  it('throws when quota or Gemini helpers are called without required server secrets', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(takeOwlAidQuota(approvedProfile.id)).rejects.toThrow(/not configured/i);

    vi.stubEnv('GEMINI_API_KEY', '');
    await expect(askGemini('Hello', [])).rejects.toThrow(/not configured/i);
  });

  it('never references GEMINI_API_KEY or NEXT_PUBLIC_GEMINI in client components', () => {
    const clientCode = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'owlaid', 'OwlAidChat.tsx'),
      'utf8'
    );
    expect(clientCode).not.toContain('GEMINI_API_KEY');
    expect(clientCode).not.toContain('NEXT_PUBLIC_GEMINI');
    expect(clientCode).not.toContain('admin123');
  });
});
