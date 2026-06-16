import {
  addDomainRule,
  analyzeImportArchive,
  clearVaultData,
  exportArchive,
  getRules,
  getVisitsByIds,
  getStats,
  importArchive,
  markDeletedByIds,
  removeRule,
  restoreDeletedByIds,
  searchVisits,
  setMeta
} from "./storage.js";
import { searchBrowserMemory } from "./browser-memory.js";
import { visitsToCsv, visitsToHtml } from "./export-format.js";
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
import { archiveFromFileText } from "./features/backup-import/core/archive-parser.js";
import { renderImportPreview as renderImportPreviewUi } from "./features/backup-import/ui/render-import-preview.js";
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
  uniqueDomainsForItems,
  uniqueUrlsForItems
} from "./features/history-results/core/results.js";
import { renderHistoryResults } from "./features/history-results/ui/render-results.js";
import {
  appendHighlightedText,
  highlightTokensForScope
} from "./features/history-results/ui/text-highlighting.js";
import { sendRuntimeMessage } from "./platform/chrome/runtime.js";
import { getLocalStorage, setLocalStorage } from "./platform/chrome/storage.js";
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

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function integrityPayload(archive) {
  return JSON.stringify({
    schemaVersion: archive.schemaVersion || 1,
    rules: archive.rules || [],
    visits: archive.visits || archive.items || []
  });
}

async function attachIntegrity(archive) {
  return {
    ...archive,
    integrity: {
      algorithm: "SHA-256",
      scope: "schemaVersion,rules,visits",
      sha256: await sha256(integrityPayload(archive))
    }
  };
}

async function verifyArchiveIntegrity(archive) {
  if (!archive?.integrity?.sha256) {
    return {
      checked: false,
      ok: true
    };
  }

  const actual = await sha256(integrityPayload(archive));
  return {
    checked: true,
    ok: actual === archive.integrity.sha256,
    expected: archive.integrity.sha256,
    actual
  };
}

