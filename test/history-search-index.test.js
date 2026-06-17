import test from "node:test";
import assert from "node:assert/strict";
import { searchVisitRecords } from "../src/features/history-results/core/search-index.js";

function syntheticVisit(index, overrides = {}) {
  const title = index % 5 === 0 ? `History Research ${index}` : `Archive Page ${index}`;
  const url = index % 5 === 0
    ? `https://docs.example.com/history/${index}`
    : `https://example.com/archive/${index}`;

  return {
    id: `visit-${index}`,
    title,
    normalizedTitle: title.toLowerCase(),
    url,
    normalizedUrl: url.toLowerCase(),
    domain: new URL(url).hostname.replace(/^www\./, ""),
    visitTime: Date.parse("2026-06-17T12:00:00.000Z") - index * 1000,
    visitCount: (index % 10) + 1,
    transition: index % 2 === 0 ? "typed" : "link",
    source: "synthetic",
    ...overrides
  };
}

test("searchVisitRecords yields while scanning large synthetic history sets", async () => {
  const visits = Array.from({ length: 2505 }, (_value, index) => syntheticVisit(index));
  const yields = [];

  const result = await searchVisitRecords(visits, "histroy site:docs.example.com", {
    chunkSize: 500,
    limit: 7,
    scheduler: async () => {
      yields.push("yield");
    }
  });

  assert.equal(yields.length, 5);
  assert.equal(result.total, 501);
  assert.equal(result.results.length, 7);
  assert.deepEqual(
    result.results.map((visit) => visit.id),
    ["visit-0", "visit-5", "visit-10", "visit-15", "visit-20", "visit-25", "visit-30"]
  );
});

test("searchVisitRecords honors all-results requests after chunked filtering", async () => {
  const visits = Array.from({ length: 1200 }, (_value, index) => syntheticVisit(index));

  const result = await searchVisitRecords(visits, "transition:typed visits:>=5", {
    chunkSize: 250,
    limit: "all",
    scheduler: async () => {}
  });

  assert.equal(result.total, result.results.length);
  assert.ok(result.total > 0);
  assert.equal(result.results.every((visit) => visit.transition === "typed" && visit.visitCount >= 5), true);
});

test("searchVisitRecords returns all matches when no limit is supplied", async () => {
  const visits = Array.from({ length: 25 }, (_value, index) => syntheticVisit(index));

  const result = await searchVisitRecords(visits, "history", {
    chunkSize: 10,
    scheduler: async () => {}
  });

  assert.equal(result.total, 5);
  assert.equal(result.results.length, 5);
});
