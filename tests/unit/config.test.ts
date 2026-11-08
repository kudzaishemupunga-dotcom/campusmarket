import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { isSupabaseConfigured, siteUrl } from '@/lib/server/config';

afterEach(() => vi.unstubAllEnvs());

describe('Supabase configuration safety', () => {
  it('requires both public Supabase connection values', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fictional.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_key');
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe('zero fictional demo fixtures in runtime codebase', () => {
  const root = process.cwd();

  it('removes legacy demo fixtures, SVG product illustrations, and generator scripts', () => {
    expect(fs.existsSync(path.join(root, 'src', 'lib', 'demo.ts'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'scripts', 'generate-demo-art.mjs'))).toBe(false);
    const publicProducts = path.join(root, 'public', 'products');
    if (fs.existsSync(publicProducts)) {
      expect(fs.readdirSync(publicProducts)).toEqual([]);
    }
  });

  it('contains no CAMPUSMARKET_DEMO toggle anywhere in src/', () => {
    const srcFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) srcFiles.push(full);
      }
    };
    walk(path.join(root, 'src'));
    for (const file of srcFiles) {
      expect(fs.readFileSync(file, 'utf8')).not.toContain('CAMPUSMARKET_DEMO');
    }
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
