import test from "node:test";
import assert from "node:assert/strict";
import { createChromeHistoryRemovalReconciler } from "../../../src/features/background-runtime/background/chrome-history-removal.js";

function createReconciler() {
  const calls = [];
  const notifications = [];
  const reconciler = createChromeHistoryRemovalReconciler(
    {
      markChromeDeletedByUrls: async (urls, deletedAt) => {
        calls.push(["markChromeDeletedByUrls", urls, deletedAt]);
      },
      setMeta: async (key, value) => {
        calls.push(["setMeta", key, value]);
      }
    },
    {
      notifyVaultChanged: (reason) => notifications.push(reason),
      now: () => "2026-06-16T12:00:00.000Z"
    }
  );

  return { calls, notifications, reconciler };
}

test("reconcileHistoryRemoval records full native history clears", async () => {
  const { calls, notifications, reconciler } = createReconciler();

  assert.deepEqual(await reconciler.reconcileHistoryRemoval({ allHistory: true }), {
    type: "allHistory"
  });
  assert.deepEqual(calls, [
    [
      "setMeta",
      "lastNativeHistoryClear",
      {
        clearedAt: "2026-06-16T12:00:00.000Z"
      }
    ]
  ]);
  assert.deepEqual(notifications, ["native-history-clear"]);
});

test("reconcileHistoryRemoval marks deduplicated URL removals", async () => {
  const { calls, notifications, reconciler } = createReconciler();

  assert.deepEqual(
    await reconciler.reconcileHistoryRemoval({
      urls: [
        " https://example.com/a ",
        "https://example.com/a",
        "",
        "https://example.com/b",
        42
      ]
    }),
    {
      type: "urls",
      urls: ["https://example.com/a", "https://example.com/b"],
      deletedAt: "2026-06-16T12:00:00.000Z"
    }
  );
  assert.deepEqual(calls, [
    [
      "markChromeDeletedByUrls",
      ["https://example.com/a", "https://example.com/b"],
      "2026-06-16T12:00:00.000Z"
    ]
  ]);
  assert.deepEqual(notifications, ["native-history-delete"]);
});

test("reconcileHistoryRemoval ignores empty native removal payloads", async () => {
  const { calls, notifications, reconciler } = createReconciler();

  assert.deepEqual(await reconciler.reconcileHistoryRemoval({ urls: [] }), {
    type: "empty"
  });
  assert.deepEqual(await reconciler.reconcileHistoryRemoval({}), {
    type: "empty"
  });
  assert.deepEqual(await reconciler.reconcileHistoryRemoval(null), {
    type: "empty"
  });
  assert.deepEqual(calls, []);
  assert.deepEqual(notifications, []);
});
