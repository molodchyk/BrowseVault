function hashString(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 100000000000000) {
      return Math.floor(value / 1000);
    }
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return normalizeTimestamp(Number(value.trim()));
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function makeVisitId(url, visitTime) {
  return `${Math.round(visitTime)}-${hashString(url || "")}`;
}

export function normalizeHistoryItem(item, options = {}) {
  const url = item.url || "";
  const visitTime = normalizeTimestamp(item.visitTime || item.lastVisitTime || Date.now());
  const title = item.title || "";
  const domain = normalizeDomain(url);
  const hasChromeVisitId = item.id && item.id.includes("|");
  const hasExplicitChromeId = Object.prototype.hasOwnProperty.call(item, "chromeId");

  return {
    id: hasChromeVisitId ? item.id : makeVisitId(url, visitTime),
    chromeId: hasExplicitChromeId ? item.chromeId || "" : item.id || "",
    url,
    normalizedUrl: url.toLowerCase(),
    title,
    normalizedTitle: title.toLowerCase(),
    domain,
    visitTime,
    lastVisitTime: normalizeTimestamp(item.lastVisitTime || visitTime),
    visitCount: Number(item.visitCount || 1),
    typedCount: Number(item.typedCount || 0),
    transition: item.transition || item.transitionType || "",
    visitId: item.visitId || "",
    referringVisitId: item.referringVisitId || "",
    source: options.source || item.source || "import",
    sourceReason: options.reason || item.sourceReason || "",
    importedAt: item.importedAt || null,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: item.deletedAt || null,
    chromeDeletedAt: item.chromeDeletedAt || null
  };
}
