import {
  getRules,
  markChromeDeletedByUrls,
  recordChromeVisit,
  setMeta,
  syncChromeHistoryItems
} from "./storage.js";

const APP_URL = "src/app.html";
const BOOTSTRAP_LIMIT = 5000;

function now() {
  return new Date().toISOString();
}

function isInternalUrl(url) {
  return /^(chrome|edge|brave|vivaldi|opera|about|chrome-extension):/i.test(url || "");
}

function hostMatchesRule(host, rule) {
  return host === rule || host.endsWith(`.${rule}`);
}

async function shouldArchiveUrl(url) {
  if (!url || isInternalUrl(url)) {
    return false;
  }

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }

  const rules = await getRules();
  if (rules.whitelist.some((rule) => hostMatchesRule(host, rule))) {
    return true;
  }

  return !rules.blacklist.some((rule) => hostMatchesRule(host, rule));
}

async function bootstrapChromeHistory(reason = "startup") {
  const items = await chrome.history.search({
    text: "",
    startTime: 0,
    maxResults: BOOTSTRAP_LIMIT
  });

  const result = await syncChromeHistoryItems(items, {
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

  return false;
});

