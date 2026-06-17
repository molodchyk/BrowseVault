function escapeCsv(value) {
  const text = neutralizeSpreadsheetFormula(String(value ?? ""));
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function neutralizeSpreadsheetFormula(text) {
  return /^[=+\-@\t\r\n]/.test(text) || /^\s+[=+\-@]/.test(text) ? `'${text}` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const SAFE_LINK_PROTOCOLS = new Set([
  "about:",
  "chrome:",
  "chrome-extension:",
  "edge:",
  "file:",
  "ftp:",
  "http:",
  "https:"
]);

function dateFromTimestamp(timestamp) {
  const date = new Date(Number(timestamp));
  return Number.isFinite(date.getTime()) ? date : null;
}

function isoDateString(timestamp) {
  return dateFromTimestamp(timestamp)?.toISOString() ?? "";
}

function localDateParts(timestamp) {
  const date = dateFromTimestamp(timestamp);
  if (!date) {
    return {
      date: "",
      time: ""
    };
  }

  return {
    date: new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date)
  };
}

function localDateTime(timestamp) {
  return dateFromTimestamp(timestamp)?.toLocaleString() ?? "";
}

function safeLinkHref(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? text : "";
  } catch {
    return "";
  }
}

function uniqueDomainCount(visits) {
  return new Set(visits.map((visit) => visit.domain).filter(Boolean)).size;
}

function visitRange(visits) {
  const timestamps = visits
    .map((visit) => dateFromTimestamp(visit.visitTime)?.getTime())
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((a, b) => a - b);

  if (!timestamps.length) {
    return {
      oldest: "",
      newest: ""
    };
  }

  return {
    oldest: localDateTime(timestamps[0]),
    newest: localDateTime(timestamps[timestamps.length - 1])
  };
}

function pageCell(visit) {
  const url = String(visit.url ?? "");
  const href = safeLinkHref(url);
  const title = visit.title || url || "Untitled page";
  const titleHtml = escapeHtml(title);
  const urlHtml = url ? `<div class="url">${escapeHtml(url)}</div>` : "";
  const unsafeNote = url && !href ? `<div class="warning">Link disabled for unsupported URL scheme.</div>` : "";

  if (!href) {
    return `<span class="page-title">${titleHtml}</span>${urlHtml}${unsafeNote}`;
  }

  return `<a class="page-title" href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${titleHtml}</a>${urlHtml}`;
}

