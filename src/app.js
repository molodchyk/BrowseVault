import {
  getVisitsByIds,
  getStats,
  searchVisits
} from "./storage.js";
import { searchBrowserMemory } from "./browser-memory.js";
import {
  clearSearchDebounce as clearAppSearchDebounce,
  createAppShellState,
  isCurrentHistorySearchRequestId,
  isCurrentQuickSearchRequestId,
  nextHistorySearchRequestId,
  nextQuickSearchRequestId,
  scheduleSearchDebounce as scheduleAppSearchDebounce
} from "./features/app-shell/core/state.js";
import { collectAppElements } from "./features/app-shell/ui/elements.js";
import { bindAppEvents } from "./features/app-shell/ui/events.js";
import { createBackupActions } from "./features/backup-import/ui/actions.js";
import { BACKGROUND_MESSAGE_TYPES } from "./features/background-runtime/core/messages.js";
import {
  DEFAULT_PREFERENCES,
  MAX_RESULT_LIMIT,
  PREFERENCES_KEY,
  backupStatusDetails,
  clampResultLimit,
  formatCount,
  formatDate,
  formatShortDate,
  normalizePreferences,
  themeDatasetValue
} from "./features/display-preferences/core/preferences.js";
import {
  invertSelectionForResults,
  loadMoreState,
  reconcileSelectedIds,
  selectedCountLabel,
  selectedIdsForResults,
  uniqueUrlsForItems
} from "./features/history-results/core/results.js";
import { renderHistoryResults } from "./features/history-results/ui/render-results.js";
import {
  appendHighlightedText,
  highlightTokensForScope
} from "./features/history-results/ui/text-highlighting.js";
import { sendRuntimeMessage } from "./platform/chrome/runtime.js";
import { getLocalStorage, setLocalStorage } from "./platform/chrome/storage.js";
import { createVaultManagementActions } from "./features/vault-management/ui/actions.js";
import { parseQuery } from "./query.js";

const OPEN_SELECTED_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;

const elements = collectAppElements(document);
const appState = createAppShellState(DEFAULT_PREFERENCES);

function renderBackupStatus(backup) {
  const status = backupStatusDetails(backup, {
    dateFormat: appState.preferences.dateFormat
  });

  elements.backupHealth.textContent = status.healthText;
  elements.backupHealth.classList.toggle("is-warning", status.isWarning);
  elements.backupHealth.classList.toggle("is-ok", status.isOk);
  elements.backupLast.textContent = status.lastText;
  elements.backupFormat.textContent = status.formatText;
  elements.backupRecords.textContent = status.recordsText;
  elements.backupChecksum.textContent = status.checksumText;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function requestedResultLimit() {
  return clampResultLimit(elements.limit.value || appState.preferences.defaultLimit);
}

function quickResultLimit() {
  return Math.min(requestedResultLimit(), 100);
}

async function loadPreferences() {
  const result = await getLocalStorage(PREFERENCES_KEY);
  appState.preferences = normalizePreferences(result[PREFERENCES_KEY]);
  applyPreferences();
}

async function savePreferences() {
  appState.preferences = normalizePreferences({
    theme: elements.prefTheme.value,
    accent: elements.prefAccent.value,
    dateFormat: elements.prefDateFormat.value,
    defaultLimit: elements.prefLimit.value
  });

  await setLocalStorage({
    [PREFERENCES_KEY]: appState.preferences
  });
  elements.limit.value = String(appState.preferences.defaultLimit);
  applyPreferences();
  await refreshStats();
  await runSearchesNow();
  setStatus("Settings saved");
}

function applyPreferences() {
  const root = document.documentElement;
  root.dataset.theme = themeDatasetValue(appState.preferences.theme);
  root.dataset.accent = appState.preferences.accent;

  elements.prefTheme.value = appState.preferences.theme;
  elements.prefAccent.value = appState.preferences.accent;
  elements.prefDateFormat.value = appState.preferences.dateFormat;
  elements.prefLimit.value = String(appState.preferences.defaultLimit);

  if (!elements.limit.value || Number(elements.limit.value) === DEFAULT_PREFERENCES.defaultLimit) {
    elements.limit.value = String(appState.preferences.defaultLimit);
  }
}

function switchTab(tabName) {
  for (const tab of elements.tabs) {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  }

  for (const panel of elements.panels) {
    panel.hidden = panel.dataset.panel !== tabName;
  }
}

function focusSearchInput() {
  switchTab("history");
  elements.query.focus();
  elements.query.select();
}

function clearSearchDebounce() {
  clearAppSearchDebounce(appState);
}

async function runSearchesNow() {
  clearSearchDebounce();
  await runSearch();
  await runQuickSearch();
}

function scheduleSearches() {
  scheduleAppSearchDebounce(appState, () => {
    runSearchesNow().catch((error) => setStatus(error.message));
  }, SEARCH_DEBOUNCE_MS);
}

function getSearchText() {
  const parts = [elements.query.value.trim()];
  const onDate = elements.onDate.value.trim();
  const after = elements.after.value.trim();
  const before = elements.before.value.trim();

  if (onDate) {
    parts.push(`date:${onDate}`);
  }

  if (after) {
    parts.push(`after:${after}`);
  }

  if (before) {
    parts.push(`before:${before}`);
  }

  return parts.filter(Boolean).join(" ");
}

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
    max: MAX_RESULT_LIMIT
  });

  elements.loadMore.hidden = !state.canLoadMore;
  if (state.canLoadMore) {
    elements.loadMore.textContent = `Load ${state.nextCount} More`;
  }
}

