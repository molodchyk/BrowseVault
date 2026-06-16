export function switchAppTab(elements, tabName) {
  for (const tab of elements.tabs) {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  }

  for (const panel of elements.panels) {
    panel.hidden = panel.dataset.panel !== tabName;
  }
}

export function createAppNavigation({ elements }) {
  function switchTab(tabName) {
    switchAppTab(elements, tabName);
  }

  function focusSearchInput() {
    switchTab("history");
    elements.query.focus();
    elements.query.select();
  }

  return {
    focusSearchInput,
    switchTab
  };
}
