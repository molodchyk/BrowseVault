import test from "node:test";
import assert from "node:assert/strict";
import { createSavedSearchActions } from "../../../src/features/history-results/ui/saved-search-actions.js";

function fakeDocument() {
  return {
    createElement(tagName) {
      assert.equal(tagName, "option");
      return {
        textContent: "",
        value: ""
      };
    }
  };
}

function fakeSelect() {
  const select = {
    children: [],
    ownerDocument: fakeDocument(),
    value: "",
    append(option) {
      this.children.push(option);
    },
    set textContent(_value) {
      this.children = [];
    },
    get textContent() {
      return this.children.map((child) => child.textContent).join("");
    }
  };
  return select;
}

function createHarness() {
  let searches = [{
    id: "saved:docs",
    name: "Docs",
    query: "docs",
    onDate: "",
    after: "",
    before: "",
    limit: "500",
    sortOrder: "newest",
    createdAt: "2026-06-16T12:00:00.000Z",
    updatedAt: "2026-06-16T12:00:00.000Z"
  }];
  const statuses = [];
  const appliedValues = [];
  const runCalls = [];
  let currentValues = {
    query: "github site:github.com",
    onDate: "",
    after: "2026-01-01",
    before: "",
    limit: "1000",
    sortOrder: "oldest"
  };
  const savedSearches = fakeSelect();
  const actions = createSavedSearchActions({
    deleteSavedSearch: async (id) => {
      searches = searches.filter((search) => search.id !== id);
      return searches;
    },
    elements: {
      savedSearches
    },
    getSavedSearches: async () => searches,
    readSearchValues: () => currentValues,
    runSearchesNow: async () => runCalls.push("runSearchesNow"),
    saveSavedSearch: async (input) => {
      searches = [{
        id: "saved:github-docs",
        name: input.name.trim(),
        query: input.query,
        onDate: input.onDate,
        after: input.after,
        before: input.before,
        limit: input.limit,
        sortOrder: input.sortOrder,
        createdAt: "2026-06-16T12:00:00.000Z",
        updatedAt: "2026-06-16T12:00:00.000Z"
      }];
      return searches;
    },
    services: {
      promptForName: () => "GitHub docs"
    },
    setStatus: (message) => statuses.push(message),
    writeSearchValues: (values) => {
      currentValues = values;
      appliedValues.push(values);
    }
  });

  return { actions, appliedValues, runCalls, savedSearches, statuses };
}

test("saved search actions render, save, apply, and delete saved searches", async () => {
  const { actions, appliedValues, runCalls, savedSearches, statuses } = createHarness();

  await actions.loadSavedSearches();
  assert.deepEqual(savedSearches.children.map((option) => [option.value, option.textContent]), [
    ["", "Saved searches"],
    ["saved:docs", "Docs"]
  ]);

  await actions.saveCurrentSearch();
  assert.equal(savedSearches.value, "saved:github-docs");
  assert.equal(statuses.at(-1), "Saved search: GitHub docs");

  await actions.applySelectedSearch();
  assert.equal(runCalls.length, 1);
  assert.equal(appliedValues[0].query, "github site:github.com");
  assert.equal(appliedValues[0].sortOrder, "oldest");
  assert.equal(statuses.at(-1), "Applied saved search: GitHub docs");

  await actions.deleteSelectedSearch();
  assert.deepEqual(savedSearches.children.map((option) => [option.value, option.textContent]), [
    ["", "Saved searches"]
  ]);
  assert.equal(statuses.at(-1), "Deleted saved search: GitHub docs");
});

test("saved search actions report missing criteria or selection", async () => {
  const statuses = [];
  const actions = createSavedSearchActions({
    deleteSavedSearch: async () => [],
    elements: {
      savedSearches: fakeSelect()
    },
    getSavedSearches: async () => [],
    readSearchValues: () => ({ query: "", onDate: "", after: "", before: "", limit: "500", sortOrder: "newest" }),
    runSearchesNow: async () => {},
    saveSavedSearch: async () => [],
    setStatus: (message) => statuses.push(message),
    writeSearchValues: () => {}
  });

  await actions.saveCurrentSearch();
  await actions.applySelectedSearch();
  await actions.deleteSelectedSearch();

  assert.deepEqual(statuses, [
    "Enter a search before saving",
    "Choose a saved search first",
    "Choose a saved search first"
  ]);
});
