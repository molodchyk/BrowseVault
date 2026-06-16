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
import { visitsToCsv } from "./export-format.js";
import { parseQuery } from "./query.js";

const PREFERENCES_KEY = "browseVault.preferences";
const DEFAULT_PREFERENCES = {
  theme: "system",
  accent: "teal",
  dateFormat: "system",
  defaultLimit: 500
};
const MAX_RESULT_LIMIT = 50000;
const OPEN_SELECTED_LIMIT = 25;
const BACKUP_STALE_DAYS = 30;
const MAX_HIGHLIGHT_TOKENS = 12;
const MAX_HIGHLIGHT_RANGES = 80;
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
  importPreviewNote: document.querySelector("#import-preview-note"),
  confirmImport: document.querySelector("#confirm-import"),
  cancelImport: document.querySelector("#cancel-import"),
  resetVault: document.querySelector("#reset-vault"),
  openSelected: document.querySelector("#open-selected"),
  copySelected: document.querySelector("#copy-selected"),
  exportSelected: document.querySelector("#export-selected"),
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

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (preferences.dateFormat === "iso") {
    return `${date.toISOString().slice(0, 10)} ${date.toTimeString().slice(0, 5)}`;
  }

  const datePart = formatShortDate(value);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  return `${datePart}, ${timePart}`;
}

function formatShortDate(value) {
  if (!value) {
    return "No visits yet";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (preferences.dateFormat === "iso") {
    return `${year}-${month}-${day}`;
  }

  if (preferences.dateFormat === "dmy") {
    return `${day}/${month}/${year}`;
  }

  if (preferences.dateFormat === "mdy") {
    return `${month}/${day}/${year}`;
  }

  if (preferences.dateFormat === "ymd") {
    return `${year}/${month}/${day}`;
  }

  return new Intl.DateTimeFormat(undefined).format(date);
}

function localDayKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayHeading(value) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(value));
  return `${weekday} · ${formatShortDate(value)}`;
}

function formatCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString() : "0";
}

