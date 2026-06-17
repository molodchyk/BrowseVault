export function isEditableTarget(target) {
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName || "");
}

function reportError(error, setStatus) {
  setStatus(error?.message || "Action failed.");
}

function runHandler(handler, setStatus) {
  try {
    const result = handler();
    if (result?.catch) {
      result.catch((error) => reportError(error, setStatus));
    }
  } catch (error) {
    reportError(error, setStatus);
  }
}

function bindAsync(element, eventName, handler, setStatus) {
  element.addEventListener(eventName, () => runHandler(handler, setStatus));
}

export function bindAppEvents({ elements, document, root, handlers }) {
  const setStatus = handlers.setStatus;

  for (const tab of elements.tabs) {
    tab.addEventListener("click", () => handlers.switchTab(tab.dataset.tab));
  }

  elements.prefTheme.addEventListener("change", () => {
    root.dataset.theme = elements.prefTheme.value === "system" ? "" : elements.prefTheme.value;
  });

  elements.prefAccent.addEventListener("change", () => {
    root.dataset.accent = elements.prefAccent.value;
  });

  elements.prefContrast.addEventListener("change", () => {
    root.dataset.contrast = elements.prefContrast.value === "high" ? "high" : "";
  });

  elements.prefTextSize.addEventListener("change", () => {
    root.dataset.textSize = elements.prefTextSize.value === "large" ? "large" : "";
  });

  bindAsync(elements.savePreferences, "click", handlers.savePreferences, setStatus);
  bindAsync(elements.search, "click", handlers.runSearchesNow, setStatus);
  bindAsync(elements.quickSearch, "click", handlers.runQuickSearch, setStatus);
  bindAsync(elements.applySavedSearch, "click", handlers.applySavedSearch, setStatus);
  bindAsync(elements.saveSearch, "click", handlers.saveCurrentSearch, setStatus);
  bindAsync(elements.deleteSavedSearch, "click", handlers.deleteSavedSearch, setStatus);

  elements.clearSearch.addEventListener("click", () => {
    handlers.clearSearchFields();
    runHandler(handlers.runSearchesNow, setStatus);
  });

  for (const shortcut of elements.dateShortcuts) {
    shortcut.addEventListener("click", () => {
      handlers.applyDateShortcut(shortcut.dataset.dateShortcut);
      runHandler(handlers.runSearchesNow, setStatus);
    });
  }

  for (const input of [elements.query, elements.onDate, elements.after, elements.before, elements.limit]) {
    input.addEventListener("input", handlers.scheduleSearches);
  }
  elements.sortOrder.addEventListener("change", () => handlers.scheduleSearches());

  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runHandler(handlers.runSearchesNow, setStatus);
    }
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      handlers.focusSearchInput();
      return;
    }

    if (event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey && !isEditableTarget(event.target)) {
      event.preventDefault();
      handlers.focusSearchInput();
    }
  });

  bindAsync(elements.syncChrome, "click", handlers.syncChromeHistory, setStatus);
  bindAsync(elements.exportJson, "click", handlers.exportAll, setStatus);
  bindAsync(elements.exportCsv, "click", handlers.exportCsv, setStatus);
  bindAsync(elements.exportHtml, "click", handlers.exportHtml, setStatus);
  bindAsync(elements.openSelected, "click", handlers.openSelected, setStatus);
  bindAsync(elements.copySelected, "click", handlers.copySelectedUrls, setStatus);
  bindAsync(elements.exportSelected, "click", handlers.exportSelected, setStatus);
  bindAsync(elements.exportSelectedCsv, "click", handlers.exportSelectedCsv, setStatus);
  bindAsync(elements.exportSelectedHtml, "click", handlers.exportSelectedHtml, setStatus);
  bindAsync(elements.blacklistSelected, "click", handlers.blacklistSelectedDomains, setStatus);
  bindAsync(elements.deleteVault, "click", handlers.deleteFromVault, setStatus);
  bindAsync(elements.deleteChrome, "click", handlers.deleteFromChrome, setStatus);
  bindAsync(elements.undoDelete, "click", handlers.undoVaultDelete, setStatus);

  elements.selectVisible.addEventListener("click", () => handlers.selectVisible());
  elements.invertVisible.addEventListener("click", () => handlers.invertVisibleSelection());
  bindAsync(elements.selectFiltered, "click", handlers.selectAllFiltered, setStatus);
  bindAsync(elements.exportResults, "click", handlers.exportFilteredResults, setStatus);
  bindAsync(elements.exportResultsCsv, "click", handlers.exportFilteredResultsCsv, setStatus);
  bindAsync(elements.exportResultsHtml, "click", handlers.exportFilteredResultsHtml, setStatus);
  bindAsync(elements.deleteResults, "click", handlers.deleteCurrentResultsFromVault, setStatus);
  bindAsync(elements.deleteResultsChrome, "click", handlers.deleteCurrentResultsFromChrome, setStatus);
  bindAsync(elements.loadMore, "click", handlers.loadMoreResults, setStatus);
  bindAsync(elements.loadAll, "click", handlers.loadAllResults, setStatus);
  bindAsync(elements.jumpResultsTop, "click", handlers.jumpToFirstResult, setStatus);
  bindAsync(elements.jumpResultsBottom, "click", handlers.jumpToLastResult, setStatus);
  elements.clearSelection.addEventListener("click", () => handlers.clearSelection());

  elements.importArchive.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) {
      runHandler(() => handlers.importFromFile(file), setStatus);
    }
    event.target.value = "";
  });

  bindAsync(elements.confirmImport, "click", handlers.confirmStagedImport, setStatus);
  elements.cancelImport.addEventListener("click", () => handlers.cancelStagedImport());
  bindAsync(elements.addCategory, "click", handlers.addCategoryRule, setStatus);
  bindAsync(elements.addBlacklist, "click", handlers.addBlacklistRule, setStatus);
  bindAsync(elements.addWhitelist, "click", handlers.addWhitelistRule, setStatus);
  bindAsync(elements.previewRetention, "click", handlers.previewRetentionCleanup, setStatus);
  bindAsync(elements.cleanupRetention, "click", handlers.cleanupByRetention, setStatus);
  bindAsync(elements.previewDuplicates, "click", handlers.previewDuplicateCleanup, setStatus);
  bindAsync(elements.cleanupDuplicates, "click", handlers.cleanupDuplicates, setStatus);
  bindAsync(elements.resetVault, "click", handlers.resetVault, setStatus);
  bindAsync(elements.openNativeHistory, "click", handlers.openNativeChromeHistory, setStatus);
}
