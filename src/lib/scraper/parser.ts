import { load, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { BASE_URL, resolveUrl } from './client';
import type { VideoSummary, VideoListResult } from './types';

export const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

export const decodeEscapedValue = (value: string): string =>
  value.replace(/\\u002f/gi, '/').replace(/\\\//g, '/').replace(/\\u0026|&amp;/gi, '&').trim();

export const parseNumberWithSuffix = (value: string): number => {
  const match = normalizeText(value).replace(/,/g, '').match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i);
  if (!match) return 0;
  const base = Number.parseFloat(match[1]);
  const suffix = match[2]?.toUpperCase();
  const multiplier = suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1;
  return Math.round(base * multiplier);
};

export const parseDurationSeconds = (value: string): number => {
  const normalized = normalizeText(value);
  if (!normalized) return 0;
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  const isoMatch = normalized.match(/^PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?$/i);
  if (isoMatch) {
    return (Number.parseInt(isoMatch[1] || '0', 10) * 3600) +
           (Number.parseInt(isoMatch[2] || '0', 10) * 60) +
           Number.parseInt(isoMatch[3] || '0', 10);
  }
  const units = Array.from(normalized.matchAll(/(\d+)\s*(h(?:ours?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)/gi));
  if (units.length === 0) return 0;
  return units.reduce((total, match) => {
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith('h')) return total + amount * 3600;
    if (unit.startsWith('m')) return total + amount * 60;
    return total + amount;
  }, 0);
};

export const parseVideoId = (value: string): string => {
  const path = (() => { try { return new URL(value).pathname; } catch { return value; } })();
  return path.split('/').filter(Boolean).find((item) => item.startsWith('video')) || '';
};

export const getEmbedUrl = (videoId: string): string => `https://www.xvideos.com/embedframe/${videoId}`;

export const parseStringArray = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(values.filter((item): item is string => typeof item === 'string').map((item) => normalizeText(item)).filter(Boolean)));
};

export const parseViews = ($video: ReturnType<CheerioAPI>): string => {
  const count = normalizeText($video.find('.video-metadata .views-count').first().text());
  if (count) return `${count} Views`;
  const metadata = normalizeText($video.find('.video-metadata, p.metadata').first().text());
  const match = metadata.match(/([0-9]+(?:[.,][0-9]+)?[KMB]?)(?=\s*Views?\b)/i);
  return match ? `${match[1]} Views` : '';
};

export const parsePages = ($: CheerioAPI): number[] =>
  $('.pagination a').map((_, el) => Number.parseInt(normalizeText($(el).text()), 10)).get().filter((v): v is number => Number.isFinite(v));

export const uniqueSortedPages = (pages: number[], currentPage: number): number[] =>
  Array.from(new Set([...pages, currentPage])).sort((a, b) => a - b);

export const parseVideo = ($: CheerioAPI, element: Element): VideoSummary | null => {
  const $video = $(element);
  const link = $video.find('.thumb-link[href*="/video"], .thumb > a[href*="/video"]').first();
  const path = link.attr('href');
  if (!path) return null;

  const titleLink = $video.find('.thumb-under .title a, p.title > a, p:not(.metadata) a').first();
  const titleNode = titleLink.clone();
  titleNode.find('.duration').remove();
  const profileLink = $video.find('.video-metadata a.name, .video-metadata a[href], p.metadata a[href]').first();
  const profileName = normalizeText(profileLink.find('.name').first().text()) || normalizeText(profileLink.text());
  const duration = normalizeText($video.find('.video-metadata .duration, .duration-container .duration, p.metadata .duration, p.title .duration').first().text());
  const thumb = normalizeText(link.find('img').first().attr('data-src') || link.find('img').first().attr('src') || link.find('img').first().attr('data-srcset')?.split(/\s|,/)[0] || '');

  return {
    url: resolveUrl(path),
    videoId: parseVideoId(path),
    title: normalizeText(titleLink.attr('title')) || normalizeText(titleNode.text()),
    duration,
    durationSeconds: parseDurationSeconds(duration),
    thumbnailUrl: thumb ? resolveUrl(thumb) : '',
    profile: { name: profileName, url: resolveUrl(profileLink.attr('href')) },
    watchCount: parseNumberWithSuffix(parseViews($video)),
  };
};

export const buildListResult = (
  page: number, html: string,
  loadPage: (targetPage: number) => Promise<VideoListResult>,
): VideoListResult => {
  const $ = load(html);
  const videos = $('.thumb-block[data-id], .frame-block.thumb-block[data-id], .thumb-block.video[data-video]')
    .map((_, el) => parseVideo($, el)).get().filter((v): v is VideoSummary => v !== null);
  const pages = uniqueSortedPages(parsePages($), page);
  const minPage = Math.min(...pages);
  const maxPage = Math.max(...pages);
  return {
    videos, pagination: { page, pages },
    refresh: () => loadPage(page),
    hasNext: () => page < maxPage,
    next: () => loadPage(page + 1),
    hasPrevious: () => page > minPage && page > 1,
    previous: () => loadPage(page - 1),
  };
};

