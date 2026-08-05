// Opts this route out of the site's `output: "static"` build so it becomes a
// Vercel Function that can receive POSTs at runtime.
export const prerender = false;

import type { APIRoute } from "astro";
import { MAX_SEATS, seatField, type Seat } from "@/lib/rsvp";
import { createRsvp } from "@/lib/notion";

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

  try {
    const { submission } = await createRsvp({ email, seats: result.seats });
    console.log("RSVP saved", {
      submission,
      email,
      seats: result.seats.length,
    });
  } catch (error) {
    // Tell the guest the truth. A cheerful "Thank you!" over a failed write
    // is the one outcome we cannot recover from — they would never resend.
    console.error("Failed to save RSVP to Notion:", error);
    return json("We couldn't save your reply — please try again.", 502);
  }

  const attending = result.seats.filter((seat) => seat.attending).length;

  return json(
    attending === 0
      ? "Thank you for letting us know — we'll miss you."
      : `Thank you! ${attending} of ${result.seats.length} seat(s) saved.`,
    200,
  );
};
