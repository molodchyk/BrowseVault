import {
  addDomainRule,
  clearVaultData,
  getRetentionCleanupCandidates,
  getRules,
  getStats,
  markDeletedByIds,
  removeRule,
  restoreDeletedByIds,
  searchVisits
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
  getRetentionCleanupCandidates,
  markDeletedByIds,
  removeRule,
  restoreDeletedByIds,
  searchVisits,
  sendRuntimeMessage,
  uniqueDomainsForItems,
  uniqueUrlsForItems
};

function retentionDaysFromInput(value) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 ? days : null;
}

export function createVaultManagementActions({
  appState,
  elements,
  getSearchText = () => "",
  refreshStats,
  runSearch,
  searchVisits: searchVisitRecords = searchVisits,
  selectedResults,
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    searchVisits: searchVisitRecords,
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

  async function deleteCurrentResultsFromVault() {
    const queryText = getSearchText().trim();
    if (!queryText) {
      setStatus("Enter a query or date filter before deleting current results");
      return;
    }

    const { results, total } = await deps.searchVisits(queryText, {
      limit: "all"
    });

    if (!results.length) {
      setStatus("No matching vault records to delete");
      return;
    }

    const message = `Delete ${total} current result${total === 1 ? "" : "s"} from BrowseVault for "${queryText}"? This will not delete Chrome history and can be undone.`;
    if (!deps.confirmAction(message)) {
      setStatus("Current result deletion canceled");
      return;
    }

    const deleted = await deps.markDeletedByIds(results.map((visit) => visit.id));
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Deleted ${deleted} current result${deleted === 1 ? "" : "s"} from vault`);
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
    setStatus(`Restored ${restored} vault record${restored === 1 ? "" : "s"}`);
  }

  async function addRule(type) {
    await deps.addDomainRule(type, elements.ruleDomain.value);
    elements.ruleDomain.value = "";
    await renderRules();
    setStatus(`Added ${type} rule`);
  }

  async function previewRetentionCleanup() {
    const retentionDays = retentionDaysFromInput(elements.retentionDays.value);
    if (!retentionDays) {
      setStatus("Enter retention days of 1 or more");
      return;
    }

    const candidates = await deps.getRetentionCleanupCandidates(retentionDays);
    if (!candidates.length) {
      setStatus(`No cleanup candidates older than ${retentionDays} days`);
      return;
    }

    setStatus(`${candidates.length} vault record${candidates.length === 1 ? "" : "s"} older than ${retentionDays} days can be cleaned up. Whitelisted domains are kept.`);
  }

  async function cleanupByRetention() {
    const retentionDays = retentionDaysFromInput(elements.retentionDays.value);
    if (!retentionDays) {
      setStatus("Enter retention days of 1 or more");
      return;
    }

    const candidates = await deps.getRetentionCleanupCandidates(retentionDays);
    if (!candidates.length) {
      setStatus(`No cleanup candidates older than ${retentionDays} days`);
      return;
    }

    const message = `Move ${candidates.length} vault record${candidates.length === 1 ? "" : "s"} older than ${retentionDays} days to undoable deletion? Whitelisted domains will be kept.`;
    if (!deps.confirmAction(message)) {
      setStatus("Retention cleanup canceled");
      return;
    }

    const deleted = await deps.markDeletedByIds(candidates.map((visit) => visit.id));
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Cleaned up ${deleted} old vault record${deleted === 1 ? "" : "s"}. Whitelisted domains kept.`);
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
    cleanupByRetention,
    deleteCurrentResultsFromVault,
    deleteFromChrome,
    deleteFromVault,
    previewRetentionCleanup,
    renderRules,
    resetVault,
    undoVaultDelete
  };
}
