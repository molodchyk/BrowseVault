import test from "node:test";
import assert from "node:assert/strict";
import { createVaultManagementActions } from "../../../src/features/vault-management/ui/actions.js";

function fakeElement(tagName = "div") {
  return {
    tagName,
    children: [],
    className: "",
    listeners: {},
    textContent: "",
    type: "",
    append(...children) {
      this.children.push(...children);
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
  };
}

function fakeList() {
  return {
    children: [],
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = [...children];
    }
  };
}

function fakeDocument() {
  return {
    createElement: fakeElement
  };
}

function createHarness({
  getSearchText = () => "docs site:example.com",
  selectedIds = [],
  selected = [],
  services = {}
} = {}) {
  const statuses = [];
  const calls = [];
  const appState = {
    currentResults: [{ id: "visible" }],
    currentTotal: 1,
    selectedIds: new Set(selectedIds)
  };
  const elements = {
    quickResults: fakeList(),
    retentionDays: { value: "30" },
    ruleCategory: { value: "Research" },
    ruleDomain: { value: "example.com" },
    rulesList: fakeList()
  };
  const actions = createVaultManagementActions({
    appState,
    elements,
    getSearchText,
    refreshStats: async () => calls.push("refreshStats"),
    runSearch: async () => calls.push("runSearch"),
    searchVisits: async () => ({ results: [], total: 0 }),
    selectedResults: async () => selected,
    services: {
      appendActivityLog: async () => {},
      confirmAction: () => true,
      document: fakeDocument(),
      getRules: async () => ({ rules: [], blacklist: [], whitelist: [], categories: [] }),
      ...services
    },
    setStatus: (message) => statuses.push(message)
  });

  return { actions, appState, calls, elements, statuses };
}

test("renderRules renders empty and removable rule states", async () => {
  const removed = [];
  let rules = [{ id: "rule-1", type: "blacklist", value: "example.com" }];
  const { actions, elements, statuses } = createHarness({
    services: {
      getRules: async () => ({ rules, blacklist: ["example.com"], whitelist: [] }),
      removeRule: async (id) => {
        removed.push(id);
        rules = [];
      }
    }
  });

  await actions.renderRules();
  assert.equal(elements.rulesList.children.length, 1);
  const [item] = elements.rulesList.children;
  assert.equal(item.className, "rule-item rule-item-blacklist");
  assert.equal(item.children[0].className, "rule-label");
  assert.equal(item.children[0].children[0].className, "rule-pill");
  assert.equal(item.children[0].children[0].textContent, "Block");
  assert.equal(item.children[0].children[1].className, "rule-value");
  assert.equal(item.children[0].children[1].textContent, "example.com");
  assert.equal(item.children[1].textContent, "Remove");

  await item.children[1].listeners.click();

  assert.deepEqual(removed, ["rule-1"]);
  assert.deepEqual(statuses, ["Removed example.com"]);
  assert.equal(elements.rulesList.children[0].textContent, "No domain rules yet.");
});

test("renderRules renders category rule labels", async () => {
  const { actions, elements } = createHarness({
    services: {
      getRules: async () => ({
        rules: [{ id: "category:example.com", type: "category", value: "example.com", category: "Research" }],
        blacklist: [],
        whitelist: [],
        categories: [{ id: "category:example.com", value: "example.com", category: "Research" }]
      })
    }
  });

  await actions.renderRules();

  assert.equal(elements.rulesList.children.length, 1);
  assert.equal(elements.rulesList.children[0].className, "rule-item rule-item-category");
  const label = elements.rulesList.children[0].children[0];
  assert.equal(label.className, "rule-label");
  assert.deepEqual(label.children.map((child) => child.textContent), [
    "Category",
    "example.com",
    "Research"
  ]);
  assert.deepEqual(label.children.map((child) => child.className), [
    "rule-pill",
    "rule-value",
    "rule-detail"
  ]);
});

