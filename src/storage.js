import {
  ACTIVITY_LOG_META,
  MAX_ACTIVITY_EVENTS,
  normalizeActivityEvent,
  normalizeActivityLog
} from "./features/activity-log/core/activity-log.js";
import {
  extractImportVisits,
  importArchiveSource
} from "./features/backup-import/core/import-normalization.js";
import {
  normalizeSavedSearches,
  removeSavedSearch as removeSavedSearchFromList,
  upsertSavedSearch
} from "./features/history-results/core/saved-searches.js";
import { searchVisitRecords } from "./features/history-results/core/search-index.js";

const DB_NAME = "browsevault";
const DB_VERSION = 1;
const VISIT_STORE = "visits";
const META_STORE = "meta";
const RULE_STORE = "rules";
const DEFAULT_RESULT_LIMIT = 500;
const SAVED_SEARCHES_META = "savedSearches";
const STORAGE_SELF_CHECK_META = "lastStorageSelfCheck";
const DAY_MS = 86400000;

let dbPromise;

export function openVaultDb() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(VISIT_STORE)) {
        const visits = db.createObjectStore(VISIT_STORE, { keyPath: "id" });
        visits.createIndex("url", "url", { unique: false });
        visits.createIndex("domain", "domain", { unique: false });
        visits.createIndex("visitTime", "visitTime", { unique: false });
        visits.createIndex("deletedAt", "deletedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(RULE_STORE)) {
        db.createObjectStore(RULE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(storeName) {
  const db = await openVaultDb();
  const store = db.transaction(storeName, "readonly").objectStore(storeName);
  return requestToPromise(store.getAll());
}

async function putMany(storeName, records) {
  if (!records.length) {
    return 0;
  }

  const db = await openVaultDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  for (const record of records) {
    store.put(record);
  }

  await transactionDone(tx);

  return records.length;
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

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

export async function recordChromeVisit(item, options = {}) {
  const record = normalizeHistoryItem(item, options);
  await putMany(VISIT_STORE, [record]);
  return record;
}

export async function recordChromeVisitWithCaptureMetadata(item, options = {}) {
  const record = normalizeHistoryItem(item, options);
  const capturedAt = options.capturedAt || new Date().toISOString();
  const db = await openVaultDb();
  const tx = db.transaction([VISIT_STORE, META_STORE], "readwrite");

  tx.objectStore(VISIT_STORE).put(record);
  tx.objectStore(META_STORE).put({
    key: "lastLiveCapture",
    value: {
      capturedAt,
      title: item.title || "",
      url: item.url
    },
    updatedAt: capturedAt
  });

  await transactionDone(tx);
  return record;
}

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

async function writeChromeHistorySyncPlan(plan, metadata = null) {
  if (!plan.records.length && !metadata) {
    return;
  }

  const db = await openVaultDb();
  const tx = metadata
    ? db.transaction([VISIT_STORE, META_STORE], "readwrite")
    : db.transaction(VISIT_STORE, "readwrite");
  const visitStore = tx.objectStore(VISIT_STORE);

  for (const record of plan.records) {
    visitStore.put(record);
  }

  if (metadata) {
    tx.objectStore(META_STORE).put({
      key: "lastChromeSync",
      value: metadata,
      updatedAt: metadata.syncedAt
    });
  }

  await transactionDone(tx);
}

export async function syncChromeHistoryItems(items, options = {}) {
  const plan = createChromeHistorySyncPlan(items, await getAllVisits({ includeDeleted: true }), options);
  await writeChromeHistorySyncPlan(plan);

  return {
    scanned: plan.scanned,
    stored: plan.stored,
    total: plan.total
  };
}

export async function syncChromeHistoryItemsWithSyncMetadata(items, options = {}) {
  const syncedAt = options.syncedAt || new Date().toISOString();
  const plan = createChromeHistorySyncPlan(items, await getAllVisits({ includeDeleted: true }), options);
  const result = {
    scanned: plan.scanned,
    stored: plan.stored,
    total: plan.total
  };

  await writeChromeHistorySyncPlan(plan, {
    ...result,
    reason: options.reason || "",
    syncedAt
  });

  return result;
}

export async function getAllVisits(options = {}) {
  const visits = await getAll(VISIT_STORE);
  if (options.includeDeleted) {
    return visits;
  }

  return visits.filter((visit) => !visit.deletedAt);
}

export async function getVisitsByIds(ids) {
  const idSet = new Set(ids);
  const visits = await getAllVisits();
  return visits.filter((visit) => idSet.has(visit.id));
}

export async function countVisits() {
  return (await getAllVisits()).length;
}

export async function setMeta(key, value) {
  await putMany(META_STORE, [{ key, value, updatedAt: new Date().toISOString() }]);
}

export async function getMeta(key, fallback = null) {
  const db = await openVaultDb();
  const store = db.transaction(META_STORE, "readonly").objectStore(META_STORE);
  const record = await requestToPromise(store.get(key));
  return record?.value ?? fallback;
}

export async function getAllMeta() {
  const records = await getAll(META_STORE);
  return Object.fromEntries(records.map((record) => [record.key, record.value]));
}

export async function getSavedSearches() {
  return normalizeSavedSearches(await getMeta(SAVED_SEARCHES_META, []));
}

export async function getActivityLog() {
  return normalizeActivityLog(await getMeta(ACTIVITY_LOG_META, []));
}

export async function appendActivityLog(event) {
  const normalized = normalizeActivityEvent(event);
  if (!normalized) {
    return getActivityLog();
  }

  const current = await getActivityLog();
  const next = normalizeActivityLog([normalized, ...current], {
    limit: MAX_ACTIVITY_EVENTS
  });
  await setMeta(ACTIVITY_LOG_META, next);
  return next;
}

export async function saveSavedSearch(input) {
  const searches = upsertSavedSearch(await getSavedSearches(), input);
  await setMeta(SAVED_SEARCHES_META, searches);
  return searches;
}

export async function deleteSavedSearch(id) {
  const searches = removeSavedSearchFromList(await getSavedSearches(), id);
  await setMeta(SAVED_SEARCHES_META, searches);
  return searches;
}

export async function getRules() {
  const rules = await getAll(RULE_STORE);
  const blacklist = [];
  const whitelist = [];

  for (const rule of rules) {
    if (rule.type === "blacklist") {
      blacklist.push(rule.value);
    }
    if (rule.type === "whitelist") {
      whitelist.push(rule.value);
    }
  }

  return { blacklist, whitelist, rules };
}

export async function addDomainRule(type, value) {
  if (!["blacklist", "whitelist"].includes(type)) {
    throw new Error("Unsupported domain rule type.");
  }

  const normalized = normalizeRuleValue(value);
  if (!normalized) {
    throw new Error("Enter a domain first.");
  }

  const oppositeType = type === "blacklist" ? "whitelist" : "blacklist";
  const record = {
    id: `${type}:${normalized}`,
    type,
    value: normalized,
    createdAt: new Date().toISOString()
  };

  const db = await openVaultDb();
  const tx = db.transaction(RULE_STORE, "readwrite");
  const store = tx.objectStore(RULE_STORE);
  store.delete(`${oppositeType}:${normalized}`);
  store.put(record);
  await transactionDone(tx);

  return record;
}

function normalizeRuleValue(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/[^a-z0-9.-]/g, "");
}

export async function removeRule(id) {
  const db = await openVaultDb();
  const tx = db.transaction(RULE_STORE, "readwrite");
  tx.objectStore(RULE_STORE).delete(id);
  await transactionDone(tx);
}

export async function searchVisits(input = "", options = {}) {
  const visits = await getAllVisits();
  return searchVisitRecords(visits, input, {
    ...options,
    defaultLimit: DEFAULT_RESULT_LIMIT
  });
}

function hostMatchesRule(host, rule) {
  return host === rule || host.endsWith(`.${rule}`);
}

function visitMatchesWhitelist(visit, whitelist) {
  const domain = (visit.domain || normalizeDomain(visit.url || "")).toLowerCase();
  return Boolean(domain && whitelist.some((rule) => hostMatchesRule(domain, rule)));
}

function duplicateVisitKey(visit) {
  const url = String(visit.normalizedUrl || visit.url || "").trim().toLowerCase();
  const visitTime = Number(visit.visitTime);
  if (!url || !Number.isFinite(visitTime)) {
    return "";
  }

  return `${url}\n${Math.round(visitTime)}`;
}

function duplicateVisitQuality(visit) {
  return (
    String(visit.title || "").trim().length +
    (visit.chromeId ? 1000 : 0) +
    (visit.visitId ? 100 : 0) +
    Number(visit.visitCount || 0)
  );
}

function compareDuplicateKeepers(left, right) {
  const qualityDelta = duplicateVisitQuality(right) - duplicateVisitQuality(left);
  if (qualityDelta) {
    return qualityDelta;
  }

  const updatedDelta = Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "");
  if (Number.isFinite(updatedDelta) && updatedDelta) {
    return updatedDelta;
  }

  return String(left.id || "").localeCompare(String(right.id || ""));
}

export function duplicateCleanupCandidates(visits) {
  const groups = new Map();

  for (const visit of Array.isArray(visits) ? visits : []) {
    if (!visit || visit.deletedAt) {
      continue;
    }

    const key = duplicateVisitKey(visit);
    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(visit);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) => [...group].sort(compareDuplicateKeepers).slice(1));
}

export function summarizeVaultHealth(visits) {
  const allVisits = Array.isArray(visits) ? visits : [];
  let activeRecords = 0;
  let deletedRecords = 0;
  let chromeDeletedRecords = 0;
  let missingUrlRecords = 0;
  let invalidTimeRecords = 0;
  const duplicateGroups = new Map();

  for (const visit of allVisits) {
    if (!visit || visit.deletedAt) {
      deletedRecords += visit?.deletedAt ? 1 : 0;
      continue;
    }

    activeRecords += 1;
    if (visit.chromeDeletedAt) {
      chromeDeletedRecords += 1;
    }

    if (!visit.url) {
      missingUrlRecords += 1;
    }

    if (!Number.isFinite(Number(visit.visitTime))) {
      invalidTimeRecords += 1;
    }

    const key = duplicateVisitKey(visit);
    if (key) {
      duplicateGroups.set(key, (duplicateGroups.get(key) || 0) + 1);
    }
  }

  const duplicateActiveRecords = [...duplicateGroups.values()]
    .filter((count) => count > 1)
    .reduce((total, count) => total + count - 1, 0);
  const issueRecords = missingUrlRecords + invalidTimeRecords + duplicateActiveRecords;

  return {
    storedRows: allVisits.length,
    activeRecords,
    deletedRecords,
    chromeDeletedRecords,
    missingUrlRecords,
    invalidTimeRecords,
    duplicateActiveRecords,
    issueRecords
  };
}

function localDayKeyFromTimestamp(value) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortedCountEntries(counts, tieBreaker = "ascending") {
  const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

  return [...counts.entries()]
    .sort((left, right) => {
      const countDelta = right[1] - left[1];
      if (countDelta) {
        return countDelta;
      }

      return tieBreaker === "descending"
        ? compareText(String(right[0]), String(left[0]))
        : compareText(String(left[0]), String(right[0]));
    })
    .map(([value, count]) => ({ value, count }));
}

export function summarizeArchiveInsights(visits, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 3;
  const activeVisits = (Array.isArray(visits) ? visits : []).filter((visit) => {
    const visitTime = Number(visit?.visitTime);
    return visit && !visit.deletedAt && Number.isFinite(visitTime);
  });
  const domainCounts = new Map();
  const dayCounts = new Map();
  let oldestVisitTime = 0;
  let newestVisitTime = 0;

  for (const visit of activeVisits) {
    const visitTime = Number(visit.visitTime);
    const domain = (visit.domain || normalizeDomain(visit.url || "")).trim().toLowerCase();
    const day = localDayKeyFromTimestamp(visitTime);

    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    }

    if (day) {
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }

    newestVisitTime = newestVisitTime ? Math.max(newestVisitTime, visitTime) : visitTime;
    oldestVisitTime = oldestVisitTime ? Math.min(oldestVisitTime, visitTime) : visitTime;
  }

  return {
    totalVisits: activeVisits.length,
    activeDays: dayCounts.size,
    averageVisitsPerActiveDay: dayCounts.size ? activeVisits.length / dayCounts.size : 0,
    oldestVisitTime,
    newestVisitTime,
    topDomains: sortedCountEntries(domainCounts)
      .slice(0, limit)
      .map((entry) => ({
        domain: entry.value,
        count: entry.count
      })),
    busiestDays: sortedCountEntries(dayCounts, "descending")
      .slice(0, limit)
      .map((entry) => ({
        day: entry.value,
        count: entry.count
      }))
  };
}

