const APP_URL = "src/app.html";

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    browseVaultInstalledAt: new Date().toISOString()
  });
});

chrome.action.onClicked.addListener(async () => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(APP_URL)
  });
});

