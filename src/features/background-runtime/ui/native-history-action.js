import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";
import { BACKGROUND_MESSAGE_TYPES } from "../core/messages.js";

export const NATIVE_CHROME_HISTORY_URL = "chrome://history";

const defaultServices = {
  sendRuntimeMessage
};

export function createNativeHistoryAction({
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  return async function openNativeChromeHistory() {
    setStatus("Opening native Chrome history");
    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
      url: NATIVE_CHROME_HISTORY_URL
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Native Chrome history did not open.");
    }

    setStatus("Opened native Chrome history");
  };
}
