import test from "node:test";
import assert from "node:assert/strict";
import {
  createVaultManagementActionsHarness,
  fakeElement
} from "./vault-management-actions-harness.js";

function messageGetter(messages) {
  return (key, substitutions = []) => {
    const value = messages.get(key);
    if (!value) {
      return "";
    }
    return substitutions.reduce(
      (text, substitution, index) => text.replace(`$${index + 1}`, substitution),
      value
    );
  };
}

test("addCategoryRule stores a manual domain category and refreshes visible results", async () => {
  const added = [];
  const activity = [];
  const { actions, calls, elements, statuses } = createVaultManagementActionsHarness({
    services: {
      addCategoryRule: async (...args) => {
        added.push(args);
        return {
          id: "category:example.com",
          type: "category",
          value: "example.com",
          category: "Research"
        };
      },
      appendActivityLog: async (...args) => activity.push(args)
    }
  });

  await actions.addCategoryRule();

  assert.deepEqual(added, [["example.com", "Research"]]);
  assert.equal(elements.ruleDomain.value, "");
  assert.equal(elements.ruleCategory.value, "");
  assert.deepEqual(calls, ["refreshStats", "runSearch"]);
  assert.deepEqual(statuses, ["Categorized example.com as Research"]);
  assert.deepEqual(activity, [[{
    type: "rule",
    label: "category rule added",
    count: 1,
    detail: "example.com as Research"
  }]]);
});

test("vault management actions localize confirmations and statuses", async () => {
  const confirmations = [];
  const messages = new Map([
    ["confirmBlacklistSelectedDomainOne", "blockiere $1 domain?"],
    ["statusBlacklistedDomainsOne", "domain blockiert $1"],
    ["confirmDeleteSelectedVaultRecordsOne", "loesche $1 record?"],
    ["statusDeletedVaultRecordsOne", "vault geloescht $1"],
    ["statusRetentionPreviewMany", "alt $1 tage $2"],
    ["confirmRetentionCleanupMany", "retention $1 $2?"],
    ["statusCleanedRetentionMany", "retention fertig $1"],
    ["confirmResetVault", "reset?"],
    ["statusBrowseVaultLocalDataErased", "vault reset erledigt"]
  ]);
  const { actions, statuses } = createVaultManagementActionsHarness({
    getMessage: messageGetter(messages),
    selected: [{ domain: "example.com" }],
    selectedIds: ["visit-1"],
    services: {
      addDomainRule: async () => {},
      clearVaultData: async () => {},
      confirmAction: (message) => {
        confirmations.push(message);
        return true;
      },
      getRetentionCleanupCandidates: async () => [{ id: "old-1" }, { id: "old-2" }],
      getRules: async () => ({
        rules: [],
        blacklist: [],
        whitelist: []
      }),
      markDeletedByIds: async (ids) => ids.length
    }
  });

  await actions.blacklistSelectedDomains();
  await actions.deleteFromVault();
  await actions.previewRetentionCleanup();
  await actions.cleanupByRetention();
  await actions.resetVault();

  assert.deepEqual(confirmations, [
    "blockiere 1 domain?",
    "loesche 1 record?",
    "retention 2 30?",
    "reset?"
  ]);
  assert.deepEqual(statuses, [
    "domain blockiert 1",
    "vault geloescht 1",
    "alt 2 tage 30",
    "retention fertig 2",
    "vault reset erledigt"
  ]);
});

test("blacklistSelectedDomains adds unique selected domains and reports whitelist moves", async () => {
  const added = [];
  const { actions, statuses } = createVaultManagementActionsHarness({
    selected: [
      { domain: "example.com" },
      { domain: "docs.example.com" }
    ],
    services: {
      addDomainRule: async (...args) => added.push(args),
      getRules: async () => ({
        rules: [],
        blacklist: [],
        whitelist: ["docs.example.com"]
      })
    }
  });

  await actions.blacklistSelectedDomains();

  assert.deepEqual(added, [
    ["blacklist", "example.com"],
    ["blacklist", "docs.example.com"]
  ]);
  assert.deepEqual(statuses, [
    "Blacklisted 2 domains for future archiving. 1 moved from whitelist."
  ]);
});

