import test from "node:test";
import assert from "node:assert/strict";
import { searchBrowserMemory } from "../src/browser-memory.js";

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
