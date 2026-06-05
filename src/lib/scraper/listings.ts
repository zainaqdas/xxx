import type { Client } from './client';
import type { SearchOptions, BestOptions, VideoListResult } from './types';
import { buildListResult } from './parser';

const assertPage = (page: number): void => {
  if (!Number.isInteger(page) || page < 1 || page > Number.MAX_SAFE_INTEGER) throw new Error(`Invalid page: ${page}`);
};

const loadListingPage = async (
  client: Client, page: number, candidates: string[],
  loadPage: (targetPage: number) => Promise<VideoListResult>,
): Promise<VideoListResult> => {
  let lastError: Error | undefined;
  for (const candidate of Array.from(new Set(candidates))) {
    try {
      const response = await client.get(candidate);
      const result = buildListResult(page, response.body, loadPage);
      if (result.videos.length > 0) return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`Failed to load page ${page}`);
};

const dashboard = (client: Client) => async ({ page = 1 }: { page?: number } = {}): Promise<VideoListResult> => {
  assertPage(page);
  const c = page === 1 ? ['/'] : [`/?p=${page - 1}`, `/?p=${page}`];
  return loadListingPage(client, page, c, (tp) => dashboard(client)({ page: tp }));
};

const fresh = (client: Client) => async ({ page = 1 }: { page?: number } = {}): Promise<VideoListResult> => {
  assertPage(page);
  const c = page === 1 ? ['/new', '/new/1'] : [`/new/${page}`];
  return loadListingPage(client, page, c, (tp) => fresh(client)({ page: tp }));
};

const verified = (client: Client) => async ({ page = 1 }: { page?: number } = {}): Promise<VideoListResult> => {
  assertPage(page);
  const c = page === 1 ? ['/verified/videos', '/verified/videos/1'] : [`/verified/videos/${page}`];
  return loadListingPage(client, page, c, (tp) => verified(client)({ page: tp }));
};

const best = (client: Client) => async ({ year, month, page = 1 }: BestOptions = {}): Promise<VideoListResult> => {
  assertPage(page);
  const now = new Date();
  const by = String(year ?? now.getFullYear());
  const bm = String(month ?? now.getMonth() + 1).padStart(2, '0');
  const period = `${by}-${bm}`;
  const def = year === undefined && month === undefined;
  const c = page === 1 ? (def ? ['/best', `/best/${period}`, `/best/${period}/1`] : [`/best/${period}`, `/best/${period}/1`]) : [`/best/${period}/${page}`, `/best/${period}/${page - 1}`];
  return loadListingPage(client, page, c, (tp) => best(client)({ year: by, month: bm, page: tp }));
};

const search = (client: Client) => async ({ page = 1, k = '', sort = 'relevance', durf = 'allduration', datef = 'all', quality = 'all' }: SearchOptions = {}): Promise<VideoListResult> => {
  assertPage(page);
  const opts: SearchOptions = { k, sort, durf, datef, quality };
  const make = (pv: number | undefined) => {
    const p = new URLSearchParams();
    if (pv !== undefined) p.set('p', String(pv));
    if (k) { p.set('k', k); p.set('sort', sort); p.set('durf', durf); p.set('datef', datef); p.set('quality', quality); }
    const q = p.toString();
    return q ? `/?${q}` : page === 1 ? '/' : `/?p=${pv ?? page - 1}`;
  };
  const c = page === 1 ? [make(undefined)] : [make(page - 1), make(page)];
  return loadListingPage(client, page, c, (tp) => search(client)({ ...opts, page: tp }));
};

export const createListings = (client: Client) => ({ dashboard: dashboard(client), fresh: fresh(client), verified: verified(client), best: best(client), search: search(client) });
