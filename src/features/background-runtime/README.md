# Background Runtime

Owns background service-worker message routing, payload validation, privileged action dispatch, Chrome history bootstrap, archive filtering, live-visit capture, native Chrome history removal reconciliation, and extension-page actions that coordinate with background runtime messages.

Chrome API calls stay behind `src/platform/chrome/`; this feature decides whether a message is allowed and which platform/storage action should run.
