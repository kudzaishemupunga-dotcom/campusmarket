'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Clock3, Flag, Heart, LayoutDashboard, ListChecks, LockKeyhole, LogOut, Mail, Package, Plus, Settings, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { resetDemoSnapshot, useMarket } from './market-app';
import { Dialog, EmptyState, money, PageHeading, ProductCard, Status } from './ui';
import { ListingActions } from './listing-pages';
import type { ActionName } from '@/lib/types';

function DashboardTabs({ path }: { path: string }) {
  return (
    <nav className="page-tabs" aria-label="Dashboard navigation">
      <Link className={path === '/dashboard' ? 'active' : ''} href="/dashboard"><LayoutDashboard size={17} />Overview</Link>
      <Link className={path === '/dashboard/listings' ? 'active' : ''} href="/dashboard/listings"><Package size={17} />My listings</Link>
      <Link className={path === '/dashboard/saved' ? 'active' : ''} href="/dashboard/saved"><Heart size={17} />Saved items</Link>
      <Link className={path === '/profile' ? 'active' : ''} href="/profile"><Settings size={17} />Account settings</Link>
    </nav>
  );
}

export function Dashboard({ path }: { path: string }) {
  const { data, mutate } = useMarket();
  const own = data.listings.filter((l) => l.seller_id === data.profile?.id);
  const saved = data.listings.filter((l) => data.savedIds.includes(l.id));
  const [filter, setFilter] = useState('all');
  const showSaved = path === '/dashboard/saved';
  const showAll = path === '/dashboard/listings';
  const listings = showAll ? (filter === 'all' ? own : own.filter((l) => l.status === filter)) : own.slice(0, 4);

  return (
    <>
      <PageHeading
        eyebrow="YOUR LITTLE CORNER OF CAMPUS"
        title={showSaved ? 'Good finds, kept close.' : showAll ? 'Your listings.' : `Hello, ${data.profile?.display_name.split(' ')[0] || 'there'}.`}
        description={showSaved ? 'The things you’ve got your eye on.' : showAll ? 'Keep an eye on your items, from first listing to second life.' : 'A little overview of what you’re passing on, and what’s caught your eye.'}
      >
        <Link className="button primary" href="/sell"><Plus size={17} />Sell an item</Link>
      </PageHeading>
      <DashboardTabs path={path} />
      {!showSaved && !showAll && (
        <div className="metrics-grid">
          {[
            ['Total listings', own.length, Package],
            ['Active listings', own.filter((l) => l.status === 'active').length, CheckCircle2],
            ['Pending listings', own.filter((l) => l.status === 'pending_review').length, Clock3],
            ['Sold listings', own.filter((l) => l.status === 'sold').length, Check],
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as typeof Package;
            return (
              <div className="metric-card" key={String(label)}>
                <span>{String(label)}<MetricIcon size={19} /></span>
                <strong>{Number(value)}</strong>
                <small>{label === 'Sold listings' ? 'On to their next chapter' : 'In your school marketplace'}</small>
              </div>
            );
          })}
        </div>
      )}
      {showSaved ? (
        saved.length ? (
          <div className="product-grid">
            {saved.map((l) => <ProductCard key={l.id} listing={l} categories={data.categories} saved onSave={() => void mutate('toggle_saved', { listing_id: l.id })} />)}
          </div>
        ) : (
          <EmptyState title="Your next good find is out there." text="Tap the heart on an item to keep it here for later." href="/explore" />
        )
      ) : (
        <section>
          <div className="section-heading">
            <h2>{showAll ? 'Manage your items' : 'Your latest listings'}</h2>
            {showAll ? (
              <label className="inline-select">
                Status
                <select aria-label="Listing status" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All listings</option>
                  {['draft', 'pending_review', 'active', 'sold', 'removed'].map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
            ) : (
              <Link href="/dashboard/listings">View all<ArrowRight size={16} /></Link>
            )}
          </div>
          {listings.length ? (
            <div className="management-list">
              {listings.map((l) => (
                <article className="management-row" key={l.id}>
                  <Link href={`/listing/${l.id}`} className="management-image" tabIndex={-1} aria-hidden="true">
                    <img src={l.images[0]?.url || '/products/notebooks.svg'} alt="" width="100" height="80" />
                  </Link>
                  <div className="management-title">
                    <Link href={`/listing/${l.id}`}>{l.title}</Link>
                    <span>{money(l.price)} USD · {l.condition}</span>
                  </div>
                  <Status value={l.status} />
                  <ListingActions listing={l} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="A fresh start." text={filter === 'all' ? 'Your first listing could be someone’s next great find.' : 'You don’t have any listings with this status.'} href="/sell" action="List an item" />
          )}
        </section>
      )}
      {!showAll && !showSaved && (
        <div className="dashboard-tip">
          <BookOpen size={25} />
          <div>
            <h3>Every good listing starts with an honest story.</h3>
            <p>A clear photo and a thoughtful description help your item find its next owner.</p>
          </div>
          <Link href="/rules">Listing tips<ArrowRight size={16} /></Link>
        </div>
      )}
    </>
  );
}

export function AuthPage({ path, query }: { path: string; query?: Record<string, string | undefined> }) {
  const { data, mutate, busy } = useMarket();
  const [message, setMessage] = useState('');
  const signup = path === '/signup';
  const forgot = path === '/forgot-password';
  const reset = path === '/reset-password';
  const title = signup ? 'Your community is waiting.' : forgot ? 'Let’s get you back in.' : reset ? 'A fresh start for your password.' : 'Welcome back.';
  const callbackNotice = query?.notice === 'invalid-link'
    ? 'That verification or recovery link has expired or was already used. Sign in or request a fresh link below.'
    : query?.notice === 'configuration-required'
      ? 'Supabase authentication must be configured before email verification links can be processed.'
      : '';

  return (
    <div className="auth-layout">
      <div className="auth-story">
        <span className="hero-kicker"><ShieldCheck size={16} /> A PRIVATE SCHOOL COMMUNITY</span>
        <h1>Good things.<br />Familiar faces.<br /><span>More possibility.</span></h1>
        <p>A safer space to pass on school essentials and discover your next great find.</p>
        <img src="/products/maths.svg" alt="An illustrated pre-loved mathematics textbook" width="480" height="350" />
        <div className="auth-promise"><ShieldCheck size={20} /><span>School-verified members.<br /><strong>A community you can trust.</strong></span></div>
      </div>
      <section className="auth-form-panel">
        <Link className="back-link" href="/"><ArrowLeft size={15} />Back to CampusMarket</Link>
        <div className="auth-form-inner">
          <span className="auth-icon">{forgot || reset ? <LockKeyhole size={25} /> : <ShoppingIcon />}</span>
          <h2>{title}</h2>
          <p>{signup ? 'Create an account, verify your email, and let your school confirm your membership.' : forgot ? 'Enter your email and we’ll send a password reset link.' : reset ? 'Choose a strong password with at least 12 characters.' : 'Log in to discover what’s new in your school marketplace.'}</p>
          {callbackNotice && <p role="status" className="form-message">{callbackNotice}</p>}
          {data.mode === 'demo' && (
            <div className="inline-notice">
              <ShieldCheck size={18} />
              <div>
                <strong>You’re exploring a local demo.</strong>
                <p>Authentication needs a configured Supabase project. Demo browsing doesn’t create an account.</p>
                <Link href="/explore">Explore the demo<ArrowRight size={14} /></Link>
              </div>
            </div>
          )}
          <form className="stack-form" onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const action: ActionName = signup ? 'signup' : forgot ? 'forgot_password' : reset ? 'reset_password' : 'login';
            const result = await mutate(action, Object.fromEntries(form));
            setMessage(result.message);
            if (result.ok && (signup || forgot)) e.currentTarget?.reset();
          }}>
            {signup && (
              <label>
                Display name
                <input name="display_name" autoComplete="nickname" minLength={2} maxLength={60} placeholder="e.g. Tariro M." required />
                <small>Use a first name and initial. Keep personal details private.</small>
              </label>
            )}
            {!reset && (
              <label>
                Email address
                <input name="email" autoComplete="email" type="email" placeholder="you@example.com" maxLength={254} required />
              </label>
            )}
            {!forgot && (
              <label>
                Password
                <input name="password" type="password" minLength={signup || reset ? 12 : 1} maxLength={128} autoComplete={signup || reset ? 'new-password' : 'current-password'} required placeholder={signup || reset ? 'At least 12 characters' : 'Your password'} />
              </label>
            )}
            {!signup && !forgot && !reset && <Link className="forgot-link" href="/forgot-password">Forgot your password?</Link>}
            {signup && (
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span>I’ve read the <Link href="/rules">school rules</Link> and <Link href="/privacy">privacy notice</Link>.</span>
              </label>
            )}
            {message && <p role="status" className="form-message">{message}</p>}
            <button className="button primary wide" disabled={busy || data.mode === 'unconfigured'}>
              {busy ? 'One moment…' : signup ? 'Create account' : forgot ? 'Send reset link' : reset ? 'Update password' : 'Log in'}<ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-bottom">
            {signup ? 'Already part of the community?' : forgot || reset ? 'Remember your password?' : 'New to CampusMarket?'}{' '}
            <Link href={signup || forgot || reset ? '/login' : '/signup'}>{signup || forgot || reset ? 'Log in' : 'Create an account'}</Link>
          </p>
          <div className="auth-privacy"><LockKeyhole size={13} />Your details stay private. Your school controls access.</div>
        </div>
      </section>
    </div>
  );
}

function ShoppingIcon() {
  return <Package size={25} />;
}

export function AccountPage({ path }: { path: string }) {
  const { data, mutate, busy } = useMarket();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const pending = path === '/pending-approval';
  const status = data.profile?.verification_status || 'pending';

  if (pending) {
    return (
      <div className="approval-page">
        <span className="approval-icon"><ShieldCheck size={42} /></span>
        <p className="eyebrow">ONE MORE STEP TO YOUR COMMUNITY</p>
        <h1>{status === 'approved' ? 'You’re part of the community.' : status === 'suspended' ? 'Your account is suspended.' : status === 'rejected' ? 'Your membership wasn’t approved.' : 'Your school has the next step.'}</h1>
        <p>{status === 'pending' ? 'Once your email is verified, a school administrator will confirm your membership. You can explore the marketplace after approval.' : status === 'approved' ? 'Your school has approved your account. You’re ready to discover the marketplace.' : 'Please speak to your school administrator in person for help with your membership.'}</p>
        <div className="approval-steps">
          <div><Mail size={20} /><strong>Verify your email</strong><span>Follow the link in your inbox.</span></div>
          <div><UserCheck size={20} /><strong>School review</strong><span>An administrator confirms membership.</span></div>
          <div><CheckCircle2 size={20} /><strong>You’re in</strong><span>Find, save, and list school essentials.</span></div>
        </div>
        {status === 'approved' ? (
          <Link className="button primary" href="/explore">Explore the marketplace<ArrowRight size={16} /></Link>
        ) : (
          <div className="button-row">
            <button type="button" className="button primary" onClick={() => router.refresh()}>Check approval status</button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void mutate('logout', {})}>Log out</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeading eyebrow="YOUR SCHOOL, YOUR SPACE" title="Account settings." description="A few details to make your corner of CampusMarket feel like you." />
      <DashboardTabs path="/profile" />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <div className="profile-heading">
            <span className="avatar avatar-large">{data.profile?.display_name.split(' ').map((n) => n[0]).slice(0, 2).join('') || 'CM'}</span>
            <div>
              <h2>{data.profile?.display_name || 'School member'}</h2>
              <Status value={status} />
            </div>
          </div>
          <form className="stack-form" onSubmit={async (e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            await mutate('update_profile', { display_name: values.get('display_name') });
          }}>
            <label>
              Display name
              <input name="display_name" defaultValue={data.profile?.display_name} minLength={2} maxLength={60} required />
              <small>A first name and initial work well. Don’t add contact details.</small>
            </label>
            <button className="button primary align-start" disabled={busy}>Save changes<Check size={16} /></button>
          </form>
          <div className="settings-section">
            <h3>Account security</h3>
            <p>Your email and password are managed securely through Supabase Auth.</p>
            <div className="button-row">
              <Link className="button secondary" href="/forgot-password"><LockKeyhole size={16} />Reset password</Link>
              <button className="button secondary" disabled={busy} onClick={() => void mutate('logout', {})}><LogOut size={16} />Log out</button>
            </div>
          </div>
          {data.mode === 'demo' && (
            <div className="settings-section">
              <h3>Local demonstration</h3>
              <p>Clear the fictional changes saved in this browser and start again.</p>
              <button className="button secondary align-start" onClick={() => setConfirmReset(true)}>Reset demo data</button>
            </div>
          )}
        </section>
        <aside className="panel privacy-aside">
          <ShieldCheck size={29} />
          <h3>Your privacy matters.</h3>
          <p>Other members can see your display name and listings. Your email address, contact details and school schedule are never shown.</p>
          <Link href="/privacy">Read the privacy notice<ArrowRight size={15} /></Link>
        </aside>
      </div>
      {confirmReset && (
        <Dialog title="Reset the local demo?" onClose={() => setConfirmReset(false)}>
          <p>Your simulated listings, reports and saved items will be reset in this browser.</p>
          <div className="button-row">
            <button className="button primary" onClick={() => {
              resetDemoSnapshot();
              setConfirmReset(false);
              router.push('/');
            }}>Reset demo</button>
            <button className="button secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function AdminPage({ path }: { path: string }) {
  const { data, mutate, busy } = useMarket();
  const [confirm, setConfirm] = useState<{ action: ActionName; id: string; status: string; title: string } | null>(null);
  const [tabFilter, setTabFilter] = useState('all');
  const section = path.split('/')[2] || 'overview';
  const pendingUsers = data.profiles.filter((p) => p.verification_status === 'pending');
  const pendingListings = data.listings.filter((l) => l.status === 'pending_review');
  const openReports = data.reports.filter((r) => r.status === 'open');
  const moderation = (action: ActionName, id: string, status: string, title: string) => setConfirm({ action, id, status, title });

  return (
    <>
      <PageHeading
        eyebrow="SCHOOL ADMINISTRATION"
        title={section === 'users' ? 'A community, carefully verified.' : section === 'listings' ? 'Keep good things on the shelf.' : section === 'reports' ? 'A safer space starts here.' : 'Your community at a glance.'}
        description="Review membership, care for the marketplace, and keep every decision accountable."
      />
      {data.mode === 'demo' && (
        <div className="inline-notice admin-demo">
          <ShieldCheck size={20} />
          <p><strong>Administrator preview.</strong> These are fictional accounts. Every action is a local simulation, without granting real administrator access.</p>
        </div>
      )}
      <nav className="page-tabs" aria-label="Administration navigation">
        {[
          ['overview', '/admin', 'Overview', LayoutDashboard],
          ['users', '/admin/users', 'User verification', Users],
          ['listings', '/admin/listings', 'Listing moderation', ListChecks],
          ['reports', '/admin/reports', 'Reports', Flag],
        ].map(([key, href, label, Icon]) => {
          const TabIcon = Icon as typeof Users;
          return <Link key={String(key)} className={section === key ? 'active' : ''} href={String(href)}><TabIcon size={17} />{String(label)}</Link>;
        })}
      </nav>
      {section === 'overview' && (
        <>
          <div className="metrics-grid admin-metrics">
            {[
              ['Awaiting approval', pendingUsers.length, '/admin/users', Users],
              ['Listings to review', pendingListings.length, '/admin/listings', Package],
              ['Open reports', openReports.length, '/admin/reports', Flag],
            ].map(([label, count, href, Icon]) => {
              const MetricIcon = Icon as typeof Users;
              return (
                <Link href={String(href)} className="metric-card" key={String(label)}>
                  <span>{String(label)}<MetricIcon size={19} /></span>
                  <strong>{Number(count)}</strong>
                  <small>Open queue<ArrowRight size={13} /></small>
                </Link>
              );
            })}
          </div>
          <div className="section-heading">
            <h2>Moderation history</h2>
            <span className="muted">Latest recorded decisions</span>
          </div>
          {data.events.length ? (
            <div className="audit-list">
              {data.events.map((event) => (
                <div key={event.id}>
                  <span className="audit-icon"><ShieldCheck size={17} /></span>
                  <div><strong>{event.action.replaceAll('_', ' ')}</strong><span>{event.target_type.replaceAll('_', ' ')} · {event.target_id.slice(0, 8)}</span></div>
                  <time>{new Date(event.created_at).toLocaleString('en-GB')}</time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="The decision log starts here." text="Approval, removal and report decisions will appear here as administrators review them." />
          )}
        </>
      )}
      {section === 'users' && (
        <>
          <div className="section-heading">
            <h2>School members<span className="count-pill">{data.profiles.length}</span></h2>
            <label className="inline-select">
              Filter
              <select value={tabFilter} onChange={(e) => setTabFilter(e.target.value)} aria-label="Verification status">
                <option value="all">All members</option>
                {['pending', 'approved', 'rejected', 'suspended'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="management-list">
            {data.profiles.filter((user) => tabFilter === 'all' || user.verification_status === tabFilter).map((user) => (
              <article className="management-row user-row" key={user.id}>
                <span className="avatar">{user.display_name.slice(0, 1)}</span>
                <div className="management-title">
                  <strong>{user.display_name}</strong>
                  <span>{user.role} · Joined {new Date(user.created_at).toLocaleDateString('en-GB')}</span>
                </div>
                <Status value={user.verification_status} />
                <div className="listing-actions">
                  {user.id === data.profile?.id ? (
                    <span className="muted">Your account</span>
                  ) : (
                    <>
                      {user.verification_status !== 'approved' && (
                        <button className="button primary small" disabled={busy} onClick={() => moderation('moderate_user', user.id, 'approved', `Approve ${user.display_name}?`)}>
                          <Check size={14} />Approve
                        </button>
                      )}
                      {user.verification_status === 'pending' && (
                        <button className="button secondary small" onClick={() => moderation('moderate_user', user.id, 'rejected', `Reject ${user.display_name}?`)}>Reject</button>
                      )}
                      {user.verification_status === 'approved' && (
                        <button className="button danger-quiet small" onClick={() => moderation('moderate_user', user.id, 'suspended', `Suspend ${user.display_name}?`)}>Suspend</button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {section === 'listings' && (
        <>
          <div className="section-heading">
            <h2>Review queue<span className="count-pill">{pendingListings.length}</span></h2>
            <label className="inline-select">
              Status
              <select value={tabFilter} onChange={(e) => setTabFilter(e.target.value)} aria-label="Moderation status">
                <option value="all">All listings</option>
                <option value="pending_review">Pending review</option>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="removed">Removed</option>
              </select>
            </label>
          </div>
          <div className="management-list">
            {data.listings.filter((l) => tabFilter === 'all' || l.status === tabFilter).map((l) => (
              <article className="management-row" key={l.id}>
                <Link className="management-image" href={`/listing/${l.id}`} tabIndex={-1} aria-hidden="true">
                  <img src={l.images[0]?.url || '/products/notebooks.svg'} alt="" width="100" height="80" />
                </Link>
                <div className="management-title">
                  <Link href={`/listing/${l.id}`}>{l.title}</Link>
                  <span>{money(l.price)} · {l.seller_name}</span>
                </div>
                <Status value={l.status} />
                <div className="listing-actions">
                  {l.status === 'pending_review' && (
                    <button className="button primary small" disabled={busy} onClick={() => moderation('moderate_listing', l.id, 'active', `Approve “${l.title}”?`)}>
                      <Check size={14} />Approve
                    </button>
                  )}
                  {['pending_review', 'active', 'sold'].includes(l.status) && (
                    <button className="button danger-quiet small" onClick={() => moderation('moderate_listing', l.id, 'removed', `${l.status === 'pending_review' ? 'Reject' : 'Remove'} “${l.title}”?`)}>
                      {l.status === 'pending_review' ? 'Reject' : 'Remove'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {section === 'reports' && (
        data.reports.length ? (
          <div className="reports-grid">
            {data.reports.map((report) => (
              <article key={report.id} className="panel report-card">
                <div className="section-heading">
                  <span className="report-category"><Flag size={17} />{report.reason}</span>
                  <Status value={report.status} />
                </div>
                <h2><Link href={`/listing/${report.listing_id}`}>{data.listings.find((l) => l.id === report.listing_id)?.title || 'Reported listing'}</Link></h2>
                <p>{report.details}</p>
                <span className="muted">Reported {new Date(report.created_at).toLocaleDateString('en-GB')}</span>
                {report.status === 'open' && (
                  <div className="button-row">
                    <button className="button primary small" onClick={() => moderation('resolve_report', report.id, 'resolved', 'Mark this report resolved?')}>Resolve report</button>
                    <button className="button secondary small" onClick={() => moderation('resolve_report', report.id, 'dismissed', 'Dismiss this report?')}>Dismiss</button>
                    <button className="button danger-quiet small" onClick={() => moderation('moderate_listing', report.listing_id, 'removed', 'Remove the reported listing?')}>Remove listing</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing to review right now." text="Reports from the community will appear here." />
        )
      )}
      {confirm && (
        <Dialog title={confirm.title} onClose={() => setConfirm(null)}>
          <p>
            This decision will be recorded in the moderation history.
            {confirm.action === 'moderate_user' && confirm.status === 'approved' ? ' Confirm the student’s school membership using your school’s approved process before continuing.' : ''}
          </p>
          <div className="button-row">
            <button className={`button ${['removed', 'rejected', 'suspended'].includes(confirm.status) ? 'danger' : 'primary'}`} disabled={busy} onClick={async () => {
              const result = await mutate(confirm.action, { id: confirm.id, status: confirm.status });
              if (result.ok) setConfirm(null);
            }}>Confirm decision</button>
            <button className="button secondary" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function PolicyPage({ path }: { path: string }) {
  const privacy = path === '/privacy';
  return (
    <div className="policy-page">
      <PageHeading
        eyebrow="A COMMUNITY BUILT ON CARE"
        title={privacy ? 'Your privacy belongs to you.' : 'Good finds. Good community.'}
        description={privacy ? 'How CampusMarket is designed to protect school members.' : 'A few shared rules help everyone feel at home.'}
      />
      <div className="inline-notice">
        <ShieldCheck size={21} />
        <p><strong>Draft for school administrator review.</strong> This MVP is not approved for public launch. These notices and the exchange process must be reviewed and adopted by the school before real use.</p>
      </div>
      {privacy ? (
        <div className="policy-copy">
          <h2>What the app stores</h2>
          <p>Supabase Auth stores your email and authentication data. Your profile contains your display name, role and membership status. Listings, saved items, reports, uploaded images and moderation decisions are stored to operate the marketplace.</p>
          <h2>Who can see what</h2>
          <p>Approved school members can browse approved listings and see the seller’s display name. Administrators can review accounts, submitted listings and reports. Other members cannot see your email, saved items or reports.</p>
          <h2>Photos and safe sharing</h2>
          <p>Images are stored privately. Short-lived image links are issued for authorised viewers. Do not include people, personal documents, contact details, exact locations or school schedules in listing content.</p>
          <h2>Local storage</h2>
          <p>The app remembers your theme preference. The local demonstration also saves fictional demo activity in your browser. Production authentication uses secure server-managed sessions.</p>
          <h2>Decisions the school must make</h2>
          <p>Before launch, the school must name the responsible administrator, approve a lawful processing basis and any required guardian involvement, choose retention and deletion periods, define account deletion and access-request procedures, and publish a contact route for privacy concerns.</p>
          <h2>Requesting help</h2>
          <p>Until a school contact is formally assigned, raise privacy or account concerns through your existing school administration channels. Do not share sensitive information in listing reports.</p>
        </div>
      ) : (
        <div className="policy-copy">
          <h2>Keep it school-appropriate</h2>
          <p>List your own second-hand textbooks, calculators, stationery, supplies, electronics, bags, sports equipment and other school-approved items. Be honest about their condition and any defects.</p>
          <h2>These items don’t belong here</h2>
          <ul>
            <li>Weapons or dangerous items.</li>
            <li>Alcohol, nicotine, drugs and other age-restricted products.</li>
            <li>Gambling products.</li>
            <li>Stolen, counterfeit or unlawful goods.</li>
            <li>Personal or confidential school information.</li>
            <li>Anything prohibited by your school’s policy.</li>
          </ul>
          <h2>Protect everyone’s privacy</h2>
          <p>Never add email addresses, phone numbers, precise locations or schedules to listings or photos. Use a first name and initial as your display name. Don’t share another person’s information.</p>
          <h2>Every listing gets a second look</h2>
          <p>School administrators review new listings and substantive edits before they appear in the marketplace. Report anything that seems unsafe, misleading or inappropriate using the report button on its listing.</p>
          <h2 id="exchanges">School-approved exchanges</h2>
          <div className="exchange-placeholder">
            <LockKeyhole size={23} />
            <div>
              <strong>Awaiting a school-approved process</strong>
              <p>The school must establish a supervised exchange method, an approved place and times, safeguarding responsibilities and a dispute process before launch. Until then, the app offers browsing and listing management only. It does not arrange exchanges, process payments, or provide direct messaging.</p>
            </div>
          </div>
          <h2>Membership is a shared responsibility</h2>
          <p>Only school-approved members can use the private marketplace. Administrators can reject listings or suspend access where necessary. Ask your school administrator for help with membership or a moderation decision.</p>
        </div>
      )}
      <Link className="button secondary" href="/explore"><ArrowLeft size={16} />Back to the marketplace</Link>
    </div>
  );
}
