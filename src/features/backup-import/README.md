# Backup Import

Owns BrowseVault archive import/export actions, export download helpers, export filename rules, file parsing, import normalization, import planning, import summary logic, integrity metadata, import-preview display state, and restore-flow rendering.

The feature coordinates archive downloads, archive file reading, import preview staging, checksum verification, compatibility mapping for imported history files, and backup metadata updates through injected services. IndexedDB storage primitives remain owned by the storage layer.
