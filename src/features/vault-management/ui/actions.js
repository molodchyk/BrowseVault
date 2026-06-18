import {
  addCategoryRule,
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
import {
  uniqueDomainsForItems,
  uniqueUrlsForItems
} from "../../history-results/core/results.js";
import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";
import { createCleanupActions } from "./cleanup-actions.js";
import { deleteChromeUrls } from "./chrome-delete.js";
import { chromeUrlLabel, currentResultLabel, localizedCountMessage, localizedMessage, localizedRuleType, selectedRecordLabel } from "./localized-messages.js";
import { renderRuleList } from "./render-rules.js";

const defaultServices = {
  addCategoryRule,
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

export function createVaultManagementActions({
  appState,
  elements,
  getMessage = () => "",
  getSearchText = () => "",
  notifyVaultChanged = () => false,
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

  const cleanupActions = createCleanupActions({
    appState,
    deps,
    elements,
    getMessage,
    notifyVaultChanged,
    recordActivity,
    refreshStats,
    runSearch,
    setStatus
  });

  async function renderRules() {
    const { rules } = await deps.getRules();
    renderRuleList({
      document: deps.document,
      getMessage,
      rules,
      rulesList: elements.rulesList,
      onRemove: async (rule) => {
        await deps.removeRule(rule.id);
        await recordActivity({
          type: "rule",
          label: "Domain rule removed",
          count: 1,
          detail: rule.value
        });
        await renderRules();
        await refreshStats();
        await runSearch();
        setStatus(localizedMessage(getMessage, "statusRemovedRule", `Removed ${rule.value}`, [rule.value]));
        notifyVaultChanged("rule-removed");
      }
    });
  }

  async function blacklistSelectedDomains() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    const domains = deps.uniqueDomainsForItems(items);
    if (!domains.length) {
      setStatus(localizedMessage(getMessage, "statusSelectedRecordsNoBlacklistDomains", "Selected records have no domains to blacklist"));
      return;
    }

    const message = `Blacklist ${domains.length} selected domain${domains.length === 1 ? "" : "s"} for future archiving? Existing vault records will stay until you delete them.`;
    if (!deps.confirmAction(localizedCountMessage(
      getMessage,
      domains.length,
      "confirmBlacklistSelectedDomainOne",
      "confirmBlacklistSelectedDomainMany",
      message,
      message
    ))) {
      setStatus(localizedMessage(getMessage, "statusBlacklistCanceled", "Blacklist canceled"));
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
    setStatus(localizedMessage(
      getMessage,
      movedFromWhitelist
        ? domains.length === 1
          ? "statusBlacklistedDomainsMovedOne"
          : "statusBlacklistedDomainsMovedMany"
        : domains.length === 1
          ? "statusBlacklistedDomainsOne"
          : "statusBlacklistedDomainsMany",
      `Blacklisted ${domains.length} domain${domains.length === 1 ? "" : "s"} for future archiving.${movedLabel}`,
      [String(domains.length), String(movedFromWhitelist)]
    ));
    notifyVaultChanged("rule-added");
  }

  async function deleteFromVault() {
    const ids = [...appState.selectedIds];
    if (!ids.length) {
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    if (!deps.confirmAction(localizedCountMessage(
      getMessage,
      ids.length,
      "confirmDeleteSelectedVaultRecordsOne",
      "confirmDeleteSelectedVaultRecordsMany",
      `Delete ${ids.length} selected records from BrowseVault?`,
      `Delete ${ids.length} selected records from BrowseVault?`
    ))) {
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
    setStatus(localizedCountMessage(
      getMessage,
      deleted,
      "statusDeletedVaultRecordsOne",
      "statusDeletedVaultRecordsMany",
      `Deleted ${deleted} records from vault`,
      `Deleted ${deleted} records from vault`
    ));
    notifyVaultChanged("vault-delete");
  }

  async function deleteCurrentResultsFromVault() {
    const queryText = getSearchText().trim();
    if (!queryText) {
      setStatus(localizedMessage(getMessage, "statusEnterSearchBeforeDeletingCurrentResults", "Enter a query or date filter before deleting current results"));
      return;
    }

    const { results, total } = await deps.searchVisits(queryText, {
      limit: "all"
    });

    if (!results.length) {
      setStatus(localizedMessage(getMessage, "statusNoMatchingVaultRecordsToDelete", "No matching vault records to delete"));
      return;
    }

    const message = `Delete ${total} current result${total === 1 ? "" : "s"} from BrowseVault for "${queryText}"? This will not delete Chrome history and can be undone.`;
    if (!deps.confirmAction(localizedCountMessage(
      getMessage,
      total,
      "confirmDeleteCurrentResultsVaultOne",
      "confirmDeleteCurrentResultsVaultMany",
      message,
      message,
      [queryText]
    ))) {
      setStatus(localizedMessage(getMessage, "statusCurrentResultDeletionCanceled", "Current result deletion canceled"));
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
    setStatus(localizedCountMessage(
      getMessage,
      deleted,
      "statusDeletedCurrentVaultResultsOne",
      "statusDeletedCurrentVaultResultsMany",
      `Deleted ${deleted} current result${deleted === 1 ? "" : "s"} from vault`,
      `Deleted ${deleted} current result${deleted === 1 ? "" : "s"} from vault`
    ));
    notifyVaultChanged("vault-delete");
  }

  async function deleteCurrentResultsFromChrome() {
    const queryText = getSearchText().trim();
    if (!queryText) {
      setStatus(localizedMessage(getMessage, "statusEnterSearchBeforeDeletingCurrentResultsChrome", "Enter a query or date filter before deleting current results from Chrome"));
      return;
    }

    const { results, total } = await deps.searchVisits(queryText, {
      limit: "all"
    });

    if (!results.length) {
      setStatus(localizedMessage(getMessage, "statusNoMatchingVaultRecordsToDeleteFromChrome", "No matching vault records to delete from Chrome"));
      return;
    }

    const urls = deps.uniqueUrlsForItems(results);
    if (!urls.length) {
      setStatus(localizedMessage(getMessage, "statusMatchingVaultRecordsNoChromeUrls", "Matching vault records have no URLs to delete from Chrome"));
      return;
    }

    const message = `Delete ${urls.length} URL${urls.length === 1 ? "" : "s"} from Chrome history and ${total} current BrowseVault result${total === 1 ? "" : "s"} for "${queryText}"? Chrome deletion removes by URL and cannot be undone by BrowseVault.`;
    if (!deps.confirmAction(localizedMessage(
      getMessage,
      "confirmDeleteCurrentResultsChrome",
      message,
      [chromeUrlLabel(urls.length, getMessage), currentResultLabel(total, getMessage), queryText]
    ))) {
      setStatus(localizedMessage(getMessage, "statusCurrentResultChromeDeletionCanceled", "Current result Chrome deletion canceled"));
      return;
    }

    await deleteChromeUrls(deps, urls);
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
    setStatus(localizedCountMessage(
      getMessage,
      deleted,
      "statusDeletedCurrentResultsChromeVaultOne",
      "statusDeletedCurrentResultsChromeVaultMany",
      `Deleted ${deleted} current result${deleted === 1 ? "" : "s"} from Chrome and vault`,
      `Deleted ${deleted} current result${deleted === 1 ? "" : "s"} from Chrome and vault`
    ));
    notifyVaultChanged("chrome-and-vault-delete");
  }

  async function deleteFromChrome() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    const urls = deps.uniqueUrlsForItems(items);

    if (!deps.confirmAction(localizedMessage(
      getMessage,
      "confirmDeleteSelectedChromeUrls",
      `Delete ${urls.length} selected URL${urls.length === 1 ? "" : "s"} from Chrome history and ${items.length} selected record${items.length === 1 ? "" : "s"} from BrowseVault? Chrome deletion removes history by URL.`,
      [chromeUrlLabel(urls.length, getMessage), selectedRecordLabel(items.length, getMessage)]
    ))) {
      return;
    }

    await deleteChromeUrls(deps, urls);
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
    setStatus(localizedCountMessage(
      getMessage,
      deleted,
      "statusDeletedRecordsChromeVaultOne",
      "statusDeletedRecordsChromeVaultMany",
      `Deleted ${deleted} records from Chrome and vault`,
      `Deleted ${deleted} records from Chrome and vault`
    ));
    notifyVaultChanged("chrome-and-vault-delete");
  }

  async function undoVaultDelete() {
    const stats = await deps.getStats();
    const ids = stats.meta.lastVaultDelete?.ids || [];

    if (!ids.length) {
      setStatus(localizedMessage(getMessage, "statusNoVaultDeleteToUndo", "No vault delete to undo"));
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
    setStatus(localizedCountMessage(
      getMessage,
      restored,
      "statusRestoredVaultRecordOne",
      "statusRestoredVaultRecordMany",
      `Restored ${restored} vault record${restored === 1 ? "" : "s"}`,
      `Restored ${restored} vault record${restored === 1 ? "" : "s"}`
    ));
    notifyVaultChanged("vault-restore");
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
    setStatus(localizedMessage(getMessage, "statusAddedDomainRule", `Added ${type} rule`, [localizedRuleType(type, getMessage)]));
    notifyVaultChanged("rule-added");
  }

  async function addCategoryRuleAction() {
    const domain = elements.ruleDomain.value;
    const category = elements.ruleCategory.value;
    const rule = await deps.addCategoryRule(domain, category);
    await recordActivity({
      type: "rule",
      label: "category rule added",
      count: 1,
      detail: `${rule.value} as ${rule.category}`
    });
    elements.ruleDomain.value = "";
    elements.ruleCategory.value = "";
    await renderRules();
    await refreshStats();
    await runSearch();
    setStatus(localizedMessage(getMessage, "statusCategorizedDomain", `Categorized ${rule.value} as ${rule.category}`, [rule.value, rule.category]));
    notifyVaultChanged("rule-added");
  }

  async function resetVault() {
    if (!deps.confirmAction(localizedMessage(
      getMessage,
      "confirmResetVault",
      "Erase all BrowseVault local archive data, rules, and backup metadata? This will not delete Chrome history."
    ))) {
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
    setStatus(localizedMessage(getMessage, "statusBrowseVaultLocalDataErased", "BrowseVault local data erased"));
    notifyVaultChanged("vault-reset");
  }

  return {
    addCategoryRule: addCategoryRuleAction,
    addRule,
    blacklistSelectedDomains,
    ...cleanupActions,
    deleteCurrentResultsFromChrome,
    deleteCurrentResultsFromVault,
    deleteFromChrome,
    deleteFromVault,
    renderRules,
    resetVault,
    undoVaultDelete
  };
}
