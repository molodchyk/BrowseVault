import { getVisitsByIds } from "../../../storage.js";

const defaultServices = {
  getVisitsByIds
};

export function createSelectedResultLookup({
  appState,
  services = {}
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  async function selectedResults() {
    return deps.getVisitsByIds([...appState.selectedIds]);
  }

  return {
    selectedResults
  };
}
