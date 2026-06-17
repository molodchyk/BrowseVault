import test from "node:test";
import assert from "node:assert/strict";
import { bindAppEvents, isEditableTarget } from "../src/features/app-shell/ui/events.js";

function fakeElement(extra = {}) {
  const listeners = new Map();
  return {
    dataset: {},
    value: "",
    addEventListener(eventName, listener) {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, []);
      }
      listeners.get(eventName).push(listener);
    },
    dispatch(eventName, event = {}) {
      for (const listener of listeners.get(eventName) || []) {
        listener({
          target: this,
          preventDefault() {},
          ...event
        });
      }
    },
    listenerCount(eventName) {
      return (listeners.get(eventName) || []).length;
    },
    ...extra
  };
}

function fakeDocument() {
  const element = fakeElement();
  return {
    addEventListener: (...args) => element.addEventListener(...args),
    dispatch: (...args) => element.dispatch(...args)
  };
}

function createElements() {
  return {
    tabs: [
      fakeElement({ dataset: { tab: "history" } }),
      fakeElement({ dataset: { tab: "backup" } })
    ],
    query: fakeElement(),
    onDate: fakeElement(),
    after: fakeElement(),
    before: fakeElement(),
    limit: fakeElement(),
    savePreferences: fakeElement(),
    search: fakeElement(),
    quickSearch: fakeElement(),
    clearSearch: fakeElement(),
    savedSearches: fakeElement(),
    applySavedSearch: fakeElement(),
    saveSearch: fakeElement(),
    deleteSavedSearch: fakeElement(),
    syncChrome: fakeElement(),
    exportJson: fakeElement(),
    exportCsv: fakeElement(),
    exportHtml: fakeElement(),
    importArchive: fakeElement(),
    confirmImport: fakeElement(),
    cancelImport: fakeElement(),
    resetVault: fakeElement(),
    openSelected: fakeElement(),
    copySelected: fakeElement(),
    exportSelected: fakeElement(),
    exportSelectedCsv: fakeElement(),
    exportSelectedHtml: fakeElement(),
    blacklistSelected: fakeElement(),
    deleteVault: fakeElement(),
    deleteChrome: fakeElement(),
    undoDelete: fakeElement(),
    selectVisible: fakeElement(),
    invertVisible: fakeElement(),
    selectFiltered: fakeElement(),
    exportResults: fakeElement(),
    exportResultsCsv: fakeElement(),
    exportResultsHtml: fakeElement(),
    loadMore: fakeElement(),
    clearSelection: fakeElement(),
    addBlacklist: fakeElement(),
    addWhitelist: fakeElement(),
    prefTheme: fakeElement(),
    prefAccent: fakeElement()
  };
}

function createHandlers(calls) {
  const handlerNames = [
    "addBlacklistRule",
    "addWhitelistRule",
    "applySavedSearch",
    "blacklistSelectedDomains",
    "cancelStagedImport",
    "clearSearchFields",
    "clearSelection",
    "confirmStagedImport",
    "copySelectedUrls",
    "deleteFromChrome",
    "deleteFromVault",
    "exportAll",
    "exportCsv",
    "exportFilteredResults",
    "exportFilteredResultsCsv",
    "exportFilteredResultsHtml",
    "exportHtml",
    "exportSelected",
    "exportSelectedCsv",
    "exportSelectedHtml",
    "focusSearchInput",
    "importFromFile",
    "invertVisibleSelection",
    "loadMoreResults",
    "openSelected",
    "resetVault",
    "runQuickSearch",
    "runSearchesNow",
    "saveCurrentSearch",
    "savePreferences",
    "scheduleSearches",
    "selectAllFiltered",
    "selectVisible",
    "switchTab",
    "syncChromeHistory",
    "deleteSavedSearch",
    "undoVaultDelete"
  ];
  const handlers = {
    setStatus(message) {
      calls.push(["setStatus", message]);
    }
  };

  for (const name of handlerNames) {
    handlers[name] = (...args) => {
      calls.push([name, ...args]);
    };
  }

  return handlers;
}

