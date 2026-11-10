import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { PermissionError } from '@/lib/permissions';

const mock = vi.hoisted(() => ({
  configured: vi.fn(),
  member: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  limit: vi.fn(),
  storage: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/config', () => ({
  isSupabaseConfigured: mock.configured,
  siteUrl: () => 'https://campus.example',
  isAllowedRequestOrigin: (origin: string | null) => origin === 'https://campus.example',
}));
vi.mock('@/lib/server/auth', () => ({ requireMember: mock.member }));
vi.mock('@/lib/server/rate-limit', () => ({ checkRateLimit: mock.limit }));
vi.mock('@/lib/server/supabase', () => ({ storageSupabase: mock.storage }));
import { DELETE, PATCH, POST } from '@/app/api/upload/route';

const userId = '20000000-0000-4000-8000-000000000001';
const otherId = '20000000-0000-4000-8000-000000000002';
const listingId = '30000000-0000-4000-8000-000000000001';
const groupId = '50000000-0000-4000-8000-000000000001';
const imageId = '40000000-0000-4000-8000-000000000001';

function request(files: File[], origin = 'https://campus.example') {
  const form = new FormData();
  form.set('id', listingId);
  for (const file of files) form.append('images', file);
  return new NextRequest('https://campus.example/api/upload', { method: 'POST', headers: { origin }, body: form });
}

function listingQuery(
  seller_id = userId,
  listing_images: { id: string; display_order: number }[] = [],
  group_id: string | null = null
) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => ({
      data: { seller_id, group_id, created_by_admin: null, status: 'pending_review', listing_images },
      error: null,
    })),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mock.configured.mockReturnValue(true);
  mock.member.mockResolvedValue({
    client: { from: mock.from, rpc: mock.rpc },
    profile: {
      id: userId,
      verification_status: 'approved',
      role: 'student',
      seller_type: 'individual',
      seller_approved: true,
    },
  });
  mock.limit.mockResolvedValue(undefined);
  mock.from.mockReturnValue(listingQuery());
  mock.rpc.mockResolvedValue({ error: null });
  mock.upload.mockResolvedValue({ error: null });
  mock.remove.mockResolvedValue({ error: null });
  mock.storage.mockReturnValue({ storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) } });
});

