import { normalizeHistoryItem } from "../../vault-management/core/history-records.js";

export function createChromeHistorySyncPlan(items, existingVisits = [], options = {}) {
  const existing = Array.isArray(existingVisits) ? existingVisits : [];
  const existingById = new Map(existing.map((record) => [record.id, record]));
  const nextById = new Map(existingById);
  const records = [];

  for (const item of items) {
    if (!item.url) {
      continue;
    }

    const record = normalizeHistoryItem(item, options);
    const previous = existingById.get(record.id);

    records.push({
      ...previous,
      ...record,
      createdAt: previous?.createdAt || record.createdAt,
      deletedAt: previous?.deletedAt || null
    });
    nextById.set(record.id, records[records.length - 1]);
  }

  return {
    scanned: items.length,
    stored: records.length,
    total: [...nextById.values()].filter((visit) => !visit.deletedAt).length,
    records
  };
}
