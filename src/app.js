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

const elements = {
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".tab-panel")],
  query: document.querySelector("#query"),
  onDate: document.querySelector("#on-date"),
  after: document.querySelector("#after"),
  before: document.querySelector("#before"),
  limit: document.querySelector("#limit"),
  search: document.querySelector("#search"),
  quickSearch: document.querySelector("#quick-search"),
  clearSearch: document.querySelector("#clear-search"),
  syncChrome: document.querySelector("#sync-chrome"),
  exportJson: document.querySelector("#export-json"),
  exportCsv: document.querySelector("#export-csv"),
  exportHtml: document.querySelector("#export-html"),
  importArchive: document.querySelector("#import-archive"),
  importPreview: document.querySelector("#import-preview"),
  importPreviewTitle: document.querySelector("#import-preview-title"),
  importValid: document.querySelector("#import-valid"),
  importNew: document.querySelector("#import-new"),
  importExisting: document.querySelector("#import-existing"),
  importDuplicates: document.querySelector("#import-duplicates"),
  importHealth: document.querySelector("#import-health"),
  importPreviewNote: document.querySelector("#import-preview-note"),
  confirmImport: document.querySelector("#confirm-import"),
  cancelImport: document.querySelector("#cancel-import"),
  resetVault: document.querySelector("#reset-vault"),
  openSelected: document.querySelector("#open-selected"),
  copySelected: document.querySelector("#copy-selected"),
  exportSelected: document.querySelector("#export-selected"),
  exportSelectedCsv: document.querySelector("#export-selected-csv"),
  exportSelectedHtml: document.querySelector("#export-selected-html"),
  blacklistSelected: document.querySelector("#blacklist-selected"),
  deleteVault: document.querySelector("#delete-vault"),
  deleteChrome: document.querySelector("#delete-chrome"),
  undoDelete: document.querySelector("#undo-delete"),
  selectVisible: document.querySelector("#select-visible"),
  invertVisible: document.querySelector("#invert-visible"),
  selectFiltered: document.querySelector("#select-filtered"),
  loadMore: document.querySelector("#load-more"),
  clearSelection: document.querySelector("#clear-selection"),
  selectionActions: [...document.querySelectorAll(".requires-selection")],
  resultCount: document.querySelector("#result-count"),
  selectedCount: document.querySelector("#selected-count"),
  status: document.querySelector("#status"),
  results: document.querySelector("#results"),
  quickResults: document.querySelector("#quick-results"),
  resultTemplate: document.querySelector("#result-template"),
  quickResultTemplate: document.querySelector("#quick-result-template"),
  statVisits: document.querySelector("#stat-visits"),
  statDomains: document.querySelector("#stat-domains"),
  statNewest: document.querySelector("#stat-newest"),
  statBackup: document.querySelector("#stat-backup"),
  backupHealth: document.querySelector("#backup-health"),
  backupLast: document.querySelector("#backup-last"),
  backupFormat: document.querySelector("#backup-format"),
  backupRecords: document.querySelector("#backup-records"),
  backupChecksum: document.querySelector("#backup-checksum"),
  ruleDomain: document.querySelector("#rule-domain"),
  addBlacklist: document.querySelector("#add-blacklist"),
  addWhitelist: document.querySelector("#add-whitelist"),
  rulesList: document.querySelector("#rules-list"),
  prefTheme: document.querySelector("#pref-theme"),
  prefAccent: document.querySelector("#pref-accent"),
  prefDateFormat: document.querySelector("#pref-date-format"),
  prefLimit: document.querySelector("#pref-limit"),
  savePreferences: document.querySelector("#save-preferences")
};

let currentResults = [];
let currentTotal = 0;
let currentShownLimit = DEFAULT_PREFERENCES.defaultLimit;
let selectedIds = new Set();
let lastCheckedIndex = null;
let preferences = { ...DEFAULT_PREFERENCES };
let stagedImport = null;
let searchDebounceTimer = null;
let historySearchRequestId = 0;
let quickSearchRequestId = 0;

