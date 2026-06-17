import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";
import { BACKGROUND_MESSAGE_TYPES } from "../core/messages.js";

const defaultServices = {
  sendRuntimeMessage
};

function localizedMessage(getMessage, key, fallback, substitutions) {
  return getMessage?.(key, substitutions) || fallback;
}

export function createChromeHistorySyncAction({
  getMessage = () => "",
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
    setStatus(localizedMessage(getMessage, "statusSyncingChromeHistory", "Syncing Chrome history"));
    const response = await deps.sendRuntimeMessage({
      type: BACKGROUND_MESSAGE_TYPES.BOOTSTRAP_CHROME_HISTORY
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedMessage(getMessage, "errorChromeHistorySyncFailed", "Chrome history sync failed."));
    }

    await refreshStats();
    await runSearch();
    setStatus(localizedMessage(
      getMessage,
      "statusSyncedRecords",
      `Synced ${response.result.stored} records`,
      [String(response.result.stored)]
    ));
  };
}
