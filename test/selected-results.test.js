import test from "node:test";
import assert from "node:assert/strict";
import { createSelectedResultLookup } from "../src/features/history-results/ui/selected-results.js";

test("selectedResults loads selected visits in insertion order", async () => {
  const calls = [];
  const lookup = createSelectedResultLookup({
    appState: {
      selectedIds: new Set(["visit-2", "visit-1"])
    },
    services: {
      getVisitsByIds: async (ids) => {
        calls.push(ids);
        return ids.map((id) => ({ id }));
      }
    }
  });

  assert.deepEqual(await lookup.selectedResults(), [
    { id: "visit-2" },
    { id: "visit-1" }
  ]);
  assert.deepEqual(calls, [["visit-2", "visit-1"]]);
});
