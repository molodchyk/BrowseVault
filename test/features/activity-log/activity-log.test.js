import test from "node:test";
import assert from "node:assert/strict";
import {
  activityEventSummary,
  normalizeActivityEvent,
  normalizeActivityLog
} from "../../../src/features/activity-log/core/activity-log.js";
import { renderActivityLog } from "../../../src/features/activity-log/ui/render-activity-log.js";

function fakeElement(tagName = "div") {
  return {
    tagName,
    children: [],
    className: "",
    textContent: "",
    append(...children) {
      this.children.push(...children);
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

test("activity events normalize, sort, deduplicate, and summarize", () => {
  const now = new Date("2026-06-17T12:00:00.000Z");
  const event = normalizeActivityEvent({
    type: " DELETE ",
    label: " Vault records deleted ",
    detail: " docs site:example.com ".repeat(20),
    count: "3",
    occurredAt: "2026-06-16T12:00:00.000Z"
  }, now);

  assert.equal(event.type, "delete");
  assert.equal(event.label, "Vault records deleted");
  assert.equal(event.count, 3);
  assert.equal(event.occurredAt, "2026-06-16T12:00:00.000Z");
  assert.equal(activityEventSummary(event).startsWith("Vault records deleted (3) - docs site:example.com"), true);

  const normalized = normalizeActivityLog([
    { ...event, id: "same", occurredAt: "2026-06-15T00:00:00.000Z" },
    { ...event, id: "newer", occurredAt: "2026-06-17T00:00:00.000Z" },
    { ...event, id: "same", occurredAt: "2026-06-16T00:00:00.000Z" }
  ]);

  assert.deepEqual(normalized.map((item) => item.id), ["newer", "same"]);
});

test("renderActivityLog shows empty and populated states", () => {
  const list = fakeList();
  const document = {
    createElement: fakeElement
  };

  renderActivityLog(list, [], { document });
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].className, "activity-item is-empty");
  assert.equal(list.children[0].textContent, "No activity logged yet.");

  renderActivityLog(list, [
    {
      id: "import-1",
      type: "import",
      label: "Archive imported",
      count: 12,
      detail: "2 rules",
      occurredAt: "2026-06-17T10:00:00.000Z"
    }
  ], {
    document,
    formatDate: () => "2026-06-17 10:00"
  });

  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].className, "activity-item");
  assert.equal(list.children[0].children[0].textContent, "Archive imported (12) - 2 rules");
  assert.equal(list.children[0].children[1].textContent, "2026-06-17 10:00");
});
