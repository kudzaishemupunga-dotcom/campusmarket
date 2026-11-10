import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionError } from '@/lib/permissions';
import type { Profile } from '@/lib/types';

const mock = vi.hoisted(() => ({
  configured: vi.fn(),
  member: vi.fn(),
  session: vi.fn(),
  rate: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  reset: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/config', () => ({
  isSupabaseConfigured: mock.configured,
  siteUrl: () => 'https://campus.example',
}));
vi.mock('@/lib/server/auth', () => ({ requireMember: mock.member, getSessionContext: mock.session }));
vi.mock('@/lib/server/rate-limit', () => ({ checkRateLimit: mock.rate }));
vi.mock('@/lib/server/supabase', () => ({
  serverSupabase: async () => ({
    from: mock.from,
    rpc: mock.rpc,
    auth: {
      signUp: mock.signUp,
      signInWithPassword: mock.signIn,
      signOut: mock.signOut,
      resetPasswordForEmail: mock.reset,
      updateUser: mock.updateUser,
    },
  }),
  storageSupabase: vi.fn(),
}));
import { runAction } from '@/app/actions';

const userId = '20000000-0000-4000-8000-000000000001';
const otherId = '20000000-0000-4000-8000-000000000002';
const listingId = '30000000-0000-4000-8000-000000000001';
const groupId = '50000000-0000-4000-8000-000000000001';
const requestId = '60000000-0000-4000-8000-000000000001';
const categoryId = '10000000-0000-4000-8000-000000000001';

