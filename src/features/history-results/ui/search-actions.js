import {
  isCurrentHistorySearchRequestId,
  nextHistorySearchRequestId
} from "../../app-shell/core/state.js";
import { reconcileSelectedIds } from "../core/results.js";

const defaultServices = {
  isCurrentHistorySearchRequestId,
  nextHistorySearchRequestId,
  reconcileSelectedIds
};

export function createHistorySearchActions({
  appState,
  getSearchText,
  maxResultLimit,
  renderResults,
  requestedResultLimit,
  requestedSortOrder = () => "newest",
  searchVisits,
  services = {},
  setStatus,
  updateLoadMoreButton
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  async function runSearch() {
    const requestId = deps.nextHistorySearchRequestId(appState);
    setStatus("Searching local vault");
    appState.currentShownLimit = requestedResultLimit();
    const searchText = getSearchText();
    const limit = appState.currentShownLimit;

    try {
      const { results, total } = await searchVisits(searchText, {
        limit,
        sortOrder: requestedSortOrder()
      });

      if (!deps.isCurrentHistorySearchRequestId(appState, requestId)) {
        return;
      }

      appState.selectedIds = deps.reconcileSelectedIds(appState.selectedIds, results);
      renderResults(results, total);
      setStatus("Ready");
    } catch (error) {
      if (deps.isCurrentHistorySearchRequestId(appState, requestId)) {
        setStatus(error.message);
      }
    }
  }

  async function loadMoreResults() {
    if (appState.currentResults.length >= appState.currentTotal || appState.currentResults.length >= maxResultLimit) {
      setStatus("All loaded results are visible");
      updateLoadMoreButton();
      return;
    }

    const step = requestedResultLimit();
    appState.currentShownLimit = Math.min(appState.currentResults.length + step, appState.currentTotal, maxResultLimit);
    setStatus("Loading more results");
    const requestId = deps.nextHistorySearchRequestId(appState);

    const { results, total } = await searchVisits(getSearchText(), {
      limit: appState.currentShownLimit,
      sortOrder: requestedSortOrder()
    });

    if (!deps.isCurrentHistorySearchRequestId(appState, requestId)) {
      return;
    }

    renderResults(results, total);
    setStatus(`Showing ${results.length} of ${total} results`);
  }

  async function loadAllResults() {
    const targetLimit = Math.min(appState.currentTotal, maxResultLimit);
    if (appState.currentResults.length >= targetLimit) {
      setStatus("All loaded results are visible");
      updateLoadMoreButton();
      return;
    }

    appState.currentShownLimit = targetLimit;
    const maxResultLabel = maxResultLimit.toLocaleString();
    setStatus(appState.currentTotal > maxResultLimit
      ? `Loading first ${maxResultLabel} results`
      : "Loading all results"
    );
    const requestId = deps.nextHistorySearchRequestId(appState);

    const { results, total } = await searchVisits(getSearchText(), {
      limit: appState.currentShownLimit,
      sortOrder: requestedSortOrder()
    });

    if (!deps.isCurrentHistorySearchRequestId(appState, requestId)) {
      return;
    }

    renderResults(results, total);
    setStatus(total > maxResultLimit
      ? `Showing first ${results.length} of ${total} results`
      : `Showing all ${results.length} results`
    );
  }

  return {
    loadAllResults,
    loadMoreResults,
    runSearch
  };
}
