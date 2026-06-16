import { chromeApi } from "./api.js";

export function queryTabs(queryInfo = {}) {
  return chromeApi().tabs.query(queryInfo);
}

export function createTab(createProperties) {
  return chromeApi().tabs.create(createProperties);
}

export function activateTab(tabId) {
  return chromeApi().tabs.update(tabId, { active: true });
}
