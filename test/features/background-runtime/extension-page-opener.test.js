import test from "node:test";
import assert from "node:assert/strict";
import { createExtensionPageOpener } from "../../../src/features/background-runtime/background/extension-page-opener.js";

function createHarness(tabs) {
  const calls = [];
  const opener = createExtensionPageOpener({
    activateTab: async (tabId) => calls.push(["activateTab", tabId]),
    createTab: async (createProperties) => {
      calls.push(["createTab", createProperties]);
      return { id: 99 };
    },
    focusWindow: async (windowId) => calls.push(["focusWindow", windowId]),
    queryTabs: async (queryInfo) => {
      calls.push(["queryTabs", queryInfo]);
      return tabs;
    }
  }, {
    appUrl: "chrome-extension://id/src/app.html"
  });

  return { calls, opener };
}

test("openExtensionPage focuses an existing BrowseVault app tab", async () => {
  const { calls, opener } = createHarness([
    { id: 4, windowId: 7, url: "https://example.com/" },
    { id: 5, windowId: 8, url: "chrome-extension://id/src/app.html" }
  ]);

  assert.deepEqual(await opener.openExtensionPage(), {
    reused: true,
    tabId: 5,
    windowId: 8
  });
  assert.deepEqual(calls, [
    ["queryTabs", {}],
    ["focusWindow", 8],
    ["activateTab", 5]
  ]);
});

test("openExtensionPage treats query and hash variants as the app tab", async () => {
  const { calls, opener } = createHarness([
    { id: 6, windowId: 9, url: "chrome-extension://id/src/app.html?panel=history#top" }
  ]);

  assert.deepEqual(await opener.openExtensionPage(), {
    reused: true,
    tabId: 6,
    windowId: 9
  });
  assert.deepEqual(calls, [
    ["queryTabs", {}],
    ["focusWindow", 9],
    ["activateTab", 6]
  ]);
});

test("openExtensionPage creates the app tab when none is open", async () => {
  const { calls, opener } = createHarness([
    { id: 4, windowId: 7, url: "https://example.com/" }
  ]);

  assert.deepEqual(await opener.openExtensionPage(), {
    reused: false,
    tabId: 99
  });
  assert.deepEqual(calls, [
    ["queryTabs", {}],
    ["createTab", { url: "chrome-extension://id/src/app.html" }]
  ]);
});
