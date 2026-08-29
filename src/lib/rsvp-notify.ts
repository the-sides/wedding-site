/*
 * A nudge to the couple's Discord the moment an RSVP lands, so a reply is
 * noticed the same evening rather than the next time someone opens Notion.
 *
 * This is a webhook, not a bot. A bot holds an open gateway socket and
 * reacts to events; nothing here runs between requests to hold one. A webhook
 * is the inverse — Discord hands out a URL bound to one channel and we POST
 * to it — which is all a "tell us when someone replies" ping needs.
 *
 * Like the backup, it is best-effort: a Discord outage must never cost a
 * guest their answer, and the record is already safe in Blob and the logs by
 * the time this runs.
 */

import {
  DISCORD_RSVP_WEBHOOK_URL,
  DISCORD_RSVP_MENTION,
} from "astro:env/server";
import type { RsvpRecord } from "./rsvp-backup";
import type { Seat } from "./rsvp";

/**
 * How long to wait on Discord before giving up.
 *
 * Shorter than the Blob timeout because the stakes are lower: a missed backup
 * loses a record, a missed ping loses a notification for a submission that is
 * already stored twice over. The guest is still waiting on this response, so
 * a sick Discord costs them three seconds, not thirty.
 */
const DISCORD_TIMEOUT_MS = 3_000;

/** Discord's own cap on an embed description. Well clear of ten seats. */
const MAX_DESCRIPTION = 4096;

/** Green for a reply that reached Notion, red for one that did not. */
const COLOR_SAVED = 0x4c9a6b;
const COLOR_FAILED = 0xb4453c;

/**
 * Neutralises Discord's markdown in guest-supplied text. Without this a name
 * containing `_` or `*` silently reformats the message, and one containing a
 * link would render as one.
 */
function escapeMarkdown(value: string): string {
  return value.replace(/([\\*_~`|>#\-[\]()])/g, "\\$1");
}

/** One line per seat: who they are, whether they're in, and any +1. */
function seatLine(seat: Seat): string {
  const mark = seat.attending ? "✅" : "❌";
  const name = escapeMarkdown(seat.name);

  if (!seat.plusOne) return `${mark} ${name}`;

  // A +1 is a request, not a confirmed guest — the couple still has to say
  // yes — so it reads as a request here rather than as another accepted seat.
  return `${mark} ${name} — **+1 requested:** ${escapeMarkdown(
    seat.plusOneName ?? "unnamed",
  )}`;
}

function describe(record: RsvpRecord, saved: boolean): string {
  const lines = record.seats.map(seatLine);

  if (!saved) {
    lines.push(
      "",
      "⚠️ **This reply failed to save to Notion.** It is in the Blob " +
        "backup and the runtime logs — see `AGENTS.md` to recover it.",
    );
  }

  return lines.join("\n").slice(0, MAX_DESCRIPTION);
}

function summarise(seats: ReadonlyArray<Seat>): string {
  const yes = seats.filter((seat) => seat.attending).length;
  const no = seats.length - yes;

  const parts = [];
  if (yes) parts.push(`${yes} attending`);
  if (no) parts.push(`${no} declined`);

  return parts.join(", ");
}

/**
 * Announces a submission in Discord. Never throws and never stalls — a
 * notifier that can take down the RSVP form would be worse than no notifier.
 *
 * @param saved Whether the Notion write succeeded. A failed write is the case
 *   most worth being told about, so it is announced too rather than skipped.
 */
export async function notifyRsvp(
  record: RsvpRecord,
  saved: boolean,
): Promise<void> {
  if (!DISCORD_RSVP_WEBHOOK_URL) {
    // Not an error. Local runs and any environment without the webhook set
    // just carry on; the submission is already backed up either way.
    return;
  }

  const body = {
    // Only trusted text goes here. Everything a guest typed lives in the
    // embed instead, and Discord never resolves mentions inside an embed —
    // so a guest who names themselves `@everyone` cannot ping the server.
    content: DISCORD_RSVP_MENTION || undefined,
    embeds: [
      {
        title: saved ? "New RSVP" : "New RSVP — save failed",
        description: describe(record, saved),
        color: saved ? COLOR_SAVED : COLOR_FAILED,
        timestamp: record.submittedAt,
        fields: [
          { name: "Email", value: escapeMarkdown(record.email), inline: true },
          { name: "Party", value: summarise(record.seats), inline: true },
        ],
        // The id that joins this ping to the Blob backup and the Notion rows.
        footer: { text: record.submission },
      },
    ],
    // Lets the configured mention above resolve while leaving @everyone and
    // @here permanently off — a full `parse: []` would suppress the ping we
    // just asked for, and allowing "everyone" would make the one mention
    // nobody wants fired by an RSVP the easiest one to configure by accident.
    allowed_mentions: { parse: ["roles", "users"] },
  };

  try {
    const response = await fetch(DISCORD_RSVP_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // See DISCORD_TIMEOUT_MS — the ping must not outlive the form.
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });

    // fetch only rejects on transport failure, so a 4xx from a revoked or
    // mistyped webhook would otherwise pass silently as a success.
    if (!response.ok) {
      console.error(
        `Discord rejected the RSVP notification (submission=${record.submission}, status=${response.status}):`,
        await response.text().catch(() => "<no body>"),
      );
    }
  } catch (error) {
    console.error(
      `Failed to notify Discord of RSVP ${record.submission}:`,
      error,
    );
  }
}
