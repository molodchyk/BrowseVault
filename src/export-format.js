function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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
