import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveVisitsForExport,
  createImportArchivePlan,
  duplicateCleanupCandidates,
  makeVisitId,
  mergeImportedVisits,
  normalizeHistoryItem,
  retentionCleanupCandidates,
  summarizeArchiveInsights,
  summarizeVaultHealth,
  summarizeImportArchive
} from "../../src/storage.js";

test("summarizeImportArchive reports new, existing, duplicate, invalid, and rule counts", () => {
  const visitTime = Date.parse("2026-06-16T12:00:00Z");
  const existingId = makeVisitId("https://example.com/a", visitTime);
  const archive = {
    app: "fixture",
    schemaVersion: 1,
    rules: [
      { type: "blacklist", value: "ads.example" },
      { type: "other", value: "ignored.example" }
    ],
    visits: [
      {
        url: "https://example.com/a",
        title: "Existing",
        visitTime
      },
      {
        url: "https://example.com/a",
        title: "Existing duplicate",
        visitTime
      },
      {
        url: "https://example.com/b",
        title: "New",
        visitTime: visitTime + 1000
      },
      {
        title: "Missing URL",
        visitTime
      }
    ]
  };

  assert.deepEqual(summarizeImportArchive(archive, [existingId]), {
    sourceApp: "fixture",
    schemaVersion: 1,
    rows: 4,
    validRows: 3,
    invalidRows: 1,
    uniqueVisits: 2,
    duplicateRows: 1,
    existingVisits: 1,
    newVisits: 1,
    rules: 1
  });
});

test("summarizeImportArchive recognizes Google Takeout browser history rows", () => {
  const archive = {
    "Browser History": [
      {
        url: "https://takeout.example/",
        title: "Takeout",
        time_usec: 1780000000000000
      }
    ]
  };

  const summary = summarizeImportArchive(archive);

  assert.equal(summary.sourceApp, "google-takeout");
  assert.equal(summary.rows, 1);
  assert.equal(summary.validRows, 1);
  assert.equal(summary.newVisits, 1);
});

test("summarizeImportArchive recognizes Google My Activity arrays", () => {
  const archive = [
    {
      header: "Chrome",
      title: "Visited Account History",
      titleUrl: "https://activity.example/page",
      time: "2026-06-16T12:00:00.000Z",
      products: ["Chrome"]
    },
    {
      header: "Search",
      title: "Search result without URL",
      time: "2026-06-16T12:01:00.000Z",
      products: ["Search"]
    }
  ];

  const summary = summarizeImportArchive(archive);

  assert.equal(summary.sourceApp, "google-my-activity");
  assert.equal(summary.rows, 2);
  assert.equal(summary.validRows, 1);
  assert.equal(summary.invalidRows, 1);
  assert.equal(summary.newVisits, 1);
});

test("normalizeHistoryItem keeps BrowseVault ids separate from Chrome ids", () => {
  const visitTime = Date.parse("2026-06-16T12:00:00Z");
  const csvImport = normalizeHistoryItem({
    id: "browsevault-id",
    chromeId: "chrome|visit",
    url: "https://example.com/export",
    title: "Exported",
    visitTime
  });
  const chromeImport = normalizeHistoryItem({
    id: "123",
    url: "https://example.com/chrome",
    title: "Chrome",
    visitTime
  });

  assert.equal(csvImport.id, makeVisitId("https://example.com/export", visitTime));
  assert.equal(csvImport.chromeId, "chrome|visit");
  assert.equal(chromeImport.id, makeVisitId("https://example.com/chrome", visitTime));
  assert.equal(chromeImport.chromeId, "123");
});

test("archiveVisitsForExport orders visits newest first with stable tie-breakers", () => {
  const newest = {
    id: "newest",
    url: "https://example.com/newest",
    title: "Newest",
    visitTime: Date.parse("2026-06-17T12:00:00.000Z")
  };
  const older = {
    id: "older",
    url: "https://example.com/older",
    title: "Older",
    visitTime: Date.parse("2026-06-16T12:00:00.000Z")
  };
  const sameTimeB = {
    id: "same-b",
    url: "https://b.example/page",
    title: "B",
    visitTime: newest.visitTime
  };
  const sameTimeA = {
    id: "same-a",
    url: "https://a.example/page",
    title: "A",
    visitTime: newest.visitTime
  };
  const invalidTime = {
    id: "invalid",
    url: "https://invalid.example/page",
    title: "Invalid",
    visitTime: "not-a-date"
  };
  const input = [invalidTime, older, sameTimeB, newest, sameTimeA];

  assert.deepEqual(archiveVisitsForExport(input).map((visit) => visit.id), [
    "same-a",
    "same-b",
    "newest",
    "older",
    "invalid"
  ]);
  assert.deepEqual(input.map((visit) => visit.id), [
    "invalid",
    "older",
    "same-b",
    "newest",
    "same-a"
  ]);
});

