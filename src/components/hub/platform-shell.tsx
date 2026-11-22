'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ClipboardCheck,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  Shield,
  ShoppingBag,
  Store,
  Sun,
  User,
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
  const [openDropdown, setOpenDropdown] = useState<'study' | 'account' | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openDropdown]);

  const isHubActive = path === '/hub';
  const isStudyActive =
    path.startsWith('/owlaid') || path.startsWith('/quizzes') || path.startsWith('/flashcards');
  const isMarketActive =
    path === '/marketplace' || path.startsWith('/category/') || path.startsWith('/product/');
  const isProjectsActive = path.startsWith('/projects');
  const isAccountAreaActive =
    path === '/account' || path.startsWith('/seller') || path.startsWith('/admin');

  const initials = profile
    ? profile.display_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Wise Owl Hub home">
          <span className="brand-mark">
            <WiseOwlLogo variant="shield" size={28} eager />
          </span>
          <span className="brand-title">Wise Owl Hub</span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          <Link className={isHubActive ? 'active' : ''} href="/hub">
            Hub
          </Link>

          <div className="nav-dropdown">
            <button
              type="button"
              className={`nav-dropdown-trigger ${isStudyActive ? 'active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={openDropdown === 'study'}
              onClick={() => setOpenDropdown(openDropdown === 'study' ? null : 'study')}
            >
              Study <ChevronDown size={15} className={openDropdown === 'study' ? 'rotated' : ''} />
            </button>
            {openDropdown === 'study' && (
              <div className="nav-dropdown-menu" role="menu" aria-label="Study tools">
                <Link
                  role="menuitem"
                  href="/owlaid"
                  className={path.startsWith('/owlaid') ? 'active' : ''}
                  onClick={() => setOpenDropdown(null)}
                >
                  <BrainCircuit size={16} />
                  <span>
                    <strong>OwlAid</strong>
                    <small>School guide &amp; IGCSE tutor</small>
                  </span>
                </Link>
                <Link
                  role="menuitem"
                  href="/quizzes"
                  className={path.startsWith('/quizzes') ? 'active' : ''}
                  onClick={() => setOpenDropdown(null)}
                >
                  <ClipboardCheck size={16} />
                  <span>
                    <strong>Quizzes</strong>
                    <small>Subject practice &amp; scoring</small>
                  </span>
                </Link>
                <Link
                  role="menuitem"
                  href="/flashcards"
                  className={path.startsWith('/flashcards') ? 'active' : ''}
                  onClick={() => setOpenDropdown(null)}
                >
                  <Layers size={16} />
                  <span>
                    <strong>Flashcards</strong>
                    <small>Spaced-repetition review</small>
                  </span>
                </Link>
              </div>
            )}
          </div>

          <Link className={isMarketActive ? 'active' : ''} href="/marketplace">
            Marketplace
          </Link>
          <Link className={isProjectsActive ? 'active' : ''} href="/projects">
            Projects
          </Link>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={() => setThemePreference(!dark)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {profile ? (
            <div className="nav-dropdown account-dropdown-desktop">
              <button
                type="button"
                className={`account-trigger ${isAccountAreaActive ? 'active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={openDropdown === 'account'}
                aria-label="Account menu"
                onClick={() => setOpenDropdown(openDropdown === 'account' ? null : 'account')}
              >
                <span className="avatar">{initials}</span>
                <span className="account-trigger-name">{profile.display_name}</span>
                <ChevronDown size={15} className={openDropdown === 'account' ? 'rotated' : ''} />
              </button>

              {openDropdown === 'account' && (
                <div className="nav-dropdown-menu nav-dropdown-menu--right" role="menu" aria-label="Account navigation">
                  <Link
                    role="menuitem"
                    href="/account"
                    className={path === '/account' ? 'active' : ''}
                    onClick={() => setOpenDropdown(null)}
                  >
                    <User size={16} />
                    <span>
                      <strong>Account</strong>
                      <small>Requests, saved items &amp; settings</small>
                    </span>
                  </Link>
                  <Link
                    role="menuitem"
                    href={profile.verification_status === 'approved' ? '/seller/dashboard' : '/seller'}
                    className={path.startsWith('/seller') ? 'active' : ''}
                    onClick={() => setOpenDropdown(null)}
                  >
                    <Store size={16} />
                    <span>
                      <strong>Seller Portal</strong>
                      <small>Manage student project listings</small>
                    </span>
                  </Link>
                  {profile.role === 'admin' && (
                    <Link
                      role="menuitem"
                      href="/admin"
                      className={path.startsWith('/admin') ? 'active' : ''}
                      onClick={() => setOpenDropdown(null)}
                    >
                      <Shield size={16} />
                      <span>
                        <strong>Admin</strong>
                        <small>Approvals &amp; moderation</small>
                      </span>
                    </Link>
                  )}
                  <Link
                    role="menuitem"
                    href="/about"
                    className={path === '/about' ? 'active' : ''}
                    onClick={() => setOpenDropdown(null)}
                  >
                    <BookOpen size={16} />
                    <span>
                      <strong>About</strong>
                      <small>School guidelines &amp; project info</small>
                    </span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link className="button primary small header-cta" href="/login">
              Sign in
            </Link>
          )}

          <button
            type="button"
            className="icon-button menu-toggle"
            aria-label={menu ? 'Close menu' : 'Open menu'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="mobile-menu" aria-label="Expanded navigation">
          <div className="mobile-menu-group">
            <span className="mobile-menu-label">Study</span>
            <Link href="/hub" onClick={() => setMenu(false)}>
              Student Hub
            </Link>
            <Link href="/owlaid" onClick={() => setMenu(false)}>
              OwlAid
            </Link>
            <Link href="/quizzes" onClick={() => setMenu(false)}>
              Quizzes
            </Link>
            <Link href="/flashcards" onClick={() => setMenu(false)}>
              Flashcards
            </Link>
          </div>
          <div className="mobile-menu-group">
            <span className="mobile-menu-label">School Marketplace</span>
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
            {profile?.verification_status === 'approved' && (
              <Link href="/seller/dashboard" onClick={() => setMenu(false)}>
                Seller Dashboard
              </Link>
            )}
          </div>
          <div className="mobile-menu-group">
            <span className="mobile-menu-label">Account &amp; Info</span>
            {profile ? (
              <Link href="/account" onClick={() => setMenu(false)}>
                Account ({profile.display_name})
              </Link>
            ) : (
              <Link href="/login" onClick={() => setMenu(false)}>
                Sign in
              </Link>
            )}
            {profile?.role === 'admin' && (
              <Link href="/admin" onClick={() => setMenu(false)}>
                Administration
              </Link>
            )}
            <Link href="/about" onClick={() => setMenu(false)}>
              About
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function PlatformMobileNav({ path }: { path: string }) {
  return (
    <nav className="mobile-bottom" aria-label="Mobile navigation">
      <Link className={path === '/hub' ? 'active' : ''} href="/hub">
        <LayoutDashboard size={18} /> Hub
      </Link>
      <Link className={path.startsWith('/owlaid') ? 'active' : ''} href="/owlaid">
        <BrainCircuit size={18} /> OwlAid
      </Link>
      <Link className={path.startsWith('/quizzes') ? 'active' : ''} href="/quizzes">
        <ClipboardCheck size={18} /> Quizzes
      </Link>
      <Link className={path.startsWith('/flashcards') ? 'active' : ''} href="/flashcards">
        <Layers size={18} /> Cards
      </Link>
      <Link
        className={
          path === '/marketplace' ||
          path.startsWith('/category') ||
          path.startsWith('/product')
            ? 'active'
            : ''
        }
        href="/marketplace"
      >
        <ShoppingBag size={18} /> Market
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
            <WiseOwlLogo variant="crest" size={48} framed eager className="footer-crest-badge" />
            <span className="brand-text">
              <span className="brand-title">Wise Owl Hub</span>
              <span className="brand-sub">Wise Owl High School Westgate · Harare</span>
            </span>
          </Link>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/hub">Hub</Link>
          <Link href="/owlaid">OwlAid</Link>
          <Link href="/quizzes">Quizzes</Link>
          <Link href="/flashcards">Flashcards</Link>
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/seller">Seller Portal</Link>
          <Link href="/about">About</Link>
          <Link href="/rules">Rules</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>

      <div className="container footer-disclaimer">
        <p>
          Wise Owl Hub (including CampusMarket and OwlAid) is a student-created platform for Wise Owl High School Westgate learners. Unless formally established otherwise by school administration, it is not an official commercial publication or official announcement channel of Wise Owl Group of Schools.
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
              Local practice mode: connect Supabase in <code>.env.local</code> to enable school accounts and cloud sync.
            </span>
            <Link href="/about">Learn more</Link>
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
