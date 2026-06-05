export type VideoProfile = {
  name: string;
  url: string;
};

export type VideoSummary = {
  url: string;
  videoId: string;
  title: string;
  duration: string;
  durationSeconds: number;
  thumbnailUrl: string;
  profile: VideoProfile;
  watchCount: number;
};

export type Pagination = {
  page: number;
  pages: number[];
};

export type VideoListResult = {
  videos: VideoSummary[];
  pagination: Pagination;
  refresh: () => Promise<VideoListResult>;
  hasNext: () => boolean;
  next: () => Promise<VideoListResult>;
  hasPrevious: () => boolean;
  previous: () => Promise<VideoListResult>;
};

export type DetailsInput = { url: string };

export type DetailsManyOptions = {
  concurrency?: number;
  retries?: number;
  retryDelayMs?: number;
  minDelayMs?: number;
};

export type VideoFiles = {
  low: string;
  high: string;
  HLS: string;
  thumb: string;
  thumb69: string;
  thumbSlide: string;
  thumbSlideBig: string;
};

export type VideoDetailsResult = {
  title: string;
  url: string;
  videoId: string;
  embedUrl: string;
  duration: string;
  durationSeconds: number;
  thumbnailUrls: string[];
  watchCount: number;
  voteCount: number;
  ratingPercent: number;
  videoType: string;
  videoWidth: string;
  videoHeight: string;
  uploadDate: string;
  description: string;
  contentUrl: string;
  tags: string[];
  categories: string[];
  profile: VideoProfile;
  files: VideoFiles;
};

export type VideoDetailsBatchSuccess = { input: DetailsInput; ok: true; value: VideoDetailsResult };
export type VideoDetailsBatchFailure = { input: DetailsInput; ok: false; error: Error };
export type VideoDetailsBatchItem = VideoDetailsBatchSuccess | VideoDetailsBatchFailure;
export type VideoDetailsBatchResult = { items: VideoDetailsBatchItem[]; successes: VideoDetailsResult[]; failures: VideoDetailsBatchFailure[] };

export type SearchOptions = {
  page?: number;
  k?: string;
  sort?: 'relevance' | 'uploaddate' | 'rating' | 'length';
  durf?: 'allduration' | '1-3min' | '3-10min' | '10-30min' | '30min+';
  datef?: 'all' | 'today' | 'week' | 'month';
  quality?: 'all' | 'hd' | '4k';
};

export type BestOptions = { year?: string | number; month?: string | number; page?: number };
export type PageOptions = { page?: number };
export type TransportResponse = { statusCode?: number; body: string; url: string };
