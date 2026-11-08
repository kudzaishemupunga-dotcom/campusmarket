import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({
  demo: vi.fn(),
  configured: vi.fn(),
  exchange: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/config', () => ({
  isDemoMode: mock.demo,
  isSupabaseConfigured: mock.configured,
  siteUrl: () => 'https://campus.example',
}));
vi.mock('@/lib/server/supabase', () => ({
  serverSupabase: async () => ({
    auth: {
      exchangeCodeForSession: mock.exchange,
      verifyOtp: mock.verifyOtp,
    },
  }),
}));

import { GET } from '@/app/auth/callback/route';

beforeEach(() => {
  mock.demo.mockReturnValue(false);
  mock.configured.mockReturnValue(true);
  mock.exchange.mockResolvedValue({ error: null });
  mock.verifyOtp.mockResolvedValue({ error: null });
});

describe('auth callback security boundaries', () => {
  it('blocks callback session exchange in demo or unconfigured mode', async () => {
    mock.demo.mockReturnValue(true);
    const res1 = await GET(new NextRequest('https://campus.example/auth/callback?code=abc'));
    expect(res1.headers.get('location')).toBe('https://campus.example/login?notice=configuration-required');
    expect(mock.exchange).not.toHaveBeenCalled();

    mock.demo.mockReturnValue(false);
    mock.configured.mockReturnValue(false);
    const res2 = await GET(new NextRequest('https://campus.example/auth/callback?code=abc'));
    expect(res2.headers.get('location')).toBe('https://campus.example/login?notice=configuration-required');
  });

  it('prevents open redirects and routes verified signups to pending approval', async () => {
    const res = await GET(new NextRequest('https://campus.example/auth/callback?code=valid-code&next=https://evil.example'));
    expect(mock.exchange).toHaveBeenCalledWith('valid-code');
    expect(res.headers.get('location')).toBe('https://campus.example/pending-approval');
  });

  it('routes valid recovery OTP tokens to /reset-password and rejects invalid links', async () => {
    const ok = await GET(new NextRequest('https://campus.example/auth/callback?token_hash=hash123&type=recovery'));
    expect(mock.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash123', type: 'recovery' });
    expect(ok.headers.get('location')).toBe('https://campus.example/reset-password');

    mock.exchange.mockResolvedValue({ error: new Error('expired') });
    const bad = await GET(new NextRequest('https://campus.example/auth/callback?code=expired'));
    expect(bad.headers.get('location')).toBe('https://campus.example/login?notice=invalid-link');
  });
});
