# History Export

Owns display-oriented export formatting for BrowseVault history records.

This feature keeps CSV and HTML formatting pure so extension pages can call it without carrying formatting rules in UI controllers. Large CSV and HTML exports have async chunked variants so the app can keep yielding to the browser event loop. The root `src/export-format.js` file remains a compatibility barrel during migration.
