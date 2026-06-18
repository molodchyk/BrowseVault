import test from "node:test";
import assert from "node:assert/strict";
import { onActionClicked } from "../../src/platform/chrome/action.js";
import { chromeApi } from "../../src/platform/chrome/api.js";
import { getBookmarkTree } from "../../src/platform/chrome/bookmarks.js";
import { onCommand } from "../../src/platform/chrome/commands.js";
import { searchDownloadItems } from "../../src/platform/chrome/downloads.js";
import {
  deleteHistoryUrl,
  getHistoryVisits,
  onHistoryVisitRemoved,
  onHistoryVisited,
  searchHistory
} from "../../src/platform/chrome/history.js";
import {
  getExtensionUrl,
  onInstalled,
  onRuntimeMessage,
  onStartup,
  sendRuntimeMessage
} from "../../src/platform/chrome/runtime.js";
import { getRecentlyClosedSessions, restoreSession } from "../../src/platform/chrome/sessions.js";
import {
  getLocalStorage,
  onLocalStorageChanged,
  setLocalStorage
} from "../../src/platform/chrome/storage.js";
import { activateTab, createTab, queryTabs } from "../../src/platform/chrome/tabs.js";
import { focusWindow } from "../../src/platform/chrome/windows.js";

const originalChrome = globalThis.chrome;

test.afterEach(() => {
  if (originalChrome === undefined) {
    delete globalThis.chrome;
    return;
  }

  globalThis.chrome = originalChrome;
});

test("chromeApi reports when extension APIs are unavailable", () => {
  delete globalThis.chrome;
  assert.throws(() => chromeApi(), /Chrome extension API is unavailable/);
});

test("read-only platform wrappers delegate to Chrome APIs", async () => {
  const calls = [];
  globalThis.chrome = {
    tabs: {
      query: async (queryInfo) => {
        calls.push(["tabs.query", queryInfo]);
        return [{ id: 1, url: "https://example.com/" }];
      }
    },
    bookmarks: {
      getTree: async () => {
        calls.push(["bookmarks.getTree"]);
        return [{ children: [] }];
      }
    },
    downloads: {
      search: async (query) => {
        calls.push(["downloads.search", query]);
        return [{ id: 2, url: "https://download.example/" }];
      }
    },
    sessions: {
      getRecentlyClosed: async (filter) => {
        calls.push(["sessions.getRecentlyClosed", filter]);
        return [{ tab: { url: "https://recent.example/" } }];
      }
    },
    runtime: {
      sendMessage: async (message) => {
        calls.push(["runtime.sendMessage", message]);
        return { ok: true };
      }
    },
    storage: {
      local: {
        get: async (keys) => {
          calls.push(["storage.local.get", keys]);
          return { browseVaultPreferences: { theme: "dark" } };
        },
        set: async (items) => {
          calls.push(["storage.local.set", items]);
        }
      }
    }
  };

  assert.deepEqual(await queryTabs({ active: true }), [{ id: 1, url: "https://example.com/" }]);
  assert.deepEqual(await getBookmarkTree(), [{ children: [] }]);
  assert.deepEqual(await searchDownloadItems({ limit: 5 }), [{ id: 2, url: "https://download.example/" }]);
  assert.deepEqual(await getRecentlyClosedSessions({ maxResults: 3 }), [
    { tab: { url: "https://recent.example/" } }
  ]);
  assert.deepEqual(await sendRuntimeMessage({ type: "browseVault.openUrl" }), { ok: true });
  assert.deepEqual(await getLocalStorage("browseVaultPreferences"), {
    browseVaultPreferences: { theme: "dark" }
  });
  await setLocalStorage({ browseVaultPreferences: { theme: "light" } });
  assert.deepEqual(calls, [
    ["tabs.query", { active: true }],
    ["bookmarks.getTree"],
    ["downloads.search", { limit: 5 }],
    ["sessions.getRecentlyClosed", { maxResults: 3 }],
    ["runtime.sendMessage", { type: "browseVault.openUrl" }],
    ["storage.local.get", "browseVaultPreferences"],
    ["storage.local.set", { browseVaultPreferences: { theme: "light" } }]
  ]);
});

test("storage wrapper falls back when Chrome storage is unavailable", async () => {
  globalThis.chrome = {};

  await setLocalStorage({
    browseVaultPreferences: {
      theme: "light"
    },
    otherValue: 7
  });

  assert.deepEqual(await getLocalStorage("browseVaultPreferences"), {
    browseVaultPreferences: {
      theme: "light"
    }
  });
  assert.deepEqual(await getLocalStorage(["browseVaultPreferences", "missing"]), {
    browseVaultPreferences: {
      theme: "light"
    }
  });
  assert.deepEqual(await getLocalStorage({ browseVaultPreferences: null, missing: "fallback" }), {
    browseVaultPreferences: {
      theme: "light"
    },
    missing: "fallback"
  });
});

