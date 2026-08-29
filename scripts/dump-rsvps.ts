/*
 * Prints every backed-up RSVP as CSV, newest last:
 *
 *   vercel env pull            # BLOB_STORE_ID + VERCEL_OIDC_TOKEN
 *   bun --env-file=.env.local scripts/dump-rsvps.ts > rsvps.csv
 *
 * This exists so that recovering from a Notion outage is running a command,
 * not writing a script while a hundred guests wait. One row per seat, which
 * is the grain the Notion inbox uses too, so the output can be pasted
 * straight into a database as a CSV import.
 *
 * On credentials: linking a Blob store injects `BLOB_STORE_ID`, and the SDK
 * pairs it with an ambient OIDC token — no read-write token is created. But
 * `vercel env pull` mints a *development*-scoped OIDC token, and a store only
 * honours the environments enabled for the project, so running this from a
 * laptop needs one of:
 *
 *   - Development enabled under Project Settings -> Secure Backend Access, or
 *   - BLOB_READ_WRITE_TOKEN, created by hand in the Blob store dashboard.
 *
 * Neither is needed anywhere Vercel supplies its own OIDC token.
 */

import { get, list } from "@vercel/blob";
import type { RsvpRecord } from "../src/lib/rsvp-backup";

const RSVP_BACKUP_PREFIX = "rsvps/";

// Omitted rather than set to undefined: to the SDK those differ, and passing
// an empty token would shadow the OIDC path instead of falling back to it.
const token = process.env.BLOB_READ_WRITE_TOKEN;
const auth = token ? { token } : {};

if (!token && !process.env.BLOB_STORE_ID) {
  console.error(
    "No Blob credentials. Run `vercel env pull` for BLOB_STORE_ID and an " +
      "OIDC token, or set BLOB_READ_WRITE_TOKEN from the Blob dashboard.",
  );
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

const records: Array<RsvpRecord> = [];
let cursor: string | undefined;

// Paginated because `list` caps at 1000 blobs per call, and a backup that
// silently stopped at the first page would be worse than no backup.
do {
  const page = await list({ prefix: RSVP_BACKUP_PREFIX, cursor, ...auth });
  cursor = page.hasMore ? page.cursor : undefined;

  for (const blob of page.blobs) {
    const result = await get(blob.pathname, { access: "private", ...auth });
    if (!result) {
      console.error(`Could not read ${blob.pathname}`);
      continue;
    }

    records.push(JSON.parse(await new Response(result.stream).text()));
  }
} while (cursor);

// Sorted as records, before they become text. Sorting the rendered rows
// instead would order the seat column as a string, putting seat 10 ahead of
// seat 2 in any party large enough to have one.
records.sort(
  (a, b) =>
    a.submittedAt.localeCompare(b.submittedAt) ||
    a.submission.localeCompare(b.submission),
);

const rows = records.flatMap((record) =>
  record.seats.map((seat, index) =>
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
  ),
);

console.log([columns.join(","), ...rows].join("\n"));
console.error(`${records.length} submissions, ${rows.length} seats`);
