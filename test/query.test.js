import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesVisitQuery, parseQuery } from "../src/query.js";

const visit = {
  title: "Chrome Extension History Research",
  normalizedTitle: "chrome extension history research",
  url: "https://docs.github.com/en/apps",
  normalizedUrl: "https://docs.github.com/en/apps",
  domain: "docs.github.com",
  visitTime: Date.parse("2026-06-10T12:00:00Z")
};

describe("parseQuery", () => {
  it("extracts fields, phrases, exclusions, and terms", () => {
    const query = parseQuery('history site:github.com title:extension url:docs -ads "exact phrase"');

    assert.deepEqual(query.site, ["github.com"]);
    assert.deepEqual(query.title, ["extension"]);
    assert.deepEqual(query.url, ["docs"]);
    assert.deepEqual(query.negatives, ["ads"]);
    assert.deepEqual(query.phrases, ["exact phrase"]);
    assert.deepEqual(query.terms, ["history"]);
  });

  it("parses date filters and invalid regex safely", () => {
    const query = parseQuery("after:2026-06-01 before:2026-06-30 regex:[");

    assert.equal(query.after, Date.parse("2026-06-01"));
    assert.equal(query.before, Date.parse("2026-06-30"));
    assert.equal(query.regex, null);
  });

  it("parses exact day aliases as local calendar ranges", () => {
    const query = parseQuery("date:2026-06-10 day:2026-06-11 on:not-a-date");

    assert.equal(query.dateStart, new Date(2026, 5, 11).getTime());
    assert.equal(query.dateEnd, new Date(2026, 5, 12).getTime() - 1);
  });
});

describe("matchesVisitQuery", () => {
  it("matches keyword and site filters", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("history site:github.com")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("history site:example.com")), false);
  });

  it("matches title, url, phrase, exclusion, and regex filters", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("title:extension url:docs")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery('"history research"')), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("history -github")), false);
    assert.equal(matchesVisitQuery(visit, parseQuery("regex:chrome.*history")), true);
  });

  it("matches inclusive date ranges", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("after:2026-06-01 before:2026-06-10")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("after:2026-06-11")), false);
  });

  it("matches exact local calendar days", () => {
    const morningVisit = {
      ...visit,
      visitTime: new Date(2026, 5, 10, 8, 30).getTime()
    };
    const nextDayVisit = {
      ...visit,
      visitTime: new Date(2026, 5, 11, 0, 1).getTime()
    };

    assert.equal(matchesVisitQuery(morningVisit, parseQuery("date:2026-06-10")), true);
    assert.equal(matchesVisitQuery(nextDayVisit, parseQuery("date:2026-06-10")), false);
  });

  it("supports CJK substring matching", () => {
    const cjkVisit = {
      ...visit,
      title: "浏览器历史记录",
      normalizedTitle: "浏览器历史记录",
      url: "https://example.com/cjk",
      normalizedUrl: "https://example.com/cjk",
      domain: "example.com"
    };

    assert.equal(matchesVisitQuery(cjkVisit, parseQuery("历史")), true);
  });
});
