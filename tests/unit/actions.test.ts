import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '@/lib/permissions';
import type { Profile } from '@/lib/types';

const mock = vi.hoisted(() => ({
  demo: vi.fn(), configured: vi.fn(), member: vi.fn(), session: vi.fn(), rate: vi.fn(),
  from: vi.fn(), rpc: vi.fn(), signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), reset: vi.fn(), updateUser: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/config', () => ({ isDemoMode: mock.demo, isSupabaseConfigured: mock.configured, siteUrl: () => 'https://campus.example' }));
vi.mock('@/lib/server/auth', () => ({ requireMember: mock.member, getSessionContext: mock.session }));
vi.mock('@/lib/server/rate-limit', () => ({ checkRateLimit: mock.rate }));
vi.mock('@/lib/server/supabase', () => ({
  serverSupabase: async () => ({ from: mock.from, rpc: mock.rpc, auth: { signUp: mock.signUp, signInWithPassword: mock.signIn, signOut: mock.signOut, resetPasswordForEmail: mock.reset, updateUser: mock.updateUser } }),
  storageSupabase: vi.fn(),
}));
import { runAction } from '@/app/actions';

const userId = '20000000-0000-4000-8000-000000000001';
const otherId = '20000000-0000-4000-8000-000000000002';
const listingId = '30000000-0000-4000-8000-000000000001';
const profile: Profile = { id: userId, display_name: 'Fictional Student', avatar_path: null, role: 'student', verification_status: 'approved', created_at: '2026-01-01', updated_at: '2026-01-01' };
const validListing = { title: 'Test mathematics textbook', description: 'A fictional textbook in good condition for automated tests.', price: '8.00', category_id: '10000000-0000-4000-8000-000000000001', condition: 'Good', status: 'pending_review' };

function query(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const chain = Object.assign(Promise.resolve(result), {
    select: vi.fn(), eq: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn(), single: vi.fn(async () => result),
  });
  for (const method of [chain.select, chain.eq, chain.insert, chain.update, chain.delete, chain.upsert]) method.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mock.demo.mockReturnValue(false);
  mock.configured.mockReturnValue(true);
  mock.member.mockResolvedValue({ client: { from: mock.from, rpc: mock.rpc }, profile, user: { id: userId } });
  mock.session.mockResolvedValue({ user: { id: userId } });
  mock.rate.mockResolvedValue(undefined);
  mock.rpc.mockResolvedValue({ error: null });
  mock.signUp.mockResolvedValue({ error: null });
  mock.signIn.mockResolvedValue({ data: { user: { id: userId, email_confirmed_at: '2026-01-01' } }, error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.reset.mockResolvedValue({ error: null });
  mock.updateUser.mockResolvedValue({ error: null });
  mock.from.mockReturnValue(query());
});

describe('authentication actions', () => {
  it('creates an email-confirmation signup without accepting role metadata', async () => {
    const result = await runAction('signup', { display_name: 'Demo Student', email: 'demo@example.test', password: 'fictional-pass-123', role: 'admin' });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('School approval');
    expect(mock.signUp).toHaveBeenCalledWith({ email: 'demo@example.test', password: 'fictional-pass-123', options: { data: { display_name: 'Demo Student' }, emailRedirectTo: 'https://campus.example/auth/callback?next=/pending-approval' } });
  });
  it('rejects invalid signup input before sending it to Auth', async () => {
    expect((await runAction('signup', { display_name: 'Test', email: 'invalid', password: 'short' })).ok).toBe(false);
    expect(mock.signUp).not.toHaveBeenCalled();
  });
  it.each(['pending', 'rejected', 'suspended'])('routes %s logins to the access-status page', async (verification_status) => {
    mock.from.mockReturnValue(query({ data: { verification_status }, error: null }));
    expect((await runAction('login', { email: 'demo@example.test', password: 'fictional-pass-123' })).redirect).toBe('/pending-approval');
  });
  it('routes approved logins to the marketplace', async () => {
    mock.from.mockReturnValue(query({ data: { verification_status: 'approved' }, error: null }));
    expect((await runAction('login', { email: 'demo@example.test', password: 'fictional-pass-123' })).redirect).toBe('/');
  });
  it('denies failed and unconfirmed logins with a non-sensitive error', async () => {
    mock.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'sensitive-provider-detail' } });
    const result = await runAction('login', { email: 'demo@example.test', password: 'wrong-password' });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('sensitive-provider-detail');
    mock.signIn.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    expect((await runAction('login', { email: 'demo@example.test', password: 'fictional-pass-123' })).ok).toBe(false);
  });
  it('does not disclose whether a recovery email belongs to an account', async () => {
    const success = await runAction('forgot_password', { email: 'demo@example.test' });
    mock.reset.mockResolvedValue({ error: new Error('Not found') });
    expect(await runAction('forgot_password', { email: 'absent@example.test' })).toEqual(success);
  });
  it('requires an authenticated recovery session before password update', async () => {
    mock.session.mockResolvedValue({ user: null });
    expect((await runAction('reset_password', { password: 'new-fictional-pass-123' })).ok).toBe(false);
    expect(mock.updateUser).not.toHaveBeenCalled();
  });
});

