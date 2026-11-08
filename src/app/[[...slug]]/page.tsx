import { notFound, redirect } from 'next/navigation';
import { getPageData } from '@/lib/server/data';
import { MarketApp } from '@/components/market-app';

export const dynamic = 'force-dynamic';

const knownRoutes = new Set([
  '/',
  '/marketplace',
  '/projects',
  '/about',
  '/seller',
  '/seller/register',
  '/seller/dashboard',
  '/seller/products',
  '/seller/products/new',
  '/seller/group',
  '/seller/settings',
  '/account',
  '/pending-approval',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/rules',
  '/privacy',
  '/admin',
  '/admin/users',
  '/admin/groups',
  '/admin/products',
  '/admin/requests',
  '/admin/reports',
]);

function legacyRedirect(path: string, queryString: string): string | null {
  const suffix = queryString ? `?${queryString}` : '';
  if (path === '/explore') return `/marketplace${suffix}`;
  if (path === '/sell') return `/seller/products/new${suffix}`;
  if (path === '/dashboard') return `/seller/dashboard${suffix}`;
  if (path === '/dashboard/listings') return `/seller/products${suffix}`;
  if (path === '/dashboard/saved') return `/account?tab=saved`;
  if (path === '/profile') return `/account${suffix}`;
  if (path === '/admin/listings') return `/admin/products${suffix}`;
  const oldEdit = path.match(/^\/listing\/([a-zA-Z0-9-]+)\/edit$/);
  if (oldEdit) return `/seller/products/${oldEdit[1]}/edit`;
  const oldDetail = path.match(/^\/listing\/([a-zA-Z0-9-]+)$/);
  if (oldDetail) return `/product/${oldDetail[1]}`;
  return null;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const path = '/' + (slug?.join('/') ?? '');
  const query = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );
  const queryString = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined) as [string, string][]
  ).toString();

  const target = legacyRedirect(path, queryString);
  if (target) redirect(target);

  const validDynamic =
    /^\/category\/[a-z0-9-]+$/.test(path) ||
    /^\/projects\/[a-z0-9-]+$/.test(path) ||
    /^\/product\/[a-zA-Z0-9-]+$/.test(path) ||
    /^\/seller\/products\/[a-zA-Z0-9-]+\/edit$/.test(path);

  if (!knownRoutes.has(path) && !validDynamic) notFound();

  const data = await getPageData(path, query);
  if (data.mode === 'supabase') {
    if (path.startsWith('/category/') && !data.categories.some((c) => c.slug === slug?.[1])) notFound();
    if (path.startsWith('/product/') && !data.listings.some((l) => l.id === slug?.[1])) notFound();
    if (path.startsWith('/seller/products/') && path.endsWith('/edit') && !data.listings.some((l) => l.id === slug?.[2])) {
      notFound();
    }
  }

  return <MarketApp path={path} initialData={data} query={query} />;
}
