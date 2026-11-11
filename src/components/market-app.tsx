'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Compass,
  FolderKanban,
  GraduationCap,
  Home,
  Layers,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { runAction } from '@/app/actions';
import { canManageGroupProducts, isApprovedGroupMember, isApprovedSeller } from '@/lib/permissions';
import type { ActionName, ActionResult, Category, PageData } from '@/lib/types';
import { categoryIcons, EmptyState, PageHeading, ProductCard } from './ui';
import { ListingDetail, ListingForm } from './listing-pages';
import { AboutPage, AccountPage, AuthPage, PolicyPage } from './account-pages';
import { SellerLandingPage, SellerPortalWorkspace, SellerRegisterPage } from './seller-pages';
import { AdminPage } from './admin-pages';

type Query = Record<string, string | undefined>;
type MarketContext = {
  data: PageData;
  busy: boolean;
  mutate: (action: ActionName, payload: Record<string, unknown>) => Promise<ActionResult>;
};

const Context = createContext<MarketContext | null>(null);
export function useMarket() {
  const context = useContext(Context);
  if (!context) throw new Error('Marketplace context missing');
  return context;
}

const fallbackCurriculumAreas: Pick<Category, 'name' | 'slug' | 'description'>[] = [
  {
    name: 'Design & Technology',
    slug: 'design-and-technology',
    description: 'Engineered prototypes, woodwork, metalwork, and practical student builds.',
  },
  {
    name: 'Agriculture & Agribusiness',
    slug: 'agriculture-and-agribusiness',
    description: 'Horticulture, seedlings, and sustainable school farm projects.',
  },
  {
    name: 'Food Science & Nutrition',
    slug: 'food-science-and-nutrition',
    description: 'School-inspected culinary, baking, and food-processing learner projects.',
  },
  {
    name: 'Textiles, Fashion & Craft',
    slug: 'textiles-fashion-and-craft',
    description: 'Garments, textiles, beadwork, and handcrafted student design work.',
  },
  {
    name: 'Science & STEM Innovations',
    slug: 'science-and-stem',
    description: 'Electronics, robotics, renewable energy, and applied science models.',
  },
  {
    name: 'Visual & Creative Arts',
    slug: 'visual-and-creative-arts',
    description: 'Original artwork, ceramics, printmaking, and creative studio pieces.',
  },
  {
    name: 'ICT & Media Projects',
    slug: 'ict-and-media',
    description: 'Student-authored guides, design prints, and educational project kits.',
  },
  {
    name: 'Enterprise & Collaborative Goods',
    slug: 'enterprise-and-collaborative',
    description: 'Interdisciplinary student enterprise products approved by the school.',
  },
];

const themeListeners = new Set<() => void>();
function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'campusmarket-theme') {
      document.documentElement.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
function getThemeSnapshot() {
  return document.documentElement.dataset.theme === 'dark';
}
function getThemeServerSnapshot() {
  return false;
}
function setThemePreference(dark: boolean) {
  const next = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('campusmarket-theme', next);
  } catch {
    /* ignore storage errors */
  }
  themeListeners.forEach((listener) => listener());
}

