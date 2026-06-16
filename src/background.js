import {
  getRules,
  markChromeDeletedByUrls,
  recordChromeVisit,
  setMeta,
  syncChromeHistoryItems
} from "./storage.js";

const APP_URL = "src/app.html";
const BOOTSTRAP_URL_LIMIT = 3000;
const VISIT_EXPANSION_CONCURRENCY = 8;

function now() {
  return new Date().toISOString();
}

function isInternalUrl(url) {
  return /^(chrome|edge|brave|vivaldi|opera|about|chrome-extension):/i.test(url || "");
}

function hostMatchesRule(host, rule) {
  return host === rule || host.endsWith(`.${rule}`);
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
  const items = await chrome.history.search({
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
        const visits = await chrome.history.getVisits({ url: item.url });
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

chrome.runtime.onInstalled.addListener(async () => {
  await setMeta("installedAt", now());
  await bootstrapChromeHistory("installed");
});

chrome.runtime.onStartup.addListener(async () => {
  await setMeta("lastStartedAt", now());
  await bootstrapChromeHistory("startup");
});

chrome.action.onClicked.addListener(async () => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(APP_URL)
  });
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "open-browsevault") {
    return;
  }

  await chrome.tabs.create({
    url: chrome.runtime.getURL(APP_URL)
  });
});

chrome.history.onVisited.addListener(async (item) => {
  if (!(await shouldArchiveUrl(item.url))) {
    return;
  }

  await recordChromeVisit(item, {
    source: "chrome-history-live"
  });
});

chrome.history.onVisitRemoved.addListener(async (removed) => {
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "browseVault.bootstrapChromeHistory") {
    bootstrapChromeHistory("manual")
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "browseVault.deleteChromeUrls") {
    Promise.all(
      [...new Set(message.urls || [])].map((url) => chrome.history.deleteUrl({ url }))
    )
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "browseVault.activateTab") {
    chrome.windows
      .update(message.windowId, { focused: true })
      .then(() => chrome.tabs.update(message.tabId, { active: true }))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "browseVault.restoreSession") {
    chrome.sessions
      .restore(message.sessionId || undefined)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "browseVault.openUrl") {
    chrome.tabs
      .create({ url: message.url })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "browseVault.openUrls") {
    const urls = [...new Set(message.urls || [])].filter(Boolean);
    Promise.all(urls.map((url) => chrome.tabs.create({ url })))
      .then(() => sendResponse({ ok: true, opened: urls.length }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
