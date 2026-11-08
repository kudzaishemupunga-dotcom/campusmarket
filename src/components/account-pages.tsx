'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  GraduationCap,
  Heart,
  Inbox,
  LockKeyhole,
  LogOut,
  Mail,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import type { ActionName } from '@/lib/types';
import { EmptyState, money, PageHeading, ProductCard, Status } from './ui';
import { useMarket } from './market-app';

export function AuthPage({
  path,
  query,
}: {
  path: string;
  query?: Record<string, string | undefined>;
}) {
  const { data, mutate, busy } = useMarket();
  const [message, setMessage] = useState('');
  const signup = path === '/signup';
  const forgot = path === '/forgot-password';
  const reset = path === '/reset-password';

  const title = signup
    ? 'Join the Wise Owl community.'
    : forgot
      ? 'Reset your password.'
      : reset
        ? 'Choose a new password.'
        : 'Welcome back.';

  const callbackNotice =
    query?.notice === 'invalid-link'
      ? 'That verification or recovery link has expired or was already used. Sign in or request a fresh link below.'
      : query?.notice === 'configuration-required'
        ? 'Supabase authentication must be configured in .env.local before email verification links can be processed.'
        : '';

  return (
    <div className="auth-layout">
      <div className="auth-story">
        <span className="hero-kicker">
          <ShieldCheck size={16} /> WISE OWL HIGH SCHOOL WESTGATE · HARARE
        </span>
        <h1>
          Going an Extra Mile.
          <br />
          <span>Student Innovation</span> in Practice.
        </h1>
        <p>
          CampusMarket connects Wise Owl Westgate learners, project groups, and approved buyers around authentic goods created through School-Based Projects.
        </p>

        <div className="auth-pillars">
          <div>
            <Sparkles size={18} />
            <span>
              <strong>Real student projects</strong>
              <small>Design, STEM, agriculture, crafts & enterprise</small>
            </span>
          </div>
          <div>
            <Users size={18} />
            <span>
              <strong>Individual & group sellers</strong>
              <small>Role-based workspaces with zero shared passwords</small>
            </span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>
              <strong>School-supervised safety</strong>
              <small>Verified accounts and protected student privacy</small>
            </span>
          </div>
        </div>
      </div>

      <section className="auth-form-panel">
        <Link className="back-link" href="/">
          <ArrowLeft size={15} /> Back to CampusMarket
        </Link>
        <div className="auth-form-inner">
          <span className="auth-icon">
            {forgot || reset ? <LockKeyhole size={24} /> : <GraduationCap size={25} />}
          </span>
          <h2>{title}</h2>
          <p>
            {signup
              ? 'Create a member account, confirm your email, and wait for Wise Owl administrator approval. Want to sell project goods? You can also register directly in the Seller Portal.'
              : forgot
                ? 'Enter your account email to receive a secure password reset link.'
                : reset
                  ? 'Enter a strong password of at least 12 characters.'
                  : 'Sign in to browse approved student projects, manage your seller workspace, or review purchase requests.'}
          </p>

          {callbackNotice && (
            <p role="status" className="form-message">
              {callbackNotice}
            </p>
          )}

          {data.mode === 'unconfigured' && (
            <div className="inline-notice" data-testid="auth-unconfigured-notice">
              <ShieldCheck size={18} />
              <div>
                <strong>Supabase configuration required</strong>
                <p>
                  Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{' '}
                  <code>.env.local</code> to enable real account sign-in and registration.
                </p>
              </div>
            </div>
          )}

          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const form = new FormData(formEl);
              const action: ActionName = signup
                ? 'signup'
                : forgot
                  ? 'forgot_password'
                  : reset
                    ? 'reset_password'
                    : 'login';
              const payload = Object.fromEntries(form);
              if (action === 'login' && query?.next) payload.next = query.next;
              const result = await mutate(action, payload);
              setMessage(result.message);
              if (result.ok && (signup || forgot)) formEl.reset();
            }}
          >
            {signup && (
              <label>
                Display name
                <input
                  name="display_name"
                  autoComplete="nickname"
                  minLength={2}
                  maxLength={60}
                  placeholder="e.g. Rudo K."
                  required
                />
                <small>Use your first name and initial. Keep phone numbers and emails private.</small>
              </label>
            )}
            {!reset && (
              <label>
                Email address
                <input
                  name="email"
                  autoComplete="email"
                  type="email"
                  placeholder="you@example.com"
                  maxLength={254}
                  required
                />
              </label>
            )}
            {!forgot && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={signup || reset ? 12 : 1}
                  maxLength={128}
                  autoComplete={signup || reset ? 'new-password' : 'current-password'}
                  required
                  placeholder={signup || reset ? 'At least 12 characters' : 'Your password'}
                />
              </label>
            )}
            {!signup && !forgot && !reset && (
              <Link className="forgot-link" href="/forgot-password">
                Forgot your password?
              </Link>
            )}
            {signup && (
              <label className="checkbox-label">
                <input type="checkbox" required />
                <span>
                  I accept the <Link href="/rules">marketplace rules</Link> and{' '}
                  <Link href="/privacy">privacy notice</Link>.
                </span>
              </label>
            )}
            {message && (
              <p role="status" className="form-message">
                {message}
              </p>
            )}
            <button className="button primary wide" disabled={busy || data.mode === 'unconfigured'}>
              {busy
                ? 'One moment…'
                : signup
                  ? 'Create member account'
                  : forgot
                    ? 'Send reset link'
                    : reset
                      ? 'Update password'
                      : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="auth-bottom">
            {signup ? 'Already registered?' : forgot || reset ? 'Remember your password?' : 'New to CampusMarket?'}{' '}
            <Link href={signup || forgot || reset ? '/login' : '/signup'}>
              {signup || forgot || reset ? 'Sign in' : 'Create member account'}
            </Link>
            {' · '}
            <Link href="/seller/register">Seller registration</Link>
          </p>
          <div className="auth-privacy">
            <LockKeyhole size={13} /> Personal emails stay private. School administrators control access.
          </div>
        </div>
      </section>
    </div>
  );
}

