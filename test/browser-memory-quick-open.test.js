import test from "node:test";
import assert from "node:assert/strict";
import {
  createQuickOpenActions,
  handleQuickResultKeyDown,
  quickBackgroundActionMessage,
  quickBackgroundActionStatusLabel,
  quickActionLabel,
  quickActionMessage,
  quickActionStatusLabel
} from "../src/features/browser-memory/ui/quick-open-actions.js";

function fakeNode() {
  return {
    dataset: {},
    href: "",
    listeners: {},
    tabIndex: null,
    textContent: "",
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    click() {
      return this.listeners.click?.();
    },
    closest() {
      return null;
    },
    focus() {
      this.focused = true;
    },
    querySelector() {
      return null;
    }
  };
}

function fakeFragment() {
  const result = fakeNode();
  const nodes = {
    ".quick-result": result,
    ".source-pill": fakeNode(),
    ".result-title": fakeNode(),
    ".url": fakeNode(),
    ".meta": fakeNode(),
    ".quick-action": fakeNode(),
    ".quick-background": fakeNode(),
    ".quick-copy": fakeNode()
  };
  result.closest = (selector) => (selector === ".quick-result[data-quick-index]" ? result : null);
  result.querySelector = (selector) => nodes[selector] || null;

  return {
    nodes,
    querySelector(selector) {
      return nodes[selector];
    }
  };
}

function fakeList() {
  return {
    children: [],
    append(...children) {
      this.children.push(...children);
    },
    querySelectorAll(selector) {
      if (selector !== ".quick-result[data-quick-index]") {
        return [];
      }
      return this.children
        .map((child) => child.nodes?.[".quick-result"])
        .filter((row) => row?.dataset?.quickIndex !== undefined);
    },
    replaceChildren(...children) {
      this.children = [...children];
    }
  };
}

function createHarness({ searchResults, services = {} } = {}) {
  const statuses = [];
  const copied = [];
  const runtimeMessages = [];
  const appState = {
    quickSearchRequestId: 0
  };
  const quickResults = fakeList();
  const fragments = [];
  const actions = createQuickOpenActions({
    appState,
    copyText: async (text) => copied.push(text),
    elements: {
      quickResults,
      quickResultTemplate: {
        content: {
          cloneNode() {
            const fragment = fakeFragment();
            fragments.push(fragment);
            return fragment;
          }
        }
      }
    },
    getDateFormat: () => "iso",
    getSearchText: () => "docs site:example.com",
    quickResultLimit: () => 25,
    services: {
      appendHighlightedText: (target, value) => {
        target.textContent = String(value || "");
      },
      document: {
        createElement(tagName) {
          return {
            tagName,
            className: "",
            textContent: ""
          };
        }
      },
      formatDate: (timestamp, dateFormat) => `${dateFormat}:${timestamp}`,
      highlightTokensForScope: (_query, scope) => [`token:${scope}`],
      parseQuery: (text) => ({ regex: null, text }),
      searchBrowserMemory: async () => searchResults || { results: [], total: 0, warnings: [] },
      sendRuntimeMessage: async (message) => {
        runtimeMessages.push(message);
        return { ok: true };
      },
      ...services
    },
    setStatus: (message) => statuses.push(message)
  });

  return { actions, appState, copied, fragments, quickResults, runtimeMessages, statuses };
}

test("quick action helpers map browser-memory actions to background messages and labels", () => {
  const tab = {
    title: "Docs",
    url: "https://example.com/docs",
    action: { type: "activate-tab", tabId: 7, windowId: 2 }
  };
  const recent = {
    title: "Recent",
    url: "https://example.com/recent",
    action: { type: "restore-session", sessionId: "abc" }
  };
  const plain = {
    title: "Plain",
    url: "https://example.com/plain"
  };

  assert.deepEqual(quickActionMessage(tab), {
    type: "browseVault.activateTab",
    tabId: 7,
    windowId: 2
  });
  assert.deepEqual(quickActionMessage(recent), {
    type: "browseVault.restoreSession",
    sessionId: "abc"
  });
  assert.deepEqual(quickActionMessage(plain), {
    type: "browseVault.openUrl",
    url: "https://example.com/plain"
  });
  assert.deepEqual(quickBackgroundActionMessage(plain), {
    type: "browseVault.openUrlBackground",
    url: "https://example.com/plain"
  });
  assert.equal(quickActionLabel(tab), "Switch");
  assert.equal(quickActionLabel(recent), "Restore");
  assert.equal(quickActionLabel(plain), "Open");
  assert.equal(quickActionStatusLabel(tab), "Switched to Docs");
  assert.equal(quickActionStatusLabel(recent), "Restored Recent");
  assert.equal(quickBackgroundActionStatusLabel(plain), "Opened Plain in background");
});

