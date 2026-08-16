import { useRef, useState } from "react";
// React 19 deprecated the recipe's `FormEvent` ("it doesn't actually exist")
// in favour of the concrete DOM event types.
import type { SubmitEvent } from "react";
import { MAX_SEATS } from "@/lib/rsvp";
import SeatFields from "./SeatFields";
import TextField from "./TextField";
import { buttonClass, errorTextClass, helpTextClass } from "./fieldStyles";

type Reply = { ok: boolean; message: string };

export default function RsvpForm() {
  // Seats are tracked by stable id, never by array index: with index keys,
  // removing a middle seat makes React reuse the wrong DOM node and the
  // remaining (uncontrolled) inputs appear to shift their values up a row.
  const [seatIds, setSeatIds] = useState<Array<number>>([0]);
  // The seat that should take focus once rendered — set only by addSeat.
  const [focusedSeatId, setFocusedSeatId] = useState<number | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [pending, setPending] = useState(false);

  // A deterministic counter rather than crypto.randomUUID(): this component is
  // server-rendered to HTML before it hydrates, and a random initial id would
  // differ between those two passes and cause a hydration mismatch. It only
  // advances on user interaction, which happens after hydration.
  const nextId = useRef(1);

  function addSeat() {
    if (seatIds.length >= MAX_SEATS) return;
    const id = nextId.current++;
    setSeatIds((ids) => [...ids, id]);
    setFocusedSeatId(id);
  }

  function removeSeat(id: number) {
    // Never let the party drop to zero seats.
    setSeatIds((ids) => (ids.length === 1 ? ids : ids.filter((x) => x !== id)));
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read the DOM before the first await — currentTarget is only valid
    // during the synchronous part of the handler.
    const formData = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      // A 400 carries a message worth showing verbatim — it names the guest
      // whose answer is missing. Only the colour changes.
      setReply({ ok: response.ok, message: data.message ?? "" });
    } catch {
      setReply({
        ok: false,
        message: "Something went wrong — please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  // The page heading and chrome live in `src/pages/rsvp.astro` — this renders
  // the form alone so the RSVP page looks like every other page.
  return (
    <form className="max-w-2xl" onSubmit={submit}>
      {/* One <li> per seat. Party size is the row count, never typed. */}
      <ol className="grid gap-4">
        {seatIds.map((id, index) => (
          <SeatFields
            key={id}
            seatId={id}
            position={index + 1}
            claimFocus={id === focusedSeatId}
            canRemove={seatIds.length > 1}
            onRemove={() => removeSeat(id)}
          />
        ))}
      </ol>

      <button
        type="button"
        onClick={addSeat}
        disabled={seatIds.length >= MAX_SEATS}
        className={`${buttonClass} mt-4`}
      >
        + Add another name
      </button>

      <div className="mt-10 border-t border-[#221812]/15 pt-6">
        <div className="max-w-sm">
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {/* Rendered even when empty: a live region has to be in the DOM
              before the text lands, or nothing is announced. */}
          <p
            className={reply && !reply.ok ? errorTextClass : helpTextClass}
            aria-live="polite"
          >
            {reply?.message ?? ""}
          </p>
          <button disabled={pending} className={`${buttonClass} ml-auto`}>
            {pending ? "Sending…" : "Submit"}
          </button>
        </div>
      </div>
    </form>
  );
}
