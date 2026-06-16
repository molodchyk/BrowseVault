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
import { createBackgroundMessageRouter } from "./features/background-runtime/background/message-router.js";

const APP_URL = "src/app.html";
const BOOTSTRAP_URL_LIMIT = 3000;
const VISIT_EXPANSION_CONCURRENCY = 8;
const EXTENSION_URL_PREFIX = getExtensionUrl("");

function now() {
  return new Date().toISOString();
}

function isInternalUrl(url) {
  return /^(chrome|edge|brave|vivaldi|opera|about|chrome-extension):/i.test(url || "");
}

function hostMatchesRule(host, rule) {
  return host === rule || host.endsWith(`.${rule}`);
}

function isAllowedBackgroundMessageSender(sender) {
  const senderUrl = sender?.url || sender?.tab?.url || "";
  return senderUrl.startsWith(EXTENSION_URL_PREFIX);
}

async function shouldArchiveUrl(url, existingRules = null) {
  if (!url || isInternalUrl(url)) {
    return false;
  }

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }

  const rules = existingRules || (await getRules());
  if (rules.whitelist.some((rule) => hostMatchesRule(host, rule))) {
    return true;
  }

  return !rules.blacklist.some((rule) => hostMatchesRule(host, rule));
}

async function bootstrapChromeHistory(reason = "startup") {
  const items = await searchHistory({
    text: "",
    startTime: 0,
    maxResults: BOOTSTRAP_URL_LIMIT
  });

  const expandedItems = await expandHistoryItems(items);
  const result = await syncChromeHistoryItems(expandedItems, {
    source: "chrome-history",
    reason
  });

  await setMeta("lastChromeSync", {
    ...result,
    reason,
    syncedAt: now()
  });

  return result;
}

async function expandHistoryItems(items) {
  const expanded = [];
  const rules = await getRules();
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;

      if (!(await shouldArchiveUrl(item.url, rules))) {
        continue;
      }

      try {
        const visits = await getHistoryVisits({ url: item.url });
        if (!visits.length) {
          expanded.push(item);
          continue;
        }

        for (const visit of visits) {
          expanded.push({
            ...item,
            id: `${item.url}|${visit.visitId || visit.visitTime}`,
            visitId: visit.visitId || "",
            visitTime: visit.visitTime,
            transition: visit.transition || "",
            referringVisitId: visit.referringVisitId || ""
          });
        }
      } catch {
        expanded.push(item);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(VISIT_EXPANSION_CONCURRENCY, items.length) },
      () => worker()
    )
  );

  return expanded;
}

onInstalled(async () => {
  await setMeta("installedAt", now());
  await bootstrapChromeHistory("installed");
});

onStartup(async () => {
  await setMeta("lastStartedAt", now());
  await bootstrapChromeHistory("startup");
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
  if (!(await shouldArchiveUrl(item.url))) {
    return;
  }

  await recordChromeVisit(item, {
    source: "chrome-history-live"
  });
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
  bootstrapChromeHistory,
  createTab,
  deleteHistoryUrl,
  focusWindow,
  restoreSession
}, {
  isAllowedSender: isAllowedBackgroundMessageSender
}));