function renderBackupStatus(backup) {
  const status = backupStatusDetails(backup, {
    dateFormat: preferences.dateFormat
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
  return clampResultLimit(elements.limit.value || preferences.defaultLimit);
}

function quickResultLimit() {
  return Math.min(requestedResultLimit(), 100);
}

async function loadPreferences() {
  const result = await getLocalStorage(PREFERENCES_KEY);
  preferences = normalizePreferences(result[PREFERENCES_KEY]);
  applyPreferences();
}

async function savePreferences() {
  preferences = normalizePreferences({
    theme: elements.prefTheme.value,
    accent: elements.prefAccent.value,
    dateFormat: elements.prefDateFormat.value,
    defaultLimit: elements.prefLimit.value
  });

  await setLocalStorage({
    [PREFERENCES_KEY]: preferences
  });
  elements.limit.value = String(preferences.defaultLimit);
  applyPreferences();
  await refreshStats();
  await runSearchesNow();
  setStatus("Settings saved");
}

function applyPreferences() {
  const root = document.documentElement;
  root.dataset.theme = themeDatasetValue(preferences.theme);
  root.dataset.accent = preferences.accent;

  elements.prefTheme.value = preferences.theme;
  elements.prefAccent.value = preferences.accent;
  elements.prefDateFormat.value = preferences.dateFormat;
  elements.prefLimit.value = String(preferences.defaultLimit);

  if (!elements.limit.value || Number(elements.limit.value) === DEFAULT_PREFERENCES.defaultLimit) {
    elements.limit.value = String(preferences.defaultLimit);
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

function isEditableTarget(target) {
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName || "");
}

function clearSearchDebounce() {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

async function runSearchesNow() {
  clearSearchDebounce();
  await runSearch();
  await runQuickSearch();
}

function scheduleSearches() {
  clearSearchDebounce();
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null;
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
  elements.selectedCount.textContent = selectedCountLabel(selectedIds.size);

  const hasSelection = selectedIds.size > 0;
  for (const action of elements.selectionActions) {
    action.hidden = !hasSelection;
  }
}

function updateLoadMoreButton() {
  const shown = currentResults.length;
  const state = loadMoreState({
    total: currentTotal,
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
  return getVisitsByIds([...selectedIds]);
}

function applyResultSelection({ selectedIds: nextSelectedIds, lastCheckedIndex: nextLastCheckedIndex, shouldRerender }) {
  selectedIds = nextSelectedIds;
  lastCheckedIndex = nextLastCheckedIndex;

  if (shouldRerender) {
    renderResults(currentResults, currentTotal);
    return;
  }

  updateSelectionCount();
}

function renderResults(results, total) {
  currentResults = results;
  currentTotal = total;

  renderHistoryResults({
    results,
    total,
    queryText: getSearchText(),
    selectedIds,
    dateFormat: preferences.dateFormat,
    elements: {
      resultCount: elements.resultCount,
      results: elements.results,
      resultTemplate: elements.resultTemplate
    },
    getSelectionState: () => ({ selectedIds, lastCheckedIndex }),
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
    appendHighlightedText(meta, `${item.detail} · ${item.domain || "unknown domain"} · ${formatDate(item.visitTime, preferences.dateFormat)}`, metaTokens, query.regex);
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
  const requestId = ++quickSearchRequestId;
  const searchText = getSearchText();
  const limit = quickResultLimit();
  setStatus("Searching browser sources");
  const { results, total, warnings } = await searchBrowserMemory(searchText, {
    limit
  });

  if (requestId !== quickSearchRequestId) {
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
  elements.statNewest.textContent = formatShortDate(stats.newestVisitTime, preferences.dateFormat);
  elements.statBackup.textContent = stats.meta.lastBackup?.exportedAt
    ? formatShortDate(Date.parse(stats.meta.lastBackup.exportedAt), preferences.dateFormat)
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
  const requestId = ++historySearchRequestId;
  setStatus("Searching local vault");
  currentShownLimit = requestedResultLimit();
  const searchText = getSearchText();
  const limit = currentShownLimit;

  try {
    const { results, total } = await searchVisits(searchText, {
      limit
    });

    if (requestId !== historySearchRequestId) {
      return;
    }

    selectedIds = reconcileSelectedIds(selectedIds, results);
    renderResults(results, total);
    setStatus("Ready");
  } catch (error) {
    if (requestId === historySearchRequestId) {
      setStatus(error.message);
    }
  }
}

async function loadMoreResults() {
  if (currentResults.length >= currentTotal || currentResults.length >= MAX_RESULT_LIMIT) {
    setStatus("All loaded results are visible");
    updateLoadMoreButton();
    return;
  }

  const step = requestedResultLimit();
  currentShownLimit = Math.min(currentResults.length + step, currentTotal, MAX_RESULT_LIMIT);
  setStatus("Loading more results");
  const requestId = ++historySearchRequestId;

  const { results, total } = await searchVisits(getSearchText(), {
    limit: currentShownLimit
  });

  if (requestId !== historySearchRequestId) {
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

  stagedImport = {
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
  renderImportPreviewUi(importPreviewElements(), stagedImport);
}

function cancelStagedImport() {
  stagedImport = null;
  renderImportPreview();
  setStatus("Import canceled");
}

async function confirmStagedImport() {
  if (!stagedImport) {
    setStatus("Choose an archive first");
    return;
  }

  const { archive, integrity } = stagedImport;
  if (integrity.checked && !integrity.ok && !confirm("This archive checksum does not match. Import anyway?")) {
    setStatus("Import canceled");
    return;
  }

  setStatus("Importing archive");
  const result = await importArchive(archive);
  stagedImport = null;
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
  const ids = [...selectedIds];
  if (!ids.length) {
    setStatus("Select records first");
    return;
  }

  if (!confirm(`Delete ${ids.length} selected records from BrowseVault?`)) {
    return;
  }

  const deleted = await markDeletedByIds(ids);
  selectedIds.clear();
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
  selectedIds.clear();
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
  selectedIds = selectedIdsForResults(results);
  renderResults(currentResults, currentTotal);
  setStatus(`Selected ${total} matching vault records`);
}

function invertVisibleSelection() {
  if (!currentResults.length) {
    setStatus("No visible results to invert");
    return;
  }

  selectedIds = invertSelectionForResults(selectedIds, currentResults);

  renderResults(currentResults, currentTotal);
  setStatus(`Inverted ${currentResults.length} visible results`);
}

async function resetVault() {
  if (!confirm("Erase all BrowseVault local archive data, rules, and backup metadata? This will not delete Chrome history.")) {
    return;
  }

  await clearVaultData();
  currentResults = [];
  currentTotal = 0;
  selectedIds.clear();
  elements.quickResults.replaceChildren();
  await refreshStats();
  await renderRules();
  await runSearch();
  setStatus("BrowseVault local data erased");
}

function bindEvents() {
  for (const tab of elements.tabs) {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  }
  elements.prefTheme.addEventListener("change", () => {
    document.documentElement.dataset.theme = elements.prefTheme.value === "system" ? "" : elements.prefTheme.value;
  });
  elements.prefAccent.addEventListener("change", () => {
    document.documentElement.dataset.accent = elements.prefAccent.value;
  });
  elements.savePreferences.addEventListener("click", () => savePreferences().catch((error) => setStatus(error.message)));
  elements.search.addEventListener("click", () => runSearchesNow().catch((error) => setStatus(error.message)));
  elements.quickSearch.addEventListener("click", () => runQuickSearch().catch((error) => setStatus(error.message)));
  elements.clearSearch.addEventListener("click", () => {
    elements.query.value = "";
    elements.onDate.value = "";
    elements.after.value = "";
    elements.before.value = "";
    runSearchesNow().catch((error) => setStatus(error.message));
  });
  for (const input of [elements.query, elements.onDate, elements.after, elements.before, elements.limit]) {
    input.addEventListener("input", scheduleSearches);
  }
  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runSearchesNow().catch((error) => setStatus(error.message));
    }
  });
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      focusSearchInput();
      return;
    }

    if (event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey && !isEditableTarget(event.target)) {
      event.preventDefault();
      focusSearchInput();
    }
  });
  elements.syncChrome.addEventListener("click", () => syncChromeHistory().catch((error) => setStatus(error.message)));
  elements.exportJson.addEventListener("click", () => exportAll().catch((error) => setStatus(error.message)));
  elements.exportCsv.addEventListener("click", () => exportCsv().catch((error) => setStatus(error.message)));
  elements.exportHtml.addEventListener("click", () => exportHtml().catch((error) => setStatus(error.message)));
  elements.openSelected.addEventListener("click", () => openSelected().catch((error) => setStatus(error.message)));
  elements.copySelected.addEventListener("click", () => copySelectedUrls().catch((error) => setStatus(error.message)));
  elements.exportSelected.addEventListener("click", () => exportSelected().catch((error) => setStatus(error.message)));
  elements.exportSelectedCsv.addEventListener("click", () => exportSelectedCsv().catch((error) => setStatus(error.message)));
  elements.exportSelectedHtml.addEventListener("click", () => exportSelectedHtml().catch((error) => setStatus(error.message)));
  elements.blacklistSelected.addEventListener("click", () => blacklistSelectedDomains().catch((error) => setStatus(error.message)));
  elements.deleteVault.addEventListener("click", () => deleteFromVault().catch((error) => setStatus(error.message)));
  elements.deleteChrome.addEventListener("click", () => deleteFromChrome().catch((error) => setStatus(error.message)));
  elements.undoDelete.addEventListener("click", () => undoVaultDelete().catch((error) => setStatus(error.message)));
  elements.selectVisible.addEventListener("click", () => {
    selectedIds = selectedIdsForResults(currentResults);
    renderResults(currentResults, currentTotal);
  });
  elements.invertVisible.addEventListener("click", invertVisibleSelection);
  elements.selectFiltered.addEventListener("click", () => selectAllFiltered().catch((error) => setStatus(error.message)));
  elements.loadMore.addEventListener("click", () => loadMoreResults().catch((error) => setStatus(error.message)));
  elements.clearSelection.addEventListener("click", () => {
    selectedIds.clear();
    renderResults(currentResults, currentTotal);
  });
  elements.importArchive.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) {
      importFromFile(file).catch((error) => setStatus(error.message));
    }
    event.target.value = "";
  });
  elements.confirmImport.addEventListener("click", () => confirmStagedImport().catch((error) => setStatus(error.message)));
  elements.cancelImport.addEventListener("click", cancelStagedImport);
  elements.addBlacklist.addEventListener("click", () => addRule("blacklist").catch((error) => setStatus(error.message)));
  elements.addWhitelist.addEventListener("click", () => addRule("whitelist").catch((error) => setStatus(error.message)));
  elements.resetVault.addEventListener("click", () => resetVault().catch((error) => setStatus(error.message)));
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
