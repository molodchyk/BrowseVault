function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function localDateParts(timestamp) {
  const date = new Date(timestamp);
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

export function visitsToCsv(visits) {
  const headers = [
    "visitId",
    "visitTimeIso",
    "visitDate",
    "visitTimeLocal",
    "visitTimestampMs",
    "domain",
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
      new Date(visit.visitTime).toISOString(),
      local.date,
      local.time,
      visit.visitTime,
      visit.domain,
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
  const rows = visits
    .map(
      (visit) =>
        `<tr><td>${escapeHtml(new Date(visit.visitTime).toLocaleString())}</td><td>${escapeHtml(visit.domain)}</td><td><a href="${escapeHtml(visit.url)}">${escapeHtml(visit.title || visit.url)}</a></td><td>${escapeHtml(visit.source)}</td></tr>`
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
