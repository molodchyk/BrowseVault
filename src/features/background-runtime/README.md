# Background Runtime

Owns background service-worker message routing, payload validation, and privileged action dispatch.

Chrome API calls stay behind `src/platform/chrome/`; this feature decides whether a message is allowed and which platform/storage action should run.
