function normalizedPageUrl(url) {
  return String(url || "").split(/[?#]/)[0];
}

function isSafeTabId(value) {
  return Number.isSafeInteger(value);
}

export function createExtensionPageOpener(actions, options) {
  const appUrl = normalizedPageUrl(options?.appUrl);

  async function openExtensionPage() {
    const tabs = await actions.queryTabs({ active: true, currentWindow: true });
    const activeAppTab = tabs.find((tab) =>
      isSafeTabId(tab?.id) && normalizedPageUrl(tab.url) === appUrl
    );

    if (activeAppTab) {
      if (isSafeTabId(activeAppTab.windowId)) {
        await actions.focusWindow(activeAppTab.windowId);
      }
      await actions.activateTab(activeAppTab.id);
      return {
        reused: true,
        tabId: activeAppTab.id,
        windowId: isSafeTabId(activeAppTab.windowId) ? activeAppTab.windowId : null
      };
    }

    const created = await actions.createTab({ url: appUrl });
    return {
      reused: false,
      tabId: isSafeTabId(created?.id) ? created.id : null
    };
  }

  return {
    openExtensionPage
  };
}
