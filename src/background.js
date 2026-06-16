import {
  getRules,
  markChromeDeletedByUrls,
  recordChromeVisit,
  setMeta,
  syncChromeHistoryItems
} from "./storage.js";
import { onActionClicked } from "./platform/chrome/action.js";
import { onCommand } from "./platform/chrome/commands.js";
import {
  deleteHistoryUrl,
  getHistoryVisits,
  onHistoryVisitRemoved,
  onHistoryVisited,
  searchHistory
} from "./platform/chrome/history.js";
import {
  getExtensionUrl,
  onInstalled,
  onRuntimeMessage,
  onStartup
} from "./platform/chrome/runtime.js";
import { restoreSession } from "./platform/chrome/sessions.js";
import { activateTab, createTab } from "./platform/chrome/tabs.js";
import { focusWindow } from "./platform/chrome/windows.js";
import { createChromeHistorySync } from "./features/background-runtime/background/chrome-history-sync.js";
import { createBackgroundMessageRouter } from "./features/background-runtime/background/message-router.js";

const APP_URL = "src/app.html";
const EXTENSION_URL_PREFIX = getExtensionUrl("");

function now() {
  return new Date().toISOString();
}

function isAllowedBackgroundMessageSender(sender) {
  const senderUrl = sender?.url || sender?.tab?.url || "";
  return senderUrl.startsWith(EXTENSION_URL_PREFIX);
}

const chromeHistorySync = createChromeHistorySync({
  getHistoryVisits,
  getRules,
  recordChromeVisit,
  searchHistory,
  setMeta,
  syncChromeHistoryItems
}, {
  now
});

onInstalled(async () => {
  await setMeta("installedAt", now());
  await chromeHistorySync.bootstrapChromeHistory("installed");
});

onStartup(async () => {
  await setMeta("lastStartedAt", now());
  await chromeHistorySync.bootstrapChromeHistory("startup");
});

onActionClicked(async () => {
  await createTab({
    url: getExtensionUrl(APP_URL)
  });
});

onCommand(async (command) => {
  if (command !== "open-browsevault") {
    return;
  }

  await createTab({
    url: getExtensionUrl(APP_URL)
  });
});

onHistoryVisited(async (item) => {
  await chromeHistorySync.recordVisitedItem(item);
});

onHistoryVisitRemoved(async (removed) => {
  if (removed.allHistory) {
    await setMeta("lastNativeHistoryClear", {
      clearedAt: now()
    });
    return;
  }

  if (removed.urls?.length) {
    await markChromeDeletedByUrls(removed.urls, now());
  }
});

onRuntimeMessage(createBackgroundMessageRouter({
  activateTab,
  bootstrapChromeHistory: chromeHistorySync.bootstrapChromeHistory,
  createTab,
  deleteHistoryUrl,
  focusWindow,
  restoreSession
}, {
  isAllowedSender: isAllowedBackgroundMessageSender
}));
