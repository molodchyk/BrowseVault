# Backup Import

Owns BrowseVault archive import/export actions, integrity metadata, import-preview display state, and restore-flow rendering.

The feature coordinates archive downloads, archive file reading, import preview staging, checksum verification, and backup metadata updates through injected services. IndexedDB storage primitives remain owned by the storage layer.
