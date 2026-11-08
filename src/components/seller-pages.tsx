'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Package,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  canEditProduct,
  canManageGroupProducts,
  canManagePurchaseRequest,
  isApprovedGroupMember,
  isApprovedSeller,
  isGroupOwner,
} from '@/lib/permissions';
import type { SellerGroup } from '@/lib/types';
import { availabilityLabel, Dialog, EmptyState, money, PageHeading, Status } from './ui';
import { ListingActions } from './listing-pages';
import { useMarket } from './market-app';

export function SellerTabs({ path }: { path: string }) {
  return (
    <nav className="page-tabs" aria-label="Seller workspace navigation">
      <Link className={path === '/seller/dashboard' ? 'active' : ''} href="/seller/dashboard">
        <LayoutDashboard size={17} /> Dashboard
      </Link>
      <Link className={path === '/seller/products' ? 'active' : ''} href="/seller/products">
        <Package size={17} /> My Products
      </Link>
      <Link className={path === '/seller/products/new' ? 'active' : ''} href="/seller/products/new">
        <Plus size={17} /> Add Product
      </Link>
      <Link className={path === '/seller/group' ? 'active' : ''} href="/seller/group">
        <Users size={17} /> Project Groups
      </Link>
      <Link className={path === '/seller/settings' ? 'active' : ''} href="/seller/settings">
        <Settings size={17} /> Seller Settings
      </Link>
    </nav>
  );
}

