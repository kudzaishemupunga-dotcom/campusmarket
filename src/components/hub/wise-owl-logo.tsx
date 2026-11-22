import Image from 'next/image';

export const WISE_OWL_LOGO_ALT = 'Wise Owl High School Westgate logo';

const LOGO_ASSETS = {
  crest: {
    src: '/brand/wise-owl-crest.png',
    width: 420,
    height: 331,
  },
  shield: {
    src: '/brand/wise-owl-shield.png',
    width: 256,
    height: 256,
  },
} as const;

export interface WiseOwlLogoProps {
  /** 'crest' renders the full Wise Owl High School Westgate crest with motto ribbon; 'shield' renders the compact shield & owl emblem. */
  variant?: 'crest' | 'shield';
  /** Target rendered width in CSS pixels; height automatically preserves the exact intrinsic aspect ratio. */
  size?: number;
  /** Places the logo on a clean warm-ivory crest badge for high contrast on dark headers, espresso cards, and dark mode. */
  framed?: boolean;
  /** Eagerly load above-the-fold branding assets (Next.js 16 replacement for deprecated priority). */
  eager?: boolean;
  /** Accessible alt text; defaults to "Wise Owl High School Westgate logo". */
  alt?: string;
  className?: string;
}

export function WiseOwlLogo({
  variant = 'crest',
  size = 64,
  framed = false,
  eager = false,
  alt = WISE_OWL_LOGO_ALT,
  className = '',
}: WiseOwlLogoProps) {
  const asset = LOGO_ASSETS[variant];
  const img = (
    <Image
      src={asset.src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      sizes={`${size}px`}
      loading={eager ? 'eager' : undefined}
      className={`wise-owl-logo-img ${!framed ? className : ''}`.trim()}
      style={{ width: `${size}px`, height: 'auto' }}
    />
  );

  if (!framed) {
    return img;
  }

  return (
    <span className={`wise-owl-logo-frame wise-owl-logo-frame--${variant} ${className}`.trim()}>
      {img}
    </span>
  );
}