export function MarketApp({
  initialData,
  path,
  query,
}: {
  initialData: PageData;
  path: string;
  query: Query;
}) {
  const data = initialData;
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function mutate(action: ActionName, payload: Record<string, unknown>): Promise<ActionResult> {
    setBusy(true);
    try {
      const actualPayload =
        action === 'toggle_saved'
          ? {
              id: payload.listing_id ?? payload.id,
              saved: !data.savedIds.includes(String(payload.listing_id ?? payload.id)),
            }
          : payload;
      const result = await runAction(action, actualPayload);
      if (result.ok) {
        toast.success(result.message);
        if (result.redirect) router.push(result.redirect);
        else router.refresh();
      } else {
        toast.error(result.message);
      }
      return result;
    } catch {
      const message = 'Unable to complete request. Check your connection and try again.';
      toast.error(message);
      return { ok: false, message };
    } finally {
      setBusy(false);
    }
  }

  const context: MarketContext = { data, busy, mutate };
  const authRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(path);
  const previewableWhenUnconfigured =
    authRoute ||
    [
      '/',
      '/marketplace',
      '/projects',
      '/about',
      '/seller',
      '/seller/register',
      '/rules',
      '/privacy',
    ].includes(path) ||
    path.startsWith('/category/');

  let page: React.ReactNode;
  if (data.mode === 'unconfigured' && !previewableWhenUnconfigured) {
    page = <ConfigurationRequiredState />;
  } else if (authRoute) {
    page = <AuthPage key={path} path={path} query={query} />;
  } else if (path === '/') {
    page = <HomePage />;
  } else if (path === '/marketplace' || path.startsWith('/category/')) {
    page = <MarketplaceCatalog key={`${path}:${JSON.stringify(query)}`} path={path} query={query} />;
  } else if (path === '/projects' || path.startsWith('/projects/')) {
    page = <ProjectsExplorer path={path} />;
  } else if (path === '/about') {
    page = <AboutPage />;
  } else if (path === '/seller') {
    page = <SellerLandingPage />;
  } else if (path === '/seller/register') {
    page = <SellerRegisterPage key={query.type || 'default'} query={query} />;
  } else if (path === '/seller/products/new') {
    page = <ListingForm key={path} initialGroupId={query.group} />;
  } else if (path.startsWith('/seller/products/') && path.endsWith('/edit')) {
    page = <ListingForm key={path} id={path.split('/')[3]} />;
  } else if (path.startsWith('/seller/')) {
    page = <SellerPortalWorkspace key={path} path={path} query={query} />;
  } else if (path.startsWith('/product/')) {
    page = <ListingDetail key={path} id={path.split('/')[2]} />;
  } else if (path.startsWith('/admin')) {
    page = <AdminPage key={path} path={path} />;
  } else if (path === '/account' || path === '/pending-approval') {
    page = <AccountPage key={path} path={path} query={query} />;
  } else {
    page = <PolicyPage path={path} />;
  }

  return (
    <Context.Provider value={context}>
      <Header path={path} />
      {data.mode === 'unconfigured' && (
        <div className="configuration-banner" data-testid="configuration-banner">
          <div className="container config-banner-inner">
            <span>
              <strong>Supabase setup required for live accounts & storage.</strong> Add{' '}
              <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, and{' '}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code>.
            </span>
            <Link href="/about">Platform info</Link>
          </div>
        </div>
      )}
      <main id="main" className={authRoute ? 'auth-main' : 'container main-content'}>
        {(path.startsWith('/admin') || path.startsWith('/seller/')) &&
          [data.listings, data.profiles, data.reports, data.events, data.purchaseRequests].some(rows => rows.length >= 200) &&
          <p className="inline-notice" role="status">This workspace shows up to 200 records per collection. Counts describe the loaded records; ask the administrator to review the full database when the school grows beyond this limit.</p>}
        {page}
      </main>
      <Footer />
      <MobileBottomNav path={path} signedIn={Boolean(data.profile)} />
    </Context.Provider>
  );
}

function ConfigurationRequiredState() {
  return (
    <>
      <PageHeading
        eyebrow="SUPABASE CONFIGURATION REQUIRED"
        title="Connect your school Supabase project to use workspaces."
        description="CampusMarket never simulates cloud saves or fabricates accounts. Connect your Supabase credentials to access authenticated seller dashboards, group workspaces, and moderation."
      />
      <EmptyState
        title="Environment variables needed in .env.local"
        text="Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, and apply the SQL migrations in supabase/migrations/."
        href="/seller"
        action="Preview Seller Portal"
        secondaryHref="/"
        secondaryAction="Return Home"
      />
    </>
  );
}

