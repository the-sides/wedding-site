import { useEffect, useRef, useState } from "react";
import { seatField } from "@/lib/rsvp";
import ChoiceGroup, { type Choice } from "./ChoiceGroup";
import TextField from "./TextField";
import { eyebrowClass, ghostButtonClass } from "./fieldStyles";

type SeatFieldsProps = {
  /** Stable id for this seat, used to namespace its field names. */
  seatId: number;
  /** 1-based position, for display only. */
  position: number;
  claimFocus: boolean;
  canRemove: boolean;
  onRemove: () => void;
};

/** One seat in the party: a name, plus whatever that name's answers open up. */
export default function SeatFields({
  seatId,
  position,
  claimFocus,
  canRemove,
  onRemove,
}: SeatFieldsProps) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [attending, setAttending] = useState<Choice | null>(null);
  const [plusOne, setPlusOne] = useState<Choice | null>(null);

  // Only a seat the guest just added claims focus. The first seat mounts
  // during hydration, where grabbing focus would also scroll the page down
  // past the hero before the guest has done anything.
  useEffect(() => {
    if (claimFocus) nameInput.current?.focus();
  }, [claimFocus]);

  function answerAttending(value: Choice) {
    setAttending(value);
    // Someone who is not coming cannot bring anyone. Clearing the answer as
    // well as hiding it keeps a stale "yes" from coming back if they change
    // their mind twice.
    if (value === "no") setPlusOne(null);
  }

  return (
    <li className="border border-[#221812]/12 bg-[#fff8ee]/35 p-5 sm:p-6">
      {/* The id every field on this seat is namespaced with — see lib/rsvp. */}
      <input type="hidden" name={seatField.id} value={seatId} />

      <div className="flex items-baseline justify-between gap-4">
        <span className={eyebrowClass}>Guest {position}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className={ghostButtonClass}
        >
          Remove
        </button>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            ref={nameInput}
            label="Full name"
            type="text"
            name={seatField.name(seatId)}
            autoComplete="off"
            required
          />
        </div>

        <ChoiceGroup
          legend="Will attend"
          name={seatField.attending(seatId)}
          value={attending}
          onChange={answerAttending}
          required
        />

        {/*
          Each field below is unmounted rather than hidden when it stops
          applying. An unmounted input is not in the form at all, so it drops
          out of FormData and stops blocking submit with its own `required` —
          the browser cannot demand a +1's name that nobody can see.

          The +1 question itself is optional even while it is on screen. Most
          guests are not bringing anyone and never read it as a question they
          owe an answer to, and an unanswered `required` radio group makes the
          browser refuse to fire submit at all: the form goes quiet and the
          Submit button looks broken. Leaving it blank means the same thing to
          the API as answering "no" — see `readSeats` in api/rsvp.ts.
        */}
        {attending === "yes" && (
          <ChoiceGroup
            legend="Requesting a +1"
            name={seatField.plusOne(seatId)}
            value={plusOne}
            onChange={setPlusOne}
          />
        )}

        {attending === "yes" && plusOne === "yes" && (
          <div className="sm:col-span-2">
            <TextField
              label="Plus one's name"
              type="text"
              name={seatField.plusOneName(seatId)}
              autoComplete="off"
              required
            />
          </div>
        )}
      </div>
    </li>
  );
}
