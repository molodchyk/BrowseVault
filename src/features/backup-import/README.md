# Backup Import

Owns BrowseVault archive import/export actions, export filename rules, file parsing, import normalization, integrity metadata, import-preview display state, and restore-flow rendering.

The feature coordinates archive downloads, archive file reading, import preview staging, checksum verification, compatibility mapping for imported history files, and backup metadata updates through injected services. IndexedDB storage primitives remain owned by the storage layer.
