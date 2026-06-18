import test from "node:test";
import assert from "node:assert/strict";
import { createHistorySearchActions } from "../../../src/features/history-results/ui/search-actions.js";

function createHarness({
  currentResults = [],
  currentTotal = 0,
  currentShownLimit = 0,
  requestedLimit = 10,
  requestedSortOrder = "newest",
  selectedIds = [],
  searchVisits = async () => ({ results: [], total: 0 }),
  isCurrentHistorySearchRequestId = () => true
} = {}) {
  const statusMessages = [];
  const renderCalls = [];
  const updateLoadMoreCalls = [];
  const requestIds = [];
  const appState = {
    currentResults,
    currentShownLimit,
    currentTotal,
    historySearchRequestId: 0,
    selectedIds: new Set(selectedIds)
  };

  const actions = createHistorySearchActions({
    appState,
    getSearchText: () => "docs site:example.com",
    maxResultLimit: 50,
    renderResults: (results, total) => renderCalls.push({ results, total }),
    requestedResultLimit: () => requestedLimit,
    requestedSortOrder: () => requestedSortOrder,
    searchVisits,
    services: {
      isCurrentHistorySearchRequestId,
      nextHistorySearchRequestId: (state) => {
        state.historySearchRequestId += 1;
        requestIds.push(state.historySearchRequestId);
        return state.historySearchRequestId;
      }
    },
    setStatus: (message) => statusMessages.push(message),
    updateLoadMoreButton: () => updateLoadMoreCalls.push(true)
  });

  return { actions, appState, renderCalls, requestIds, statusMessages, updateLoadMoreCalls };
}

function searchCallSummary(calls) {
  return calls.map(({ query, options }) => ({
    query,
    options: {
      limit: options.limit,
      signal: Boolean(options.signal),
      sortOrder: options.sortOrder
    }
  }));
}

test("runSearch applies requested limit, reconciles selection, and renders fresh results", async () => {
  const resultOne = { id: "visit-1" };
  const resultTwo = { id: "visit-2" };
  const searchCalls = [];
  const { actions, appState, renderCalls, statusMessages } = createHarness({
    requestedSortOrder: "oldest",
    selectedIds: ["visit-1", "stale-visit"],
    searchVisits: async (query, options) => {
      searchCalls.push({ query, options });
      return {
        results: [resultOne, resultTwo],
        total: 12
      };
    }
  });

  await actions.runSearch();

  assert.deepEqual(searchCallSummary(searchCalls), [
    {
      query: "docs site:example.com",
      options: { limit: 10, signal: true, sortOrder: "oldest" }
    }
  ]);
  assert.equal(appState.currentShownLimit, 10);
  assert.deepEqual([...appState.selectedIds], ["visit-1"]);
  assert.deepEqual(renderCalls, [
    {
      results: [resultOne, resultTwo],
      total: 12
    }
  ]);
  assert.deepEqual(statusMessages, ["Searching local vault", "Ready"]);
});

test("runSearch aborts the previous active search", async () => {
  let resolveFirst;
  const searchCalls = [];
  const { actions, renderCalls, statusMessages } = createHarness({
    isCurrentHistorySearchRequestId: (state, id) => state.historySearchRequestId === id,
    searchVisits: async (query, options) => {
      searchCalls.push({ query, options });
      if (searchCalls.length === 1) {
        return new Promise((resolve) => {
          resolveFirst = () => resolve({ results: [{ id: "stale" }], total: 1 });
        });
      }

      return { results: [{ id: "fresh" }], total: 1 };
    }
  });

  const firstRun = actions.runSearch();
  const secondRun = actions.runSearch();
  assert.equal(searchCalls[0].options.signal.aborted, true);
  await secondRun;
  resolveFirst();
  await firstRun;

  assert.deepEqual(renderCalls, [
    {
      results: [{ id: "fresh" }],
      total: 1
    }
  ]);
  assert.deepEqual(statusMessages, ["Searching local vault", "Searching local vault", "Ready"]);
});

test("runSearch ignores stale responses and reports active errors", async () => {
  const stale = createHarness({
    isCurrentHistorySearchRequestId: () => false,
    searchVisits: async () => ({
      results: [{ id: "visit-1" }],
      total: 1
    })
  });

  await stale.actions.runSearch();

  assert.deepEqual(stale.renderCalls, []);
  assert.deepEqual(stale.statusMessages, ["Searching local vault"]);

  const failed = createHarness({
    searchVisits: async () => {
      throw new Error("Search failed");
    }
  });

  await failed.actions.runSearch();

  assert.deepEqual(failed.statusMessages, ["Searching local vault", "Search failed"]);
});

