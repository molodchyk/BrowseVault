import {
  activityEventSummary,
  normalizeActivityLog
} from "../core/activity-log.js";
import {
  activityLabelMessageKeys,
  activityTypeMessageKeys
} from "./localization-keys.js";

function localizedActivityLabel(event, getMessage) {
  const labelKey = activityLabelMessageKeys.get(event?.label);
  const typeKey = activityTypeMessageKeys.get(event?.type);
  const fallback = event?.label || getMessage?.("activityFallbackLabel") || "Activity";

  return (labelKey ? getMessage?.(labelKey) : "")
    || (typeKey ? getMessage?.(typeKey) : "")
    || fallback;
}

function localizedActivitySummary(event, getMessage) {
  if (!getMessage) {
    return activityEventSummary(event);
  }

  const localizedEvent = {
    ...event,
    label: localizedActivityLabel(event, getMessage)
  };
  return activityEventSummary(localizedEvent);
}

export function renderActivityLog(list, events, options = {}) {
  const documentRef = options.document || globalThis.document;
  const emptyText = options.emptyText || "No activity logged yet.";
  const formatDate = options.formatDate || ((timestamp) => new Date(timestamp).toLocaleString());
  const getMessage = options.getMessage || (() => "");
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
    summary.textContent = localizedActivitySummary(event, getMessage);

    const timestamp = documentRef.createElement("span");
    timestamp.textContent = formatDate(Date.parse(event.occurredAt));

    item.append(summary, timestamp);
    list.append(item);
  }
}
