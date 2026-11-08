import { notFound } from 'next/navigation';
import { getPageData } from '@/lib/server/data';
import { MarketApp } from '@/components/market-app';
export const dynamic = 'force-dynamic';
const known = ['/', '/explore', '/login', '/signup', '/forgot-password', '/reset-password', '/pending-approval', '/sell', '/dashboard', '/dashboard/listings', '/dashboard/saved', '/profile', '/admin', '/admin/users', '/admin/listings', '/admin/reports', '/rules', '/privacy'];
export default async function Page({ params, searchParams }: { params: Promise<{ slug?: string[] }>; searchParams: Promise<Record<string,string|string[]|undefined>> }) {
 const { slug } = await params;
 const path = '/' + (slug?.join('/') ?? '');
 if (!known.includes(path) && !/^\/category\/[a-z0-9-]+$/.test(path) && !/^\/listing\/[a-zA-Z0-9-]+(?:\/edit)?$/.test(path)) notFound();
 const query = Object.fromEntries(Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
 const data = await getPageData(path, query);
 if (path.startsWith('/category/') && !data.categories.some(c => c.slug === slug?.[1])) notFound();
 if (path.startsWith('/listing/') && !data.listings.some(l => l.id === slug?.[1]) && data.mode !== 'demo') notFound();
 return <MarketApp path={path} initialData={data} query={query} />;
}
