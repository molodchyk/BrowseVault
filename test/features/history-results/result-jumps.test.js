import test from "node:test";
import assert from "node:assert/strict";
import {
  createResultJumpActions,
  jumpToResult
} from "../../../src/features/history-results/ui/result-jumps.js";

function fakeRow(id, calls) {
  return {
    id,
    tabIndex: -1,
    focus(options) {
      calls.push(["focus", id, options]);
    },
    scrollIntoView(options) {
      calls.push(["scroll", id, options]);
    }
  };
}

function fakeResultsElement(rows) {
  return {
    querySelectorAll(selector) {
      return selector === ".result" ? rows : [];
    }
  };
}

test("jumpToResult scrolls and focuses the first or last visible result", () => {
  const calls = [];
  const rows = [
    fakeRow("first", calls),
    fakeRow("middle", calls),
    fakeRow("last", calls)
  ];

  assert.equal(jumpToResult(fakeResultsElement(rows), "first"), true);
  assert.deepEqual(rows.map((row) => row.tabIndex), [0, -1, -1]);
  assert.deepEqual(calls, [
    ["scroll", "first", { block: "start", behavior: "smooth" }],
    ["focus", "first", { preventScroll: true }]
  ]);

  calls.length = 0;
  assert.equal(jumpToResult(fakeResultsElement(rows), "last"), true);
  assert.deepEqual(rows.map((row) => row.tabIndex), [-1, -1, 0]);
  assert.deepEqual(calls, [
    ["scroll", "last", { block: "end", behavior: "smooth" }],
    ["focus", "last", { preventScroll: true }]
  ]);
});

test("jumpToResult reports empty visible results", () => {
  assert.equal(jumpToResult(fakeResultsElement([]), "first"), false);
});

test("createResultJumpActions reports jump status", () => {
  const calls = [];
  const statuses = [];
  const elements = {
    results: fakeResultsElement([fakeRow("first", calls)])
  };
  const actions = createResultJumpActions({
    elements,
    setStatus: (message) => statuses.push(message)
  });

  actions.jumpToFirstResult();
  actions.jumpToLastResult();

  assert.deepEqual(statuses, [
    "Jumped to first visible result",
    "Jumped to last visible result"
  ]);

  const emptyActions = createResultJumpActions({
    elements: { results: fakeResultsElement([]) },
    setStatus: (message) => statuses.push(message)
  });
  emptyActions.jumpToFirstResult();

  assert.equal(statuses.at(-1), "No visible results");
});
