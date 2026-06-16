import test from "node:test";
import assert from "node:assert/strict";
import { createSearchCoordinator } from "../src/features/app-shell/ui/search-coordinator.js";

function createHarness({
  delayMs = 300,
  runHistorySearch = async () => {},
  runQuickSearch = async () => {}
} = {}) {
  const calls = [];
  const scheduled = [];
  const cleared = [];
  let nextTimerId = 20;
  const appState = {
    searchDebounceTimer: null
  };
  const coordinator = createSearchCoordinator({
    appState,
    delayMs,
    runHistorySearch: async () => {
      calls.push("history");
      await runHistorySearch();
    },
    runQuickSearch: async () => {
      calls.push("quick");
      await runQuickSearch();
    },
    services: {
      timers: {
        clearTimeout(timerId) {
          cleared.push(timerId);
        },
        setTimeout(callback, delay) {
          const timerId = nextTimerId;
          nextTimerId += 1;
          scheduled.push({ callback, delay, timerId });
          return timerId;
        }
      }
    },
    setStatus: (message) => calls.push(["status", message])
  });

  return { appState, calls, cleared, coordinator, scheduled };
}

test("runSearchesNow clears pending debounce and runs history before quick search", async () => {
  const { appState, calls, cleared, coordinator } = createHarness();
  appState.searchDebounceTimer = 12;

  await coordinator.runSearchesNow();

  assert.equal(appState.searchDebounceTimer, null);
  assert.deepEqual(cleared, [12]);
  assert.deepEqual(calls, ["history", "quick"]);
});

test("scheduleSearches replaces pending timers and reports async failures", async () => {
  const { appState, calls, cleared, coordinator, scheduled } = createHarness({
    delayMs: 150,
    runHistorySearch: async () => {
      throw new Error("search failed");
    }
  });

  const first = coordinator.scheduleSearches();
  const second = coordinator.scheduleSearches();

  assert.equal(first, 20);
  assert.equal(second, 21);
  assert.equal(appState.searchDebounceTimer, 21);
  assert.deepEqual(cleared, [20]);
  assert.deepEqual(scheduled.map((timer) => timer.delay), [150, 150]);

  scheduled[1].callback();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(appState.searchDebounceTimer, null);
  assert.deepEqual(calls, ["history", ["status", "search failed"]]);
});
