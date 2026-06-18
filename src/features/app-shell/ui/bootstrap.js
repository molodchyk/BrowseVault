import {
  deleteSavedSearch,
  getSavedSearches,
  getStats,
  saveSavedSearch,
  searchVisits
} from "../../../storage.js";
import { createAppShellState } from "../core/state.js";
import { createVaultInvalidationController } from "../core/vault-invalidation.js";
import { createBackupActions } from "../../backup-import/ui/actions.js";
import { createChromeHistorySyncAction } from "../../background-runtime/ui/chrome-history-sync-action.js";
import { createNativeHistoryAction } from "../../background-runtime/ui/native-history-action.js";
import { createQuickOpenActions } from "../../browser-memory/ui/quick-open-actions.js";
import {
  DEFAULT_PREFERENCES,
  MAX_RESULT_LIMIT
} from "../../display-preferences/core/preferences.js";
import { createDisplayPreferencesController } from "../../display-preferences/ui/preferences-controller.js";
import { createHistoryBulkActions } from "../../history-results/ui/bulk-actions.js";
import { createHistoryResultsController } from "../../history-results/ui/results-controller.js";
import { createResultJumpActions } from "../../history-results/ui/result-jumps.js";
import { createSavedSearchActions } from "../../history-results/ui/saved-search-actions.js";
import { createHistorySearchActions } from "../../history-results/ui/search-actions.js";
import { createHistorySearchForm } from "../../history-results/ui/search-form.js";
import { createSelectedResultLookup } from "../../history-results/ui/selected-results.js";
import { createVaultManagementActions } from "../../vault-management/ui/actions.js";
import { copyText } from "../../../platform/clipboard.js";
import { getChromeMessage } from "../../../platform/chrome/i18n.js";
import {
  onLocalStorageChanged,
  setLocalStorage
} from "../../../platform/chrome/storage.js";
import { collectAppElements } from "./elements.js";
import { bindAppEvents } from "./events.js";
import { localizeAppShell } from "./localization.js";
import { createAppNavigation } from "./navigation.js";
import { createSearchCoordinator } from "./search-coordinator.js";

const SEARCH_DEBOUNCE_MS = 300;

