/*
 * The shape of an RSVP, shared by the form that posts it and the API route
 * that reads it. Nothing here touches the network, so importing it into a
 * client component is free.
 */

export const MAX_SEATS = 10;

/**
 * A seat as the API understands it. One seat is one place at a table, not
 * necessarily one person who has replied: an unnamed +1 rides along on the
 * seat that requested it until the couple confirms it.
 */
export type Seat = {
  name: string;
  attending: boolean;
  /** Only ever true for an attending seat. */
  plusOne: boolean;
  /** Present exactly when `plusOne` is true. */
  plusOneName: string | null;
};

/**
 * FormData is flat, so every seat namespaces its fields with its own id and
 * posts that id in a hidden `seatId` input. Both sides build their field
 * names from here — if the form and the route ever spelled a name
 * differently, the answer would go missing with nothing to show for it.
 */
export const seatField = {
  id: "seatId",
  name: (seatId: string | number) => `guest-${seatId}`,
  attending: (seatId: string | number) => `attending-${seatId}`,
  plusOne: (seatId: string | number) => `plusOne-${seatId}`,
  plusOneName: (seatId: string | number) => `plusOneName-${seatId}`,
} as const;

/**
 * What the party is told once their reply is safely stored.
 *
 * The party is answered as a whole, not seat by seat: one household can send
 * a yes, a no and a +1 request in the same submission, and reading back three
 * verdicts would be worse than reading one. So a single "are any of you
 * coming?" decides the greeting, and an outstanding +1 request adds a line.
 *
 * Declining and bringing someone is not a state a seat can reach — the API
 * clears `plusOne` on any seat that answered no — so the +1 line only ever
 * follows the attending greeting.
 */
export function successMessage(seats: ReadonlyArray<Seat>): string {
  const attending = seats.some((seat) => seat.attending);
  const plusOne = seats.some((seat) => seat.plusOne);

  if (!attending) {
    return "Your presence will be missed, thank you for letting us know.";
  }

  const greeting = "Jacob and Vicki are pumped to have you!";

  return plusOne
    ? `${greeting} Thank you, we'll get back to you regarding your request for a plus 1.`
    : greeting;
}
