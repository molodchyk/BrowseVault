import { chromeApi } from "./api.js";

export function onCommand(listener) {
  chromeApi().commands?.onCommand.addListener(listener);
}
