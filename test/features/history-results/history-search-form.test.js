import test from "node:test";
import assert from "node:assert/strict";
import {
  dateShortcutValues,
  historySearchTextFromValues
} from "../../../src/features/history-results/core/search-form.js";
import { createHistorySearchForm } from "../../../src/features/history-results/ui/search-form.js";

function input(value = "") {
  return { value };
}

test("historySearchTextFromValues composes query and explicit date filters", () => {
  assert.equal(historySearchTextFromValues({
    query: " docs site:example.com ",
    onDate: " 2026-06-16 ",
    after: "2026-01-01",
    before: "2026-12-31"
  }), "docs site:example.com date:2026-06-16 after:2026-01-01 before:2026-12-31");

  assert.equal(historySearchTextFromValues({
    query: "   ",
    onDate: "",
    after: " 2026-01-01 ",
    before: ""
  }), "after:2026-01-01");
});

test("dateShortcutValues returns local ISO day filters", () => {
  const now = new Date(2026, 5, 17, 13, 45);

  assert.deepEqual(dateShortcutValues("today", now), {
    onDate: "2026-06-17",
    after: "",
    before: ""
  });
  assert.deepEqual(dateShortcutValues("yesterday", now), {
    onDate: "2026-06-16",
    after: "",
    before: ""
  });
  assert.deepEqual(dateShortcutValues("last7", now), {
    onDate: "",
    after: "2026-06-11",
    before: "2026-06-17"
  });
  assert.deepEqual(dateShortcutValues("last30", now), {
    onDate: "",
    after: "2026-05-19",
    before: "2026-06-17"
  });
  assert.deepEqual(dateShortcutValues("all", now), {
    onDate: "",
    after: "",
    before: ""
  });
  assert.equal(dateShortcutValues("unknown", now), null);
});

test("createHistorySearchForm reads and clears history search fields", () => {
  const elements = {
    after: input("2026-01-01"),
    before: input("2026-12-31"),
    limit: input("500"),
    onDate: input("2026-06-16"),
    query: input("docs"),
    sortOrder: input("oldest")
  };
  const form = createHistorySearchForm({ elements });

  assert.equal(form.getSearchText(), "docs date:2026-06-16 after:2026-01-01 before:2026-12-31");
  assert.deepEqual(form.readSearchValues(), {
    after: "2026-01-01",
    before: "2026-12-31",
    limit: "500",
    onDate: "2026-06-16",
    query: "docs",
    sortOrder: "oldest"
  });

  form.writeSearchValues({
    after: "2026-02-01",
    before: "2026-02-28",
    limit: "2500",
    onDate: "",
    query: "title:report",
    sortOrder: "newest"
  });

  assert.equal(form.getSearchText(), "title:report after:2026-02-01 before:2026-02-28");
  assert.equal(elements.limit.value, "2500");
  assert.equal(form.getSortOrder(), "newest");
  assert.equal(form.applyDateShortcut("last7", new Date(2026, 5, 17, 13, 45)), true);
  assert.equal(form.getSearchText(), "title:report after:2026-06-11 before:2026-06-17");
  assert.equal(elements.limit.value, "2500");
  assert.equal(form.applyDateShortcut("unknown", new Date(2026, 5, 17, 13, 45)), false);
  assert.equal(form.getSearchText(), "title:report after:2026-06-11 before:2026-06-17");

  form.clearSearchFields();

  assert.equal(form.getSearchText(), "");
  assert.deepEqual({
    after: elements.after.value,
    before: elements.before.value,
    limit: elements.limit.value,
    onDate: elements.onDate.value,
    query: elements.query.value,
    sortOrder: elements.sortOrder.value
  }, {
    after: "",
    before: "",
    limit: "2500",
    onDate: "",
    query: "",
    sortOrder: "newest"
  });
});