test("runQuickSearch renders results and wires quick action and copy buttons", async () => {
  const item = {
    type: "tab",
    title: "Docs",
    url: "https://example.com/docs",
    detail: "Open tab",
    domain: "example.com",
    visitTime: 123,
    action: { type: "activate-tab", tabId: 7, windowId: 2 }
  };
  const { actions, copied, fragments, quickResults, runtimeMessages, statuses } = createHarness({
    searchResults: {
      results: [item],
      total: 1,
      warnings: []
    }
  });

  await actions.runQuickSearch();

  assert.equal(quickResults.children.length, 1);
  assert.equal(fragments[0].nodes[".source-pill"].textContent, "tab");
  assert.equal(fragments[0].nodes[".result-title"].href, "https://example.com/docs");
  assert.equal(fragments[0].nodes[".quick-result"].dataset.quickIndex, "0");
  assert.equal(fragments[0].nodes[".quick-result"].tabIndex, 0);
  assert.equal(fragments[0].nodes[".result-title"].textContent, "Docs");
  assert.equal(fragments[0].nodes[".url"].textContent, "https://example.com/docs");
  assert.equal(fragments[0].nodes[".meta"].textContent, "Open tab · example.com · iso:123");
  assert.equal(fragments[0].nodes[".quick-action"].textContent, "Switch");
  assert.deepEqual(statuses, ["Searching browser sources", "1 source result"]);

  await fragments[0].nodes[".quick-action"].listeners.click();
  await fragments[0].nodes[".quick-background"].listeners.click();
  await fragments[0].nodes[".quick-copy"].listeners.click();

  assert.deepEqual(runtimeMessages, [
    {
      type: "browseVault.activateTab",
      tabId: 7,
      windowId: 2
    },
    {
      type: "browseVault.openUrlBackground",
      url: "https://example.com/docs"
    }
  ]);
  assert.deepEqual(copied, ["https://example.com/docs"]);
  assert.deepEqual(statuses.slice(2), [
    "Switched to Docs",
    "Opened Docs in background",
    "Copied URL for Docs"
  ]);
});

test("runQuickSearch ignores stale source results", async () => {
  const { actions, appState, quickResults, statuses } = createHarness({
    services: {
      searchBrowserMemory: async () => {
        appState.quickSearchRequestId += 1;
        return {
          results: [{ title: "Stale", url: "https://example.com" }],
          total: 1,
          warnings: []
        };
      }
    }
  });

  await actions.runQuickSearch();

  assert.deepEqual(statuses, ["Searching browser sources"]);
  assert.deepEqual(quickResults.children, []);
});

test("renderQuickResults shows source warnings in the empty state", () => {
  const { actions, quickResults } = createHarness();

  actions.renderQuickResults([], 0, ["Bookmarks unavailable"]);

  assert.equal(quickResults.children.length, 1);
  assert.equal(quickResults.children[0].className, "quick-result");
  assert.equal(quickResults.children[0].textContent, "No source results. Bookmarks unavailable");
});

function fakeQuickRow(id, calls) {
  const action = {
    click: () => calls.push(`action:${id}`)
  };
  const row = {
    id,
    dataset: { quickIndex: id },
    closest: (selector) => (selector === ".quick-result[data-quick-index]" ? row : null),
    focus: () => calls.push(`focus:${id}`),
    querySelector: (selector) => (selector === ".quick-action" ? action : null),
    tabIndex: null
  };
  return row;
}

function fakeKeyEvent(key, target) {
  const calls = [];
  return {
    calls,
    event: {
      key,
      target,
      preventDefault: () => calls.push("prevent")
    }
  };
}

test("quick result keyboard navigation moves roving focus and runs primary action", () => {
  const calls = [];
  const rows = [
    fakeQuickRow("a", calls),
    fakeQuickRow("b", calls),
    fakeQuickRow("c", calls)
  ];
  const quickResults = {
    querySelectorAll: (selector) => (selector === ".quick-result[data-quick-index]" ? rows : [])
  };

  const down = fakeKeyEvent("ArrowDown", rows[0]);
  assert.equal(handleQuickResultKeyDown(down.event, quickResults), true);
  assert.deepEqual(down.calls, ["prevent"]);
  assert.deepEqual(calls, ["focus:b"]);
  assert.deepEqual(rows.map((row) => row.tabIndex), [-1, 0, -1]);

  const home = fakeKeyEvent("Home", rows[2]);
  assert.equal(handleQuickResultKeyDown(home.event, quickResults), true);
  assert.deepEqual(calls, ["focus:b", "focus:a"]);
  assert.deepEqual(rows.map((row) => row.tabIndex), [0, -1, -1]);

  const enter = fakeKeyEvent("Enter", rows[0]);
  assert.equal(handleQuickResultKeyDown(enter.event, quickResults), true);
  assert.deepEqual(calls, ["focus:b", "focus:a", "action:a"]);
});

test("quick result keyboard handler leaves nested controls alone", () => {
  const calls = [];
  const row = fakeQuickRow("a", calls);
  const childTarget = {
    closest: (selector) => (selector === ".quick-result[data-quick-index]" ? row : null)
  };
  const quickResults = {
    querySelectorAll: (selector) => (selector === ".quick-result[data-quick-index]" ? [row] : [])
  };

  const childEnter = fakeKeyEvent("Enter", childTarget);
  assert.equal(handleQuickResultKeyDown(childEnter.event, quickResults), false);
  assert.deepEqual(calls, []);

  const space = fakeKeyEvent(" ", row);
  assert.equal(handleQuickResultKeyDown(space.event, quickResults), true);
  assert.deepEqual(calls, ["action:a"]);
});
