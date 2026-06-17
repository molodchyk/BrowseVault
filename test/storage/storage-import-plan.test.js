import test from "node:test";
import assert from "node:assert/strict";
import {
  createImportArchivePlan,
  makeVisitId,
  mergeImportedVisits
} from "../../src/storage.js";

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
      { type: "category", value: "https://www.docs.example/path", category: "Research Docs" },
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
    },
    {
      id: "category:docs.example",
      type: "category",
      value: "docs.example",
      category: "Research Docs",
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
    rules: 3
  });
  assert.deepEqual(plan.result, {
    importedAt,
    visits: 2,
    validRows: 3,
    duplicateRows: 1,
    rules: 3
  });
});
