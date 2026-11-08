'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, GraduationCap, Heart, LayoutDashboard, Leaf, Menu, Moon, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Sun, X } from 'lucide-react';
import { toast } from 'sonner';
import { runAction } from '@/app/actions';
import { demoUserId } from '@/lib/demo';
import { displayNameSchema, listingSchema, reportSchema } from '@/lib/validation';
import type { ActionName, ActionResult, Listing, PageData } from '@/lib/types';
import { categoryIcons, EmptyState, PageHeading, ProductCard } from './ui';
import { ListingDetail, ListingForm } from './listing-pages';
import { AccountPage, AdminPage, AuthPage, Dashboard, PolicyPage } from './account-pages';
type Query = Record<string,string|undefined>;
type MarketContext = { data: PageData; busy: boolean; mutate: (action: ActionName, payload: Record<string,unknown>) => Promise<ActionResult>; setData: React.Dispatch<React.SetStateAction<PageData>> };
const Context = createContext<MarketContext | null>(null);
export function useMarket() { const context = useContext(Context); if (!context) throw new Error('Marketplace context missing'); return context; }
const demoKey = 'campusmarket-demo-v1';
export function MarketApp({ initialData, path, query }: { initialData: PageData; path: string; query: Query }) {
 const [data, rawSetData] = useState(initialData);
 const dataRef = useRef(initialData);
 function setData(value: React.SetStateAction<PageData>) { const next = typeof value === 'function' ? value(dataRef.current) : value; dataRef.current = next; rawSetData(next); }
 const [busy, setBusy] = useState(false);
 const [ready, setReady] = useState(false);
 const router = useRouter();
 useEffect(() => {
  if (initialData.mode === 'demo') {
   try { const stored = localStorage.getItem(demoKey); if (stored) { const parsed = JSON.parse(stored) as PageData; if (parsed.mode === 'demo' && Array.isArray(parsed.listings) && parsed.profile) setData(parsed); } } catch { localStorage.removeItem(demoKey); }
  } else setData(initialData);
  setReady(true);
 }, [initialData]);
 useEffect(() => { if (data.mode === 'demo' && ready) { try { localStorage.setItem(demoKey, JSON.stringify(data)); } catch { toast.error('Demo storage is full. Remove a few uploaded images, or reset the demo.'); } } }, [data, ready]);
 async function mutate(action: ActionName, payload: Record<string,unknown>): Promise<ActionResult> {
  setBusy(true);
  try {
   if (dataRef.current.mode !== 'demo') { const actualPayload = action === 'toggle_saved' ? { id: payload.listing_id, saved: !dataRef.current.savedIds.includes(String(payload.listing_id)) } : payload; const result = await runAction(action, actualPayload); if (result.ok) { toast.success(result.message); if (result.redirect) router.push(result.redirect); else router.refresh(); } else toast.error(result.message); return result; }
   const next = structuredClone(dataRef.current);
   const now = new Date().toISOString();
   let id = typeof payload.id === 'string' ? payload.id : '';
   const item = next.listings.find(l => l.id === id);
   let message = 'Change saved in this browser only.';
   if (action === 'save_listing') {
    const parsed = listingSchema.safeParse(payload); if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    if (item) { if (item.seller_id !== demoUserId) throw new Error('Only the owner can edit this listing.'); Object.assign(item, parsed.data, { status: parsed.data.status, updated_at: now }); }
    else { id = crypto.randomUUID(); next.listings.unshift({ ...parsed.data, id, status: parsed.data.status, seller_id: demoUserId, seller_name: next.profile?.display_name || 'Tariro M.', images: [], created_at: now, updated_at: now }); }
    message = parsed.data.status === 'draft' ? 'Draft saved.' : 'Listing submitted for school review.';
   } else if (action === 'delete_listing') { if (!item || item.seller_id !== demoUserId) throw new Error('Only the owner can delete this listing.'); next.listings = next.listings.filter(l=>l.id!==id); next.savedIds = next.savedIds.filter(value=>value!==id); message = 'Listing deleted.'; }
   else if (action === 'mark_sold') { if (!item || item.seller_id !== demoUserId || item.status !== 'active') throw new Error('Only your active listings can be marked as sold.'); item.status = 'sold'; message = 'Listing marked as sold.'; }
   else if (action === 'toggle_saved') { id = String(payload.listing_id ?? payload.id); const saved = next.savedIds.includes(id); next.savedIds = saved ? next.savedIds.filter(value => value !== id) : [...next.savedIds, id]; message = saved ? 'Removed from saved items.' : 'Added to saved items.'; }
   else if (action === 'report_listing') { const report = reportSchema.parse(payload); next.reports.unshift({ ...report, id: crypto.randomUUID(), reporter_id: demoUserId, status:'open', created_at:now, resolved_at:null }); message = 'Report sent to the moderation queue.'; }
   else if (action === 'update_profile') { const name = displayNameSchema.parse(payload.display_name); if (next.profile) next.profile.display_name = name; next.listings.filter(l=>l.seller_id===demoUserId).forEach(l=>l.seller_name=name); message = 'Display name updated.'; }
   else if (action === 'moderate_user') { const user = next.profiles.find(p=>p.id===id); if (user) user.verification_status = payload.status as typeof user.verification_status; message = 'Account verification updated.'; }
   else if (action === 'moderate_listing') { if (item) item.status = payload.status as Listing['status']; message = payload.status === 'active' ? 'Listing approved.' : 'Listing removed.'; }
   else if (action === 'resolve_report') { const report = next.reports.find(r=>r.id===id); if (report) { report.status = payload.status as typeof report.status; report.resolved_at = now; } message = 'Report reviewed.'; }
   else { toast.info('Authentication needs Supabase. Demo accounts are fictional; no credentials were sent.'); return {ok:false,message:'Configure Supabase to use authentication.'}; }
   if (['moderate_user','moderate_listing','resolve_report'].includes(action)) next.events.unshift({ id: crypto.randomUUID(), actor_id: 'demo-admin', target_type: action, target_id: id, action: String(payload.status), created_at: now });
   setData(next); toast.success(`Demo · ${message}`); return { ok:true, message, id };
  } catch (error) { const message = error instanceof Error ? error.message : 'Unable to save. Try again.'; toast.error(message); return {ok:false,message}; }
  finally { setBusy(false); }
 }
 const context = { data, setData, busy, mutate };
 const authRoute = ['/login','/signup','/forgot-password','/reset-password'].includes(path);
 let page: React.ReactNode;
 if (authRoute) page = <AuthPage path={path}/>;
 else if (path === '/' || path === '/explore' || path.startsWith('/category/')) page = <Browse path={path} query={query}/>;
 else if (path === '/sell' || path.endsWith('/edit')) page = <ListingForm key={path} id={path.endsWith('/edit') ? path.split('/')[2] : undefined}/>;
 else if (path.startsWith('/listing/')) page = <ListingDetail id={path.split('/')[2]}/>;
 else if (path.startsWith('/dashboard')) page = <Dashboard path={path}/>;
 else if (path.startsWith('/admin')) page = <AdminPage path={path}/>;
 else if (path === '/profile' || path === '/pending-approval') page = <AccountPage path={path}/>;
 else page = <PolicyPage path={path}/>;
 return <Context.Provider value={context}><Header path={path}/>{data.mode === 'demo' && <div className="demo-banner" data-testid="demo-banner"><div className="container"><span><span className="demo-dot"/><strong>Local demo</strong><span className="demo-explanation"> · Fictional members and listings. Changes stay in this browser.</span></span><Link href="/admin">Preview admin <ArrowUpRight size={13}/></Link></div></div>}{data.mode === 'unconfigured' && <div className="configuration-banner">Supabase isn’t configured. Add your environment variables to enable secure access.</div>}<main id="main" className={authRoute ? 'auth-main' : 'container main-content'}>{page}</main><Footer/><nav className="mobile-bottom" aria-label="Mobile navigation"><Link className={path==='/'||path.startsWith('/explore')?'active':''} href="/explore"><ShoppingBag size={20}/>Explore</Link><Link href="/dashboard/saved"><Heart size={20}/>Saved</Link><Link className="mobile-sell" href="/sell"><Plus size={22}/>Sell</Link><Link href="/dashboard"><LayoutDashboard size={20}/>My space</Link></nav></Context.Provider>;
}
function Header({path}:{path:string}) {
 const { data } = useMarket(); const [dark,setDark]=useState(false); const [menu,setMenu]=useState(false);
 useEffect(()=>{setDark(document.documentElement.dataset.theme==='dark');},[]);
 function toggleTheme(){const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';localStorage.setItem('campusmarket-theme',next?'dark':'light');}
 return <header className="site-header"><div className="container header-inner"><Link href="/" className="brand" aria-label="CampusMarket home"><span className="brand-mark"><ShoppingBag size={21}/><span/></span><span>Campus<span className="brand-light">Market</span><span className="brand-period">.</span></span></Link><nav className="desktop-nav" aria-label="Main navigation"><Link className={path==='/'||path.startsWith('/explore')||path.startsWith('/category')?'active':''} href="/explore">Explore</Link><Link className={path==='/dashboard/saved'?'active':''} href="/dashboard/saved">Saved</Link><Link className={path.startsWith('/dashboard')&&path!=='/dashboard/saved'?'active':''} href="/dashboard">My dashboard</Link></nav><div className="header-actions"><button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={dark?'Switch to light mode':'Switch to dark mode'}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button><Link className="button primary sell-header" href="/sell"><Plus size={17}/>Sell an item</Link>{data.profile?<Link href="/profile" className="avatar" aria-label="Account settings">{data.profile.display_name.split(' ').map(n=>n[0]).slice(0,2).join('')}</Link>:<Link href="/login" className="sign-in">Log in</Link>}<button className="icon-button menu-toggle" aria-label={menu?'Close menu':'Open menu'} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></div>{menu&&<nav className="mobile-menu" aria-label="Expanded navigation"><Link href="/explore" onClick={()=>setMenu(false)}>Explore marketplace</Link><Link href="/dashboard" onClick={()=>setMenu(false)}>My dashboard</Link><Link href="/dashboard/saved" onClick={()=>setMenu(false)}>Saved items</Link><Link href="/rules" onClick={()=>setMenu(false)}>School rules</Link><Link href="/profile" onClick={()=>setMenu(false)}>Account settings</Link></nav>}</header>;
}
function Footer(){return <footer className="site-footer"><div className="container footer-inner"><div><Link className="brand footer-brand" href="/"><ShoppingBag size={20}/>CampusMarket<span className="brand-period">.</span></Link><p>Good things deserve another school year.</p></div><div className="footer-links"><Link href="/rules">School rules</Link><Link href="/privacy">Privacy notice</Link><Link href="/rules#exchanges">Safe exchanges <ArrowUpRight size={13}/></Link></div><span className="footer-note"><GraduationCap size={17}/> Made for your school community</span></div></footer>;}
function Hero(){return <section className="hero"><div className="hero-copy"><div className="hero-kicker"><span className="tiny-dot"/>YOUR SCHOOL. YOUR MARKETPLACE.</div><h1>A little less new.<br/>A lot more <span>possibility.</span></h1><p>Find what you need. Pass on what you don’t.<br className="desktop-break"/> Good things go further in our school community.</p><div className="button-row"><Link className="button primary hero-button" href="/explore">Explore the marketplace<ArrowRight size={18}/></Link><Link className="hero-secondary" href="/sell">Start selling<ArrowUpRight size={16}/></Link></div><div className="hero-trust"><span className="mini-avatars"><i>T</i><i>N</i><i>C</i></span><div><strong>A small community. A better way.</strong><span><ShieldCheck size={13}/>School-verified members only</span></div></div></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><span className="hero-spark spark-one">✳</span><span className="hero-spark spark-two">✦</span><div className="hero-product hero-book"><img src="/products/maths.svg" alt=""/><div>Ready for your next chapter<span>$8</span></div></div><div className="hero-product hero-bag"><img src="/products/backpack.svg" alt=""/><div>A new adventure awaits<span>$15</span></div></div><div className="floating-label label-top"><Leaf size={18}/><span>Pre-loved. Re-loved.</span></div><div className="floating-label label-bottom"><span className="check-circle"><Check size={14}/></span>A smarter school-day find</div></div></section>;}
function Browse({path,query}:{path:string;query:Query}){
 const {data,mutate}=useMarket(); const isHome=path==='/'; const [filters,setFilters]=useState(false);
 const currentCategory=data.categories.find(c=>c.slug===path.split('/')[2]||c.slug===query.category);
 let listings=data.listings.filter(l=>l.status==='active');
 if(data.mode==='demo'){
  if(query.q) listings=listings.filter(l=>`${l.title} ${l.description}`.toLowerCase().includes(query.q!.toLowerCase()));
  if(currentCategory) listings=listings.filter(l=>l.category_id===currentCategory.id);
  if(query.condition) listings=listings.filter(l=>l.condition===query.condition);
  if(query.min) listings=listings.filter(l=>Number(l.price)>=Number(query.min));
  if(query.max) listings=listings.filter(l=>Number(l.price)<=Number(query.max));
  listings.sort((a,b)=>query.sort==='price_asc'?Number(a.price)-Number(b.price):query.sort==='price_desc'?Number(b.price)-Number(a.price):Date.parse(b.created_at)-Date.parse(a.created_at));
 }
 const total=data.mode==='demo'?listings.length:data.listingCount??listings.length;
 if(isHome) listings=listings.slice(0,8);
 const save=(id:string)=>void mutate('toggle_saved',{listing_id:id});
 return <>{isHome?<><Hero/><div className="trust-strip"><span><ShieldCheck/>Your school, verified</span><span><Leaf/>Better for your budget & the planet</span><span><ShoppingBag/>School essentials, a second chapter</span></div></>:<PageHeading eyebrow="THE SCHOOL COMMUNITY COLLECTION" title={currentCategory?.name||'Find your next good thing.'} description={currentCategory?.description||'From next-term textbooks to everyday essentials. Find it here, for less.'}/>}
 <section className="category-section"><div className="section-heading"><h2>Shop by category</h2><Link href="/explore">View all<ArrowRight size={16}/></Link></div><div className="category-grid">{data.categories.map((category,i)=>{const Icon=categoryIcons[i];return <Link className={`category-tile ${currentCategory?.id===category.id?'selected':''}`} href={`/category/${category.slug}`} key={category.id}><span className={`category-icon cat-${i}`}><Icon size={25} strokeWidth={1.5}/></span><span>{category.name==='Other Approved Items'?'Other finds':category.name}</span></Link>;})}</div></section>
 <section className="listings-section"><div className="section-heading listing-section-heading"><div><p className="eyebrow">GOOD FINDS. SMALL PRICES.</p><h2>{isHome?'Fresh on the market':query.q?`Results for “${query.q}”`:currentCategory?`Explore ${currentCategory.name.toLowerCase()}`:'Explore the marketplace'}<span className="count-pill">{total}</span></h2></div>{isHome&&<Link href="/explore">Browse all listings<ArrowRight size={16}/></Link>}</div>
 <form action={currentCategory?`/category/${currentCategory.slug}`:'/explore'} className="browse-controls"><div className="search-field"><Search size={19}/><input type="search" name="q" aria-label="Search listings" placeholder="Search for your next great find..." defaultValue={query.q}/><button type="submit" className="search-submit" aria-label="Submit search"><ArrowRight size={18}/></button></div><button type="button" className="button secondary filters-toggle" aria-expanded={filters} onClick={()=>setFilters(!filters)}>Filters<ChevronDown size={16}/></button><label className="sort-field"><span>Sort by:</span><select name="sort" aria-label="Sort by" defaultValue={query.sort||'newest'} onChange={e=>e.currentTarget.form?.requestSubmit()}><option value="newest">Newest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label><div className={`filter-fields ${!isHome||filters?'show-filters':''}`}>{!currentCategory&&<label>Category<select name="category" defaultValue={query.category||''}><option value="">All categories</option>{data.categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label>}<label>Condition<select name="condition" defaultValue={query.condition||''}><option value="">Any condition</option>{['New','Like New','Good','Fair'].map(c=><option key={c}>{c}</option>)}</select></label><label>Minimum price<input name="min" type="number" min="0" max="5000" step="0.01" placeholder="$0" defaultValue={query.min}/></label><label>Maximum price<input name="max" type="number" min="0" max="5000" step="0.01" placeholder="$5,000" defaultValue={query.max}/></label><button className="button primary" type="submit">Apply filters</button><Link href={currentCategory?`/category/${currentCategory.slug}`:'/explore'} className="text-link">Reset</Link></div></form>
 {listings.length?<div className="product-grid">{listings.map(l=><ProductCard key={l.id} listing={l} categories={data.categories} saved={data.savedIds.includes(l.id)} onSave={()=>save(l.id)}/>)}</div>:<EmptyState title="No finds just yet." text="Try a different search or clear a filter. Your next good find could be on its way." href="/explore" action="Clear filters"/>}
 {!isHome&&data.mode!=='demo'&&total>(data.pageSize??24)&&<nav className="pagination" aria-label="Listing pages">{Array.from({length:Math.ceil(total/(data.pageSize??24))},(_,i)=><Link key={i} aria-current={(data.page??1)===i+1?'page':undefined} className="button secondary" href={`${path}?${new URLSearchParams({...Object.fromEntries(Object.entries(query).filter(([,v])=>v!==undefined)) as Record<string,string>,page:String(i+1)})}`}>{i+1}</Link>)}</nav>}
 </section>{isHome&&<><section className="sell-callout"><div className="callout-icon"><Sparkles size={30}/></div><div><p className="eyebrow">LESS CLUTTER. MORE POSSIBILITY.</p><h2>Done with it? Someone else isn’t.</h2><p>Give your school essentials a second life. Listing is simple and free.</p></div><Link className="button primary" href="/sell">List your first item<ArrowRight size={17}/></Link></section><div className="safety-note"><ShieldCheck size={19}/><p>A community built on trust. All members and listings are reviewed by your school.</p><Link href="/rules">How it works<CircleHelp size={15}/></Link></div></>}
 </>;
}
