import test from "node:test";
import assert from "node:assert/strict";
import { appShellLocalization } from "../../../src/features/app-shell/ui/localization-map.js";
import { localizeAppShell } from "../../../src/features/app-shell/ui/localization.js";

function createFakeDocument() {
  const elements = new Map();
  const document = {
    documentElement: {
      dir: "",
      lang: ""
    },
    createTextNode(textContent) {
      return {
        nodeType: 3,
        textContent
      };
    },
    querySelector(selector) {
      if (!elements.has(selector)) {
        const element = {
          attributes: {},
          childNodes: [],
          firstChild: null,
          innerHTML: "",
          ownerDocument: document,
          textContent: "",
          insertBefore(node) {
            this.childNodes.unshift(node);
            this.firstChild = node;
          },
          setAttribute(name, value) {
            this.attributes[name] = value;
          }
        };
        elements.set(selector, element);
      }
      return elements.get(selector);
    }
  };

  return {
    document,
    elements
  };
}

test("localizeAppShell applies Chrome i18n messages to static app shell UI", () => {
  const requestedKeys = [];
  const { document, elements } = createFakeDocument();

  localizeAppShell({
    document,
    getMessage(key) {
      requestedKeys.push(key);
      return key === "@@ui_locale" ? "fa" : `localized:${key}`;
    }
  });

  assert.equal(document.documentElement.lang, "fa");
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(elements.get(".brand h1").textContent, "localized:appHeading");
  assert.equal(elements.get("#query").attributes.placeholder, "localized:searchQueryPlaceholder");
  assert.equal(elements.get(".stats-grid").attributes["aria-label"], "localized:vaultStatsLabel");
  assert.equal(elements.get(".advanced .hint").innerHTML, "localized:syntaxHintHtml");
  assert.equal(elements.get(".filters label:nth-child(1)").childNodes[0].textContent, "localized:filterDay ");

  for (const { key } of appShellLocalization) {
    assert.ok(requestedKeys.includes(key), `Expected localizer to request ${key}`);
  }
});
