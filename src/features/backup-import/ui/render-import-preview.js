import { importPreviewViewModel } from "../core/import-preview.js";

export function renderImportPreview(elements, stagedImport) {
  const view = importPreviewViewModel(stagedImport);

  if (view.hidden) {
    elements.importPreview.hidden = true;
    elements.confirmImport.textContent = view.buttonText;
    elements.importHealth.className = view.healthClassName;
    elements.importHealth.textContent = view.healthText;
    return;
  }

  elements.importPreviewTitle.textContent = view.title;
  elements.importValid.textContent = view.validRows;
  elements.importNew.textContent = view.newVisits;
  elements.importExisting.textContent = view.existingVisits;
  elements.importDuplicates.textContent = view.duplicateRows;
  elements.importHealth.className = view.healthClassName;
  elements.importHealth.textContent = view.healthText;
  elements.confirmImport.textContent = view.buttonText;
  elements.importPreviewNote.textContent = view.note;
  elements.importPreview.hidden = false;
}
