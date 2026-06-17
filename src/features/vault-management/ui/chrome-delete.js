import { BACKGROUND_MESSAGE_TYPES } from "../../background-runtime/core/messages.js";

export async function deleteChromeUrls({ sendRuntimeMessage }, urls) {
  const response = await sendRuntimeMessage({
    type: BACKGROUND_MESSAGE_TYPES.DELETE_CHROME_URLS,
    urls
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Chrome deletion failed.");
  }
}
