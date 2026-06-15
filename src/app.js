import {
  addDomainRule,
  exportArchive,
  getRules,
  getStats,
  importArchive,
  markDeletedByIds,
  removeRule,
  restoreDeletedByIds,
  searchVisits,
  setMeta
} from "./storage.js";

const elements = {
  query: document.querySelector("#query"),
  after: document.querySelector("#after"),
  before: document.querySelector("#before"),
  limit: document.querySelector("#limit"),
  search: document.querySelector("#search"),
  clearSearch: document.querySelector("#clear-search"),
  syncChrome: document.querySelector("#sync-chrome"),
  exportJson: document.querySelector("#export-json"),
  exportCsv: document.querySelector("#export-csv"),
  exportHtml: document.querySelector("#export-html"),
  importArchive: document.querySelector("#import-archive"),
  exportSelected: document.querySelector("#export-selected"),
  deleteVault: document.querySelector("#delete-vault"),
  deleteChrome: document.querySelector("#delete-chrome"),
  undoDelete: document.querySelector("#undo-delete"),
  selectVisible: document.querySelector("#select-visible"),
  clearSelection: document.querySelector("#clear-selection"),
  resultCount: document.querySelector("#result-count"),
  selectedCount: document.querySelector("#selected-count"),
  status: document.querySelector("#status"),
  results: document.querySelector("#results"),
  resultTemplate: document.querySelector("#result-template"),
  statVisits: document.querySelector("#stat-visits"),
  statDomains: document.querySelector("#stat-domains"),
  statNewest: document.querySelector("#stat-newest"),
  statBackup: document.querySelector("#stat-backup"),
  ruleDomain: document.querySelector("#rule-domain"),
  addBlacklist: document.querySelector("#add-blacklist"),
  addWhitelist: document.querySelector("#add-whitelist"),
  rulesList: document.querySelector("#rules-list")
};

let currentResults = [];
let currentTotal = 0;
let selectedIds = new Set();
let lastCheckedIndex = null;

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  return new Date(value).toLocaleString();
}

function formatShortDate(value) {
  if (!value) {
    return "No visits yet";
  }

  return new Date(value).toLocaleDateString();
}

function setStatus(message) {
  elements.status.textContent = message;
}

function getSearchText() {
  const parts = [elements.query.value.trim()];

  if (elements.after.value) {
    parts.push(`after:${elements.after.value}`);
  }

  if (elements.before.value) {
    parts.push(`before:${elements.before.value}`);
  }

  return parts.filter(Boolean).join(" ");
}

