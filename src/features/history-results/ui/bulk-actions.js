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

function localizedMessage(getMessage, key, fallback, substitutions) {
  return getMessage?.(key, substitutions) || fallback;
}

export function createHistoryBulkActions({
  appState,
  copyText,
  getMessage = () => "",
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
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    const urls = deps.uniqueUrlsForItems(items);
    if (!urls.length) {
      setStatus(localizedMessage(getMessage, "statusSelectedRecordsNoOpenUrls", "Selected records have no URLs to open"));
      return;
    }

    const urlsToOpen = urls.slice(0, openSelectedLimit);
    const overflow = urls.length - urlsToOpen.length;
    const message = overflow
      ? localizedMessage(
        getMessage,
        "confirmOpenSelectedLimited",
        `Open the first ${urlsToOpen.length} selected URLs? ${overflow} additional selected URLs will be left unopened to avoid flooding tabs.`,
        [String(urlsToOpen.length), String(overflow)]
      )
      : localizedMessage(
        getMessage,
        urlsToOpen.length === 1 ? "confirmOpenSelectedOne" : "confirmOpenSelectedMany",
        `Open ${urlsToOpen.length} selected URL${urlsToOpen.length === 1 ? "" : "s"}?`,
        [String(urlsToOpen.length)]
      );

    if (!deps.confirmAction(message)) {
      setStatus(localizedMessage(getMessage, "statusOpenCanceled", "Open canceled"));
      return;
    }

    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URLS,
      urls: urlsToOpen
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedMessage(getMessage, "errorOpenSelectedFailed", "Open selected failed."));
    }

    setStatus(localizedMessage(
      getMessage,
      response.opened === 1 ? "statusOpenedSelectedOne" : "statusOpenedSelectedMany",
      `Opened ${response.opened} selected URL${response.opened === 1 ? "" : "s"}`,
      [String(response.opened)]
    ));
  }

  async function copySelectedUrls() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    const urls = deps.uniqueUrlsForItems(items);
    if (!urls.length) {
      setStatus(localizedMessage(getMessage, "statusSelectedRecordsNoCopyUrls", "Selected records have no URLs to copy"));
      return;
    }

    await copyText(urls.join("\n"));
    setStatus(localizedMessage(
      getMessage,
      urls.length === 1 ? "statusCopiedSelectedUrlOne" : "statusCopiedSelectedUrlMany",
      `Copied ${urls.length} selected URL${urls.length === 1 ? "" : "s"}`,
      [String(urls.length)]
    ));
  }

  async function selectAllFiltered() {
    const { results, total } = await searchVisits(getSearchText(), {
      limit: "all"
    });
    appState.selectedIds = selectedIdsForResults(results);
    renderResults(appState.currentResults, appState.currentTotal);
    setStatus(localizedMessage(getMessage, "statusSelectedMatchingVaultRecords", `Selected ${total} matching vault records`, [String(total)]));
  }

  function invertVisibleSelection() {
    if (!appState.currentResults.length) {
      setStatus(localizedMessage(getMessage, "statusNoVisibleResultsToInvert", "No visible results to invert"));
      return;
    }

    appState.selectedIds = invertSelectionForResults(appState.selectedIds, appState.currentResults);
    renderResults(appState.currentResults, appState.currentTotal);
    setStatus(localizedMessage(
      getMessage,
      "statusInvertedVisibleResults",
      `Inverted ${appState.currentResults.length} visible results`,
      [String(appState.currentResults.length)]
    ));
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
