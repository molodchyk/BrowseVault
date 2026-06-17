import { matchesVisitQuery, parseQuery } from "./query.js";
import { getBookmarkTree } from "./platform/chrome/bookmarks.js";
import { searchDownloadItems } from "./platform/chrome/downloads.js";
import { getRecentlyClosedSessions } from "./platform/chrome/sessions.js";
import { queryTabs } from "./platform/chrome/tabs.js";

const DEFAULT_LIMIT = 40;

function normalizeUrl(url) {
  try {
    return new URL(url).href;
  } catch {
    return url || "";
  }
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function titleOrUrl(item) {
  return item.title || item.url || "Untitled";
}

function memoryRecord({
  id,
  type,
  title,
  url,
  visitTime = Date.now(),
  detail = "",
  action = null,
  source = type,
  searchTitle = "",
  searchUrl = "",
  domains = []
}) {
  const normalizedUrl = normalizeUrl(url);
  const primaryDomain = domainFromUrl(url);
  const recordDomains = uniqueStrings(domains.length ? domains : [primaryDomain]);

  return {
    id,
    type,
    title: title || url || "Untitled",
    normalizedTitle: (searchTitle || title || "").toLowerCase(),
    url: normalizedUrl,
    normalizedUrl: (searchUrl || normalizedUrl).toLowerCase(),
    domain: primaryDomain,
    domains: recordDomains,
    visitTime,
    source,
    detail,
    action
  };
}

async function searchTabRecords() {
  const tabs = await queryTabs({});
  return tabs
    .filter((tab) => tab.url && !tab.url.startsWith("chrome://"))
    .map((tab) =>
      memoryRecord({
        id: `tab:${tab.id}`,
        type: "tab",
        title: tab.title,
        url: tab.url,
        visitTime: Date.now(),
        detail: tab.active ? "Open tab, active" : "Open tab",
        action: {
          type: "activate-tab",
          tabId: tab.id,
          windowId: tab.windowId
        }
      })
    );
}

async function searchBookmarkRecords() {
  const tree = await getBookmarkTree();
  const bookmarks = [];

  function walk(nodes) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push(node);
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  }

  walk(tree);

  return bookmarks
    .filter((bookmark) => bookmark.url)
    .map((bookmark) =>
      memoryRecord({
        id: `bookmark:${bookmark.id}`,
        type: "bookmark",
        title: bookmark.title,
        url: bookmark.url,
        visitTime: bookmark.dateAdded || Date.now(),
        detail: "Bookmark",
        action: {
          type: "open-url",
          url: bookmark.url
        }
      })
    );
}

async function searchDownloadRecords() {
  const downloads = await searchDownloadItems({
    limit: 500,
    orderBy: ["-startTime"]
  });

  return downloads
    .filter((download) => download.url)
    .map((download) =>
      memoryRecord({
        id: `download:${download.id}`,
        type: "download",
        title: download.filename?.split(/[\\/]/).pop() || download.url,
        url: download.url,
        visitTime: Date.parse(download.startTime) || Date.now(),
        detail: `Download${download.exists === false ? ", missing file" : ""}`,
        action: {
          type: "open-url",
          url: download.url
        }
      })
    );
}

function sessionVisitTime(session) {
  return session.lastModified ? session.lastModified * 1000 : Date.now();
}

function tabDomains(tabs) {
  return uniqueStrings(tabs.map((tab) => domainFromUrl(tab.url)));
}

function tabSearchTitle(tabs, prefix = "") {
  return [prefix, ...tabs.map(titleOrUrl)].filter(Boolean).join(" ");
}

function tabSearchUrl(tabs) {
  return tabs.map((tab) => normalizeUrl(tab.url)).join(" ");
}

function closedTabRecord(session, sessionIndex, tab, tabIndex, detail = "Closed tab") {
  return memoryRecord({
    id: `session:${sessionIndex}:${tabIndex}`,
    type: "closed tab",
    source: "recent closed-tab",
    title: tab.title,
    url: tab.url,
    visitTime: sessionVisitTime(session),
    detail,
    action: {
      type: session.sessionId ? "restore-session" : "open-url",
      sessionId: session.sessionId || "",
      url: tab.url
    }
  });
}

function closedWindowTitle(tabs) {
  const shown = tabs.slice(0, 3).map(titleOrUrl);
  const extraCount = tabs.length - shown.length;
  const suffix = extraCount > 0 ? `, +${extraCount} more` : "";
  return `Closed window (${tabs.length} tabs): ${shown.join(", ")}${suffix}`;
}

function closedWindowRecord(session, sessionIndex, tabs) {
  const primaryTab = tabs[0];
  const title = closedWindowTitle(tabs);

  return memoryRecord({
    id: `session-window:${session.sessionId || sessionIndex}`,
    type: "closed window",
    source: "recent closed-window",
    title,
    url: primaryTab.url,
    visitTime: sessionVisitTime(session),
    detail: `Closed window · ${tabs.length} tabs`,
    searchTitle: tabSearchTitle(tabs, title),
    searchUrl: tabSearchUrl(tabs),
    domains: tabDomains(tabs),
    action: {
      type: session.sessionId ? "restore-session" : "open-url",
      sessionId: session.sessionId || "",
      url: primaryTab.url
    }
  });
}

function sessionRecords(session, sessionIndex) {
  if (session.tab?.url) {
    return [closedTabRecord(session, sessionIndex, session.tab, 0)];
  }

  const tabs = (session.window?.tabs || []).filter((tab) => tab.url);
  if (!tabs.length) {
    return [];
  }

  if (session.sessionId) {
    return [closedWindowRecord(session, sessionIndex, tabs)];
  }

  return tabs.map((tab, tabIndex) =>
    closedTabRecord(session, sessionIndex, tab, tabIndex, "Closed window tab")
  );
}

async function searchRecentlyClosedRecords() {
  const sessions = await getRecentlyClosedSessions({
    maxResults: 25
  });

  return sessions.flatMap(sessionRecords);
}

const SOURCE_SEARCHES = [
  { label: "Tabs", run: searchTabRecords },
  { label: "Bookmarks", run: searchBookmarkRecords },
  { label: "Downloads", run: searchDownloadRecords },
  { label: "Recently closed", run: searchRecentlyClosedRecords }
];

function sourceWarning(label, reason) {
  const message = reason?.message || "";
  if (
    message === "Chrome extension API is unavailable."
    || message.includes("Cannot read properties of undefined")
    || message.includes("is not a function")
  ) {
    return `${label} unavailable in this context.`;
  }

  return `${label}: ${message || "Unknown source error"}`;
}

export async function searchBrowserMemory(input = "", options = {}) {
  const limit = Number(options.limit || DEFAULT_LIMIT);
  const query = parseQuery(input);
  const settled = await Promise.allSettled(SOURCE_SEARCHES.map((source) => source.run()));

  const warnings = settled
    .map((result, index) => result.status === "rejected"
      ? sourceWarning(SOURCE_SEARCHES[index].label, result.reason)
      : null
    )
    .filter(Boolean);

  const records = settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((record) => matchesVisitQuery(record, query))
    .sort((a, b) => b.visitTime - a.visitTime);

  return {
    warnings,
    total: records.length,
    results: records.slice(0, limit)
  };
}
