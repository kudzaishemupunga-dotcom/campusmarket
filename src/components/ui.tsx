'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  Cpu,
  FlaskConical,
  Hammer,
  Handshake,
  Heart,
  PackageOpen,
  Palette,
  Scissors,
  Sprout,
  Utensils,
  Users,
  User,
  X,
} from 'lucide-react';
import type { Category, Listing } from '@/lib/types';

export const categoryIcons = [Hammer, Sprout, Utensils, Scissors, FlaskConical, Palette, Cpu, Handshake];

export function money(value: string | number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number(value) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function availabilityLabel(listing: Pick<Listing, 'availability' | 'stock_quantity' | 'made_to_order' | 'status'>): string {
  if (listing.status === 'sold' || listing.availability === 'sold_out') return 'Sold out';
  if (listing.availability === 'unavailable') return 'Unavailable';
  if (listing.made_to_order) return listing.stock_quantity > 0 ? `${listing.stock_quantity} in stock · Made to order` : 'Made to order';
  return `${listing.stock_quantity} available`;
}

export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.replaceAll(' ', '-').replaceAll('_', '-').toLowerCase()}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export function ProductCard({
  listing,
  categories,
  saved,
  onSave,
}: {
  listing: Listing;
  categories: Category[];
  saved: boolean;
  onSave?: () => void;
}) {
  const categoryIndex = categories.findIndex((c) => c.id === listing.category_id);
  const category = categoryIndex >= 0 ? categories[categoryIndex] : undefined;
  const Icon = categoryIcons[categoryIndex >= 0 ? categoryIndex % categoryIcons.length : 0];
  const primaryImage = listing.images[0]?.url;
  const stockBadge = availabilityLabel(listing);
  const isGroup = Boolean(listing.group_id && listing.group_name);

  return (
    <article className="product-card" data-testid="listing-card">
      <div className="product-visual">
        <Link href={`/product/${listing.id}`} tabIndex={-1} aria-hidden="true" className="product-visual-link">
          {primaryImage ? (
            <img src={primaryImage} alt="" width="480" height="360" loading="lazy" />
          ) : (
            <div className="photo-placeholder">
              <Icon size={30} strokeWidth={1.5} />
              <span>Photograph pending</span>
            </div>
          )}
        </Link>
        <span className={`stock-pill stock-${listing.availability}`}>{stockBadge}</span>
        {onSave && (
          <button
            type="button"
            className={`save-button ${saved ? 'is-saved' : ''}`}
            aria-label={`${saved ? 'Unsave' : 'Save'} ${listing.title}`}
            aria-pressed={saved}
            onClick={onSave}
          >
            <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="product-info">
        <div className="product-meta-top">
          <span className="product-category">{category?.name || listing.learning_area || 'School Project'}</span>
          <span className="seller-chip">
            {isGroup ? <Users size={12} /> : <User size={12} />}
            {isGroup ? listing.group_name : listing.seller_name}
          </span>
        </div>
        <h3>
          <Link href={`/product/${listing.id}`}>{listing.title}</Link>
        </h3>
        {listing.project_name && <p className="product-project-tag">Project: {listing.project_name}</p>}
        <div className="product-bottom">
          <span className="price" data-testid="listing-price">
            {money(listing.price)} <small>USD</small>
          </span>
          <Link href={`/product/${listing.id}`} className="card-cta">
            View Product <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  text,
  href,
  action,
  secondaryHref,
  secondaryAction,
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
  secondaryHref?: string;
  secondaryAction?: string;
}) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <div className="empty-icon-ring">
        <PackageOpen size={32} strokeWidth={1.5} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {(href || secondaryHref) && (
        <div className="button-row empty-actions">
          {href && (
            <Link href={href} className="button primary">
              {action || 'Explore marketplace'}
              <ArrowRight size={16} />
            </Link>
          )}
          {secondaryHref && (
            <Link href={secondaryHref} className="button secondary">
              {secondaryAction || 'Learn more'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
    };
  }, []);
  return (
    <dialog ref={ref} className="dialog" onCancel={onClose} aria-labelledby="dialog-title">
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
