import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { canEditProduct, isApprovedGroupMember } from '@/lib/permissions';
import type {
  Category,
  GroupMember,
  Listing,
  ListingImage,
  ModerationEvent,
  PageData,
  Profile,
  PurchaseRequest,
  Report,
  SchoolMemberOption,
  SellerGroup,
} from '@/lib/types';
import { uuidSchema } from '@/lib/validation';
import { isSupabaseConfigured } from './config';
import { getSessionContext } from './auth';

const publicPaths = new Set([
  '/',
  '/about',
  '/seller',
  '/seller/register',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/rules',
  '/privacy',
]);

const empty: Omit<PageData, 'mode'> = {
  profile: null,
  listings: [],
  categories: [],
  groups: [],
  purchaseRequests: [],
  savedIds: [],
  profiles: [],
  reports: [],
  events: [],
  schoolMembers: [],
};

type RawListing = Omit<Listing, 'images' | 'seller_name' | 'group_name' | 'group_slug' | 'price'> & {
  price: string | number;
  listing_images?: ListingImage[];
};

type RawGroup = Omit<SellerGroup, 'creator_name' | 'members'>;
type RawGroupMember = Omit<GroupMember, 'display_name'>;
type RawPurchaseRequest = Omit<
  PurchaseRequest,
  'buyer_name' | 'listing_title' | 'listing_price' | 'seller_name' | 'group_name'
>;

