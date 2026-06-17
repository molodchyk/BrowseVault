import test from "node:test";
import assert from "node:assert/strict";
import { searchBrowserMemory } from "../src/browser-memory.js";

async function withChromeApi(chromeApi, task) {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = chromeApi;
  try {
    return await task();
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
  }
}

test("searchBrowserMemory returns readable source warnings when Chrome APIs are missing", async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {};
  try {
    const result = await searchBrowserMemory("", { limit: 10 });

    assert.equal(result.total, 0);
    assert.deepEqual(result.results, []);
    assert.deepEqual(result.warnings, [
      "Tabs unavailable in this context.",
      "Bookmarks unavailable in this context.",
      "Downloads unavailable in this context.",
      "Recently closed unavailable in this context."
    ]);
  } finally {
    if (originalChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = originalChrome;
    }
  }
});

test("searchBrowserMemory groups closed windows into searchable session results", async () => {
  const result = await withChromeApi(
    {
      tabs: {
        query: async () => []
      },
      bookmarks: {
        getTree: async () => []
      },
      downloads: {
        search: async () => []
      },
      sessions: {
        getRecentlyClosed: async () => [
          {
            sessionId: "window-1",
            lastModified: 1_781_646_096,
            window: {
              tabs: [
                {
                  title: "Alpha Docs",
                  url: "https://first.example/docs"
                },
                {
                  title: "Second Report",
                  url: "https://second.example/report"
                }
              ]
            }
          }
        ]
      }
    },
    () => searchBrowserMemory("alpha site:second.example", { limit: 10 })
  );

  assert.equal(result.total, 1);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].type, "closed window");
  assert.equal(result.results[0].source, "recent closed-window");
  assert.equal(result.results[0].title, "Closed window (2 tabs): Alpha Docs, Second Report");
  assert.equal(result.results[0].detail, "Closed window · 2 tabs");
  assert.equal(result.results[0].url, "https://first.example/docs");
  assert.deepEqual(result.results[0].domains, ["first.example", "second.example"]);
  assert.deepEqual(result.results[0].action, {
    type: "restore-session",
    sessionId: "window-1",
    url: "https://first.example/docs"
  });
});
