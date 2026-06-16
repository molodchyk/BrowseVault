import { chromeApi } from "./api.js";

export function getExtensionUrl(path) {
  return chromeApi().runtime.getURL(path);
}

export function onInstalled(listener) {
  chromeApi().runtime.onInstalled.addListener(listener);
}

export function onStartup(listener) {
  chromeApi().runtime.onStartup.addListener(listener);
}

export function onRuntimeMessage(listener) {
  chromeApi().runtime.onMessage.addListener(listener);
}

export function sendRuntimeMessage(message) {
  return chromeApi().runtime.sendMessage(message);
}
