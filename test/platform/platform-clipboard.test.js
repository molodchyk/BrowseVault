import test from "node:test";
import assert from "node:assert/strict";
import { copyText } from "../../src/platform/clipboard.js";

function createFallbackDocument({ copied = true, selectedRange = null } = {}) {
  const calls = [];
  const selection = selectedRange
    ? {
        rangeCount: 1,
        getRangeAt: (index) => {
          calls.push(["getRangeAt", index]);
          return selectedRange;
        },
        removeAllRanges: () => calls.push(["removeAllRanges"]),
        addRange: (range) => calls.push(["addRange", range])
      }
    : {
        rangeCount: 0
      };
  const textAreas = [];
  const document = {
    body: {
      append: (element) => calls.push(["append", element.value])
    },
    createElement: (tagName) => {
      const element = {
        style: {},
        value: "",
        remove: () => calls.push(["remove"]),
        select: () => calls.push(["select"]),
        setAttribute: (name, value) => calls.push(["setAttribute", name, value])
      };
      calls.push(["createElement", tagName]);
      textAreas.push(element);
      return element;
    },
    getSelection: () => selection
  };

  return {
    calls,
    document,
    execCommand: (command) => {
      calls.push(["execCommand", command]);
      return copied;
    },
    textAreas
  };
}

test("copyText prefers the async clipboard API", async () => {
  const calls = [];

  await copyText("https://example.com", {
    navigator: {
      clipboard: {
        writeText: async (text) => calls.push(["writeText", text])
      }
    }
  });

  assert.deepEqual(calls, [["writeText", "https://example.com"]]);
});

test("copyText falls back to a temporary textarea and restores selection", async () => {
  const selectedRange = { id: "range-1" };
  const fallback = createFallbackDocument({ selectedRange });

  await copyText("fallback text", {
    document: fallback.document,
    execCommand: fallback.execCommand,
    navigator: {
      clipboard: {
        writeText: async () => {
          throw new Error("blocked");
        }
      }
    }
  });

  assert.equal(fallback.textAreas[0].value, "fallback text");
  assert.deepEqual(fallback.calls, [
    ["getRangeAt", 0],
    ["createElement", "textarea"],
    ["setAttribute", "readonly", ""],
    ["append", "fallback text"],
    ["select"],
    ["execCommand", "copy"],
    ["remove"],
    ["removeAllRanges"],
    ["addRange", selectedRange]
  ]);
});

test("copyText reports empty values and failed fallback copies", async () => {
  await assert.rejects(() => copyText(""), /Nothing to copy/);

  const fallback = createFallbackDocument({ copied: false });

  await assert.rejects(() => copyText("text", {
    document: fallback.document,
    execCommand: fallback.execCommand,
    navigator: {}
  }), /Copy failed/);
});
