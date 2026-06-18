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
  delete cloned.signal;
  return cloned;
}

function addWorkerListener(worker, type, listener) {
  if (typeof worker.addEventListener === "function") {
    worker.addEventListener(type, listener);
    return;
  }

  worker[`on${type}`] = listener;
}

function createAbortError() {
  const error = new Error("Search canceled.");
  error.name = "AbortError";
  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function createWorkerRequestRunner({ timeoutMs, workerFactory }) {
  let nextId = 1;
  let unavailable = false;
  return function runWorkerSearch(visits, input, options) {
    if (options.signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    if (unavailable) {
      return null;
    }

    let currentWorker;
    try {
      currentWorker = workerFactory();
    } catch {
      unavailable = true;
      return null;
    }

    if (!currentWorker) {
      unavailable = true;
      return null;
    }

    const id = String(nextId);
    nextId += 1;
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeout;

      const cleanup = () => {
        clearTimeout(timeout);
        options.signal?.removeEventListener?.("abort", abortRequest);
        currentWorker.terminate?.();
      };

      const finish = (callback, value) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        callback(value);
      };

      const abortRequest = () => finish(reject, createAbortError());

      timeout = setTimeout(() => {
        finish(reject, new Error("Search worker timed out."));
      }, timeoutMs);

      addWorkerListener(currentWorker, "message", (event) => {
        const message = event.data || {};
        if (message.id !== id) {
          return;
        }

        if (message.ok) {
          finish(resolve, message.result);
        } else {
          finish(reject, new Error(message.error || "Search worker failed."));
        }
      });

      const handleWorkerFailure = () => {
        unavailable = true;
        finish(reject, new Error("Search worker failed."));
      };
      addWorkerListener(currentWorker, "error", handleWorkerFailure);
      addWorkerListener(currentWorker, "messageerror", handleWorkerFailure);

      options.signal?.addEventListener?.("abort", abortRequest, { once: true });
      if (options.signal?.aborted) {
        abortRequest();
        return;
      }

      try {
        currentWorker.postMessage({
          id,
          input,
          options: cloneableSearchOptions(options),
          visits
        });
      } catch (error) {
        finish(reject, error);
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
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        // The in-page search path is already chunked and preserves behavior when workers are unavailable.
      }
    }

    return searchRecords(visits, input, searchOptions);
  };
}
