import test from "node:test";
import assert from "node:assert/strict";
import { createChromeHistorySyncAction } from "../../../src/features/background-runtime/ui/chrome-history-sync-action.js";

function createHarness({ response } = {}) {
  const calls = [];
  const messages = [];
  const statuses = [];
  const hasResponse = arguments[0] && Object.hasOwn(arguments[0], "response");
  const syncChromeHistory = createChromeHistorySyncAction({
    refreshStats: async () => calls.push("refreshStats"),
    runSearch: async () => calls.push("runSearch"),
    services: {
      sendRuntimeMessage: async (message) => {
        messages.push(message);
        return hasResponse ? response : {
          ok: true,
          result: { stored: 12 }
        };
      }
    },
    setStatus: (message) => statuses.push(message)
  });

  return { calls, messages, statuses, syncChromeHistory };
}

test("syncChromeHistory sends bootstrap message, refreshes UI, and reports stored count", async () => {
  const { calls, messages, statuses, syncChromeHistory } = createHarness();

  await syncChromeHistory();

  assert.deepEqual(messages, [{
    type: "browseVault.bootstrapChromeHistory"
  }]);
  assert.deepEqual(calls, ["refreshStats", "runSearch"]);
  assert.deepEqual(statuses, [
    "Syncing Chrome history",
    "Synced 12 records"
  ]);
});

test("syncChromeHistory surfaces background failures without refreshing UI", async () => {
  const { calls, statuses, syncChromeHistory } = createHarness({
    response: {
      ok: false,
      error: "history permission missing"
    }
  });

  await assert.rejects(syncChromeHistory, /history permission missing/);

  assert.deepEqual(calls, []);
  assert.deepEqual(statuses, ["Syncing Chrome history"]);
});

test("syncChromeHistory uses a fallback error when background response is missing", async () => {
  const { syncChromeHistory } = createHarness({
    response: null
  });

  await assert.rejects(syncChromeHistory, /Chrome history sync failed/);
});
