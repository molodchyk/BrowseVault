import { searchVisitRecords } from "../core/search-index.js";

export const DEFAULT_SEARCH_WORKER_MIN_VISITS = 2000;
export const DEFAULT_SEARCH_WORKER_TIMEOUT_MS = 30000;

function defaultWorkerFactory() {
  if (typeof Worker !== "function") {
    return null;
  }

  return new Worker(new URL("../worker/search-worker.js", import.meta.url), {
    type: "module"
  });
}

function cloneableSearchOptions(options) {
  const cloned = { ...options };
  delete cloned.scheduler;
  return cloned;
}

function addWorkerListener(worker, type, listener) {
  if (typeof worker.addEventListener === "function") {
    worker.addEventListener(type, listener);
    return;
  }

  worker[`on${type}`] = listener;
}

function createWorkerRequestRunner({ timeoutMs, workerFactory }) {
  let nextId = 1;
  let worker = null;
  let unavailable = false;
  const pending = new Map();

  function rejectPending(error) {
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    pending.clear();
  }

  function ensureWorker() {
    if (unavailable) {
      return null;
    }

    if (worker) {
      return worker;
    }

    try {
      worker = workerFactory();
    } catch {
      unavailable = true;
      return null;
    }

    if (!worker) {
      unavailable = true;
      return null;
    }

    addWorkerListener(worker, "message", (event) => {
      const message = event.data || {};
      const request = pending.get(message.id);
      if (!request) {
        return;
      }

      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.ok) {
        request.resolve(message.result);
      } else {
        request.reject(new Error(message.error || "Search worker failed."));
      }
    });

    const handleWorkerFailure = () => {
      unavailable = true;
      rejectPending(new Error("Search worker failed."));
      worker?.terminate?.();
      worker = null;
    };
    addWorkerListener(worker, "error", handleWorkerFailure);
    addWorkerListener(worker, "messageerror", handleWorkerFailure);
    return worker;
  }

  return function runWorkerSearch(visits, input, options) {
    const currentWorker = ensureWorker();
    if (!currentWorker) {
      return null;
    }

    const id = String(nextId);
    nextId += 1;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Search worker timed out."));
      }, timeoutMs);
      pending.set(id, { reject, resolve, timeout });

      try {
        currentWorker.postMessage({
          id,
          input,
          options: cloneableSearchOptions(options),
          visits
        });
      } catch (error) {
        clearTimeout(timeout);
        pending.delete(id);
        reject(error);
      }
    });
  };
}

export function createWorkerBackedHistorySearch({
  defaultLimit = 500,
  getSearchableVisits,
  minWorkerVisits = DEFAULT_SEARCH_WORKER_MIN_VISITS,
  searchRecords = searchVisitRecords,
  timeoutMs = DEFAULT_SEARCH_WORKER_TIMEOUT_MS,
  workerFactory = defaultWorkerFactory
}) {
  const runWorkerSearch = createWorkerRequestRunner({ timeoutMs, workerFactory });

  return async function workerBackedSearchVisits(input = "", options = {}) {
    const visits = await getSearchableVisits();
    const searchOptions = {
      ...options,
      defaultLimit
    };

    if (visits.length >= minWorkerVisits) {
      try {
        const workerResult = await runWorkerSearch(visits, input, searchOptions);
        if (workerResult) {
          return workerResult;
        }
      } catch {
        // The in-page search path is already chunked and preserves behavior when workers are unavailable.
      }
    }

    return searchRecords(visits, input, searchOptions);
  };
}
