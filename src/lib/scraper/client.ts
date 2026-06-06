import https from 'https';
import http from 'http';
import { URL } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { TransportResponse } from './types';

export const BASE_URL = 'https://www.xvideos.com';

export const resolveUrl = (path: string | undefined): string => {
  if (!path) return '';
  return new URL(path, BASE_URL).toString();
};

export const delay = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
];

let uaIndex = 0;
const getUA = (): string => {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex += 1;
  return ua;
};

// Proxy configuration. Set PROXY_URL to route all requests through an HTTP(S) proxy.
// Example: http://user:pass@proxy.example.com:8080
let proxyAgent: HttpsProxyAgent<string> | null = null;
const proxyUrl = process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
if (proxyUrl) {
  proxyAgent = new HttpsProxyAgent(proxyUrl);
}

const RETRYABLE_ERROR_CODES = new Set(['ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT', 'ENOTFOUND']);

const MAX_REDIRECTS = 5;

function httpGet(url: string, timeoutMs: number, redirectCount = 0): Promise<{ body: string; statusCode: number; url: string }> {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('Too many redirects'));
      return;
    }

    const parsedUrl = new URL(url);
    const mod = parsedUrl.protocol === 'https:' ? https : http;

    const headers: Record<string, string> = {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'identity',
      'user-agent': getUA(),
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'cache-control': 'max-age=0',
    };

    const req = mod.request(
      url,
      {
        method: 'GET',
        headers,
        timeout: timeoutMs,
        rejectUnauthorized: true,
        ...(proxyAgent ? { agent: proxyAgent as http.Agent } : {}),
      } as Parameters<typeof https.request>[1],
      (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          const location = res.headers['location'];
          if (location) {
            // Resolve relative redirects
            const redirectUrl = location.startsWith('http') ? location : new URL(location, url).toString();
            // Consume the response body to free memory
            res.resume();
            // Follow redirect
            httpGet(redirectUrl, timeoutMs, redirectCount + 1).then(resolve).catch(reject);
            return;
          }
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve({
            body,
            statusCode: res.statusCode ?? 500,
            url,
          });
        });
        res.on('error', reject);
      },
    );

    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Request timed out');
      (err as Error & { code: string }).code = 'ETIMEDOUT';
      reject(err);
    });

    req.on('error', reject);
    req.end();
  });
}

export const createClient = () => {
  const get = async (path: string): Promise<TransportResponse> => {
    const url = resolveUrl(path);
    let attempt = 1;
    const MAX_ATTEMPTS = 3;
    // Vercel Hobby has 10s timeout, so use 8s to leave room
    const TIMEOUT = process.env.VERCEL ? 8_000 : 15_000;

    while (true) {
      try {
        const response = await httpGet(url, TIMEOUT);
        return response;
      } catch (error: unknown) {
        const isRetryable = error instanceof Error && (
          (RETRYABLE_ERROR_CODES.has((error as Error & { code?: string }).code ?? '')) ||
          error.message.includes('429') ||
          error.message.includes('Too Many Requests')
        );
        if (isRetryable && attempt < MAX_ATTEMPTS) {
          const isRateLimit = error instanceof Error && (error.message.includes('429') || error.message.includes('Too Many Requests'));
          await delay(isRateLimit ? attempt * 2000 + Math.random() * 1000 : attempt * 750);
          attempt += 1;
          continue;
        }
        // On Vercel with timeout, throw a user-friendly error
        throw new Error(`Failed to load page: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };
  return { get };
};

export type Client = ReturnType<typeof createClient>;
