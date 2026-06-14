const elements = {
  query: document.querySelector("#query"),
  search: document.querySelector("#search"),
  exportJson: document.querySelector("#export-json"),
  resultCount: document.querySelector("#result-count"),
  status: document.querySelector("#status"),
  results: document.querySelector("#results")
};

let currentResults = [];

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  return new Date(value).toLocaleString();
}

function setStatus(message) {
  elements.status.textContent = message;
}

function renderResults(results) {
  currentResults = results;
  elements.resultCount.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
  elements.results.replaceChildren();

  for (const item of results) {
    const result = document.createElement("li");
    result.className = "result";

    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.title || item.url;
    link.target = "_blank";
    link.rel = "noreferrer";

    const url = document.createElement("div");
    url.className = "url";
    url.textContent = item.url;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Last visited ${formatDate(item.lastVisitTime)} · ${item.visitCount || 0} visits`;

    result.append(link, url, meta);
    elements.results.append(result);
  }
}

async function searchHistory() {
  const text = elements.query.value.trim();
  setStatus("Searching");

  try {
    const results = await chrome.history.search({
      text,
      startTime: 0,
      maxResults: 250
    });

    renderResults(results);
    setStatus("Ready");
  } catch (error) {
    setStatus(error.message);
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

async function exportJson() {
  setStatus("Preparing export");

  if (currentResults.length === 0) {
    await searchHistory();
  }

  const exportedAt = new Date().toISOString();
  downloadJson(`browsevault-history-${exportedAt.slice(0, 10)}.json`, {
    app: "BrowseVault",
    schemaVersion: 1,
    exportedAt,
    resultCount: currentResults.length,
    items: currentResults
  });

  setStatus("Exported JSON");
}

elements.search.addEventListener("click", searchHistory);
elements.exportJson.addEventListener("click", exportJson);
elements.query.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchHistory();
  }
});

elements.query.focus();
searchHistory();

