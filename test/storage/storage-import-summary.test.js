import test from "node:test";
import assert from "node:assert/strict";
import {
  makeVisitId,
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
      { type: "category", value: "docs.example", category: "Research" },
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
    rules: 2
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
