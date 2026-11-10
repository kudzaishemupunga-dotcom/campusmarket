import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/config', () => ({ isSupabaseConfigured: () => true }));
vi.mock('@/lib/server/auth', () => ({ getSessionContext: async () => ({
  user: { id: '20000000-0000-4000-8000-000000000001' },
  profile: { id: '20000000-0000-4000-8000-000000000001', role: 'student', verification_status: 'approved' },
  client: { from: mock.from, rpc: mock.rpc },
}) }));
import { getPageData } from '@/lib/server/data';

function tableResult(error: boolean) {
  const result = { data: [], error: error ? { message: 'Sensitive provider diagnostic' } : null };
  const chain = { select: () => chain, order: () => chain, eq: () => chain, limit: () => chain, then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
  return chain;
}
beforeEach(() => { vi.clearAllMocks(); });
describe('database outages must not look like a genuine empty catalog', () => {
  it.each(['categories', 'saved_listings', 'seller_groups', 'group_members'])('shows a safe load error when %s fails', async table => {
    mock.from.mockImplementation(name => tableResult(name === table));
    await expect(getPageData('/marketplace')).rejects.toThrow('The marketplace could not be loaded. Please try again.');
  });
  it('does not claim there are no purchase requests when the query fails', async () => {
    mock.from.mockImplementation(name => tableResult(name === 'purchase_requests'));
    await expect(getPageData('/account')).rejects.toThrow('Purchase requests could not be loaded. Please try again.');
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