export async function startBrowseVaultApp({ document: documentRef }) {
  localizeAppShell({
    document: documentRef,
    getMessage: getChromeMessage
  });

  const elements = collectAppElements(documentRef);
  const appState = createAppShellState(DEFAULT_PREFERENCES);
  const setStatus = (message) => {
    elements.status.textContent = message;
  };

  const historySearchForm = createHistorySearchForm({ elements });
  const selectedResultLookup = createSelectedResultLookup({ appState });
  let notifyVaultChanged = () => false;

  const appNavigation = createAppNavigation({ elements });
  const displayPreferences = createDisplayPreferencesController({
    appState,
    elements,
    getMessage: getChromeMessage,
    getStats: () => getStats({ runStorageSelfCheck: true }),
    refreshAfterSave: () => searchCoordinator.runSearchesNow(),
    root: documentRef.documentElement,
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
    requestedSortOrder: historySearchForm.getSortOrder,
    searchVisits,
    setStatus,
    updateLoadMoreButton: historyResults.updateLoadMoreButton
  });

  const vaultActions = createVaultManagementActions({
    appState,
    elements,
    getMessage: getChromeMessage,
    getSortOrder: historySearchForm.getSortOrder,
    getSearchText: historySearchForm.getSearchText,
    notifyVaultChanged: (reason) => notifyVaultChanged(reason),
    refreshStats: displayPreferences.refreshStats,
    runSearch: historySearchActions.runSearch,
    searchVisits,
    selectedResults: selectedResultLookup.selectedResults,
    setStatus
  });

  const backupActions = createBackupActions({
    appState,
    elements,
    getMessage: getChromeMessage,
    getSearchText: historySearchForm.getSearchText,
    notifyVaultChanged: (reason) => notifyVaultChanged(reason),
    refreshStats: displayPreferences.refreshStats,
    renderRules: vaultActions.renderRules,
    runSearch: historySearchActions.runSearch,
    searchVisits,
    selectedResults: selectedResultLookup.selectedResults,
    setStatus,
    switchTab: appNavigation.switchTab
  });

  const quickOpenActions = createQuickOpenActions({
    appState,
    copyText,
    elements,
    getDateFormat: () => appState.preferences.dateFormat,
    getMessage: getChromeMessage,
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
    getMessage: getChromeMessage,
    getSearchText: historySearchForm.getSearchText,
    renderResults: historyResults.renderResults,
    searchVisits,
    selectedResults: selectedResultLookup.selectedResults,
    setStatus
  });

  const resultJumpActions = createResultJumpActions({ elements, setStatus });
  const savedSearchActions = createSavedSearchActions({
    deleteSavedSearch,
    elements,
    getMessage: getChromeMessage,
    getSavedSearches,
    readSearchValues: historySearchForm.readSearchValues,
    runSearchesNow: () => searchCoordinator.runSearchesNow(),
    saveSavedSearch,
    setStatus,
    writeSearchValues: historySearchForm.writeSearchValues
  });

  const syncChromeHistory = createChromeHistorySyncAction({
    getMessage: getChromeMessage,
    refreshStats: displayPreferences.refreshStats,
    runSearch: historySearchActions.runSearch,
    setStatus
  });
  const openNativeChromeHistory = createNativeHistoryAction({
    getMessage: getChromeMessage,
    setStatus
  });

  const vaultInvalidation = createVaultInvalidationController({
    refreshVault: async () => {
      await displayPreferences.refreshStats();
      await vaultActions.renderRules();
      await historySearchActions.runSearch();
    },
    setStatus,
    storageNotifier: {
      onLocalStorageChanged,
      setLocalStorage
    }
  });
  notifyVaultChanged = vaultInvalidation.notifyVaultChanged;

  bindAppEvents({
    elements,
    document: documentRef,
    root: documentRef.documentElement,
    handlers: {
      addCategoryRule: vaultActions.addCategoryRule,
      addBlacklistRule: () => vaultActions.addRule("blacklist"),
      addWhitelistRule: () => vaultActions.addRule("whitelist"),
      applyDateShortcut: historySearchForm.applyDateShortcut,
      applySavedSearch: savedSearchActions.applySelectedSearch,
      blacklistSelectedDomains: vaultActions.blacklistSelectedDomains,
      cleanupByRetention: vaultActions.cleanupByRetention,
      cancelStagedImport: backupActions.cancelStagedImport,
      clearSearchFields: historySearchForm.clearSearchFields,
      clearSelection: bulkActions.clearVisibleSelection,
      confirmStagedImport: backupActions.confirmStagedImport,
      copySelectedUrls: bulkActions.copySelectedUrls,
      deleteFromChrome: vaultActions.deleteFromChrome,
      deleteCurrentResultsFromChrome: vaultActions.deleteCurrentResultsFromChrome,
      deleteCurrentResultsFromVault: vaultActions.deleteCurrentResultsFromVault,
      deleteFromVault: vaultActions.deleteFromVault,
      exportAll: backupActions.exportAll,
      exportCsv: backupActions.exportCsv,
      exportFilteredResults: backupActions.exportFilteredResults,
      exportFilteredResultsCsv: backupActions.exportFilteredResultsCsv,
      exportFilteredResultsHtml: backupActions.exportFilteredResultsHtml,
      exportHtml: backupActions.exportHtml,
      exportSelected: backupActions.exportSelected,
      exportSelectedCsv: backupActions.exportSelectedCsv,
      exportSelectedHtml: backupActions.exportSelectedHtml,
      focusSearchInput: appNavigation.focusSearchInput,
      importFromFile: backupActions.importFromFile,
      invertVisibleSelection: bulkActions.invertVisibleSelection,
      jumpToFirstResult: resultJumpActions.jumpToFirstResult,
      jumpToLastResult: resultJumpActions.jumpToLastResult,
      loadAllResults: historySearchActions.loadAllResults,
      loadMoreResults: historySearchActions.loadMoreResults,
      openSelected: bulkActions.openSelected,
      openNativeChromeHistory,
      previewDuplicateCleanup: vaultActions.previewDuplicateCleanup,
      previewRetentionCleanup: vaultActions.previewRetentionCleanup,
      resetVault: vaultActions.resetVault,
      runQuickSearch: () => {
        searchCoordinator.clearSearchDebounce();
        return quickOpenActions.runQuickSearch();
      },
      runSearchesNow: searchCoordinator.runSearchesNow,
      savePreferences: displayPreferences.savePreferences,
      saveCurrentSearch: savedSearchActions.saveCurrentSearch,
      scheduleSearches: searchCoordinator.scheduleSearches,
      selectAllFiltered: bulkActions.selectAllFiltered,
      selectVisible: bulkActions.selectVisibleResults,
      setStatus,
      switchTab: appNavigation.switchTab,
      syncChromeHistory,
      cleanupDuplicates: vaultActions.cleanupDuplicates,
      deleteSavedSearch: savedSearchActions.deleteSelectedSearch,
      undoVaultDelete: vaultActions.undoVaultDelete
    }
  });

  await displayPreferences.loadPreferences();
  await savedSearchActions.loadSavedSearches();
  appNavigation.focusSearchInput();
  await displayPreferences.refreshStats();
  await vaultActions.renderRules();
  await historySearchActions.runSearch();
  await quickOpenActions.runQuickSearch();
}
