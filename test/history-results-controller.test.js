import test from "node:test";
import assert from "node:assert/strict";
import { createHistoryResultsController } from "../src/features/history-results/ui/results-controller.js";

function createHarness({
  currentResults = [],
  currentTotal = 0,
  selectedIds = [],
  requestedLimit = 10
} = {}) {
  const renderCalls = [];
  const appState = {
    currentResults,
    currentTotal,
    lastCheckedIndex: null,
    selectedIds: new Set(selectedIds)
  };
  const elements = {
    loadMore: {
      hidden: true,
      textContent: ""
    },
    resultCount: {},
    results: {},
    resultTemplate: {},
    selectedCount: {
      textContent: ""
    },
    selectionActions: [
      { hidden: true },
      { hidden: true }
    ]
  };
  const controller = createHistoryResultsController({
    appState,
    elements,
    getDateFormat: () => "iso",
    getSearchText: () => "docs site:example.com",
    maxResultLimit: 50,
    requestedResultLimit: () => requestedLimit,
    services: {
      renderHistoryResults: (payload) => renderCalls.push(payload)
    }
  });

  return { appState, controller, elements, renderCalls };
}

test("renderResults stores current results and delegates to the history renderer", () => {
  const { appState, controller, elements, renderCalls } = createHarness({
    selectedIds: ["visit-1"]
  });
  const results = [{ id: "visit-1" }, { id: "visit-2" }];

  controller.renderResults(results, 12);

  assert.equal(appState.currentResults, results);
  assert.equal(appState.currentTotal, 12);
  assert.equal(renderCalls.length, 1);
  assert.deepEqual(renderCalls[0], {
    results,
    total: 12,
    queryText: "docs site:example.com",
    selectedIds: appState.selectedIds,
    dateFormat: "iso",
    elements: {
      resultCount: elements.resultCount,
      results: elements.results,
      resultTemplate: elements.resultTemplate
    },
    getSelectionState: renderCalls[0].getSelectionState,
    onSelectionChange: renderCalls[0].onSelectionChange
  });
  assert.deepEqual(renderCalls[0].getSelectionState(), {
    selectedIds: appState.selectedIds,
    lastCheckedIndex: null
  });
  assert.equal(elements.selectedCount.textContent, "1 selected");
  assert.deepEqual(elements.selectionActions.map((action) => action.hidden), [false, false]);
  assert.equal(elements.loadMore.hidden, false);
  assert.equal(elements.loadMore.textContent, "Load 10 More");
});

test("updateLoadMoreButton hides the button when all results are shown", () => {
  const { controller, elements } = createHarness({
    currentResults: [{ id: "visit-1" }],
    currentTotal: 1
  });

  controller.updateLoadMoreButton();

  assert.equal(elements.loadMore.hidden, true);
  assert.equal(elements.loadMore.textContent, "");
});

test("applyResultSelection updates count or rerenders current results", () => {
  const { appState, controller, elements, renderCalls } = createHarness({
    currentResults: [{ id: "visit-1" }],
    currentTotal: 1
  });

  controller.applyResultSelection({
    selectedIds: new Set(["visit-1"]),
    lastCheckedIndex: 0,
    shouldRerender: false
  });

  assert.deepEqual([...appState.selectedIds], ["visit-1"]);
  assert.equal(appState.lastCheckedIndex, 0);
  assert.equal(elements.selectedCount.textContent, "1 selected");
  assert.equal(renderCalls.length, 0);

  controller.applyResultSelection({
    selectedIds: new Set(),
    lastCheckedIndex: 0,
    shouldRerender: true
  });

  assert.equal(renderCalls.length, 1);
  assert.deepEqual(renderCalls[0].results, [{ id: "visit-1" }]);
  assert.equal(renderCalls[0].total, 1);
});
