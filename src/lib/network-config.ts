/** Shared configuration; never trusts a request-supplied host. */
export function developmentOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== 'development') return [];
  const configured = (env.CAMPUSMARKET_DEV_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (env.NEXT_PUBLIC_SITE_URL) configured.push(env.NEXT_PUBLIC_SITE_URL);
  return [...new Set(['http://localhost:3000', 'http://127.0.0.1:3000', ...configured].map(value => {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Development origins must be explicit HTTP(S) origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
      throw new Error('Development origins must have an exact host and port, without paths, credentials or wildcards.');
    }
    return url.origin;
  }))];
}

export function contentSecurityPolicy(env: NodeJS.ProcessEnv = process.env): string {
  const isDev = env.NODE_ENV === 'development';
  const origins = developmentOrigins(env);
  let storageOrigin = '';
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (url.username || url.password || (!isDev && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Supabase must use HTTPS outside development.');
    }
    storageOrigin = url.origin;
  }
  const connections = [storageOrigin, ...origins, ...origins.map(origin => origin.replace(/^http/, 'ws'))].filter(Boolean).join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storageOrigin ? ` ${storageOrigin}` : ''}`,
    "font-src 'self'",
    `connect-src 'self'${connections ? ` ${connections}` : ''}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; ');
}
