export const BACKGROUND_MESSAGE_TYPES = {
  BOOTSTRAP_CHROME_HISTORY: "browseVault.bootstrapChromeHistory",
  DELETE_CHROME_URLS: "browseVault.deleteChromeUrls",
  ACTIVATE_TAB: "browseVault.activateTab",
  RESTORE_SESSION: "browseVault.restoreSession",
  OPEN_URL: "browseVault.openUrl",
  OPEN_URL_BACKGROUND: "browseVault.openUrlBackground",
  OPEN_URLS: "browseVault.openUrls"
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeInteger(value) {
  return Number.isSafeInteger(value);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => value.trim()))];
}

function validatedUrls(message, fieldName) {
  const values = message[fieldName];
  if (!Array.isArray(values) || values.some((value) => !isNonEmptyString(value))) {
    return null;
  }

  return uniqueStrings(values);
}

export function normalizeBackgroundMessage(message) {
  if (!isObject(message) || !isNonEmptyString(message.type)) {
    return { handled: false };
  }

  switch (message.type) {
    case BACKGROUND_MESSAGE_TYPES.BOOTSTRAP_CHROME_HISTORY:
      return {
        handled: true,
        ok: true,
        action: { type: "bootstrapChromeHistory" }
      };

    case BACKGROUND_MESSAGE_TYPES.DELETE_CHROME_URLS: {
      const urls = validatedUrls(message, "urls");
      if (!urls) {
        return invalidMessage(message.type, "urls must be an array of non-empty strings.");
      }

      return {
        handled: true,
        ok: true,
        action: { type: "deleteChromeUrls", urls }
      };
    }

    case BACKGROUND_MESSAGE_TYPES.ACTIVATE_TAB:
      if (!isSafeInteger(message.windowId) || !isSafeInteger(message.tabId)) {
        return invalidMessage(message.type, "windowId and tabId must be safe integers.");
      }

      return {
        handled: true,
        ok: true,
        action: {
          type: "activateTab",
          windowId: message.windowId,
          tabId: message.tabId
        }
      };

    case BACKGROUND_MESSAGE_TYPES.RESTORE_SESSION:
      if (message.sessionId !== undefined && !isNonEmptyString(message.sessionId)) {
        return invalidMessage(message.type, "sessionId must be a non-empty string when provided.");
      }

      return {
        handled: true,
        ok: true,
        action: {
          type: "restoreSession",
          sessionId: message.sessionId || undefined
        }
      };

    case BACKGROUND_MESSAGE_TYPES.OPEN_URL:
      if (!isNonEmptyString(message.url)) {
        return invalidMessage(message.type, "url must be a non-empty string.");
      }

      return {
        handled: true,
        ok: true,
        action: {
          type: "openUrl",
          url: message.url.trim()
        }
      };

    case BACKGROUND_MESSAGE_TYPES.OPEN_URL_BACKGROUND:
      if (!isNonEmptyString(message.url)) {
        return invalidMessage(message.type, "url must be a non-empty string.");
      }

      return {
        handled: true,
        ok: true,
        action: {
          type: "openUrlBackground",
          url: message.url.trim()
        }
      };

    case BACKGROUND_MESSAGE_TYPES.OPEN_URLS: {
      const urls = validatedUrls(message, "urls");
      if (!urls) {
        return invalidMessage(message.type, "urls must be an array of non-empty strings.");
      }

      return {
        handled: true,
        ok: true,
        action: { type: "openUrls", urls }
      };
    }

    default:
      return { handled: false };
  }
}

function invalidMessage(type, reason) {
  return {
    handled: true,
    ok: false,
    error: `Invalid payload for ${type}: ${reason}`
  };
}
