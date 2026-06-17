import { normalizeImportVisitCandidates } from "./import-normalization.js";

export function parseDelimitedRows(text, delimiter) {
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

export function delimitedArchiveFromText(text, delimiter, source) {
  const rows = parseDelimitedRows(text, delimiter);
  const headers = (rows.shift() || []).map(normalizeHeader);
  const rowsAsObjects = rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]))
  );
  const visits = normalizeImportVisitCandidates(rowsAsObjects, source);

  return {
    app: source,
    schemaVersion: 1,
    visits
  };
}

export function archiveFromFileText(file, text) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    return delimitedArchiveFromText(text, ",", "csv-import");
  }

  if (lowerName.endsWith(".tsv")) {
    return delimitedArchiveFromText(text, "\t", "tsv-import");
  }

  return JSON.parse(text);
}
