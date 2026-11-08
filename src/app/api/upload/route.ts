import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertCanEditProduct, PermissionError } from '@/lib/permissions';
import type { GroupMember, Profile, SellerGroup } from '@/lib/types';
import { MAX_IMAGE_BYTES, MAX_IMAGES, uuidSchema, validateImageHeader } from '@/lib/validation';
import { requireMember } from '@/lib/server/auth';
import { isSupabaseConfigured, siteUrl } from '@/lib/server/config';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { storageSupabase } from '@/lib/server/supabase';

export const runtime = 'nodejs';

function verifyRequest(request: NextRequest) {
  if (!isSupabaseConfigured()) throw new PermissionError('Real uploads require a configured Supabase project.');
  if (request.headers.get('origin') !== siteUrl()) throw new PermissionError('This request is not allowed.');
}

async function limitedFormData(request: NextRequest): Promise<FormData> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data;')) throw new Error('Choose image files to upload.');
  const maximum = MAX_IMAGE_BYTES * MAX_IMAGES + 64 * 1024;
  if (Number(request.headers.get('content-length')) > maximum) {
    throw new Error('Upload at most five images, each no larger than 5 MB.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error('No upload received.');
  const parts: ArrayBuffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new Error('Upload at most five images, each no larger than 5 MB.');
      }
      parts.push(value.slice().buffer);
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(new Blob(parts), { headers: { 'Content-Type': contentType } }).formData();
}

async function authorizeListingImageWrite(
  client: Awaited<ReturnType<typeof requireMember>>['client'],
  rawProfile: Profile,
  listing: { seller_id: string; group_id?: string | null; created_by_admin?: string | null; status: string }
) {
  const profile: Profile =
    rawProfile.seller_approved === undefined
      ? { ...rawProfile, seller_approved: true, seller_type: rawProfile.seller_type ?? 'individual' }
      : rawProfile;

  if (profile.role === 'admin' && listing.created_by_admin === profile.id) return;

  const groupId = listing.group_id ?? null;
  let groups: Pick<SellerGroup, 'id' | 'verification_status' | 'members'>[] = [];
  if (groupId) {
    const [groupRes, membersRes] = await Promise.all([
      client.from('seller_groups').select('id,verification_status').eq('id', groupId).single(),
      client.from('group_members').select('*').eq('group_id', groupId),
    ]);
    if (!groupRes.error && groupRes.data) {
      const g = groupRes.data as { id: string; verification_status: SellerGroup['verification_status'] };
      const members = ((membersRes.data ?? []) as Omit<GroupMember, 'display_name'>[]).map((m) => ({
        ...m,
        display_name: '',
      }));
      groups = [{ id: g.id, verification_status: g.verification_status, members }];
    }
  }

  assertCanEditProduct(profile, { seller_id: listing.seller_id, group_id: groupId }, groups);
}

