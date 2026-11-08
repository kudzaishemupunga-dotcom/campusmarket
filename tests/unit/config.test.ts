import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { isDemoMode, isSupabaseConfigured, siteUrl } from '@/lib/server/config';

afterEach(() => vi.unstubAllEnvs());

describe('development isolation', () => {
  it('requires explicit opt-in for demo mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CAMPUSMARKET_DEMO', 'false');
    expect(isDemoMode()).toBe(false);
    vi.stubEnv('CAMPUSMARKET_DEMO', 'true');
    expect(isDemoMode()).toBe(true);
  });
  it('never enables demo authorization in production even when its flag is present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CAMPUSMARKET_DEMO', 'true');
    expect(isDemoMode()).toBe(false);
  });
  it('requires both public Supabase connection values', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fictional.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe('canonical origin safety', () => {
  it('requires an explicit HTTPS origin in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(siteUrl).toThrow();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://campus.example');
    expect(siteUrl).toThrow();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://campus.example/ignored/path');
    expect(siteUrl()).toBe('https://campus.example');
  });
  it('rejects non-HTTP URL schemes', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'javascript:alert(1)');
    expect(siteUrl).toThrow();
  });
});
