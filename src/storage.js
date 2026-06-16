import { matchesVisitQuery, parseQuery } from "./query.js";

const DB_NAME = "browsevault";
const DB_VERSION = 1;
const VISIT_STORE = "visits";
const META_STORE = "meta";
const RULE_STORE = "rules";
const DEFAULT_RESULT_LIMIT = 500;

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

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return records.length;
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

  return {
    id: item.id && item.id.includes("|") ? item.id : makeVisitId(url, visitTime),
    chromeId: item.id || "",
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

export async function syncChromeHistoryItems(items, options = {}) {
  const existing = await getAllVisits({ includeDeleted: true });
  const existingById = new Map(existing.map((record) => [record.id, record]));
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
  }

  await putMany(VISIT_STORE, records);

  return {
    scanned: items.length,
    stored: records.length,
    total: await countVisits()
  };
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
  const normalized = normalizeRuleValue(value);
  if (!normalized) {
    throw new Error("Enter a domain first.");
  }

  const record = {
    id: `${type}:${normalized}`,
    type,
    value: normalized,
    createdAt: new Date().toISOString()
  };

  await putMany(RULE_STORE, [record]);
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
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function searchVisits(input = "", options = {}) {
  const visits = await getAllVisits();
  const query = parseQuery(input);
  const limit = options.limit === "all" ? Infinity : Number(options.limit || DEFAULT_RESULT_LIMIT);
  const filtered = visits
    .filter((visit) => matchesVisitQuery(visit, query))
    .sort((a, b) => b.visitTime - a.visitTime);

  return {
    query,
    total: filtered.length,
    results: filtered.slice(0, limit)
  };
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

export async function exportArchive(items = null) {
  const visits = items || (await getAllVisits());
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
    sourceApp: archive?.app || "unknown",
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
  const normalized = normalizeImportVisits(archive);
  const rules = normalizeImportRules(archive, importedAt);

  await putMany(VISIT_STORE, normalized);
  await putMany(RULE_STORE, rules);

  await setMeta("lastImport", {
    importedAt,
    sourceApp: archive?.app || "unknown",
    schemaVersion: archive?.schemaVersion || null,
    visits: normalized.length,
    rules: rules.length
  });

  return {
    importedAt,
    visits: normalized.length,
    rules: rules.length
  };
}

function extractImportVisits(archive) {
  if (Array.isArray(archive?.visits)) {
    return archive.visits;
  }

  if (Array.isArray(archive?.items)) {
    return archive.items;
  }

  if (Array.isArray(archive?.["Browser History"])) {
    return archive["Browser History"].map((item) => ({
      url: item.url,
      title: item.title,
      visitTime: item.time_usec,
      source: "google-takeout"
    }));
  }

  if (Array.isArray(archive?.browserHistory)) {
    return archive.browserHistory;
  }

  return [];
}

export async function getStats() {
  const visits = await getAllVisits();
  const domains = new Set(visits.map((visit) => visit.domain).filter(Boolean));
  const meta = await getAllMeta();

  return {
    visits: visits.length,
    domains: domains.size,
    newestVisitTime: visits.reduce((max, visit) => Math.max(max, visit.visitTime || 0), 0),
    oldestVisitTime: visits.reduce((min, visit) => Math.min(min, visit.visitTime || Date.now()), Date.now()),
    meta
  };
}

export async function clearVaultData() {
  const db = await openVaultDb();
  const tx = db.transaction([VISIT_STORE, META_STORE, RULE_STORE], "readwrite");

  tx.objectStore(VISIT_STORE).clear();
  tx.objectStore(META_STORE).clear();
  tx.objectStore(RULE_STORE).clear();

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
