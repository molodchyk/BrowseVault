import test from "node:test";
import assert from "node:assert/strict";
import { createVaultManagementActionsHarness } from "./vault-management-actions-harness.js";

test("renderRules renders empty and removable rule states", async () => {
  const removed = [];
  let rules = [{ id: "rule-1", type: "blacklist", value: "example.com" }];
  const { actions, elements, statuses } = createVaultManagementActionsHarness({
    services: {
      getRules: async () => ({ rules, blacklist: ["example.com"], whitelist: [] }),
      removeRule: async (id) => {
        removed.push(id);
        rules = [];
      }
    }
  });

  await actions.renderRules();

  assert.equal(elements.rulesList.children[0].textContent, "Blacklist (1)");
  const item = elements.rulesList.children[1];
  assert.equal(item.className, "rule-item rule-item-blacklist");
  assert.deepEqual(item.children[0].children.map((child) => [child.className, child.textContent]), [
    ["rule-kind visually-hidden", "Blacklist rule"],
    ["rule-value", "example.com"]
  ]);
  assert.equal(item.children[1].textContent, "Remove");

  await item.children[1].listeners.click();

  assert.deepEqual(removed, ["rule-1"]);
  assert.deepEqual(statuses, ["Removed example.com"]);
  assert.equal(elements.rulesList.children[0].textContent, "No domain rules yet.");
});

test("renderRules renders category rule labels", async () => {
  const { actions, elements } = createVaultManagementActionsHarness({
    services: {
      getRules: async () => ({
        rules: [{ id: "category:example.com", type: "category", value: "example.com", category: "Research" }],
        blacklist: [],
        whitelist: [],
        categories: [{ id: "category:example.com", value: "example.com", category: "Research" }]
      })
    }
  });

  await actions.renderRules();

  assert.equal(elements.rulesList.children[0].textContent, "Category (1)");
  const label = elements.rulesList.children[1].children[0];
  assert.deepEqual(label.children.map((child) => [child.className, child.textContent]), [
    ["rule-kind visually-hidden", "Category rule"],
    ["rule-value", "example.com"],
    ["rule-detail", "Research"]
  ]);
});

test("renderRules groups rule types instead of repeating visible type labels", async () => {
  const { actions, elements } = createVaultManagementActionsHarness({
    services: {
      getRules: async () => ({
        rules: [
          { id: "whitelist:docs.example.com", type: "whitelist", value: "docs.example.com" },
          { id: "blacklist:ads.example.com", type: "blacklist", value: "ads.example.com" },
          { id: "category:example.com", type: "category", value: "example.com", category: "Research" }
        ],
        blacklist: ["ads.example.com"],
        whitelist: ["docs.example.com"],
        categories: [{ id: "category:example.com", value: "example.com", category: "Research" }]
      })
    }
  });

  await actions.renderRules();

  assert.deepEqual(elements.rulesList.children.map((child) => child.className), [
    "rule-group-heading",
    "rule-item rule-item-category",
    "rule-group-heading",
    "rule-item rule-item-blacklist",
    "rule-group-heading",
    "rule-item rule-item-whitelist"
  ]);
  assert.deepEqual([0, 2, 4].map((index) => elements.rulesList.children[index].textContent), [
    "Category (1)",
    "Blacklist (1)",
    "Whitelist (1)"
  ]);
});
