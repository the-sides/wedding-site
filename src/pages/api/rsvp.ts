// Opts this route out of the site's `output: "static"` build so it becomes a
// Vercel Function that can receive POSTs at runtime.
export const prerender = false;

import type { APIRoute } from "astro";
import { MAX_SEATS, seatField, successMessage, type Seat } from "@/lib/rsvp";
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * The page a guest sees when they posted without JavaScript. It is written out
 * by hand rather than rendered through the layout because this route is a
 * function, not a page — and because a reply that reached the server should
 * never depend on anything else still working.
 */
function page(message: string, ok: boolean): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${ok ? "Thank you" : "We could not save that"} — Jacob &amp; Vicki</title>
    <style>
      body { margin: 0; background: #f4eadc; color: #221812;
             font-family: "Avenir Next", "Gill Sans", sans-serif; }
      main { max-width: 34rem; margin: 0 auto; padding: 5rem 1.5rem; }
      .eyebrow { font-size: 0.75rem; letter-spacing: 0.26em; text-transform: uppercase;
                 color: #9b6e38; margin: 0; }
      h1 { font-family: "Bodoni 72", Didot, Baskerville, serif; font-size: 3rem;
           line-height: 1.05; font-weight: 400; margin: 0.5rem 0 0; }
      p.message { font-size: 1rem; line-height: 1.75; color: ${ok ? "#6f5a45" : "#9b3b2f"};
                  margin-top: 1.5rem; }
      a { display: inline-block; margin-top: 2.5rem; padding: 0.5rem 1rem;
          border: 1px solid #134e4a; color: #221812; text-decoration: none;
          font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">RSVP</p>
      <h1>${ok ? "Thank you" : "Not quite"}</h1>
      <p class="message">${escapeHtml(message)}</p>
      <a href="/rsvp">${ok ? "Back to the site" : "Back to the form"}</a>
    </main>
  </body>
</html>`;
}

/**
 * Answers in whatever the caller asked for. The scripted form sends
 * `accept: application/json` and renders the message in place; a native POST —
 * the path taken when the JS bundle never arrived — accepts `text/html` and
 * gets a real page, because a browser staring at a raw JSON body reads as a
 * site that ate your reply.
 */
function respond(request: Request, message: string, status: number) {
  const accept = request.headers.get("accept") ?? "";

  if (accept.includes("application/json")) {
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(page(message, status === 200), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();

  const email = text(data, "email");
  if (!email) {
    return respond(request, "Please add an email so we can reach you.", 400);
  }

  const result = readSeats(data);
  if (!result.ok) {
    return respond(request, result.message, 400);
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
    return respond(
      request,
      "We couldn't save your reply — please try again.",
      502,
    );
  }

  return respond(request, successMessage(result.seats), 200);
};
