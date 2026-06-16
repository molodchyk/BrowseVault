export function createAppShellState(defaultPreferences) {
  return {
    currentResults: [],
    currentTotal: 0,
    currentShownLimit: defaultPreferences.defaultLimit,
    selectedIds: new Set(),
    lastCheckedIndex: null,
    preferences: { ...defaultPreferences },
    stagedImport: null,
    searchDebounceTimer: null,
    historySearchRequestId: 0,
    quickSearchRequestId: 0
  };
}

export function nextHistorySearchRequestId(state) {
  state.historySearchRequestId += 1;
  return state.historySearchRequestId;
}

export function isCurrentHistorySearchRequestId(state, requestId) {
  return requestId === state.historySearchRequestId;
}

export function nextQuickSearchRequestId(state) {
  state.quickSearchRequestId += 1;
  return state.quickSearchRequestId;
}

export function isCurrentQuickSearchRequestId(state, requestId) {
  return requestId === state.quickSearchRequestId;
}

export function clearSearchDebounce(state, clearTimeoutFn = (timerId) => globalThis.clearTimeout(timerId)) {
  if (state.searchDebounceTimer === null) {
    return false;
  }

  clearTimeoutFn(state.searchDebounceTimer);
  state.searchDebounceTimer = null;
  return true;
}

export function scheduleSearchDebounce(
  state,
  callback,
  delay,
  timers = {
    clearTimeout: (timerId) => globalThis.clearTimeout(timerId),
    setTimeout: (callbackFn, timeout) => globalThis.setTimeout(callbackFn, timeout)
  }
) {
  clearSearchDebounce(state, timers.clearTimeout);
  state.searchDebounceTimer = timers.setTimeout(() => {
    state.searchDebounceTimer = null;
    callback();
  }, delay);
  return state.searchDebounceTimer;
}
