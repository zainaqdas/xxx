/**
 * xxxHubxxx CDN Proxy — Cloudflare Worker
 *
 * Proxies video segments, HLS manifests, and thumbnails from
 * xvideos CDN hosts through Cloudflare's edge network.
 *
 * Deployment
 * ----------
 *   1. Install Wrangler:  npm install -g wrangler
 *   2. Login:             wrangler login
 *   3. Deploy:            wrangler deploy
 *
 * Environment Variables (secrets)
 * -------------------------------
 *   ALLOWED_ORIGIN  — (optional) Restrict CORS to a specific origin.
 *                     Defaults to "*". Set to your Vercel domain in
 *                     production (e.g. "https://xxxhubxxx.vercel.app").
 */

const ALLOWED_HOSTS = ['xvideos-cdn.com', 'xv-cdn.com'];

function isAllowedTarget(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

function toProxyUrl(url) {
  return `/?url=${encodeURIComponent(url)}`;
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

      // Preserve comments, tags, and empty lines
      if (trimmed.startsWith('#') || trimmed === '') return line;

      // Absolute HTTPS/HTTP URL
      if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
        try {
          const parsed = new URL(trimmed);
          if (ALLOWED_HOSTS.some((host) => parsed.hostname.endsWith(host))) {
            return toProxyUrl(parsed.href);
          }
        } catch {
          // leave unmodified
        }
        return line;
      }

      // Protocol-relative URL (e.g. //cdn.example/segment.ts)
      if (trimmed.startsWith('//')) {
        return toProxyUrl(`https:${trimmed}`);
      }

      // Relative URL — resolve against the manifest's base directory
      try {
        const resolved = new URL(trimmed, `${base.origin}${baseDir}`);
        if (ALLOWED_HOSTS.some((host) => resolved.hostname.endsWith(host))) {
          return toProxyUrl(resolved.href);
        }
      } catch {
        // leave unmodified
      }
      return line;
    })
    .join('\n');
}

function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
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

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl || !isAllowedTarget(targetUrl)) {
      return new Response('Forbidden', {
        status: 403,
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      });
    }

    try {
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      // Forward Range header for video seeking
      const rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      const upstream = await fetch(targetUrl, { headers });

      if (!upstream.ok && upstream.status !== 206) {
        return new Response('Proxy error', {
          status: upstream.status,
          headers: corsHeaders(env.ALLOWED_ORIGIN),
        });
      }

      const contentType = upstream.headers.get('content-type') || '';
      const isM3u8Url = targetUrl.includes('.m3u8');

      // HLS manifest — rewrite segment URLs through the proxy
      if (
        isM3u8Url ||
        contentType.includes('m3u8') ||
        contentType.includes('application/vnd.apple.mpegurl')
      ) {
        const text = await upstream.text();
        const rewritten = rewriteHlsManifest(text, targetUrl);

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

      // Cache at edge for 1 hour
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
  },
};
