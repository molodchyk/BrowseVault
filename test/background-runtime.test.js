import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUND_MESSAGE_TYPES,
  normalizeBackgroundMessage
} from "../src/features/background-runtime/core/messages.js";
import { createBackgroundMessageRouter } from "../src/features/background-runtime/background/message-router.js";

test("normalizeBackgroundMessage rejects unknown messages and validates payload shapes", () => {
  assert.deepEqual(normalizeBackgroundMessage(null), { handled: false });
  assert.deepEqual(normalizeBackgroundMessage({ type: "unknown.action" }), { handled: false });

  assert.deepEqual(
    normalizeBackgroundMessage({ type: BACKGROUND_MESSAGE_TYPES.BOOTSTRAP_CHROME_HISTORY }),
    {
      handled: true,
      ok: true,
      action: { type: "bootstrapChromeHistory" }
    }
  );

  assert.deepEqual(
    normalizeBackgroundMessage({
      type: BACKGROUND_MESSAGE_TYPES.ACTIVATE_TAB,
      windowId: 10,
      tabId: 20
    }),
    {
      handled: true,
      ok: true,
      action: {
        type: "activateTab",
        windowId: 10,
        tabId: 20
      }
    }
  );

  assert.match(
    normalizeBackgroundMessage({
      type: BACKGROUND_MESSAGE_TYPES.ACTIVATE_TAB,
      windowId: "10",
      tabId: 20
    }).error,
    /windowId and tabId/
  );

  assert.match(
    normalizeBackgroundMessage({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
      url: " "
    }).error,
    /url must be/
  );

  assert.deepEqual(
    normalizeBackgroundMessage({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL_BACKGROUND,
      url: " https://example.com/background "
    }),
    {
      handled: true,
      ok: true,
      action: {
        type: "openUrlBackground",
        url: "https://example.com/background"
      }
    }
  );
});

test("normalizeBackgroundMessage trims and deduplicates URL arrays", () => {
  assert.deepEqual(
    normalizeBackgroundMessage({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URLS,
      urls: [" https://example.com/a ", "https://example.com/a", "https://example.com/b"]
    }),
    {
      handled: true,
      ok: true,
      action: {
        type: "openUrls",
        urls: ["https://example.com/a", "https://example.com/b"]
      }
    }
  );

  assert.match(
    normalizeBackgroundMessage({
      type: BACKGROUND_MESSAGE_TYPES.DELETE_CHROME_URLS,
      urls: ["https://example.com/a", ""]
    }).error,
    /urls must be/
  );
});

test("createBackgroundMessageRouter dispatches validated messages", async () => {
  const calls = [];
  const router = createBackgroundMessageRouter({
    activateTab: async (tabId) => calls.push(["activateTab", tabId]),
    bootstrapChromeHistory: async (reason) => {
      calls.push(["bootstrapChromeHistory", reason]);
      return { stored: 2 };
    },
    createTab: async (tab) => calls.push(["createTab", tab]),
    deleteHistoryUrl: async (query) => calls.push(["deleteHistoryUrl", query]),
    focusWindow: async (windowId) => calls.push(["focusWindow", windowId]),
    restoreSession: async (sessionId) => calls.push(["restoreSession", sessionId])
  });

  async function send(message) {
    return new Promise((resolve) => {
      assert.equal(router(message, {}, resolve), true);
    });
  }

  assert.deepEqual(
    await send({ type: BACKGROUND_MESSAGE_TYPES.BOOTSTRAP_CHROME_HISTORY }),
    { ok: true, result: { stored: 2 } }
  );
  assert.deepEqual(
    await send({
      type: BACKGROUND_MESSAGE_TYPES.DELETE_CHROME_URLS,
      urls: ["https://example.com/a", "https://example.com/a"]
    }),
    { ok: true }
  );
  assert.deepEqual(
    await send({
      type: BACKGROUND_MESSAGE_TYPES.ACTIVATE_TAB,
      windowId: 1,
      tabId: 2
    }),
    { ok: true }
  );
  assert.deepEqual(
    await send({
      type: BACKGROUND_MESSAGE_TYPES.RESTORE_SESSION,
      sessionId: "session-1"
    }),
    { ok: true }
  );
  assert.deepEqual(
    await send({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
      url: " https://example.com/open "
    }),
    { ok: true }
  );
  assert.deepEqual(
    await send({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL_BACKGROUND,
      url: " https://example.com/background "
    }),
    { ok: true }
  );
  assert.deepEqual(
    await send({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URLS,
      urls: ["https://example.com/one", "https://example.com/two"]
    }),
    { ok: true, opened: 2 }
  );

  assert.deepEqual(calls, [
    ["bootstrapChromeHistory", "manual"],
    ["deleteHistoryUrl", { url: "https://example.com/a" }],
    ["focusWindow", 1],
    ["activateTab", 2],
    ["restoreSession", "session-1"],
    ["createTab", { url: "https://example.com/open" }],
    ["createTab", { url: "https://example.com/background", active: false }],
    ["createTab", { url: "https://example.com/one" }],
    ["createTab", { url: "https://example.com/two" }]
  ]);
});

