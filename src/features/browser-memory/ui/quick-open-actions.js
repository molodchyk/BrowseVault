import { searchBrowserMemory } from "../../../browser-memory.js";
import {
  isCurrentQuickSearchRequestId,
  nextQuickSearchRequestId
} from "../../app-shell/core/state.js";
import { BACKGROUND_MESSAGE_TYPES } from "../../background-runtime/core/messages.js";
import { formatDate } from "../../display-preferences/core/preferences.js";
import {
  appendHighlightedText,
  highlightTokensForScope
} from "../../history-results/ui/text-highlighting.js";
import { sendRuntimeMessage } from "../../../platform/chrome/runtime.js";
import { parseQuery } from "../../../query.js";

const defaultServices = {
  appendHighlightedText,
  document: globalThis.document,
  formatDate,
  highlightTokensForScope,
  parseQuery,
  searchBrowserMemory,
  sendRuntimeMessage
};

const QUICK_RESULT_SELECTOR = ".quick-result[data-quick-index]";

function localizedMessage(getMessage, key, fallback, substitutions) {
  return getMessage?.(key, substitutions) || fallback;
}

function quickResultItems(resultsElement) {
  return Array.from(resultsElement.querySelectorAll(QUICK_RESULT_SELECTOR));
}

function targetQuickResult(target) {
  return target?.closest?.(QUICK_RESULT_SELECTOR) || null;
}

function focusQuickResultByIndex(resultsElement, index) {
  const items = quickResultItems(resultsElement);
  if (!items.length) {
    return null;
  }

  const boundedIndex = Math.max(0, Math.min(index, items.length - 1));
  const next = items[boundedIndex];
  items.forEach((item) => {
    item.tabIndex = item === next ? 0 : -1;
  });
  next.focus();
  return next;
}

export function handleQuickResultKeyDown(event, resultsElement) {
  const current = targetQuickResult(event.target);
  if (!current) {
    return false;
  }

  const items = quickResultItems(resultsElement);
  const index = items.indexOf(current);
  if (index < 0) {
    return false;
  }

  const moves = {
    ArrowDown: index + 1,
    ArrowUp: index - 1,
    Home: 0,
    End: items.length - 1
  };

  if (Object.prototype.hasOwnProperty.call(moves, event.key)) {
    event.preventDefault();
    focusQuickResultByIndex(resultsElement, moves[event.key]);
    return true;
  }

  if (event.target !== current) {
    return false;
  }

  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
    const action = current.querySelector(".quick-action");
    if (!action) {
      return false;
    }

    event.preventDefault();
    action.click();
    return true;
  }

  return false;
}

export function quickActionMessage(item) {
  const action = item.action || { type: "open-url", url: item.url };
  const messageByType = {
    "activate-tab": {
      type: BACKGROUND_MESSAGE_TYPES.ACTIVATE_TAB,
      tabId: action.tabId,
      windowId: action.windowId
    },
    "restore-session": {
      type: BACKGROUND_MESSAGE_TYPES.RESTORE_SESSION,
      sessionId: action.sessionId
    },
    "open-url": {
      type: BACKGROUND_MESSAGE_TYPES.OPEN_URL,
      url: action.url || item.url
    }
  };

  return messageByType[action.type] || messageByType["open-url"];
}

export function quickActionLabel(item, getMessage = () => "") {
  return item.action?.type === "activate-tab"
    ? localizedMessage(getMessage, "quickActionSwitch", "Switch")
    : item.action?.type === "restore-session"
      ? localizedMessage(getMessage, "quickActionRestore", "Restore")
      : localizedMessage(getMessage, "buttonOpen", "Open");
}

export function quickActionStatusLabel(item, getMessage = () => "") {
  const action = item.action || { type: "open-url" };
  const target = item.title || item.url;
  const statusByAction = {
    "activate-tab": ["quickStatusSwitchedTo", `Switched to ${target}`],
    "restore-session": ["quickStatusRestored", `Restored ${target}`],
    "open-url": ["quickStatusOpened", `Opened ${target}`]
  };
  const [key, fallback] = statusByAction[action.type] || statusByAction["open-url"];

  return localizedMessage(getMessage, key, fallback, [target]);
}

export function quickBackgroundActionMessage(item) {
  return {
    type: BACKGROUND_MESSAGE_TYPES.OPEN_URL_BACKGROUND,
    url: item.url
  };
}

export function quickBackgroundActionStatusLabel(item, getMessage = () => "") {
  const target = item.title || item.url;
  return localizedMessage(getMessage, "quickStatusOpenedInBackground", `Opened ${target} in background`, [target]);
}

