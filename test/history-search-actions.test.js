import test from "node:test";
import assert from "node:assert/strict";
import { createHistorySearchActions } from "../src/features/history-results/ui/search-actions.js";

function createHarness({
  currentResults = [],
  currentTotal = 0,
  currentShownLimit = 0,
  requestedLimit = 10,
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

test("runSearch applies requested limit, reconciles selection, and renders fresh results", async () => {
  const resultOne = { id: "visit-1" };
  const resultTwo = { id: "visit-2" };
  const searchCalls = [];
  const { actions, appState, renderCalls, statusMessages } = createHarness({
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

  assert.deepEqual(searchCalls, [
    {
      query: "docs site:example.com",
      options: { limit: 10 }
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
  assert.deepEqual(searchCalls, [
    {
      query: "docs site:example.com",
      options: { limit: 9 }
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
