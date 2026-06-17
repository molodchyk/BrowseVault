import {
  ACTIVITY_LOG_META,
  MAX_ACTIVITY_EVENTS,
  normalizeActivityEvent,
  normalizeActivityLog
} from "./features/activity-log/core/activity-log.js";
import {
  createImportArchivePlan,
  mergeImportedVisits,
  summarizeImportArchive
} from "./features/backup-import/core/archive-import-plan.js";
import {
  normalizeSavedSearches,
  removeSavedSearch as removeSavedSearchFromList,
  upsertSavedSearch
} from "./features/history-results/core/saved-searches.js";
import { searchVisitRecords } from "./features/history-results/core/search-index.js";
import {
  hostMatchesRule,
  normalizeCategoryValue,
  normalizeRuleValue
} from "./features/vault-management/core/domain-rules.js";
import {
  makeVisitId,
  normalizeDomain,
  normalizeHistoryItem
} from "./features/vault-management/core/history-records.js";

export {
  createImportArchivePlan,
  makeVisitId,
  mergeImportedVisits,
  normalizeDomain,
  normalizeHistoryItem,
  summarizeImportArchive
};

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
  const categories = [];

  for (const rule of rules) {
    if (rule.type === "blacklist") {
      blacklist.push(rule.value);
    }
    if (rule.type === "whitelist") {
      whitelist.push(rule.value);
    }
    if (rule.type === "category" && rule.value && rule.category) {
      categories.push({
        id: rule.id,
        value: rule.value,
        category: rule.category
      });
    }
  }

  return { blacklist, whitelist, categories, rules };
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

export async function addCategoryRule(domainValue, categoryValue) {
  const value = normalizeRuleValue(domainValue);
  const category = normalizeCategoryValue(categoryValue);
  if (!value || !category) {
    throw new Error("Enter a domain and category first.");
  }

  const record = {
    id: `category:${value}`,
    type: "category",
    value,
    category,
    createdAt: new Date().toISOString()
  };

  await putMany(RULE_STORE, [record]);
  return record;
}

export async function removeRule(id) {
  const db = await openVaultDb();
  const tx = db.transaction(RULE_STORE, "readwrite");
  tx.objectStore(RULE_STORE).delete(id);
  await transactionDone(tx);
}

export async function searchVisits(input = "", options = {}) {
  const visits = decorateVisitsWithRuleCategories(await getAllVisits(), await getRules());
  return searchVisitRecords(visits, input, {
    ...options,
    defaultLimit: DEFAULT_RESULT_LIMIT
  });
}

function normalizedCategoryRules(categories) {
  return (Array.isArray(categories) ? categories : [])
    .filter((rule) => rule?.value && rule?.category)
    .map((rule) => ({
      value: String(rule.value).toLowerCase(),
      category: rule.category
    }))
    .sort((left, right) => right.value.length - left.value.length);
}

function categoryForVisitFromRules(visit, categories) {
  const domain = (visit.domain || normalizeDomain(visit.url || "")).toLowerCase();
  if (!domain || !categories.length) {
    return "";
  }

  return categories.find((rule) => hostMatchesRule(domain, rule.value))?.category || "";
}

export function categoryForVisit(visit, categories) {
  return categoryForVisitFromRules(visit, normalizedCategoryRules(categories));
}

export function decorateVisitsWithRuleCategories(visits, rules) {
  const categories = normalizedCategoryRules(rules?.categories);
  if (!categories.length) {
    return visits;
  }

  return visits.map((visit) => {
    const category = categoryForVisitFromRules(visit, categories);
    return category ? { ...visit, category } : visit;
  });
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
  const rules = await getRules();
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
    rules: rules.rules,
    visits: options.includeCategories ? decorateVisitsWithRuleCategories(visits, rules) : visits
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
