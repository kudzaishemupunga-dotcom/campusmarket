import type { NextConfig } from 'next';
import { contentSecurityPolicy, developmentOrigins } from './src/lib/network-config';

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // Next matches hostnames here; API checks separately match scheme and port.
  allowedDevOrigins: developmentOrigins().map(origin => new URL(origin).hostname),
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
    ] }];
  },
};
export default config;
