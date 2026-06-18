import {
  defaultSavedSearchName,
  savedSearchHasCriteria
} from "../core/saved-searches.js";

const defaultServices = {
  promptForName: (message, fallback) => globalThis.prompt(message, fallback)
};

function localizedMessage(getMessage, key, fallback, substitutions) {
  return getMessage?.(key, substitutions) || fallback;
}

export function createSavedSearchActions({
  deleteSavedSearch,
  elements,
  getMessage = () => "",
  getSavedSearches,
  readSearchValues,
  runSearchesNow,
  saveSavedSearch,
  services = {},
  setStatus,
  writeSearchValues
}) {
  const deps = {
    ...defaultServices,
    ...services
  };
  let searches = [];

  function selectedSearch() {
    const selectedId = elements.savedSearches.value;
    return searches.find((search) => search.id === selectedId) || null;
  }

  function renderSavedSearches(nextSearches = searches, selectedId = elements.savedSearches.value) {
    searches = nextSearches;
    const ownerDocument = elements.savedSearches.ownerDocument || document;
    elements.savedSearches.textContent = "";

    const placeholder = ownerDocument.createElement("option");
    placeholder.value = "";
    placeholder.textContent = localizedMessage(getMessage, "savedSearchesOption", "Saved searches");
    elements.savedSearches.append(placeholder);

    for (const search of searches) {
      const option = ownerDocument.createElement("option");
      option.value = search.id;
      option.textContent = search.name;
      elements.savedSearches.append(option);
    }

    elements.savedSearches.value = searches.some((search) => search.id === selectedId) ? selectedId : "";
  }

  async function loadSavedSearches() {
    renderSavedSearches(await getSavedSearches());
  }

  async function saveCurrentSearch() {
    const values = readSearchValues();
    if (!savedSearchHasCriteria(values)) {
      setStatus(localizedMessage(getMessage, "statusEnterSearchBeforeSaving", "Enter a search before saving"));
      return;
    }

    const selected = selectedSearch();
    const name = deps.promptForName(
      localizedMessage(getMessage, "savedSearchNamePrompt", "Save search name"),
      selected?.name || defaultSavedSearchName(values)
    );
    if (name === null) {
      setStatus(localizedMessage(getMessage, "statusSaveSearchCanceled", "Save search canceled"));
      return;
    }

    const nextSearches = await saveSavedSearch({
      ...values,
      id: selected?.id,
      name
    });
    const saved = nextSearches.find((search) => search.name === name.trim()) || nextSearches.find((search) => search.id === selected?.id);
    renderSavedSearches(nextSearches, saved?.id);
    const savedName = saved?.name || name.trim();
    setStatus(localizedMessage(getMessage, "statusSavedSearch", `Saved search: ${savedName}`, [savedName]));
  }

  async function applySelectedSearch() {
    const selected = selectedSearch();
    if (!selected) {
      setStatus(localizedMessage(getMessage, "statusChooseSavedSearchFirst", "Choose a saved search first"));
      return;
    }

    writeSearchValues(selected);
    await runSearchesNow();
    setStatus(localizedMessage(getMessage, "statusAppliedSavedSearch", `Applied saved search: ${selected.name}`, [selected.name]));
  }

  async function deleteSelectedSearch() {
    const selected = selectedSearch();
    if (!selected) {
      setStatus(localizedMessage(getMessage, "statusChooseSavedSearchFirst", "Choose a saved search first"));
      return;
    }

    const nextSearches = await deleteSavedSearch(selected.id);
    renderSavedSearches(nextSearches);
    setStatus(localizedMessage(getMessage, "statusDeletedSavedSearch", `Deleted saved search: ${selected.name}`, [selected.name]));
  }

  return {
    applySelectedSearch,
    deleteSelectedSearch,
    loadSavedSearches,
    renderSavedSearches,
    saveCurrentSearch
  };
}
