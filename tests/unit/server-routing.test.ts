import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/types';

const mock = vi.hoisted(() => ({ demo: vi.fn(), configured: vi.fn(), context: vi.fn(), from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/config', () => ({ isDemoMode: mock.demo, isSupabaseConfigured: mock.configured }));
vi.mock('@/lib/server/auth', () => ({ getSessionContext: mock.context }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  notFound: () => { throw new Error('NOT_FOUND'); },
}));
import { getPageData } from '@/lib/server/data';

const profile: Profile = {
  id: '20000000-0000-4000-8000-000000000001', display_name: 'Fictional Student', role: 'student',
  avatar_path: null, verification_status: 'approved', created_at: '2026-01-01', updated_at: '2026-01-01',
};

beforeEach(() => {
  mock.demo.mockReturnValue(false);
  mock.configured.mockReturnValue(true);
  mock.context.mockResolvedValue({ user: { id: profile.id }, profile, client: { from: mock.from } });
});

describe('private route guards before data access', () => {
  it.each(['/', '/explore', '/dashboard', '/sell', '/admin/users', '/listing/30000000-0000-4000-8000-000000000001'])('redirects anonymous requests to %s before listing queries', async (path) => {
    mock.context.mockResolvedValue({ user: null, profile: null, client: { from: mock.from } });
    await expect(getPageData(path)).rejects.toThrow('REDIRECT:/login');
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each(['pending', 'rejected', 'suspended'])('does not load marketplace data for %s accounts', async (verification_status) => {
    mock.context.mockResolvedValue({ user: { id: profile.id }, profile: { ...profile, verification_status }, client: { from: mock.from } });
    await expect(getPageData('/explore')).rejects.toThrow('REDIRECT:/pending-approval');
    expect(mock.from).not.toHaveBeenCalled();
    expect((await getPageData('/pending-approval')).listings).toEqual([]);
  });
  it.each(['/admin', '/admin/users', '/admin/listings', '/admin/reports'])('rejects student requests for %s before moderation queries', async (path) => {
    await expect(getPageData(path)).rejects.toThrow('REDIRECT:/dashboard');
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('returns no fictional or private data for an unconfigured non-demo server', async () => {
    mock.configured.mockReturnValue(false);
    const data = await getPageData('/');
    expect(data.mode).toBe('unconfigured');
    expect(data.listings).toEqual([]);
    expect(data.profile).toBeNull();
    expect(mock.context).not.toHaveBeenCalled();
  });
});
