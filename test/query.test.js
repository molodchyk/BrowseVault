import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesVisitQuery, parseQuery } from "../src/query.js";

const visit = {
  title: "Chrome Extension History Research",
  normalizedTitle: "chrome extension history research",
  url: "https://docs.github.com/en/apps",
  normalizedUrl: "https://docs.github.com/en/apps",
  domain: "docs.github.com",
  visitTime: Date.parse("2026-06-10T12:00:00Z"),
  visitCount: 12,
  transition: "typed",
  source: "chrome-history-live"
};

describe("parseQuery", () => {
  it("extracts fields, phrases, exclusions, and terms", () => {
    const query = parseQuery('history site:github.com title:extension url:docs source:chrome -ads "exact phrase"');

    assert.deepEqual(query.site, ["github.com"]);
    assert.deepEqual(query.title, ["extension"]);
    assert.deepEqual(query.url, ["docs"]);
    assert.deepEqual(query.source, ["chrome"]);
    assert.deepEqual(query.negatives, ["ads"]);
    assert.deepEqual(query.phrases, ["exact phrase"]);
    assert.deepEqual(query.terms, ["history"]);
  });

  it("normalizes host and domain filters", () => {
    assert.deepEqual(parseQuery("host:www.github.com").site, ["github.com"]);
    assert.deepEqual(parseQuery("domain:https://docs.github.com/en/apps").site, ["docs.github.com"]);
  });

  it("parses visit count filters", () => {
    assert.deepEqual(parseQuery("visits:>=10").visitCount, { min: 10, max: null });
    assert.deepEqual(parseQuery("count:<3").visitCount, { min: null, max: 2 });
    assert.deepEqual(parseQuery("visitcount:5..12").visitCount, { min: 5, max: 12 });
    assert.deepEqual(parseQuery("visits:7+").visitCount, { min: 7, max: null });
    assert.deepEqual(parseQuery("visits:4").visitCount, { min: 4, max: 4 });
  });

  it("parses local hour filters", () => {
    assert.deepEqual(parseQuery("hour:14").hour, { start: 14, end: 14 });
    assert.deepEqual(parseQuery("hour:9-17").hour, { start: 9, end: 17 });
    assert.deepEqual(parseQuery("hour:17..9").hour, { start: 9, end: 17 });
    assert.deepEqual(parseQuery("hour:24").hour, { start: null, end: null });
  });

  it("parses date filters and invalid regex safely", () => {
    const query = parseQuery("after:2026-06-01 before:2026-06-30 regex:[");

    assert.equal(query.after, new Date(2026, 5, 1).getTime());
    assert.equal(query.before, new Date(2026, 5, 31).getTime() - 1);
    assert.equal(query.regex, null);
  });

  it("ignores invalid after and before date boundaries", () => {
    const query = parseQuery("after:not-a-date before:2026-99-99");

    assert.equal(query.after, null);
    assert.equal(query.before, null);
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
    assert.equal(matchesVisitQuery(visit, parseQuery("history host:www.github.com")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("history domain:docs.github.com")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("history site:example.com")), false);
  });

  it("matches source, transition, and visit count filters", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("source:live transition:typed visits:>=10")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("source:import")), false);
    assert.equal(matchesVisitQuery(visit, parseQuery("transition:reload")), false);
    assert.equal(matchesVisitQuery(visit, parseQuery("visits:13+")), false);
    assert.equal(matchesVisitQuery(visit, parseQuery("count:10..12")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("visitcount:12")), true);
  });

  it("matches local hour filters", () => {
    const afternoonVisit = {
      ...visit,
      visitTime: new Date(2026, 5, 10, 14, 30).getTime()
    };

    assert.equal(matchesVisitQuery(afternoonVisit, parseQuery("hour:14")), true);
    assert.equal(matchesVisitQuery(afternoonVisit, parseQuery("hour:9-14")), true);
    assert.equal(matchesVisitQuery(afternoonVisit, parseQuery("hour:15")), false);
    assert.equal(matchesVisitQuery(afternoonVisit, parseQuery("hour:15-20")), false);
    assert.equal(matchesVisitQuery(afternoonVisit, parseQuery("hour:99")), true);
  });

  it("matches title, url, phrase, exclusion, and regex filters", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("title:extension url:docs")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery('"history research"')), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("history -github")), false);
    assert.equal(matchesVisitQuery(visit, parseQuery("regex:chrome.*history")), true);
  });

  it("matches longer keyword typos with bounded fuzzy fallback", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("histroy")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("githbu")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("researh")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("chromee")), true);
  });

  it("matches wildcard keyword and scoped filters", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("hist*")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("gith?b")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("title:extens* url:*apps")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("source:chrome-* transition:ty?ed")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("title:invoice*")), false);
  });

  it("supports wildcard exclusions without making wildcard-only tokens match everything", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("hist* -git*")), false);
    assert.equal(matchesVisitQuery(visit, parseQuery("hist* -*")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("*")), false);
  });

  it("keeps short keywords and exclusions exact", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("apqs")), false);
    assert.equal(matchesVisitQuery(visit, parseQuery("histroy -githbu")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("histroy -github")), false);
  });

  it("matches inclusive date ranges", () => {
    assert.equal(matchesVisitQuery(visit, parseQuery("after:2026-06-01 before:2026-06-10")), true);
    assert.equal(matchesVisitQuery(visit, parseQuery("after:2026-06-11")), false);
  });

  it("matches bare after and before dates as local calendar boundaries", () => {
    const startOfDay = {
      ...visit,
      visitTime: new Date(2026, 5, 10, 0, 0, 0, 0).getTime()
    };
    const endOfDay = {
      ...visit,
      visitTime: new Date(2026, 5, 10, 23, 59, 59, 999).getTime()
    };
    const nextDay = {
      ...visit,
      visitTime: new Date(2026, 5, 11, 0, 0, 0, 0).getTime()
    };

    assert.equal(matchesVisitQuery(startOfDay, parseQuery("after:2026-06-10")), true);
    assert.equal(matchesVisitQuery(endOfDay, parseQuery("before:2026-06-10")), true);
    assert.equal(matchesVisitQuery(nextDay, parseQuery("before:2026-06-10")), false);
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