test("isEditableTarget identifies form controls", () => {
  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
  assert.equal(isEditableTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
  assert.equal(isEditableTarget(null), false);
});

test("bindAppEvents wires tabs, theme previews, search clearing, and keyboard focus", async () => {
  const calls = [];
  const elements = createElements();
  const document = fakeDocument();
  const root = { dataset: {} };
  const handlers = createHandlers(calls);
  handlers.clearSearchFields = () => {
    calls.push(["clearSearchFields"]);
    elements.query.value = "";
    elements.onDate.value = "";
    elements.after.value = "";
    elements.before.value = "";
  };

  bindAppEvents({
    elements,
    document,
    root,
    handlers
  });

  elements.tabs[1].dispatch("click");
  elements.prefTheme.value = "light";
  elements.prefTheme.dispatch("change");
  elements.prefAccent.value = "blue";
  elements.prefAccent.dispatch("change");

  elements.query.value = "docs";
  elements.onDate.value = "2026-06-16";
  elements.after.value = "2026-01-01";
  elements.before.value = "2026-12-31";
  elements.clearSearch.dispatch("click");
  elements.saveSearch.dispatch("click");
  elements.applySavedSearch.dispatch("click");
  elements.deleteSavedSearch.dispatch("click");
  elements.query.dispatch("keydown", { key: "Enter" });
  document.dispatch("keydown", {
    key: "k",
    ctrlKey: true,
    preventDefault() {
      calls.push(["preventDefault", "ctrl-k"]);
    }
  });
  document.dispatch("keydown", {
    key: "/",
    target: { tagName: "BODY" },
    preventDefault() {
      calls.push(["preventDefault", "slash"]);
    }
  });
  document.dispatch("keydown", {
    key: "/",
    target: { tagName: "INPUT" },
    preventDefault() {
      calls.push(["preventDefault", "editable-slash"]);
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.dataset.accent, "blue");
  assert.equal(elements.query.value, "");
  assert.equal(elements.onDate.value, "");
  assert.equal(elements.after.value, "");
  assert.equal(elements.before.value, "");
  assert.deepEqual(calls, [
    ["switchTab", "backup"],
    ["clearSearchFields"],
    ["runSearchesNow"],
    ["saveCurrentSearch"],
    ["applySavedSearch"],
    ["deleteSavedSearch"],
    ["runSearchesNow"],
    ["preventDefault", "ctrl-k"],
    ["focusSearchInput"],
    ["preventDefault", "slash"],
    ["focusSearchInput"]
  ]);
});

test("bindAppEvents reports async handler errors and resets import input", async () => {
  const calls = [];
  const elements = createElements();
  const document = fakeDocument();
  const root = { dataset: {} };
  const handlers = createHandlers(calls);
  handlers.savePreferences = async () => {
    throw new Error("save failed");
  };
  handlers.importFromFile = async (file) => {
    calls.push(["importFromFile", file.name]);
  };
  bindAppEvents({
    elements,
    document,
    root,
    handlers
  });

  elements.savePreferences.dispatch("click");
  elements.importArchive.dispatch("change", {
    target: {
      files: [{ name: "archive.json" }],
      value: "C:\\fakepath\\archive.json"
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [
    ["importFromFile", "archive.json"],
    ["setStatus", "save failed"]
  ]);
});

test("bindAppEvents wires bulk and rules actions", () => {
  const calls = [];
  const elements = createElements();
  bindAppEvents({
    elements,
    document: fakeDocument(),
    root: { dataset: {} },
    handlers: createHandlers(calls)
  });

  elements.selectVisible.dispatch("click");
  elements.clearSelection.dispatch("click");
  elements.invertVisible.dispatch("click");
  elements.exportResults.dispatch("click");
  elements.exportResultsCsv.dispatch("click");
  elements.exportResultsHtml.dispatch("click");
  elements.addBlacklist.dispatch("click");
  elements.addWhitelist.dispatch("click");
  elements.cancelImport.dispatch("click");

  assert.deepEqual(calls, [
    ["selectVisible"],
    ["clearSelection"],
    ["invertVisibleSelection"],
    ["exportFilteredResults"],
    ["exportFilteredResultsCsv"],
    ["exportFilteredResultsHtml"],
    ["addBlacklistRule"],
    ["addWhitelistRule"],
    ["cancelStagedImport"]
  ]);
});
