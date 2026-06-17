import test from "node:test";
import assert from "node:assert/strict";
import {
  createAppNavigation,
  switchAppTab
} from "../../../src/features/app-shell/ui/navigation.js";

function classListHarness() {
  const classes = new Set();
  return {
    classes,
    toggle(name, force) {
      if (force) {
        classes.add(name);
        return true;
      }
      classes.delete(name);
      return false;
    }
  };
}

function tab(tabName) {
  return {
    classList: classListHarness(),
    dataset: {
      tab: tabName
    }
  };
}

function panel(panelName) {
  return {
    dataset: {
      panel: panelName
    },
    hidden: false
  };
}

test("switchAppTab marks the active tab and hides inactive panels", () => {
  const elements = {
    panels: [panel("history"), panel("settings")],
    tabs: [tab("history"), tab("settings")]
  };

  switchAppTab(elements, "settings");

  assert.equal(elements.tabs[0].classList.classes.has("is-active"), false);
  assert.equal(elements.tabs[1].classList.classes.has("is-active"), true);
  assert.equal(elements.panels[0].hidden, true);
  assert.equal(elements.panels[1].hidden, false);
});

test("focusSearchInput switches to history and selects the query", () => {
  const calls = [];
  const elements = {
    panels: [panel("history"), panel("settings")],
    query: {
      focus: () => calls.push("focus"),
      select: () => calls.push("select")
    },
    tabs: [tab("history"), tab("settings")]
  };
  const navigation = createAppNavigation({ elements });

  navigation.focusSearchInput();

  assert.equal(elements.tabs[0].classList.classes.has("is-active"), true);
  assert.deepEqual(calls, ["focus", "select"]);
});
