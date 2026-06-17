import {
  dateShortcutValues,
  historySearchTextFromValues
} from "../core/search-form.js";

export function createHistorySearchForm({ elements }) {
  function readSearchValues() {
    return {
      query: elements.query.value,
      onDate: elements.onDate.value,
      after: elements.after.value,
      before: elements.before.value,
      limit: elements.limit.value,
      sortOrder: elements.sortOrder.value
    };
  }

  function writeSearchValues(values) {
    elements.query.value = values?.query || "";
    elements.onDate.value = values?.onDate || "";
    elements.after.value = values?.after || "";
    elements.before.value = values?.before || "";
    if (values?.limit) {
      elements.limit.value = values.limit;
    }
    elements.sortOrder.value = values?.sortOrder === "oldest" ? "oldest" : "newest";
  }

  function clearSearchFields() {
    elements.query.value = "";
    elements.onDate.value = "";
    elements.after.value = "";
    elements.before.value = "";
  }

  function applyDateShortcut(shortcut, now) {
    const values = dateShortcutValues(shortcut, now);
    if (!values) {
      return false;
    }

    elements.onDate.value = values.onDate;
    elements.after.value = values.after;
    elements.before.value = values.before;
    return true;
  }

  function getSearchText() {
    return historySearchTextFromValues(readSearchValues());
  }

  function getSortOrder() {
    return elements.sortOrder.value === "oldest" ? "oldest" : "newest";
  }

  return {
    applyDateShortcut,
    clearSearchFields,
    getSortOrder,
    getSearchText,
    readSearchValues,
    writeSearchValues
  };
}
