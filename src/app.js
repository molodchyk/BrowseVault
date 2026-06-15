import {
  addDomainRule,
  exportArchive,
  getRules,
  getStats,
  importArchive,
  markDeletedByIds,
  removeRule,
  searchVisits
} from "./storage.js";

const elements = {
  query: document.querySelector("#query"),
  after: document.querySelector("#after"),
  before: document.querySelector("#before"),
  limit: document.querySelector("#limit"),
  search: document.querySelector("#search"),
  clearSearch: document.querySelector("#clear-search"),
  syncChrome: document.querySelector("#sync-chrome"),
  exportArchive: document.querySelector("#export-archive"),
  importArchive: document.querySelector("#import-archive"),
  exportSelected: document.querySelector("#export-selected"),
  deleteVault: document.querySelector("#delete-vault"),
  deleteChrome: document.querySelector("#delete-chrome"),
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
  const archive = await exportArchive();
  downloadJson(`browsevault-archive-${archive.exportedAt.slice(0, 10)}.json`, archive);
  setStatus("Exported archive");
}

async function exportSelected() {
  const items = selectedResults();
  if (!items.length) {
    setStatus("Select records first");
    return;
  }

  const archive = await exportArchive(items);
  downloadJson(`browsevault-selected-${archive.exportedAt.slice(0, 10)}.json`, archive);
  setStatus(`Exported ${items.length} selected records`);
}

async function importFromFile(file) {
  setStatus("Importing archive");
  const text = await file.text();
  const archive = JSON.parse(text);
  const result = await importArchive(archive);
  await refreshStats();
  await renderRules();
  await runSearch();
  setStatus(`Imported ${result.visits} records`);
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
  elements.exportArchive.addEventListener("click", () => exportAll().catch((error) => setStatus(error.message)));
  elements.exportSelected.addEventListener("click", () => exportSelected().catch((error) => setStatus(error.message)));
  elements.deleteVault.addEventListener("click", () => deleteFromVault().catch((error) => setStatus(error.message)));
  elements.deleteChrome.addEventListener("click", () => deleteFromChrome().catch((error) => setStatus(error.message)));
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
