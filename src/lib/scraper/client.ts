import { gotScraping } from 'got-scraping';
import type { TransportResponse } from './types';

export const BASE_URL = 'https://www.xvideos.com';

const DEFAULT_HEADERS = {
  'accept-language': 'en-US,en;q=0.9',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'cache-control': 'max-age=0',
};

const REQUEST_TIMEOUT = 15_000;
const MAX_ATTEMPTS = 3;

const RETRYABLE_ERROR_CODES = new Set(['ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT']);

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
];

let uaIndex = 0;
const getUA = (): string => {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex += 1;
  return ua;
};

export const createClient = () => {
  const get = async (path: string): Promise<TransportResponse> => {
    let attempt = 1;
    while (true) {
      try {
        const response = await gotScraping({
          url: resolveUrl(path),
          headers: { ...DEFAULT_HEADERS, 'user-agent': getUA() } as Record<string, string>,
          http2: false,
          responseType: 'text',
          throwHttpErrors: true,
          retry: { limit: 0 },
          timeout: { request: REQUEST_TIMEOUT },
        });
        return {
          body: typeof response.body === 'string' ? response.body : String(response.body),
          statusCode: response.statusCode,
          url: response.url,
        };
      } catch (error: unknown) {
        const isRateLimit = error instanceof Error && (error.message.includes('429') || error.message.includes('Too Many Requests'));
        const isRetryableErr = error instanceof Error && (
          error.name === 'TimeoutError' ||
          (RETRYABLE_ERROR_CODES.has((error as Error & { code?: string }).code ?? ''))
        );
        if ((isRateLimit || isRetryableErr) && attempt < MAX_ATTEMPTS) {
          await delay(isRateLimit ? attempt * 2000 + Math.random() * 1000 : attempt * 750);
          attempt += 1;
          continue;
        }
        throw error;
      }
    }
  };
  return { get };
};

export type Client = ReturnType<typeof createClient>;
