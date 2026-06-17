import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveVisitsForExport,
  createChromeHistorySyncPlan,
  makeVisitId,
  normalizeHistoryItem
} from "../../src/storage.js";

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

test("createChromeHistorySyncPlan preserves tombstones and computes active totals", () => {
  const visitTime = Date.parse("2026-06-16T12:00:00.000Z");
  const existingDeleted = {
    id: makeVisitId("https://example.com/deleted", visitTime),
    url: "https://example.com/deleted",
    visitTime,
    createdAt: "2026-06-01T00:00:00.000Z",
    deletedAt: "2026-06-10T00:00:00.000Z"
  };
  const existingActive = {
    id: "existing-active",
    url: "https://existing.example/page",
    visitTime: visitTime - 1
  };
  const plan = createChromeHistorySyncPlan(
    [
      {
        url: "https://example.com/deleted",
        title: "Deleted seen again",
        visitTime
      },
      {
        url: "https://new.example/page",
        title: "New",
        visitTime: visitTime + 1
      },
      {
        title: "Missing URL",
        visitTime
      }
    ],
    [existingDeleted, existingActive],
    {
      source: "chrome-history",
      reason: "manual"
    }
  );

  assert.equal(plan.scanned, 3);
  assert.equal(plan.stored, 2);
  assert.equal(plan.total, 2);
  assert.equal(plan.records[0].id, existingDeleted.id);
  assert.equal(plan.records[0].createdAt, existingDeleted.createdAt);
  assert.equal(plan.records[0].deletedAt, existingDeleted.deletedAt);
  assert.equal(plan.records[0].source, "chrome-history");
  assert.equal(plan.records[0].sourceReason, "manual");
  assert.equal(plan.records[1].url, "https://new.example/page");
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
