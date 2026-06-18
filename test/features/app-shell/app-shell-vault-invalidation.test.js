import test from "node:test";
import assert from "node:assert/strict";
import {
  createVaultChangeNotifier,
  createVaultInvalidationController,
  VAULT_CHANGED_MESSAGE,
  VAULT_INVALIDATION_CHANNEL,
  VAULT_INVALIDATION_STORAGE_KEY
} from "../../../src/features/app-shell/core/vault-invalidation.js";

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

function fakeStorageNotifier() {
  let listener = null;
  const notifier = {
    unsubscribed: false,
    writes: [],
    emit(message) {
      listener?.({
        [VAULT_INVALIDATION_STORAGE_KEY]: {
          newValue: message
        }
      });
    },
    onLocalStorageChanged(callback) {
      listener = callback;
      return () => {
        notifier.unsubscribed = true;
        listener = null;
      };
    },
    async setLocalStorage(items) {
      notifier.writes.push(items);
    }
  };
  return notifier;
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
  assert.match(channel.posted[0].changeId, /.+/);
  assert.match(channel.posted[0].sentAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("vault invalidation publishes a storage revision fallback", async () => {
  const storageNotifier = fakeStorageNotifier();
  const controller = createVaultInvalidationController({
    channelFactory: () => null,
    refreshVault: async () => {},
    sourceId: "tab-a",
    storageNotifier
  });

  assert.equal(controller.notifyVaultChanged("vault-delete"), true);
  await nextTick();

  assert.equal(storageNotifier.writes.length, 1);
  const message = storageNotifier.writes[0][VAULT_INVALIDATION_STORAGE_KEY];
  assert.equal(message.type, VAULT_CHANGED_MESSAGE);
  assert.equal(message.sourceId, "tab-a");
  assert.equal(message.reason, "vault-delete");
  assert.match(message.changeId, /.+/);
});

test("vault invalidation keeps channel delivery when storage fallback throws", () => {
  const channel = fakeChannel();
  const controller = createVaultInvalidationController({
    channelFactory: () => channel,
    refreshVault: async () => {},
    sourceId: "tab-a",
    storageNotifier: {
      setLocalStorage() {
        throw new Error("storage unavailable");
      }
    }
  });

  assert.doesNotThrow(() => {
    assert.equal(controller.notifyVaultChanged("vault-delete"), true);
  });
  assert.equal(channel.posted.length, 1);
  assert.equal(channel.posted[0].reason, "vault-delete");
});

test("vault invalidation reports no delivery when only storage fallback throws", () => {
  const controller = createVaultInvalidationController({
    channelFactory: () => null,
    refreshVault: async () => {},
    sourceId: "tab-a",
    storageNotifier: {
      setLocalStorage() {
        throw new Error("storage unavailable");
      }
    }
  });

  assert.doesNotThrow(() => {
    assert.equal(controller.notifyVaultChanged("vault-delete"), false);
  });
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

test("vault invalidation refreshes from storage changes and ignores duplicate channel delivery", async () => {
  const channel = fakeChannel();
  const storageNotifier = fakeStorageNotifier();
  const refreshed = [];
  createVaultInvalidationController({
    channelFactory: () => channel,
    refreshVault: async (message) => refreshed.push(message.reason),
    sourceId: "tab-a",
    storageNotifier
  });
  const message = {
    type: VAULT_CHANGED_MESSAGE,
    sourceId: "tab-b",
    reason: "vault-delete",
    changeId: "change-1"
  };

  storageNotifier.emit({ ...message });
  channel.emit({ ...message });
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

test("vault invalidation unsubscribes from storage changes on destroy", async () => {
  const storageNotifier = fakeStorageNotifier();
  const refreshed = [];
  const controller = createVaultInvalidationController({
    channelFactory: () => null,
    refreshVault: async (message) => refreshed.push(message.reason),
    sourceId: "tab-a",
    storageNotifier
  });

  controller.destroy();
  storageNotifier.emit({
    type: VAULT_CHANGED_MESSAGE,
    sourceId: "tab-b",
    reason: "after-destroy",
    changeId: "change-2"
  });
  await nextTick();

  assert.equal(storageNotifier.unsubscribed, true);
  assert.deepEqual(refreshed, []);
});

test("background vault notifier can publish through storage without a channel", async () => {
  const storageNotifier = fakeStorageNotifier();
  const notifier = createVaultChangeNotifier({
    channelFactory: () => null,
    sourceId: "background",
    storageNotifier
  });

  assert.equal(notifier.notifyVaultChanged("chrome-history-live"), true);
  await nextTick();

  const message = storageNotifier.writes[0][VAULT_INVALIDATION_STORAGE_KEY];
  assert.equal(message.sourceId, "background");
  assert.equal(message.reason, "chrome-history-live");
});
