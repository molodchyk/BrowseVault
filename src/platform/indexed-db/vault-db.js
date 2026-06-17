const DB_NAME = "browsevault";
const DB_VERSION = 1;

export const VISIT_STORE = "visits";
export const META_STORE = "meta";
export const RULE_STORE = "rules";

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

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openVaultDb();
  const store = db.transaction(storeName, "readonly").objectStore(storeName);
  return requestToPromise(store.getAll());
}

export async function putMany(storeName, records) {
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

export function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
