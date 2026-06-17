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
} from "../../../src/features/history-results/core/results.js";
import {
  highlightRanges,
  highlightTokensForScope
} from "../../../src/features/history-results/ui/text-highlighting.js";
import {
  handleHistoryResultKeyDown,
  renderHistoryResults
} from "../../../src/features/history-results/ui/render-results.js";
import { formatDate } from "../../../src/features/display-preferences/core/preferences.js";

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
    site: ["docs.example.com"],
    category: ["research"]
  };

  assert.deepEqual(highlightTokensForScope(query, "title"), ["beta docs", "report", "alpha"]);
  assert.deepEqual(highlightTokensForScope(query, "url"), ["docs.example.com", "beta docs", "example", "alpha"]);
  assert.deepEqual(highlightTokensForScope(query, "meta"), ["docs.example.com", "beta docs", "research", "alpha"]);
  assert.deepEqual(highlightRanges("Alpha beta docs report", ["alpha", "beta docs"], /docs report/), [
    [0, 5],
    [6, 22]
  ]);
});

function textFromChild(child) {
  return typeof child === "string" ? child : child?.textContent || "";
}

function fakeDomNode(ownerDocument, tagName = "div") {
  return {
    ownerDocument,
    tagName,
    attributes: {},
    checked: false,
    children: [],
    className: "",
    dataset: {},
    href: "",
    listeners: {},
    tabIndex: null,
    textContent: "",
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    append(...children) {
      this.children.push(...children);
      this.textContent += children.map(textFromChild).join("");
    },
    focus() {
      this.focused = true;
    },
    querySelector() {
      return null;
    },
    replaceChildren(...children) {
      this.children = [];
      this.textContent = "";
      if (children.length) {
        this.append(...children);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  };
}

function fakeDocument() {
  const document = {
    createElement(tagName) {
      return fakeDomNode(document, tagName);
    },
    createTextNode(text) {
      return {
        nodeType: 3,
        textContent: String(text)
      };
    }
  };
  return document;
}

function fakeResultFragment(document) {
  const nodes = {
    ".result": fakeDomNode(document, "li"),
    ".result-check": fakeDomNode(document, "input"),
    ".result-title": fakeDomNode(document, "a"),
    ".url": fakeDomNode(document, "div"),
    ".meta": fakeDomNode(document, "div")
  };
  nodes[".result"].closest = (selector) => (selector === ".result" ? nodes[".result"] : null);
  nodes[".result"].querySelector = (selector) => nodes[selector] || null;

  return {
    nodes,
    querySelector(selector) {
      return nodes[selector] || null;
    }
  };
}

function fakeResultsList(document) {
  return {
    ownerDocument: document,
    children: [],
    onkeydown: null,
    append(...children) {
      this.children.push(...children);
    },
    querySelectorAll(selector) {
      if (selector !== ".result") {
        return [];
      }
      return this.children
        .map((child) => child.nodes?.[".result"] || (child.className === "result" ? child : null))
        .filter(Boolean);
    },
    replaceChildren(...children) {
      this.children = [...children];
    }
  };
}

test("renderHistoryResults exposes exact visit timestamps in result metadata", () => {
  const document = fakeDocument();
  const fragments = [];
  const visitTime = new Date(2026, 5, 10, 12, 34).getTime();
  const resultsList = fakeResultsList(document);
  const resultTemplate = {
    content: {
      cloneNode() {
        const fragment = fakeResultFragment(document);
        fragments.push(fragment);
        return fragment;
      }
    }
  };

  renderHistoryResults({
    results: [{
      id: "visit-1",
      title: "Docs",
      url: "https://docs.github.com/en/apps",
      domain: "docs.github.com",
      visitTime,
      visitCount: 3,
      source: "chrome-history"
    }],
    total: 1,
    queryText: "",
    selectedIds: new Set(),
    dateFormat: "iso",
    elements: {
      resultCount: fakeDomNode(document, "strong"),
      results: resultsList,
      resultTemplate
    },
    getSelectionState: () => ({ selectedIds: new Set(), lastCheckedIndex: null }),
    onSelectionChange: () => {}
  });

  const meta = fragments[0].nodes[".meta"];
  const time = meta.children.find((child) => child.tagName === "time");
  const iso = new Date(visitTime).toISOString();
  const displayedTime = formatDate(visitTime, "iso");

  assert.equal(time.textContent, displayedTime);
  assert.equal(time.dateTime, iso);
  assert.equal(time.title, `Exact visit time: ${iso}`);
  assert.equal(meta.textContent, `docs.github.com · ${displayedTime} · 3 visits · chrome-history`);
});

test("renderHistoryResults shows category metadata when present", () => {
  const document = fakeDocument();
  const fragments = [];
  const visitTime = new Date(2026, 5, 10, 12, 34).getTime();
  const resultsList = fakeResultsList(document);
  const resultTemplate = {
    content: {
      cloneNode() {
        const fragment = fakeResultFragment(document);
        fragments.push(fragment);
        return fragment;
      }
    }
  };

  renderHistoryResults({
    results: [{
      id: "visit-1",
      title: "Docs",
      url: "https://docs.github.com/en/apps",
      domain: "docs.github.com",
      category: "Research",
      visitTime,
      visitCount: 3,
      source: "chrome-history"
    }],
    total: 1,
    queryText: "category:research",
    selectedIds: new Set(),
    dateFormat: "iso",
    elements: {
      resultCount: fakeDomNode(document, "strong"),
      results: resultsList,
      resultTemplate
    },
    getSelectionState: () => ({ selectedIds: new Set(), lastCheckedIndex: null }),
    onSelectionChange: () => {}
  });

  const meta = fragments[0].nodes[".meta"];
  assert.match(meta.textContent, /docs\.github\.com · category: Research · /);
});

function fakeResultRow(id, calls, options = {}) {
  const checkbox = options.checkbox || {
    click: () => calls.push(`select:${id}`)
  };
  const row = {
    dataset: options.dataset || {},
    id,
    closest: (selector) => (selector === ".result" ? row : null),
    focus: () => calls.push(`focus:${id}`),
    querySelector: (selector) => {
      if (selector === ".result-title") {
        return {
          click: () => calls.push(`open:${id}`)
        };
      }
      if (selector === ".result-check") {
        return checkbox;
      }
      return null;
    }
  };
  return row;
}

function fakeKeyEvent(key, target) {
  const calls = [];
  return {
    calls,
    event: {
      key,
      shiftKey: false,
      target,
      preventDefault: () => calls.push("prevent")
    }
  };
}

test("history result keyboard navigation moves focus and opens focused rows", () => {
  const calls = [];
  const rows = [
    fakeResultRow("a", calls),
    fakeResultRow("b", calls),
    fakeResultRow("c", calls)
  ];
  const resultsElement = {
    querySelectorAll: (selector) => (selector === ".result" ? rows : [])
  };

  const arrow = fakeKeyEvent("ArrowDown", rows[0]);
  assert.equal(handleHistoryResultKeyDown(arrow.event, resultsElement), true);
  assert.deepEqual(arrow.calls, ["prevent"]);
  assert.deepEqual(calls, ["focus:b"]);
  assert.deepEqual(rows.map((row) => row.tabIndex), [-1, 0, -1]);

  const end = fakeKeyEvent("End", rows[0]);
  assert.equal(handleHistoryResultKeyDown(end.event, resultsElement), true);
  assert.deepEqual(calls, ["focus:b", "focus:c"]);
  assert.deepEqual(rows.map((row) => row.tabIndex), [-1, -1, 0]);

  const enter = fakeKeyEvent("Enter", rows[2]);
  assert.equal(handleHistoryResultKeyDown(enter.event, resultsElement), true);
  assert.deepEqual(calls, ["focus:b", "focus:c", "open:c"]);
});

test("history result keyboard selection uses row focus without hijacking child controls", () => {
  const calls = [];
  const row = fakeResultRow("a", calls);
  const childTarget = {
    closest: (selector) => (selector === ".result" ? row : null)
  };
  const resultsElement = {
    querySelectorAll: (selector) => (selector === ".result" ? [row] : [])
  };

  const space = fakeKeyEvent(" ", row);
  assert.equal(handleHistoryResultKeyDown(space.event, resultsElement), true);
  assert.deepEqual(calls, ["select:a"]);

  const childEnter = fakeKeyEvent("Enter", childTarget);
  assert.equal(handleHistoryResultKeyDown(childEnter.event, resultsElement), false);
  assert.deepEqual(calls, ["select:a"]);
});

test("history result Shift+Space range-selects from the keyboard", () => {
  const calls = [];
  const checkboxes = [
    { checked: true, click: () => calls.push("select:a") },
    { checked: false, click: () => calls.push("select:b") },
    { checked: false, click: () => calls.push("select:c") }
  ];
  const rows = [
    fakeResultRow("a", calls, { checkbox: checkboxes[0], dataset: { resultIndex: "0" } }),
    fakeResultRow("b", calls, { checkbox: checkboxes[1], dataset: { resultIndex: "1" } }),
    fakeResultRow("c", calls, { checkbox: checkboxes[2], dataset: { resultIndex: "2" } })
  ];
  const resultsElement = {
    querySelectorAll: (selector) => (selector === ".result" ? rows : [])
  };
  const selectionChanges = [];
  const space = fakeKeyEvent(" ", rows[2]);
  space.event.shiftKey = true;

  assert.equal(
    handleHistoryResultKeyDown(space.event, resultsElement, {
      results,
      getSelectionState: () => ({
        selectedIds: new Set(["a"]),
        lastCheckedIndex: 0
      }),
      onSelectionChange: (change) => selectionChanges.push(change)
    }),
    true
  );

  assert.deepEqual(space.calls, ["prevent"]);
  assert.equal(checkboxes[2].checked, true);
  assert.equal(selectionChanges.length, 1);
  assert.deepEqual([...selectionChanges[0].selectedIds], ["a", "b", "c"]);
  assert.equal(selectionChanges[0].lastCheckedIndex, 0);
  assert.equal(selectionChanges[0].shouldRerender, true);
  assert.deepEqual(calls, []);
});