export function SellerLandingPage() {
  const { data } = useMarket();
  const approvedMember = data.profile?.verification_status === 'approved';
  const approvedSeller = isApprovedSeller(data.profile);
  const myGroups = data.groups.filter((g) => isApprovedGroupMember(data.profile, g));

  return (
    <div className="seller-landing">
      <section className="seller-hero panel">
        <div className="seller-hero-copy">
          <p className="eyebrow">WISE OWL WESTGATE · SELLER PORTAL</p>
          <h1>Turn Your School Project Into a Product.</h1>
          <p>
            Built for Wise Owl High School Westgate learners creating real goods through Heritage-Based Curriculum projects. Register individually or collaborate as a verified project group—with school supervision at every step.
          </p>
          <div className="button-row">
            {approvedMember ? (
              <>
                <Link className="button primary" href="/seller/dashboard">
                  Open Seller Dashboard <ArrowRight size={17} />
                </Link>
                {approvedSeller || myGroups.some((g) => canManageGroupProducts(data.profile, g)) ? (
                  <Link className="button secondary" href="/seller/products/new">
                    <Plus size={16} /> List a Product
                  </Link>
                ) : (
                  <Link className="button secondary" href="/seller/register">
                    Activate Seller Access
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link className="button primary" href="/seller/register">
                  Register as a Seller <ArrowRight size={17} />
                </Link>
                <Link className="button secondary" href="/login">
                  Seller Sign In
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="seller-hero-pillars">
          <div className="pillar-item">
            <ShieldCheck size={20} />
            <div>
              <strong>Administrator Verified</strong>
              <span>Every seller, group, and product listing is approved by Wise Owl staff before publication.</span>
            </div>
          </div>
          <div className="pillar-item">
            <Users size={20} />
            <div>
              <strong>No Shared Passwords</strong>
              <span>Group members sign in with their own personal accounts and role-based permissions.</span>
            </div>
          </div>
          <div className="pillar-item">
            <LockKeyhole size={20} />
            <div>
              <strong>Protected Student Privacy</strong>
              <span>Emails and phone numbers stay private; exchanges take place safely on campus.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="seller-options-grid" aria-label="Seller pathways">
        <article className="panel seller-pathway-card">
          <div className="pathway-badge">OPTION A</div>
          <div className="pathway-icon">
            <User size={28} />
          </div>
          <h2>Individual Seller</h2>
          <p>
            For a student independently designing, building, and selling products from an individual school project.
          </p>
          <ul className="check-list">
            <li>Personal product catalog and stock tracker</li>
            <li>Upload up to 5 real photographs per product</li>
            <li>Receive and fulfill supervised buyer requests</li>
          </ul>
          <Link className="button primary wide" href="/seller/register?type=individual">
            Choose Individual Seller <ArrowRight size={16} />
          </Link>
        </article>

        <article className="panel seller-pathway-card featured-pathway">
          <div className="pathway-badge">OPTION B</div>
          <div className="pathway-icon">
            <Users size={28} />
          </div>
          <h2>Group Seller</h2>
          <p>
            For two or more learners collaborating on a shared enterprise, STEM prototype, agricultural batch, or design project.
          </p>
          <ul className="check-list">
            <li>Shared group workspace without shared passwords</li>
            <li>Group owner controls collaborator product permissions</li>
            <li>Dedicated project group profile in the catalog</li>
          </ul>
          <Link className="button primary wide" href="/seller/register?type=group">
            Choose Group Seller <ArrowRight size={16} />
          </Link>
        </article>
      </section>
    </div>
  );
}

export function SellerRegisterPage({ query }: { query: Record<string, string | undefined> }) {
  const { data, mutate, busy } = useMarket();
  const initialType = query.type === 'group' ? 'group' : 'individual';
  const [sellerType, setSellerType] = useState<'individual' | 'group'>(initialType);
  const [message, setMessage] = useState('');

  const isSignedIn = Boolean(data.profile);
  const isApprovedMember = data.profile?.verification_status === 'approved';

  return (
    <div className="seller-register-wrap">
      <PageHeading
        eyebrow="SELLER ONBOARDING · WISE OWL WESTGATE"
        title="Register as a Student Project Seller."
        description="Showcase real goods produced through your class or collaborative school project. A school administrator must approve membership and seller access before products can be published."
      />

      <div className="form-layout">
        <section className="panel">
          <div className="pathway-toggle" role="radiogroup" aria-label="Seller account type">
            <button
              type="button"
              role="radio"
              aria-checked={sellerType === 'individual'}
              className={`pathway-choice ${sellerType === 'individual' ? 'active' : ''}`}
              onClick={() => setSellerType('individual')}
            >
              <User size={18} />
              <div>
                <strong>Individual Seller</strong>
                <span>Independent learner project</span>
              </div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={sellerType === 'group'}
              className={`pathway-choice ${sellerType === 'group' ? 'active' : ''}`}
              onClick={() => setSellerType('group')}
            >
              <Users size={18} />
              <div>
                <strong>Group Seller</strong>
                <span>Collaborative student team</span>
              </div>
            </button>
          </div>

          {isSignedIn && isApprovedMember ? (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const res = await mutate('register_seller', {
                  seller_type: sellerType,
                  project_summary: form.get('project_summary'),
                });
                setMessage(res.message);
              }}
            >
              <div className="inline-notice">
                <CheckCircle2 size={18} />
                <p>
                  Signed in as <strong>{data.profile?.display_name}</strong>.{' '}
                  {data.profile?.seller_approved
                    ? 'Your individual seller access is already approved.'
                    : 'Submit your project focus below so a school administrator can enable seller access.'}
                </p>
              </div>
              <label>
                Your school project focus
                <textarea
                  name="project_summary"
                  rows={4}
                  minLength={10}
                  maxLength={500}
                  defaultValue={data.profile?.project_summary || ''}
                  placeholder="Briefly describe the real goods or prototypes you or your project group are creating at Wise Owl Westgate."
                  required
                />
                <small>Keep phone numbers, email addresses, and personal contact details out of your summary.</small>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span>
                  I agree to list only authentic school-project products and follow the{' '}
                  <Link href="/rules">marketplace rules</Link>.
                </span>
              </label>
              {message && (
                <p role="status" className="form-message">
                  {message}
                </p>
              )}
              <button className="button primary wide" disabled={busy || data.mode === 'unconfigured'}>
                {busy ? 'Submitting…' : sellerType === 'group' ? 'Save & Continue to Group Setup' : 'Submit Seller Registration'}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : isSignedIn && !isApprovedMember ? (
            <EmptyState
              title="Your student account is awaiting school verification."
              text="Once a Wise Owl administrator approves your membership, your seller access will be reviewed."
              href="/pending-approval"
              action="View Approval Status"
            />
          ) : (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const formEl = e.currentTarget;
                const form = new FormData(formEl);
                const res = await mutate('signup', {
                  display_name: form.get('display_name'),
                  email: form.get('email'),
                  password: form.get('password'),
                  seller_type: sellerType,
                  project_summary: form.get('project_summary'),
                });
                setMessage(res.message);
                if (res.ok) formEl.reset();
              }}
            >
              <label>
                Student display name
                <input
                  name="display_name"
                  autoComplete="nickname"
                  minLength={2}
                  maxLength={60}
                  placeholder="e.g. Tatenda M."
                  required
                />
                <small>Shown on your project listings. Use first name and initial—never add phone numbers.</small>
              </label>
              <label>
                Email address (private, never shown publicly)
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  placeholder="learner@example.com"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  placeholder="At least 12 characters"
                  required
                />
              </label>
              <label>
                Project summary
                <textarea
                  name="project_summary"
                  rows={3}
                  minLength={10}
                  maxLength={500}
                  placeholder="What real school-project product or collaborative project do you plan to showcase?"
                  required
                />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span>
                  I accept the <Link href="/rules">CampusMarket rules</Link> and{' '}
                  <Link href="/privacy">privacy notice</Link>, and understand a school administrator must approve my account.
                </span>
              </label>
              {message && (
                <p role="status" className="form-message">
                  {message}
                </p>
              )}
              <button className="button primary wide" disabled={busy || data.mode === 'unconfigured'}>
                {busy ? 'Creating seller account…' : `Create ${sellerType === 'group' ? 'Group' : 'Individual'} Seller Account`}
                <ArrowRight size={16} />
              </button>
              <p className="auth-bottom">
                Already have a CampusMarket account? <Link href="/login">Sign in here</Link>
              </p>
            </form>
          )}
        </section>

        <aside className="form-aside">
          <div className="panel selling-tips">
            <ShieldCheck size={26} />
            <h3>How seller verification works</h3>
            <ul>
              <li>
                <strong>Step 1:</strong> Create your personal account and verify your email address.
              </li>
              <li>
                <strong>Step 2:</strong> A Wise Owl administrator confirms your student membership and seller eligibility.
              </li>
              <li>
                <strong>Step 3:</strong> Individual sellers list products directly; group sellers create or join an approved project group.
              </li>
              <li>
                <strong>Step 4:</strong> Upload real product photos, set USD pricing and stock, and submit for review.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function SellerPortalWorkspace({
  path,
  query,
}: {
  path: string;
  query: Record<string, string | undefined>;
}) {
  if (path === '/seller/group') return <SellerGroupPage />;
  if (path === '/seller/settings') return <SellerSettingsPage />;
  return <SellerDashboardAndProducts path={path} initialWorkspace={query.workspace} />;
}

function SellerDashboardAndProducts({
  path,
  initialWorkspace,
}: {
  path: string;
  initialWorkspace?: string;
}) {
  const { data, mutate, busy } = useMarket();
  const isProductsPage = path === '/seller/products';
  const myGroups = data.groups.filter((g) => isApprovedGroupMember(data.profile, g));
  const permittedGroups = myGroups.filter((g) => canManageGroupProducts(data.profile, g));
  const canSellIndividually = isApprovedSeller(data.profile);

  const [workspace, setWorkspace] = useState<string>(initialWorkspace || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const manageableListings = data.listings.filter(
    (l) =>
      l.seller_id === data.profile?.id ||
      Boolean(l.group_id && myGroups.some((g) => g.id === l.group_id))
  );

  const scopedListings = manageableListings.filter((l) => {
    if (workspace === 'individual') return l.group_id === null && l.seller_id === data.profile?.id;
    if (workspace !== 'all') return l.group_id === workspace;
    return true;
  });

  const incomingRequests = data.purchaseRequests.filter((req) => {
    const belongsToSeller =
      (req.group_id === null && req.seller_id === data.profile?.id) ||
      Boolean(req.group_id && myGroups.some((g) => g.id === req.group_id));
    if (!belongsToSeller) return false;
    if (workspace === 'individual') return req.group_id === null;
    if (workspace !== 'all') return req.group_id === workspace;
    return true;
  });

  const totalCount = scopedListings.length;
  const activeCount = scopedListings.filter((l) => l.status === 'active' && l.availability === 'available').length;
  const pendingCount = scopedListings.filter((l) => l.status === 'pending_review').length;
  const soldOutCount = scopedListings.filter((l) => l.status === 'sold' || l.availability === 'sold_out').length;
  const outstandingRequestsCount = incomingRequests.filter((r) => ['pending', 'accepted'].includes(r.status)).length;

  const displayedListings = isProductsPage
    ? statusFilter === 'all'
      ? scopedListings
      : scopedListings.filter((l) => l.status === statusFilter)
    : scopedListings.slice(0, 6);

  const canCreateNow = canSellIndividually || permittedGroups.length > 0;
  const addHref =
    workspace !== 'all' && workspace !== 'individual' && permittedGroups.some((g) => g.id === workspace)
      ? `/seller/products/new?group=${workspace}`
      : '/seller/products/new';

  return (
    <>
      <PageHeading
        eyebrow="SELLER WORKSPACE · WISE OWL WESTGATE"
        title={isProductsPage ? 'My Project Products.' : `Seller Dashboard · ${data.profile?.display_name || 'Learner'}`}
        description={
          isProductsPage
            ? 'Manage real product descriptions, stock levels, availability, and moderation status.'
            : 'Real-time overview of your project listings, stock availability, and school-supervised purchase requests.'
        }
      >
        {canCreateNow ? (
          <Link className="button primary" href={addHref}>
            <Plus size={17} /> Add Product
          </Link>
        ) : (
          <Link className="button primary" href="/seller/register">
            Activate Seller Access <ArrowRight size={16} />
          </Link>
        )}
      </PageHeading>

      <SellerTabs path={path} />

      {(myGroups.length > 0 || canSellIndividually) && (
        <div className="workspace-switcher" role="region" aria-label="Workspace selector">
          <span className="workspace-label">
            <FolderKanban size={16} /> Workspace:
          </span>
          <div className="workspace-pills">
            <button
              type="button"
              className={`pill-button ${workspace === 'all' ? 'active' : ''}`}
              onClick={() => setWorkspace('all')}
            >
              All workspaces
            </button>
            <button
              type="button"
              className={`pill-button ${workspace === 'individual' ? 'active' : ''}`}
              onClick={() => setWorkspace('individual')}
            >
              Individual ({data.profile?.display_name})
            </button>
            {myGroups.map((g) => (
              <button
                type="button"
                key={g.id}
                className={`pill-button ${workspace === g.id ? 'active' : ''}`}
                onClick={() => setWorkspace(g.id)}
              >
                Group · {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!canCreateNow && (
        <div className="inline-notice">
          <Clock3 size={20} />
          <div>
            <strong>
              {data.profile?.seller_type !== 'none'
                ? 'Seller verification pending school administrator review.'
                : 'You have not enabled seller access yet.'}
            </strong>
            <p>
              {data.profile?.seller_type !== 'none'
                ? 'Once a Wise Owl administrator approves your seller registration or project group, you can add and publish real project products.'
                : 'Register as an Individual Seller or create a collaborative Project Group to begin.'}
            </p>
          </div>
          {data.profile?.seller_type === 'none' && (
            <Link className="button secondary small" href="/seller/register">
              Register as Seller
            </Link>
          )}
        </div>
      )}

      {!isProductsPage && (
        <div className="metrics-grid metrics-five" data-testid="seller-metrics">
          <div className="metric-card">
            <span>
              Total real listings <Package size={18} />
            </span>
            <strong>{totalCount}</strong>
            <small>Submitted or drafted</small>
          </div>
          <div className="metric-card">
            <span>
              Active products <CheckCircle2 size={18} />
            </span>
            <strong>{activeCount}</strong>
            <small>Approved & available</small>
          </div>
          <div className="metric-card">
            <span>
              Pending approval <Clock3 size={18} />
            </span>
            <strong>{pendingCount}</strong>
            <small>In moderation queue</small>
          </div>
          <div className="metric-card">
            <span>
              Sold out products <Boxes size={18} />
            </span>
            <strong>{soldOutCount}</strong>
            <small>Zero remaining stock</small>
          </div>
          <div className="metric-card">
            <span>
              Purchase requests <Inbox size={18} />
            </span>
            <strong>{outstandingRequestsCount}</strong>
            <small>Pending or accepted</small>
          </div>
        </div>
      )}

      {scopedListings.length === 0 ? (
        <div className="seller-welcome-setup panel" data-testid="seller-zero-setup">
          <div className="empty-icon-ring">
            <Sparkles size={30} />
          </div>
          <h2>Ready to showcase your first Wise Owl project product?</h2>
          <p>
            Your seller dashboard displays real database records only—never placeholder numbers. Photograph a real product built through your school project, set its USD price and stock quantity, and submit it for school review.
          </p>
          <div className="button-row">
            {canCreateNow ? (
              <Link className="button primary" href={addHref}>
                List Your First Product <ArrowRight size={16} />
              </Link>
            ) : (
              <Link className="button primary" href="/seller/register">
                Complete Seller Registration <ArrowRight size={16} />
              </Link>
            )}
            <Link className="button secondary" href="/seller/group">
              <Users size={16} /> Set Up a Project Group
            </Link>
          </div>
        </div>
      ) : (
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>{isProductsPage ? 'My Products' : 'Recent project products'}</h2>
            {isProductsPage ? (
              <label className="inline-select">
                Status
                <select
                  aria-label="Filter product status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {['draft', 'pending_review', 'active', 'sold', 'removed'].map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Link href="/seller/products">
                Manage all products <ArrowRight size={15} />
              </Link>
            )}
          </div>

          {displayedListings.length > 0 ? (
            <div className="management-list">
              {displayedListings.map((l) => {
                const canManageRow = canEditProduct(data.profile, l, data.groups);
                return (
                  <article className="management-row" key={l.id} data-testid="seller-product-row">
                    <Link href={`/product/${l.id}`} className="management-image" tabIndex={-1} aria-hidden="true">
                      {l.images[0]?.url ? (
                        <img src={l.images[0].url} alt="" width="100" height="80" />
                      ) : (
                        <div className="photo-placeholder tiny">No photo</div>
                      )}
                    </Link>
                    <div className="management-title">
                      <Link href={`/product/${l.id}`}>{l.title}</Link>
                      <span>
                        {money(l.price)} USD · {availabilityLabel(l)} ·{' '}
                        {l.group_name ? `Group: ${l.group_name}` : 'Individual'}
                      </span>
                    </div>
                    <div className="badge-cluster">
                      <Status value={l.status} />
                    </div>
                    {canManageRow ? (
                      <ListingActions listing={l} />
                    ) : (
                      <span className="muted">View-only collaborator</span>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No products match this status filter."
              text="Choose another status filter or add a new project product."
              href={addHref}
              action="Add Product"
            />
          )}
        </section>
      )}

      {!isProductsPage && (
        <section className="dashboard-section" data-testid="seller-requests-section">
          <div className="section-heading">
            <h2>
              Incoming Purchase Requests <span className="count-pill">{incomingRequests.length}</span>
            </h2>
            <span className="muted">Stock deducts atomically when marked fulfilled</span>
          </div>

          {incomingRequests.length > 0 ? (
            <div className="management-list">
              {incomingRequests.map((req) => {
                const canAct = canManagePurchaseRequest(data.profile, req, data.groups);
                return (
                  <article className="management-row request-row" key={req.id} data-testid="seller-request-row">
                    <div className="management-title">
                      <Link href={`/product/${req.listing_id}`}>{req.listing_title}</Link>
                      <span>
                        Buyer: <strong>{req.buyer_name}</strong> · Qty: <strong>{req.quantity}</strong> (
                        {money(Number(req.listing_price) * req.quantity)} USD) ·{' '}
                        {new Date(req.created_at).toLocaleDateString('en-GB')}
                      </span>
                      {req.note && <small className="request-note">Note: “{req.note}”</small>}
                    </div>
                    <Status value={req.status} />
                    {canAct && ['pending', 'accepted'].includes(req.status) ? (
                      <div className="listing-actions">
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            className="button secondary small"
                            disabled={busy}
                            onClick={() =>
                              void mutate('update_purchase_request', { id: req.id, status: 'accepted' })
                            }
                          >
                            Accept
                          </button>
                        )}
                        <button
                          type="button"
                          className="button primary small"
                          disabled={busy}
                          onClick={() =>
                            void mutate('update_purchase_request', { id: req.id, status: 'fulfilled' })
                          }
                        >
                          <Check size={14} /> Confirm Fulfilled
                        </button>
                        <button
                          type="button"
                          className="button danger-quiet small"
                          disabled={busy}
                          onClick={() =>
                            void mutate('update_purchase_request', { id: req.id, status: 'declined' })
                          }
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="muted">
                        {req.fulfilled_at
                          ? `Fulfilled ${new Date(req.fulfilled_at).toLocaleDateString('en-GB')}`
                          : 'Closed'}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="panel subtle-empty">
              <p className="muted">
                No purchase requests yet. When Wise Owl buyers request your approved products, they will appear here for supervised campus fulfillment.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function SellerGroupPage() {
  const { data, mutate, busy } = useMarket();
  const [editingGroup, setEditingGroup] = useState<SellerGroup | null>(null);
  const [inviteGroupId, setInviteGroupId] = useState<string>('');
  const [inviteUserId, setInviteUserId] = useState<string>('');
  const [inviteAllowProducts, setInviteAllowProducts] = useState(true);

  const myUserId = data.profile?.id;
  const invitedGroups = data.groups.filter((g) =>
    g.members.some((m) => m.user_id === myUserId && m.status === 'invited')
  );
  const myAssociatedGroups = data.groups.filter(
    (g) =>
      g.created_by === myUserId ||
      g.members.some((m) => m.user_id === myUserId && ['approved', 'requested'].includes(m.status))
  );
  const discoverableGroups = data.groups.filter(
    (g) =>
      g.verification_status === 'approved' &&
      !g.members.some((m) => m.user_id === myUserId && ['approved', 'invited', 'requested'].includes(m.status))
  );

  return (
    <>
      <PageHeading
        eyebrow="COLLABORATIVE ENTREPRENEURSHIP"
        title="Project Group Workspaces."
        description="Collaborate on school projects without sharing passwords. Each learner signs in personally while group owners and school administrators control permissions."
      />

      <SellerTabs path="/seller/group" />

      {invitedGroups.length > 0 && (
        <section className="dashboard-section">
          <h2>Pending Group Invitations</h2>
          <div className="management-list">
            {invitedGroups.map((group) => (
              <article className="management-row" key={group.id}>
                <div className="management-title">
                  <strong>{group.name}</strong>
                  <span>{group.project_description}</span>
                </div>
                <div className="listing-actions">
                  <button
                    type="button"
                    className="button primary small"
                    disabled={busy}
                    onClick={() => void mutate('respond_group_invite', { group_id: group.id, accept: true })}
                  >
                    <Check size={14} /> Accept Invitation
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={busy}
                    onClick={() => void mutate('respond_group_invite', { group_id: group.id, accept: false })}
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="form-layout">
        <div>
          <section className="dashboard-section">
            <div className="section-heading">
              <h2>Your Project Groups ({myAssociatedGroups.length})</h2>
            </div>

            {myAssociatedGroups.length > 0 ? (
              <div className="stack-list">
                {myAssociatedGroups.map((group) => {
                  const owner = isGroupOwner(data.profile, group);
                  const myMembership = group.members.find((m) => m.user_id === myUserId);
                  return (
                    <article className="panel group-workspace-card" key={group.id} data-testid="group-card">
                      <div className="group-card-head">
                        <div>
                          <div className="badge-cluster">
                            <Status value={group.verification_status} />
                            {group.learning_area && <span className="pill-subtle">{group.learning_area}</span>}
                          </div>
                          <h3>{group.name}</h3>
                          <p className="muted">{group.project_description}</p>
                        </div>
                        <div className="listing-actions">
                          {group.verification_status === 'approved' &&
                            canManageGroupProducts(data.profile, group) && (
                              <Link
                                className="button primary small"
                                href={`/seller/products/new?group=${group.id}`}
                              >
                                <Plus size={14} /> Add Group Product
                              </Link>
                            )}
                          {owner && (
                            <button
                              type="button"
                              className="button secondary small"
                              onClick={() => setEditingGroup(group)}
                            >
                              <Pencil size={14} /> Edit Group
                            </button>
                          )}
                        </div>
                      </div>

                      {myMembership?.status === 'requested' && (
                        <p className="muted">
                          Your request to join this group is awaiting approval by the group owner or a school administrator.
                        </p>
                      )}

                      <div className="group-members-box">
                        <div className="section-heading compact">
                          <h4>Collaborators ({group.members.length})</h4>
                          {owner && (
                            <button
                              type="button"
                              className="button secondary tiny"
                              onClick={() => {
                                setInviteGroupId(group.id);
                                setInviteUserId('');
                              }}
                            >
                              <UserPlus size={13} /> Invite Member
                            </button>
                          )}
                        </div>
                        <div className="member-rows">
                          {group.members.map((member) => (
                            <div className="member-row" key={member.user_id}>
                              <div>
                                <strong>{member.display_name}</strong>{' '}
                                <span className="muted-tiny">
                                  ({member.member_role === 'owner'
                                    ? 'Group Owner'
                                    : member.can_manage_products
                                      ? 'Product Editor'
                                      : 'Viewer'})
                                </span>
                              </div>
                              <div className="badge-cluster">
                                <Status value={member.status} />
                                {owner && member.member_role !== 'owner' && (
                                  <>
                                    {member.status === 'requested' && (
                                      <button
                                        type="button"
                                        className="button primary tiny"
                                        disabled={busy}
                                        onClick={() =>
                                          void mutate('manage_group_member', {
                                            group_id: group.id,
                                            user_id: member.user_id,
                                            status: 'approved',
                                            can_manage_products: true,
                                          })
                                        }
                                      >
                                        Approve Editor
                                      </button>
                                    )}
                                    {member.status === 'approved' && (
                                      <button
                                        type="button"
                                        className="button secondary tiny"
                                        disabled={busy}
                                        onClick={() =>
                                          void mutate('manage_group_member', {
                                            group_id: group.id,
                                            user_id: member.user_id,
                                            status: 'approved',
                                            can_manage_products: !member.can_manage_products,
                                          })
                                        }
                                      >
                                        {member.can_manage_products ? 'Set View-Only' : 'Grant Product Edit'}
                                      </button>
                                    )}
                                    {member.status !== 'removed' && (
                                      <button
                                        type="button"
                                        className="icon-button"
                                        aria-label={`Remove ${member.display_name}`}
                                        disabled={busy}
                                        onClick={() =>
                                          void mutate('manage_group_member', {
                                            group_id: group.id,
                                            user_id: member.user_id,
                                            status: 'removed',
                                            can_manage_products: false,
                                          })
                                        }
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="panel subtle-empty">
                <p className="muted">
                  You have not created or joined a project group yet. Create a new group using the form beside this panel or request to join an approved team below.
                </p>
              </div>
            )}
          </section>

          {discoverableGroups.length > 0 && (
            <section className="dashboard-section">
              <h2>Approved Wise Owl Project Groups</h2>
              <div className="management-list">
                {discoverableGroups.map((group) => (
                  <article className="management-row" key={group.id}>
                    <div className="management-title">
                      <Link href={`/projects/${group.slug}`}>{group.name}</Link>
                      <span>{group.project_description}</span>
                    </div>
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={busy}
                      onClick={() => void mutate('request_group_membership', { group_id: group.id })}
                    >
                      Request to Join
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="form-aside">
          <form
            className="panel stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const form = new FormData(formEl);
              const res = await mutate('create_group', {
                name: form.get('name'),
                learning_area: form.get('learning_area'),
                project_description: form.get('project_description'),
              });
              if (res.ok) formEl.reset();
            }}
          >
            <h3>Create a Project Group</h3>
            <p className="muted">
              Establish a shared workspace for your collaborative class project. School administration approves new groups before products go live.
            </p>
            <label>
              Group name
              <input
                name="name"
                minLength={3}
                maxLength={80}
                placeholder="e.g. Westgate Solar Makers"
                required
              />
            </label>
            <label>
              Subject / learning area
              <input
                name="learning_area"
                maxLength={100}
                placeholder="e.g. Science & STEM Innovations"
              />
            </label>
            <label>
              Project description
              <textarea
                name="project_description"
                rows={4}
                minLength={20}
                maxLength={2000}
                placeholder="Describe what your group is designing, growing, or manufacturing through your school project."
                required
              />
            </label>
            <button type="submit" className="button primary wide" disabled={busy}>
              Submit Group for Approval <ArrowRight size={16} />
            </button>
          </form>
        </aside>
      </div>

      {editingGroup && (
        <Dialog title={`Edit Group · ${editingGroup.name}`} onClose={() => setEditingGroup(null)}>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const res = await mutate('update_group', {
                id: editingGroup.id,
                name: form.get('name'),
                learning_area: form.get('learning_area'),
                project_description: form.get('project_description'),
              });
              if (res.ok) setEditingGroup(null);
            }}
          >
            <label>
              Group name
              <input name="name" defaultValue={editingGroup.name} minLength={3} maxLength={80} required />
            </label>
            <label>
              Learning area
              <input name="learning_area" defaultValue={editingGroup.learning_area || ''} maxLength={100} />
            </label>
            <label>
              Project description
              <textarea
                name="project_description"
                rows={4}
                defaultValue={editingGroup.project_description}
                minLength={20}
                maxLength={2000}
                required
              />
            </label>
            <div className="button-row">
              <button type="submit" className="button primary" disabled={busy}>
                Save changes
              </button>
              <button type="button" className="button secondary" onClick={() => setEditingGroup(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {inviteGroupId && (
        <Dialog title="Invite Approved School Member" onClose={() => setInviteGroupId('')}>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!inviteUserId) return;
              const res = await mutate('invite_group_member', {
                group_id: inviteGroupId,
                user_id: inviteUserId,
                can_manage_products: inviteAllowProducts,
              });
              if (res.ok) setInviteGroupId('');
            }}
          >
            <label>
              Approved Wise Owl member
              <select
                aria-label="Approved Wise Owl member"
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                required
              >
                <option value="">Select a student</option>
                {data.schoolMembers
                  .filter((m) => m.id !== myUserId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={inviteAllowProducts}
                onChange={(e) => setInviteAllowProducts(e.target.checked)}
              />
              <span>Allow this collaborator to add and edit group products</span>
            </label>
            <div className="button-row">
              <button type="submit" className="button primary" disabled={busy || !inviteUserId}>
                Send Invitation
              </button>
              <button type="button" className="button secondary" onClick={() => setInviteGroupId('')}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

function SellerSettingsPage() {
  const { data, mutate, busy } = useMarket();
  const profile = data.profile;

  return (
    <>
      <PageHeading
        eyebrow="SELLER PROFILE & SECURITY"
        title="Seller Settings."
        description="Update your public learner display name and project summary. Email addresses and credentials stay private."
      />
      <SellerTabs path="/seller/settings" />

      <div className="settings-layout">
        <section className="panel settings-panel">
          <div className="profile-heading">
            <span className="avatar avatar-large">
              {profile?.display_name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('') || 'WO'}
            </span>
            <div>
              <h2>{profile?.display_name || 'Wise Owl Member'}</h2>
              <div className="badge-cluster">
                <Status value={profile?.verification_status || 'pending'} />
                <Status value={profile?.seller_approved ? 'seller approved' : 'seller pending'} />
              </div>
            </div>
          </div>

          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              await mutate('update_profile', {
                display_name: values.get('display_name'),
                seller_type: values.get('seller_type'),
                project_summary: values.get('project_summary'),
              });
            }}
          >
            <label>
              Display name
              <input name="display_name" defaultValue={profile?.display_name} minLength={2} maxLength={60} required />
              <small>Shown on your listings. Never include phone numbers or email addresses.</small>
            </label>
            <label>
              Preferred seller mode
              <select
                name="seller_type"
                aria-label="Preferred seller mode"
                defaultValue={profile?.seller_type || 'individual'}
              >
                <option value="individual">Individual Seller</option>
                <option value="group">Group Seller</option>
                <option value="none">Buyer only</option>
              </select>
            </label>
            <label>
              Project summary
              <textarea
                name="project_summary"
                rows={3}
                maxLength={500}
                defaultValue={profile?.project_summary || ''}
                placeholder="Describe your school project area or craft focus."
              />
            </label>
            <button className="button primary align-start" disabled={busy}>
              Save seller profile <Check size={16} />
            </button>
          </form>

          <div className="settings-section">
            <h3>Session & password security</h3>
            <p>Sessions are verified server-side through Supabase Auth.</p>
            <div className="button-row">
              <Link className="button secondary" href="/forgot-password">
                <LockKeyhole size={16} /> Reset password
              </Link>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => void mutate('logout', {})}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </section>

        <aside className="panel privacy-aside">
          <ShieldCheck size={28} />
          <h3>Safe student entrepreneurship</h3>
          <p>
            CampusMarket never displays student email addresses, phone numbers, or home addresses. All product handovers are coordinated through Wise Owl school supervision.
          </p>
          <Link href="/privacy" className="text-link">
            Read privacy notice <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
    </>
  );
}