const profile: Profile = {
  id: userId,
  display_name: 'Test Learner',
  avatar_path: null,
  role: 'student',
  verification_status: 'approved',
  seller_type: 'individual',
  seller_approved: true,
  project_summary: 'Woodwork practical',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const validListing = {
  title: 'Solar desk lamp prototype',
  description: 'A rechargeable solar desk lamp designed and built in our STEM practical project.',
  price: '14.00',
  stock_quantity: 3,
  availability: 'available',
  category_id: categoryId,
  condition: 'New',
  status: 'pending_review',
  project_name: 'Clean Energy Project',
  materials: 'Pine wood, LED module, solar panel',
  dimensions: null,
  production_method: 'Workshop assembly',
  learning_area: 'STEM, Robotics & Electronics',
  made_to_order: false,
  group_id: null,
};

function query(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const chain = Object.assign(Promise.resolve(result), {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(async () => result),
  });
  for (const method of [chain.select, chain.eq, chain.insert, chain.update, chain.delete, chain.upsert]) {
    method.mockReturnValue(chain);
  }
  return chain;
}

beforeEach(() => {
  mock.configured.mockReturnValue(true);
  mock.member.mockResolvedValue({ client: { from: mock.from, rpc: mock.rpc }, profile, user: { id: userId } });
  mock.session.mockResolvedValue({ user: { id: userId } });
  mock.rate.mockResolvedValue(undefined);
  mock.rpc.mockResolvedValue({ data: listingId, error: null });
  mock.signUp.mockResolvedValue({ error: null });
  mock.signIn.mockResolvedValue({ data: { user: { id: userId, email_confirmed_at: '2026-01-01' } }, error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.reset.mockResolvedValue({ error: null });
  mock.updateUser.mockResolvedValue({ error: null });
  mock.from.mockReturnValue(query());
});

describe('authentication actions', () => {
  it('creates an email-confirmation signup without accepting privileged role metadata', async () => {
    const result = await runAction('signup', {
      display_name: 'Test Student',
      email: 'student@example.test',
      password: 'fictional-pass-123',
      role: 'admin',
      seller_type: 'individual',
      project_summary: 'Design & Technology woodwork',
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('School approval');
    expect(mock.signUp).toHaveBeenCalledWith({
      email: 'student@example.test',
      password: 'fictional-pass-123',
      options: {
        data: {
          display_name: 'Test Student',
          seller_type: 'individual',
          project_summary: 'Design & Technology woodwork',
        },
        emailRedirectTo: 'https://campus.example/auth/callback?next=/pending-approval',
      },
    });
  });

  it('rejects invalid signup input before sending it to Auth', async () => {
    expect((await runAction('signup', { display_name: 'Test', email: 'invalid', password: 'short' })).ok).toBe(false);
    expect(mock.signUp).not.toHaveBeenCalled();
  });

  it.each(['pending', 'rejected', 'suspended'])('routes %s logins to /pending-approval', async (verification_status) => {
    mock.from.mockReturnValue(query({ data: { verification_status }, error: null }));
    expect((await runAction('login', { email: 'student@example.test', password: 'fictional-pass-123' })).redirect).toBe(
      '/pending-approval'
    );
  });

  it('routes approved logins to / by default or a safe next path', async () => {
    mock.from.mockReturnValue(query({ data: { verification_status: 'approved' }, error: null }));
    expect((await runAction('login', { email: 'student@example.test', password: 'fictional-pass-123' })).redirect).toBe(
      '/'
    );
    expect(
      (await runAction('login', { email: 'student@example.test', password: 'fictional-pass-123', next: '/seller/dashboard' }))
        .redirect
    ).toBe('/seller/dashboard');
  });

  it('denies failed and unconfirmed logins with a non-sensitive error', async () => {
    mock.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'sensitive-provider-detail' } });
    const result = await runAction('login', { email: 'student@example.test', password: 'wrong-password' });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('sensitive-provider-detail');
    mock.signIn.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    expect((await runAction('login', { email: 'student@example.test', password: 'fictional-pass-123' })).ok).toBe(false);
  });

  it('does not disclose whether a recovery email belongs to an account', async () => {
    const success = await runAction('forgot_password', { email: 'student@example.test' });
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
  it.each([undefined, null, 'true', 'false', 1])('does not infer seller approval from %s', async (seller_approved) => {
    mock.member.mockResolvedValue({
      client: { from: mock.from, rpc: mock.rpc },
      profile: { ...profile, seller_approved },
      user: { id: userId },
    });
    const db = query({ data: { seller_id: userId, group_id: null, status: 'active', listing_images: [] }, error: null });
    mock.from.mockReturnValue(db);
    expect((await runAction('save_listing', validListing)).ok).toBe(false);
    expect((await runAction('save_listing', { ...validListing, id: listingId })).ok).toBe(false);
    expect((await runAction('update_stock', { id: listingId, stock_quantity: 1 })).ok).toBe(false);
    expect((await runAction('mark_sold', { id: listingId })).ok).toBe(false);
    expect((await runAction('delete_listing', { id: listingId })).ok).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('fails closed on a group permission lookup error even when partial data is returned', async () => {
    const listingDb = query({ data: { seller_id: otherId, group_id: groupId, status: 'active' }, error: null });
    mock.from.mockImplementation((table: string) => {
      if (table === 'seller_groups') return query({ data: { id: groupId, verification_status: 'approved' }, error: null });
      if (table === 'group_members') return query({ data: [{ user_id: userId, member_role: 'owner', status: 'approved', can_manage_products: true }], error: { message: 'permission read failed' } });
      return listingDb;
    });
    expect((await runAction('save_listing', { ...validListing, id: listingId, group_id: groupId })).ok).toBe(false);
    expect(listingDb.update).not.toHaveBeenCalled();
  });

  it('rejects zero-row updates after ownership is revoked or the product is concurrently deleted', async () => {
    mock.from.mockReturnValueOnce(query({ data: { seller_id: userId, group_id: null, status: 'active' }, error: null }));
    mock.from.mockReturnValueOnce(query({ data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }));
    expect((await runAction('save_listing', { ...validListing, id: listingId })).ok).toBe(false);
  });

  it('does not return provider text just because it starts with a friendly domain prefix', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only confidential row values: private-student@example.test' } });
    const result = await runAction('update_purchase_request', { id: requestId, status: 'accepted' });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('private-student');
    mock.rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'Requested quantity exceeds available stock.' } });
    expect((await runAction('submit_purchase_request', { listing_id: listingId, quantity: 3 })).message).toBe('Requested quantity exceeds available stock.');
    mock.rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'Buyer, seller, group and product must remain approved and available.' } });
    expect((await runAction('update_purchase_request', { id: requestId, status: 'fulfilled' })).message).toBe('Buyer, seller, group and product must remain approved and available.');
  });

  it('checks primary-photo ownership before invoking the privileged RPC', async () => {
    mock.from.mockReturnValue(query({ data: { seller_id: otherId, group_id: null, created_by_admin: null, status: 'active' }, error: null }));
    expect((await runAction('set_primary_image', { listing_id: listingId, image_id: '40000000-0000-4000-8000-000000000001' })).ok).toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('fails closed when external configuration is missing', async () => {
    mock.configured.mockReturnValue(false);
    expect((await runAction('login', { email: 'student@example.test', password: 'fictional-pass-123' })).ok).toBe(false);
    expect((await runAction('save_listing', validListing)).ok).toBe(false);
    expect(mock.signIn).not.toHaveBeenCalled();
    expect(mock.member).not.toHaveBeenCalled();
  });

  it.each([
    'moderate_user',
    'set_seller_access',
    'moderate_group',
    'moderate_listing',
    'admin_create_product',
    'resolve_report',
  ] as const)('requires an administrator for %s before RPC execution', async (action) => {
    mock.member.mockRejectedValue(new PermissionError());
    expect((await runAction(action, { id: listingId, status: 'approved', approved: true })).ok).toBe(false);
    expect(mock.member).toHaveBeenCalledWith(true);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('prevents an unapproved seller from creating an independent product', async () => {
    mock.member.mockResolvedValue({
      client: { from: mock.from, rpc: mock.rpc },
      profile: { ...profile, seller_approved: false },
      user: { id: userId },
    });
    const res = await runAction('save_listing', validListing);
    expect(res.ok).toBe(false);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it.each(['save_listing', 'update_stock', 'delete_listing', 'mark_sold'] as const)('denies cross-user %s', async (action) => {
    const db = query({ data: { seller_id: otherId, group_id: null, status: 'active', listing_images: [] }, error: null });
    mock.from.mockReturnValue(db);
    expect((await runAction(action, { ...validListing, id: listingId, stock_quantity: 2 })).ok).toBe(false);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('blocks self-moderation even for an administrator', async () => {
    mock.member.mockResolvedValue({
      client: { from: mock.from, rpc: mock.rpc },
      profile: { ...profile, role: 'admin' },
    });
    expect((await runAction('moderate_user', { id: userId, status: 'approved' })).ok).toBe(false);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});

describe('seller registration, groups, products, purchase requests, and admin dispatch', () => {
  it('registers individual seller access without self-approving seller_approved', async () => {
    const db = query({ data: { id: userId }, error: null });
    mock.from.mockReturnValue(db);
    mock.member.mockResolvedValue({
      client: { from: mock.from, rpc: mock.rpc },
      profile: { ...profile, seller_approved: false, seller_type: 'none' },
      user: { id: userId },
    });
    const res = await runAction('register_seller', {
      seller_type: 'individual',
      project_summary: 'Creating hand-carved timber bookstands in Design & Technology.',
    });
    expect(res.ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith({
      seller_type: 'individual',
      project_summary: 'Creating hand-carved timber bookstands in Design & Technology.',
    });
  });

  it('creates a product with trusted seller_id, normalized availability, and pending status', async () => {
    const db = query({ data: { id: listingId }, error: null });
    mock.from.mockReturnValue(db);
    const res = await runAction('save_listing', { ...validListing, seller_id: otherId, stock_quantity: 0 });
    expect(res.id).toBe(listingId);
    expect(db.insert).toHaveBeenCalledWith({
      ...validListing,
      stock_quantity: 0,
      availability: 'sold_out',
      seller_id: userId,
    });
  });

  it('allows an authorized group collaborator to create and update group products', async () => {
    const listingDb = query({ data: { id: listingId }, error: null });
    mock.from.mockImplementation((table: string) => {
      if (table === 'seller_groups') {
        return query({ data: { id: groupId, name: 'Robotics Team', slug: 'robotics', verification_status: 'approved' }, error: null });
      }
      if (table === 'group_members') {
        return query({
          data: [{ group_id: groupId, user_id: userId, member_role: 'member', status: 'approved', can_manage_products: true }],
          error: null,
        });
      }
      return listingDb;
    });

    mock.member.mockResolvedValue({
      client: { from: mock.from, rpc: mock.rpc },
      profile: { ...profile, seller_approved: false },
      user: { id: userId },
    });

    const createRes = await runAction('save_listing', { ...validListing, group_id: groupId });
    expect(createRes.ok).toBe(true);
    expect(listingDb.insert).toHaveBeenCalledWith({ ...validListing, group_id: groupId, seller_id: userId });
  });

  it('updates stock quantity and sets primary product image via RPC', async () => {
    const db = query({
      data: { seller_id: userId, group_id: null, status: 'active', availability: 'available', made_to_order: false },
      error: null,
    });
    mock.from.mockReturnValue(db);
    expect((await runAction('update_stock', { id: listingId, stock_quantity: 0 })).ok).toBe(true);
    expect(db.update).toHaveBeenCalledWith({ stock_quantity: 0, availability: 'sold_out' });

    const imgId = '40000000-0000-4000-8000-000000000001';
    expect((await runAction('set_primary_image', { listing_id: listingId, image_id: imgId })).ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('set_primary_listing_image', {
      target_listing_id: listingId,
      target_image_id: imgId,
    });
  });

  it('dispatches project group creation, invitations, membership requests, and member permissions', async () => {
    mock.rpc.mockResolvedValue({ data: groupId, error: null });
    expect(
      (
        await runAction('create_group', {
          name: 'Solar Innovation Club',
          project_description: 'Building portable solar study lamps for boarding learners.',
          learning_area: 'STEM, Robotics & Electronics',
        })
      ).ok
    ).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('create_seller_group', {
      group_name: 'Solar Innovation Club',
      group_slug: 'solar-innovation-club',
      description: 'Building portable solar study lamps for boarding learners.',
      area: 'STEM, Robotics & Electronics',
    });

    expect((await runAction('invite_group_member', { group_id: groupId, user_id: otherId, can_manage_products: true })).ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('invite_group_member', {
      target_group_id: groupId,
      target_user_id: otherId,
      allow_products: true,
    });

    expect((await runAction('request_group_membership', { group_id: groupId })).ok).toBe(true);
    expect((await runAction('respond_group_invite', { group_id: groupId, accept: true })).ok).toBe(true);
    expect(
      (await runAction('manage_group_member', { group_id: groupId, user_id: otherId, status: 'approved', can_manage_products: false })).ok
    ).toBe(true);
  });

  it('dispatches safe purchase requests and supervised fulfillment updates via RPC', async () => {
    mock.rpc.mockResolvedValue({ data: requestId, error: null });
    const createReq = await runAction('submit_purchase_request', {
      listing_id: listingId,
      quantity: 2,
      note: 'Ready to meet at library reception during lunch.',
    });
    expect(createReq.ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('submit_purchase_request', {
      target_listing_id: listingId,
      requested_qty: 2,
      buyer_note: 'Ready to meet at library reception during lunch.',
    });

    const fulfillReq = await runAction('update_purchase_request', { id: requestId, status: 'fulfilled' });
    expect(fulfillReq.ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('update_purchase_request_status', {
      target_request_id: requestId,
      new_status: 'fulfilled',
    });
  });

  it('dispatches audited admin seller approval, group moderation, product moderation, and verified manual product entry', async () => {
    mock.member.mockResolvedValue({
      client: { from: mock.from, rpc: mock.rpc },
      profile: { ...profile, role: 'admin' },
      user: { id: userId },
    });

    expect((await runAction('set_seller_access', { id: otherId, approved: true })).ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('set_seller_access', { target_id: otherId, approved: true });

    expect((await runAction('moderate_group', { id: groupId, status: 'approved' })).ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('moderate_group', { target_id: groupId, new_status: 'approved' });

    expect((await runAction('moderate_listing', { id: listingId, status: 'active' })).ok).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith('moderate_listing', { target_id: listingId, new_status: 'active' });

    expect(
      (
        await runAction('admin_create_product', {
          owner_id: otherId,
          group_id: groupId,
          title: validListing.title,
          description: validListing.description,
          price: '18.50',
          stock_quantity: 5,
          category_id: categoryId,
          project_name: 'Clean Energy Project',
        })
      ).ok
    ).toBe(true);
    expect(mock.rpc).toHaveBeenCalledWith(
      'admin_create_product',
      expect.objectContaining({
        owner_id: otherId,
        target_group_id: groupId,
        product_title: validListing.title,
        product_price: '18.50',
        product_stock: 5,
      })
    );
  });
});
