import {
  addDomainRule,
  appendActivityLog,
  clearVaultData,
  getDuplicateCleanupCandidates,
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
  appendActivityLog,
  clearVaultData,
  confirmAction: (message) => globalThis.confirm(message),
  document: globalThis.document,
  getRules,
  getStats,
  getDuplicateCleanupCandidates,
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

  async function recordActivity(event) {
    await deps.appendActivityLog(event);
  }

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
        await recordActivity({
          type: "rule",
          label: "Domain rule removed",
          count: 1,
          detail: rule.value
        });
        await renderRules();
        await refreshStats();
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
    await recordActivity({
      type: "rule",
      label: "Domains blacklisted",
      count: domains.length,
      detail: movedFromWhitelist ? `${movedFromWhitelist} moved from whitelist` : ""
    });
    await refreshStats();
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
    await recordActivity({
      type: "delete",
      label: "Vault records deleted",
      count: deleted,
      detail: "Selected records"
    });
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
    await recordActivity({
      type: "delete",
      label: "Current results deleted",
      count: deleted,
      detail: queryText
    });
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Deleted ${deleted} current result${deleted === 1 ? "" : "s"} from vault`);
  }

  async function deleteCurrentResultsFromChrome() {
    const queryText = getSearchText().trim();
    if (!queryText) {
      setStatus("Enter a query or date filter before deleting current results from Chrome");
      return;
    }

    const { results, total } = await deps.searchVisits(queryText, {
      limit: "all"
    });

    if (!results.length) {
      setStatus("No matching vault records to delete from Chrome");
      return;
    }

    const urls = deps.uniqueUrlsForItems(results);
    if (!urls.length) {
      setStatus("Matching vault records have no URLs to delete from Chrome");
      return;
    }

    const message = `Delete ${urls.length} URL${urls.length === 1 ? "" : "s"} from Chrome history and ${total} current BrowseVault result${total === 1 ? "" : "s"} for "${queryText}"? Chrome deletion removes by URL and cannot be undone by BrowseVault.`;
    if (!deps.confirmAction(message)) {
      setStatus("Current result Chrome deletion canceled");
      return;
    }

    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.DELETE_CHROME_URLS,
      urls
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Chrome deletion failed.");
    }

    const deleted = await deps.markDeletedByIds(results.map((visit) => visit.id));
    await recordActivity({
      type: "delete",
      label: "Current Chrome URLs and vault records deleted",
      count: deleted,
      detail: `${urls.length} URL${urls.length === 1 ? "" : "s"} · ${queryText}`
    });
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Deleted ${deleted} current result${deleted === 1 ? "" : "s"} from Chrome and vault`);
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
    await recordActivity({
      type: "delete",
      label: "Chrome URLs and vault records deleted",
      count: deleted,
      detail: `${urls.length} URL${urls.length === 1 ? "" : "s"}`
    });
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
    await recordActivity({
      type: "restore",
      label: "Vault delete undone",
      count: restored
    });
    await refreshStats();
    await runSearch();
    setStatus(`Restored ${restored} vault record${restored === 1 ? "" : "s"}`);
  }

  async function addRule(type) {
    const value = elements.ruleDomain.value;
    await deps.addDomainRule(type, elements.ruleDomain.value);
    await recordActivity({
      type: "rule",
      label: `${type} rule added`,
      count: 1,
      detail: value
    });
    elements.ruleDomain.value = "";
    await renderRules();
    await refreshStats();
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
    await recordActivity({
      type: "cleanup",
      label: "Retention cleanup",
      count: deleted,
      detail: `${retentionDays} days`
    });
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Cleaned up ${deleted} old vault record${deleted === 1 ? "" : "s"}. Whitelisted domains kept.`);
  }

  async function previewDuplicateCleanup() {
    const candidates = await deps.getDuplicateCleanupCandidates();
    if (!candidates.length) {
      setStatus("No duplicate vault records found");
      return;
    }

    setStatus(`${candidates.length} duplicate vault record${candidates.length === 1 ? "" : "s"} can be cleaned up. One record per URL and visit time is kept.`);
  }

  async function cleanupDuplicates() {
    const candidates = await deps.getDuplicateCleanupCandidates();
    if (!candidates.length) {
      setStatus("No duplicate vault records found");
      return;
    }

    const message = `Move ${candidates.length} duplicate vault record${candidates.length === 1 ? "" : "s"} to undoable deletion? One record per matching URL and visit time will be kept.`;
    if (!deps.confirmAction(message)) {
      setStatus("Duplicate cleanup canceled");
      return;
    }

    const deleted = await deps.markDeletedByIds(candidates.map((visit) => visit.id));
    await recordActivity({
      type: "cleanup",
      label: "Duplicate cleanup",
      count: deleted,
      detail: "Same URL and visit time"
    });
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(`Cleaned up ${deleted} duplicate vault record${deleted === 1 ? "" : "s"}`);
  }

  async function resetVault() {
    if (!deps.confirmAction("Erase all BrowseVault local archive data, rules, and backup metadata? This will not delete Chrome history.")) {
      return;
    }

    await deps.clearVaultData();
    await recordActivity({
      type: "reset",
      label: "Local vault reset",
      detail: "Chrome history untouched"
    });
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
    cleanupDuplicates,
    cleanupByRetention,
    deleteCurrentResultsFromChrome,
    deleteCurrentResultsFromVault,
    deleteFromChrome,
    deleteFromVault,
    previewDuplicateCleanup,
    previewRetentionCleanup,
    renderRules,
    resetVault,
    undoVaultDelete
  };
}
