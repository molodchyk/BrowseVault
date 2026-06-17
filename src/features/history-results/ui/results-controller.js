import {
  loadMoreState,
  selectedCountLabel
} from "../core/results.js";
import { renderHistoryResults } from "./render-results.js";

export function createHistoryResultsController({
  appState,
  elements,
  getDateFormat,
  getSearchText,
  maxResultLimit,
  requestedResultLimit,
  services = {}
}) {
  const renderHistoryResultsImpl = services.renderHistoryResults || renderHistoryResults;

  function updateSelectionCount() {
    elements.selectedCount.textContent = selectedCountLabel(appState.selectedIds.size);

    const hasSelection = appState.selectedIds.size > 0;
    for (const action of elements.selectionActions) {
      action.hidden = !hasSelection;
    }
  }

  function updateLoadMoreButton() {
    const shown = appState.currentResults.length;
    const state = loadMoreState({
      total: appState.currentTotal,
      shown,
      step: requestedResultLimit(),
      max: maxResultLimit
    });

    elements.loadMore.hidden = !state.canLoadMore;
    if (state.canLoadMore) {
      elements.loadMore.textContent = `Load ${state.nextCount} More`;
    } else {
      elements.loadMore.textContent = "";
    }

    elements.loadAll.hidden = !state.canLoadMore;
    if (state.canLoadMore) {
      elements.loadAll.textContent = appState.currentTotal > maxResultLimit
        ? `Show First ${maxResultLimit.toLocaleString()}`
        : "Show All";
    } else {
      elements.loadAll.textContent = "";
    }
  }

  function applyResultSelection({ selectedIds: nextSelectedIds, lastCheckedIndex: nextLastCheckedIndex, shouldRerender }) {
    appState.selectedIds = nextSelectedIds;
    appState.lastCheckedIndex = nextLastCheckedIndex;

    if (shouldRerender) {
      renderResults(appState.currentResults, appState.currentTotal);
      return;
    }

    updateSelectionCount();
  }

  function renderResults(results, total) {
    appState.currentResults = results;
    appState.currentTotal = total;

    renderHistoryResultsImpl({
      results,
      total,
      queryText: getSearchText(),
      selectedIds: appState.selectedIds,
      dateFormat: getDateFormat(),
      elements: {
        resultCount: elements.resultCount,
        results: elements.results,
        resultTemplate: elements.resultTemplate
      },
      getSelectionState: () => ({
        selectedIds: appState.selectedIds,
        lastCheckedIndex: appState.lastCheckedIndex
      }),
      onSelectionChange: applyResultSelection
    });

    updateSelectionCount();
    updateLoadMoreButton();
  }

  return {
    applyResultSelection,
    renderResults,
    updateLoadMoreButton,
    updateSelectionCount
  };
}
