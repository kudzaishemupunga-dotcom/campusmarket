'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import {
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  ShoppingBag,
  Store,
  Sun,
  X,
} from 'lucide-react';
import type { Profile } from '@/lib/types';
import { WiseOwlLogo } from './wise-owl-logo';

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

export function setThemePreference(dark: boolean) {
  const next = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('campusmarket-theme', next);
  } catch {
    /* ignore storage errors */
  }
  themeListeners.forEach((listener) => listener());
}

export function useThemeDark(): boolean {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
}

export function PlatformHeader({
  path,
  profile,
}: {
  path: string;
  profile: Profile | null;
}) {
  const dark = useThemeDark();
  const [menu, setMenu] = useState(false);

  const isHubActive = path === '/hub';
  const isOwlAidActive = path.startsWith('/owlaid');
  const isQuizzesActive = path.startsWith('/quizzes');
  const isFlashcardsActive = path.startsWith('/flashcards');
  const isMarketActive =
    path === '/marketplace' || path.startsWith('/category/') || path.startsWith('/product/');
  const isProjectsActive = path.startsWith('/projects');
  const isSellerActive = path.startsWith('/seller');

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Wise Owl Hub home">
          <span className="brand-mark">
            <WiseOwlLogo variant="shield" size={32} eager />
          </span>
          <span className="brand-text">
            <span className="brand-title">
              Wise Owl <span className="brand-gold">Hub</span>
            </span>
            <span className="brand-sub">Westgate · Study & Market</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          <Link className={isHubActive ? 'active' : ''} href="/hub">
            Hub
          </Link>
          <Link className={isOwlAidActive ? 'active' : ''} href="/owlaid">
            OwlAid
          </Link>
          <Link className={isQuizzesActive ? 'active' : ''} href="/quizzes">
            Quizzes
          </Link>
          <Link className={isFlashcardsActive ? 'active' : ''} href="/flashcards">
            Flashcards
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
          {profile ? (
            <Link className={path === '/account' ? 'active' : ''} href="/account">
              Account
            </Link>
          ) : (
            <Link className={path === '/login' ? 'active' : ''} href="/login">
              Sign In
            </Link>
          )}
          {profile?.role === 'admin' && (
            <Link
              className={path.startsWith('/admin') ? 'active admin-nav-pill' : 'admin-nav-pill'}
              href="/admin"
            >
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

          {profile?.verification_status === 'approved' ? (
            path.startsWith('/seller') || path === '/marketplace' ? (
              <Link className="button primary header-cta" href="/seller/dashboard">
                <Store size={16} /> Seller Hub
              </Link>
            ) : (
              <Link className="button primary header-cta" href="/hub">
                <LayoutDashboard size={16} /> Student Hub
              </Link>
            )
          ) : (
            <Link className="button primary header-cta" href="/hub">
              <BookOpen size={16} /> Open Study Hub
            </Link>
          )}

          {profile && (
            <Link href="/account" className="avatar" aria-label="Account overview">
              {profile.display_name
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
          <Link href="/hub" onClick={() => setMenu(false)}>
            Student Hub
          </Link>
          <Link href="/owlaid" onClick={() => setMenu(false)}>
            OwlAid
          </Link>
          <Link href="/quizzes" onClick={() => setMenu(false)}>
            IGCSE Quizzes
          </Link>
          <Link href="/flashcards" onClick={() => setMenu(false)}>
            Flashcards
          </Link>
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
          {profile && (
            <Link href="/seller/dashboard" onClick={() => setMenu(false)}>
              Seller Dashboard
            </Link>
          )}
          <Link href="/about" onClick={() => setMenu(false)}>
            About
          </Link>
          {profile ? (
            <Link href="/account" onClick={() => setMenu(false)}>
              Account ({profile.display_name})
            </Link>
          ) : (
            <Link href="/login" onClick={() => setMenu(false)}>
              Sign In
            </Link>
          )}
          {profile?.role === 'admin' && (
            <Link href="/admin" onClick={() => setMenu(false)}>
              Administration
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

export function PlatformMobileNav({ path }: { path: string }) {
  return (
    <nav className="mobile-bottom" aria-label="Mobile navigation">
      <Link className={path === '/hub' ? 'active' : ''} href="/hub">
        <LayoutDashboard size={19} /> Hub
      </Link>
      <Link className={path.startsWith('/owlaid') ? 'active' : ''} href="/owlaid">
        <BrainCircuit size={19} /> OwlAid
      </Link>
      <Link className={path.startsWith('/quizzes') ? 'active' : ''} href="/quizzes">
        <ClipboardCheck size={19} /> Quizzes
      </Link>
      <Link className={path.startsWith('/flashcards') ? 'active' : ''} href="/flashcards">
        <Layers size={19} /> Cards
      </Link>
      <Link
        className={
          path === '/marketplace' ||
          path.startsWith('/category') ||
          path.startsWith('/product') ||
          path === '/'
            ? 'active'
            : ''
        }
        href="/marketplace"
      >
        <ShoppingBag size={19} /> Market
      </Link>
    </nav>
  );
}

export function PlatformFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand-col">
          <Link className="brand footer-brand" href="/" aria-label="Wise Owl Hub home">
            <WiseOwlLogo variant="crest" size={58} framed eager className="footer-crest-badge" />
            <span className="brand-text">
              <span className="brand-title">
                Wise Owl <span className="brand-gold">Hub</span>
              </span>
              <span className="brand-sub">Wise Owl High School Westgate · Harare</span>
            </span>
          </Link>
          <p className="footer-motto">
            <em>“Going an Extra Mile”</em> — Unified Cambridge IGCSE study tools, OwlAid tutoring, and the CampusMarket student project marketplace.
          </p>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/hub">Student Hub</Link>
          <Link href="/owlaid">OwlAid</Link>
          <Link href="/quizzes">Quizzes</Link>
          <Link href="/flashcards">Flashcards</Link>
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/seller">Seller Portal</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/rules">School Rules</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/about">Project Information</Link>
        </nav>
      </div>

      <div className="container footer-disclaimer">
        <p>
          <strong>Disclaimer:</strong> Wise Owl Hub (including CampusMarket and OwlAid) is a student-created platform developed for Wise Owl High School Westgate learners to support IGCSE revision and showcase real school-project products. Unless formally established otherwise by school administration, it is not an official commercial publication or official announcement channel of Wise Owl Group of Schools.
        </p>
      </div>
    </footer>
  );
}

export function HubShell({
  path,
  profile,
  mode,
  children,
  flushMain = false,
}: {
  path: string;
  profile: Profile | null;
  mode: 'supabase' | 'unconfigured';
  children: React.ReactNode;
  flushMain?: boolean;
}) {
  return (
    <>
      <PlatformHeader path={path} profile={profile} />
      {mode === 'unconfigured' && (
        <div className="configuration-banner" data-testid="configuration-banner">
          <div className="container config-banner-inner">
            <span>
              <strong>Local Study Preview Mode:</strong> Connect Supabase credentials in <code>.env.local</code> for school accounts, cloud progress sync, and CampusMarket storage.
            </span>
            <Link href="/about">Platform info</Link>
          </div>
        </div>
      )}
      <main id="main" className={flushMain ? 'hub-flush-main' : 'container main-content'}>
        {children}
      </main>
      <PlatformFooter />
      <PlatformMobileNav path={path} />
    </>
  );
}

export function QuickActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="button primary small" href={href}>
      <Plus size={15} /> {label}
    </Link>
  );
}
