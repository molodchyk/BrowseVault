import {
  clearSearchDebounce as clearAppSearchDebounce,
  scheduleSearchDebounce as scheduleAppSearchDebounce
} from "../core/state.js";

const defaultServices = {
  clearSearchDebounce: clearAppSearchDebounce,
  scheduleSearchDebounce: scheduleAppSearchDebounce,
  timers: {
    clearTimeout: (timerId) => globalThis.clearTimeout(timerId),
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay)
  }
};

export function createSearchCoordinator({
  appState,
  delayMs,
  runHistorySearch,
  runQuickSearch,
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services,
    timers: {
      ...defaultServices.timers,
      ...services.timers
    }
  };

  function clearSearchDebounce() {
    return deps.clearSearchDebounce(appState, deps.timers.clearTimeout);
  }

  async function runSearchesNow() {
    clearSearchDebounce();
    await runHistorySearch();
    await runQuickSearch();
  }

  function scheduleSearches() {
    return deps.scheduleSearchDebounce(appState, () => {
      runSearchesNow().catch((error) => setStatus(error.message));
    }, delayMs, deps.timers);
  }

  return {
    clearSearchDebounce,
    runSearchesNow,
    scheduleSearches
  };
}