export async function getDuplicateCleanupCandidates() {
  return duplicateCleanupCandidates(await getAllVisits());
}

export function retentionCleanupCandidates(visits, rules, options = {}) {
  const retentionDays = Number(options.retentionDays);
  const now = Number(options.now ?? Date.now());

  if (!Number.isInteger(retentionDays) || retentionDays < 1 || !Number.isFinite(now)) {
    return [];
  }

  const cutoff = now - retentionDays * DAY_MS;
  const whitelist = Array.isArray(rules?.whitelist) ? rules.whitelist : [];

  return visits.filter((visit) => {
    if (!visit || visit.deletedAt || !Number.isFinite(Number(visit.visitTime))) {
      return false;
    }

    return Number(visit.visitTime) < cutoff && !visitMatchesWhitelist(visit, whitelist);
  });
}

export async function getRetentionCleanupCandidates(retentionDays, options = {}) {
  return retentionCleanupCandidates(await getAllVisits(), await getRules(), {
    retentionDays,
    now: options.now
  });
}

export async function markDeletedByIds(ids, deletedAt = new Date().toISOString()) {
  const idSet = new Set(ids);
  const visits = await getAllVisits({ includeDeleted: true });
  const changed = visits
    .filter((visit) => idSet.has(visit.id))
    .map((visit) => ({
      ...visit,
      deletedAt,
      updatedAt: deletedAt
    }));

  await putMany(VISIT_STORE, changed);
  await setMeta("lastVaultDelete", {
    deletedAt,
    count: changed.length,
    ids: changed.map((visit) => visit.id)
  });
  return changed.length;
}

