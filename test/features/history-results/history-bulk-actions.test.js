import test from "node:test";
import assert from "node:assert/strict";
import { createHistoryBulkActions } from "../../../src/features/history-results/ui/bulk-actions.js";

function createHarness({
  appState = {},
  getMessage = () => "",
  selected = [],
  services = {}
} = {}) {
  const copied = [];
  const rendered = [];
  const runtimeMessages = [];
  const statuses = [];
  const state = {
    currentResults: [{ id: "visible-1" }, { id: "visible-2" }],
    currentTotal: 12,
    selectedIds: new Set(["visible-1"]),
    ...appState
  };
  const actions = createHistoryBulkActions({
    appState: state,
    copyText: async (text) => copied.push(text),
    getMessage,
    getSearchText: () => "docs site:example.com",
    openSelectedLimit: 2,
    renderResults: (...args) => rendered.push(args),
    searchVisits: async () => ({
      results: [{ id: "filtered-1" }, { id: "filtered-2" }],
      total: 2
    }),
    selectedResults: async () => selected,
    services: {
      confirmAction: () => true,
      sendRuntimeMessage: async (message) => {
        runtimeMessages.push(message);
        return { ok: true, opened: message.urls.length };
      },
      ...services
    },
    setStatus: (message) => statuses.push(message)
  });

  return { actions, copied, rendered, runtimeMessages, state, statuses };
}

function messageGetter(messages) {
  return (key, substitutions = []) => {
    const value = messages.get(key);
    if (!value) {
      return "";
    }
    return substitutions.reduce(
      (text, substitution, index) => text.replace(`$${index + 1}`, substitution),
      value
    );
  };
}

test("openSelected opens unique selected URLs and respects the open limit", async () => {
  const { actions, runtimeMessages, statuses } = createHarness({
    selected: [
      { url: "https://example.com/a" },
      { url: "https://example.com/a" },
      { url: "https://example.com/b" },
      { url: "https://example.com/c" }
    ]
  });

  await actions.openSelected();

  assert.deepEqual(runtimeMessages, [{
    type: "browseVault.openUrls",
    urls: ["https://example.com/a", "https://example.com/b"]
  }]);
  assert.deepEqual(statuses, ["Opened 2 selected URLs"]);
});

test("openSelected handles empty, URL-less, and canceled selections", async () => {
  const empty = createHarness();
  await empty.actions.openSelected();
  assert.deepEqual(empty.statuses, ["Select records first"]);

  const noUrls = createHarness({
    selected: [{ title: "No URL" }]
  });
  await noUrls.actions.openSelected();
  assert.deepEqual(noUrls.statuses, ["Selected records have no URLs to open"]);

  const canceled = createHarness({
    selected: [{ url: "https://example.com" }],
    services: {
      confirmAction: () => false
    }
  });
  await canceled.actions.openSelected();
  assert.deepEqual(canceled.statuses, ["Open canceled"]);
});

test("bulk actions use localized confirmations and statuses", async () => {
  const confirmations = [];
  const getMessage = messageGetter(new Map([
    ["confirmOpenSelectedLimited", "open first $1 leave $2"],
    ["statusOpenedSelectedMany", "opened localized $1"],
    ["statusCopiedSelectedUrlMany", "copied localized $1"],
    ["statusSelectedMatchingVaultRecords", "selected localized $1"],
    ["statusInvertedVisibleResults", "inverted localized $1"],
    ["statusNoVisibleResultsToInvert", "nothing localized"]
  ]));
  const harness = createHarness({
    getMessage,
    selected: [
      { url: "https://example.com/a" },
      { url: "https://example.com/b" },
      { url: "https://example.com/c" }
    ],
    services: {
      confirmAction: (message) => {
        confirmations.push(message);
        return true;
      }
    }
  });

  await harness.actions.openSelected();
  await harness.actions.copySelectedUrls();
  await harness.actions.selectAllFiltered();
  harness.actions.invertVisibleSelection();

  assert.deepEqual(confirmations, ["open first 2 leave 1"]);
  assert.deepEqual(harness.statuses, [
    "opened localized 2",
    "copied localized 3",
    "selected localized 2",
    "inverted localized 2"
  ]);

  const empty = createHarness({
    appState: {
      currentResults: [],
      currentTotal: 0,
      selectedIds: new Set()
    },
    getMessage
  });
  empty.actions.invertVisibleSelection();
  assert.deepEqual(empty.statuses, ["nothing localized"]);
});

test("copySelectedUrls copies unique URLs", async () => {
  const { actions, copied, statuses } = createHarness({
    selected: [
      { url: "https://example.com/a" },
      { url: "https://example.com/a" },
      { url: "https://example.com/b" }
    ]
  });

  await actions.copySelectedUrls();

  assert.deepEqual(copied, ["https://example.com/a\nhttps://example.com/b"]);
  assert.deepEqual(statuses, ["Copied 2 selected URLs"]);
});

test("selectAllFiltered selects every matching vault result", async () => {
  const { actions, rendered, state, statuses } = createHarness();

  await actions.selectAllFiltered();

  assert.deepEqual([...state.selectedIds], ["filtered-1", "filtered-2"]);
  assert.deepEqual(rendered, [[state.currentResults, state.currentTotal]]);
  assert.deepEqual(statuses, ["Selected 2 matching vault records"]);
});

test("visible selection helpers select, invert, and clear visible results", () => {
  const { actions, rendered, state, statuses } = createHarness();

  actions.selectVisibleResults();
  assert.deepEqual([...state.selectedIds], ["visible-1", "visible-2"]);

  actions.invertVisibleSelection();
  assert.deepEqual([...state.selectedIds], []);

  actions.clearVisibleSelection();
  assert.deepEqual([...state.selectedIds], []);
  assert.deepEqual(rendered, [
    [state.currentResults, state.currentTotal],
    [state.currentResults, state.currentTotal],
    [state.currentResults, state.currentTotal]
  ]);
  assert.deepEqual(statuses, ["Inverted 2 visible results"]);
});

test("invertVisibleSelection reports empty visible results", () => {
  const { actions, rendered, statuses } = createHarness({
    appState: {
      currentResults: [],
      currentTotal: 0,
      selectedIds: new Set()
    }
  });

  actions.invertVisibleSelection();

  assert.deepEqual(rendered, []);
  assert.deepEqual(statuses, ["No visible results to invert"]);
});