describe('verified upload endpoint (POST)', () => {
  it.each([undefined, null, 'true', 'false', 1, false])('denies independent uploads without a trusted seller approval boolean (%s)', async (seller_approved) => {
    mock.member.mockResolvedValue({ client: { from: mock.from, rpc: mock.rpc }, profile: { id: userId, role: 'student', verification_status: 'approved', seller_approved } });
    expect((await POST(request([new File(['pretend'], 'photo.png', { type: 'image/png' })]))).status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('denies group uploads if membership lookup errors even when it includes partial membership data', async () => {
    mock.from.mockImplementation((table: string) => {
      if (table === 'seller_groups') {
        const group = { select: vi.fn(), eq: vi.fn(), single: async () => ({ data: { id: groupId, verification_status: 'approved' }, error: null }) };
        group.select.mockReturnValue(group); group.eq.mockReturnValue(group); return group;
      }
      if (table === 'group_members') return { select: () => ({ eq: async () => ({ data: [{ user_id: userId, member_role: 'owner', status: 'approved', can_manage_products: true }], error: { message: 'failed permission lookup' } }) }) };
      return listingQuery(otherId, [], groupId);
    });
    expect((await POST(request([new File(['pretend'], 'photo.png', { type: 'image/png' })]))).status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('rejects cross-origin requests before loading a user or using privileged storage', async () => {
    const response = await POST(request([], 'https://attacker.example'));
    expect(response.status).toBe(403);
    expect(mock.member).not.toHaveBeenCalled();
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('rejects unconfigured requests and anonymous callers', async () => {
    mock.configured.mockReturnValue(false);
    expect((await POST(request([]))).status).toBe(403);
    mock.configured.mockReturnValue(true);
    mock.member.mockRejectedValue(new PermissionError('Please sign in.'));
    expect((await POST(request([]))).status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('rejects another user’s product before privileged upload access', async () => {
    mock.from.mockReturnValue(listingQuery(otherId));
    const response = await POST(request([new File(['pretend'], 'photo.png', { type: 'image/png' })]));
    expect(response.status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('allows an approved group collaborator with product rights to upload group product photos', async () => {
    const input = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#4a2a19' } }).png().toBuffer();
    const insert = vi.fn(() => ({ select: async () => ({ data: [], error: null }) }));
    mock.from.mockImplementation((table: string) => {
      if (table === 'listing_images') return { insert };
      if (table === 'seller_groups') {
        const g = { select: vi.fn(), eq: vi.fn(), single: vi.fn(async () => ({ data: { id: groupId, verification_status: 'approved' }, error: null })) };
        g.select.mockReturnValue(g);
        g.eq.mockReturnValue(g);
        return g;
      }
      if (table === 'group_members') {
        return {
          select: () => ({
            eq: async () => ({
              data: [{ group_id: groupId, user_id: userId, member_role: 'member', status: 'approved', can_manage_products: true }],
              error: null,
            }),
          }),
        };
      }
      return listingQuery(otherId, [], groupId);
    });

    const response = await POST(request([new File([new Uint8Array(input)], 'project.png', { type: 'image/png' })]));
    expect(response.status).toBe(200);
    expect(mock.upload).toHaveBeenCalledOnce();
    expect(mock.upload.mock.calls[0][0]).toMatch(new RegExp(`^${userId}/${listingId}/[0-9a-f-]{36}\\.webp$`));
  });

  it('rejects more than five files and aggregate image count overflow', async () => {
    const file = new File(['pretend'], 'photo.png', { type: 'image/png' });
    expect((await POST(request(Array(6).fill(file)))).status).toBe(400);
    mock.from.mockReturnValue(
      listingQuery(
        userId,
        Array.from({ length: 5 }, (_, display_order) => ({ id: String(display_order), display_order }))
      )
    );
    expect((await POST(request([file]))).status).toBe(400);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('rejects disguised non-image bytes and corrupt image headers', async () => {
    expect((await POST(request([new File(['<script>alert(1)</script>'], 'photo.jpg', { type: 'image/jpeg' })]))).status).toBe(400);
    expect(
      (await POST(request([new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], 'photo.png', { type: 'image/png' })])))
        .status
    ).toBe(400);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('decodes, strips metadata, and re-encodes genuine photos to WebP under a randomized owner-scoped path', async () => {
    const input = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#4a2a19' } }).png().toBuffer();
    const insert = vi.fn(() => ({ select: async () => ({ data: [], error: null }) }));
    mock.from.mockImplementation((table: string) => (table === 'listing_images' ? { insert } : listingQuery()));
    const response = await POST(request([new File([new Uint8Array(input)], '../../private.png', { type: 'image/png' })]));
    expect(response.status).toBe(200);
    const [path, bytes, options] = mock.upload.mock.calls[0] as [string, Buffer, { contentType: string }];
    expect(path).toMatch(new RegExp(`^${userId}/${listingId}/[0-9a-f-]{36}\\.webp$`));
    expect(options.contentType).toBe('image/webp');
    expect((await sharp(bytes).metadata()).format).toBe('webp');
    expect(insert).toHaveBeenCalledWith([{ listing_id: listingId, storage_path: path, display_order: 0 }]);
  });

  it('removes uploaded objects if the database refuses image metadata', async () => {
    const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#4a2a19' } }).png().toBuffer();
    mock.from.mockImplementation((table: string) =>
      table === 'listing_images'
        ? { insert: () => ({ select: async () => ({ data: null, error: new Error('concurrent count limit') }) }) }
        : listingQuery()
    );
    expect((await POST(request([new File([new Uint8Array(input)], 'photo.png', { type: 'image/png' })]))).status).toBe(400);
    expect(mock.remove).toHaveBeenCalledWith([mock.upload.mock.calls[0][0]]);
  });
});

describe('choose main photo endpoint (PATCH)', () => {
  function patchRequest(body: unknown = { listingId, imageId }, origin = 'https://campus.example') {
    return new NextRequest('https://campus.example/api/upload', {
      method: 'PATCH',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('updates primary image via set_primary_listing_image RPC and denies unauthorized callers', async () => {
    expect((await PATCH(patchRequest(undefined, 'https://attacker.example'))).status).toBe(403);
    const ok = await PATCH(patchRequest());
    expect(ok.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith('set_primary_listing_image', {
      target_listing_id: listingId,
      target_image_id: imageId,
    });

    mock.rpc.mockResolvedValue({ error: new Error('denied') });
    expect((await PATCH(patchRequest())).status).toBe(403);
  });

  it('denies cross-user and closed-product primary photo changes before the RPC', async () => {
    mock.from.mockReturnValue(listingQuery(otherId));
    expect((await PATCH(patchRequest())).status).toBe(403);
    expect(mock.rpc).not.toHaveBeenCalled();
    const chain = listingQuery();
    chain.single.mockResolvedValue({ data: { seller_id: userId, group_id: null, created_by_admin: null, status: 'sold', listing_images: [] }, error: null });
    mock.from.mockReturnValue(chain);
    expect((await PATCH(patchRequest())).status).toBe(403);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('applies the JSON body cap even without a Content-Length header', async () => {
    const large = patchRequest({ listingId, imageId, unused: 'x'.repeat(4096) });
    expect(large.headers.get('content-length')).toBeNull();
    expect((await PATCH(large)).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});

describe('verified image delete endpoint (DELETE)', () => {
  function deleteRequest(body: unknown = { listingId, imageId }, origin = 'https://campus.example') {
    return new NextRequest('https://campus.example/api/upload', {
      method: 'DELETE',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('rejects cross-origin and unapproved DELETE requests before storage access', async () => {
    expect((await DELETE(deleteRequest(undefined, 'https://attacker.example'))).status).toBe(403);
    expect(mock.member).not.toHaveBeenCalled();
    mock.member.mockRejectedValue(new PermissionError('Your school must approve your account first.'));
    expect((await DELETE(deleteRequest())).status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('denies cross-user image deletion and sold/removed product mutations', async () => {
    mock.from.mockReturnValue(listingQuery(otherId));
    expect((await DELETE(deleteRequest())).status).toBe(403);
    const soldChain = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(async () => ({ data: { seller_id: userId, group_id: null, status: 'sold' }, error: null })),
    };
    soldChain.select.mockReturnValue(soldChain);
    soldChain.eq.mockReturnValue(soldChain);
    mock.from.mockReturnValue(soldChain);
    expect((await DELETE(deleteRequest())).status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });

  it('deletes owned image metadata first and then removes the private storage object', async () => {
    const storagePath = `${userId}/${listingId}/owned.webp`;
    const delEq2 = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: imageId, storage_path: storagePath }, error: null }) }) }));
    const delEq1 = vi.fn(() => ({ eq: delEq2 }));
    const imageTable = {
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { storage_path: storagePath }, error: null }) }) }) }),
      delete: () => ({ eq: delEq1 }),
    };
    mock.from.mockImplementation((table: string) => (table === 'listing_images' ? imageTable : listingQuery()));
    const response = await DELETE(deleteRequest());
    expect(response.status).toBe(200);
    expect(delEq1).toHaveBeenCalledWith('id', imageId);
    expect(delEq2).toHaveBeenCalledWith('listing_id', listingId);
    expect(mock.remove).toHaveBeenCalledWith([storagePath]);
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { code: 'PGRST116' } },
    { data: { id: otherId, storage_path: `${userId}/${listingId}/owned.webp` }, error: null },
  ])('does not remove storage when metadata deletion did not return the authorized image: %j', async (deletion) => {
    const storagePath = `${userId}/${listingId}/owned.webp`;
    const imageTable = {
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { storage_path: storagePath }, error: null }) }) }) }),
      delete: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: async () => deletion }) }) }) }),
    };
    mock.from.mockImplementation((table: string) => (table === 'listing_images' ? imageTable : listingQuery()));
    expect((await DELETE(deleteRequest())).status).toBe(403);
    expect(mock.remove).not.toHaveBeenCalled();
  });
});
