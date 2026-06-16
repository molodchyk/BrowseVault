import { chromeApi } from "./api.js";

export function onActionClicked(listener) {
  chromeApi().action.onClicked.addListener(listener);
}
