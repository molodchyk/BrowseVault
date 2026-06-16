import test from "node:test";
import assert from "node:assert/strict";
import { makeVisitId, normalizeHistoryItem, summarizeImportArchive } from "../src/storage.js";

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

  assert.equal(summary.sourceApp, "unknown");
  assert.equal(summary.rows, 1);
  assert.equal(summary.validRows, 1);
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
