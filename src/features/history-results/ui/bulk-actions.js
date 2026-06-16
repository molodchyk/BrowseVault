import { BACKGROUND_MESSAGE_TYPES } from "../../background-runtime/core/messages.js";
import {
  invertSelectionForResults,
  selectedIdsForResults,
  uniqueUrlsForItems
} from "../core/results.js";
import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";

const DEFAULT_OPEN_SELECTED_LIMIT = 25;

const defaultServices = {
  confirmAction: (message) => globalThis.confirm(message),
  sendRuntimeMessage,
  uniqueUrlsForItems
};

export function createHistoryBulkActions({
  appState,
  copyText,
  getSearchText,
  openSelectedLimit = DEFAULT_OPEN_SELECTED_LIMIT,
  renderResults,
  searchVisits,
  selectedResults,
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  async function openSelected() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
      return;
    }

    const urls = deps.uniqueUrlsForItems(items);
    if (!urls.length) {
      setStatus("Selected records have no URLs to open");
      return;
    }

    const urlsToOpen = urls.slice(0, openSelectedLimit);
    const overflow = urls.length - urlsToOpen.length;
    const message = overflow
      ? `Open the first ${urlsToOpen.length} selected URLs? ${overflow} additional selected URLs will be left unopened to avoid flooding tabs.`
      : `Open ${urlsToOpen.length} selected URL${urlsToOpen.length === 1 ? "" : "s"}?`;

    if (!deps.confirmAction(message)) {
      setStatus("Open canceled");
      return;
    }

    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URLS,
      urls: urlsToOpen
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Open selected failed.");
    }

    setStatus(`Opened ${response.opened} selected URL${response.opened === 1 ? "" : "s"}`);
  }

  async function copySelectedUrls() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
      return;
    }

    const urls = deps.uniqueUrlsForItems(items);
    if (!urls.length) {
      setStatus("Selected records have no URLs to copy");
      return;
    }

    await copyText(urls.join("\n"));
    setStatus(`Copied ${urls.length} selected URL${urls.length === 1 ? "" : "s"}`);
  }

  async function selectAllFiltered() {
    const { results, total } = await searchVisits(getSearchText(), {
      limit: "all"
    });
    appState.selectedIds = selectedIdsForResults(results);
    renderResults(appState.currentResults, appState.currentTotal);
    setStatus(`Selected ${total} matching vault records`);
  }

  function invertVisibleSelection() {
    if (!appState.currentResults.length) {
      setStatus("No visible results to invert");
      return;
    }

    appState.selectedIds = invertSelectionForResults(appState.selectedIds, appState.currentResults);
    renderResults(appState.currentResults, appState.currentTotal);
    setStatus(`Inverted ${appState.currentResults.length} visible results`);
  }

  function selectVisibleResults() {
    appState.selectedIds = selectedIdsForResults(appState.currentResults);
    renderResults(appState.currentResults, appState.currentTotal);
  }

  function clearVisibleSelection() {
    appState.selectedIds.clear();
    renderResults(appState.currentResults, appState.currentTotal);
  }

  return {
    clearVisibleSelection,
    copySelectedUrls,
    invertVisibleSelection,
    openSelected,
    selectAllFiltered,
    selectVisibleResults
  };
}
