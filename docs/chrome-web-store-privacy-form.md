StorePilot dashboard helper only. The extension's default public privacy policy remains `../PRIVACY.md`.
Data usage answers describe data collected from users by the developer. BrowseVault handles browser history locally in the user's browser profile, but does not transmit or collect that history from users.

[privacy]
single_purpose:
BrowseVault provides a local-first browser history vault for searching, preserving, backing up, exporting, and explicitly cleaning browsing history, plus Quick Open access to tabs, bookmarks, downloads, recently closed tabs, and closed windows.

permission.bookmarks:
Used only for Quick Open bookmark search. BrowseVault reads bookmark titles and URLs locally so users can find and reopen saved pages.

permission.downloads:
Used for Quick Open download search and user-requested backup/export file saving. BrowseVault reads local download metadata such as filenames, source URLs, and timestamps; it does not read downloaded file contents. When the user selects ask-every-export save mode, BrowseVault uses Chrome's downloads API to show a Save As prompt for generated files.

permission.history:
Used to sync available Chrome history into the local BrowseVault archive, capture new visits, search history, and delete selected or current-result URLs from Chrome history only when the user chooses that action.

permission.sessions:
Used only to show and restore recently closed tabs and windows in Quick Open.

permission.storage:
Used to save local extension preferences and UI state in Chrome storage.

permission.tabs:
Used to list open tabs for Quick Open, switch to selected tabs, open URLs from results, and open the BrowseVault app from the extension action or keyboard command.

host_permission:
No host permissions are requested.

remote_code:
no

privacy_policy_url:
https://github.com/molodchyk/BrowseVault/blob/main/PRIVACY.md

data_usage.personally_identifiable_information:
no

data_usage.health_information:
no

data_usage.financial_payment_information:
no

data_usage.authentication_information:
no

data_usage.personal_communications:
no

data_usage.location:
no

data_usage.web_history:
no

data_usage.user_activity:
no

data_usage.website_content:
no

certification.no_sell_or_transfer:
yes

certification.no_unrelated_use:
yes

certification.no_creditworthiness:
yes
