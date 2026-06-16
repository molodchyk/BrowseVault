export function chromeApi() {
  if (!globalThis.chrome) {
    throw new Error("Chrome extension API is unavailable.");
  }

  return globalThis.chrome;
}
