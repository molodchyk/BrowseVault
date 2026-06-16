# History Results

Owns pure result-list helpers for selection, grouping, result counts, URL/domain extraction, and incremental loading state.

The extension page still owns DOM rendering and event binding while this feature is being split out. Keep this feature free of `chrome`, `window`, and `document` dependencies.
