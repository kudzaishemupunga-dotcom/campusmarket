import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/types';

const mock = vi.hoisted(() => ({ getUser: vi.fn(), single: vi.fn(), from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/supabase', () => ({
  serverSupabase: vi.fn(async () => ({ auth: { getUser: mock.getUser }, from: mock.from })),
}));
import { getSessionContext, requireMember } from '@/lib/server/auth';

const profile: Profile = {
  id: '20000000-0000-4000-8000-000000000001',
  display_name: 'Test Learner',
  role: 'student',
  avatar_path: null,
  verification_status: 'approved',
  seller_type: 'individual',
  seller_approved: true,
  project_summary: 'Woodwork practical',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

beforeEach(() => {
  mock.from.mockReturnValue({ select: () => ({ eq: () => ({ single: mock.single }) }) });
  mock.getUser.mockResolvedValue({ data: { user: { id: profile.id, email_confirmed_at: '2026-01-01' } }, error: null });
  mock.single.mockResolvedValue({ data: profile, error: null });
});

describe('authoritative server identity', () => {
  it('denies anonymous callers without reading profiles', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireMember()).rejects.toThrow('Please sign in');
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('denies unverified email identities even if Auth returns a user', async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: profile.id } }, error: null });
    await expect(requireMember()).rejects.toThrow('Please sign in');
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('fails closed on an Auth verification error', async () => {
    mock.getUser.mockResolvedValue({
      data: { user: { id: profile.id, email_confirmed_at: '2026-01-01' } },
      error: new Error('Expired token'),
    });
    await expect(requireMember()).rejects.toThrow('Please sign in');
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('does not grant membership when the profile lookup fails', async () => {
    mock.single.mockResolvedValue({ data: null, error: new Error('Unavailable') });
    await expect(requireMember()).rejects.toThrow('approve');
  });
  it.each(['pending', 'rejected', 'suspended'])('denies database profile state %s', async (verification_status) => {
    mock.single.mockResolvedValue({ data: { ...profile, verification_status }, error: null });
    await expect(requireMember()).rejects.toThrow('approve');
  });
  it('ignores an administrator claim in user-editable Auth metadata', async () => {
    mock.getUser.mockResolvedValue({
      data: {
        user: {
          id: profile.id,
          email_confirmed_at: '2026-01-01',
          user_metadata: { role: 'admin', verification_status: 'approved', seller_approved: true },
        },
      },
      error: null,
    });
    await expect(requireMember(true)).rejects.toThrow('permission');
  });
  it('uses the database role for an approved administrator', async () => {
    mock.single.mockResolvedValue({ data: { ...profile, role: 'admin' }, error: null });
    expect((await requireMember(true)).profile.role).toBe('admin');
    expect((await getSessionContext()).profile?.id).toBe(profile.id);
  });
});