export function visitsToCsv(visits) {
  const headers = [
    "visitId",
    "visitTimeIso",
    "visitDate",
    "visitTimeLocal",
    "visitTimestampMs",
    "domain",
    "category",
    "title",
    "url",
    "visitCount",
    "transition",
    "source",
    "chromeId"
  ];

  const rows = visits.map((visit) => {
    const local = localDateParts(visit.visitTime);
    return [
      visit.id,
      isoDateString(visit.visitTime),
      local.date,
      local.time,
      visit.visitTime,
      visit.domain,
      visit.category,
      visit.title,
      visit.url,
      visit.visitCount,
      visit.transition,
      visit.source,
      visit.chromeId
    ];
  });

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function visitsToHtml(visits, exportedAt) {
  const range = visitRange(visits);
  const exportedIso = isoDateString(Date.parse(exportedAt));
  const exportedLocal = localDateTime(Date.parse(exportedAt)) || exportedAt;
  const rows = visits
    .map((visit) => {
      const visitDate = dateFromTimestamp(visit.visitTime);
      const visitTimestamp = visitDate?.getTime() ?? "";
      const visitIso = visitDate?.toISOString() ?? "";
      const visitLocal = visitDate?.toLocaleString() ?? "";
      const titleSort = visit.title || visit.url || "";

      return `<tr>
        <td data-label="Visited" data-sort="${escapeHtml(visitTimestamp)}"><time datetime="${escapeHtml(visitIso)}">${escapeHtml(visitLocal)}</time><div class="muted">${escapeHtml(visitIso)}</div></td>
        <td data-label="Domain" data-sort="${escapeHtml(visit.domain)}">${escapeHtml(visit.domain)}</td>
        <td data-label="Category" data-sort="${escapeHtml(visit.category)}">${escapeHtml(visit.category)}</td>
        <td data-label="Page" data-sort="${escapeHtml(titleSort)}">${pageCell(visit)}</td>
        <td data-label="Visits" data-sort="${escapeHtml(visit.visitCount)}">${escapeHtml(visit.visitCount)}</td>
        <td data-label="Transition" data-sort="${escapeHtml(visit.transition)}">${escapeHtml(visit.transition)}</td>
        <td data-label="Source" data-sort="${escapeHtml(visit.source)}">${escapeHtml(visit.source)}</td>
        <td data-label="Visit ID" data-sort="${escapeHtml(visit.id)}"><code>${escapeHtml(visit.id)}</code></td>
        <td data-label="Chrome ID" data-sort="${escapeHtml(visit.chromeId)}"><code>${escapeHtml(visit.chromeId)}</code></td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BrowseVault History Export</title>
  <style>
    :root { color-scheme: light dark; --border: #d0d7de; --muted: #57606a; --accent: #0969da; --surface: #f6f8fa; }
    @media (prefers-color-scheme: dark) {
      :root { --border: #30363d; --muted: #8b949e; --accent: #58a6ff; --surface: #161b22; }
    }
    body { font-family: system-ui, sans-serif; line-height: 1.45; margin: 24px; }
    header { max-width: 1120px; margin: 0 auto 20px; }
    h1 { margin: 0 0 8px; }
    .summary, .tools, .table-wrap { max-width: 1120px; margin: 0 auto 16px; }
    .summary { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .metric { border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
    .metric strong { display: block; font-size: 1.25rem; }
    .muted, .url { color: var(--muted); font-size: 0.875rem; overflow-wrap: anywhere; }
    .warning { color: #9a6700; font-size: 0.875rem; }
    .tools { display: grid; gap: 8px; }
    input { border: 1px solid var(--border); border-radius: 6px; font: inherit; padding: 10px 12px; }
    table { border-collapse: collapse; width: 100%; }
    caption { font-weight: 700; margin-bottom: 8px; text-align: left; }
    th, td { border: 1px solid var(--border); padding: 8px; text-align: left; vertical-align: top; }
    th { background: var(--surface); position: sticky; top: 0; }
    th button { all: unset; color: inherit; cursor: pointer; font-weight: 700; }
    th button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    a { color: var(--accent); }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
    @media (max-width: 720px) {
      body { margin: 16px; }
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; padding: 8px; }
      td { border: 0; padding: 6px 0; }
      td::before { color: var(--muted); content: attr(data-label); display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
    }
  </style>
</head>
<body>
  <header>
    <h1>BrowseVault History Export</h1>
    <p>Exported <time datetime="${escapeHtml(exportedIso)}">${escapeHtml(exportedLocal)}</time>. This file is self-contained and works offline.</p>
  </header>
  <section class="summary" aria-label="Export summary">
    <div class="metric"><strong>${visits.length}</strong><span>records</span></div>
    <div class="metric"><strong>${uniqueDomainCount(visits)}</strong><span>domains</span></div>
    <div class="metric"><strong>${escapeHtml(range.newest || "Unknown")}</strong><span>newest visit</span></div>
    <div class="metric"><strong>${escapeHtml(range.oldest || "Unknown")}</strong><span>oldest visit</span></div>
  </section>
  <section class="tools" aria-label="Report tools">
    <label for="report-filter">Filter within this export</label>
    <input id="report-filter" type="search" autocomplete="off" placeholder="Title, URL, domain, source, transition, or id">
    <p id="filter-count">${visits.length} of ${visits.length} records shown. Click a column heading to sort.</p>
  </section>
  <div class="table-wrap">
  <table id="visits">
    <caption>History records</caption>
    <thead><tr><th><button type="button" data-sort-type="number">Visited</button></th><th><button type="button" data-sort-type="text">Domain</button></th><th><button type="button" data-sort-type="text">Category</button></th><th><button type="button" data-sort-type="text">Page</button></th><th><button type="button" data-sort-type="number">Visits</button></th><th><button type="button" data-sort-type="text">Transition</button></th><th><button type="button" data-sort-type="text">Source</button></th><th><button type="button" data-sort-type="text">Visit ID</button></th><th><button type="button" data-sort-type="text">Chrome ID</button></th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  </div>
  <script>
    (() => {
      const table = document.getElementById("visits");
      const tbody = table.tBodies[0];
      const rows = Array.from(tbody.rows);
      const filter = document.getElementById("report-filter");
      const count = document.getElementById("filter-count");
      const rowText = new Map(rows.map((row) => [row, row.textContent.toLocaleLowerCase()]));

      function updateCount() {
        const shown = rows.filter((row) => !row.hidden).length;
        count.textContent = shown + " of " + rows.length + " records shown. Click a column heading to sort.";
      }

      filter.addEventListener("input", () => {
        const query = filter.value.trim().toLocaleLowerCase();
        for (const row of rows) {
          row.hidden = Boolean(query) && !rowText.get(row).includes(query);
        }
        updateCount();
      });

      table.querySelectorAll("th button").forEach((button, index) => {
        button.addEventListener("click", () => {
          const type = button.dataset.sortType;
          const direction = button.dataset.direction === "asc" ? "desc" : "asc";
          table.querySelectorAll("th button").forEach((item) => delete item.dataset.direction);
          button.dataset.direction = direction;
          const sorted = [...rows].sort((left, right) => {
            const leftValue = left.cells[index]?.dataset.sort ?? "";
            const rightValue = right.cells[index]?.dataset.sort ?? "";
            const comparison = type === "number"
              ? Number(leftValue || 0) - Number(rightValue || 0)
              : leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
            return direction === "asc" ? comparison : -comparison;
          });
          tbody.replaceChildren(...sorted);
        });
      });
    })();
  </script>
</body>
</html>`;
}
