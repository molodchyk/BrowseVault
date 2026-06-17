export const ACTIVITY_LOG_META = "activityLog";
export const MAX_ACTIVITY_EVENTS = 50;

const DEFAULT_LABELS = {
  backup: "Backup",
  cleanup: "Cleanup",
  delete: "Delete",
  export: "Export",
  import: "Import",
  reset: "Reset",
  restore: "Restore",
  rule: "Rule"
};

function cleanText(value, maxLength = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function normalizeTimestamp(value, now) {
  const fallback = now.toISOString();
  if (!value) {
    return fallback;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function hashText(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeActivityEvent(event, now = new Date()) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const type = cleanText(event.type, 32).toLowerCase();
  if (!type) {
    return null;
  }

  const occurredAt = normalizeTimestamp(event.occurredAt, now);
  const label = cleanText(event.label, 80) || DEFAULT_LABELS[type] || "Activity";
  const detail = cleanText(event.detail, 160);
  const count = normalizeCount(event.count);

  return {
    id: cleanText(event.id, 80) || `${occurredAt}-${type}-${hashText(`${label}|${detail}|${count ?? ""}`)}`,
    type,
    label,
    detail,
    count,
    occurredAt
  };
}

export function normalizeActivityLog(events, options = {}) {
  const now = options.now || new Date();
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : MAX_ACTIVITY_EVENTS;
  const seen = new Set();
  const normalized = [];

  for (const event of Array.isArray(events) ? events : []) {
    const next = normalizeActivityEvent(event, now);
    if (!next || seen.has(next.id)) {
      continue;
    }
    seen.add(next.id);
    normalized.push(next);
  }

  return normalized
    .sort((first, second) => Date.parse(second.occurredAt) - Date.parse(first.occurredAt))
    .slice(0, limit);
}

export function activityEventSummary(event) {
  const count = event?.count === null || event?.count === undefined ? "" : ` (${event.count})`;
  const detail = event?.detail ? ` - ${event.detail}` : "";
  return `${event?.label || "Activity"}${count}${detail}`;
}
