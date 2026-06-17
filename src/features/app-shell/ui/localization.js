import { appShellLocalization } from "./localization-map.js";

const rtlLanguageCodes = new Set(["ar", "fa", "he", "ur"]);

function applyTextNode(element, value) {
  const textNode = [...element.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim());
  if (textNode) {
    textNode.textContent = `${value} `;
    return;
  }

  element.insertBefore(element.ownerDocument.createTextNode(`${value} `), element.firstChild);
}

function applyLocalizedValue(element, target, value) {
  if (target === "aria-label") {
    element.setAttribute("aria-label", value);
    return;
  }

  if (target === "placeholder") {
    element.setAttribute("placeholder", value);
    return;
  }

  if (target === "title") {
    element.setAttribute("title", value);
    return;
  }

  if (target === "html") {
    element.innerHTML = value;
    return;
  }

  if (target === "label-text") {
    applyTextNode(element, value);
    return;
  }

  element.textContent = value;
}

function applyDocumentLocale(document, getMessage) {
  const locale = getMessage("@@ui_locale") || "en";
  const htmlLocale = locale.replaceAll("_", "-");
  const language = htmlLocale.split("-")[0];

  document.documentElement.lang = htmlLocale;
  document.documentElement.dir = rtlLanguageCodes.has(language) ? "rtl" : "ltr";
}

export function localizeAppShell({ document, getMessage }) {
  applyDocumentLocale(document, getMessage);

  for (const { selector, target, key } of appShellLocalization) {
    const value = getMessage(key);
    if (!value) {
      continue;
    }

    const element = document.querySelector(selector);
    if (element) {
      applyLocalizedValue(element, target, value);
    }
  }
}
