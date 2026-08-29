// Opts this route out of the site's `output: "static"` build so it becomes a
// Vercel Function that can receive POSTs at runtime.
export const prerender = false;

import type { APIRoute } from "astro";
import { MAX_SEATS, seatField, successMessage, type Seat } from "@/lib/rsvp";
import { createRsvp } from "@/lib/notion";
import { backupRsvp, type RsvpRecord } from "@/lib/rsvp-backup";
import { notifyRsvp } from "@/lib/rsvp-notify";

type SeatsResult =
  { ok: true; seats: Array<Seat> } | { ok: false; message: string };

function text(data: FormData, field: string): string {
  return String(data.get(field) ?? "").trim();
}

/** A yes/no answer, or null when the question was never answered. */
function choice(data: FormData, field: string): boolean | null {
  const value = data.get(field);
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

/**
 * Rebuilds the party from the flat FormData the form posts. The browser
 * already enforces most of this with `required`, but a POST can arrive from
 * anywhere, so the shape is re-derived here rather than trusted.
 */
function readSeats(data: FormData): SeatsResult {
  const seatIds = data.getAll(seatField.id);

  if (seatIds.length === 0) {
    return { ok: false, message: "Please add at least one name." };
  }

  if (seatIds.length > MAX_SEATS) {
    return { ok: false, message: `That's more than ${MAX_SEATS} guests.` };
  }

  const seats: Array<Seat> = [];

  for (const seatId of seatIds) {
    const name = text(data, seatField.name(String(seatId)));
    if (!name) {
      return { ok: false, message: "Every guest needs a name." };
    }

    const attending = choice(data, seatField.attending(String(seatId)));
    if (attending === null) {
      return { ok: false, message: `Let us know whether ${name} can make it.` };
    }

    // The form only asks about a +1 once a guest is attending, so anything
    // posted alongside a "no" is noise. Normalising it here means a seat can
    // never be stored as declining and bringing someone.
    const plusOne =
      attending && choice(data, seatField.plusOne(String(seatId))) === true;

    const plusOneName = plusOne
      ? text(data, seatField.plusOneName(String(seatId)))
      : "";
    if (plusOne && !plusOneName) {
      return { ok: false, message: `Add a name for ${name}'s +1.` };
    }

    seats.push({
      name,
      attending,
      plusOne,
      plusOneName: plusOneName || null,
    });
  }

  return { ok: true, seats };
}

function json(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();

  const email = text(data, "email");
  if (!email) {
    return json("Please add an email so we can reach you.", 400);
  }

  const result = readSeats(data);
  if (!result.ok) {
    return json(result.message, 400);
  }

  const record: RsvpRecord = {
    submission: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    email,
    seats: result.seats,
  };

  // Before Notion, not after. If this ran afterwards a failed Notion write
  // would skip the backup entirely — losing the answer in exactly the case
  // the backup exists for.
  await backupRsvp(record);

  let saved = true;

  try {
    await createRsvp(record);
    console.log("RSVP saved", {
      submission: record.submission,
      email,
      seats: result.seats.length,
    });
  } catch (error) {
    console.error(`Failed to save RSVP ${record.submission} to Notion:`, error);
    saved = false;
  }

  // After Notion, not before, so the ping can say whether the reply actually
  // landed there — and on both paths, because a failed write is the case most
  // worth being told about. Best-effort by design: see rsvp-notify.ts.
  await notifyRsvp(record, saved);

  if (!saved) {
    // Tell the guest the truth. A cheerful "Thank you!" over a failed write
    // is the one outcome we cannot recover from — they would never resend.
    //
    // The seats are written one at a time, so a party can be half-stored:
    // whatever rows carry this submission id in Notion are that partial
    // write, and the backup holds the full party to reconcile against.
    return json("We couldn't save your reply — please try again.", 502);
  }

  return json(successMessage(result.seats), 200);
};
