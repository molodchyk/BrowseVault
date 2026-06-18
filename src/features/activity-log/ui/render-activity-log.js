import {
  activityEventSummary,
  normalizeActivityLog
} from "../core/activity-log.js";

export function renderActivityLog(list, events, options = {}) {
  const documentRef = options.document || globalThis.document;
  const emptyText = options.emptyText || "No activity logged yet.";
  const formatDate = options.formatDate || ((timestamp) => new Date(timestamp).toLocaleString());
  const normalized = normalizeActivityLog(events);

  list.replaceChildren();

  if (!normalized.length) {
    const empty = documentRef.createElement("li");
    empty.className = "activity-item is-empty";
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }

  for (const event of normalized.slice(0, 8)) {
    const item = documentRef.createElement("li");
    item.className = "activity-item";

    const summary = documentRef.createElement("strong");
    summary.textContent = activityEventSummary(event);

    const timestamp = documentRef.createElement("span");
    timestamp.textContent = formatDate(Date.parse(event.occurredAt));

    item.append(summary, timestamp);
    list.append(item);
  }
}
