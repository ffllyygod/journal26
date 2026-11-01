import type { NextConfig } from 'next';

/**
 * Limits where the private journal can load from or send data to. 'unsafe-inline' is required by
 * Next's inline bootstrap scripts without per-request nonces; external scripts remain blocked.
 * Skipped in development, where hot reload needs eval and websockets.
 */
function contentSecurityPolicy() {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : '';
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`,
    `connect-src 'self' ${supabase}`,
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ];
    if (process.env.NODE_ENV === 'production')
      headers.push({ key: 'Content-Security-Policy', value: contentSecurityPolicy() });
    return [{ source: '/:path*', headers }];
  },
};
export default config;
