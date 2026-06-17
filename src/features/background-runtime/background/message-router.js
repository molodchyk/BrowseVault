import { normalizeBackgroundMessage } from "../core/messages.js";

function respondWithTask(task, sendResponse) {
  Promise.resolve()
    .then(task)
    .then((payload = {}) => sendResponse({ ok: true, ...payload }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Background action failed." }));

  return true;
}

function defaultAllowedSender() {
  return true;
}

export function createBackgroundMessageRouter(actions, options = {}) {
  const isAllowedSender = options.isAllowedSender || defaultAllowedSender;

  return function routeBackgroundMessage(message, _sender, sendResponse) {
    const normalized = normalizeBackgroundMessage(message);

    if (!normalized.handled) {
      return false;
    }

    if (!isAllowedSender(_sender, message)) {
      sendResponse({ ok: false, error: "Message sender is not allowed." });
      return true;
    }

    if (!normalized.ok) {
      sendResponse({ ok: false, error: normalized.error });
      return true;
    }

    const action = normalized.action;

    if (action.type === "bootstrapChromeHistory") {
      return respondWithTask(
        async () => ({ result: await actions.bootstrapChromeHistory("manual") }),
        sendResponse
      );
    }

    if (action.type === "deleteChromeUrls") {
      return respondWithTask(
        async () => {
          await Promise.all(action.urls.map((url) => actions.deleteHistoryUrl({ url })));
        },
        sendResponse
      );
    }

    if (action.type === "activateTab") {
      return respondWithTask(
        async () => {
          await actions.focusWindow(action.windowId);
          await actions.activateTab(action.tabId);
        },
        sendResponse
      );
    }

    if (action.type === "restoreSession") {
      return respondWithTask(
        async () => {
          await actions.restoreSession(action.sessionId);
        },
        sendResponse
      );
    }

    if (action.type === "openUrl") {
      return respondWithTask(
        async () => {
          await actions.createTab({ url: action.url });
        },
        sendResponse
      );
    }

    if (action.type === "openUrlBackground") {
      return respondWithTask(
        async () => {
          await actions.createTab({ url: action.url, active: false });
        },
        sendResponse
      );
    }

    if (action.type === "openUrls") {
      return respondWithTask(
        async () => {
          await Promise.all(action.urls.map((url) => actions.createTab({ url })));
          return { opened: action.urls.length };
        },
        sendResponse
      );
    }

    return false;
  };
}
