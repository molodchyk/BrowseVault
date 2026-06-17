# Vault Management

Owns extension-page actions for selected-record vault deletion, current-result vault deletion, Chrome-history deletion requests, undo, reset, domain archive/category rules, rule normalization, vault record normalization, category decoration, vault health/insight summaries, export ordering, manual retention cleanup, and duplicate cleanup.

The feature coordinates storage mutations and privileged background messages through explicit services. Storage primitives remain owned by the storage layer, and Chrome API access remains behind platform/background-runtime boundaries.