function updateSelectionCount() {
  elements.selectedCount.textContent = `${selectedIds.size} selected`;
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

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

function visitsToCsv(visits) {
  const headers = [
    "visitTimeIso",
    "visitTime",
    "domain",
    "title",
    "url",
    "visitCount",
    "transition",
    "source"
  ];

  const rows = visits.map((visit) => [
    new Date(visit.visitTime).toISOString(),
    visit.visitTime,
    visit.domain,
    visit.title,
    visit.url,
    visit.visitCount,
    visit.transition,
    visit.source
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
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
      url: row.url || row.uri || row.link,
      title: row.title || row.name || row.pagetitle || "",
      visitTime: row.visittime || row.lastvisittime || row.time || row.timestamp || row.date || row.datetime,
      visitCount: row.visitcount || row.visits || 1,
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

function selectedResults() {
  return currentResults.filter((result) => selectedIds.has(result.id));
}

function renderResults(results, total) {
  currentResults = results;
  currentTotal = total;
  elements.resultCount.textContent = `${total} result${total === 1 ? "" : "s"} (${results.length} shown)`;
  elements.results.replaceChildren();

  results.forEach((item, index) => {
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
    title.textContent = item.title || item.url;
    url.textContent = item.url;
    meta.textContent = `${item.domain || "unknown domain"} · ${formatDate(item.visitTime)} · ${item.visitCount || 0} visits · ${item.source}`;

    elements.results.append(fragment);
  });

  updateSelectionCount();
}

async function refreshStats() {
  const stats = await getStats();
  elements.statVisits.textContent = String(stats.visits);
  elements.statDomains.textContent = String(stats.domains);
  elements.statNewest.textContent = formatShortDate(stats.newestVisitTime);
  elements.statBackup.textContent = stats.meta.lastBackup?.exportedAt
    ? formatShortDate(Date.parse(stats.meta.lastBackup.exportedAt))
    : "Never";
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
  setStatus("Searching local vault");

  try {
    const { results, total } = await searchVisits(getSearchText(), {
      limit: Number(elements.limit.value || 500)
    });

    selectedIds = new Set([...selectedIds].filter((id) => results.some((result) => result.id === id)));
    renderResults(results, total);
    setStatus("Ready");
  } catch (error) {
    setStatus(error.message);
  }
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
  const items = selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const archive = await attachIntegrity(await exportArchive(items));
  downloadJson(`browsevault-selected-${archive.exportedAt.slice(0, 10)}.json`, archive);
  setStatus(`Exported ${items.length} selected records`);
}

async function importFromFile(file) {
  setStatus("Importing archive");
  const text = await file.text();
  const archive = archiveFromFileText(file, text);
  const integrity = await verifyArchiveIntegrity(archive);
  const visitCount = Array.isArray(archive?.visits)
    ? archive.visits.length
    : Array.isArray(archive?.items)
      ? archive.items.length
      : Array.isArray(archive?.["Browser History"])
        ? archive["Browser History"].length
      : 0;

  if (integrity.checked && !integrity.ok && !confirm("This archive checksum does not match. Import anyway?")) {
    setStatus("Import canceled");
    return;
  }

  if (!confirm(`Import ${visitCount} records from ${archive?.app || "this archive"}?`)) {
    setStatus("Import canceled");
    return;
  }

  const result = await importArchive(archive);
  await refreshStats();
  await renderRules();
  await runSearch();
  setStatus(`Imported ${result.visits} records${integrity.checked ? " with verified checksum" : ""}`);
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
  const items = selectedResults();
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

function bindEvents() {
  elements.search.addEventListener("click", runSearch);
  elements.clearSearch.addEventListener("click", () => {
    elements.query.value = "";
    elements.after.value = "";
    elements.before.value = "";
    runSearch();
  });
  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runSearch();
    }
  });
  elements.syncChrome.addEventListener("click", () => syncChromeHistory().catch((error) => setStatus(error.message)));
  elements.exportJson.addEventListener("click", () => exportAll().catch((error) => setStatus(error.message)));
  elements.exportCsv.addEventListener("click", () => exportCsv().catch((error) => setStatus(error.message)));
  elements.exportHtml.addEventListener("click", () => exportHtml().catch((error) => setStatus(error.message)));
  elements.exportSelected.addEventListener("click", () => exportSelected().catch((error) => setStatus(error.message)));
  elements.deleteVault.addEventListener("click", () => deleteFromVault().catch((error) => setStatus(error.message)));
  elements.deleteChrome.addEventListener("click", () => deleteFromChrome().catch((error) => setStatus(error.message)));
  elements.undoDelete.addEventListener("click", () => undoVaultDelete().catch((error) => setStatus(error.message)));
  elements.selectVisible.addEventListener("click", () => {
    selectedIds = new Set(currentResults.map((result) => result.id));
    renderResults(currentResults, currentTotal);
  });
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
  elements.addBlacklist.addEventListener("click", () => addRule("blacklist").catch((error) => setStatus(error.message)));
  elements.addWhitelist.addEventListener("click", () => addRule("whitelist").catch((error) => setStatus(error.message)));
}

async function init() {
  bindEvents();
  elements.query.focus();
  await refreshStats();
  await renderRules();
  await runSearch();
}

init().catch((error) => setStatus(error.message));
