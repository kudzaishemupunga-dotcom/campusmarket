import type { NextConfig } from 'next';
const isDev = process.env.NODE_ENV === 'development';
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : '') + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co" + (isDev ? ' http://127.0.0.1:* http://localhost:*' : '') + "; font-src 'self'; connect-src 'self' https://*.supabase.co" + (isDev ? ' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*' : '') + "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
    ] }];
  },
};
export default config;
