# History Results

Owns result-list helpers for selection, grouping, result counts, URL/domain extraction, incremental loading state, search form composition, local history search/load-more orchestration, result rendering orchestration, and selected-result bulk actions.

Pure core modules stay free of `chrome`, `window`, and `document` dependencies. UI action modules coordinate extension-page handlers through injected services so they remain testable outside the browser.
