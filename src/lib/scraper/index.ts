import { createClient } from './client';
import { createListings } from './listings';
import { createDetails } from './details';
import { createBatch } from './batch';

export type {
  VideoProfile, VideoSummary, Pagination, VideoListResult,
  DetailsInput, DetailsManyOptions, VideoFiles, VideoDetailsResult,
  VideoDetailsBatchSuccess, VideoDetailsBatchFailure, VideoDetailsBatchItem,
  VideoDetailsBatchResult, SearchOptions, BestOptions, PageOptions,
} from './types';

export const createScraper = () => {
  const client = createClient();
  const { dashboard, fresh, verified, best, search } = createListings(client);
  const { details } = createDetails(client);
  const { detailsMany } = createBatch(client, details);
  return { videos: { dashboard, fresh, verified, best, search, details, detailsMany } };
};

const xvideos = createScraper();
export default xvideos;