test("deleteFromChrome requests native deletion and marks selected vault records", async () => {
  const runtimeMessages = [];
  const marked = [];
  const { actions, appState, calls, notifications, statuses } = createVaultManagementActionsHarness({
    selected: [
      { id: "visit-1", url: "https://example.com/a" },
      { id: "visit-2", url: "https://example.com/a" },
      { id: "visit-3", url: "https://example.com/b" }
    ],
    selectedIds: ["visit-1", "visit-2", "visit-3"],
    services: {
      markDeletedByIds: async (ids) => {
        marked.push(ids);
        return ids.length;
      },
      sendRuntimeMessage: async (message) => {
        runtimeMessages.push(message);
        return { ok: true };
      }
    }
  });

  await actions.deleteFromChrome();

  assert.deepEqual(runtimeMessages, [{
    type: "browseVault.deleteChromeUrls",
    urls: ["https://example.com/a", "https://example.com/b"]
  }]);
  assert.deepEqual(marked, [["visit-1", "visit-2", "visit-3"]]);
  assert.equal(appState.selectedIds.size, 0);
  assert.deepEqual(calls, ["refreshStats", "runSearch"]);
  assert.deepEqual(notifications, ["chrome-and-vault-delete"]);
  assert.deepEqual(statuses, ["Deleted 3 records from Chrome and vault"]);
});

test("deleteFromVault and undoVaultDelete handle selected and missing states", async () => {
  const activity = [];
  const marked = [];
  const { actions, appState, calls, notifications, statuses } = createVaultManagementActionsHarness({
    selectedIds: ["visit-1", "visit-2"],
    services: {
      appendActivityLog: async (...args) => activity.push(args),
      getStats: async () => ({ meta: { lastVaultDelete: { ids: ["visit-1"] } } }),
      markDeletedByIds: async (ids) => {
        marked.push(ids);
        return 2;
      },
      restoreDeletedByIds: async (ids) => {
        assert.deepEqual(ids, ["visit-1"]);
        return 1;
      }
    }
  });

  await actions.deleteFromVault();
  await actions.undoVaultDelete();

  assert.deepEqual(marked, [["visit-1", "visit-2"]]);
  assert.equal(appState.selectedIds.size, 0);
  assert.deepEqual(calls, ["refreshStats", "runSearch", "refreshStats", "runSearch"]);
  assert.deepEqual(notifications, ["vault-delete", "vault-restore"]);
  assert.deepEqual(statuses, [
    "Deleted 2 records from vault",
    "Restored 1 vault record"
  ]);
  assert.deepEqual(activity, [
    [{
      type: "delete",
      label: "Vault records deleted",
      count: 2,
      detail: "Selected records"
    }],
    [{
      type: "restore",
      label: "Vault delete undone",
      count: 1
    }]
  ]);
});

test("deleteCurrentResultsFromVault deletes the current filtered result set", async () => {
  const marked = [];
  const searched = [];
  const { actions, appState, calls, notifications, statuses } = createVaultManagementActionsHarness({
    selectedIds: ["visible"],
    services: {
      markDeletedByIds: async (ids) => {
        marked.push(ids);
        return ids.length;
      },
      searchVisits: async (query, options) => {
        searched.push([query, options]);
        return {
          total: 2,
          results: [{ id: "filtered-1" }, { id: "filtered-2" }]
        };
      }
    }
  });

  await actions.deleteCurrentResultsFromVault();

  assert.deepEqual(searched, [["docs site:example.com", { limit: "all" }]]);
  assert.deepEqual(marked, [["filtered-1", "filtered-2"]]);
  assert.equal(appState.selectedIds.size, 0);
  assert.deepEqual(calls, ["refreshStats", "runSearch"]);
  assert.deepEqual(notifications, ["vault-delete"]);
  assert.deepEqual(statuses, ["Deleted 2 current results from vault"]);
});

