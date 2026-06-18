import test from "node:test";
import assert from "node:assert/strict";
import { createWorkerBackedHistorySearch } from "../../../src/features/history-results/ui/search-worker-client.js";

function syntheticVisit(index) {
  const title = `History ${index}`;
  const url = `https://docs.example.com/history/${index}`;
  return {
    id: `visit-${index}`,
    title,
    normalizedTitle: title.toLowerCase(),
    url,
    normalizedUrl: url.toLowerCase(),
    domain: "docs.example.com",
    visitCount: 1,
    visitTime: Date.parse("2026-06-17T12:00:00.000Z") - index,
    transition: "link"
  };
}

function createFakeWorker({ onPostMessage }) {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    postMessage(message) {
      onPostMessage(message, listeners);
    },
    terminate() {}
  };
}

test("worker-backed search sends large vault scans to a module worker", async () => {
  const visits = [syntheticVisit(0), syntheticVisit(1), syntheticVisit(2)];
  const posted = [];
  const searchVisits = createWorkerBackedHistorySearch({
    getSearchableVisits: async () => visits,
    minWorkerVisits: 2,
    searchRecords: async () => {
      throw new Error("fallback should not run");
    },
    workerFactory: () => createFakeWorker({
      onPostMessage(message, listeners) {
        posted.push(message);
        listeners.get("message")({
          data: {
            id: message.id,
            ok: true,
            result: {
              query: { terms: [] },
              results: [message.visits[0]],
              total: message.visits.length
            }
          }
        });
      }
    })
  });

  const result = await searchVisits("history", {
    limit: 1,
    scheduler: async () => {
      throw new Error("scheduler should not be cloned into worker message");
    },
    sortOrder: "newest"
  });

  assert.equal(result.total, 3);
  assert.deepEqual(result.results.map((visit) => visit.id), ["visit-0"]);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].input, "history");
  assert.equal(posted[0].options.limit, 1);
  assert.equal(posted[0].options.defaultLimit, 500);
  assert.equal(posted[0].options.sortOrder, "newest");
  assert.equal(Object.hasOwn(posted[0].options, "scheduler"), false);
});

test("worker-backed search uses in-page chunked search below the worker threshold", async () => {
  const visits = [syntheticVisit(0)];
  const fallbackCalls = [];
  const searchVisits = createWorkerBackedHistorySearch({
    getSearchableVisits: async () => visits,
    minWorkerVisits: 2,
    searchRecords: async (records, input, options) => {
      fallbackCalls.push({ input, options, records });
      return { query: { terms: [] }, results: records, total: records.length };
    },
    workerFactory: () => {
      throw new Error("worker should not be created");
    }
  });

  const result = await searchVisits("history", { limit: 10 });

  assert.equal(result.total, 1);
  assert.equal(fallbackCalls.length, 1);
  assert.equal(fallbackCalls[0].input, "history");
  assert.equal(fallbackCalls[0].options.limit, 10);
  assert.equal(fallbackCalls[0].options.defaultLimit, 500);
  assert.deepEqual(fallbackCalls[0].records, visits);
});

test("worker-backed search falls back when worker posting fails", async () => {
  const visits = [syntheticVisit(0), syntheticVisit(1), syntheticVisit(2)];
  let fallbackRan = false;
  const searchVisits = createWorkerBackedHistorySearch({
    getSearchableVisits: async () => visits,
    minWorkerVisits: 2,
    searchRecords: async (records, input, options) => {
      fallbackRan = true;
      return { query: { terms: [input] }, results: records.slice(0, options.limit), total: records.length };
    },
    workerFactory: () => createFakeWorker({
      onPostMessage() {
        throw new Error("structured clone failed");
      }
    })
  });

  const result = await searchVisits("history", { limit: 2 });

  assert.equal(fallbackRan, true);
  assert.equal(result.total, 3);
  assert.deepEqual(result.results.map((visit) => visit.id), ["visit-0", "visit-1"]);
});

test("worker-backed search aborts active worker requests without falling back", async () => {
  const visits = [syntheticVisit(0), syntheticVisit(1), syntheticVisit(2)];
  const controller = new AbortController();
  let fallbackRan = false;
  let markPosted;
  const posted = new Promise((resolve) => {
    markPosted = resolve;
  });
  let terminated = false;
  const searchVisits = createWorkerBackedHistorySearch({
    getSearchableVisits: async () => visits,
    minWorkerVisits: 2,
    searchRecords: async () => {
      fallbackRan = true;
      return { query: { terms: [] }, results: [], total: 0 };
    },
    workerFactory: () => ({
      addEventListener() {},
      postMessage() {
        markPosted();
      },
      terminate() {
        terminated = true;
      }
    })
  });

  const searchPromise = searchVisits("history", {
    limit: 2,
    signal: controller.signal
  });
  await posted;
  controller.abort();

  await assert.rejects(searchPromise, { name: "AbortError", message: "Search canceled." });
  assert.equal(terminated, true);
  assert.equal(fallbackRan, false);
});
