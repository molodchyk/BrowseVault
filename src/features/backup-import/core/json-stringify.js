const DEFAULT_JSON_CHUNK_SIZE = 1000;

export function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalizeChunkSize(value) {
  const chunkSize = Number(value || DEFAULT_JSON_CHUNK_SIZE);
  return Number.isInteger(chunkSize) && chunkSize > 0 ? chunkSize : DEFAULT_JSON_CHUNK_SIZE;
}

function spaceText(space) {
  if (typeof space === "number") {
    return " ".repeat(Math.min(10, Math.max(0, Math.floor(space))));
  }

  if (typeof space === "string") {
    return space.slice(0, 10);
  }

  return "";
}

function primitiveJson(value, inArray) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "bigint") {
    throw new TypeError("Do not know how to serialize a BigInt");
  }

  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return inArray ? "null" : undefined;
  }

  return null;
}

export async function stringifyJson(value, options = {}) {
  const gap = spaceText(options.space);
  const chunkSize = normalizeChunkSize(options.chunkSize);
  const scheduler = options.scheduler || yieldToEventLoop;
  const seen = new Set();
  let processed = 0;

  async function maybeYield() {
    processed += 1;
    if (processed % chunkSize === 0) {
      await scheduler();
    }
  }

  async function serialize(input, depth, inArray) {
    const primitive = primitiveJson(input, inArray);
    if (primitive !== null) {
      return primitive;
    }

    const valueToSerialize = typeof input?.toJSON === "function"
      ? input.toJSON()
      : input;
    if (valueToSerialize !== input) {
      return serialize(valueToSerialize, depth, inArray);
    }

    if (!input || typeof input !== "object") {
      return undefined;
    }

    if (seen.has(input)) {
      throw new TypeError("Converting circular structure to JSON");
    }

    seen.add(input);
    const currentIndent = gap.repeat(depth);
    const childIndent = gap.repeat(depth + 1);

    if (Array.isArray(input)) {
      const values = [];
      for (let index = 0; index < input.length; index += 1) {
        const serialized = await serialize(input[index], depth + 1, true);
        values.push(gap ? `${childIndent}${serialized ?? "null"}` : serialized ?? "null");
        await maybeYield();
      }
      seen.delete(input);

      if (!values.length) {
        return "[]";
      }

      return gap
        ? `[\n${values.join(",\n")}\n${currentIndent}]`
        : `[${values.join(",")}]`;
    }

    const entries = [];
    for (const key of Object.keys(input)) {
      const serialized = await serialize(input[key], depth + 1, false);
      if (serialized !== undefined) {
        entries.push(gap
          ? `${childIndent}${JSON.stringify(key)}: ${serialized}`
          : `${JSON.stringify(key)}:${serialized}`);
      }
      await maybeYield();
    }
    seen.delete(input);

    if (!entries.length) {
      return "{}";
    }

    return gap
      ? `{\n${entries.join(",\n")}\n${currentIndent}}`
      : `{${entries.join(",")}}`;
  }

  return serialize(value, 0, false);
}