test("deleteCurrentResultsFromChrome deletes matching Chrome URLs and vault records", async () => {
  const activity = [];
  const marked = [];
  const runtimeMessages = [];
  const searched = [];
  const { actions, appState, calls, notifications, statuses } = createVaultManagementActionsHarness({
    selectedIds: ["visible"],
    services: {
      appendActivityLog: async (...args) => activity.push(args),
      markDeletedByIds: async (ids) => {
        marked.push(ids);
        return ids.length;
      },
      searchVisits: async (query, options) => {
        searched.push([query, options]);
        return {
          total: 3,
          results: [
            { id: "filtered-1", url: "https://example.com/a" },
            { id: "filtered-2", url: "https://example.com/a" },
            { id: "filtered-3", url: "https://example.com/b" }
          ]
        };
      },
      sendRuntimeMessage: async (message) => {
        runtimeMessages.push(message);
        return { ok: true };
      }
    }
  });

  await actions.deleteCurrentResultsFromChrome();

  assert.deepEqual(searched, [["docs site:example.com", { limit: "all" }]]);
  assert.deepEqual(runtimeMessages, [{
    type: "browseVault.deleteChromeUrls",
    urls: ["https://example.com/a", "https://example.com/b"]
  }]);
  assert.deepEqual(marked, [["filtered-1", "filtered-2", "filtered-3"]]);
  assert.equal(appState.selectedIds.size, 0);
  assert.deepEqual(calls, ["refreshStats", "runSearch"]);
  assert.deepEqual(notifications, ["chrome-and-vault-delete"]);
  assert.deepEqual(statuses, ["Deleted 3 current results from Chrome and vault"]);
  assert.deepEqual(activity, [[{
    type: "delete",
    label: "Current Chrome URLs and vault records deleted",
    count: 3,
    detail: "2 URLs · docs site:example.com"
  }]]);
});

test("deleteCurrentResultsFromVault guards empty search, no matches, and cancel", async () => {
  const emptySearch = createVaultManagementActionsHarness({
    getSearchText: () => " "
  });
  await emptySearch.actions.deleteCurrentResultsFromVault();
  assert.deepEqual(emptySearch.statuses, [
    "Enter a query or date filter before deleting current results"
  ]);

  const noMatches = createVaultManagementActionsHarness();
  await noMatches.actions.deleteCurrentResultsFromVault();
  assert.deepEqual(noMatches.statuses, ["No matching vault records to delete"]);

  const canceled = createVaultManagementActionsHarness({
    services: {
      confirmAction: () => false,
      searchVisits: async () => ({
        total: 1,
        results: [{ id: "filtered-1" }]
      })
    }
  });
  await canceled.actions.deleteCurrentResultsFromVault();
  assert.deepEqual(canceled.statuses, ["Current result deletion canceled"]);
});

test("deleteCurrentResultsFromChrome guards empty search, no URLs, no matches, and cancel", async () => {
  const emptySearch = createVaultManagementActionsHarness({
    getSearchText: () => " "
  });
  await emptySearch.actions.deleteCurrentResultsFromChrome();
  assert.deepEqual(emptySearch.statuses, [
    "Enter a query or date filter before deleting current results from Chrome"
  ]);

  const noMatches = createVaultManagementActionsHarness();
  await noMatches.actions.deleteCurrentResultsFromChrome();
  assert.deepEqual(noMatches.statuses, ["No matching vault records to delete from Chrome"]);

  const noUrls = createVaultManagementActionsHarness({
    services: {
      searchVisits: async () => ({
        total: 1,
        results: [{ id: "filtered-1" }]
      })
    }
  });
  await noUrls.actions.deleteCurrentResultsFromChrome();
  assert.deepEqual(noUrls.statuses, ["Matching vault records have no URLs to delete from Chrome"]);

  const canceled = createVaultManagementActionsHarness({
    services: {
      confirmAction: () => false,
      searchVisits: async () => ({
        total: 1,
        results: [{ id: "filtered-1", url: "https://example.com/a" }]
      })
    }
  });
  await canceled.actions.deleteCurrentResultsFromChrome();
  assert.deepEqual(canceled.statuses, ["Current result Chrome deletion canceled"]);
});