describe('mutation trust boundaries', () => {
  it('never sends a demo action to Supabase', async () => {
    mock.demo.mockReturnValue(true);
    expect((await runAction('save_listing', validListing)).ok).toBe(false);
    expect(mock.member).not.toHaveBeenCalled();
    expect(mock.from).not.toHaveBeenCalled();
  });
  it('fails closed when external configuration is missing', async () => {
    mock.configured.mockReturnValue(false);
    expect((await runAction('login', { email: 'demo@example.test', password: 'fictional-pass-123' })).ok).toBe(false);
    expect(mock.signIn).not.toHaveBeenCalled();
  });
  it.each(['moderate_user', 'moderate_listing', 'resolve_report'] as const)('requires an administrator for %s before RPC execution', async (action) => {
    mock.member.mockRejectedValue(new PermissionError());
    expect((await runAction(action, { id: listingId, status: 'approved' })).ok).toBe(false);
    expect(mock.member).toHaveBeenCalledWith(true);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each(['save_listing', 'delete_listing', 'mark_sold'] as const)('denies cross-user %s', async (action) => {
    const db = query({ data: { seller_id: otherId, status: 'active', listing_images: [] }, error: null });
    mock.from.mockReturnValue(db);
    expect((await runAction(action, { ...validListing, id: listingId })).ok).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });
  it('blocks self-moderation even for an administrator', async () => {
    mock.member.mockResolvedValue({ client: { from: mock.from, rpc: mock.rpc }, profile: { ...profile, role: 'admin' } });
    expect((await runAction('moderate_user', { id: userId, status: 'approved' })).ok).toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('fails closed if the database rejects a mutation, including database-enforced limits', async () => {
    mock.from.mockReturnValue(query({ data: null, error: { message: 'sensitive database limit detail' } }));
    expect((await runAction('save_listing', validListing)).ok).toBe(false);
    expect((await runAction('save_listing', validListing)).message).not.toContain('sensitive database limit detail');
  });
});

describe('listing and moderation dispatch', () => {
  it('creates a listing with the trusted owner and pending status', async () => {
    const db = query({ data: { id: listingId }, error: null });
    mock.from.mockReturnValue(db);
    expect((await runAction('save_listing', { ...validListing, seller_id: otherId })).id).toBe(listingId);
    expect(db.insert).toHaveBeenCalledWith({ ...validListing, seller_id: userId });
  });
  it('edits owned active listings into renewed review', async () => {
    const db = query({ data: { seller_id: userId, status: 'active' }, error: null });
    mock.from.mockReturnValue(db);
    expect((await runAction('save_listing', { ...validListing, id: listingId })).ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith(validListing);
  });
  it('deletes an owned listing', async () => {
    const db = query({ data: { seller_id: userId, listing_images: [] }, error: null });
    mock.from.mockReturnValue(db);
    expect((await runAction('delete_listing', { id: listingId })).ok).toBe(true);
    expect(db.delete).toHaveBeenCalled();
  });
  it('marks an active owned listing as sold and refuses pending listings', async () => {
    const db = query({ data: { seller_id: userId, status: 'active' }, error: null });
    mock.from.mockReturnValue(db);
    expect((await runAction('mark_sold', { id: listingId })).ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith({ status: 'sold' });
    mock.from.mockReturnValue(query({ data: { seller_id: userId, status: 'pending_review' }, error: null }));
    expect((await runAction('mark_sold', { id: listingId })).ok).toBe(false);
  });
  it.each(['active', 'removed'])('delegates listing status %s to audited moderation RPC', async (status) => {
    expect((await runAction('moderate_listing', { id: listingId, status })).ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('moderate_listing', { target_id: listingId, new_status: status });
  });
});
