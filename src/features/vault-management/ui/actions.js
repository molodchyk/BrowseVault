import {
  addDomainRule,
  clearVaultData,
  getRules,
  getStats,
  markDeletedByIds,
  removeRule,
  restoreDeletedByIds
} from "../../../storage.js";
import { BACKGROUND_MESSAGE_TYPES } from "../../background-runtime/core/messages.js";
import {
  uniqueDomainsForItems,
  uniqueUrlsForItems
} from "../../history-results/core/results.js";
import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";

const defaultServices = {
  addDomainRule,
  clearVaultData,
  confirmAction: (message) => globalThis.confirm(message),
  document: globalThis.document,
  getRules,
  getStats,
  markDeletedByIds,
  removeRule,
  restoreDeletedByIds,
  sendRuntimeMessage,
  uniqueDomainsForItems,
  uniqueUrlsForItems
};

export function createVaultManagementActions({
  appState,
  elements,
  refreshStats,
  runSearch,
  selectedResults,
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  async function renderRules() {
    const { rules } = await deps.getRules();
    elements.rulesList.replaceChildren();

    if (!rules.length) {
      const empty = deps.document.createElement("li");
      empty.className = "rule-item";
      empty.textContent = "No domain rules yet.";
      elements.rulesList.append(empty);
      return;
    }

    for (const rule of rules) {
      const item = deps.document.createElement("li");
      item.className = "rule-item";

      const label = deps.document.createElement("span");
      const type = deps.document.createElement("strong");
      type.textContent = rule.type;
      label.append(type, ` ${rule.value}`);

      const remove = deps.document.createElement("button");
      remove.className = "ghost";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        await deps.removeRule(rule.id);
        await renderRules();
        setStatus(`Removed ${rule.value}`);
      });

      item.append(label, remove);
      elements.rulesList.append(item);
    }
  }

  async function blacklistSelectedDomains() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
      return;
    }

    const domains = deps.uniqueDomainsForItems(items);
    if (!domains.length) {
      setStatus("Selected records have no domains to blacklist");
      return;
    }

    const message = `Blacklist ${domains.length} selected domain${domains.length === 1 ? "" : "s"} for future archiving? Existing vault records will stay until you delete them.`;
    if (!deps.confirmAction(message)) {
      setStatus("Blacklist canceled");
      return;
    }

    const existingRules = await deps.getRules();
    const movedFromWhitelist = domains.filter((domain) => existingRules.whitelist.includes(domain)).length;
    await Promise.all(domains.map((domain) => deps.addDomainRule("blacklist", domain)));
    await renderRules();

    const movedLabel = movedFromWhitelist
      ? ` ${movedFromWhitelist} moved from whitelist.`
      : "";
    setStatus(`Blacklisted ${domains.length} domain${domains.length === 1 ? "" : "s"} for future archiving.${movedLabel}`);
  }

  async function deleteFromVault() {
    const ids = [...appState.selectedIds];
    if (!ids.length) {
      setStatus("Select records first");
      return;
    }

    if (!deps.confirmAction(`Delete ${ids.length} selected records from BrowseVault?`)) {
      return;
    }

    const deleted = await deps.markDeletedByIds(ids);
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Deleted ${deleted} records from vault`);
  }

  async function deleteFromChrome() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
      return;
    }

    const urls = deps.uniqueUrlsForItems(items);

    if (!deps.confirmAction(`Delete ${urls.length} selected URL${urls.length === 1 ? "" : "s"} from Chrome history and ${items.length} selected record${items.length === 1 ? "" : "s"} from BrowseVault? Chrome deletion removes history by URL.`)) {
      return;
    }

    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.DELETE_CHROME_URLS,
      urls
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Chrome deletion failed.");
    }

    const deleted = await deps.markDeletedByIds(items.map((item) => item.id));
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Deleted ${deleted} records from Chrome and vault`);
  }

  async function undoVaultDelete() {
    const stats = await deps.getStats();
    const ids = stats.meta.lastVaultDelete?.ids || [];

    if (!ids.length) {
      setStatus("No vault delete to undo");
      return;
    }

    const restored = await deps.restoreDeletedByIds(ids);
    await refreshStats();
    await runSearch();
    setStatus(`Restored ${restored} vault records`);
  }

  async function addRule(type) {
    await deps.addDomainRule(type, elements.ruleDomain.value);
    elements.ruleDomain.value = "";
    await renderRules();
    setStatus(`Added ${type} rule`);
  }

  async function resetVault() {
    if (!deps.confirmAction("Erase all BrowseVault local archive data, rules, and backup metadata? This will not delete Chrome history.")) {
      return;
    }

    await deps.clearVaultData();
    appState.currentResults = [];
    appState.currentTotal = 0;
    appState.selectedIds.clear();
    elements.quickResults.replaceChildren();
    await refreshStats();
    await renderRules();
    await runSearch();
    setStatus("BrowseVault local data erased");
  }

  return {
    addRule,
    blacklistSelectedDomains,
    deleteFromChrome,
    deleteFromVault,
    renderRules,
    resetVault,
    undoVaultDelete
  };
}
