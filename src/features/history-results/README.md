# History Results

Owns result-list helpers for selection, selected-record lookup, grouping, result counts, URL/domain extraction, incremental loading state, saved-search normalization, search form composition, local history search/load-more orchestration, saved-search controls, result rendering orchestration, and selected-result bulk actions.

Pure core modules stay free of `chrome`, `window`, and `document` dependencies. UI action modules coordinate extension-page handlers through injected services so they remain testable outside the browser.
