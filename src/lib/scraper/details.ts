import { load } from 'cheerio';
import type { Client } from './client';
import type { DetailsInput, VideoDetailsResult } from './types';
import {
  parseJsonLdVideoObject, readMeta, readDetailViews, parseWatchCount,
  parseEngagement, parseDurationSeconds, parseVideoId, parseStringArray,
  parseTaxonomy, extractFiles, getEmbedUrl, parseDetailProfile,
} from './parser';

const ALLOWED_HOST = /(?:^|\.)xvideos\.com$/;

const assertVideoUrl = (url: string): void => {
  if (!url) throw new Error('Invalid url');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid url'); }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOST.test(parsed.hostname)) throw new Error('Invalid url');
};

const details = (client: Client) => async ({ url }: DetailsInput): Promise<VideoDetailsResult> => {
  assertVideoUrl(url);
  const response = await client.get(url);
  const html = response.body;
  const $ = load(html);
  const jsonLd = parseJsonLdVideoObject($);
  const image = readMeta($, 'og:image');
  const files = extractFiles(html, image);
  const videoId = parseVideoId(url);
  const duration = readMeta($, 'og:duration');
  const engagement = parseEngagement($, html);
  const sizeMatch = html.match(/html5player\.setVideoSize\((\d+)\s*,\s*(\d+)\)/i);
  const width = readMeta($, 'og:video:width') || sizeMatch?.[1] || '';
  const height = readMeta($, 'og:video:height') || sizeMatch?.[2] || '';

  const thumbnails = (() => {
    const thumbs = parseStringArray(jsonLd.thumbnailUrl);
    return thumbs.length > 0 ? thumbs : image ? [image] : [];
  })();

  return {
    title: readMeta($, 'og:title'),
    url,
    videoId,
    embedUrl: getEmbedUrl(videoId),
    duration,
    durationSeconds: parseDurationSeconds(typeof jsonLd.duration === 'string' ? jsonLd.duration : '') || parseDurationSeconds(duration),
    thumbnailUrls: thumbnails,
    watchCount: parseWatchCount(jsonLd, readDetailViews($, html)),
    voteCount: engagement.voteCount,
    ratingPercent: engagement.ratingPercent,
    videoType: readMeta($, 'og:video:type') || readMeta($, 'og:type'),
    videoWidth: width,
    videoHeight: height,
    uploadDate: typeof jsonLd.uploadDate === 'string' ? jsonLd.uploadDate.trim() : '',
    description: typeof jsonLd.description === 'string' ? jsonLd.description.trim() : '',
    contentUrl: typeof jsonLd.contentUrl === 'string' ? jsonLd.contentUrl.trim() : '',
    tags: parseTaxonomy($, 'a[href*="/tags/"]'),
    categories: parseTaxonomy($, 'a[href*="/c/"]'),
    profile: parseDetailProfile($),
    files,
  };
};

export const createDetails = (client: Client) => ({ details: details(client) });