test("mergeImportedVisits preserves existing local tombstones and creation metadata", () => {
  const id = "visit-1";
  const existing = {
    id,
    url: "https://example.com/original",
    title: "Original",
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: "2026-06-01T00:00:00.000Z",
    chromeDeletedAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
  const imported = {
    id,
    url: "https://example.com/imported",
    title: "Imported",
    createdAt: "2026-06-16T00:00:00.000Z",
    deletedAt: null,
    chromeDeletedAt: null,
    updatedAt: "2026-06-16T00:00:00.000Z"
  };

  assert.deepEqual(mergeImportedVisits([existing], [imported]), [{
    ...imported,
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: "2026-06-01T00:00:00.000Z",
    chromeDeletedAt: "2026-06-02T00:00:00.000Z"
  }]);
});

test("mergeImportedVisits collapses duplicate rows and carries tombstones across them", () => {
  const first = {
    id: "visit-1",
    title: "First",
    deletedAt: "2026-06-01T00:00:00.000Z",
    chromeDeletedAt: null
  };
  const second = {
    id: "visit-1",
    title: "Second",
    deletedAt: null,
    chromeDeletedAt: "2026-06-02T00:00:00.000Z"
  };

  assert.deepEqual(mergeImportedVisits([], [first, second]), [{
    ...second,
    deletedAt: "2026-06-01T00:00:00.000Z",
    chromeDeletedAt: "2026-06-02T00:00:00.000Z"
  }]);
});

test("mergeImportedVisits returns unique imported records in first-seen order", () => {
  assert.deepEqual(mergeImportedVisits([], [
    { id: "a", title: "First A" },
    { id: "b", title: "First B" },
    { id: "a", title: "Second A" }
  ]), [
    { id: "a", title: "Second A", deletedAt: null, chromeDeletedAt: null },
    { id: "b", title: "First B" }
  ]);
});

test("createImportArchivePlan prepares atomic visits, rules, and metadata writes", () => {
  const importedAt = "2026-06-17T12:00:00.000Z";
  const visitTime = Date.parse("2026-06-16T12:00:00.000Z");
  const existingId = makeVisitId("https://example.com/a", visitTime);
  const archive = {
    app: "fixture-app",
    schemaVersion: 2,
    rules: [
      { type: "blacklist", value: "ads.example" },
      { type: "whitelist", value: "https://www.keep.example/path" },
      { type: "unsupported", value: "ignored.example" }
    ],
    visits: [
      {
        url: "https://example.com/a",
        title: "Restored title",
        visitTime
      },
      {
        url: "https://example.com/a",
        title: "Duplicate row wins",
        visitTime
      },
      {
        url: "https://example.com/b",
        title: "New visit",
        visitTime: visitTime + 1
      }
    ]
  };

  const plan = createImportArchivePlan(
    archive,
    [{
      id: existingId,
      url: "https://example.com/a",
      title: "Existing title",
      visitTime,
      createdAt: "2026-06-01T00:00:00.000Z",
      deletedAt: "2026-06-10T00:00:00.000Z"
    }],
    importedAt
  );

  assert.equal(plan.records.length, 2);
  assert.equal(plan.records[0].id, existingId);
  assert.equal(plan.records[0].title, "Duplicate row wins");
  assert.equal(plan.records[0].createdAt, "2026-06-01T00:00:00.000Z");
  assert.equal(plan.records[0].deletedAt, "2026-06-10T00:00:00.000Z");
  assert.deepEqual(plan.rules, [
    {
      id: "blacklist:ads.example",
      type: "blacklist",
      value: "ads.example",
      createdAt: importedAt
    },
    {
      id: "whitelist:keep.example",
      type: "whitelist",
      value: "keep.example",
      createdAt: importedAt
    }
  ]);
  assert.deepEqual(plan.metadata, {
    importedAt,
    sourceApp: "fixture-app",
    schemaVersion: 2,
    visits: 2,
    validRows: 3,
    duplicateRows: 1,
    rules: 2
  });
  assert.deepEqual(plan.result, {
    importedAt,
    visits: 2,
    validRows: 3,
    duplicateRows: 1,
    rules: 2
  });
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
