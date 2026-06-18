import test from "node:test";
import assert from "node:assert/strict";
import { handleSearchWorkerMessage } from "../../../src/features/history-results/worker/search-worker.js";

test("handleSearchWorkerMessage posts successful search results", async () => {
  const messages = [];
  await handleSearchWorkerMessage(
    {
      id: "request-1",
      input: "docs",
      options: { limit: 1 },
      visits: [{ id: "visit-1" }]
    },
    (message) => messages.push(message),
    async (visits, input, options) => ({
      query: { terms: [input] },
      results: visits.slice(0, options.limit),
      total: visits.length
    })
  );

  assert.deepEqual(messages, [
    {
      id: "request-1",
      ok: true,
      result: {
        query: { terms: ["docs"] },
        results: [{ id: "visit-1" }],
        total: 1
      }
    }
  ]);
});

test("handleSearchWorkerMessage posts search errors", async () => {
  const messages = [];
  await handleSearchWorkerMessage(
    { id: "request-2" },
    (message) => messages.push(message),
    async () => {
      throw new Error("search failed");
    }
  );

  assert.deepEqual(messages, [
    {
      id: "request-2",
      ok: false,
      error: "search failed"
    }
  ]);
});