test("storage change wrapper listens only to local Chrome storage changes", () => {
  const calls = [];
  let listener;
  globalThis.chrome = {
    storage: {
      onChanged: {
        addListener: (callback) => {
          listener = callback;
          calls.push(["storage.onChanged.addListener", callback]);
        },
        removeListener: (callback) => calls.push(["storage.onChanged.removeListener", callback])
      }
    }
  };

  const received = [];
  const unsubscribe = onLocalStorageChanged((changes) => received.push(changes));
  listener({ syncValue: { newValue: true } }, "sync");
  listener({ localValue: { newValue: true } }, "local");
  unsubscribe();

  assert.deepEqual(received, [{ localValue: { newValue: true } }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "storage.onChanged.addListener");
  assert.equal(calls[1][0], "storage.onChanged.removeListener");
  assert.equal(calls[1][1], calls[0][1]);
});

test("background platform wrappers delegate to Chrome APIs and listeners", async () => {
  const calls = [];
  const listener = () => {};
  globalThis.chrome = {
    action: {
      onClicked: {
        addListener: (callback) => calls.push(["action.onClicked", callback])
      }
    },
    commands: {
      onCommand: {
        addListener: (callback) => calls.push(["commands.onCommand", callback])
      }
    },
    history: {
      search: async (query) => {
        calls.push(["history.search", query]);
        return [{ url: "https://history.example/" }];
      },
      getVisits: async (query) => {
        calls.push(["history.getVisits", query]);
        return [{ visitId: "visit-1" }];
      },
      deleteUrl: async (query) => {
        calls.push(["history.deleteUrl", query]);
      },
      onVisited: {
        addListener: (callback) => calls.push(["history.onVisited", callback])
      },
      onVisitRemoved: {
        addListener: (callback) => calls.push(["history.onVisitRemoved", callback])
      }
    },
    runtime: {
      getURL: (extensionPath) => {
        calls.push(["runtime.getURL", extensionPath]);
        return `chrome-extension://id/${extensionPath}`;
      },
      onInstalled: {
        addListener: (callback) => calls.push(["runtime.onInstalled", callback])
      },
      onStartup: {
        addListener: (callback) => calls.push(["runtime.onStartup", callback])
      },
      onMessage: {
        addListener: (callback) => calls.push(["runtime.onMessage", callback])
      }
    },
    sessions: {
      restore: async (sessionId) => {
        calls.push(["sessions.restore", sessionId]);
      }
    },
    tabs: {
      create: async (createProperties) => {
        calls.push(["tabs.create", createProperties]);
        return { id: 3 };
      },
      update: async (tabId, updateProperties) => {
        calls.push(["tabs.update", tabId, updateProperties]);
        return { id: tabId };
      }
    },
    windows: {
      update: async (windowId, updateInfo) => {
        calls.push(["windows.update", windowId, updateInfo]);
        return { id: windowId };
      }
    }
  };

  assert.equal(getExtensionUrl("src/app.html"), "chrome-extension://id/src/app.html");
  onInstalled(listener);
  onStartup(listener);
  onRuntimeMessage(listener);
  onActionClicked(listener);
  onCommand(listener);
  onHistoryVisited(listener);
  onHistoryVisitRemoved(listener);
  assert.deepEqual(await searchHistory({ text: "" }), [{ url: "https://history.example/" }]);
  assert.deepEqual(await getHistoryVisits({ url: "https://history.example/" }), [{ visitId: "visit-1" }]);
  await deleteHistoryUrl({ url: "https://history.example/" });
  await restoreSession("session-1");
  assert.deepEqual(await createTab({ url: "https://open.example/" }), { id: 3 });
  assert.deepEqual(await activateTab(4), { id: 4 });
  assert.deepEqual(await focusWindow(5), { id: 5 });

  assert.deepEqual(calls, [
    ["runtime.getURL", "src/app.html"],
    ["runtime.onInstalled", listener],
    ["runtime.onStartup", listener],
    ["runtime.onMessage", listener],
    ["action.onClicked", listener],
    ["commands.onCommand", listener],
    ["history.onVisited", listener],
    ["history.onVisitRemoved", listener],
    ["history.search", { text: "" }],
    ["history.getVisits", { url: "https://history.example/" }],
    ["history.deleteUrl", { url: "https://history.example/" }],
    ["sessions.restore", "session-1"],
    ["tabs.create", { url: "https://open.example/" }],
    ["tabs.update", 4, { active: true }],
    ["windows.update", 5, { focused: true }]
  ]);
});
