import {
  ACTIVITY_LOG_META,
  MAX_ACTIVITY_EVENTS,
  normalizeActivityEvent,
  normalizeActivityLog
} from "./features/activity-log/core/activity-log.js";
import { createChromeHistorySyncPlan } from "./features/background-runtime/core/chrome-history-sync-plan.js";
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
  normalizeCategoryValue,
  normalizeRuleValue
} from "./features/vault-management/core/domain-rules.js";
import {
  makeVisitId,
  normalizeDomain,
  normalizeHistoryItem
} from "./features/vault-management/core/history-records.js";
import {
  archiveVisitsForExport,
  categoryForVisit,
  decorateVisitsWithRuleCategories,
  duplicateCleanupCandidates,
  retentionCleanupCandidates,
  summarizeArchiveInsights,
  summarizeVaultHealth
} from "./features/vault-management/core/vault-analysis.js";
import {
  getAll,
  META_STORE,
  openVaultDb,
  putMany,
  requestToPromise,
  RULE_STORE,
  transactionDone,
  VISIT_STORE
} from "./platform/indexed-db/vault-db.js";

export {
  archiveVisitsForExport,
  categoryForVisit,
  createChromeHistorySyncPlan,
  createImportArchivePlan,
  decorateVisitsWithRuleCategories,
  duplicateCleanupCandidates,
  makeVisitId,
  mergeImportedVisits,
  normalizeDomain,
  normalizeHistoryItem,
  openVaultDb,
  retentionCleanupCandidates,
  summarizeArchiveInsights,
  summarizeImportArchive,
  summarizeVaultHealth
};

const DEFAULT_RESULT_LIMIT = 500;
const SAVED_SEARCHES_META = "savedSearches";
const STORAGE_SELF_CHECK_META = "lastStorageSelfCheck";

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

export async function getDuplicateCleanupCandidates() {
  return duplicateCleanupCandidates(await getAllVisits());
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
