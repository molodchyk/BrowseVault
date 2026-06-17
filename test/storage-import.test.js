import test from "node:test";
import assert from "node:assert/strict";
import {
  makeVisitId,
  mergeImportedVisits,
  normalizeHistoryItem,
  retentionCleanupCandidates,
  summarizeImportArchive
} from "../src/storage.js";

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