test("addCategoryRule stores a manual domain category and refreshes visible results", async () => {
  const added = [];
  const activity = [];
  const { actions, calls, elements, statuses } = createHarness({
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

test("blacklistSelectedDomains adds unique selected domains and reports Keep-rule moves", async () => {
  const added = [];
  const { actions, statuses } = createHarness({
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
    "Blocked 2 domains from future archiving. 1 moved from Keep rules."
  ]);
});

test("deleteFromChrome requests native deletion and marks selected vault records", async () => {
  const runtimeMessages = [];
  const marked = [];
  const { actions, appState, calls, statuses } = createHarness({
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
  assert.deepEqual(statuses, ["Deleted 3 records from Chrome and vault"]);
});

test("deleteFromVault and undoVaultDelete handle selected and missing states", async () => {
  const activity = [];
  const marked = [];
  const { actions, appState, calls, statuses } = createHarness({
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
  const { actions, appState, calls, statuses } = createHarness({
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
  assert.deepEqual(statuses, ["Deleted 2 current results from vault"]);
});

test("deleteCurrentResultsFromChrome deletes matching Chrome URLs and vault records", async () => {
  const activity = [];
  const marked = [];
  const runtimeMessages = [];
  const searched = [];
  const { actions, appState, calls, statuses } = createHarness({
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
  assert.deepEqual(statuses, ["Deleted 3 current results from Chrome and vault"]);
  assert.deepEqual(activity, [[{
    type: "delete",
    label: "Current Chrome URLs and vault records deleted",
    count: 3,
    detail: "2 URLs · docs site:example.com"
  }]]);
});

test("deleteCurrentResultsFromVault guards empty search, no matches, and cancel", async () => {
  const emptySearch = createHarness({
    getSearchText: () => " "
  });
  await emptySearch.actions.deleteCurrentResultsFromVault();
  assert.deepEqual(emptySearch.statuses, [
    "Enter a query or date filter before deleting current results"
  ]);

  const noMatches = createHarness();
  await noMatches.actions.deleteCurrentResultsFromVault();
  assert.deepEqual(noMatches.statuses, ["No matching vault records to delete"]);

  const canceled = createHarness({
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
  const emptySearch = createHarness({
    getSearchText: () => " "
  });
  await emptySearch.actions.deleteCurrentResultsFromChrome();
  assert.deepEqual(emptySearch.statuses, [
    "Enter a query or date filter before deleting current results from Chrome"
  ]);

  const noMatches = createHarness();
  await noMatches.actions.deleteCurrentResultsFromChrome();
  assert.deepEqual(noMatches.statuses, ["No matching vault records to delete from Chrome"]);

  const noUrls = createHarness({
    services: {
      searchVisits: async () => ({
        total: 1,
        results: [{ id: "filtered-1" }]
      })
    }
  });
  await noUrls.actions.deleteCurrentResultsFromChrome();
  assert.deepEqual(noUrls.statuses, ["Matching vault records have no URLs to delete from Chrome"]);

  const canceled = createHarness({
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
  const { actions, appState, calls, statuses } = createHarness({
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
    "2 vault records older than 30 days can be cleaned up. Domains marked Keep are preserved.",
    "Cleaned up 2 old vault records. Domains marked Keep preserved."
  ]);
});

test("duplicate cleanup previews and deletes duplicate vault records", async () => {
  const activity = [];
  const marked = [];
  const candidates = [
    { id: "duplicate-1" },
    { id: "duplicate-2" }
  ];
  const { actions, appState, calls, statuses } = createHarness({
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
  const empty = createHarness({
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

  const canceled = createHarness({
    services: {
      confirmAction: () => false,
      getDuplicateCleanupCandidates: async () => [{ id: "duplicate-1" }]
    }
  });
  await canceled.actions.cleanupDuplicates();
  assert.deepEqual(canceled.statuses, ["Duplicate cleanup canceled"]);
});

test("retention cleanup validates input and handles empty previews", async () => {
  const { actions, elements, statuses } = createHarness({
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
  const { actions, appState, calls, elements, statuses } = createHarness({
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
