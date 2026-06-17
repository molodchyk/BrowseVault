function normalizedPageUrl(url) {
  return String(url || "").split(/[?#]/)[0];
}

function isSafeTabId(value) {
  return Number.isSafeInteger(value);
}

export function createExtensionPageOpener(actions, options) {
  const appUrl = normalizedPageUrl(options?.appUrl);

  async function openExtensionPage() {
    const tabs = await actions.queryTabs({});
    const existing = tabs.find((tab) =>
      isSafeTabId(tab?.id) && normalizedPageUrl(tab.url) === appUrl
    );

    if (existing) {
      if (isSafeTabId(existing.windowId)) {
        await actions.focusWindow(existing.windowId);
      }
      await actions.activateTab(existing.id);
      return {
        reused: true,
        tabId: existing.id,
        windowId: isSafeTabId(existing.windowId) ? existing.windowId : null
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
