import test from "node:test";
import assert from "node:assert/strict";
import {
  countResultsByKey,
  domainForItem,
  invertSelectionForResults,
  loadMoreState,
  reconcileSelectedIds,
  resultCountLabel,
  selectRangeByIndex,
  selectedCountLabel,
  selectedIdsForResults,
  toggleSelectedId,
  uniqueDomainsForItems,
  uniqueUrlsForItems
} from "../src/features/history-results/core/results.js";
import {
  highlightRanges,
  highlightTokensForScope
} from "../src/features/history-results/ui/text-highlighting.js";

const results = [
  { id: "a", url: "https://www.example.com/a", domain: "example.com", day: "2026-06-16" },
  { id: "b", url: "https://example.com/b", domain: "example.com", day: "2026-06-16" },
  { id: "c", url: "https://news.example.net/c", domain: "news.example.net", day: "2026-06-15" }
];

test("unique URL and domain helpers preserve order and remove duplicates", () => {
  assert.deepEqual(uniqueUrlsForItems([...results, results[0]]), [
    "https://www.example.com/a",
    "https://example.com/b",
    "https://news.example.net/c"
  ]);

  assert.deepEqual(uniqueDomainsForItems([...results, { url: "https://www.fallback.test/path" }]), [
    "example.com",
    "news.example.net",
    "fallback.test"
  ]);

  assert.equal(domainForItem({ url: "not a url" }), "");
});

test("selection helpers reconcile, toggle, range-select, and invert visible results", () => {
  assert.deepEqual([...selectedIdsForResults(results)], ["a", "b", "c"]);
  assert.deepEqual([...reconcileSelectedIds(new Set(["a", "missing", "c"]), results)], ["a", "c"]);
  assert.deepEqual([...toggleSelectedId(new Set(["a"]), "b", true)], ["a", "b"]);
  assert.deepEqual([...toggleSelectedId(new Set(["a", "b"]), "a", false)], ["b"]);
  assert.deepEqual([...selectRangeByIndex(new Set(["a"]), results, 0, 2, true)], ["a", "b", "c"]);
  assert.deepEqual([...selectRangeByIndex(new Set(["a", "b", "c"]), results, 1, 2, false)], ["a"]);
  assert.deepEqual([...invertSelectionForResults(new Set(["a"]), results)], ["b", "c"]);
});

test("result labels, grouping, and load-more state are deterministic", () => {
  assert.equal(resultCountLabel(1, 1), "1 result (1 shown)");
  assert.equal(resultCountLabel(12, 5), "12 results (5 shown)");
  assert.equal(selectedCountLabel(2), "2 selected");

  assert.deepEqual([...countResultsByKey(results, (result) => result.day)], [
    ["2026-06-16", 2],
    ["2026-06-15", 1]
  ]);

  assert.deepEqual(loadMoreState({ total: 1200, shown: 500, step: 500, max: 50000 }), {
    canLoadMore: true,
    nextCount: 500
  });
  assert.deepEqual(loadMoreState({ total: 1200, shown: 1000, step: 500, max: 1100 }), {
    canLoadMore: true,
    nextCount: 100
  });
  assert.deepEqual(loadMoreState({ total: 1000, shown: 1000, step: 500, max: 50000 }), {
    canLoadMore: false,
    nextCount: 0
  });
});

test("highlight helpers choose scoped tokens and merge overlapping ranges", () => {
  const query = {
    terms: ["alpha"],
    phrases: ["beta docs"],
    title: ["report"],
    url: ["example"],
    site: ["docs.example.com"]
  };

  assert.deepEqual(highlightTokensForScope(query, "title"), ["beta docs", "report", "alpha"]);
  assert.deepEqual(highlightTokensForScope(query, "url"), ["docs.example.com", "beta docs", "example", "alpha"]);
  assert.deepEqual(highlightRanges("Alpha beta docs report", ["alpha", "beta docs"], /docs report/), [
    [0, 5],
    [6, 22]
  ]);
});