export async function getPageData(path: string, params: Record<string, string | undefined> = {}): Promise<PageData> {
  if (!isSupabaseConfigured()) return { ...empty, mode: 'unconfigured' };

  const { client, user, profile } = await getSessionContext();
  const result: PageData = { ...empty, mode: 'supabase', profile };

  const isApprovedMember = Boolean(user && profile?.verification_status === 'approved');

  if (publicPaths.has(path)) {
    if (!isApprovedMember || !['/', '/seller', '/seller/register'].includes(path)) {
      return result;
    }
  } else {
    if (!user) redirect('/login');
    if (path === '/pending-approval') {
      if (profile?.verification_status === 'approved') redirect('/marketplace');
      return result;
    }
    if (profile?.verification_status !== 'approved') redirect('/pending-approval');
    if (path.startsWith('/admin') && profile.role !== 'admin') redirect('/seller/dashboard');
  }

  // Approved member data loading
  const [categoriesRes, savedRes, groupsRes, groupMembersRes] = await Promise.all([
    client.from('categories').select('*').order('display_order'),
    client.from('saved_listings').select('listing_id').eq('user_id', user!.id),
    client.from('seller_groups').select('*').order('created_at', { ascending: false }),
    client.from('group_members').select('*').order('created_at', { ascending: true }),
  ]);

  if (categoriesRes.error || savedRes.error || groupsRes.error || groupMembersRes.error) {
    throw new Error('The marketplace could not be loaded. Please try again.');
  }

  result.categories = (categoriesRes.data ?? []) as Category[];
  result.savedIds = (savedRes.data ?? []).map((item: { listing_id: string }) => item.listing_id);

  const rawGroups = ((groupsRes?.data ?? []) as RawGroup[]);
  const rawMembers = ((groupMembersRes?.data ?? []) as RawGroupMember[]);

  const preliminaryGroups: SellerGroup[] = rawGroups.map((group) => ({
    ...group,
    creator_name: 'School member',
    members: rawMembers
      .filter((member) => member.group_id === group.id)
      .map((member) => ({ ...member, display_name: 'School member' })),
  }));

  if (path === '/seller' || path === '/seller/register') {
    const groupUserIds = [
      ...new Set([
        ...preliminaryGroups.map((g) => g.created_by),
        ...preliminaryGroups.flatMap((g) => g.members.map((m) => m.user_id)),
      ]),
    ];
    const nameMap = await fetchDisplayNames(client, groupUserIds);
    result.groups = applyGroupNames(preliminaryGroups, nameMap);
    return result;
  }

  const productDetailMatch = path.match(/^\/product\/([^/]+)$/);
  const sellerEditMatch = path.match(/^\/seller\/products\/([^/]+)\/edit$/);
  const legacyListingMatch = path.match(/^\/listing\/([^/]+)(?:\/edit)?$/);
  const targetListingId = productDetailMatch?.[1] || sellerEditMatch?.[1] || legacyListingMatch?.[1];
  const isEditRoute = Boolean(sellerEditMatch || (legacyListingMatch && path.endsWith('/edit')));

  const projectDetailMatch = path.match(/^\/projects\/([^/]+)$/);
  const targetProjectGroup = projectDetailMatch
    ? preliminaryGroups.find((g) => g.slug === projectDetailMatch[1] && g.verification_status === 'approved')
    : undefined;
  if (projectDetailMatch && !targetProjectGroup) notFound();

  const directory = path === '/marketplace' || path.startsWith('/category/');
  const pageSize = path === '/' ? 8 : directory ? 24 : 200;
  const page = directory ? Math.max(1, Math.min(10000, Number.parseInt(params.page || '1', 10) || 1)) : 1;

  // Load purchase requests first when on /account so referenced listings can also be resolved
  const shouldLoadRequests =
    path.startsWith('/seller') ||
    path === '/account' ||
    Boolean(targetListingId) ||
    path.startsWith('/admin');

  const requestsRes = shouldLoadRequests
    ? await client.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(200)
    : { data: [], error: null };
  if (requestsRes.error) throw new Error('Purchase requests could not be loaded. Please try again.');
  const rawRequests = (requestsRes.data ?? []) as RawPurchaseRequest[];

  const myApprovedGroupIds = preliminaryGroups
    .filter((group) => isApprovedGroupMember(profile, group))
    .map((group) => group.id);

  let query = client.from('listings').select('*, listing_images(*)', { count: 'exact' });

  if (targetListingId) {
    if (!uuidSchema.safeParse(targetListingId).success) notFound();
    query = query.eq('id', targetListingId);
  } else if (path === '/account') {
    const relevantIds = [...new Set([...result.savedIds, ...rawRequests.map((r) => r.listing_id)])];
    if (!relevantIds.length) {
      result.groups = applyGroupNames(preliminaryGroups, new Map());
      return { ...result, listingCount: 0, page: 1, pageSize };
    }
    query = query.in('id', relevantIds);
  } else if (path.startsWith('/seller/')) {
    if (myApprovedGroupIds.length > 0) {
      query = query.or(`seller_id.eq.${user!.id},group_id.in.(${myApprovedGroupIds.join(',')})`);
    } else {
      query = query.eq('seller_id', user!.id);
    }
  } else if (targetProjectGroup) {
    query = query.eq('status', 'active').eq('group_id', targetProjectGroup.id);
  } else if (!path.startsWith('/admin')) {
    query = query.eq('status', 'active');
  }

  if (directory) {
    const categorySlug = path.startsWith('/category/') ? path.slice('/category/'.length) : params.category;
    if (categorySlug && categorySlug !== 'all') {
      const category = result.categories.find((item) => item.slug === categorySlug);
      if (category) query = query.eq('category_id', category.id);
      else if (path.startsWith('/category/')) notFound();
      else return { ...result, groups: preliminaryGroups, listingCount: 0, page: 1, pageSize };
    }

    if (params.availability && ['available', 'sold_out'].includes(params.availability)) {
      query = query.eq('availability', params.availability);
    }

    const rawSearch = (params.q || '').trim().slice(0, 100);
    if (rawSearch) {
      const search = rawSearch.replace(/[\\%_]/g, '\\$&').replace(/"/g, '\\"');
      const lower = rawSearch.toLowerCase();
      const matchingCatIds = result.categories
        .filter((c) => c.name.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower))
        .map((c) => c.id);
      const matchingGroupIds = preliminaryGroups
        .filter(
          (g) =>
            g.verification_status === 'approved' &&
            (g.name.toLowerCase().includes(lower) || g.project_description.toLowerCase().includes(lower))
        )
        .map((g) => g.id);
      const memberRes = client.rpc ? await client.rpc('find_school_members', { search_term: rawSearch }) : { data: [] };
      if ('error' in memberRes && memberRes.error) throw new Error('Search could not be completed. Please try again.');
      const matchingSellerIds = ((memberRes?.data ?? []) as SchoolMemberOption[]).map((m) => m.id);

      const orClauses = [
        `title.ilike."%${search}%"`,
        `description.ilike."%${search}%"`,
        `project_name.ilike."%${search}%"`,
        `learning_area.ilike."%${search}%"`,
      ];
      if (matchingCatIds.length) orClauses.push(`category_id.in.(${matchingCatIds.join(',')})`);
      if (matchingGroupIds.length) orClauses.push(`group_id.in.(${matchingGroupIds.join(',')})`);
      if (matchingSellerIds.length) orClauses.push(`seller_id.in.(${matchingSellerIds.join(',')})`);
      query = query.or(orClauses.join(','));
    }

    for (const [key, op] of [['min', 'gte'], ['max', 'lte']] as const) {
      const value = params[key];
      if (value && /^\d{1,4}(?:\.\d{1,2})?$/.test(value)) query = query[op]('price', value);
    }
  }

  if (directory && params.sort === 'price_asc') query = query.order('price', { ascending: true }).order('id');
  else if (directory && params.sort === 'price_desc') query = query.order('price', { ascending: false }).order('id');
  else query = query.order('created_at', { ascending: false }).order('id');

  const { data: rows, error: listingError, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (listingError) throw new Error('Products could not be loaded. Please try again.');

  const rawListings = (rows ?? []) as RawListing[];
  if (targetListingId) {
    if (!rawListings.length) notFound();
    if (isEditRoute) {
      const normalizedCheck = {
        seller_id: rawListings[0].seller_id,
        group_id: rawListings[0].group_id ?? null,
      };
      if (!canEditProduct(profile, normalizedCheck, preliminaryGroups)) notFound();
    }
  }

  result.listingCount = count ?? 0;
  result.page = page;
  result.pageSize = pageSize;

  // Fetch missing listing titles/prices referenced by purchase requests if not already in rawListings
  const loadedListingMap = new Map<string, { title: string; price: string }>(
    rawListings.map((item) => [item.id, { title: item.title, price: String(item.price) }])
  );
  const missingReqListingIds = [...new Set(rawRequests.map((r) => r.listing_id))].filter((id) => !loadedListingMap.has(id));
  if (missingReqListingIds.length > 0) {
    const extraListings = await client.from('listings').select('id,title,price').in('id', missingReqListingIds);
    if (extraListings.error) throw new Error('Purchase request products could not be loaded. Please try again.');
    for (const item of (extraListings.data ?? []) as { id: string; title: string; price: string | number }[]) {
      loadedListingMap.set(item.id, { title: item.title, price: String(item.price) });
    }
  }

  const allLookupUserIds = [
    ...new Set([
      ...rawListings.map((listing) => listing.seller_id),
      ...preliminaryGroups.map((group) => group.created_by),
      ...preliminaryGroups.flatMap((group) => group.members.map((member) => member.user_id)),
      ...rawRequests.flatMap((req) => [req.buyer_id, req.seller_id]),
    ]),
  ];

  const names = await fetchDisplayNames(client, allLookupUserIds);
  result.groups = applyGroupNames(preliminaryGroups, names);
  const groupById = new Map(result.groups.map((group) => [group.id, group]));

  const imagePaths = rawListings.flatMap((listing) => (listing.listing_images ?? []).map((image) => image.storage_path));
  const { data: signed, error: imageError } = imagePaths.length
    ? await client.storage.from('listing-images').createSignedUrls(imagePaths, 60)
    : { data: [], error: null };
  if (imageError) throw new Error('Private product images could not be loaded.');
  const urls = new Map((signed ?? []).map((image) => [image.path, image.signedUrl]));

  result.listings = rawListings.map(({ listing_images, ...listing }) => {
    const group = listing.group_id ? groupById.get(listing.group_id) : undefined;
    return {
      ...listing,
      group_id: listing.group_id ?? null,
      project_name: listing.project_name ?? null,
      stock_quantity: listing.stock_quantity ?? 1,
      availability: listing.availability ?? 'available',
      materials: listing.materials ?? null,
      dimensions: listing.dimensions ?? null,
      production_method: listing.production_method ?? null,
      learning_area: listing.learning_area ?? null,
      made_to_order: Boolean(listing.made_to_order),
      created_by_admin: listing.created_by_admin ?? null,
      price: String(listing.price),
      seller_name: names.get(listing.seller_id) || 'School member',
      group_name: group?.name ?? null,
      group_slug: group?.slug ?? null,
      images: (listing_images ?? [])
        .sort((a, b) => a.display_order - b.display_order)
        .map((image) => ({ ...image, url: urls.get(image.storage_path) || undefined })),
    };
  });

  result.purchaseRequests = rawRequests.map((req) => {
    const listingMeta = loadedListingMap.get(req.listing_id);
    const group = req.group_id ? groupById.get(req.group_id) : undefined;
    return {
      ...req,
      buyer_name: names.get(req.buyer_id) || 'School member',
      seller_name: names.get(req.seller_id) || 'School seller',
      group_name: group?.name ?? null,
      listing_title: listingMeta?.title || 'Student project product',
      listing_price: listingMeta?.price || '0.00',
    };
  });

  if ((path === '/seller/group' || path.startsWith('/admin')) && client.rpc) {
    const membersRes = await client.rpc('find_school_members', { search_term: '' });
    if (membersRes.error) throw new Error('School members could not be loaded. Please try again.');
    result.schoolMembers = ((membersRes?.data ?? []) as SchoolMemberOption[]);
  }

  if (path.startsWith('/admin')) {
    const [profilesRes, reportsRes, eventsRes] = await Promise.all([
      client
        .from('profiles')
        .select('id,display_name,avatar_path,role,verification_status,seller_type,seller_approved,project_summary,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(200),
      client.from('reports').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('moderation_events').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (profilesRes.error || reportsRes.error || eventsRes.error) {
      throw new Error('Moderation data could not be loaded.');
    }
    result.profiles = ((profilesRes.data ?? []) as Partial<Profile>[]).map((item) => ({
      ...(item as Profile),
      seller_type: item.seller_type ?? 'none',
      seller_approved: Boolean(item.seller_approved),
      project_summary: item.project_summary ?? null,
    }));
    result.reports = (reportsRes.data ?? []) as Report[];
    result.events = (eventsRes.data ?? []) as ModerationEvent[];
  }

  return result;
}

async function fetchDisplayNames(
  client: { rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  ids: string[]
): Promise<Map<string, string>> {
  if (!ids.length || !client.rpc) return new Map();
  const { data, error } = await client.rpc('get_seller_names', { ids });
  if (error) throw new Error('Member names could not be loaded.');
  return new Map(
    ((data ?? []) as { id: string; display_name: string }[]).map((entry) => [entry.id, entry.display_name])
  );
}

function applyGroupNames(groups: SellerGroup[], names: Map<string, string>): SellerGroup[] {
  return groups.map((group) => ({
    ...group,
    creator_name: names.get(group.created_by) || 'School member',
    members: group.members.map((member) => ({
      ...member,
      display_name: names.get(member.user_id) || 'School member',
    })),
  }));
}
