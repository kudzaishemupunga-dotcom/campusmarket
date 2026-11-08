import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { PermissionError } from '@/lib/permissions';

const mock = vi.hoisted(() => ({ demo: vi.fn(), configured: vi.fn(), member: vi.fn(), from: vi.fn(), limit: vi.fn(), storage: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/server/config', () => ({ isDemoMode: mock.demo, isSupabaseConfigured: mock.configured, siteUrl: () => 'https://campus.example' }));
vi.mock('@/lib/server/auth', () => ({ requireMember: mock.member }));
vi.mock('@/lib/server/rate-limit', () => ({ checkRateLimit: mock.limit }));
vi.mock('@/lib/server/supabase', () => ({ storageSupabase: mock.storage }));
import { POST } from '@/app/api/upload/route';

const userId = '20000000-0000-4000-8000-000000000001';
const listingId = '30000000-0000-4000-8000-000000000001';

function request(files: File[], origin = 'https://campus.example') {
  const form = new FormData();
  form.set('id', listingId);
  for (const file of files) form.append('images', file);
  return new NextRequest('https://campus.example/api/upload', { method: 'POST', headers: { origin }, body: form });
}
function listingQuery(seller_id = userId, listing_images: { id: string; display_order: number }[] = []) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn(async () => ({ data: { seller_id, status: 'pending_review', listing_images }, error: null })) };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}
beforeEach(() => {
  mock.demo.mockReturnValue(false);
  mock.configured.mockReturnValue(true);
  mock.member.mockResolvedValue({ client: { from: mock.from }, profile: { id: userId, verification_status: 'approved', role: 'student' } });
  mock.limit.mockResolvedValue(undefined);
  mock.from.mockReturnValue(listingQuery());
  mock.upload.mockResolvedValue({ error: null });
  mock.remove.mockResolvedValue({ error: null });
  mock.storage.mockReturnValue({ storage: { from: () => ({ upload: mock.upload, remove: mock.remove }) } });
});

describe('verified upload endpoint', () => {
  it('rejects cross-origin requests before loading a user or using privileged storage', async () => {
    const response = await POST(request([], 'https://attacker.example'));
    expect(response.status).toBe(403);
    expect(mock.member).not.toHaveBeenCalled();
    expect(mock.storage).not.toHaveBeenCalled();
  });
  it('rejects demo requests and anonymous callers', async () => {
    mock.demo.mockReturnValue(true);
    expect((await POST(request([]))).status).toBe(403);
    mock.demo.mockReturnValue(false);
    mock.member.mockRejectedValue(new PermissionError('Please sign in.'));
    expect((await POST(request([]))).status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });
  it('rejects another user’s listing before privileged upload access', async () => {
    mock.from.mockReturnValue(listingQuery('20000000-0000-4000-8000-000000000002'));
    const response = await POST(request([new File(['pretend'], 'photo.png', { type: 'image/png' })]));
    expect(response.status).toBe(403);
    expect(mock.storage).not.toHaveBeenCalled();
  });
  it('rejects more than five files and aggregate image count overflow', async () => {
    const file = new File(['pretend'], 'photo.png', { type: 'image/png' });
    expect((await POST(request(Array(6).fill(file)))).status).toBe(400);
    mock.from.mockReturnValue(listingQuery(userId, Array.from({ length: 5 }, (_, display_order) => ({ id: String(display_order), display_order }))));
    expect((await POST(request([file]))).status).toBe(400);
    expect(mock.storage).not.toHaveBeenCalled();
  });
  it('rejects files whose extension and declared MIME disguise non-image bytes', async () => {
    const response = await POST(request([new File(['<script>alert(1)</script>'], 'photo.jpg', { type: 'image/jpeg' })]));
    expect(response.status).toBe(400);
    expect(mock.storage).not.toHaveBeenCalled();
  });
  it('rejects a valid signature with corrupt image contents during decoding', async () => {
    const response = await POST(request([new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], 'photo.png', { type: 'image/png' })]));
    expect(response.status).toBe(400);
    expect(mock.storage).not.toHaveBeenCalled();
  });
  it('decodes and re-encodes a genuine image before storing a randomized owner-scoped path', async () => {
    const input = await sharp({ create: { width: 3, height: 2, channels: 3, background: '#0d9488' } }).png().toBuffer();
    const insert = vi.fn(() => ({ select: async () => ({ data: [], error: null }) }));
    mock.from.mockImplementation((table: string) => table === 'listing_images' ? { insert } : listingQuery());
    const response = await POST(request([new File([new Uint8Array(input)], '../../private.png', { type: 'image/png' })]));
    expect(response.status).toBe(200);
    expect(mock.upload).toHaveBeenCalledOnce();
    const [path, bytes, options] = mock.upload.mock.calls[0] as [string, Buffer, { contentType: string }];
    expect(path).toMatch(new RegExp(`^${userId}/${listingId}/[0-9a-f-]{36}\\.webp$`));
    expect(options.contentType).toBe('image/webp');
    expect((await sharp(bytes).metadata()).format).toBe('webp');
    expect(insert).toHaveBeenCalledWith([{ listing_id: listingId, storage_path: path, display_order: 0 }]);
  });
  it('removes uploaded objects if the database refuses image metadata', async () => {
    const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#0d9488' } }).png().toBuffer();
    mock.from.mockImplementation((table: string) => table === 'listing_images' ? { insert: () => ({ select: async () => ({ data: null, error: new Error('concurrent count limit') }) }) } : listingQuery());
    expect((await POST(request([new File([new Uint8Array(input)], 'photo.png', { type: 'image/png' })]))).status).toBe(400);
    expect(mock.remove).toHaveBeenCalledWith([mock.upload.mock.calls[0][0]]);
  });
});
