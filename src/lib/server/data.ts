import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { demoData } from '@/lib/demo';
import type { Category, Listing, ListingImage, ModerationEvent, PageData, Profile, Report } from '@/lib/types';
import { uuidSchema } from '@/lib/validation';
import { isDemoMode, isSupabaseConfigured } from './config';
import { getSessionContext } from './auth';

const publicPaths = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/rules', '/privacy']);
const empty: Omit<PageData, 'mode'> = { profile: null, listings: [], categories: [], savedIds: [], profiles: [], reports: [], events: [] };
type RawListing = Omit<Listing, 'images' | 'seller_name' | 'price'> & { price: string | number; listing_images: ListingImage[] };

export async function getPageData(path: string, params: Record<string, string | undefined> = {}): Promise<PageData> {
  if (isDemoMode()) return { ...demoData, mode: 'demo' };
  if (!isSupabaseConfigured()) return { ...empty, mode: 'unconfigured' };
  const { client, user, profile } = await getSessionContext();
  const result: PageData = { ...empty, mode: 'supabase', profile };
  if (publicPaths.has(path)) return result;
  if (!user) redirect('/login');
  if (path === '/pending-approval') {
    if (profile?.verification_status === 'approved') redirect('/');
    return result;
  }
  if (profile?.verification_status !== 'approved') redirect('/pending-approval');
  if (path.startsWith('/admin') && profile.role !== 'admin') redirect('/dashboard');

  const [{ data: categories, error: categoryError }, { data: saved, error: savedError }] = await Promise.all([
    client.from('categories').select('*').order('display_order'),
    client.from('saved_listings').select('listing_id').eq('user_id', user.id),
  ]);
  if (categoryError || savedError) throw new Error('The marketplace could not be loaded. Please try again.');
  result.categories = (categories ?? []) as Category[];
  result.savedIds = (saved ?? []).map((item: { listing_id: string }) => item.listing_id);

  const listingMatch = path.match(/^\/listing\/([^/]+)(?:\/edit)?$/);
  const directory = path === '/explore' || path.startsWith('/category/');
  const pageSize = path === '/' ? 8 : directory ? 24 : 200;
  const page = directory ? Math.max(1, Math.min(10000, Number.parseInt(params.page || '1', 10) || 1)) : 1;
  let query = client.from('listings').select('*, listing_images(*)', { count: 'exact' });
  if (listingMatch) {
    if (!uuidSchema.safeParse(listingMatch[1]).success) notFound();
    query = query.eq('id', listingMatch[1]);
  } else if (path === '/dashboard/saved') {
    if (!result.savedIds.length) return { ...result, listingCount: 0, page: 1, pageSize };
    query = query.in('id', result.savedIds).in('status', ['active', 'sold']);
  } else if (path.startsWith('/dashboard')) {
    query = query.eq('seller_id', user.id);
  } else if (!path.startsWith('/admin')) {
    query = query.eq('status', 'active');
  }
  if (directory) {
    const categorySlug = path.startsWith('/category/') ? path.slice('/category/'.length) : params.category;
    if (categorySlug && categorySlug !== 'all') {
      const category = result.categories.find((item) => item.slug === categorySlug);
      if (category) query = query.eq('category_id', category.id);
      else if (path.startsWith('/category/')) notFound();
    }
    // Quote as a PostgREST filter value, escaping grammar metacharacters and SQL wildcards.
    const search = (params.q || '').trim().slice(0, 100).replace(/[\\%_]/g, '\\$&').replace(/"/g, '\\"');
    if (search) query = query.or(`title.ilike."%${search}%",description.ilike."%${search}%"`);
    if (['New', 'Like New', 'Good', 'Fair'].includes(params.condition || '')) query = query.eq('condition', params.condition!);
    for (const [key, op] of [['min', 'gte'], ['max', 'lte']] as const) {
      const value = params[key];
      if (value && /^\d{1,4}(?:\.\d{1,2})?$/.test(value)) query = query[op]('price', value);
    }
  }
  if (directory && params.sort === 'price_asc') query = query.order('price', { ascending: true }).order('id');
  else if (directory && params.sort === 'price_desc') query = query.order('price', { ascending: false }).order('id');
  else query = query.order('created_at', { ascending: false }).order('id');
  const { data: rows, error: listingError, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (listingError) throw new Error('Listings could not be loaded. Please try again.');
  const rawListings = (rows ?? []) as RawListing[];
  if (listingMatch && (!rawListings.length || (path.endsWith('/edit') && rawListings[0].seller_id !== user.id))) notFound();
  result.listingCount = count ?? 0;
  result.page = page;
  result.pageSize = pageSize;

  const sellerIds = [...new Set(rawListings.map((listing) => listing.seller_id))];
  const { data: sellers, error: sellerError } = sellerIds.length ? await client.rpc('get_seller_names', { ids: sellerIds }) : { data: [], error: null };
  if (sellerError) throw new Error('Seller information could not be loaded.');
  const names = new Map<string, string>((sellers ?? []).map((seller: { id: string; display_name: string }) => [seller.id, seller.display_name]));
  const paths = rawListings.flatMap((listing) => listing.listing_images.map((image) => image.storage_path));
  const { data: signed, error: imageError } = paths.length ? await client.storage.from('listing-images').createSignedUrls(paths, 60) : { data: [], error: null };
  if (imageError) throw new Error('Private listing images could not be loaded.');
  const urls = new Map((signed ?? []).map((image) => [image.path, image.signedUrl]));
  result.listings = rawListings.map(({ listing_images, ...listing }) => ({
    ...listing,
    price: String(listing.price),
    seller_name: names.get(listing.seller_id) || 'School member',
    images: listing_images.sort((a, b) => a.display_order - b.display_order).map((image) => ({ ...image, url: urls.get(image.storage_path) || undefined })),
  }));

  if (path.startsWith('/admin')) {
    const [profiles, reports, events] = await Promise.all([
      client.from('profiles').select('id,display_name,avatar_path,role,verification_status,created_at,updated_at').order('created_at', { ascending: false }).limit(200),
      client.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('moderation_events').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (profiles.error || reports.error || events.error) throw new Error('Moderation data could not be loaded.');
    result.profiles = profiles.data as Profile[];
    result.reports = reports.data as Report[];
    result.events = events.data as ModerationEvent[];
  }
  return result;
}
