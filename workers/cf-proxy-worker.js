/**
 * xxxHubxxx Universal Proxy — Cloudflare Worker
 *
 * Two modes:
 * 1. CDN Proxy — Proxies video segments, HLS manifests, and thumbnails from
 *    xvideos CDN hosts (xvideos-cdn.com, xv-cdn.com) through Cloudflare's edge.
 * 2. Site Proxy — Proxies the entire Vercel-hosted site so it's accessible
 *    in countries where vercel.app is blocked.
 *
 * Deployment
 * ----------
 *   npx wrangler deploy
 *
 * Environment Variables (secrets)
 * -------------------------------
 *   ALLOWED_ORIGIN  — (optional) Restrict CORS to a specific origin.
 *   SITE_ORIGIN     — (optional) The Vercel site URL to proxy.
 *                     Defaults to https://xxxhubxxx.vercel.app
 */

const CDN_HOSTS = ['xvideos-cdn.com', 'xv-cdn.com'];
const DEFAULT_SITE_ORIGIN = 'https://xxxhubxxx.vercel.app';

// ── Helpers ────────────────────────────────────────────────────────────────

function isCdnTarget(url) {
  try {
    const parsed = new URL(url);
    return CDN_HOSTS.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

function toProxyUrl(url) {
  return `/?url=${encodeURIComponent(url)}`;
}

function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Rewrite an HLS manifest so every segment / playlist URL is
 * replaced with a URL that goes back through this Worker.
 */
function rewriteHlsManifest(manifest, baseUrl) {
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
          if (CDN_HOSTS.some((host) => parsed.hostname.endsWith(host))) {
            return toProxyUrl(parsed.href);
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
        if (CDN_HOSTS.some((host) => resolved.hostname.endsWith(host))) {
          return toProxyUrl(resolved.href);
        }
      } catch {
        // leave unmodified
      }
      return line;
    })
    .join('\n');
}

/**
 * Rewrite HTML to replace any hardcoded Vercel site URL with
 * worker-relative paths so all links stay inside the proxy.
 * e.g. https://xxxhubxxx.vercel.app/fresh → /fresh
 *
 * Only replaces the origin when it appears as a full URL prefix
 * (followed by / or " or '), never inside words or paths.
 */
function rewriteHtml(html, siteOrigin) {
  const escaped = siteOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match origin followed by /, ", ', or end-of-string
  const re = new RegExp(escaped + '(?=[/"\'\\s\\x3c])', 'g');
  return html.replace(re, '');
}

/**
 * Attempt to fetch a text body from the upstream response.
 * Only succeeds for text-based content types.
 */
function isTextContent(contentType) {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return (
    ct.includes('text/html') ||
    ct.includes('text/plain') ||
    ct.includes('text/css') ||
    ct.includes('application/javascript') ||
    ct.includes('application/json') ||
    ct.includes('application/x-javascript') ||
    ct.includes('image/svg+xml')
  );
}

