/*
 * Prints every backed-up RSVP as CSV, newest last:
 *
 *   BLOB_READ_WRITE_TOKEN=... bun scripts/dump-rsvps.ts > rsvps.csv
 *
 * This exists so that recovering from a Notion outage is running a command,
 * not writing a script while a hundred guests wait. One row per seat, which
 * is the grain the Notion inbox uses too, so the output can be pasted
 * straight into a database as a CSV import.
 */

import { get, list } from "@vercel/blob";
import type { RsvpRecord } from "../src/lib/rsvp-backup";

const RSVP_BACKUP_PREFIX = "rsvps/";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("Set BLOB_READ_WRITE_TOKEN (vercel env pull) and try again.");
  process.exit(1);
}

/** Quotes a field for CSV. Names carry commas and the odd apostrophe. */
function cell(value: string | number | boolean | null): string {
  if (value === null) return "";
  return `"${String(value).replaceAll('"', '""')}"`;
}

const columns = [
  "submission",
  "submittedAt",
  "email",
  "seat",
  "name",
  "attending",
  "plusOne",
  "plusOneName",
];

const rows: Array<string> = [columns.join(",")];
let cursor: string | undefined;
let files = 0;

// Paginated because `list` caps at 1000 blobs per call, and a backup that
// silently stopped at the first page would be worse than no backup.
do {
  const page = await list({ prefix: RSVP_BACKUP_PREFIX, cursor, token });
  cursor = page.hasMore ? page.cursor : undefined;

  for (const blob of page.blobs) {
    const result = await get(blob.pathname, { access: "private", token });
    if (!result) {
      console.error(`Could not read ${blob.pathname}`);
      continue;
    }

    const record: RsvpRecord = JSON.parse(
      await new Response(result.stream).text(),
    );
    files += 1;

    record.seats.forEach((seat, index) => {
      rows.push(
        [
          cell(record.submission),
          cell(record.submittedAt),
          cell(record.email),
          cell(index + 1),
          cell(seat.name),
          cell(seat.attending ? "Yes" : "No"),
          cell(seat.plusOne),
          cell(seat.plusOneName),
        ].join(","),
      );
    });
  }
} while (cursor);

// Blob listing is roughly chronological, but sort by submittedAt so output is
// stable and strictly time-ordered.
const [header, ...body] = rows;
const submittedAtFromRow = (row: string): string =>
  row.match(/^"[^"]*","([^"]*)",/)?.[1] ?? "";
console.log(
  [
    header,
    ...body.sort(
      (a, b) =>
        submittedAtFromRow(a).localeCompare(submittedAtFromRow(b)) ||
        a.localeCompare(b),
    ),
  ].join("\n"),
);
console.error(`${files} submissions, ${body.length} seats`);
