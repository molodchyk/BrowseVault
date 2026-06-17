export const VAULT_INVALIDATION_CHANNEL = "browsevault:vault-invalidation";
export const VAULT_CHANGED_MESSAGE = "browsevault.vaultChanged";

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

export function isVaultChangedMessage(message, sourceId) {
  return message?.type === VAULT_CHANGED_MESSAGE && message.sourceId !== sourceId;
}

function postVaultChanged(channel, sourceId, reason) {
  if (!channel?.postMessage) {
    return false;
  }

  channel.postMessage({
    type: VAULT_CHANGED_MESSAGE,
    sourceId,
    reason,
    sentAt: new Date().toISOString()
  });
  return true;
}

export function createVaultChangeNotifier({
  channelFactory = defaultChannelFactory,
  channelName = VAULT_INVALIDATION_CHANNEL,
  sourceId = defaultSourceId()
} = {}) {
  const channel = channelFactory(channelName);

  function notifyVaultChanged(reason) {
    return postVaultChanged(channel, sourceId, reason);
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
  sourceId = defaultSourceId()
}) {
  const channel = channelFactory(channelName);
  let refreshPromise = null;
  let queuedMessage = null;

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

    runRefresh(message);
  }

  if (channel?.addEventListener) {
    channel.addEventListener("message", handleMessage);
  } else if (channel) {
    channel.onmessage = handleMessage;
  }

  function notifyVaultChanged(reason) {
    return postVaultChanged(channel, sourceId, reason);
  }

  function destroy() {
    if (channel?.removeEventListener) {
      channel.removeEventListener("message", handleMessage);
    } else if (channel) {
      channel.onmessage = null;
    }
    channel?.close?.();
  }

  return {
    destroy,
    notifyVaultChanged,
    sourceId
  };
}