// Detail parsing
export const findVideoObject = (input: unknown): Record<string, unknown> | null => {
  if (!input || typeof input !== 'object') return null;
  if (Array.isArray(input)) { for (const item of input) { const f = findVideoObject(item); if (f) return f; } return null; }
  const item = input as Record<string, unknown>;
  const type = item['@type'];
  if (type === 'VideoObject' || (Array.isArray(type) && type.some((e) => e === 'VideoObject'))) return item;
  return findVideoObject(item['@graph']) || findVideoObject(item.itemListElement) || findVideoObject(item.mainEntity) || null;
};

export const parseJsonLdVideoObject = ($: CheerioAPI): Record<string, unknown> => {
  for (const script of $('script[type="application/ld+json"]').map((_, el) => normalizeText($(el).text())).get().filter(Boolean)) {
    try { const parsed = JSON.parse(script); const vo = findVideoObject(parsed); if (vo && Object.keys(vo).length > 0) return vo; } catch { /* skip */ }
  }
  return {};
};

export const readMeta = ($: CheerioAPI, property: string): string =>
  normalizeText($(`meta[property="${property}"]`).attr('content'));

export const readDetailViews = ($: CheerioAPI, html: string): string => {
  const dv = normalizeText($('#v-views strong.mobile-hide').first().text()) ||
    normalizeText($('#v-views strong').first().text()) ||
    normalizeText($('#nb-views-number').text()) ||
    normalizeText($('.video-metadata .views').first().text()) ||
    normalizeText($('.video-infos .views').first().text());
  if (dv) return dv;
  const m = html.match(/id="v-views"[\s\S]*?<strong[^>]*>([^<]+)<\/strong>/i);
  return normalizeText(m?.[1]);
};

export const extractFirstMatch = (html: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) { const m = html.match(pattern); if (m?.[1]) return decodeEscapedValue(m[1]); }
  return '';
};

export const extractFiles = (html: string, image: string) => ({
  low: extractFirstMatch(html, [/html5player\.setVideoUrlLow\('([^']+)'/i, /html5player\.setVideoUrlLow\("([^"]+)"/i, /"videoUrlLow":"([^"]+)"/i, /"video_url_low":"([^"]+)"/i]),
  high: extractFirstMatch(html, [/html5player\.setVideoUrlHigh\('([^']+)'/i, /html5player\.setVideoUrlHigh\("([^"]+)"/i, /"videoUrlHigh":"([^"]+)"/i, /"video_url_high":"([^"]+)"/i]),
  HLS: (() => { const h = extractFirstMatch(html, [/html5player\.setVideoHLS\('([^']+)'/i, /html5player\.setVideoHLS\("([^"]+)"/i, /"videoHLS":"([^"]+)"/i, /"video_hls":"([^"]+)"/i, /((?:https:)?\/\/[^"' ]+\.m3u8[^"' ]*)/i]); return h.startsWith('//') ? `https:${h}` : h; })(),
  thumb: extractFirstMatch(html, [/html5player\.setThumbUrl\('([^']+)'/i, /html5player\.setThumbUrl\("([^"]+)"/i, /"thumbUrl":"([^"]+)"/i]) || image,
  thumb69: extractFirstMatch(html, [/html5player\.setThumbUrl169\('([^']+)'/i, /html5player\.setThumbUrl169\("([^"]+)"/i, /"thumbUrl169":"([^"]+)"/i]),
  thumbSlide: extractFirstMatch(html, [/html5player\.setThumbSlide\('([^']+)'/i, /html5player\.setThumbSlide\("([^"]+)"/i, /"thumbSlide":"([^"]+)"/i]),
  thumbSlideBig: extractFirstMatch(html, [/html5player\.setThumbSlideBig\('([^']+)'/i, /html5player\.setThumbSlideBig\("([^"]+)"/i, /"thumbSlideBig":"([^"]+)"/i]),
});

export const parseEngagement = ($: CheerioAPI, html: string) => {
  const vt = normalizeText($('[class*="rating"], [class*="vote"]').first().text()) || html;
  const voteMatch = vt.match(/([0-9]+(?:[.,][0-9]+)?\s*[KMB]?)\s*votes?/i);
  const ratingMatch = vt.match(/([0-9]+(?:\.[0-9]+)?)\s*%/i);
  return {
    voteCount: voteMatch ? parseNumberWithSuffix(voteMatch[1]) : 0,
    ratingPercent: ratingMatch ? Number.parseFloat(ratingMatch[1]) : 0,
  };
};

export const parseTaxonomy = ($: CheerioAPI, selector: string): string[] =>
  Array.from(new Set($(selector).map((_, el) => normalizeText($(el).text())).get().filter(Boolean)));

export const parseWatchCount = (jsonLd: Record<string, unknown>, views: string): number => {
  const candidates = Array.isArray(jsonLd.interactionStatistic) ? jsonLd.interactionStatistic : jsonLd.interactionStatistic ? [jsonLd.interactionStatistic] : [];
  for (const c of candidates) {
    if (c && typeof c === 'object') {
      const v = (c as Record<string, unknown>).userInteractionCount;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      const p = parseNumberWithSuffix(typeof v === 'string' ? v : '');
      if (p > 0) return p;
    }
  }
  return parseNumberWithSuffix(views);
};

export const parseDetailProfile = ($: CheerioAPI) => {
  const link = $('a[href*="/profile"], a[href*="/channels/"], a[href*="/users/"]').first();
  return { name: normalizeText(link.text()), url: resolveUrl(link.attr('href')) };
};
