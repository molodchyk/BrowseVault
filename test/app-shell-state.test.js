import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSearchDebounce,
  createAppShellState,
  isCurrentHistorySearchRequestId,
  isCurrentQuickSearchRequestId,
  nextHistorySearchRequestId,
  nextQuickSearchRequestId,
  scheduleSearchDebounce
} from "../src/features/app-shell/core/state.js";

const defaultPreferences = {
  theme: "system",
  accent: "teal",
  dateFormat: "system",
  defaultLimit: 500
};

test("createAppShellState initializes mutable shell state", () => {
  const state = createAppShellState(defaultPreferences);

  assert.deepEqual(state.currentResults, []);
  assert.equal(state.currentTotal, 0);
  assert.equal(state.currentShownLimit, 500);
  assert.deepEqual([...state.selectedIds], []);
  assert.equal(state.lastCheckedIndex, null);
  assert.deepEqual(state.preferences, defaultPreferences);
  assert.notEqual(state.preferences, defaultPreferences);
  assert.equal(state.stagedImport, null);
  assert.equal(state.searchDebounceTimer, null);
  assert.equal(state.historySearchRequestId, 0);
  assert.equal(state.quickSearchRequestId, 0);
});

test("request id helpers identify stale search responses", () => {
  const state = createAppShellState(defaultPreferences);
  const firstHistory = nextHistorySearchRequestId(state);
  const firstQuick = nextQuickSearchRequestId(state);

  assert.equal(firstHistory, 1);
  assert.equal(firstQuick, 1);
  assert.equal(isCurrentHistorySearchRequestId(state, firstHistory), true);
  assert.equal(isCurrentQuickSearchRequestId(state, firstQuick), true);

  const secondHistory = nextHistorySearchRequestId(state);
  const secondQuick = nextQuickSearchRequestId(state);

  assert.equal(secondHistory, 2);
  assert.equal(secondQuick, 2);
  assert.equal(isCurrentHistorySearchRequestId(state, firstHistory), false);
  assert.equal(isCurrentQuickSearchRequestId(state, firstQuick), false);
});

test("search debounce helpers replace pending work and clear timer state", () => {
  const state = createAppShellState(defaultPreferences);
  const cleared = [];
  const scheduled = [];
  let nextTimerId = 10;

  const timers = {
    clearTimeout(timerId) {
      cleared.push(timerId);
    },
    setTimeout(callback, delay) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      scheduled.push({ callback, delay, timerId });
      return timerId;
    }
  };

  const first = scheduleSearchDebounce(state, () => {}, 300, timers);
  const second = scheduleSearchDebounce(state, () => {}, 150, timers);

  assert.equal(first, 10);
  assert.equal(second, 11);
  assert.deepEqual(cleared, [10]);
  assert.equal(state.searchDebounceTimer, 11);
  assert.deepEqual(scheduled.map((timer) => timer.delay), [300, 150]);

  let fired = false;
  scheduled[1].callback();
  assert.equal(fired, false);
  assert.equal(state.searchDebounceTimer, null);

  scheduleSearchDebounce(state, () => {
    fired = true;
  }, 50, timers);
  scheduled[2].callback();
  assert.equal(fired, true);
  assert.equal(state.searchDebounceTimer, null);

  state.searchDebounceTimer = 99;
  assert.equal(clearSearchDebounce(state, timers.clearTimeout), true);
  assert.equal(clearSearchDebounce(state, timers.clearTimeout), false);
  assert.deepEqual(cleared, [10, 99]);
});
