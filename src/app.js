import {
  getVisitsByIds,
  getStats,
  searchVisits
} from "./storage.js";
import {
  clearSearchDebounce as clearAppSearchDebounce,
  createAppShellState,
  isCurrentHistorySearchRequestId,
  nextHistorySearchRequestId,
  scheduleSearchDebounce as scheduleAppSearchDebounce
} from "./features/app-shell/core/state.js";
import { collectAppElements } from "./features/app-shell/ui/elements.js";
import { bindAppEvents } from "./features/app-shell/ui/events.js";
import { createBackupActions } from "./features/backup-import/ui/actions.js";
import { createQuickOpenActions } from "./features/browser-memory/ui/quick-open-actions.js";
import { createChromeHistorySyncAction } from "./features/background-runtime/ui/chrome-history-sync-action.js";
import {
  DEFAULT_PREFERENCES,
  MAX_RESULT_LIMIT,
  PREFERENCES_KEY,
  backupStatusDetails,
  clampResultLimit,
  formatShortDate,
  normalizePreferences,
  themeDatasetValue
} from "./features/display-preferences/core/preferences.js";
import {
  reconcileSelectedIds
} from "./features/history-results/core/results.js";
import { createHistoryBulkActions } from "./features/history-results/ui/bulk-actions.js";
import { createHistoryResultsController } from "./features/history-results/ui/results-controller.js";
import { getLocalStorage, setLocalStorage } from "./platform/chrome/storage.js";
import { createVaultManagementActions } from "./features/vault-management/ui/actions.js";

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
  await quickOpenActions.runQuickSearch();
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

const quickOpenActions = createQuickOpenActions({
  appState,
  copyText,
  elements,
  getDateFormat: () => appState.preferences.dateFormat,
  getSearchText,
  quickResultLimit,
  setStatus
});

const historyResults = createHistoryResultsController({
  appState,
  elements,
  getDateFormat: () => appState.preferences.dateFormat,
  getSearchText,
  maxResultLimit: MAX_RESULT_LIMIT,
  requestedResultLimit
});

const bulkActions = createHistoryBulkActions({
  appState,
  copyText,
  getSearchText,
  renderResults: historyResults.renderResults,
  searchVisits,
  selectedResults,
  setStatus
});

const syncChromeHistory = createChromeHistorySyncAction({
  refreshStats,
  runSearch,
  setStatus
});

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
    historyResults.renderResults(results, total);
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
    historyResults.updateLoadMoreButton();
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

  historyResults.renderResults(results, total);
  setStatus(`Showing ${results.length} of ${total} results`);
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
      clearSelection: bulkActions.clearVisibleSelection,
      confirmStagedImport: backupActions.confirmStagedImport,
      copySelectedUrls: bulkActions.copySelectedUrls,
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
      invertVisibleSelection: bulkActions.invertVisibleSelection,
      loadMoreResults,
      openSelected: bulkActions.openSelected,
      resetVault: vaultActions.resetVault,
      runQuickSearch: quickOpenActions.runQuickSearch,
      runSearchesNow,
      savePreferences,
      scheduleSearches,
      selectAllFiltered: bulkActions.selectAllFiltered,
      selectVisible: bulkActions.selectVisibleResults,
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
  await quickOpenActions.runQuickSearch();
}

init().catch((error) => setStatus(error.message));