function formatChecksum(value) {
  if (!value) {
    return "Not available";
  }

  return value.length > 24 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

function backupTimestamp(backup) {
  if (!backup?.exportedAt) {
    return 0;
  }

  const timestamp = Date.parse(backup.exportedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function renderBackupStatus(backup) {
  const timestamp = backupTimestamp(backup);

  if (!timestamp) {
    elements.backupHealth.textContent = "No backup yet";
    elements.backupHealth.classList.add("is-warning");
    elements.backupHealth.classList.remove("is-ok");
    elements.backupLast.textContent = "Never";
    elements.backupFormat.textContent = "-";
    elements.backupRecords.textContent = "0";
    elements.backupChecksum.textContent = "Not available";
    return;
  }

  const ageDays = Math.floor((Date.now() - timestamp) / 86400000);
  const isStale = ageDays > BACKUP_STALE_DAYS;
  elements.backupHealth.textContent = isStale
    ? `Backup older than ${BACKUP_STALE_DAYS} days`
    : "Backup current";
  elements.backupHealth.classList.toggle("is-warning", isStale);
  elements.backupHealth.classList.toggle("is-ok", !isStale);
  elements.backupLast.textContent = formatDate(timestamp);
  elements.backupFormat.textContent = String(backup.format || "unknown").toUpperCase();
  elements.backupRecords.textContent = formatCount(backup.records);
  elements.backupChecksum.textContent = formatChecksum(backup.sha256);
}

function setStatus(message) {
  elements.status.textContent = message;
}

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PREFERENCES.defaultLimit;
  }

  return Math.min(MAX_RESULT_LIMIT, Math.max(25, Math.round(parsed)));
}

function requestedResultLimit() {
  return clampLimit(elements.limit.value || preferences.defaultLimit);
}

function quickResultLimit() {
  return Math.min(requestedResultLimit(), 100);
}

async function loadPreferences() {
  const result = await chrome.storage.local.get(PREFERENCES_KEY);
  preferences = {
    ...DEFAULT_PREFERENCES,
    ...(result[PREFERENCES_KEY] || {})
  };
  preferences.defaultLimit = clampLimit(preferences.defaultLimit);
  applyPreferences();
}

async function savePreferences() {
  preferences = {
    theme: elements.prefTheme.value,
    accent: elements.prefAccent.value,
    dateFormat: elements.prefDateFormat.value,
    defaultLimit: clampLimit(elements.prefLimit.value)
  };

  await chrome.storage.local.set({
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
  root.dataset.theme = preferences.theme === "system" ? "" : preferences.theme;
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
  elements.selectedCount.textContent = `${selectedIds.size} selected`;

  const hasSelection = selectedIds.size > 0;
  for (const action of elements.selectionActions) {
    action.hidden = !hasSelection;
  }
}

function updateLoadMoreButton() {
  const shown = currentResults.length;
  const canLoadMore = currentTotal > shown && shown < MAX_RESULT_LIMIT;
  elements.loadMore.hidden = !canLoadMore;

  if (canLoadMore) {
    const nextCount = Math.min(requestedResultLimit(), currentTotal - shown, MAX_RESULT_LIMIT - shown);
    elements.loadMore.textContent = `Load ${nextCount} More`;
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

function uniqueUrlsForItems(items) {
  return [...new Set(items.map((item) => item.url).filter(Boolean))];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function visitsToHtml(visits, exportedAt) {
  const rows = visits
    .map(
      (visit) => `<tr><td>${escapeHtml(new Date(visit.visitTime).toLocaleString())}</td><td>${escapeHtml(visit.domain)}</td><td><a href="${escapeHtml(visit.url)}">${escapeHtml(visit.title || visit.url)}</a></td><td>${escapeHtml(visit.source)}</td></tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BrowseVault Export</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d0d7de; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f6f8fa; }
    a { color: #0969da; }
  </style>
</head>
<body>
  <h1>BrowseVault Export</h1>
  <p>Exported ${escapeHtml(exportedAt)} with ${visits.length} records.</p>
  <table>
    <thead><tr><th>Visited</th><th>Domain</th><th>Page</th><th>Source</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function delimitedArchiveFromText(text, delimiter, source) {
  const rows = parseDelimitedRows(text, delimiter);
  const headers = (rows.shift() || []).map(normalizeHeader);
  const visits = rows
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])))
    .map((row) => ({
      id: row.visitid,
      chromeId: row.chromeid,
      url: row.url || row.uri || row.link,
      title: row.title || row.name || row.pagetitle || "",
      visitTime: row.visittimestampms || row.visittimeiso || row.visittime || row.lastvisittime || row.time || row.timestamp || row.date || row.datetime,
      visitCount: row.visitcount || row.visits || 1,
      transition: row.transition,
      source
    }))
    .filter((visit) => visit.url);

  return {
    app: source,
    schemaVersion: 1,
    visits
  };
}

function archiveFromFileText(file, text) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return delimitedArchiveFromText(text, ",", "csv-import");
  }

  if (lowerName.endsWith(".tsv")) {
    return delimitedArchiveFromText(text, "\t", "tsv-import");
  }

  return JSON.parse(text);
}

async function selectedResults() {
  return getVisitsByIds([...selectedIds]);
}

function highlightTokensForScope(query, scope) {
  const shared = [...query.terms, ...query.phrases];
  const scoped = scope === "title"
    ? query.title
    : scope === "url"
      ? [...query.url, ...query.site]
      : query.site;

  return [...new Set([...shared, ...scoped]
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .slice(0, MAX_HIGHLIGHT_TOKENS);
}

function regexHighlightRanges(text, regex) {
  if (!regex) {
    return [];
  }

  try {
    const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
    const matcher = new RegExp(regex.source, flags);
    const ranges = [];
    let match = matcher.exec(text);

    while (match && ranges.length < MAX_HIGHLIGHT_RANGES) {
      if (match[0].length) {
        ranges.push([match.index, match.index + match[0].length]);
      } else {
        matcher.lastIndex += 1;
      }
      match = matcher.exec(text);
    }

    return ranges;
  } catch {
    return [];
  }
}

function highlightRanges(text, tokens, regex) {
  const lowerText = text.toLowerCase();
  const ranges = regexHighlightRanges(text, regex);

  for (const token of tokens) {
    let cursor = 0;
    while (ranges.length < MAX_HIGHLIGHT_RANGES) {
      const index = lowerText.indexOf(token, cursor);
      if (index === -1) {
        break;
      }
      ranges.push([index, index + token.length]);
      cursor = index + Math.max(token.length, 1);
    }
  }

  if (!ranges.length) {
    return [];
  }

  ranges.sort((left, right) => left[0] - right[0] || right[1] - left[1]);
  const merged = [];
  for (const [start, end] of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

function appendHighlightedText(target, value, tokens, regex) {
  const text = String(value || "");
  target.replaceChildren();

  if (!text || (!tokens.length && !regex)) {
    target.textContent = text;
    return;
  }

  const ranges = highlightRanges(text, tokens, regex);
  if (!ranges.length) {
    target.textContent = text;
    return;
  }

  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) {
      target.append(document.createTextNode(text.slice(cursor, start)));
    }

    const mark = document.createElement("mark");
    mark.className = "search-hit";
    mark.textContent = text.slice(start, end);
    target.append(mark);
    cursor = end;
  }

  if (cursor < text.length) {
    target.append(document.createTextNode(text.slice(cursor)));
  }
}

function renderResults(results, total) {
  currentResults = results;
  currentTotal = total;
  const query = parseQuery(getSearchText());
  const titleTokens = highlightTokensForScope(query, "title");
  const urlTokens = highlightTokensForScope(query, "url");
  const metaTokens = highlightTokensForScope(query, "meta");
  const dayCounts = new Map();
  for (const result of results) {
    const key = localDayKey(result.visitTime);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
  }
  let currentDayKey = "";

  elements.resultCount.textContent = `${total} result${total === 1 ? "" : "s"} (${results.length} shown)`;
  elements.results.replaceChildren();

  results.forEach((item, index) => {
    const itemDayKey = localDayKey(item.visitTime);
    if (itemDayKey !== currentDayKey) {
      const day = document.createElement("li");
      day.className = "result-day";
      day.setAttribute("aria-label", `Results for ${formatDayHeading(item.visitTime)}`);

      const label = document.createElement("span");
      label.textContent = formatDayHeading(item.visitTime);

      const count = document.createElement("span");
      const dayCount = dayCounts.get(itemDayKey) || 0;
      count.textContent = `${dayCount} record${dayCount === 1 ? "" : "s"} shown`;

      day.append(label, " ", count);
      elements.results.append(day);
      currentDayKey = itemDayKey;
    }

    const fragment = elements.resultTemplate.content.cloneNode(true);
    const result = fragment.querySelector(".result");
    const checkbox = fragment.querySelector(".result-check");
    const title = fragment.querySelector(".result-title");
    const url = fragment.querySelector(".url");
    const meta = fragment.querySelector(".meta");

    result.dataset.id = item.id;
    checkbox.checked = selectedIds.has(item.id);
    checkbox.addEventListener("click", (event) => {
      if (event.shiftKey && lastCheckedIndex !== null) {
        const start = Math.min(lastCheckedIndex, index);
        const end = Math.max(lastCheckedIndex, index);
        const shouldSelect = checkbox.checked;

        for (const resultItem of results.slice(start, end + 1)) {
          if (shouldSelect) {
            selectedIds.add(resultItem.id);
          } else {
            selectedIds.delete(resultItem.id);
          }
        }

        renderResults(currentResults, total);
        updateSelectionCount();
        return;
      }

      lastCheckedIndex = index;
      if (checkbox.checked) {
        selectedIds.add(item.id);
      } else {
        selectedIds.delete(item.id);
      }
      updateSelectionCount();
    });

    title.href = item.url;
    appendHighlightedText(title, item.title || item.url, titleTokens, query.regex);
    appendHighlightedText(url, item.url, urlTokens, query.regex);
    appendHighlightedText(
      meta,
      `${item.domain || "unknown domain"} · ${formatDate(item.visitTime)} · ${item.visitCount || 0} visits · ${item.source}`,
      metaTokens,
      query.regex
    );

    elements.results.append(fragment);
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
    appendHighlightedText(meta, `${item.detail} · ${item.domain || "unknown domain"} · ${formatDate(item.visitTime)}`, metaTokens, query.regex);
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
      type: "browseVault.activateTab",
      tabId: action.tabId,
      windowId: action.windowId
    },
    "restore-session": {
      type: "browseVault.restoreSession",
      sessionId: action.sessionId
    },
    "open-url": {
      type: "browseVault.openUrl",
      url: action.url || item.url
    }
  };

  const response = await chrome.runtime.sendMessage(messageByType[action.type] || messageByType["open-url"]);
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

  const response = await chrome.runtime.sendMessage({
    type: "browseVault.openUrls",
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
  elements.statNewest.textContent = formatShortDate(stats.newestVisitTime);
  elements.statBackup.textContent = stats.meta.lastBackup?.exportedAt
    ? formatShortDate(Date.parse(stats.meta.lastBackup.exportedAt))
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

    selectedIds = new Set([...selectedIds].filter((id) => results.some((result) => result.id === id)));
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
  const response = await chrome.runtime.sendMessage({
    type: "browseVault.bootstrapChromeHistory"
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
  setStatus(`Exported ${items.length} selected records`);
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
  if (!stagedImport) {
    elements.importPreview.hidden = true;
    return;
  }

  const { analysis, fileName, integrity } = stagedImport;
  const checksum = integrity.checked
    ? integrity.ok
      ? "Checksum verified."
      : "Checksum mismatch. Import only if you trust this file."
    : "No checksum included.";

  elements.importPreviewTitle.textContent = `${fileName} from ${analysis.sourceApp}`;
  elements.importValid.textContent = String(analysis.validRows);
  elements.importNew.textContent = String(analysis.newVisits);
  elements.importExisting.textContent = String(analysis.existingVisits);
  elements.importDuplicates.textContent = String(analysis.duplicateRows);
  elements.importPreviewNote.textContent = [
    `${analysis.rows} rows scanned.`,
    analysis.invalidRows ? `${analysis.invalidRows} rows without URLs will be skipped.` : "",
    analysis.rules ? `${analysis.rules} domain rules will be imported or updated.` : "",
    checksum
  ]
    .filter(Boolean)
    .join(" ");
  elements.importPreview.hidden = false;
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

  const urls = [...new Set(items.map((item) => item.url))];

  if (!confirm(`Delete ${urls.length} selected URL${urls.length === 1 ? "" : "s"} from Chrome history and ${items.length} selected record${items.length === 1 ? "" : "s"} from BrowseVault? Chrome deletion removes history by URL.`)) {
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "browseVault.deleteChromeUrls",
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
  selectedIds = new Set(results.map((result) => result.id));
  renderResults(currentResults, currentTotal);
  setStatus(`Selected ${total} matching vault records`);
}

function invertVisibleSelection() {
  if (!currentResults.length) {
    setStatus("No visible results to invert");
    return;
  }

  for (const result of currentResults) {
    if (selectedIds.has(result.id)) {
      selectedIds.delete(result.id);
    } else {
      selectedIds.add(result.id);
    }
  }

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
  elements.deleteVault.addEventListener("click", () => deleteFromVault().catch((error) => setStatus(error.message)));
  elements.deleteChrome.addEventListener("click", () => deleteFromChrome().catch((error) => setStatus(error.message)));
  elements.undoDelete.addEventListener("click", () => undoVaultDelete().catch((error) => setStatus(error.message)));
  elements.selectVisible.addEventListener("click", () => {
    selectedIds = new Set(currentResults.map((result) => result.id));
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
