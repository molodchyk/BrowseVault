import {
  isoDateString,
  normalizeChunkSize,
  yieldToEventLoop
} from "./shared-format.js";

const CSV_HEADERS = [
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

function neutralizeSpreadsheetFormula(text) {
  return /^[=+\-@\t\r\n]/.test(text) || /^\s+[=+\-@]/.test(text) ? `'${text}` : text;
}

function escapeCsv(value) {
  const text = neutralizeSpreadsheetFormula(String(value ?? ""));
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function localDateParts(timestamp) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) {
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

function visitToCsvRow(visit) {
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
}

function rowToCsvLine(row) {
  return row.map(escapeCsv).join(",");
}

export function visitsToCsv(visits) {
  return [CSV_HEADERS, ...visits.map(visitToCsvRow)].map(rowToCsvLine).join("\n");
}

export async function visitsToCsvAsync(visits, options = {}) {
  const items = Array.isArray(visits) ? visits : [];
  const chunkSize = normalizeChunkSize(options.chunkSize);
  const scheduler = options.scheduler || yieldToEventLoop;
  const lines = [rowToCsvLine(CSV_HEADERS)];

  for (let start = 0; start < items.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, items.length);
    for (let index = start; index < end; index += 1) {
      lines.push(rowToCsvLine(visitToCsvRow(items[index])));
    }
    if (end < items.length) {
      await scheduler();
    }
  }

  return lines.join("\n");
}