// ── Request handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const siteOrigin = (env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).replace(/\/+$/, '');

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      });
    }

    // Only allow GET / HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      });
    }

    const reqUrl = new URL(request.url);
    const targetUrlParam = reqUrl.searchParams.get('url');

    // ── Mode 1: CDN Proxy (when ?url= targets a CDN host) ────────────
    if (targetUrlParam && isCdnTarget(targetUrlParam)) {
      try {
        const headers = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };

        const rangeHeader = request.headers.get('range');
        if (rangeHeader) {
          headers['Range'] = rangeHeader;
        }

        const upstream = await fetch(targetUrlParam, { headers });

        if (!upstream.ok && upstream.status !== 206) {
          return new Response('Proxy error', {
            status: upstream.status,
            headers: corsHeaders(env.ALLOWED_ORIGIN),
          });
        }

        const contentType = upstream.headers.get('content-type') || '';
        const isM3u8Url = targetUrlParam.includes('.m3u8');

        // HLS manifest — rewrite segment URLs through the proxy
        if (
          isM3u8Url ||
          contentType.includes('m3u8') ||
          contentType.includes('application/vnd.apple.mpegurl')
        ) {
          const text = await upstream.text();
          const rewritten = rewriteHlsManifest(text, targetUrlParam);

          return new Response(rewritten, {
            headers: {
              'Content-Type': 'application/vnd.apple.mpegurl',
              ...corsHeaders(env.ALLOWED_ORIGIN),
              'Cache-Control': 'no-cache',
            },
          });
        }

        // Binary stream — pipe through
        const responseHeaders = {
          'Content-Type': contentType,
          ...corsHeaders(env.ALLOWED_ORIGIN),
        };

        const contentLength = upstream.headers.get('content-length');
        if (contentLength) {
          responseHeaders['Content-Length'] = contentLength;
        }

        const contentRange = upstream.headers.get('content-range');
        if (contentRange) {
          responseHeaders['Content-Range'] = contentRange;
        }

        responseHeaders['Cache-Control'] = 'public, max-age=3600, s-maxage=3600';

        return new Response(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        });
      } catch (err) {
        return new Response('Proxy failed', {
          status: 502,
          headers: corsHeaders(env.ALLOWED_ORIGIN),
        });
      }
    }

    // ── Mode 2: Site Proxy — all other requests proxy to Vercel ──────
    try {
      // Build the upstream URL by appending the same path + query (minus ?url= if present)
      let upstreamUrl;
      if (targetUrlParam) {
        // If ?url= was provided but it's not a CDN target, proxy it as a site page URL
        // (This handles the video detail page: /video/abc?url=https://www.xvideos.com/...)
        upstreamUrl = `${siteOrigin}${reqUrl.pathname}${reqUrl.search}`;
      } else {
        upstreamUrl = `${siteOrigin}${reqUrl.pathname}${reqUrl.search}`;
      }

      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      // Forward the Accept header (important for Next.js data routes)
      const acceptHeader = request.headers.get('accept');
      if (acceptHeader) {
        headers['Accept'] = acceptHeader;
      }

      // Forward the Referer header
      const refererHeader = request.headers.get('referer');
      if (refererHeader) {
        // Rewrite referer if it points to this worker to point to the site instead
        headers['Referer'] = refererHeader.replace(reqUrl.origin, siteOrigin);
      }

      const upstream = await fetch(upstreamUrl, { headers });

      const contentType = upstream.headers.get('content-type') || '';

      // Handle redirects — rewrite Location header to keep user inside the proxy
      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('location');
        if (location && location.startsWith(siteOrigin)) {
          const workerUrl = `${reqUrl.origin}${location.slice(siteOrigin.length)}`;
          const responseHeaders = {
            ...corsHeaders(env.ALLOWED_ORIGIN),
            'Location': workerUrl,
          };
          return new Response(null, {
            status: upstream.status,
            headers: responseHeaders,
          });
        }
      }

      // For HTML responses, rewrite any hardcoded site URLs
      if (contentType.includes('text/html')) {
        const text = await upstream.text();
        const rewritten = rewriteHtml(text, siteOrigin);

        // Build response headers (skip content-encoding since we decompressed)
        const responseHeaders = {
          'Content-Type': 'text/html; charset=utf-8',
          ...corsHeaders(env.ALLOWED_ORIGIN),
          'Cache-Control': 'no-cache',
        };

        // Strip CSP if present — the worker domain won't match it
        const csp = upstream.headers.get('content-security-policy');
        if (csp) {
          responseHeaders['Content-Security-Policy'] = csp.replace(
            siteOrigin,
            `${reqUrl.origin}`
          );
        }

        const cfCacheStatus = upstream.headers.get('cf-cache-status');
        if (cfCacheStatus) {
          responseHeaders['cf-cache-status'] = cfCacheStatus;
        }

        return new Response(rewritten, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      // For other text content (JS, CSS, JSON, etc.), pipe through as-is
      const responseHeaders = {
        ...corsHeaders(env.ALLOWED_ORIGIN),
      };

      // Forward useful headers
      const forwardHeaders = ['content-type', 'content-length', 'content-encoding', 'etag', 'cache-control'];
      for (const h of forwardHeaders) {
        const val = upstream.headers.get(h);
        if (val) responseHeaders[h] = val;
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response('Site proxy failed', {
        status: 502,
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      });
    }
  },
};
