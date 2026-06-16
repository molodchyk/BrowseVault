import {
  getVisitsByIds,
  getStats,
  searchVisits
} from "./storage.js";
import { createAppShellState } from "./features/app-shell/core/state.js";
import { collectAppElements } from "./features/app-shell/ui/elements.js";
import { bindAppEvents } from "./features/app-shell/ui/events.js";
import { createSearchCoordinator } from "./features/app-shell/ui/search-coordinator.js";
import { createBackupActions } from "./features/backup-import/ui/actions.js";
import { createQuickOpenActions } from "./features/browser-memory/ui/quick-open-actions.js";
import { createChromeHistorySyncAction } from "./features/background-runtime/ui/chrome-history-sync-action.js";
import {
  DEFAULT_PREFERENCES,
  MAX_RESULT_LIMIT
} from "./features/display-preferences/core/preferences.js";
import { createDisplayPreferencesController } from "./features/display-preferences/ui/preferences-controller.js";
import { createHistoryBulkActions } from "./features/history-results/ui/bulk-actions.js";
import { createHistoryResultsController } from "./features/history-results/ui/results-controller.js";
import { createHistorySearchActions } from "./features/history-results/ui/search-actions.js";
import { createHistorySearchForm } from "./features/history-results/ui/search-form.js";
import { createVaultManagementActions } from "./features/vault-management/ui/actions.js";

const SEARCH_DEBOUNCE_MS = 300;

const elements = collectAppElements(document);
const appState = createAppShellState(DEFAULT_PREFERENCES);

function setStatus(message) {
  elements.status.textContent = message;
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

const historySearchForm = createHistorySearchForm({
  elements
});

const displayPreferences = createDisplayPreferencesController({
  appState,
  elements,
  getStats,
  refreshAfterSave: () => searchCoordinator.runSearchesNow(),
  root: document.documentElement,
  setStatus
});

const historyResults = createHistoryResultsController({
  appState,
  elements,
  getDateFormat: () => appState.preferences.dateFormat,
  getSearchText: historySearchForm.getSearchText,
  maxResultLimit: MAX_RESULT_LIMIT,
  requestedResultLimit: displayPreferences.requestedResultLimit
});

const historySearchActions = createHistorySearchActions({
  appState,
  getSearchText: historySearchForm.getSearchText,
  maxResultLimit: MAX_RESULT_LIMIT,
  renderResults: historyResults.renderResults,
  requestedResultLimit: displayPreferences.requestedResultLimit,
  searchVisits,
  setStatus,
  updateLoadMoreButton: historyResults.updateLoadMoreButton
});

const vaultActions = createVaultManagementActions({
  appState,
  elements,
  refreshStats: displayPreferences.refreshStats,
  runSearch: historySearchActions.runSearch,
  selectedResults,
  setStatus
});

const backupActions = createBackupActions({
  appState,
  elements,
  refreshStats: displayPreferences.refreshStats,
  renderRules: vaultActions.renderRules,
  runSearch: historySearchActions.runSearch,
  selectedResults,
  setStatus,
  switchTab
});

const quickOpenActions = createQuickOpenActions({
  appState,
  copyText,
  elements,
  getDateFormat: () => appState.preferences.dateFormat,
  getSearchText: historySearchForm.getSearchText,
  quickResultLimit: displayPreferences.quickResultLimit,
  setStatus
});

const searchCoordinator = createSearchCoordinator({
  appState,
  delayMs: SEARCH_DEBOUNCE_MS,
  runHistorySearch: historySearchActions.runSearch,
  runQuickSearch: quickOpenActions.runQuickSearch,
  setStatus
});

const bulkActions = createHistoryBulkActions({
  appState,
  copyText,
  getSearchText: historySearchForm.getSearchText,
  renderResults: historyResults.renderResults,
  searchVisits,
  selectedResults,
  setStatus
});

const syncChromeHistory = createChromeHistorySyncAction({
  refreshStats: displayPreferences.refreshStats,
  runSearch: historySearchActions.runSearch,
  setStatus
});

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
      clearSearchFields: historySearchForm.clearSearchFields,
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
      loadMoreResults: historySearchActions.loadMoreResults,
      openSelected: bulkActions.openSelected,
      resetVault: vaultActions.resetVault,
      runQuickSearch: quickOpenActions.runQuickSearch,
      runSearchesNow: searchCoordinator.runSearchesNow,
      savePreferences: displayPreferences.savePreferences,
      scheduleSearches: searchCoordinator.scheduleSearches,
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
  await displayPreferences.loadPreferences();
  bindEvents();
  elements.query.focus();
  await displayPreferences.refreshStats();
  await vaultActions.renderRules();
  await historySearchActions.runSearch();
  await quickOpenActions.runQuickSearch();
}

init().catch((error) => setStatus(error.message));
