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

function normalizeSortOrder(value) {
  return value === "oldest" ? "oldest" : "newest";
}

function resultCompare(a, b, sortOrder = "newest") {
  const timeDelta = sortOrder === "oldest"
    ? a.visit.visitTime - b.visit.visitTime
    : b.visit.visitTime - a.visit.visitTime;

  return Number.isFinite(timeDelta) && timeDelta !== 0
    ? timeDelta
    : a.index - b.index;
}

function isWorseResult(a, b, sortOrder) {
  return resultCompare(a, b, sortOrder) > 0;
}

function moveResultUp(heap, index, sortOrder) {
  let current = index;
  while (current > 0) {
    const parent = Math.floor((current - 1) / 2);
    if (!isWorseResult(heap[current], heap[parent], sortOrder)) {
      return;
    }
    [heap[current], heap[parent]] = [heap[parent], heap[current]];
    current = parent;
  }
}

function moveResultDown(heap, index, sortOrder) {
  let current = index;
  while (true) {
    const left = current * 2 + 1;
    const right = left + 1;
    let worst = current;

    if (left < heap.length && isWorseResult(heap[left], heap[worst], sortOrder)) {
      worst = left;
    }
    if (right < heap.length && isWorseResult(heap[right], heap[worst], sortOrder)) {
      worst = right;
    }
    if (worst === current) {
      return;
    }

    [heap[current], heap[worst]] = [heap[worst], heap[current]];
    current = worst;
  }
}

function retainLimitedResult(heap, item, limit, sortOrder) {
  if (limit <= 0) {
    return;
  }

  if (heap.length < limit) {
    heap.push(item);
    moveResultUp(heap, heap.length - 1, sortOrder);
    return;
  }

  if (resultCompare(item, heap[0], sortOrder) < 0) {
    heap[0] = item;
    moveResultDown(heap, 0, sortOrder);
  }
}

export async function searchVisitRecords(visits, input = "", options = {}) {
  const query = parseQuery(input);
  const limit = normalizeLimit(options.limit, options.defaultLimit);
  const retainedLimit = Number.isFinite(limit) ? Math.trunc(limit) : Infinity;
  const chunkSize = normalizeChunkSize(options.chunkSize);
  const sortOrder = normalizeSortOrder(options.sortOrder);
  const scheduler = options.scheduler || yieldToEventLoop;
  const retained = [];
  let total = 0;

  for (let start = 0; start < visits.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, visits.length);

    for (let index = start; index < end; index += 1) {
      const visit = visits[index];
      if (matchesVisitQuery(visit, query)) {
        total += 1;
        const item = { visit, index };
        if (Number.isFinite(retainedLimit)) {
          retainLimitedResult(retained, item, retainedLimit, sortOrder);
        } else {
          retained.push(item);
        }
      }
    }

    if (end < visits.length) {
      await scheduler();
    }
  }

  retained.sort((left, right) => resultCompare(left, right, sortOrder));

  return {
    query,
    total,
    results: retained.map((item) => item.visit)
  };
}
