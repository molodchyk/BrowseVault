import { chromeApi } from "./api.js";

export function getChromeMessage(key, substitutions) {
  try {
    return chromeApi().i18n?.getMessage?.(key, substitutions) || "";
  } catch {
    return "";
  }
}
