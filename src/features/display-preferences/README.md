# Display Preferences

Owns display settings, result-limit normalization, display formatting, archive health/status summaries, backup reminder cadence, backup filename preferences, settings persistence orchestration, and extension-page preference/stat rendering.

Core modules stay free of `chrome`, `window`, and `document` dependencies. UI modules coordinate extension-page elements and storage through injected services or platform wrappers so they remain testable outside the browser.
