'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ClipboardCheck,
  FolderKanban,
  Layers,
  Plus,
  Search,
  Users,
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
import { PlatformFooter, PlatformHeader, PlatformMobileNav } from './hub/platform-shell';
import { WiseOwlLogo } from './hub/wise-owl-logo';

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
      <PlatformHeader path={path} profile={data.profile} />
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
      <PlatformFooter />
      <PlatformMobileNav path={path} />
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

function HomePage() {
  const { data, mutate } = useMarket();
  const approvedListings = data.listings.filter((l) => l.status === 'active');
  const canListProducts =
    isApprovedSeller(data.profile) ||
    data.groups.some((g) => canManageGroupProducts(data.profile, g));

  return (
    <div className="home-stack">
      {/* 1. CLEAN HERO */}
      <section className="hero hero--clean">
        <div className="hero-copy">
          <p className="hero-school-label">Wise Owl High School Westgate · Harare</p>
          <h1>
            Made by Students.
            <br />
            <span>Powered by Ideas.</span>
          </h1>
          <p>
            Cambridge IGCSE study tools, OwlAid tutoring, and authentic student-built projects—together in one calm school workspace.
          </p>
          <div className="button-row">
            <Link className="button primary hero-button" href="/hub">
              Open Student Hub <ArrowRight size={17} />
            </Link>
            <Link className="button secondary hero-secondary-btn" href="/marketplace">
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* 2. THREE CONCISE STUDY CARDS */}
      <section className="home-section" aria-labelledby="section-study-hub">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your learning</p>
            <h2 id="section-study-hub">Study tools built for IGCSE</h2>
          </div>
          <Link href="/hub">
            Open Student Hub <ArrowRight size={15} />
          </Link>
        </div>
        <div className="study-trio-grid">
          <Link href="/owlaid?mode=igcse" className="panel study-feature-card">
            <span className="study-feature-icon">
              <BrainCircuit size={20} />
            </span>
            <h3>OwlAid</h3>
            <p>Ask school questions or switch to Cambridge IGCSE tutoring for clear explanations and mark-scheme guidance.</p>
            <span className="card-cta">
              Open OwlAid <ArrowRight size={14} />
            </span>
          </Link>
          <Link href="/quizzes" className="panel study-feature-card">
            <span className="study-feature-icon">
              <ClipboardCheck size={20} />
            </span>
            <h3>Quizzes</h3>
            <p>Practise across eight IGCSE subjects with immediate scoring, grade estimates, and topic feedback.</p>
            <span className="card-cta">
              Start a quiz <ArrowRight size={14} />
            </span>
          </Link>
          <Link href="/flashcards" className="panel study-feature-card">
            <span className="study-feature-icon">
              <Layers size={20} />
            </span>
            <h3>Flashcards</h3>
            <p>Review key definitions and formulas with spaced repetition or build your own personal deck.</p>
            <span className="card-cta">
              Review flashcards <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </section>

      {/* 3. COMPACT STUDENT MARKETPLACE */}
      <section className="home-section" aria-labelledby="section-discover">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CampusMarket</p>
            <h2 id="section-discover">Student-made products</h2>
          </div>
          <Link href="/marketplace">
            Explore Marketplace <ArrowRight size={15} />
          </Link>
        </div>

        {approvedListings.length > 0 ? (
          <div className="product-grid">
            {approvedListings.slice(0, 4).map((l) => (
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
            action={canListProducts ? 'List your first product' : 'Become a seller'}
            secondaryHref="/seller"
            secondaryAction="Seller Portal"
          />
        )}
      </section>

      {/* 4. MINIMAL SCHOOL IDENTITY SECTION */}
      <section className="home-section school-identity-card panel" aria-label="Wise Owl High School Westgate identity">
        <div className="school-identity-lead">
          <WiseOwlLogo variant="crest" size={74} framed eager />
          <div className="school-identity-copy">
            <p className="school-identity-motto">“Going an Extra Mile”</p>
            <p className="muted">
              Supporting Cambridge IGCSE study and supervised School-Based Project enterprise at Wise Owl High School Westgate.
            </p>
          </div>
        </div>
        <div className="school-identity-links">
          <Link href="/about" className="text-link">
            About the platform <ArrowRight size={14} />
          </Link>
          <Link href="/seller" className="text-link">
            Seller Portal <ArrowRight size={14} />
          </Link>
          <Link href="/rules" className="text-link">
            School rules <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
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
        eyebrow="CampusMarket"
        title={currentCategory?.name || 'Student Marketplace'}
        description={
          currentCategory?.description ||
          'Approved products designed and made by Wise Owl High School Westgate learners and project groups.'
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
        eyebrow="School projects"
        title="Student project teams"
        description="Explore verified Wise Owl learner teams building goods through School-Based Projects."
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

      <section className="home-section" aria-labelledby="projects-learning-areas">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Curriculum areas</p>
            <h2 id="projects-learning-areas">Browse by subject area</h2>
          </div>
          <Link href="/marketplace">
            Open Marketplace <ArrowRight size={15} />
          </Link>
        </div>
        <div className="category-grid">
          {(data.categories.length ? data.categories : fallbackCurriculumAreas).map((category, i) => {
            const Icon = categoryIcons[i % categoryIcons.length];
            return (
              <Link
                className="category-tile"
                href={data.profile?.verification_status === 'approved' ? `/category/${category.slug}` : '/marketplace'}
                key={category.slug}
              >
                <span className="category-icon">
                  <Icon size={20} strokeWidth={1.6} />
                </span>
                <div>
                  <strong>{category.name}</strong>
                  <small>{category.description}</small>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
