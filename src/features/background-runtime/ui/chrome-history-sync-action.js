import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";
import { BACKGROUND_MESSAGE_TYPES } from "../core/messages.js";

const defaultServices = {
  sendRuntimeMessage
};

export function createChromeHistorySyncAction({
  refreshStats,
  runSearch,
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  return async function syncChromeHistory() {
    setStatus("Syncing Chrome history");
    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.BOOTSTRAP_CHROME_HISTORY
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Chrome history sync failed.");
    }

    await refreshStats();
    await runSearch();
    setStatus(`Synced ${response.result.stored} records`);
  };
}
