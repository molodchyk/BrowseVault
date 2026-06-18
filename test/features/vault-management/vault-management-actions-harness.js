import { createVaultManagementActions } from "../../../src/features/vault-management/ui/actions.js";

export function fakeElement(tagName = "div") {
  return {
    tagName,
    children: [],
    className: "",
    listeners: {},
    textContent: "",
    type: "",
    append(...children) {
      this.children.push(...children);
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
  };
}

function fakeList() {
  return {
    children: [],
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = [...children];
    }
  };
}

function fakeDocument() {
  return {
    createElement: fakeElement
  };
}

export function createVaultManagementActionsHarness({
  getMessage = () => "",
  getSearchText = () => "docs site:example.com",
  selectedIds = [],
  selected = [],
  services = {}
} = {}) {
  const statuses = [];
  const calls = [];
  const notifications = [];
  const appState = {
    currentResults: [{ id: "visible" }],
    currentTotal: 1,
    selectedIds: new Set(selectedIds)
  };
  const elements = {
    quickResults: fakeList(),
    retentionDays: { value: "30" },
    ruleCategory: { value: "Research" },
    ruleDomain: { value: "example.com" },
    rulesList: fakeList()
  };
  const actions = createVaultManagementActions({
    appState,
    elements,
    getMessage,
    getSearchText,
    notifyVaultChanged: (reason) => notifications.push(reason),
    refreshStats: async () => calls.push("refreshStats"),
    runSearch: async () => calls.push("runSearch"),
    searchVisits: async () => ({ results: [], total: 0 }),
    selectedResults: async () => selected,
    services: {
      appendActivityLog: async () => {},
      confirmAction: () => true,
      document: fakeDocument(),
      getRules: async () => ({ rules: [], blacklist: [], whitelist: [], categories: [] }),
      ...services
    },
    setStatus: (message) => statuses.push(message)
  });

  return { actions, appState, calls, elements, notifications, statuses };
}
