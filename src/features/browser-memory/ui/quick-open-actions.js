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

export function quickActionLabel(item) {
  return item.action?.type === "activate-tab"
    ? "Switch"
    : item.action?.type === "restore-session"
      ? "Restore"
      : "Open";
}

export function quickActionStatusLabel(item) {
  const action = item.action || { type: "open-url" };
  return `${action.type === "activate-tab" ? "Switched to" : "Opened"} ${item.title || item.url}`;
}

export function quickBackgroundActionMessage(item) {
  return {
    type: BACKGROUND_MESSAGE_TYPES.OPEN_URL_BACKGROUND,
    url: item.url
  };
}

export function quickBackgroundActionStatusLabel(item) {
  return `Opened ${item.title || item.url} in background`;
}

export function createQuickOpenActions({
  appState,
  copyText,
  elements,
  getDateFormat,
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
      empty.textContent = warnings.length
        ? `No source results. ${warnings.join(" ")}`
        : "No source results.";
      elements.quickResults.append(empty);
      return;
    }

    for (const item of results) {
      const fragment = elements.quickResultTemplate.content.cloneNode(true);
      const source = fragment.querySelector(".source-pill");
      const title = fragment.querySelector(".result-title");
      const url = fragment.querySelector(".url");
      const meta = fragment.querySelector(".meta");
      const action = fragment.querySelector(".quick-action");
      const background = fragment.querySelector(".quick-background");
      const copy = fragment.querySelector(".quick-copy");

      source.textContent = item.type;
      title.href = item.url;
      deps.appendHighlightedText(title, item.title || item.url, titleTokens, query.regex);
      deps.appendHighlightedText(url, item.url, urlTokens, query.regex);
      deps.appendHighlightedText(
        meta,
        `${item.detail} · ${item.domain || "unknown domain"} · ${deps.formatDate(item.visitTime, getDateFormat())}`,
        metaTokens,
        query.regex
      );
      action.textContent = quickActionLabel(item);
      action.addEventListener("click", () => performQuickAction(item).catch((error) => setStatus(error.message)));
      background.addEventListener("click", () => openQuickUrlInBackground(item).catch((error) => setStatus(error.message)));
      copy.addEventListener("click", () => copyQuickUrl(item).catch((error) => setStatus(error.message)));

      elements.quickResults.append(fragment);
    }

  }

  async function performQuickAction(item) {
    const response = await deps.sendRuntimeMessage(quickActionMessage(item));
    if (!response?.ok) {
      throw new Error(response?.error || "Quick action failed.");
    }
    setStatus(quickActionStatusLabel(item));
  }

  async function openQuickUrlInBackground(item) {
    if (!item.url) {
      setStatus("No URL to open");
      return;
    }

    const response = await deps.sendRuntimeMessage(quickBackgroundActionMessage(item));
    if (!response?.ok) {
      throw new Error(response?.error || "Background open failed.");
    }
    setStatus(quickBackgroundActionStatusLabel(item));
  }

  async function copyQuickUrl(item) {
    if (!item.url) {
      setStatus("No URL to copy");
      return;
    }

    await copyText(item.url);
    setStatus(`Copied URL for ${item.title || item.url}`);
  }

  async function runQuickSearch() {
    const requestId = nextQuickSearchRequestId(appState);
    const searchText = getSearchText();
    const limit = quickResultLimit();
    setStatus("Searching browser sources");
    const { results, total, warnings } = await deps.searchBrowserMemory(searchText, {
      limit
    });

    if (!isCurrentQuickSearchRequestId(appState, requestId)) {
      return;
    }

    setStatus(warnings.length
      ? `${total} source results; ${warnings.length} source warning${warnings.length === 1 ? "" : "s"}`
      : `${total} source result${total === 1 ? "" : "s"}`
    );
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
