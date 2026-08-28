/*
 * A second home for RSVPs, written before the Notion call so a guest's answer
 * survives Notion being down, rate-limiting, renaming a property, or losing
 * its API key.
 *
 * Deliberately dumb: no schema, no migrations, one immutable JSON file per
 * submission. Recovery is `bun scripts/dump-rsvps.ts`, not new code written
 * under pressure.
 */

import { put } from "@vercel/blob";
import { BLOB_READ_WRITE_TOKEN } from "astro:env/server";
import type { Seat } from "./rsvp";

/** Everything the guest told us, plus what we need to match it up later. */
export interface RsvpRecord {
  /** Shared with the Notion rows from the same POST, so the two can be joined. */
  submission: string;
  submittedAt: string;
  email: string;
  seats: Array<Seat>;
}

export const RSVP_BACKUP_PREFIX = "rsvps/";

/**
 * One file per submission rather than appends to a shared log: Blob has no
 * atomic append, so two parties replying in the same second would race and
 * one would overwrite the other. The timestamp leads the name so listing the
 * prefix comes back in chronological order.
 */
function blobPath({ submittedAt, submission }: RsvpRecord): string {
  const stamp = submittedAt.replace(/[:.]/g, "-");
  return `${RSVP_BACKUP_PREFIX}${stamp}-${submission}.json`;
}

/**
 * Archives a submission. Never throws: a backup that can take down the RSVP
 * form would be worse than no backup at all, and the console log below is
 * already a recoverable record on its own.
 */
export async function backupRsvp(record: RsvpRecord): Promise<void> {
  // The full payload goes to the runtime log whether or not Blob is
  // configured. Vercel only keeps these for a matter of days, but that covers
  // the case this whole file exists for — noticing on Tuesday that Notion
  // broke on Monday — with no infrastructure at all.
  console.log("RSVP received", JSON.stringify(record));

  if (!BLOB_READ_WRITE_TOKEN) {
    console.warn("No BLOB_READ_WRITE_TOKEN — RSVP backed up to logs only");
    return;
  }

  const pathname = blobPath(record);

  try {
    await put(pathname, JSON.stringify(record, null, 2), {
      // Private, not public: these files carry guest names and email
      // addresses, and a public blob URL is guessable from the submission id.
      access: "private",
      token: BLOB_READ_WRITE_TOKEN,
      contentType: "application/json",
      // Without this the path gains a random suffix and stops being
      // derivable from the submission id.
      addRandomSuffix: false,
    });
  } catch (error) {
    console.error(
      `Failed to back up RSVP to Blob (submission=${record.submission}, path=${pathname}):`,
      error,
    );
  }
}