test("retention cleanup previews and deletes eligible old records", async () => {
  const marked = [];
  const candidates = [
    { id: "old-1" },
    { id: "old-2" }
  ];
  const { actions, appState, calls, statuses } = createVaultManagementActionsHarness({
    selectedIds: ["visible"],
    services: {
      getRetentionCleanupCandidates: async (days) => {
        assert.equal(days, 30);
        return candidates;
      },
      markDeletedByIds: async (ids) => {
        marked.push(ids);
        return ids.length;
      }
    }
  });

  await actions.previewRetentionCleanup();
  await actions.cleanupByRetention();

  assert.deepEqual(marked, [["old-1", "old-2"]]);
  assert.equal(appState.selectedIds.size, 0);
  assert.deepEqual(calls, ["refreshStats", "runSearch"]);
  assert.deepEqual(statuses, [
    "2 vault records older than 30 days can be cleaned up. Whitelisted domains are kept.",
    "Cleaned up 2 old vault records. Whitelisted domains kept."
  ]);
});

test("duplicate cleanup previews and deletes duplicate vault records", async () => {
  const activity = [];
  const marked = [];
  const candidates = [
    { id: "duplicate-1" },
    { id: "duplicate-2" }
  ];
  const { actions, appState, calls, statuses } = createVaultManagementActionsHarness({
    selectedIds: ["visible"],
    services: {
      appendActivityLog: async (...args) => activity.push(args),
      getDuplicateCleanupCandidates: async () => candidates,
      markDeletedByIds: async (ids) => {
        marked.push(ids);
        return ids.length;
      }
    }
  });

  await actions.previewDuplicateCleanup();
  await actions.cleanupDuplicates();

  assert.deepEqual(marked, [["duplicate-1", "duplicate-2"]]);
  assert.equal(appState.selectedIds.size, 0);
  assert.deepEqual(calls, ["refreshStats", "runSearch"]);
  assert.deepEqual(statuses, [
    "2 duplicate vault records can be cleaned up. One record per URL and visit time is kept.",
    "Cleaned up 2 duplicate vault records"
  ]);
  assert.deepEqual(activity, [[{
    type: "cleanup",
    label: "Duplicate cleanup",
    count: 2,
    detail: "Same URL and visit time"
  }]]);
});

test("duplicate cleanup handles empty and canceled states", async () => {
  const empty = createVaultManagementActionsHarness({
    services: {
      getDuplicateCleanupCandidates: async () => []
    }
  });
  await empty.actions.previewDuplicateCleanup();
  await empty.actions.cleanupDuplicates();
  assert.deepEqual(empty.statuses, [
    "No duplicate vault records found",
    "No duplicate vault records found"
  ]);

  const canceled = createVaultManagementActionsHarness({
    services: {
      confirmAction: () => false,
      getDuplicateCleanupCandidates: async () => [{ id: "duplicate-1" }]
    }
  });
  await canceled.actions.cleanupDuplicates();
  assert.deepEqual(canceled.statuses, ["Duplicate cleanup canceled"]);
});

test("retention cleanup validates input and handles empty previews", async () => {
  const { actions, elements, statuses } = createVaultManagementActionsHarness({
    services: {
      getRetentionCleanupCandidates: async () => []
    }
  });

  elements.retentionDays.value = "0";
  await actions.previewRetentionCleanup();
  elements.retentionDays.value = "45";
  await actions.cleanupByRetention();

  assert.deepEqual(statuses, [
    "Enter retention days of 1 or more",
    "No cleanup candidates older than 45 days"
  ]);
});

test("resetVault clears app state and quick results", async () => {
  const { actions, appState, calls, elements, statuses } = createVaultManagementActionsHarness({
    selectedIds: ["visit-1"],
    services: {
      clearVaultData: async () => calls.push("clearVaultData")
    }
  });
  elements.quickResults.append(fakeElement("li"));

  await actions.resetVault();

  assert.deepEqual(appState.currentResults, []);
  assert.equal(appState.currentTotal, 0);
  assert.equal(appState.selectedIds.size, 0);
  assert.deepEqual(elements.quickResults.children, []);
  assert.deepEqual(calls, ["clearVaultData", "refreshStats", "runSearch"]);
  assert.deepEqual(statuses, ["BrowseVault local data erased"]);
});
