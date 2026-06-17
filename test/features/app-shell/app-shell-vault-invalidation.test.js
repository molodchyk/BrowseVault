import test from "node:test";
import assert from "node:assert/strict";
import {
  createVaultInvalidationController,
  VAULT_CHANGED_MESSAGE,
  VAULT_INVALIDATION_CHANNEL
} from "../../../src/features/app-shell/ui/vault-invalidation.js";

function fakeChannel() {
  const listeners = new Set();
  return {
    closed: false,
    posted: [],
    addEventListener(eventName, listener) {
      if (eventName === "message") {
        listeners.add(listener);
      }
    },
    close() {
      this.closed = true;
    },
    emit(data) {
      for (const listener of listeners) {
        listener({ data });
      }
    },
    postMessage(message) {
      this.posted.push(message);
    },
    removeEventListener(eventName, listener) {
      if (eventName === "message") {
        listeners.delete(listener);
      }
    }
  };
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("vault invalidation publishes changes to the shared channel", () => {
  const channel = fakeChannel();
  const controller = createVaultInvalidationController({
    channelFactory: (channelName) => {
      assert.equal(channelName, VAULT_INVALIDATION_CHANNEL);
      return channel;
    },
    refreshVault: async () => {},
    sourceId: "tab-a"
  });

  assert.equal(controller.notifyVaultChanged("vault-delete"), true);
  assert.equal(channel.posted.length, 1);
  assert.equal(channel.posted[0].type, VAULT_CHANGED_MESSAGE);
  assert.equal(channel.posted[0].sourceId, "tab-a");
  assert.equal(channel.posted[0].reason, "vault-delete");
  assert.match(channel.posted[0].sentAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("vault invalidation refreshes only for other BrowseVault tabs", async () => {
  const channel = fakeChannel();
  const refreshed = [];
  const controller = createVaultInvalidationController({
    channelFactory: () => channel,
    refreshVault: async (message) => refreshed.push(message.reason),
    sourceId: "tab-a"
  });

  channel.emit({ type: VAULT_CHANGED_MESSAGE, sourceId: "tab-a", reason: "same-tab" });
  channel.emit({ type: "other.message", sourceId: "tab-b", reason: "ignored" });
  channel.emit({ type: VAULT_CHANGED_MESSAGE, sourceId: "tab-b", reason: "vault-delete" });
  await nextTick();

  assert.deepEqual(refreshed, ["vault-delete"]);
  controller.destroy();
  assert.equal(channel.closed, true);

  channel.emit({ type: VAULT_CHANGED_MESSAGE, sourceId: "tab-b", reason: "after-destroy" });
  await nextTick();
  assert.deepEqual(refreshed, ["vault-delete"]);
});

test("vault invalidation degrades when BroadcastChannel is unavailable", () => {
  const controller = createVaultInvalidationController({
    channelFactory: () => null,
    refreshVault: async () => {},
    sourceId: "tab-a"
  });

  assert.equal(controller.notifyVaultChanged("vault-delete"), false);
  assert.doesNotThrow(() => controller.destroy());
});
