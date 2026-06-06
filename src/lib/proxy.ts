/**
 * Allowed CDN hosts for proxying video content.
 * Requests to any other host via the proxy will be rejected.
 */
export const ALLOWED_PROXY_HOSTS = [
  'xvideos-cdn.com',
  'xv-cdn.com',
];

/**
 * The Cloudflare Worker proxy URL, configured via environment variable.
 * All media proxying goes through Cloudflare's edge network (unlimited
 * bandwidth) instead of through Vercel.
 *
 * Set NEXT_PUBLIC_CF_WORKER_URL to your deployed Worker URL, e.g.:
 *   NEXT_PUBLIC_CF_WORKER_URL=https://xxxhubxxx-proxy.your-name.workers.dev
 *
 * If the env var is not set (e.g. local development), the original CDN
 * URL is returned directly — thumbnails still load, but video playback
 * may fail in regions where the CDN is blocked.
 */
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL || '';

/**
 * Check whether a URL targets one of the allowed CDN hosts.
 */
export const isAllowedProxyTarget = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROXY_HOSTS.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
};

/**
 * Some thumbnail URLs from xvideos contain a literal "THUMBNUM" placeholder
 * (e.g. "xv_THUMBNUM_t.jpg") that needs to be replaced with an actual number.
 */
export const sanitizeThumbnailUrl = (url: string): string => {
  return url.replace(/THUMBNUM/g, '1');
};

/**
 * Build a proxy URL for a given CDN URL.
 *
 * Requires NEXT_PUBLIC_CF_WORKER_URL to be set (production). When not set
 * (local dev), returns the original URL directly.
 */
export const toProxyUrl = (url: string): string => {
  const sanitized = sanitizeThumbnailUrl(url);
  if (CF_WORKER_URL) {
    const base = CF_WORKER_URL.replace(/\/+$/, '');
    return `${base}/?url=${encodeURIComponent(sanitized)}`;
  }
  // Fallback for local dev — load directly from CDN
  return sanitized;
};

/**
 * Rewrite an HLS manifest so every segment / playlist URL is replaced
 * with a proxy URL pointing to the Cloudflare Worker.
 */
export const rewriteHlsManifest = (manifest: string, baseUrl: string): string => {
  const base = new URL(baseUrl);
  const baseDir = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);

  return manifest
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('#') || trimmed === '') return line;

      if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
        try {
          const parsed = new URL(trimmed);
          if (ALLOWED_PROXY_HOSTS.some((host) => parsed.hostname.endsWith(host))) {
            return toProxyUrl(trimmed);
          }
        } catch {
          // leave unmodified
        }
        return line;
      }

      if (trimmed.startsWith('//')) {
        return toProxyUrl(`https:${trimmed}`);
      }

      try {
        const resolved = new URL(trimmed, `${base.origin}${baseDir}`);
        if (ALLOWED_PROXY_HOSTS.some((host) => resolved.hostname.endsWith(host))) {
          return toProxyUrl(resolved.href);
        }
      } catch {
        // leave unmodified
      }
      return line;
    })
    .join('\n');
};
