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
  let activeSearchController = null;

  function beginSearchRequest() {
    activeSearchController?.abort();
    activeSearchController = new AbortController();
    return {
      requestId: deps.nextHistorySearchRequestId(appState),
      signal: activeSearchController.signal
    };
  }

  function finishSearchRequest(signal) {
    if (activeSearchController?.signal === signal) {
      activeSearchController = null;
    }
  }

  function isAbortError(error) {
    return error?.name === "AbortError";
  }

  async function runSearch() {
    const { requestId, signal } = beginSearchRequest();
    setStatus("Searching local vault");
    appState.currentShownLimit = requestedResultLimit();
    const searchText = getSearchText();
    const limit = appState.currentShownLimit;

    try {
      const { results, total } = await searchVisits(searchText, {
        limit,
        signal,
        sortOrder: requestedSortOrder()
      });

      if (!deps.isCurrentHistorySearchRequestId(appState, requestId)) {
        return;
      }

      appState.selectedIds = deps.reconcileSelectedIds(appState.selectedIds, results);
      renderResults(results, total);
      setStatus("Ready");
    } catch (error) {
      if (!isAbortError(error) && deps.isCurrentHistorySearchRequestId(appState, requestId)) {
        setStatus(error.message);
      }
    } finally {
      finishSearchRequest(signal);
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
    const { requestId, signal } = beginSearchRequest();

    try {
      const { results, total } = await searchVisits(getSearchText(), {
        limit: appState.currentShownLimit,
        signal,
        sortOrder: requestedSortOrder()
      });

      if (!deps.isCurrentHistorySearchRequestId(appState, requestId)) {
        return;
      }

      renderResults(results, total);
      setStatus(`Showing ${results.length} of ${total} results`);
    } catch (error) {
      if (!isAbortError(error) && deps.isCurrentHistorySearchRequestId(appState, requestId)) {
        setStatus(error.message);
      }
    } finally {
      finishSearchRequest(signal);
    }
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
    const { requestId, signal } = beginSearchRequest();

    try {
      const { results, total } = await searchVisits(getSearchText(), {
        limit: appState.currentShownLimit,
        signal,
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
    } catch (error) {
      if (!isAbortError(error) && deps.isCurrentHistorySearchRequestId(appState, requestId)) {
        setStatus(error.message);
      }
    } finally {
      finishSearchRequest(signal);
    }
  }

  return {
    loadAllResults,
    loadMoreResults,
    runSearch
  };
}
