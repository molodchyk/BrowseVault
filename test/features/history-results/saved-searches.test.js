import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSavedSearchName,
  normalizeSavedSearches,
  removeSavedSearch,
  savedSearchHasCriteria,
  upsertSavedSearch
} from "../../../src/features/history-results/core/saved-searches.js";

const now = () => "2026-06-16T12:00:00.000Z";

test("saved search helpers normalize, upsert, cap, and remove searches", () => {
  const first = upsertSavedSearch([], {
    after: "2026-01-01",
    before: "2026-12-31",
    limit: "5000",
    name: "Research docs",
    query: " docs site:example.com ",
    sortOrder: "oldest"
  }, now);

  assert.deepEqual(first, [{
    id: "saved:research-docs",
    name: "Research docs",
    query: "docs site:example.com",
    onDate: "",
    after: "2026-01-01",
    before: "2026-12-31",
    limit: "5000",
    sortOrder: "oldest",
    createdAt: "2026-06-16T12:00:00.000Z",
    updatedAt: "2026-06-16T12:00:00.000Z"
  }]);

  const updated = upsertSavedSearch(first, {
    name: "Research docs",
    query: "title:invoice"
  }, () => "2026-06-17T12:00:00.000Z");

  assert.equal(updated.length, 1);
  assert.equal(updated[0].createdAt, "2026-06-16T12:00:00.000Z");
  assert.equal(updated[0].updatedAt, "2026-06-17T12:00:00.000Z");
  assert.equal(updated[0].query, "title:invoice");
  assert.equal(updated[0].sortOrder, "newest");
  assert.deepEqual(removeSavedSearch(updated, "saved:research-docs"), []);
});

test("saved search helpers derive defaults and ignore invalid entries", () => {
  assert.equal(savedSearchHasCriteria({ query: "", onDate: "", after: "", before: "" }), false);
  assert.equal(savedSearchHasCriteria({ query: "", onDate: "", after: "", before: "", sortOrder: "oldest" }), true);
  assert.equal(savedSearchHasCriteria({ after: "2026-01-01" }), true);
  assert.equal(defaultSavedSearchName({ query: " docs site:github.com " }), "docs site:github.com");
  assert.equal(defaultSavedSearchName({ query: "", onDate: "2026-06-16" }), "2026-06-16");
  assert.equal(defaultSavedSearchName({ query: "", sortOrder: "oldest" }), "Oldest first");
  assert.deepEqual(normalizeSavedSearches([{ name: "" }, { name: "B" }, { name: "A" }]).map((entry) => entry.name), ["A", "B"]);
  assert.match(normalizeSavedSearches([{ name: "документы", query: "docs" }])[0].id, /^saved:/);
});
