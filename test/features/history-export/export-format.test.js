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
      visitTime,
      visitCount: 3,
      transition: "typed",
      source: "fixture"
    }
  ]);

  const [header, row] = csv.split("\n");

  assert.equal(
    header,
    "visitId,visitTimeIso,visitDate,visitTimeLocal,visitTimestampMs,domain,title,url,visitCount,transition,source,chromeId"
  );
  assert.match(row, /^visit-1,2026-06-16T12:34:56\.000Z,/);
  assert.match(row, new RegExp(`,${visitTime},example\\.com,`));
  assert.match(row, /,"Report, Q2",https:\/\/example\.com\/report,3,typed,fixture,chrome\|1$/);
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

  assert.match(html, /BrowseVault Export/);
  assert.match(html, /Report &quot;Q2&quot; &lt;draft&gt;/);
  assert.match(html, /https:\/\/example\.com\/\?q=&lt;script&gt;/);
  assert.doesNotMatch(html, /<draft>/);
  assert.doesNotMatch(html, /<script>/);
});
