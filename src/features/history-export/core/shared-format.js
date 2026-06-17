export const DEFAULT_CSV_CHUNK_SIZE = 1000;
export const DEFAULT_HTML_CHUNK_SIZE = 500;

export function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function normalizeChunkSize(value, defaultSize = DEFAULT_CSV_CHUNK_SIZE) {
  const chunkSize = Number(value || defaultSize);
  return Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : defaultSize;
}

export function dateFromTimestamp(timestamp) {
  const date = new Date(Number(timestamp));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isoDateString(timestamp) {
  return dateFromTimestamp(timestamp)?.toISOString() ?? "";
}

export function localDateTime(timestamp) {
  return dateFromTimestamp(timestamp)?.toLocaleString() ?? "";
}
