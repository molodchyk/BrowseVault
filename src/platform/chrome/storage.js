import { chromeApi } from "./api.js";

export function getLocalStorage(keys) {
  return chromeApi().storage.local.get(keys);
}

export function setLocalStorage(items) {
  return chromeApi().storage.local.set(items);
}
