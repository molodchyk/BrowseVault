import {
  extractImportVisits,
  importArchiveSource
} from "./import-normalization.js";
import {
  normalizeCategoryValue,
  normalizeRuleValue
} from "../../vault-management/core/domain-rules.js";
import { normalizeHistoryItem } from "../../vault-management/core/history-records.js";

function normalizeImportVisits(archive) {
  const visits = extractImportVisits(archive);

  return visits
    .filter((visit) => visit?.url)
    .map((visit) =>
      normalizeHistoryItem(
        {
          ...visit,
          visitTime: visit.visitTime || visit.lastVisitTime
        },
        {
          source: visit.source || "import",
          reason: "archive-import"
        }
      )
    );
}

export function mergeImportedVisits(existingVisits, importedVisits) {
  const currentById = new Map((Array.isArray(existingVisits) ? existingVisits : []).map((visit) => [visit.id, visit]));
  const mergedImportById = new Map();
  const importedOrder = [];

  for (const record of Array.isArray(importedVisits) ? importedVisits : []) {
    const previous = currentById.get(record.id);
    if (!previous) {
      currentById.set(record.id, record);
      if (!mergedImportById.has(record.id)) {
        importedOrder.push(record.id);
      }
      mergedImportById.set(record.id, record);
      continue;
    }

    const merged = {
      ...previous,
      ...record,
      deletedAt: previous.deletedAt || record.deletedAt || null,
      chromeDeletedAt: previous.chromeDeletedAt || record.chromeDeletedAt || null
    };
    if (previous.createdAt || record.createdAt) {
      merged.createdAt = previous.createdAt || record.createdAt;
    }
    currentById.set(record.id, merged);
    if (!mergedImportById.has(record.id)) {
      importedOrder.push(record.id);
    }
    mergedImportById.set(record.id, merged);
  }

  return importedOrder.map((id) => mergedImportById.get(id));
}

function normalizeImportRules(archive, importedAt = new Date().toISOString()) {
  if (!Array.isArray(archive?.rules)) {
    return [];
  }

  return archive.rules
    .filter((rule) => ["blacklist", "whitelist", "category"].includes(rule?.type))
    .map((rule) => {
      const value = normalizeRuleValue(rule.value);
      const category = normalizeCategoryValue(rule.category);
      if (rule.type === "category") {
        return value && category
          ? {
              id: `category:${value}`,
              type: "category",
              value,
              category,
              createdAt: rule.createdAt || importedAt
            }
          : null;
      }

      return value
        ? {
            id: `${rule.type}:${value}`,
            type: rule.type,
            value,
            createdAt: rule.createdAt || importedAt
          }
        : null;
    })
    .filter(Boolean);
}

export function summarizeImportArchive(archive, existingVisitIds = []) {
  const rawVisits = extractImportVisits(archive);
  const normalized = normalizeImportVisits(archive);
  const uniqueIds = new Set(normalized.map((visit) => visit.id));
  const existingIds = new Set(existingVisitIds);
  let existingVisits = 0;

  for (const id of uniqueIds) {
    if (existingIds.has(id)) {
      existingVisits += 1;
    }
  }

  return {
    sourceApp: importArchiveSource(archive),
    schemaVersion: archive?.schemaVersion || null,
    rows: rawVisits.length,
    validRows: normalized.length,
    invalidRows: rawVisits.length - normalized.length,
    uniqueVisits: uniqueIds.size,
    duplicateRows: normalized.length - uniqueIds.size,
    existingVisits,
    newVisits: uniqueIds.size - existingVisits,
    rules: normalizeImportRules(archive).length
  };
}

export function createImportArchivePlan(archive, existingVisits = [], importedAt = new Date().toISOString()) {
  const normalized = normalizeImportVisits(archive);
  const records = mergeImportedVisits(existingVisits, normalized);
  const duplicateRows = normalized.length - records.length;
  const rules = normalizeImportRules(archive, importedAt);
  const metadata = {
    importedAt,
    sourceApp: importArchiveSource(archive),
    schemaVersion: archive?.schemaVersion || null,
    visits: records.length,
    validRows: normalized.length,
    duplicateRows,
    rules: rules.length
  };

  return {
    records,
    rules,
    metadata,
    result: {
      importedAt,
      visits: records.length,
      validRows: normalized.length,
      duplicateRows,
      rules: rules.length
    }
  };
}