export function createQuickOpenActions({
  appState,
  copyText,
  elements,
  getDateFormat,
  getMessage = () => "",
  getSearchText,
  quickResultLimit,
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  function renderQuickResults(results, total, warnings = []) {
    elements.quickResults.replaceChildren();
    const query = deps.parseQuery(getSearchText());
    const titleTokens = deps.highlightTokensForScope(query, "title");
    const urlTokens = deps.highlightTokensForScope(query, "url");
    const metaTokens = deps.highlightTokensForScope(query, "meta");

    if (!results.length) {
      const empty = deps.document.createElement("li");
      empty.className = "quick-result";
      const warningsText = warnings.join(" ");
      empty.textContent = warnings.length
        ? localizedMessage(getMessage, "quickNoSourceResultsWithWarnings", `No source results. ${warningsText}`, [warningsText])
        : localizedMessage(getMessage, "quickNoSourceResults", "No source results.");
      elements.quickResults.append(empty);
      return;
    }

    elements.quickResults.onkeydown = (event) => handleQuickResultKeyDown(event, elements.quickResults);

    results.forEach((item, index) => {
      const fragment = elements.quickResultTemplate.content.cloneNode(true);
      const result = fragment.querySelector(".quick-result");
      const source = fragment.querySelector(".source-pill");
      const title = fragment.querySelector(".result-title");
      const url = fragment.querySelector(".url");
      const meta = fragment.querySelector(".meta");
      const action = fragment.querySelector(".quick-action");
      const background = fragment.querySelector(".quick-background");
      const copy = fragment.querySelector(".quick-copy");

      result.dataset.quickIndex = String(index);
      result.tabIndex = index === 0 ? 0 : -1;
      source.textContent = item.type;
      title.href = item.url;
      deps.appendHighlightedText(title, item.title || item.url, titleTokens, query.regex);
      deps.appendHighlightedText(url, item.url, urlTokens, query.regex);
      deps.appendHighlightedText(
        meta,
        `${item.detail} · ${item.domain || localizedMessage(getMessage, "quickUnknownDomain", "unknown domain")} · ${deps.formatDate(item.visitTime, getDateFormat())}`,
        metaTokens,
        query.regex
      );
      action.textContent = quickActionLabel(item, getMessage);
      action.addEventListener("click", () => performQuickAction(item).catch((error) => setStatus(error.message)));
      background.addEventListener("click", () => openQuickUrlInBackground(item).catch((error) => setStatus(error.message)));
      copy.addEventListener("click", () => copyQuickUrl(item).catch((error) => setStatus(error.message)));

      elements.quickResults.append(fragment);
    });

  }

  async function performQuickAction(item) {
    const response = await deps.sendRuntimeMessage(quickActionMessage(item));
    if (!response?.ok) {
      throw new Error(response?.error || localizedMessage(getMessage, "quickActionFailed", "Quick action failed."));
    }
    setStatus(quickActionStatusLabel(item, getMessage));
  }

  async function openQuickUrlInBackground(item) {
    if (!item.url) {
      setStatus(localizedMessage(getMessage, "quickNoUrlToOpen", "No URL to open"));
      return;
    }

    const response = await deps.sendRuntimeMessage(quickBackgroundActionMessage(item));
    if (!response?.ok) {
      throw new Error(response?.error || localizedMessage(getMessage, "quickBackgroundOpenFailed", "Background open failed."));
    }
    setStatus(quickBackgroundActionStatusLabel(item, getMessage));
  }

  async function copyQuickUrl(item) {
    if (!item.url) {
      setStatus(localizedMessage(getMessage, "quickNoUrlToCopy", "No URL to copy"));
      return;
    }

    await copyText(item.url);
    const target = item.title || item.url;
    setStatus(localizedMessage(getMessage, "quickStatusCopiedUrlFor", `Copied URL for ${target}`, [target]));
  }

  async function runQuickSearch() {
    const requestId = nextQuickSearchRequestId(appState);
    const searchText = getSearchText();
    const limit = quickResultLimit();
    setStatus(localizedMessage(getMessage, "quickStatusSearchingBrowserSources", "Searching browser sources"));
    const { results, total, warnings } = await deps.searchBrowserMemory(searchText, {
      limit
    });

    if (!isCurrentQuickSearchRequestId(appState, requestId)) {
      return;
    }

    const sourceResultsText = total === 1
      ? localizedMessage(getMessage, "quickStatusSourceResultOne", "1 source result", [String(total)])
      : localizedMessage(getMessage, "quickStatusSourceResultMany", `${total} source results`, [String(total)]);
    const sourceWarningsText = warnings.length === 1
      ? localizedMessage(getMessage, "quickStatusSourceWarningOne", "1 source warning", [String(warnings.length)])
      : localizedMessage(getMessage, "quickStatusSourceWarningMany", `${warnings.length} source warnings`, [String(warnings.length)]);

    setStatus(warnings.length ? `${sourceResultsText}; ${sourceWarningsText}` : sourceResultsText);
    renderQuickResults(results, total, warnings);
  }

  return {
    copyQuickUrl,
    openQuickUrlInBackground,
    performQuickAction,
    renderQuickResults,
    runQuickSearch
  };
}
