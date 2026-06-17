import test from "node:test";
import assert from "node:assert/strict";
import {
  createNativeHistoryAction,
  NATIVE_CHROME_HISTORY_URL
} from "../../../src/features/background-runtime/ui/native-history-action.js";

test("openNativeChromeHistory opens Chrome native history through validated runtime messaging", async () => {
  const statuses = [];
  const messages = [];
  const openNativeChromeHistory = createNativeHistoryAction({
    services: {
      sendRuntimeMessage: async (message) => {
        messages.push(message);
        return { ok: true };
      }
    },
    setStatus: (message) => statuses.push(message)
  });

  await openNativeChromeHistory();

  assert.equal(NATIVE_CHROME_HISTORY_URL, "chrome://history");
  assert.deepEqual(messages, [{
    type: "browseVault.openUrl",
    url: "chrome://history"
  }]);
  assert.deepEqual(statuses, [
    "Opening native Chrome history",
    "Opened native Chrome history"
  ]);
});

test("openNativeChromeHistory reports runtime failures", async () => {
  const statuses = [];
  const openNativeChromeHistory = createNativeHistoryAction({
    services: {
      sendRuntimeMessage: async () => ({
        ok: false,
        error: "tab create denied"
      })
    },
    setStatus: (message) => statuses.push(message)
  });

  await assert.rejects(openNativeChromeHistory, /tab create denied/);
  assert.deepEqual(statuses, ["Opening native Chrome history"]);
});