export async function restoreDeletedByIds(ids) {
  const idSet = new Set(ids);
  const restoredAt = new Date().toISOString();
  const visits = await getAllVisits({ includeDeleted: true });
  const changed = visits
    .filter((visit) => idSet.has(visit.id) && visit.deletedAt)
    .map((visit) => ({
      ...visit,
      deletedAt: null,
      updatedAt: restoredAt
    }));

  await putMany(VISIT_STORE, changed);
  await setMeta("lastVaultRestore", {
    restoredAt,
    count: changed.length,
    ids: changed.map((visit) => visit.id)
  });
  return changed.length;
}

export async function markChromeDeletedByUrls(urls, deletedAt = new Date().toISOString()) {
  const urlSet = new Set(urls);
  const visits = await getAllVisits({ includeDeleted: true });
  const changed = visits
    .filter((visit) => urlSet.has(visit.url))
    .map((visit) => ({
      ...visit,
      chromeDeletedAt: deletedAt,
      updatedAt: deletedAt
    }));

  await putMany(VISIT_STORE, changed);
  return changed.length;
}

export function archiveVisitsForExport(visits) {
  const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

  return [...(Array.isArray(visits) ? visits : [])].sort((left, right) => {
    const leftTime = Number(left?.visitTime);
    const rightTime = Number(right?.visitTime);
    const leftHasTime = Number.isFinite(leftTime);
    const rightHasTime = Number.isFinite(rightTime);

    if (leftHasTime && rightHasTime && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    if (leftHasTime !== rightHasTime) {
      return leftHasTime ? -1 : 1;
    }

    return [
      compareText(String(left?.url || ""), String(right?.url || "")),
      compareText(String(left?.title || ""), String(right?.title || "")),
      compareText(String(left?.id || ""), String(right?.id || ""))
    ].find((comparison) => comparison !== 0) || 0;
  });
}

export async function exportArchive(items = null, options = {}) {
  const sourceVisits = items || (await getAllVisits());
  const visits = options.preserveOrder
    ? [...(Array.isArray(sourceVisits) ? sourceVisits : [])]
    : archiveVisitsForExport(sourceVisits);
  return {
    app: "BrowseVault",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      visits: visits.length
    },
    meta: await getAllMeta(),
    rules: (await getRules()).rules,
    visits
  };
}

