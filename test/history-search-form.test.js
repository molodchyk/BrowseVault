import test from "node:test";
import assert from "node:assert/strict";
import { historySearchTextFromValues } from "../src/features/history-results/core/search-form.js";
import { createHistorySearchForm } from "../src/features/history-results/ui/search-form.js";

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

test("createHistorySearchForm reads and clears history search fields", () => {
  const elements = {
    after: input("2026-01-01"),
    before: input("2026-12-31"),
    onDate: input("2026-06-16"),
    query: input("docs")
  };
  const form = createHistorySearchForm({ elements });

  assert.equal(form.getSearchText(), "docs date:2026-06-16 after:2026-01-01 before:2026-12-31");

  form.clearSearchFields();

  assert.equal(form.getSearchText(), "");
  assert.deepEqual({
    after: elements.after.value,
    before: elements.before.value,
    onDate: elements.onDate.value,
    query: elements.query.value
  }, {
    after: "",
    before: "",
    onDate: "",
    query: ""
  });
});
