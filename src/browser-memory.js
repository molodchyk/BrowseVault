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

function memoryRecord({ id, type, title, url, visitTime = Date.now(), detail = "", action = null }) {
  return {
    id,
    type,
    title: title || url || "Untitled",
    normalizedTitle: (title || "").toLowerCase(),
    url: normalizeUrl(url),
    normalizedUrl: normalizeUrl(url).toLowerCase(),
    domain: domainFromUrl(url),
    visitTime,
    source: type,
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

function sessionEntries(session) {
  if (session.tab) {
    return [session.tab];
  }

  if (session.window?.tabs?.length) {
    return session.window.tabs;
  }

  return [];
}

async function searchRecentlyClosedRecords() {
  const sessions = await getRecentlyClosedSessions({
    maxResults: 25
  });

  return sessions.flatMap((session, sessionIndex) =>
    sessionEntries(session)
      .filter((tab) => tab.url)
      .map((tab, tabIndex) =>
        memoryRecord({
          id: `session:${sessionIndex}:${tabIndex}`,
          type: "recent",
          title: tab.title,
          url: tab.url,
          visitTime: session.lastModified ? session.lastModified * 1000 : Date.now(),
          detail: "Recently closed",
          action: {
            type: session.sessionId ? "restore-session" : "open-url",
            sessionId: session.sessionId || "",
            url: tab.url
          }
        })
      )
  );
}

export async function searchBrowserMemory(input = "", options = {}) {
  const limit = Number(options.limit || DEFAULT_LIMIT);
  const query = parseQuery(input);
  const settled = await Promise.allSettled([
    searchTabRecords(),
    searchBookmarkRecords(),
    searchDownloadRecords(),
    searchRecentlyClosedRecords()
  ]);

  const warnings = settled
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "Unknown source error");

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