export async function runStorageSelfCheck(checkedAt = new Date().toISOString()) {
  const nonce = `${checkedAt}-${Math.random().toString(36).slice(2)}`;
  const result = {
    checkedAt,
    status: "passed",
    nonce
  };

  await setMeta(STORAGE_SELF_CHECK_META, result);

  const stored = await getMeta(STORAGE_SELF_CHECK_META);
  if (stored?.nonce !== nonce || stored?.status !== "passed") {
    throw new Error("Storage self-check failed.");
  }

  return stored;
}

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
    .filter((rule) => ["blacklist", "whitelist"].includes(rule?.type))
    .map((rule) => {
      const value = normalizeRuleValue(rule.value);
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

export async function analyzeImportArchive(archive) {
  const existingVisitIds = (await getAllVisits({ includeDeleted: true })).map((visit) => visit.id);
  return summarizeImportArchive(archive, existingVisitIds);
}

export async function importArchive(archive) {
  const importedAt = new Date().toISOString();
  const plan = createImportArchivePlan(archive, await getAllVisits({ includeDeleted: true }), importedAt);

  await writeImportArchivePlan(plan);

  return plan.result;
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

async function writeImportArchivePlan(plan) {
  const db = await openVaultDb();
  const tx = db.transaction([VISIT_STORE, RULE_STORE, META_STORE], "readwrite");
  const visitStore = tx.objectStore(VISIT_STORE);
  const ruleStore = tx.objectStore(RULE_STORE);
  const metaStore = tx.objectStore(META_STORE);
  const updatedAt = plan.metadata.importedAt;

  for (const record of plan.records) {
    visitStore.put(record);
  }

  for (const rule of plan.rules) {
    ruleStore.put(rule);
  }

  metaStore.put({
    key: "lastImport",
    value: plan.metadata,
    updatedAt
  });

  await transactionDone(tx);
}

export async function getStats(options = {}) {
  if (options.runStorageSelfCheck) {
    await runStorageSelfCheck();
  }

  const allVisits = await getAllVisits({ includeDeleted: true });
  const visits = allVisits.filter((visit) => !visit.deletedAt);
  const domains = new Set(visits.map((visit) => visit.domain).filter(Boolean));
  const meta = await getAllMeta();

  return {
    visits: visits.length,
    domains: domains.size,
    newestVisitTime: visits.reduce((max, visit) => Math.max(max, visit.visitTime || 0), 0),
    oldestVisitTime: visits.reduce((min, visit) => Math.min(min, visit.visitTime || Date.now()), Date.now()),
    insights: summarizeArchiveInsights(visits),
    vaultHealth: summarizeVaultHealth(allVisits),
    meta
  };
}

export async function clearVaultData() {
  const db = await openVaultDb();
  const tx = db.transaction([VISIT_STORE, META_STORE, RULE_STORE], "readwrite");

  tx.objectStore(VISIT_STORE).clear();
  tx.objectStore(META_STORE).clear();
  tx.objectStore(RULE_STORE).clear();

  await transactionDone(tx);
}
