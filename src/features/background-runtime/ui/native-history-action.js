import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";
import { BACKGROUND_MESSAGE_TYPES } from "../core/messages.js";

export const NATIVE_CHROME_HISTORY_URL = "chrome://history";

const defaultServices = {
  sendRuntimeMessage
};

function localizedMessage(getMessage, key, fallback) {
  return getMessage?.(key) || fallback;
}

export function createNativeHistoryAction({
  getMessage = () => "",
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  return async function openNativeChromeHistory() {
    setStatus(localizedMessage(getMessage, "statusOpeningNativeChromeHistory", "Opening native Chrome history"));
    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
      url: NATIVE_CHROME_HISTORY_URL
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedMessage(getMessage, "errorNativeChromeHistoryDidNotOpen", "Native Chrome history did not open."));
    }

    setStatus(localizedMessage(getMessage, "statusOpenedNativeChromeHistory", "Opened native Chrome history"));
  };
}
