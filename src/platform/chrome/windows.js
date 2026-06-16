import { chromeApi } from "./api.js";

export function focusWindow(windowId) {
  return chromeApi().windows.update(windowId, { focused: true });
}
