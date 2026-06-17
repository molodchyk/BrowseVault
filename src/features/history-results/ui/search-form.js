import { historySearchTextFromValues } from "../core/search-form.js";

export function createHistorySearchForm({ elements }) {
  function readSearchValues() {
    return {
      query: elements.query.value,
      onDate: elements.onDate.value,
      after: elements.after.value,
      before: elements.before.value,
      limit: elements.limit.value
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
  }

  function clearSearchFields() {
    elements.query.value = "";
    elements.onDate.value = "";
    elements.after.value = "";
    elements.before.value = "";
  }

  function getSearchText() {
    return historySearchTextFromValues(readSearchValues());
  }

  return {
    clearSearchFields,
    getSearchText,
    readSearchValues,
    writeSearchValues
  };
}