async function copyText(text) {
  if (!text) {
    throw new Error("Nothing to copy.");
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the local selection-based copy path.
    }
  }

  const selection = document.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  document.body.append(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();

  if (selectedRange) {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  }

  if (!copied) {
    throw new Error("Copy failed.");
  }
}

async function selectedResults() {
  return getVisitsByIds([...appState.selectedIds]);
}

const vaultActions = createVaultManagementActions({
  appState,
  elements,
  refreshStats,
  runSearch,
  selectedResults,
  setStatus
});

const backupActions = createBackupActions({
  appState,
  elements,
  refreshStats,
  renderRules: vaultActions.renderRules,
  runSearch,
  selectedResults,
  setStatus,
  switchTab
});

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

  renderHistoryResults({
    results,
    total,
    queryText: getSearchText(),
    selectedIds: appState.selectedIds,
    dateFormat: appState.preferences.dateFormat,
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

function renderQuickResults(results, total, warnings = []) {
  elements.quickResults.replaceChildren();
  const query = parseQuery(getSearchText());
  const titleTokens = highlightTokensForScope(query, "title");
  const urlTokens = highlightTokensForScope(query, "url");
  const metaTokens = highlightTokensForScope(query, "meta");

  if (!results.length) {
    const empty = document.createElement("li");
    empty.className = "quick-result";
    empty.textContent = warnings.length
      ? `No source results. ${warnings.join(" ")}`
      : "No source results.";
    elements.quickResults.append(empty);
    return;
  }

  for (const item of results) {
    const fragment = elements.quickResultTemplate.content.cloneNode(true);
    const source = fragment.querySelector(".source-pill");
    const title = fragment.querySelector(".result-title");
    const url = fragment.querySelector(".url");
    const meta = fragment.querySelector(".meta");
    const action = fragment.querySelector(".quick-action");
    const copy = fragment.querySelector(".quick-copy");

    source.textContent = item.type;
    title.href = item.url;
    appendHighlightedText(title, item.title || item.url, titleTokens, query.regex);
    appendHighlightedText(url, item.url, urlTokens, query.regex);
    appendHighlightedText(meta, `${item.detail} · ${item.domain || "unknown domain"} · ${formatDate(item.visitTime, appState.preferences.dateFormat)}`, metaTokens, query.regex);
    action.textContent = item.action?.type === "activate-tab"
      ? "Switch"
      : item.action?.type === "restore-session"
        ? "Restore"
        : "Open";
    action.addEventListener("click", () => performQuickAction(item).catch((error) => setStatus(error.message)));
    copy.addEventListener("click", () => copyQuickUrl(item).catch((error) => setStatus(error.message)));

    elements.quickResults.append(fragment);
  }

  if (warnings.length) {
    setStatus(`${total} source results; ${warnings.length} source warning${warnings.length === 1 ? "" : "s"}`);
  }
}

async function performQuickAction(item) {
  const action = item.action || { type: "open-url", url: item.url };
  const messageByType = {
    "activate-tab": {
      type: BACKGROUND_MESSAGE_TYPES.ACTIVATE_TAB,
      tabId: action.tabId,
      windowId: action.windowId
    },
    "restore-session": {
      type: BACKGROUND_MESSAGE_TYPES.RESTORE_SESSION,
      sessionId: action.sessionId
    },
    "open-url": {
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
      url: action.url || item.url
    }
  };

  const response = await sendRuntimeMessage(messageByType[action.type] || messageByType["open-url"]);
  if (!response?.ok) {
    throw new Error(response?.error || "Quick action failed.");
  }
  setStatus(`${action.type === "activate-tab" ? "Switched to" : "Opened"} ${item.title || item.url}`);
}

async function copyQuickUrl(item) {
  if (!item.url) {
    setStatus("No URL to copy");
    return;
  }

  await copyText(item.url);
  setStatus(`Copied URL for ${item.title || item.url}`);
}

async function openSelected() {
  const items = await selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const urls = uniqueUrlsForItems(items);
  if (!urls.length) {
    setStatus("Selected records have no URLs to open");
    return;
  }

  const urlsToOpen = urls.slice(0, OPEN_SELECTED_LIMIT);
  const overflow = urls.length - urlsToOpen.length;
  const message = overflow
    ? `Open the first ${urlsToOpen.length} selected URLs? ${overflow} additional selected URLs will be left unopened to avoid flooding tabs.`
    : `Open ${urlsToOpen.length} selected URL${urlsToOpen.length === 1 ? "" : "s"}?`;

  if (!confirm(message)) {
    setStatus("Open canceled");
    return;
  }

  const response = await sendRuntimeMessage({
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

  const urls = uniqueUrlsForItems(items);
  if (!urls.length) {
    setStatus("Selected records have no URLs to copy");
    return;
  }

  await copyText(urls.join("\n"));
  setStatus(`Copied ${urls.length} selected URL${urls.length === 1 ? "" : "s"}`);
}

async function runQuickSearch() {
  const requestId = nextQuickSearchRequestId(appState);
  const searchText = getSearchText();
  const limit = quickResultLimit();
  setStatus("Searching browser sources");
  const { results, total, warnings } = await searchBrowserMemory(searchText, {
    limit
  });

  if (!isCurrentQuickSearchRequestId(appState, requestId)) {
    return;
  }

  renderQuickResults(results, total, warnings);
  if (!warnings.length) {
    setStatus(`${total} source result${total === 1 ? "" : "s"}`);
  }
}

async function refreshStats() {
  const stats = await getStats();
  elements.statVisits.textContent = String(stats.visits);
  elements.statDomains.textContent = String(stats.domains);
  elements.statNewest.textContent = formatShortDate(stats.newestVisitTime, appState.preferences.dateFormat);
  elements.statBackup.textContent = stats.meta.lastBackup?.exportedAt
    ? formatShortDate(Date.parse(stats.meta.lastBackup.exportedAt), appState.preferences.dateFormat)
    : "Never";
  renderBackupStatus(stats.meta.lastBackup);
}

async function runSearch() {
  const requestId = nextHistorySearchRequestId(appState);
  setStatus("Searching local vault");
  appState.currentShownLimit = requestedResultLimit();
  const searchText = getSearchText();
  const limit = appState.currentShownLimit;

  try {
    const { results, total } = await searchVisits(searchText, {
      limit
    });

    if (!isCurrentHistorySearchRequestId(appState, requestId)) {
      return;
    }

    appState.selectedIds = reconcileSelectedIds(appState.selectedIds, results);
    renderResults(results, total);
    setStatus("Ready");
  } catch (error) {
    if (isCurrentHistorySearchRequestId(appState, requestId)) {
      setStatus(error.message);
    }
  }
}

async function loadMoreResults() {
  if (appState.currentResults.length >= appState.currentTotal || appState.currentResults.length >= MAX_RESULT_LIMIT) {
    setStatus("All loaded results are visible");
    updateLoadMoreButton();
    return;
  }

  const step = requestedResultLimit();
  appState.currentShownLimit = Math.min(appState.currentResults.length + step, appState.currentTotal, MAX_RESULT_LIMIT);
  setStatus("Loading more results");
  const requestId = nextHistorySearchRequestId(appState);

  const { results, total } = await searchVisits(getSearchText(), {
    limit: appState.currentShownLimit
  });

  if (!isCurrentHistorySearchRequestId(appState, requestId)) {
    return;
  }

  renderResults(results, total);
  setStatus(`Showing ${results.length} of ${total} results`);
}

async function syncChromeHistory() {
  setStatus("Syncing Chrome history");
  const response = await sendRuntimeMessage({
    type: BACKGROUND_MESSAGE_TYPES.BOOTSTRAP_CHROME_HISTORY
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Chrome history sync failed.");
  }

  await refreshStats();
  await runSearch();
  setStatus(`Synced ${response.result.stored} records`);
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

function bindEvents() {
  bindAppEvents({
    elements,
    document,
    root: document.documentElement,
    handlers: {
      addBlacklistRule: () => vaultActions.addRule("blacklist"),
      addWhitelistRule: () => vaultActions.addRule("whitelist"),
      blacklistSelectedDomains: vaultActions.blacklistSelectedDomains,
      cancelStagedImport: backupActions.cancelStagedImport,
      clearSelection: clearVisibleSelection,
      confirmStagedImport: backupActions.confirmStagedImport,
      copySelectedUrls,
      deleteFromChrome: vaultActions.deleteFromChrome,
      deleteFromVault: vaultActions.deleteFromVault,
      exportAll: backupActions.exportAll,
      exportCsv: backupActions.exportCsv,
      exportHtml: backupActions.exportHtml,
      exportSelected: backupActions.exportSelected,
      exportSelectedCsv: backupActions.exportSelectedCsv,
      exportSelectedHtml: backupActions.exportSelectedHtml,
      focusSearchInput,
      importFromFile: backupActions.importFromFile,
      invertVisibleSelection,
      loadMoreResults,
      openSelected,
      resetVault: vaultActions.resetVault,
      runQuickSearch,
      runSearchesNow,
      savePreferences,
      scheduleSearches,
      selectAllFiltered,
      selectVisible: selectVisibleResults,
      setStatus,
      switchTab,
      syncChromeHistory,
      undoVaultDelete: vaultActions.undoVaultDelete
    }
  });
}

async function init() {
  await loadPreferences();
  bindEvents();
  elements.query.focus();
  await refreshStats();
  await vaultActions.renderRules();
  await runSearch();
  await runQuickSearch();
}

init().catch((error) => setStatus(error.message));
