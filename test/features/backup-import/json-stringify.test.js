import test from "node:test";
import assert from "node:assert/strict";
import { stringifyJson } from "../../../src/features/backup-import/core/json-stringify.js";

test("stringifyJson matches native pretty JSON output", async () => {
  const value = {
    app: "BrowseVault",
    schemaVersion: 1,
    exportedAt: new Date("2026-06-16T12:00:00.000Z"),
    counts: { visits: 2 },
    ignored: undefined,
    visits: [
      {
        id: "visit-1",
        title: "Research",
        visitTime: 1780000000000,
        flags: [true, false, null, undefined],
        meta: {
          score: Number.NaN,
          unsupported() {}
        }
      },
      {
        id: "visit-2",
        title: "Quote \"test\"",
        visitTime: Number.POSITIVE_INFINITY
      }
    ]
  };

  assert.equal(
    await stringifyJson(value, { space: 2, chunkSize: 2, scheduler: async () => {} }),
    JSON.stringify(value, null, 2)
  );
});

test("stringifyJson yields while serializing large arrays", async () => {
  const yields = [];
  const value = {
    visits: Array.from({ length: 25 }, (_, index) => ({
      id: `visit-${index}`,
      url: `https://example.com/${index}`
    }))
  };

  const text = await stringifyJson(value, {
    chunkSize: 10,
    scheduler: async () => yields.push("yield"),
    space: 2
  });

  assert.equal(text, JSON.stringify(value, null, 2));
  assert.ok(yields.length >= 2);
});

test("stringifyJson reports circular data like native JSON", async () => {
  const value = { name: "cycle" };
  value.self = value;

  await assert.rejects(
    stringifyJson(value, { space: 2, scheduler: async () => {} }),
    /Converting circular structure to JSON/
  );
});
