# Browser Memory

Owns extension-page quick-open behavior for live browser sources such as tabs, bookmarks, downloads, and recently closed sessions.

The root `src/browser-memory.js` module still owns read-only source search. This feature owns the UI action orchestration around those results: rendering quick results, activating/restoring/opening entries, copying URLs, and handling source warnings.
