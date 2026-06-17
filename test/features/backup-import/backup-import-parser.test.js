import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveFromFileText,
  delimitedArchiveFromText,
  parseDelimitedRows
} from "../../../src/features/backup-import/core/archive-parser.js";

test("parseDelimitedRows handles quoted delimiters, escaped quotes, and CRLF", () => {
  assert.deepEqual(
    parseDelimitedRows('title,url\r\n"Report, Q2","https://example.com/a"\r\n"He said ""hi""","https://example.com/b"\r\n', ","),
    [
      ["title", "url"],
      ["Report, Q2", "https://example.com/a"],
      ['He said "hi"', "https://example.com/b"]
    ]
  );
});

test("delimitedArchiveFromText maps CSV columns into import visits", () => {
  const archive = delimitedArchiveFromText(
    [
      "Visit ID,Chrome ID,Title,URL,Visit Timestamp MS,Visit Count,Transition",
      'v1,c1,"Report, Q2",https://example.com/report,1780000000000,3,typed',
      "missing-url,c2,No URL,,1780000000001,1,link"
    ].join("\n"),
    ",",
    "csv-import"
  );

  assert.equal(archive.app, "csv-import");
  assert.equal(archive.schemaVersion, 1);
  assert.deepEqual(archive.visits, [
    {
      id: "v1",
      chromeId: "c1",
      url: "https://example.com/report",
      title: "Report, Q2",
      visitTime: "1780000000000",
      lastVisitTime: "",
      visitCount: "3",
      typedCount: 0,
      transition: "typed",
      source: "csv-import"
    },
    {
      id: "missing-url",
      chromeId: "c2",
      url: "",
      title: "No URL",
      visitTime: "1780000000001",
      lastVisitTime: "",
      visitCount: "1",
      typedCount: 0,
      transition: "link",
      source: "csv-import"
    }
  ]);
});

test("delimitedArchiveFromText maps common competitor headers and drops untitled placeholders", () => {
  const archive = delimitedArchiveFromText(
    [
      "Page Title,Address,Last Visit Time,Visit Count,Page Transition",
      "untitle,https://history-plus.example/page,2026-06-16T12:00:00.000Z,7,link",
      "Better Report,https://better.example/report,2026-06-15 08:30:00,2,typed"
    ].join("\n"),
    ",",
    "competitor-csv-import"
  );

  assert.deepEqual(archive.visits.map((visit) => ({
    url: visit.url,
    title: visit.title,
    visitTime: visit.visitTime,
    lastVisitTime: visit.lastVisitTime,
    visitCount: visit.visitCount,
    transition: visit.transition,
    source: visit.source
  })), [
    {
      url: "https://history-plus.example/page",
      title: "",
      visitTime: "2026-06-16T12:00:00.000Z",
      lastVisitTime: "2026-06-16T12:00:00.000Z",
      visitCount: "7",
      transition: "link",
      source: "competitor-csv-import"
    },
    {
      url: "https://better.example/report",
      title: "Better Report",
      visitTime: "2026-06-15 08:30:00",
      lastVisitTime: "2026-06-15 08:30:00",
      visitCount: "2",
      transition: "typed",
      source: "competitor-csv-import"
    }
  ]);
});

test("archiveFromFileText dispatches CSV, TSV, and JSON archive text", () => {
  const csv = archiveFromFileText(
    { name: "history.csv" },
    "Title,Link,Date\nCSV Page,https://csv.example,2026-06-16"
  );
  const tsv = archiveFromFileText(
    { name: "history.tsv" },
    "Name\tURI\tTimestamp\nTSV Page\thttps://tsv.example\t2026-06-16"
  );
  const json = archiveFromFileText(
    { name: "history.json" },
    '{"app":"json-fixture","schemaVersion":1,"visits":[]}'
  );

  assert.equal(csv.app, "csv-import");
  assert.equal(csv.visits[0].url, "https://csv.example");
  assert.equal(tsv.app, "tsv-import");
  assert.equal(tsv.visits[0].url, "https://tsv.example");
  assert.equal(json.app, "json-fixture");
});