test("loadMoreResults reports all-visible state without searching", async () => {
  const { actions, statusMessages, updateLoadMoreCalls } = createHarness({
    currentResults: [{ id: "visit-1" }],
    currentTotal: 1,
    searchVisits: async () => {
      throw new Error("should not search");
    }
  });

  await actions.loadMoreResults();

  assert.deepEqual(statusMessages, ["All loaded results are visible"]);
  assert.deepEqual(updateLoadMoreCalls, [true]);
});

test("loadMoreResults expands visible limit, renders fresh results, and ignores stale responses", async () => {
  const searchCalls = [];
  const fresh = createHarness({
    currentResults: [{ id: "visit-1" }, { id: "visit-2" }],
    currentTotal: 20,
    requestedLimit: 7,
    searchVisits: async (query, options) => {
      searchCalls.push({ query, options });
      return {
        results: [{ id: "visit-1" }, { id: "visit-2" }, { id: "visit-3" }],
        total: 20
      };
    }
  });

  await fresh.actions.loadMoreResults();

  assert.equal(fresh.appState.currentShownLimit, 9);
  assert.deepEqual(searchCallSummary(searchCalls), [
    {
      query: "docs site:example.com",
      options: { limit: 9, signal: true, sortOrder: "newest" }
    }
  ]);
  assert.deepEqual(fresh.renderCalls, [
    {
      results: [{ id: "visit-1" }, { id: "visit-2" }, { id: "visit-3" }],
      total: 20
    }
  ]);
  assert.deepEqual(fresh.statusMessages, ["Loading more results", "Showing 3 of 20 results"]);

  const stale = createHarness({
    currentResults: [{ id: "visit-1" }],
    currentTotal: 20,
    isCurrentHistorySearchRequestId: () => false,
    searchVisits: async () => ({
      results: [{ id: "visit-1" }, { id: "visit-2" }],
      total: 20
    })
  });

  await stale.actions.loadMoreResults();

  assert.deepEqual(stale.renderCalls, []);
  assert.deepEqual(stale.statusMessages, ["Loading more results"]);
});

test("loadAllResults reports all-visible state without searching", async () => {
  const { actions, statusMessages, updateLoadMoreCalls } = createHarness({
    currentResults: [{ id: "visit-1" }, { id: "visit-2" }],
    currentTotal: 2,
    searchVisits: async () => {
      throw new Error("should not search");
    }
  });

  await actions.loadAllResults();

  assert.deepEqual(statusMessages, ["All loaded results are visible"]);
  assert.deepEqual(updateLoadMoreCalls, [true]);
});

test("loadAllResults expands current results to the total match count", async () => {
  const searchCalls = [];
  const { actions, appState, renderCalls, statusMessages } = createHarness({
    currentResults: [{ id: "visit-1" }],
    currentTotal: 12,
    searchVisits: async (query, options) => {
      searchCalls.push({ query, options });
      return {
        results: Array.from({ length: 12 }, (_value, index) => ({ id: `visit-${index + 1}` })),
        total: 12
      };
    }
  });

  await actions.loadAllResults();

  assert.equal(appState.currentShownLimit, 12);
  assert.deepEqual(searchCallSummary(searchCalls), [
    {
      query: "docs site:example.com",
      options: { limit: 12, signal: true, sortOrder: "newest" }
    }
  ]);
  assert.equal(renderCalls.length, 1);
  assert.equal(renderCalls[0].results.length, 12);
  assert.equal(renderCalls[0].total, 12);
  assert.deepEqual(statusMessages, ["Loading all results", "Showing all 12 results"]);
});

test("loadAllResults respects the maximum result cap and ignores stale responses", async () => {
  const searchCalls = [];
  const capped = createHarness({
    currentResults: [{ id: "visit-1" }],
    currentTotal: 120,
    searchVisits: async (query, options) => {
      searchCalls.push({ query, options });
      return {
        results: Array.from({ length: 50 }, (_value, index) => ({ id: `visit-${index + 1}` })),
        total: 120
      };
    }
  });

  await capped.actions.loadAllResults();

  assert.equal(capped.appState.currentShownLimit, 50);
  assert.deepEqual(searchCallSummary(searchCalls), [
    {
      query: "docs site:example.com",
      options: { limit: 50, signal: true, sortOrder: "newest" }
    }
  ]);
  assert.equal(capped.renderCalls.length, 1);
  assert.equal(capped.renderCalls[0].results.length, 50);
  assert.deepEqual(capped.statusMessages, ["Loading first 50 results", "Showing first 50 of 120 results"]);

  const stale = createHarness({
    currentResults: [{ id: "visit-1" }],
    currentTotal: 12,
    isCurrentHistorySearchRequestId: () => false,
    searchVisits: async () => ({
      results: [{ id: "visit-1" }, { id: "visit-2" }],
      total: 12
    })
  });

  await stale.actions.loadAllResults();

  assert.deepEqual(stale.renderCalls, []);
  assert.deepEqual(stale.statusMessages, ["Loading all results"]);
});