function downloadText(filename, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
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

function importPreviewElements() {
  return {
    importPreview: elements.importPreview,
    importPreviewTitle: elements.importPreviewTitle,
    importValid: elements.importValid,
    importNew: elements.importNew,
    importExisting: elements.importExisting,
    importDuplicates: elements.importDuplicates,
    importHealth: elements.importHealth,
    importPreviewNote: elements.importPreviewNote,
    confirmImport: elements.confirmImport
  };
}

async function selectedResults() {
  return getVisitsByIds([...appState.selectedIds]);
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

async function blacklistSelectedDomains() {
  const items = await selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const domains = uniqueDomainsForItems(items);
  if (!domains.length) {
    setStatus("Selected records have no domains to blacklist");
    return;
  }

  const message = `Blacklist ${domains.length} selected domain${domains.length === 1 ? "" : "s"} for future archiving? Existing vault records will stay until you delete them.`;
  if (!confirm(message)) {
    setStatus("Blacklist canceled");
    return;
  }

  const existingRules = await getRules();
  const movedFromWhitelist = domains.filter((domain) => existingRules.whitelist.includes(domain)).length;
  await Promise.all(domains.map((domain) => addDomainRule("blacklist", domain)));
  await renderRules();

  const movedLabel = movedFromWhitelist
    ? ` ${movedFromWhitelist} moved from whitelist.`
    : "";
  setStatus(`Blacklisted ${domains.length} domain${domains.length === 1 ? "" : "s"} for future archiving.${movedLabel}`);
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

async function renderRules() {
  const { rules } = await getRules();
  elements.rulesList.replaceChildren();

  if (!rules.length) {
    const empty = document.createElement("li");
    empty.className = "rule-item";
    empty.textContent = "No domain rules yet.";
    elements.rulesList.append(empty);
    return;
  }

  for (const rule of rules) {
    const item = document.createElement("li");
    item.className = "rule-item";

    const label = document.createElement("span");
    const type = document.createElement("strong");
    type.textContent = rule.type;
    label.append(type, ` ${rule.value}`);

    const remove = document.createElement("button");
    remove.className = "ghost";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      await removeRule(rule.id);
      await renderRules();
      setStatus(`Removed ${rule.value}`);
    });

    item.append(label, remove);
    elements.rulesList.append(item);
  }
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

async function exportAll() {
  setStatus("Preparing archive");
  const archive = await attachIntegrity(await exportArchive());
  downloadJson(`browsevault-archive-${archive.exportedAt.slice(0, 10)}.json`, archive);
  await setMeta("lastBackup", {
    exportedAt: archive.exportedAt,
    format: "json",
    records: archive.counts.visits,
    sha256: archive.integrity.sha256
  });
  await refreshStats();
  setStatus("Exported archive");
}

async function exportCsv() {
  setStatus("Preparing CSV");
  const archive = await exportArchive();
  downloadText(
    `browsevault-history-${archive.exportedAt.slice(0, 10)}.csv`,
    "text/csv",
    visitsToCsv(archive.visits)
  );
  await setMeta("lastBackup", {
    exportedAt: archive.exportedAt,
    format: "csv",
    records: archive.counts.visits
  });
  await refreshStats();
  setStatus("Exported CSV");
}

async function exportHtml() {
  setStatus("Preparing HTML");
  const archive = await exportArchive();
  downloadText(
    `browsevault-history-${archive.exportedAt.slice(0, 10)}.html`,
    "text/html",
    visitsToHtml(archive.visits, archive.exportedAt)
  );
  await setMeta("lastBackup", {
    exportedAt: archive.exportedAt,
    format: "html",
    records: archive.counts.visits
  });
  await refreshStats();
  setStatus("Exported HTML");
}

async function exportSelected() {
  const items = await selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const archive = await attachIntegrity(await exportArchive(items));
  downloadJson(`browsevault-selected-${archive.exportedAt.slice(0, 10)}.json`, archive);
  setStatus(`Exported ${items.length} selected records as JSON`);
}

async function exportSelectedCsv() {
  const items = await selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const exportedAt = new Date().toISOString();
  downloadText(
    `browsevault-selected-${exportedAt.slice(0, 10)}.csv`,
    "text/csv",
    visitsToCsv(items)
  );
  setStatus(`Exported ${items.length} selected records as CSV`);
}

async function exportSelectedHtml() {
  const items = await selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const exportedAt = new Date().toISOString();
  downloadText(
    `browsevault-selected-${exportedAt.slice(0, 10)}.html`,
    "text/html",
    visitsToHtml(items, exportedAt)
  );
  setStatus(`Exported ${items.length} selected records as HTML`);
}

async function importFromFile(file) {
  setStatus("Reading archive");
  const text = await file.text();
  const archive = archiveFromFileText(file, text);
  const integrity = await verifyArchiveIntegrity(archive);
  const analysis = await analyzeImportArchive(archive);

  if (!analysis.validRows && !analysis.rules) {
    setStatus("No importable history records or rules found");
    return;
  }

  appState.stagedImport = {
    archive,
    analysis,
    fileName: file.name,
    integrity
  };
  renderImportPreview();
  switchTab("backup");
  setStatus("Review import preview");
}

function renderImportPreview() {
  renderImportPreviewUi(importPreviewElements(), appState.stagedImport);
}

function cancelStagedImport() {
  appState.stagedImport = null;
  renderImportPreview();
  setStatus("Import canceled");
}

async function confirmStagedImport() {
  if (!appState.stagedImport) {
    setStatus("Choose an archive first");
    return;
  }

  const { archive, integrity } = appState.stagedImport;
  if (integrity.checked && !integrity.ok && !confirm("This archive checksum does not match. Import anyway?")) {
    setStatus("Import canceled");
    return;
  }

  setStatus("Importing archive");
  const result = await importArchive(archive);
  appState.stagedImport = null;
  renderImportPreview();
  await refreshStats();
  await renderRules();
  await runSearch();
  const integrityLabel = integrity.checked
    ? integrity.ok
      ? " with verified checksum"
      : " after checksum warning"
    : "";
  const ruleLabel = result.rules ? ` and ${result.rules} rule${result.rules === 1 ? "" : "s"}` : "";
  setStatus(`Imported ${result.visits} records${ruleLabel}${integrityLabel}`);
}

async function deleteFromVault() {
  const ids = [...appState.selectedIds];
  if (!ids.length) {
    setStatus("Select records first");
    return;
  }

  if (!confirm(`Delete ${ids.length} selected records from BrowseVault?`)) {
    return;
  }

  const deleted = await markDeletedByIds(ids);
  appState.selectedIds.clear();
  await refreshStats();
  await runSearch();
  setStatus(`Deleted ${deleted} records from vault`);
}

async function deleteFromChrome() {
  const items = await selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const urls = uniqueUrlsForItems(items);

  if (!confirm(`Delete ${urls.length} selected URL${urls.length === 1 ? "" : "s"} from Chrome history and ${items.length} selected record${items.length === 1 ? "" : "s"} from BrowseVault? Chrome deletion removes history by URL.`)) {
    return;
  }

  const response = await sendRuntimeMessage({
    type: BACKGROUND_MESSAGE_TYPES.DELETE_CHROME_URLS,
    urls
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Chrome deletion failed.");
  }

  const deleted = await markDeletedByIds(items.map((item) => item.id));
  appState.selectedIds.clear();
  await refreshStats();
  await runSearch();
  setStatus(`Deleted ${deleted} records from Chrome and vault`);
}

async function undoVaultDelete() {
  const stats = await getStats();
  const ids = stats.meta.lastVaultDelete?.ids || [];

  if (!ids.length) {
    setStatus("No vault delete to undo");
    return;
  }

  const restored = await restoreDeletedByIds(ids);
  await refreshStats();
  await runSearch();
  setStatus(`Restored ${restored} vault records`);
}

async function addRule(type) {
  await addDomainRule(type, elements.ruleDomain.value);
  elements.ruleDomain.value = "";
  await renderRules();
  setStatus(`Added ${type} rule`);
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

async function resetVault() {
  if (!confirm("Erase all BrowseVault local archive data, rules, and backup metadata? This will not delete Chrome history.")) {
    return;
  }

  await clearVaultData();
  appState.currentResults = [];
  appState.currentTotal = 0;
  appState.selectedIds.clear();
  elements.quickResults.replaceChildren();
  await refreshStats();
  await renderRules();
  await runSearch();
  setStatus("BrowseVault local data erased");
}

function bindEvents() {
  bindAppEvents({
    elements,
    document,
    root: document.documentElement,
    handlers: {
      addBlacklistRule: () => addRule("blacklist"),
      addWhitelistRule: () => addRule("whitelist"),
      blacklistSelectedDomains,
      cancelStagedImport,
      clearSelection: clearVisibleSelection,
      confirmStagedImport,
      copySelectedUrls,
      deleteFromChrome,
      deleteFromVault,
      exportAll,
      exportCsv,
      exportHtml,
      exportSelected,
      exportSelectedCsv,
      exportSelectedHtml,
      focusSearchInput,
      importFromFile,
      invertVisibleSelection,
      loadMoreResults,
      openSelected,
      resetVault,
      runQuickSearch,
      runSearchesNow,
      savePreferences,
      scheduleSearches,
      selectAllFiltered,
      selectVisible: selectVisibleResults,
      setStatus,
      switchTab,
      syncChromeHistory,
      undoVaultDelete
    }
  });
}

async function init() {
  await loadPreferences();
  bindEvents();
  elements.query.focus();
  await refreshStats();
  await renderRules();
  await runSearch();
  await runQuickSearch();
}

init().catch((error) => setStatus(error.message));
