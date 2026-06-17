import test from "node:test";
import assert from "node:assert/strict";
import { visitsToCsv, visitsToHtml } from "../../../src/export-format.js";

test("visitsToCsv includes spreadsheet-friendly date/time and identity columns", () => {
  const visitTime = Date.parse("2026-06-16T12:34:56Z");
  const csv = visitsToCsv([
    {
      id: "visit-1",
      chromeId: "chrome|1",
      url: "https://example.com/report",
      title: "Report, Q2",
      domain: "example.com",
      category: "Research",
      visitTime,
      visitCount: 3,
      transition: "typed",
      source: "fixture"
    }
  ]);

  const [header, row] = csv.split("\n");

  assert.equal(
    header,
    "visitId,visitTimeIso,visitDate,visitTimeLocal,visitTimestampMs,domain,category,title,url,visitCount,transition,source,chromeId"
  );
  assert.match(row, /^visit-1,2026-06-16T12:34:56\.000Z,/);
  assert.match(row, new RegExp(`,${visitTime},example\\.com,Research,`));
  assert.match(row, /,"Report, Q2",https:\/\/example\.com\/report,3,typed,fixture,chrome\|1$/);
});

test("visitsToCsv does not throw on malformed timestamps", () => {
  const csv = visitsToCsv([
    {
      id: "visit-1",
      chromeId: "chrome|1",
      url: "https://example.com/report",
      title: "Report",
      domain: "example.com",
      visitTime: "not-a-date",
      visitCount: 1,
      transition: "link",
      source: "fixture"
    }
  ]);

  const [, row] = csv.split("\n");
  assert.match(row, /^visit-1,,,,not-a-date,example\.com,,Report,/);
});

test("visitsToCsv neutralizes spreadsheet formulas in exported text", () => {
  const csv = visitsToCsv([
    {
      id: "=visit-1",
      chromeId: "@chrome",
      url: "https://example.com/report",
      title: "=HYPERLINK(\"https://evil.example\",\"open\")",
      domain: "+example.com",
      visitTime: Date.parse("2026-06-16T12:34:56Z"),
      visitCount: 1,
      transition: "-typed",
      source: " @import"
    }
  ]);

  const [, row] = csv.split("\n");

  assert.match(row, /^'=visit-1,/);
  assert.match(row, /,'\+example\.com,/);
  assert.match(row, /,"'=HYPERLINK\(""https:\/\/evil\.example"",""open""\)",/);
  assert.match(row, /,'-typed,' @import,'@chrome$/);
});

test("visitsToHtml escapes visit fields", () => {
  const html = visitsToHtml(
    [
      {
        id: "visit-1",
        url: "https://example.com/?q=<script>",
        title: 'Report "Q2" <draft>',
        domain: "example.com",
        visitTime: Date.parse("2026-06-16T12:34:56Z"),
        source: "fixture"
      }
    ],
    "2026-06-16T12:35:00.000Z"
  );

  assert.match(html, /BrowseVault History Export/);
  assert.match(html, /Report &quot;Q2&quot; &lt;draft&gt;/);
  assert.match(html, /https:\/\/example\.com\/\?q=&lt;script&gt;/);
  assert.doesNotMatch(html, /<draft>/);
  assert.doesNotMatch(html, /q=<script>/);
});

test("visitsToHtml creates a filterable sortable audit report", () => {
  const visitTime = Date.parse("2026-06-16T12:34:56Z");
  const html = visitsToHtml(
    [
      {
        id: "visit-1",
        chromeId: "chrome|1",
        url: "https://example.com/report",
      title: "Report",
      domain: "example.com",
      category: "Research",
      visitTime,
        visitCount: 3,
        transition: "typed",
        source: "fixture"
      }
    ],
    "2026-06-16T12:35:00.000Z"
  );

  assert.match(html, /id="report-filter"/);
  assert.match(html, /data-sort-type="number">Visited/);
  assert.match(html, /data-label="Category" data-sort="Research">Research<\/td>/);
  assert.match(html, /2026-06-16T12:34:56\.000Z/);
  assert.match(html, new RegExp(`data-sort="${visitTime}"`));
  assert.match(html, /data-label="Visits" data-sort="3">3<\/td>/);
  assert.match(html, /Click a column heading to sort/);
});

test("visitsToHtml disables unsupported link schemes", () => {
  const html = visitsToHtml(
    [
      {
        id: "visit-1",
        chromeId: "chrome|1",
        url: "javascript:alert(1)",
        title: "Script URL",
        domain: "example.com",
        visitTime: Date.parse("2026-06-16T12:34:56Z"),
        visitCount: 1,
        transition: "link",
        source: "fixture"
      }
    ],
    "2026-06-16T12:35:00.000Z"
  );

  assert.match(html, /Link disabled for unsupported URL scheme/);
  assert.doesNotMatch(html, /href="javascript:/i);
});
