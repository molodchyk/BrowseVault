function ruleDisplayType(rule) {
  if (rule?.type === "blacklist") {
    return "Blacklist";
  }
  if (rule?.type === "whitelist") {
    return "Whitelist";
  }
  if (rule?.type === "category") {
    return "Category";
  }
  return "Rule";
}

export function renderRuleList({ document, rules, rulesList, onRemove }) {
  rulesList.replaceChildren();

  if (!rules.length) {
    const empty = document.createElement("li");
    empty.className = "rule-item";
    empty.textContent = "No domain rules yet.";
    rulesList.append(empty);
    return;
  }

  for (const rule of rules) {
    const item = document.createElement("li");
    item.className = `rule-item rule-item-${rule.type}`;

    const label = document.createElement("span");
    label.className = "rule-label";

    const type = document.createElement("span");
    type.className = "rule-pill";
    type.textContent = ruleDisplayType(rule);

    const value = document.createElement("span");
    value.className = "rule-value";
    value.textContent = rule.value;

    label.append(type, value);
    if (rule.type === "category" && rule.category) {
      const category = document.createElement("span");
      category.className = "rule-detail";
      category.textContent = rule.category;
      label.append(category);
    }

    const remove = document.createElement("button");
    remove.className = "ghost";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => onRemove(rule));

    item.append(label, remove);
    rulesList.append(item);
  }
}
