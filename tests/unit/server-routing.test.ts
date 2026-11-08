import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/types';

const mock = vi.hoisted(() => ({ configured: vi.fn(), context: vi.fn(), from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/config', () => ({ isSupabaseConfigured: mock.configured }));
vi.mock('@/lib/server/auth', () => ({ getSessionContext: mock.context }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
import { getPageData } from '@/lib/server/data';

const profile: Profile = {
  id: '20000000-0000-4000-8000-000000000001',
  display_name: 'Test Learner',
  role: 'student',
  avatar_path: null,
  verification_status: 'approved',
  seller_type: 'individual',
  seller_approved: true,
  project_summary: 'Practical woodwork',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

beforeEach(() => {
  mock.configured.mockReturnValue(true);
  mock.from.mockReset();
  mock.context.mockResolvedValue({ user: { id: profile.id }, profile, client: { from: mock.from } });
});

describe('route guards and zero-fixture unconfigured behavior', () => {
  it.each(['/', '/about', '/seller', '/seller/register'])('serves public informational page %s to anonymous visitors with zero private data', async (path) => {
    mock.context.mockResolvedValue({ user: null, profile: null, client: { from: mock.from } });
    const data = await getPageData(path);
    expect(data.listings).toEqual([]);
    expect(data.groups).toEqual([]);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it.each([
    '/marketplace',
    '/projects',
    '/seller/dashboard',
    '/seller/products',
    '/seller/products/new',
    '/seller/group',
    '/admin/users',
    '/product/30000000-0000-4000-8000-000000000001',
  ])('redirects anonymous requests to %s before database queries', async (path) => {
    mock.context.mockResolvedValue({ user: null, profile: null, client: { from: mock.from } });
    await expect(getPageData(path)).rejects.toThrow('REDIRECT:/login');
    expect(mock.from).not.toHaveBeenCalled();
  });

  it.each(['pending', 'rejected', 'suspended'])('does not load marketplace data for %s accounts', async (verification_status) => {
    mock.context.mockResolvedValue({
      user: { id: profile.id },
      profile: { ...profile, verification_status },
      client: { from: mock.from },
    });
    await expect(getPageData('/marketplace')).rejects.toThrow('REDIRECT:/pending-approval');
    expect(mock.from).not.toHaveBeenCalled();
    expect((await getPageData('/pending-approval')).listings).toEqual([]);
  });

  it.each(['/admin', '/admin/users', '/admin/groups', '/admin/products', '/admin/requests', '/admin/reports'])(
    'rejects student requests for %s before moderation queries',
    async (path) => {
      await expect(getPageData(path)).rejects.toThrow('REDIRECT:/seller/dashboard');
      expect(mock.from).not.toHaveBeenCalled();
    }
  );

  it('returns zero listings and zero groups when Supabase is unconfigured', async () => {
    mock.configured.mockReturnValue(false);
    const data = await getPageData('/');
    expect(data.mode).toBe('unconfigured');
    expect(data.listings).toEqual([]);
    expect(data.groups).toEqual([]);
    expect(data.profile).toBeNull();
    expect(mock.context).not.toHaveBeenCalled();
  });

  it('denies cross-user and unauthorized-group product edit routes with NOT_FOUND before seller name or storage signing', async () => {
    const rpc = vi.fn();
    const storageFrom = vi.fn();
    mock.from.mockImplementation((table: string) => {
      if (table === 'categories' || table === 'seller_groups' || table === 'group_members') {
        return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
      }
      if (table === 'saved_listings') {
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      }
      if (table === 'purchase_requests') {
        return { select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) };
      }
      const listingQuery = {
        eq: () => listingQuery,
        or: () => listingQuery,
        order: () => listingQuery,
        range: async () => ({
          data: [
            {
              id: '30000000-0000-4000-8000-000000000001',
              seller_id: '20000000-0000-4000-8000-000000000099',
              group_id: null,
              status: 'active',
              price: '10.00',
              stock_quantity: 2,
              availability: 'available',
              listing_images: [],
            },
          ],
          error: null,
          count: 1,
        }),
      };
      return { select: () => listingQuery };
    });
    mock.context.mockResolvedValue({
      user: { id: profile.id },
      profile,
      client: { from: mock.from, rpc, storage: { from: storageFrom } },
    });
    await expect(getPageData('/seller/products/30000000-0000-4000-8000-000000000001/edit')).rejects.toThrow('NOT_FOUND');
    expect(rpc).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  });
});
