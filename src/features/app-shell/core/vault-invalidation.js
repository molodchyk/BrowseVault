export const VAULT_INVALIDATION_CHANNEL = "browsevault:vault-invalidation";
export const VAULT_INVALIDATION_STORAGE_KEY = "browseVault.vaultInvalidation";
export const VAULT_CHANGED_MESSAGE = "browsevault.vaultChanged";
const SEEN_CHANGE_LIMIT = 100;

function defaultChannelFactory(channelName) {
  return typeof globalThis.BroadcastChannel === "function"
    ? new globalThis.BroadcastChannel(channelName)
    : null;
}

function defaultSourceId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function messageFromEvent(event) {
  return event?.data || event;
}

function vaultChangedMessage(sourceId, reason) {
  return {
    type: VAULT_CHANGED_MESSAGE,
    sourceId,
    reason,
    sentAt: new Date().toISOString(),
    changeId: defaultSourceId()
  };
}

function messageFromStorageChange(changes, storageKey) {
  return changes?.[storageKey]?.newValue || null;
}

export function isVaultChangedMessage(message, sourceId) {
  return message?.type === VAULT_CHANGED_MESSAGE && message.sourceId !== sourceId;
}

function postVaultChanged(channel, storageNotifier, storageKey, sourceId, reason) {
  const message = vaultChangedMessage(sourceId, reason);
  let posted = false;

  if (channel?.postMessage) {
    channel.postMessage(message);
    posted = true;
  }

  if (storageNotifier?.setLocalStorage) {
    try {
      Promise.resolve(storageNotifier.setLocalStorage({ [storageKey]: message })).catch(() => {});
      posted = true;
    } catch {
      // Secondary notification failures should not break local UI actions.
    }
  }

  return posted;
}

export function createVaultChangeNotifier({
  channelFactory = defaultChannelFactory,
  channelName = VAULT_INVALIDATION_CHANNEL,
  storageKey = VAULT_INVALIDATION_STORAGE_KEY,
  storageNotifier = null,
  sourceId = defaultSourceId()
} = {}) {
  const channel = channelFactory(channelName);

  function notifyVaultChanged(reason) {
    return postVaultChanged(channel, storageNotifier, storageKey, sourceId, reason);
  }

  function destroy() {
    channel?.close?.();
  }

  return {
    destroy,
    notifyVaultChanged,
    sourceId
  };
}

export function createVaultInvalidationController({
  channelFactory = defaultChannelFactory,
  channelName = VAULT_INVALIDATION_CHANNEL,
  refreshVault,
  setStatus = () => {},
  storageKey = VAULT_INVALIDATION_STORAGE_KEY,
  storageNotifier = null,
  sourceId = defaultSourceId()
}) {
  const channel = channelFactory(channelName);
  const seenChangeIds = new Set();
  let refreshPromise = null;
  let queuedMessage = null;
  let unsubscribeStorage = () => {};

  function markSeen(message) {
    if (!message?.changeId) {
      return false;
    }

    if (seenChangeIds.has(message.changeId)) {
      return true;
    }

    seenChangeIds.add(message.changeId);
    if (seenChangeIds.size > SEEN_CHANGE_LIMIT) {
      seenChangeIds.delete(seenChangeIds.values().next().value);
    }

    return false;
  }

  async function runRefresh(message) {
    if (refreshPromise) {
      queuedMessage = message;
      return refreshPromise;
    }

    refreshPromise = Promise.resolve()
      .then(() => refreshVault(message))
      .catch((error) => {
        setStatus(error?.message || "Could not refresh BrowseVault from another tab");
      })
      .finally(() => {
        refreshPromise = null;
        if (queuedMessage) {
          const nextMessage = queuedMessage;
          queuedMessage = null;
          runRefresh(nextMessage);
        }
      });

    return refreshPromise;
  }

  function handleMessage(event) {
    const message = messageFromEvent(event);
    if (!isVaultChangedMessage(message, sourceId)) {
      return;
    }

    if (markSeen(message)) {
      return;
    }

    runRefresh(message);
  }

  if (channel?.addEventListener) {
    channel.addEventListener("message", handleMessage);
  } else if (channel) {
    channel.onmessage = handleMessage;
  }

  if (storageNotifier?.onLocalStorageChanged) {
    unsubscribeStorage = storageNotifier.onLocalStorageChanged((changes) => {
      handleMessage(messageFromStorageChange(changes, storageKey));
    });
  }

  function notifyVaultChanged(reason) {
    return postVaultChanged(channel, storageNotifier, storageKey, sourceId, reason);
  }

  function destroy() {
    if (channel?.removeEventListener) {
      channel.removeEventListener("message", handleMessage);
    } else if (channel) {
      channel.onmessage = null;
    }
    unsubscribeStorage();
    channel?.close?.();
  }

  return {
    destroy,
    notifyVaultChanged,
    sourceId
  };
}
