import test from "node:test";
import assert from "node:assert/strict";
import {
  decorateVisitsWithRuleCategories,
  duplicateCleanupCandidates,
  retentionCleanupCandidates,
  summarizeArchiveInsights,
  summarizeVaultHealth
} from "../../src/storage.js";

test("decorateVisitsWithRuleCategories applies the most specific matching domain rule", () => {
  const visits = [
    {
      id: "root",
      domain: "example.com",
      url: "https://example.com/"
    },
    {
      id: "docs",
      domain: "docs.example.com",
      url: "https://docs.example.com/"
    },
    {
      id: "other",
      domain: "other.test",
      url: "https://other.test/"
    }
  ];

  const decorated = decorateVisitsWithRuleCategories(visits, {
    categories: [
      { value: "example.com", category: "General" },
      { value: "docs.example.com", category: "Research" }
    ]
  });

  assert.equal(decorated[0].category, "General");
  assert.equal(decorated[1].category, "Research");
  assert.equal(decorated[2].category, undefined);
  assert.equal(decorated[2], visits[2]);
});

test("retentionCleanupCandidates skips deleted, recent, and whitelisted visits", () => {
  const now = Date.parse("2026-06-17T12:00:00.000Z");
  const oldVisit = {
    id: "old",
    url: "https://old.example/page",
    domain: "old.example",
    visitTime: now - 40 * 86400000
  };
  const recentVisit = {
    id: "recent",
    url: "https://recent.example/page",
    domain: "recent.example",
    visitTime: now - 10 * 86400000
  };
  const whitelistedVisit = {
    id: "kept",
    url: "https://docs.keep.example/page",
    domain: "docs.keep.example",
    visitTime: now - 90 * 86400000
  };
  const deletedVisit = {
    id: "deleted",
    url: "https://deleted.example/page",
    domain: "deleted.example",
    visitTime: now - 90 * 86400000,
    deletedAt: "2026-06-01T00:00:00.000Z"
  };

  assert.deepEqual(
    retentionCleanupCandidates(
      [oldVisit, recentVisit, whitelistedVisit, deletedVisit],
      { whitelist: ["keep.example"] },
      { retentionDays: 30, now }
    ).map((visit) => visit.id),
    ["old"]
  );
});

test("duplicateCleanupCandidates keeps the richest active record per URL and visit time", () => {
  const visitTime = Date.parse("2026-06-16T12:00:00.000Z");
  const sparse = {
    id: "sparse",
    url: "https://example.com/page",
    normalizedUrl: "https://example.com/page",
    title: "",
    visitTime,
    visitCount: 1,
    updatedAt: "2026-06-16T12:00:00.000Z"
  };
  const rich = {
    id: "rich",
    url: "https://example.com/page",
    normalizedUrl: "https://example.com/page",
    title: "Useful title",
    chromeId: "chrome-1",
    visitId: "visit-1",
    visitTime,
    visitCount: 4,
    updatedAt: "2026-06-16T12:01:00.000Z"
  };
  const separateVisit = {
    id: "separate",
    url: "https://example.com/page",
    normalizedUrl: "https://example.com/page",
    title: "Separate visit",
    visitTime: visitTime + 1,
    visitCount: 1
  };
  const deletedDuplicate = {
    id: "deleted",
    url: "https://example.com/page",
    normalizedUrl: "https://example.com/page",
    title: "Deleted duplicate",
    visitTime,
    deletedAt: "2026-06-17T00:00:00.000Z"
  };
  const invalid = {
    id: "invalid",
    url: "",
    visitTime
  };

  assert.deepEqual(
    duplicateCleanupCandidates([sparse, rich, separateVisit, deletedDuplicate, invalid]).map((visit) => visit.id),
    ["sparse"]
  );
});

test("summarizeVaultHealth counts active rows, tombstones, malformed rows, and duplicates", () => {
  const visitTime = Date.parse("2026-06-16T12:00:00.000Z");
  const visits = [
    {
      id: "active-1",
      url: "https://example.com/page",
      normalizedUrl: "https://example.com/page",
      visitTime
    },
    {
      id: "active-2",
      url: "https://example.com/page",
      normalizedUrl: "https://example.com/page",
      visitTime,
      chromeDeletedAt: "2026-06-17T00:00:00.000Z"
    },
    {
      id: "missing-url",
      url: "",
      visitTime
    },
    {
      id: "bad-time",
      url: "https://bad.example/",
      visitTime: "not-a-date"
    },
    {
      id: "deleted",
      url: "https://deleted.example/",
      visitTime,
      deletedAt: "2026-06-17T00:00:00.000Z"
    }
  ];

  assert.deepEqual(summarizeVaultHealth(visits), {
    storedRows: 5,
    activeRecords: 4,
    deletedRecords: 1,
    chromeDeletedRecords: 1,
    missingUrlRecords: 1,
    invalidTimeRecords: 1,
    duplicateActiveRecords: 1,
    issueRecords: 3
  });
});

test("summarizeArchiveInsights reports top domains and busiest local days", () => {
  const dayOne = new Date(2026, 5, 16, 10, 0).getTime();
  const dayTwo = new Date(2026, 5, 17, 10, 0).getTime();
  const visits = [
    {
      id: "a-1",
      url: "https://docs.example/page-1",
      domain: "docs.example",
      visitTime: dayOne
    },
    {
      id: "a-2",
      url: "https://docs.example/page-2",
      domain: "docs.example",
      visitTime: dayOne + 1
    },
    {
      id: "b-1",
      url: "https://b.example/page",
      domain: "b.example",
      visitTime: dayTwo
    },
    {
      id: "missing-domain",
      url: "https://fallback.example/page",
      visitTime: dayTwo + 1
    },
    {
      id: "deleted",
      url: "https://docs.example/deleted",
      domain: "docs.example",
      visitTime: dayTwo + 2,
      deletedAt: "2026-06-17T00:00:00.000Z"
    },
    {
      id: "bad-time",
      url: "https://bad.example/page",
      domain: "bad.example",
      visitTime: "not-a-date"
    }
  ];

  assert.deepEqual(summarizeArchiveInsights(visits, { limit: 2 }), {
    totalVisits: 4,
    activeDays: 2,
    averageVisitsPerActiveDay: 2,
    oldestVisitTime: dayOne,
    newestVisitTime: dayTwo + 1,
    topDomains: [
      { domain: "docs.example", count: 2 },
      { domain: "b.example", count: 1 }
    ],
    busiestDays: [
      { day: "2026-06-17", count: 2 },
      { day: "2026-06-16", count: 2 }
    ]
  });
});

test("retentionCleanupCandidates ignores invalid retention windows", () => {
  const now = Date.parse("2026-06-17T12:00:00.000Z");
  const visits = [{
    id: "old",
    url: "https://old.example/page",
    visitTime: now - 40 * 86400000
  }];

  assert.deepEqual(retentionCleanupCandidates(visits, {}, { retentionDays: 0, now }), []);
  assert.deepEqual(retentionCleanupCandidates(visits, {}, { retentionDays: 1.5, now }), []);
  assert.deepEqual(retentionCleanupCandidates(visits, {}, { retentionDays: "abc", now }), []);
});
