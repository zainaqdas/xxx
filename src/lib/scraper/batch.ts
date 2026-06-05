import type { DetailsInput, DetailsManyOptions, VideoDetailsBatchResult, VideoDetailsBatchItem, VideoDetailsBatchFailure } from './types';

const normalizeOptions = ({ concurrency = 4, retries = 0, retryDelayMs = 0, minDelayMs = 0 }: DetailsManyOptions = {}): Required<DetailsManyOptions> => {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error(`Invalid concurrency: ${concurrency}`);
  if (!Number.isInteger(retries) || retries < 0) throw new Error(`Invalid retries: ${retries}`);
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new Error(`Invalid retryDelayMs: ${retryDelayMs}`);
  if (!Number.isFinite(minDelayMs) || minDelayMs < 0) throw new Error(`Invalid minDelayMs: ${minDelayMs}`);
  return { concurrency, retries, retryDelayMs, minDelayMs };
};

const createStartGate = (minDelayMs: number) => {
  if (minDelayMs <= 0) return async () => {};
  let lastStartedAt: number | null = null;
  let queue = Promise.resolve();
  return async () => {
    let release!: () => void;
    const currentTurn = new Promise<void>((r) => { release = r; });
    const previousTurn = queue;
    queue = currentTurn;
    await previousTurn;
    if (lastStartedAt !== null) { const wait = Math.max(0, lastStartedAt + minDelayMs - Date.now()); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); }
    lastStartedAt = Date.now();
    release();
  };
};

export const createBatch = (client: unknown, detailsFn: (input: DetailsInput) => Promise<unknown>) => ({
  detailsMany: async (inputs: DetailsInput[], options: DetailsManyOptions = {}): Promise<VideoDetailsBatchResult> => {
    const normalizedInputs = inputs.map(({ url }) => ({ url }));
    if (normalizedInputs.length === 0) return { items: [], successes: [], failures: [] };
    const { concurrency, retries, retryDelayMs, minDelayMs } = normalizeOptions(options);
    const reserveStart = createStartGate(minDelayMs);
    const items = new Array<VideoDetailsBatchItem>(normalizedInputs.length);
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= normalizedInputs.length) return;
        const input = normalizedInputs[index];
        await reserveStart();
        try {
          let attempt = 0;
          while (true) {
            try { const value = await detailsFn(input); items[index] = { input, ok: true, value: value as any }; break; }
            catch (error) { if (attempt >= retries) throw error; attempt += 1; await new Promise((r) => setTimeout(r, retryDelayMs)); }
          }
        } catch (error) {
          items[index] = { input, ok: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, normalizedInputs.length) }, () => worker()));

    const failures = items.filter((item): item is VideoDetailsBatchFailure => !item.ok);
    const successes = items.flatMap((item) => item.ok ? [(item as any).value] : []);
    return { items, successes, failures };
  },
});