export async function POST(request: NextRequest) {
  const uploaded: string[] = [];
  let storage: ReturnType<typeof storageSupabase> | null = null;
  try {
    verifyRequest(request);
    const { client, profile } = await requireMember();
    await checkRateLimit(client, 'upload');
    const form = await limitedFormData(request);
    const id = uuidSchema.parse(form.get('id'));
    const files = form.getAll('images');
    if (files.length < 1 || files.length > MAX_IMAGES || files.some((file) => !(file instanceof File))) {
      return NextResponse.json({ ok: false, message: 'Choose between one and five images.' }, { status: 400 });
    }
    const { data: listing, error: listingError } = await client
      .from('listings')
      .select('seller_id,group_id,created_by_admin,status,listing_images(id,display_order)')
      .eq('id', id)
      .single();
    if (listingError || !listing) throw new PermissionError();
    await authorizeListingImageWrite(client, profile, listing);
    if (['sold', 'removed'].includes(listing.status)) {
      throw new PermissionError('This product can no longer be edited.');
    }
    const existing = (listing.listing_images ?? []) as { id: string; display_order: number }[];
    if (existing.length + files.length > MAX_IMAGES) {
      return NextResponse.json(
        { ok: false, message: 'A product can have at most five images. Remove an image first.' },
        { status: 400 }
      );
    }
    const encoded: Buffer[] = [];
    for (const entry of files) {
      const file = entry as File;
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ ok: false, message: 'Each image must be 5 MB or smaller.' }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      validateImageHeader(bytes, file.size, file.type);
      // Decode untrusted bytes, reject decompression bombs, strip EXIF/GPS metadata, and re-encode to WebP.
      const data = await sharp(bytes, { limitInputPixels: 20_000_000, animated: false, failOn: 'warning' })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      if (data.byteLength > MAX_IMAGE_BYTES) throw new Error('The processed image is too large.');
      encoded.push(data);
    }
    storage = storageSupabase();
    const freeOrders = Array.from({ length: MAX_IMAGES }, (_, index) => index).filter(
      (index) => !existing.some((image) => image.display_order === index)
    );
    const records = [];
    for (let index = 0; index < encoded.length; index++) {
      const path = `${profile.id}/${id}/${randomUUID()}.webp`;
      const { error } = await storage.storage
        .from('listing-images')
        .upload(path, encoded[index], { contentType: 'image/webp', upsert: false, cacheControl: '60' });
      if (error) throw error;
      uploaded.push(path);
      records.push({ listing_id: id, storage_path: path, display_order: freeOrders[index] });
    }
    const { data, error } = await client
      .from('listing_images')
      .insert(records)
      .select('id,listing_id,storage_path,display_order');
    if (error) throw error;
    revalidatePath('/', 'layout');
    return NextResponse.json(
      { ok: true, message: 'Product photographs uploaded.', images: data },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (storage && uploaded.length) await storage.storage.from('listing-images').remove(uploaded);
    const message =
      error instanceof PermissionError
        ? error.message
        : error instanceof z.ZodError
          ? 'Choose a valid product.'
          : 'Upload failed. Use genuine JPEG, PNG, or WebP photographs, each under 5 MB, and try again.';
    return NextResponse.json({ ok: false, message }, { status: error instanceof PermissionError ? 403 : 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    verifyRequest(request);
    const { client } = await requireMember();
    if (Number(request.headers.get('content-length')) > 2048) {
      return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
    }
    const { listingId, imageId } = z.object({ listingId: uuidSchema, imageId: uuidSchema }).parse(await request.json());
    const { error } = await client.rpc('set_primary_listing_image', {
      target_listing_id: listingId,
      target_image_id: imageId,
    });
    if (error) throw new PermissionError('Only an authorized seller may choose the main product photo.');
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, message: 'Main product photo updated.' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof PermissionError ? error.message : 'Could not update the main photo.' },
      { status: error instanceof PermissionError ? 403 : 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    verifyRequest(request);
    const { client, profile } = await requireMember();
    await checkRateLimit(client, 'upload');
    if (Number(request.headers.get('content-length')) > 2048) {
      return NextResponse.json({ ok: false, message: 'Invalid request.' }, { status: 400 });
    }
    const { listingId, imageId } = z.object({ listingId: uuidSchema, imageId: uuidSchema }).parse(await request.json());
    const { data: listing, error: listingError } = await client
      .from('listings')
      .select('seller_id,group_id,created_by_admin,status')
      .eq('id', listingId)
      .single();
    if (listingError || !listing) throw new PermissionError();
    await authorizeListingImageWrite(client, profile, listing);
    if (['sold', 'removed'].includes(listing.status)) {
      throw new PermissionError('This product can no longer be edited.');
    }
    const { data: image, error: readError } = await client
      .from('listing_images')
      .select('storage_path')
      .eq('id', imageId)
      .eq('listing_id', listingId)
      .single();
    if (readError || !image) throw new PermissionError();
    const storage = storageSupabase();
    const { error } = await client.from('listing_images').delete().eq('id', imageId).eq('listing_id', listingId);
    if (error) throw error;
    await storage.storage.from('listing-images').remove([image.storage_path]);
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, message: 'Product photo removed.' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof PermissionError ? error.message : 'The photo could not be removed. Please try again.' },
      { status: error instanceof PermissionError ? 403 : 400 }
    );
  }
}
