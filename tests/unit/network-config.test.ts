import { afterEach, describe, expect, it, vi } from 'vitest';
import { contentSecurityPolicy, developmentOrigins } from '@/lib/network-config';
vi.mock('server-only', () => ({}));
import { isAllowedRequestOrigin } from '@/lib/server/config';
afterEach(() => vi.unstubAllEnvs());
describe('explicit development networking without weakening production', () => {
  it('accepts a configured phone-accessible LAN origin with its port', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('CAMPUSMARKET_DEV_ORIGINS', 'http://192.168.1.20:3000');
    expect(isAllowedRequestOrigin('http://192.168.1.20:3000')).toBe(true);
    expect(isAllowedRequestOrigin('http://192.168.1.20:9999')).toBe(false);
    expect(isAllowedRequestOrigin('http://evil.example')).toBe(false);
    expect(isAllowedRequestOrigin(null)).toBe(false);
  });
  it('ignores all dev exceptions in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://campus.example');
    vi.stubEnv('CAMPUSMARKET_DEV_ORIGINS', 'http://192.168.1.20:3000');
    expect(isAllowedRequestOrigin('http://192.168.1.20:3000')).toBe(false);
    expect(isAllowedRequestOrigin('https://campus.example')).toBe(true);
    expect(developmentOrigins()).toEqual([]);
    const policy = contentSecurityPolicy({ NODE_ENV: 'production', CAMPUSMARKET_DEV_ORIGINS: 'http://192.168.1.20:3000', NEXT_PUBLIC_SUPABASE_URL: 'https://school.supabase.co' });
    expect(policy).not.toMatch(/unsafe-eval|192\.168|localhost|ws:|\*\.supabase/);
    expect(policy).toContain('https://school.supabase.co');
  });
  it.each(['*', 'http://*.example.com', 'http://user:pass@pc:3000', 'http://pc:3000/path', 'javascript:alert(1)', 'http://pc:3000?x=1'])('rejects ambiguous origin %s', value => {
    expect(() => developmentOrigins({ NODE_ENV: 'development', CAMPUSMARKET_DEV_ORIGINS: value })).toThrow();
  });
  it('permits only the configured storage host and development HMR connections', () => {
    const policy = contentSecurityPolicy({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: 'http://192.168.1.20:3000', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329' });
    expect(policy).toContain('ws://192.168.1.20:3000');
    expect(policy).toContain("img-src 'self' data: blob: http://127.0.0.1:54329");
    expect(policy).not.toContain('ws://*');
  });
});
