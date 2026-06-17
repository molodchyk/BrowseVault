import test from "node:test";
import assert from "node:assert/strict";
import {
  createChromeHistorySync,
  hostMatchesRule,
  isInternalUrl,
  shouldArchiveUrlWithRules
} from "../../../src/features/background-runtime/background/chrome-history-sync.js";

const rules = {
  blacklist: ["blocked.example", "ads.example"],
  whitelist: ["allowed.blocked.example"]
};

function createDeps(overrides = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      getHistoryVisits: async (query) => {
        calls.push(["getHistoryVisits", query]);
        return [];
      },
      getRules: async () => {
        calls.push(["getRules"]);
        return rules;
      },
      recordChromeVisit: async (item, options) => {
        calls.push(["recordChromeVisit", item, options]);
      },
      recordChromeVisitWithCaptureMetadata: async (item, options) => {
        calls.push(["recordChromeVisitWithCaptureMetadata", item, options]);
      },
      searchHistory: async (query) => {
        calls.push(["searchHistory", query]);
        return [];
      },
      setMeta: async (key, value) => {
        calls.push(["setMeta", key, value]);
      },
      syncChromeHistoryItems: async (items, options) => {
        calls.push(["syncChromeHistoryItems", items, options]);
        return { stored: items.length };
      },
      syncChromeHistoryItemsWithSyncMetadata: async (items, options) => {
        calls.push(["syncChromeHistoryItemsWithSyncMetadata", items, options]);
        return { stored: items.length };
      },
      ...overrides
    }
  };
}

test("history archive policy handles internal URLs, host rules, and whitelist overrides", () => {
  assert.equal(isInternalUrl("chrome://history"), true);
  assert.equal(isInternalUrl("about:blank"), true);
  assert.equal(isInternalUrl("https://example.com"), false);
  assert.equal(hostMatchesRule("docs.example.com", "example.com"), true);
  assert.equal(hostMatchesRule("badexample.com", "example.com"), false);

  assert.equal(shouldArchiveUrlWithRules("chrome://history", rules), false);
  assert.equal(shouldArchiveUrlWithRules("not a url", rules), false);
  assert.equal(shouldArchiveUrlWithRules("https://blocked.example/page", rules), false);
  assert.equal(shouldArchiveUrlWithRules("https://news.blocked.example/page", rules), false);
  assert.equal(shouldArchiveUrlWithRules("https://allowed.blocked.example/page", rules), true);
  assert.equal(shouldArchiveUrlWithRules("https://useful.example/page", rules), true);
});

test("expandHistoryItems filters items and expands Chrome visit rows", async () => {
  const { calls, deps } = createDeps({
    getHistoryVisits: async ({ url }) => {
      calls.push(["getHistoryVisits", { url }]);
      if (url.includes("fallback")) {
        throw new Error("visit lookup failed");
      }
      if (url.includes("empty")) {
        return [];
      }
      return [
        {
          visitId: "visit-1",
          visitTime: 1780000000000,
          transition: "typed",
          referringVisitId: "ref-1"
        }
      ];
    }
  });
  const sync = createChromeHistorySync(deps, {
    visitExpansionConcurrency: 1
  });

  const expanded = await sync.expandHistoryItems([
    { id: "blocked", url: "https://blocked.example/page", title: "Blocked" },
    { id: "one", url: "https://useful.example/page", title: "Useful" },
    { id: "empty", url: "https://empty.example/page", title: "Empty" },
    { id: "fallback", url: "https://fallback.example/page", title: "Fallback" }
  ]);

  assert.deepEqual(expanded, [
    {
      id: "https://useful.example/page|visit-1",
      url: "https://useful.example/page",
      title: "Useful",
      visitId: "visit-1",
      visitTime: 1780000000000,
      transition: "typed",
      referringVisitId: "ref-1"
    },
    { id: "empty", url: "https://empty.example/page", title: "Empty" },
    { id: "fallback", url: "https://fallback.example/page", title: "Fallback" }
  ]);
  assert.deepEqual(calls, [
    ["getRules"],
    ["getHistoryVisits", { url: "https://useful.example/page" }],
    ["getHistoryVisits", { url: "https://empty.example/page" }],
    ["getHistoryVisits", { url: "https://fallback.example/page" }]
  ]);
});

test("bootstrapChromeHistory searches, syncs expanded visits, and stores sync metadata", async () => {
  const { calls, deps } = createDeps({
    searchHistory: async (query) => {
      calls.push(["searchHistory", query]);
      return [{ id: "one", url: "https://useful.example/page", title: "Useful" }];
    },
    getHistoryVisits: async ({ url }) => {
      calls.push(["getHistoryVisits", { url }]);
      return [{ visitId: "v1", visitTime: 1780000000000 }];
    }
  });
  const sync = createChromeHistorySync(deps, {
    bootstrapUrlLimit: 7,
    visitExpansionConcurrency: 1,
    now: () => "2026-06-16T12:00:00.000Z"
  });

  assert.deepEqual(await sync.bootstrapChromeHistory("manual"), { stored: 1 });
  assert.deepEqual(calls, [
    ["searchHistory", { text: "", startTime: 0, maxResults: 7 }],
    ["getRules"],
    ["getHistoryVisits", { url: "https://useful.example/page" }],
    [
      "syncChromeHistoryItemsWithSyncMetadata",
      [
        {
          id: "https://useful.example/page|v1",
          url: "https://useful.example/page",
          title: "Useful",
          visitId: "v1",
          visitTime: 1780000000000,
          transition: "",
          referringVisitId: ""
        }
      ],
      {
        source: "chrome-history",
        reason: "manual",
        syncedAt: "2026-06-16T12:00:00.000Z"
      }
    ]
  ]);
});

test("recordVisitedItem archives only allowed live visits", async () => {
  const { calls, deps } = createDeps();
  const sync = createChromeHistorySync(deps, {
    now: () => "2026-06-16T12:00:00.000Z"
  });

  assert.equal(await sync.recordVisitedItem({ url: "https://blocked.example/page" }), false);
  assert.equal(await sync.recordVisitedItem({ url: "https://useful.example/page", title: "Useful" }), true);
  assert.deepEqual(calls, [
    ["getRules"],
    ["getRules"],
    [
      "recordChromeVisitWithCaptureMetadata",
      { url: "https://useful.example/page", title: "Useful" },
      {
        source: "chrome-history-live",
        capturedAt: "2026-06-16T12:00:00.000Z"
      }
    ]
  ]);
});
