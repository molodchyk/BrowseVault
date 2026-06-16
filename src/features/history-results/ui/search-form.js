import { historySearchTextFromValues } from "../core/search-form.js";

export function createHistorySearchForm({ elements }) {
  function clearSearchFields() {
    elements.query.value = "";
    elements.onDate.value = "";
    elements.after.value = "";
    elements.before.value = "";
  }

  function getSearchText() {
    return historySearchTextFromValues({
      query: elements.query.value,
      onDate: elements.onDate.value,
      after: elements.after.value,
      before: elements.before.value
    });
  }

  return {
    clearSearchFields,
    getSearchText
  };
}
