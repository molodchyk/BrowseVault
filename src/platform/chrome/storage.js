const fallbackStore = new Map();
const FALLBACK_STORAGE_KEY = "browseVault.localPreviewStorage";

function chromeLocalStorage() {
  return globalThis.chrome?.storage?.local?.get && globalThis.chrome?.storage?.local?.set
    ? globalThis.chrome.storage.local
    : null;
}

function readFallbackStorage() {
  try {
    const raw = globalThis.localStorage?.getItem(FALLBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : Object.fromEntries(fallbackStore);
  } catch {
    return Object.fromEntries(fallbackStore);
  }
}

function writeFallbackStorage(data) {
  for (const [key, value] of Object.entries(data)) {
    fallbackStore.set(key, value);
  }

  try {
    globalThis.localStorage?.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // In-memory fallback is enough for local previews when localStorage is blocked.
  }
}

function pickFallbackValues(keys, data) {
  if (keys === null || keys === undefined) {
    return { ...data };
  }

  if (typeof keys === "string") {
    return keys in data ? { [keys]: data[keys] } : {};
  }

  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]]));
  }

  if (typeof keys === "object") {
    return Object.fromEntries(
      Object.entries(keys).map(([key, fallback]) => [key, key in data ? data[key] : fallback])
    );
  }

  return {};
}

export function getLocalStorage(keys) {
  const storage = chromeLocalStorage();
  if (storage) {
    return storage.get(keys);
  }

  return Promise.resolve(pickFallbackValues(keys, readFallbackStorage()));
}

export function setLocalStorage(items) {
  const storage = chromeLocalStorage();
  if (storage) {
    return storage.set(items);
  }

  writeFallbackStorage({
    ...readFallbackStorage(),
    ...items
  });
  return Promise.resolve();
}

export function onLocalStorageChanged(listener) {
  const event = globalThis.chrome?.storage?.onChanged;
  if (!event?.addListener) {
    return () => {};
  }

  const wrapped = (changes, areaName) => {
    if (areaName === "local") {
      listener(changes);
    }
  };

  event.addListener(wrapped);
  return () => {
    event.removeListener?.(wrapped);
  };
}
