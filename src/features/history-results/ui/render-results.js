import {
  formatDate,
  formatDayHeading,
  localDayKey
} from "../../display-preferences/core/preferences.js";
import { parseQuery } from "../../../query.js";
import {
  countResultsByKey,
  resultCountLabel,
  selectRangeByIndex,
  toggleSelectedId
} from "../core/results.js";
import {
  appendHighlightedText,
  highlightTokensForScope
} from "./text-highlighting.js";

const RESULT_SELECTOR = ".result";

function historyResultItems(resultsElement) {
  return Array.from(resultsElement.querySelectorAll(RESULT_SELECTOR));
}

function targetResult(target) {
  return target?.closest?.(RESULT_SELECTOR) || null;
}

function focusResultByIndex(resultsElement, index) {
  const items = historyResultItems(resultsElement);
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

function applyCheckboxSelection({
  checkbox,
  index,
  results,
  getSelectionState,
  onSelectionChange,
  shiftKey
}) {
  if (!results[index]?.id) {
    return;
  }

  const state = getSelectionState();
  if (shiftKey && state.lastCheckedIndex !== null) {
    onSelectionChange({
      selectedIds: selectRangeByIndex(state.selectedIds, results, state.lastCheckedIndex, index, checkbox.checked),
      lastCheckedIndex: state.lastCheckedIndex,
      shouldRerender: true
    });
    return;
  }

  onSelectionChange({
    selectedIds: toggleSelectedId(state.selectedIds, results[index]?.id, checkbox.checked),
    lastCheckedIndex: index,
    shouldRerender: false
  });
}

export function handleHistoryResultKeyDown(event, resultsElement, selection = null) {
  const current = targetResult(event.target);
  if (!current) {
    return false;
  }

  const items = historyResultItems(resultsElement);
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
    focusResultByIndex(resultsElement, moves[event.key]);
    return true;
  }

  if (event.target !== current) {
    return false;
  }

  if (event.key === "Enter") {
    const link = current.querySelector(".result-title");
    if (!link) {
      return false;
    }

    event.preventDefault();
    link.click();
    return true;
  }

  if (event.key === " " || event.key === "Spacebar") {
    const checkbox = current.querySelector(".result-check");
    if (!checkbox) {
      return false;
    }

    event.preventDefault();
    if (!selection) {
      checkbox.click();
      return true;
    }

    checkbox.checked = !checkbox.checked;
    applyCheckboxSelection({
      checkbox,
      index,
      results: selection.results,
      getSelectionState: selection.getSelectionState,
      onSelectionChange: selection.onSelectionChange,
      shiftKey: event.shiftKey
    });
    return true;
  }

  return false;
}

function renderDayHeading({ resultsElement, visitTime, dayCount, dateFormat }) {
  const ownerDocument = resultsElement.ownerDocument;
  const day = ownerDocument.createElement("li");
  day.className = "result-day";
  day.setAttribute("aria-label", `Results for ${formatDayHeading(visitTime, dateFormat)}`);

  const label = ownerDocument.createElement("span");
  label.textContent = formatDayHeading(visitTime, dateFormat);

  const count = ownerDocument.createElement("span");
  count.textContent = `${dayCount} record${dayCount === 1 ? "" : "s"} shown`;

  day.append(label, " ", count);
  resultsElement.append(day);
}

function visitTimeIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function appendResultMeta({ meta, item, dateFormat, metaTokens, query }) {
  const ownerDocument = meta.ownerDocument;
  const domain = item.domain || "unknown domain";
  const timestamp = ownerDocument.createElement("time");
  const iso = visitTimeIso(item.visitTime);
  const details = `${item.visitCount || 0} visits · ${item.source || "unknown source"}`;
  const domainPart = ownerDocument.createElement("span");
  const categoryPart = ownerDocument.createElement("span");
  const detailsPart = ownerDocument.createElement("span");

  timestamp.textContent = formatDate(item.visitTime, dateFormat);
  timestamp.title = iso ? `Exact visit time: ${iso}` : "Exact visit time unavailable";
  if (iso) {
    timestamp.dateTime = iso;
  }

  appendHighlightedText(domainPart, domain, metaTokens, query.regex);
  appendHighlightedText(categoryPart, `category: ${item.category || ""}`, metaTokens, query.regex);
  appendHighlightedText(detailsPart, details, metaTokens, query.regex);
  const parts = [
    domainPart,
    ownerDocument.createTextNode(" · "),
    timestamp,
    ownerDocument.createTextNode(" · "),
    detailsPart
  ];

  if (item.category) {
    parts.splice(2, 0, categoryPart, ownerDocument.createTextNode(" · "));
  }

  meta.replaceChildren(...parts);
}

function renderResultItem({
  item,
  index,
  results,
  selectedIds,
  dateFormat,
  resultTemplate,
  resultsElement,
  titleTokens,
  urlTokens,
  metaTokens,
  query,
  getSelectionState,
  onSelectionChange
}) {
  const fragment = resultTemplate.content.cloneNode(true);
  const result = fragment.querySelector(".result");
  const checkbox = fragment.querySelector(".result-check");
  const title = fragment.querySelector(".result-title");
  const url = fragment.querySelector(".url");
  const meta = fragment.querySelector(".meta");

  result.dataset.id = item.id;
  result.dataset.resultIndex = String(index);
  result.tabIndex = index === 0 ? 0 : -1;
  checkbox.checked = selectedIds.has(item.id);
  checkbox.addEventListener("click", (event) => {
    applyCheckboxSelection({
      checkbox,
      index,
      results,
      getSelectionState,
      onSelectionChange,
      shiftKey: event.shiftKey
    });
  });

  title.href = item.url;
  appendHighlightedText(title, item.title || item.url, titleTokens, query.regex);
  appendHighlightedText(url, item.url, urlTokens, query.regex);
  appendResultMeta({
    meta,
    metaTokens,
    query,
    item,
    dateFormat
  });

  resultsElement.append(fragment);
}

export function renderHistoryResults({
  results,
  total,
  queryText,
  selectedIds,
  dateFormat,
  elements,
  getSelectionState,
  onSelectionChange
}) {
  const query = parseQuery(queryText);
  const titleTokens = highlightTokensForScope(query, "title");
  const urlTokens = highlightTokensForScope(query, "url");
  const metaTokens = highlightTokensForScope(query, "meta");
  const dayCounts = countResultsByKey(results, (result) => localDayKey(result.visitTime));
  let currentDayKey = "";

  elements.resultCount.textContent = resultCountLabel(total, results.length);
  elements.results.onkeydown = (event) => handleHistoryResultKeyDown(event, elements.results, {
    getSelectionState,
    onSelectionChange,
    results
  });
  elements.results.replaceChildren();

  results.forEach((item, index) => {
    const itemDayKey = localDayKey(item.visitTime);
    if (itemDayKey !== currentDayKey) {
      renderDayHeading({
        resultsElement: elements.results,
        visitTime: item.visitTime,
        dayCount: dayCounts.get(itemDayKey) || 0,
        dateFormat
      });
      currentDayKey = itemDayKey;
    }

    renderResultItem({
      item,
      index,
      results,
      selectedIds,
      dateFormat,
      resultTemplate: elements.resultTemplate,
      resultsElement: elements.results,
      titleTokens,
      urlTokens,
      metaTokens,
      query,
      getSelectionState,
      onSelectionChange
    });
  });
}
