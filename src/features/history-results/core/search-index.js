import { matchesVisitQuery, parseQuery } from "../../../query.js";

export const DEFAULT_SEARCH_CHUNK_SIZE = 1000;

export function yieldToEventLoop() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function normalizeLimit(value, fallback = Infinity) {
  if (value === "all") {
    return Infinity;
  }

  const normalizedFallback = Number.isFinite(Number(fallback)) && Number(fallback) > 0
    ? Number(fallback)
    : Infinity;
  const limit = Number(value ?? normalizedFallback);
  return Number.isFinite(limit) && limit > 0 ? limit : normalizedFallback;
}

function normalizeChunkSize(value) {
  const chunkSize = Number(value || DEFAULT_SEARCH_CHUNK_SIZE);
  return Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : DEFAULT_SEARCH_CHUNK_SIZE;
}

export async function searchVisitRecords(visits, input = "", options = {}) {
  const query = parseQuery(input);
  const limit = normalizeLimit(options.limit, options.defaultLimit);
  const chunkSize = normalizeChunkSize(options.chunkSize);
  const scheduler = options.scheduler || yieldToEventLoop;
  const filtered = [];

  for (let start = 0; start < visits.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, visits.length);

    for (let index = start; index < end; index += 1) {
      const visit = visits[index];
      if (matchesVisitQuery(visit, query)) {
        filtered.push(visit);
      }
    }

    if (end < visits.length) {
      await scheduler();
    }
  }

  filtered.sort((a, b) => b.visitTime - a.visitTime);

  return {
    query,
    total: filtered.length,
    results: filtered.slice(0, limit)
  };
}
