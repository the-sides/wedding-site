// Opts this route out of the site's `output: "static"` build so it becomes a
// Vercel Function that can receive POSTs at runtime.
export const prerender = false;

import type { APIRoute } from "astro";

const MAX_SEATS = 10;

export type Seat = {
  name: string;
  attending: boolean;
  plusOne: boolean;
};

/**
 * The form posts one hidden `seatId` per seat plus fields suffixed with that
 * id, so a flat FormData still reassembles into seats. Party size is the seat
 * count — it is never typed in by the guest.
 */
function readSeats(data: FormData): Array<Seat> {
  return data
    .getAll("seatId")
    .map((seatId) => ({
      name: String(data.get(`guest-${seatId}`) ?? "").trim(),
      attending: data.get(`attending-${seatId}`) === "yes",
      plusOne: data.get(`plusOne-${seatId}`) === "yes",
    }))
    .filter((seat) => seat.name);
}

function json(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const email = String(data.get("email") ?? "").trim();
  const seats = readSeats(data);

  if (!email || seats.length === 0) {
    return json("Please add at least one name and an email.", 400);
  }

  if (seats.length > MAX_SEATS) {
    return json(`That's more than ${MAX_SEATS} guests.`, 400);
  }

  // TODO: persist the party to Notion.
  console.log("RSVP received", { email, seats });

  return json(`Thank you! ${seats.length} seat(s) saved.`, 200);
};
