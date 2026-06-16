import test from "node:test";
import assert from "node:assert/strict";
import {
  createQuickOpenActions,
  quickActionLabel,
  quickActionMessage,
  quickActionStatusLabel
} from "../src/features/browser-memory/ui/quick-open-actions.js";

function fakeNode() {
  return {
    href: "",
    listeners: {},
    textContent: "",
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
  };
}

function fakeFragment() {
  const nodes = {
    ".source-pill": fakeNode(),
    ".result-title": fakeNode(),
    ".url": fakeNode(),
    ".meta": fakeNode(),
    ".quick-action": fakeNode(),
    ".quick-copy": fakeNode()
  };

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
  assert.equal(quickActionLabel(tab), "Switch");
  assert.equal(quickActionLabel(recent), "Restore");
  assert.equal(quickActionLabel(plain), "Open");
  assert.equal(quickActionStatusLabel(tab), "Switched to Docs");
  assert.equal(quickActionStatusLabel(recent), "Opened Recent");
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
  assert.equal(fragments[0].nodes[".result-title"].textContent, "Docs");
  assert.equal(fragments[0].nodes[".url"].textContent, "https://example.com/docs");
  assert.equal(fragments[0].nodes[".meta"].textContent, "Open tab · example.com · iso:123");
  assert.equal(fragments[0].nodes[".quick-action"].textContent, "Switch");
  assert.deepEqual(statuses, ["Searching browser sources", "1 source result"]);

  await fragments[0].nodes[".quick-action"].listeners.click();
  await fragments[0].nodes[".quick-copy"].listeners.click();

  assert.deepEqual(runtimeMessages, [{
    type: "browseVault.activateTab",
    tabId: 7,
    windowId: 2
  }]);
  assert.deepEqual(copied, ["https://example.com/docs"]);
  assert.deepEqual(statuses.slice(2), [
    "Switched to Docs",
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