export function AccountPage({
  path,
  query,
}: {
  path: string;
  query?: Record<string, string | undefined>;
}) {
  const { data, mutate, busy } = useMarket();
  const router = useRouter();
  const pending = path === '/pending-approval';
  const status = data.profile?.verification_status || 'pending';
  const [tab, setTab] = useState<'requests' | 'saved' | 'settings'>(
    query?.tab === 'saved' ? 'saved' : query?.tab === 'settings' ? 'settings' : 'requests'
  );

  if (pending) {
    return (
      <div className="approval-page">
        <span className="approval-icon">
          <ShieldCheck size={42} />
        </span>
        <p className="eyebrow">WISE OWL WESTGATE · MEMBERSHIP VERIFICATION</p>
        <h1>
          {status === 'approved'
            ? 'Your school membership is approved.'
            : status === 'suspended'
              ? 'Your account is currently suspended.'
              : status === 'rejected'
                ? 'Your membership request was not approved.'
                : 'Awaiting school administrator approval.'}
        </h1>
        <p>
          {status === 'pending'
            ? 'Once your email is confirmed, a Wise Owl Westgate administrator verifies your school membership before catalog browsing and seller tools unlock.'
            : status === 'approved'
              ? 'You can now browse approved student projects or open your Seller Workspace.'
              : 'Please speak with your class teacher or Wise Owl administrator in person for assistance.'}
        </p>
        <div className="approval-steps">
          <div>
            <Mail size={20} />
            <strong>1. Confirm email</strong>
            <span>Open the verification link sent to your inbox.</span>
          </div>
          <div>
            <UserCheck size={20} />
            <strong>2. School verification</strong>
            <span>An administrator confirms Wise Owl membership.</span>
          </div>
          <div>
            <CheckCircle2 size={20} />
            <strong>3. Explore & showcase</strong>
            <span>Discover student products or submit your project.</span>
          </div>
        </div>
        {status === 'approved' ? (
          <div className="button-row">
            <Link className="button primary" href="/marketplace">
              Explore Marketplace <ArrowRight size={16} />
            </Link>
            <Link className="button secondary" href="/seller/dashboard">
              Seller Dashboard
            </Link>
          </div>
        ) : (
          <div className="button-row">
            <button type="button" className="button primary" onClick={() => router.refresh()}>
              Check approval status
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void mutate('logout', {})}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  const myBuyerRequests = data.purchaseRequests.filter((r) => r.buyer_id === data.profile?.id);
  const savedListings = data.listings.filter((l) => data.savedIds.includes(l.id));

  return (
    <>
      <PageHeading
        eyebrow="WISE OWL MEMBER ACCOUNT"
        title={`Hello, ${data.profile?.display_name || 'Member'}.`}
        description="Track your supervised purchase requests, saved project products, and account preferences."
      >
        <div className="button-row">
          <Link className="button secondary" href="/seller/dashboard">
            Seller Workspace
          </Link>
          {data.profile?.role === 'admin' && (
            <Link className="button primary" href="/admin">
              Admin Console
            </Link>
          )}
        </div>
      </PageHeading>

      <nav className="page-tabs" aria-label="Account sections">
        <button
          type="button"
          className={tab === 'requests' ? 'active' : ''}
          onClick={() => setTab('requests')}
        >
          <Inbox size={17} /> My Purchase Requests ({myBuyerRequests.length})
        </button>
        <button
          type="button"
          className={tab === 'saved' ? 'active' : ''}
          onClick={() => setTab('saved')}
        >
          <Heart size={17} /> Saved Products ({savedListings.length})
        </button>
        <button
          type="button"
          className={tab === 'settings' ? 'active' : ''}
          onClick={() => setTab('settings')}
        >
          <Settings size={17} /> Account Settings
        </button>
      </nav>

      {tab === 'requests' &&
        (myBuyerRequests.length > 0 ? (
          <div className="management-list" data-testid="buyer-requests-list">
            {myBuyerRequests.map((req) => (
              <article className="management-row request-row" key={req.id}>
                <div className="management-title">
                  <Link href={`/product/${req.listing_id}`}>{req.listing_title}</Link>
                  <span>
                    Seller: <strong>{req.group_name || req.seller_name}</strong> · Quantity:{' '}
                    <strong>{req.quantity}</strong> ({money(Number(req.listing_price) * req.quantity)} USD) ·{' '}
                    {new Date(req.created_at).toLocaleDateString('en-GB')}
                  </span>
                  {req.note && <small className="request-note">Your note: “{req.note}”</small>}
                </div>
                <Status value={req.status} />
                {['pending', 'accepted'].includes(req.status) ? (
                  <button
                    type="button"
                    className="button danger-quiet small"
                    disabled={busy}
                    onClick={() => void mutate('update_purchase_request', { id: req.id, status: 'cancelled' })}
                  >
                    Cancel Request
                  </button>
                ) : (
                  <span className="muted">
                    {req.status === 'fulfilled' ? 'Completed on campus' : 'Closed'}
                  </span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No purchase requests submitted yet."
            text="Browse the marketplace and express interest in real learner-created project goods."
            href="/marketplace"
            action="Browse Marketplace"
          />
        ))}

      {tab === 'saved' &&
        (savedListings.length > 0 ? (
          <div className="product-grid">
            {savedListings.map((l) => (
              <ProductCard
                key={l.id}
                listing={l}
                categories={data.categories}
                saved
                onSave={() => void mutate('toggle_saved', { listing_id: l.id })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved products yet."
            text="Tap the heart icon on any approved student project product to save it here."
            href="/marketplace"
            action="Explore Products"
          />
        ))}

      {tab === 'settings' && (
        <div className="settings-layout">
          <section className="panel settings-panel">
            <div className="profile-heading">
              <span className="avatar avatar-large">
                {data.profile?.display_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('') || 'WO'}
              </span>
              <div>
                <h2>{data.profile?.display_name || 'School member'}</h2>
                <div className="badge-cluster">
                  <Status value={status} />
                  {data.profile?.seller_approved && <Status value="seller approved" />}
                </div>
              </div>
            </div>
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = new FormData(e.currentTarget);
                await mutate('update_profile', { display_name: values.get('display_name') });
              }}
            >
              <label>
                Display name
                <input
                  name="display_name"
                  defaultValue={data.profile?.display_name}
                  minLength={2}
                  maxLength={60}
                  required
                />
                <small>Use your first name and initial. Never include phone numbers or emails.</small>
              </label>
              <button className="button primary align-start" disabled={busy}>
                Save display name <Check size={16} />
              </button>
            </form>
            <div className="settings-section">
              <h3>Account security</h3>
              <p>Authentication and password recovery are managed through Supabase Auth.</p>
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
            <h3>Private by design</h3>
            <p>
              Your email address, saved items, and reports are never visible to other learners. Only approved parties involved in a purchase request can view its status.
            </p>
            <Link href="/privacy" className="text-link">
              Read the privacy notice <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}

export function AboutPage() {
  const values = [
    'Excellence',
    'Creativity',
    'Collaboration',
    'Passion',
    'Respect',
    'Responsibility',
    'Determination',
  ];

  return (
    <div className="about-page">
      <PageHeading
        eyebrow="PROJECT INFORMATION · WISE OWL HIGH SCHOOL WESTGATE"
        title="Where Classroom Projects Become Real Enterprise."
        description="CampusMarket is a dedicated digital platform built for learners at Wise Owl High School Westgate in Harare, Zimbabwe to showcase and coordinate supervised sales of products developed through School-Based Projects."
      />

      <div className="about-grid">
        <section className="panel">
          <BookOpen size={26} />
          <h2>Heritage-Based Curriculum Alignment</h2>
          <p>
            Zimbabwe’s Heritage-Based Curriculum Framework (2024–2030) places practical problem-solving, innovation, collaboration, and tangible goods production at the heart of secondary education. CampusMarket provides a real, school-safe showcase for those learner-built products—from engineered prototypes and woodwork to horticulture, food science, textiles, and creative studio craft.
          </p>
        </section>

        <section className="panel">
          <Award size={26} />
          <h2>Guided by “Going an Extra Mile”</h2>
          <p>
            Inspired by the Wise Owl Group of Schools motto—<em>“Going an Extra Mile”</em>—the platform encourages high standards of presentation, honest stock management, collaborative group leadership, and accountable school oversight.
          </p>
          <div className="values-pills">
            {values.map((v) => (
              <span key={v} className="value-pill">
                {v}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="panel disclaimer-panel">
        <ShieldCheck size={24} />
        <div>
          <h3>Platform Governance & Student Initiative Disclaimer</h3>
          <p>
            CampusMarket is a student-created school project platform developed for Wise Owl High School Westgate learners and is not an official commercial publication of Wise Owl Group of Schools unless formally authorized by school administration. All accounts, project groups, listings, and physical handovers remain subject to Wise Owl school rules and staff supervision.
          </p>
        </div>
      </section>
    </div>
  );
}

export function PolicyPage({ path }: { path: string }) {
  const privacy = path === '/privacy';
  return (
    <div className="policy-page">
      <PageHeading
        eyebrow="WISE OWL WESTGATE · GOVERNANCE & SAFETY"
        title={privacy ? 'Student Privacy Notice.' : 'School Project Marketplace Rules.'}
        description={
          privacy
            ? 'How CampusMarket protects learner privacy at Wise Owl High School Westgate.'
            : 'Shared standards for showcasing and exchanging real school-project products.'
        }
      />
      <div className="inline-notice">
        <ShieldCheck size={21} />
        <p>
          <strong>Subject to Wise Owl school leadership sign-off.</strong> Supervised exchange times, designated campus handover locations, and safeguarding contacts must be formally confirmed by Wise Owl High School Westgate administration prior to live operation.
        </p>
      </div>
      {privacy ? (
        <div className="policy-copy">
          <h2>What CampusMarket stores</h2>
          <p>
            Supabase Auth manages your email address and authentication credentials. Application tables store your learner display name, role, verification status, seller registration details, project group memberships, real product listings, private product photographs, saved items, purchase requests, reports, and administrative audit logs.
          </p>
          <h2>Strict contact-detail protection</h2>
          <p>
            Approved Wise Owl members see seller display names, verified project group names, and approved product details. Your email address is never exposed publicly, and automated guards reject phone numbers and email addresses in display names, product descriptions, purchase notes, and reports.
          </p>
          <h2>Private photographs & metadata stripping</h2>
          <p>
            Product photographs are re-encoded server-side to strip EXIF and location metadata and stored in a private bucket accessible only via short-lived signed URLs for authorized members.
          </p>
          <h2>Purchase request visibility</h2>
          <p>
            Purchase requests are visible only to the submitting buyer, the authorized individual or group seller, and school administrators—never to unrelated students.
          </p>
        </div>
      ) : (
        <div className="policy-copy">
          <h2>Authentic school-project products only</h2>
          <p>
            List only genuine goods, prototypes, crafts, agricultural produce, or approved educational kits actually created or developed through Wise Owl High School Westgate projects. Do not list fabricated items or unrelated personal resales.
          </p>
          <h2>Prohibited listings</h2>
          <ul>
            <li>Unsafe, hazardous, sharp, or uninspected electrical/chemical items without teacher sign-off.</li>
            <li>Unapproved food items not cleared through Food Science supervision.</li>
            <li>Alcohol, nicotine, vapes, medicines, or age-restricted goods.</li>
            <li>Counterfeit, plagiarized, or externally purchased commercial goods passed off as student work.</li>
            <li>Any listing containing student phone numbers, personal email addresses, or off-campus meetup details.</li>
          </ul>
          <h2>Collaborative group accountability</h2>
          <p>
            Group sellers must never share personal passwords. Every student signs in with their own verified account, and group owners grant product editing access only to active project collaborators.
          </p>
          <h2 id="exchanges">Supervised campus exchanges</h2>
          <div className="exchange-placeholder">
            <LockKeyhole size={23} />
            <div>
              <strong>No online payments or unsupervised off-campus meetups</strong>
              <p>
                CampusMarket records purchase interest and coordinates stock safely. Actual product inspection and handover must take place on campus at Wise Owl High School Westgate under the supervision of an authorized teacher or administrator. Stock is deducted atomically once fulfillment is confirmed.
              </p>
            </div>
          </div>
        </div>
      )}
      <Link className="button secondary" href="/">
        <ArrowLeft size={16} /> Back to Home
      </Link>
    </div>
  );
}
