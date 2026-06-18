# Activity Log Feature

Owns normalization and rendering for recent user-visible changes such as backup, export, import, cleanup, delete, restore, rule, and reset operations.

The log is stored in the existing metadata store under `activityLog` and capped so it remains a lightweight trust/status surface, not an analytics database.

Known activity labels are localized at render time so older stored events keep their stable stored data while the visible activity surface follows the extension locale.