function Header({ path }: { path: string }) {
  const { data } = useMarket();
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const [menu, setMenu] = useState(false);

  const isSellerActive = path.startsWith('/seller');
  const isMarketActive = path === '/marketplace' || path.startsWith('/category/') || path.startsWith('/product/');
  const isProjectsActive = path.startsWith('/projects');

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="CampusMarket home">
          <span className="brand-mark" aria-hidden="true">
            <GraduationCap size={20} />
          </span>
          <span className="brand-text">
            <span className="brand-title">
              Campus<span className="brand-gold">Market</span>
            </span>
            <span className="brand-sub">Wise Owl Westgate</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          <Link className={path === '/' ? 'active' : ''} href="/">
            Home
          </Link>
          <Link className={isMarketActive ? 'active' : ''} href="/marketplace">
            Marketplace
          </Link>
          <Link className={isProjectsActive ? 'active' : ''} href="/projects">
            Projects
          </Link>
          <Link className={isSellerActive ? 'active' : ''} href="/seller">
            Seller
          </Link>
          <Link className={path.startsWith('/owlaid') ? 'active' : ''} href="/owlaid">
            OwlAid
          </Link>
          <Link className={path === '/about' ? 'active' : ''} href="/about">
            About
          </Link>
          {data.profile ? (
            <Link className={path === '/account' ? 'active' : ''} href="/account">
              Account
            </Link>
          ) : (
            <Link className={path === '/login' ? 'active' : ''} href="/login">
              Sign In
            </Link>
          )}
          {data.profile?.role === 'admin' && (
            <Link className={path.startsWith('/admin') ? 'active admin-nav-pill' : 'admin-nav-pill'} href="/admin">
              Admin
            </Link>
          )}
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={() => setThemePreference(!dark)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {data.profile?.verification_status === 'approved' ? (
            <Link className="button primary header-cta" href="/seller/dashboard">
              <Store size={16} /> Seller Hub
            </Link>
          ) : (
            <Link className="button primary header-cta" href="/seller/register">
              <Plus size={16} /> Become a Seller
            </Link>
          )}

          {data.profile && (
            <Link href="/account" className="avatar" aria-label="Account overview">
              {data.profile.display_name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </Link>
          )}

          <button
            type="button"
            className="icon-button menu-toggle"
            aria-label={menu ? 'Close menu' : 'Open menu'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="mobile-menu" aria-label="Expanded navigation">
          <Link href="/" onClick={() => setMenu(false)}>
            Home
          </Link>
          <Link href="/marketplace" onClick={() => setMenu(false)}>
            Marketplace
          </Link>
          <Link href="/projects" onClick={() => setMenu(false)}>
            Projects
          </Link>
          <Link href="/seller" onClick={() => setMenu(false)}>
            Seller Portal
          </Link>
          {data.profile && (
            <Link href="/seller/dashboard" onClick={() => setMenu(false)}>
              Seller Dashboard
            </Link>
          )}
          <Link href="/owlaid" onClick={() => setMenu(false)}>
            OwlAid
          </Link>
          <Link href="/about" onClick={() => setMenu(false)}>
            About
          </Link>
          {data.profile ? (
            <Link href="/account" onClick={() => setMenu(false)}>
              Account ({data.profile.display_name})
            </Link>
          ) : (
            <Link href="/login" onClick={() => setMenu(false)}>
              Sign In
            </Link>
          )}
          {data.profile?.role === 'admin' && (
            <Link href="/admin" onClick={() => setMenu(false)}>
              Administration
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

function MobileBottomNav({ path, signedIn }: { path: string; signedIn: boolean }) {
  return (
    <nav className="mobile-bottom" aria-label="Mobile navigation">
      <Link className={path === '/' ? 'active' : ''} href="/">
        <Home size={19} /> Home
      </Link>
      <Link
        className={path === '/marketplace' || path.startsWith('/category') || path.startsWith('/product') ? 'active' : ''}
        href="/marketplace"
      >
        <ShoppingBag size={19} /> Marketplace
      </Link>
      <Link className={path.startsWith('/projects') ? 'active' : ''} href="/projects">
        <Compass size={19} /> Projects
      </Link>
      <Link className={path.startsWith('/seller') ? 'active' : ''} href="/seller">
        <Store size={19} /> Seller
      </Link>
      <Link
        className={path === '/account' || path === '/login' ? 'active' : ''}
        href={signedIn ? '/account' : '/login'}
      >
        <User size={19} /> {signedIn ? 'Account' : 'Sign In'}
      </Link>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand-col">
          <Link className="brand footer-brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              <GraduationCap size={19} />
            </span>
            <span className="brand-text">
              <span className="brand-title">
                Campus<span className="brand-gold">Market</span>
              </span>
              <span className="brand-sub">Wise Owl High School Westgate · Harare</span>
            </span>
          </Link>
          <p className="footer-motto">
            <em>“Going an Extra Mile”</em> — Showcasing authentic learner innovation, craftsmanship, and collaborative school projects.
          </p>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/seller">Seller Portal</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/owlaid">OwlAid</Link>
          <Link href="/rules">School Rules</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/about">Project Information</Link>
        </nav>
      </div>

      <div className="container footer-disclaimer">
        <p>
          <strong>Disclaimer:</strong> CampusMarket is a student-created platform developed for Wise Owl High School Westgate learners to showcase real school-project products. Unless formally established otherwise by school administration, it is not an official commercial publication of Wise Owl Group of Schools.
        </p>
      </div>
    </footer>
  );
}

function HomePage() {
  const { data, mutate } = useMarket();
  const approvedListings = data.listings.filter((l) => l.status === 'active');
  const approvedGroups = data.groups.filter((g) => g.verification_status === 'approved');
  const canListProducts =
    isApprovedSeller(data.profile) ||
    data.groups.some((g) => canManageGroupProducts(data.profile, g));

  const values = [
    'Excellence',
    'Creativity',
    'Collaboration',
    'Passion',
    'Respect',
    'Responsibility',
    'Determination',
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Students create projects',
      text: 'Learners design, engineer, grow, or craft real products through their Wise Owl school projects.',
    },
    {
      step: '02',
      title: 'Students or groups register as sellers',
      text: 'Register as an independent seller or establish a collaborative project group without sharing passwords.',
    },
    {
      step: '03',
      title: 'Products are submitted for approval',
      text: 'Upload real photographs, set USD prices and stock quantities, and submit for school moderation.',
    },
    {
      step: '04',
      title: 'The school community discovers products',
      text: 'Approved Wise Owl members search and explore verified learner-made goods and project teams.',
    },
    {
      step: '05',
      title: 'Purchases are coordinated safely',
      text: 'Buyers submit supervised purchase requests with zero exposed contact details and atomic stock tracking.',
    },
  ];

  return (
    <>
      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="tiny-dot" />
            WISE OWL HIGH SCHOOL WESTGATE · HARARE
          </div>
          <h1>
            Made by Students.
            <br />
            <span>Powered by Ideas.</span>
          </h1>
          <p>
            Discover innovative products created by learners at Wise Owl High School Westgate.
          </p>
          <div className="button-row">
            <Link className="button primary hero-button" href="/marketplace">
              Explore Products <ArrowRight size={18} />
            </Link>
            <Link className="button secondary hero-secondary-btn" href="/seller/register">
              Become a Seller
            </Link>
          </div>
          <div className="hero-trust">
            <ShieldCheck size={18} />
            <span>
              Aligned with Zimbabwe’s Heritage-Based Curriculum · School-verified learners & groups only
            </span>
          </div>
        </div>

        <div className="hero-showcase" aria-label="Wise Owl Student Project Framework">
          <div className="showcase-card main-crest-card">
            <div className="showcase-header">
              <span className="eyebrow">SCHOOL MOTTO</span>
              <Award size={20} />
            </div>
            <h2>“Going an Extra Mile”</h2>
            <p>
              Turning practical classroom inquiry, technical skill, and teamwork into real goods produced by Wise Owl Westgate students.
            </p>
            <div className="showcase-pillars">
              <div>
                <Layers size={16} />
                <span>Individual & Group Projects</span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>Administrator Moderated</span>
              </div>
              <div>
                <ShieldCheck size={16} />
                <span>Supervised Campus Handover</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION A: DISCOVER STUDENT-MADE PRODUCTS */}
      <section className="home-section" aria-labelledby="section-discover">
        <div className="section-heading">
          <div>
            <p className="eyebrow">REAL LEARNER CRAFTSMANSHIP</p>
            <h2 id="section-discover">Discover Student-Made Products</h2>
          </div>
          <Link href="/marketplace">
            Open Marketplace <ArrowRight size={16} />
          </Link>
        </div>

        {approvedListings.length > 0 ? (
          <div className="product-grid">
            {approvedListings.slice(0, 8).map((l) => (
              <ProductCard
                key={l.id}
                listing={l}
                categories={data.categories}
                saved={data.savedIds.includes(l.id)}
                onSave={() => void mutate('toggle_saved', { listing_id: l.id })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects listed yet."
            text="Be among the first to showcase your project."
            href={canListProducts ? '/seller/products/new' : '/seller/register'}
            action={canListProducts ? 'List Your First Product' : 'Become a Seller'}
            secondaryHref="/seller"
            secondaryAction="Explore Seller Portal"
          />
        )}
      </section>

      {/* SECTION B: EXPLORE PROJECTS */}
      <section className="home-section" aria-labelledby="section-projects">
        <div className="section-heading">
          <div>
            <p className="eyebrow">COLLABORATIVE & INDIVIDUAL INQUIRY</p>
            <h2 id="section-projects">Explore Projects</h2>
          </div>
          <Link href="/projects">
            View Project Directory <ArrowRight size={16} />
          </Link>
        </div>

        {approvedGroups.length > 0 ? (
          <div className="projects-grid">
            {approvedGroups.slice(0, 6).map((group) => (
              <article className="panel project-group-tile" key={group.id}>
                <div className="badge-cluster">
                  <span className="pill-subtle">
                    <Users size={13} /> Verified Group
                  </span>
                  {group.learning_area && <span className="pill-subtle">{group.learning_area}</span>}
                </div>
                <h3>
                  <Link href={`/projects/${group.slug}`}>{group.name}</Link>
                </h3>
                <p>{group.project_description}</p>
                <Link href={`/projects/${group.slug}`} className="card-cta">
                  Explore Group Products <ArrowRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="category-grid">
            {(data.categories.length ? data.categories : fallbackCurriculumAreas).map((category, i) => {
              const Icon = categoryIcons[i % categoryIcons.length];
              return (
                <Link
                  className="category-tile"
                  href={data.profile?.verification_status === 'approved' ? `/category/${category.slug}` : '/projects'}
                  key={category.slug}
                >
                  <span className="category-icon">
                    <Icon size={24} strokeWidth={1.6} />
                  </span>
                  <div>
                    <strong>{category.name}</strong>
                    <small>{category.description}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION C: HOW CAMPUSMARKET WORKS */}
      <section className="home-section" aria-labelledby="section-how">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRANSPARENT & SCHOOL-SUPERVISED</p>
            <h2 id="section-how">How CampusMarket Works</h2>
          </div>
        </div>
        <div className="steps-grid">
          {howItWorks.map((item) => (
            <article className="panel step-card" key={item.step}>
              <span className="step-number">{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* SECTION D: BUILT AROUND LEARNING */}
      <section className="home-section learning-banner panel" aria-labelledby="section-learning">
        <div className="learning-copy">
          <p className="eyebrow">HERITAGE-BASED CURRICULUM · ENTREPRENEURSHIP</p>
          <h2 id="section-learning">Built Around Learning</h2>
          <p>
            CampusMarket supports practical problem-solving, applied technology, and responsible student enterprise at Wise Owl High School Westgate. Every listing represents real learner effort—reinforcing accountability, financial literacy, teamwork, and pride in original work.
          </p>
          <div className="values-pills">
            {values.map((v) => (
              <span key={v} className="value-pill">
                {v}
              </span>
            ))}
          </div>
        </div>
        <div className="learning-aside">
          <BookOpen size={32} />
          <strong>Zero Fabricated Listings</strong>
          <p>
            Products appear only after real students or project groups create them and Wise Owl administrators approve them.
          </p>
          <Link href="/about" className="text-link">
            Read about the project <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* SECTION E: JOIN AS A SELLER */}
      <section className="sell-callout" aria-labelledby="section-join-seller">
        <div className="callout-icon">
          <Sparkles size={28} />
        </div>
        <div>
          <p className="eyebrow">DEDICATED SELLER PORTAL</p>
          <h2 id="section-join-seller">Have a school project ready to share?</h2>
          <p>
            Register as an Individual Seller or launch a shared Project Group workspace with your classmates.
          </p>
        </div>
        <div className="button-row">
          <Link className="button primary" href="/seller">
            Open Seller Portal <ArrowRight size={17} />
          </Link>
          <Link className="button secondary" href="/seller/register">
            Register Now
          </Link>
        </div>
      </section>
    </>
  );
}

function MarketplaceCatalog({ path, query }: { path: string; query: Query }) {
  const { data, mutate } = useMarket();
  const isCategoryRoute = path.startsWith('/category/');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const requestedCategory = isCategoryRoute ? path.split('/')[2] : query.category;
  const currentCategory = data.categories.find((c) => c.slug === requestedCategory);
  const browseTarget = isCategoryRoute && currentCategory ? `/category/${currentCategory.slug}` : '/marketplace';

  const listings = data.listings.filter((l) => l.status === 'active');
  const total = data.listingCount ?? listings.length;

  const canListProducts =
    isApprovedSeller(data.profile) ||
    data.groups.some((g) => canManageGroupProducts(data.profile, g));

  const hasFilterQuery = Boolean(
    query.q || query.category || query.availability || query.min || query.max || isCategoryRoute
  );

  const formKey = `${path}:${query.q || ''}:${query.sort || ''}:${query.category || ''}:${query.availability || ''}:${query.min || ''}:${query.max || ''}`;

  return (
    <>
      <PageHeading
        eyebrow="WISE OWL WESTGATE · STUDENT PROJECT CATALOG"
        title={currentCategory?.name || 'Student Project Marketplace.'}
        description={
          currentCategory?.description ||
          'Browse real, school-approved products designed and produced by Wise Owl High School Westgate learners and project groups.'
        }
      >
        <Link
          className="button primary"
          href={canListProducts ? '/seller/products/new' : '/seller/register'}
        >
          <Plus size={16} /> {canListProducts ? 'List a Product' : 'Become a Seller'}
        </Link>
      </PageHeading>

      {data.categories.length > 0 && (
        <div className="category-pills-row" role="navigation" aria-label="Project categories">
          <Link className={`pill-button ${!currentCategory ? 'active' : ''}`} href="/marketplace">
            All Projects
          </Link>
          {data.categories.map((cat) => (
            <Link
              key={cat.id}
              className={`pill-button ${currentCategory?.id === cat.id ? 'active' : ''}`}
              href={`/category/${cat.slug}`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      <section className="listings-section">
        <form key={formKey} action={browseTarget} className="browse-controls">
          <div className="search-field">
            <Search size={19} />
            <input
              type="search"
              name="q"
              aria-label="Search listings"
              placeholder="Search products, descriptions, categories, or sellers…"
              defaultValue={query.q}
            />
            <button type="submit" className="search-submit" aria-label="Submit search">
              <ArrowRight size={18} />
            </button>
          </div>

          <button
            type="button"
            className="button secondary filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            Filters <ChevronDown size={16} />
          </button>

          <label className="sort-field">
            <span>Sort by:</span>
            <select
              name="sort"
              aria-label="Sort by"
              defaultValue={query.sort || 'newest'}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="newest">Newest listings</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>

          <div className={`filter-fields show-on-desktop ${filtersOpen ? 'show-filters' : ''}`}>
            {!isCategoryRoute && (
              <label>
                Category
                <select name="category" aria-label="Category" defaultValue={query.category || ''}>
                  <option value="">All categories</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Availability
              <select name="availability" aria-label="Availability" defaultValue={query.availability || ''}>
                <option value="">All approved</option>
                <option value="available">Available in stock</option>
                <option value="sold_out">Sold out</option>
              </select>
            </label>
            <label>
              Minimum price (USD)
              <input
                name="min"
                aria-label="Minimum price"
                type="number"
                min="0"
                max="5000"
                step="0.01"
                placeholder="$0"
                defaultValue={query.min}
              />
            </label>
            <label>
              Maximum price (USD)
              <input
                name="max"
                aria-label="Maximum price"
                type="number"
                min="0"
                max="5000"
                step="0.01"
                placeholder="$5,000"
                defaultValue={query.max}
              />
            </label>
            <button className="button primary" type="submit">
              Apply filters
            </button>
            <Link href={browseTarget} className="text-link">
              Reset
            </Link>
          </div>
        </form>

        <div className="catalog-summary">
          <span>
            Showing <strong>{listings.length}</strong> of <strong>{total}</strong> approved project product
            {total === 1 ? '' : 's'}
          </span>
        </div>

        {listings.length > 0 ? (
          <div className="product-grid">
            {listings.map((l) => (
              <ProductCard
                key={l.id}
                listing={l}
                categories={data.categories}
                saved={data.savedIds.includes(l.id)}
                onSave={() => void mutate('toggle_saved', { listing_id: l.id })}
              />
            ))}
          </div>
        ) : hasFilterQuery ? (
          <EmptyState
            title="No matching project products."
            text="Try clearing a filter or broadening your search terms."
            href="/marketplace"
            action="Clear filters"
          />
        ) : (
          <EmptyState
            title="No projects listed yet."
            text="Be among the first to showcase your project."
            href={canListProducts ? '/seller/products/new' : '/seller/register'}
            action={canListProducts ? 'List Your First Product' : 'Become a Seller'}
            secondaryHref="/seller"
            secondaryAction="Seller Portal"
          />
        )}

        {total > (data.pageSize ?? 24) && (
          <nav className="pagination" aria-label="Product pages">
            {Array.from({ length: Math.ceil(total / (data.pageSize ?? 24)) }, (_, i) => (
              <Link
                key={i}
                aria-current={(data.page ?? 1) === i + 1 ? 'page' : undefined}
                className="button secondary"
                href={`${path}?${new URLSearchParams({
                  ...(Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as Record<
                    string,
                    string
                  >),
                  page: String(i + 1),
                })}`}
              >
                {i + 1}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </>
  );
}

function ProjectsExplorer({ path }: { path: string }) {
  const { data, mutate, busy } = useMarket();
  const slug = path.startsWith('/projects/') ? path.split('/')[2] : undefined;
  const approvedGroups = data.groups.filter((g) => g.verification_status === 'approved');

  if (slug) {
    const group = approvedGroups.find((g) => g.slug === slug);
    if (!group) {
      return (
        <EmptyState
          title="Project group not found."
          text="This collaborative project may be awaiting school verification."
          href="/projects"
          action="All Projects"
        />
      );
    }
    const groupListings = data.listings.filter((l) => l.group_id === group.id && l.status === 'active');
    const myMembership = group.members.find((m) => m.user_id === data.profile?.id);
    const isMember = isApprovedGroupMember(data.profile, group);

    return (
      <>
        <PageHeading
          eyebrow={group.learning_area || 'VERIFIED STUDENT PROJECT GROUP'}
          title={group.name}
          description={group.project_description}
        >
          {isMember ? (
            <Link className="button primary" href={`/seller/dashboard?workspace=${group.id}`}>
              Open Group Workspace <ArrowRight size={16} />
            </Link>
          ) : !myMembership && data.profile?.verification_status === 'approved' ? (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void mutate('request_group_membership', { group_id: group.id })}
            >
              <Users size={16} /> Request Collaborator Access
            </button>
          ) : null}
        </PageHeading>

        <section className="panel group-roster-banner">
          <div>
            <strong>Approved Project Team ({group.members.filter((m) => m.status === 'approved').length})</strong>
            <div className="badge-cluster">
              {group.members
                .filter((m) => m.status === 'approved')
                .map((m) => (
                  <span key={m.user_id} className="pill-subtle">
                    {m.display_name} {m.member_role === 'owner' ? '· Lead' : ''}
                  </span>
                ))}
            </div>
          </div>
        </section>

        <section className="listings-section">
          <div className="section-heading">
            <h2>Approved Products by {group.name}</h2>
          </div>
          {groupListings.length > 0 ? (
            <div className="product-grid">
              {groupListings.map((l) => (
                <ProductCard
                  key={l.id}
                  listing={l}
                  categories={data.categories}
                  saved={data.savedIds.includes(l.id)}
                  onSave={() => void mutate('toggle_saved', { listing_id: l.id })}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No approved products published by this group yet."
              text="Check back once the project team’s products pass school review."
              href="/projects"
              action="Explore Other Projects"
            />
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="WISE OWL WESTGATE · COLLABORATIVE & INDIVIDUAL PROJECTS"
        title="Student Projects Behind the Products."
        description="Explore verified Wise Owl learner teams developing real goods through School-Based Projects."
      >
        <Link className="button primary" href="/seller/group">
          <FolderKanban size={16} /> Start a Project Group
        </Link>
      </PageHeading>

      {approvedGroups.length > 0 ? (
        <div className="projects-grid">
          {approvedGroups.map((group) => {
            const count = data.listings.filter((l) => l.group_id === group.id && l.status === 'active').length;
            return (
              <article className="panel project-group-tile" key={group.id}>
                <div className="badge-cluster">
                  <span className="pill-subtle">
                    <Users size={13} /> {group.members.filter((m) => m.status === 'approved').length} member
                    {group.members.filter((m) => m.status === 'approved').length === 1 ? '' : 's'}
                  </span>
                  {group.learning_area && <span className="pill-subtle">{group.learning_area}</span>}
                </div>
                <h2>
                  <Link href={`/projects/${group.slug}`}>{group.name}</Link>
                </h2>
                <p>{group.project_description}</p>
                <div className="product-bottom">
                  <span className="muted-tiny">
                    {count} approved product{count === 1 ? '' : 's'}
                  </span>
                  <Link href={`/projects/${group.slug}`} className="card-cta">
                    View Project <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No verified project groups listed yet."
          text="Collaborating on a class project at Wise Owl Westgate? Create a group workspace and invite your teammates."
          href="/seller/register?type=group"
          action="Register a Project Group"
          secondaryHref="/marketplace"
          secondaryAction="Browse Marketplace"
        />
      )}
    </>
  );
}