test("createBackgroundMessageRouter rejects invalid messages before actions run", async () => {
  const calls = [];
  const router = createBackgroundMessageRouter({
    activateTab: async () => calls.push("activateTab"),
    bootstrapChromeHistory: async () => calls.push("bootstrapChromeHistory"),
    createTab: async () => calls.push("createTab"),
    deleteHistoryUrl: async () => calls.push("deleteHistoryUrl"),
    focusWindow: async () => calls.push("focusWindow"),
    restoreSession: async () => calls.push("restoreSession")
  });

  const response = await new Promise((resolve) => {
    assert.equal(
      router(
        {
          type: BACKGROUND_MESSAGE_TYPES.OPEN_URLS,
          urls: ["https://example.com", 42]
        },
        {},
        resolve
      ),
      true
    );
  });

  assert.equal(response.ok, false);
  assert.match(response.error, /Invalid payload/);
  assert.deepEqual(calls, []);
  assert.equal(router({ type: "not-for-us" }, {}, () => {}), false);
});

test("createBackgroundMessageRouter rejects recognized messages from disallowed senders", async () => {
  const calls = [];
  const router = createBackgroundMessageRouter(
    {
      activateTab: async () => calls.push("activateTab"),
      bootstrapChromeHistory: async () => calls.push("bootstrapChromeHistory"),
      createTab: async () => calls.push(["createTab"]),
      deleteHistoryUrl: async () => calls.push("deleteHistoryUrl"),
      focusWindow: async () => calls.push("focusWindow"),
      restoreSession: async () => calls.push("restoreSession")
    },
    {
      isAllowedSender: (sender) => sender?.url?.startsWith("chrome-extension://browsevault/")
    }
  );

  const response = await new Promise((resolve) => {
    assert.equal(
      router(
        {
          type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
          url: "https://example.com"
        },
        { url: "https://example.com/page" },
        resolve
      ),
      true
    );
  });

  assert.deepEqual(response, {
    ok: false,
    error: "Message sender is not allowed."
  });
  assert.deepEqual(calls, []);

  const allowedResponse = await new Promise((resolve) => {
    assert.equal(
      router(
        {
          type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
          url: "https://example.com"
        },
        { url: "chrome-extension://browsevault/src/app.html" },
        resolve
      ),
      true
    );
  });

  assert.deepEqual(allowedResponse, { ok: true });
  assert.deepEqual(calls, [["createTab"]]);
});

test("createBackgroundMessageRouter returns action errors to the sender", async () => {
  const router = createBackgroundMessageRouter({
    activateTab: async () => {},
    bootstrapChromeHistory: async () => {},
    createTab: async () => {
      throw new Error("tab create failed");
    },
    deleteHistoryUrl: async () => {},
    focusWindow: async () => {},
    restoreSession: async () => {}
  });

  const response = await new Promise((resolve) => {
    assert.equal(
      router(
        {
          type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
          url: "https://example.com"
        },
        {},
        resolve
      ),
      true
    );
  });

  assert.deepEqual(response, {
    ok: false,
    error: "tab create failed"
  });
});
