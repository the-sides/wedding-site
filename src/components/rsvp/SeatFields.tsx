import { useEffect, useRef } from "react";
import ChoiceGroup from "./ChoiceGroup";
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

/** One seat in the party: a name plus the two questions asked about it. */
export default function SeatFields({
  seatId,
  position,
  claimFocus,
  canRemove,
  onRemove,
}: SeatFieldsProps) {
  const nameInput = useRef<HTMLInputElement>(null);

  // Only a seat the guest just added claims focus. The first seat mounts
  // during hydration, where grabbing focus would also scroll the page down
  // past the hero before the guest has done anything.
  useEffect(() => {
    if (claimFocus) nameInput.current?.focus();
  }, [claimFocus]);

  return (
    <li className="border border-[#221812]/12 bg-[#fff8ee]/35 p-5 sm:p-6">
      {/*
        Field names are suffixed with the seat id for two reasons: it keeps
        each seat's radios in their own group (same-name radios anywhere in a
        form are one group), and it lets the API rebuild a seat from the flat
        FormData. This hidden input is the list of ids to walk.
      */}
      <input type="hidden" name="seatId" value={seatId} />

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
            name={`guest-${seatId}`}
            autoComplete="off"
            required
          />
        </div>

        <ChoiceGroup legend="Will attend" name={`attending-${seatId}`} />
        <ChoiceGroup legend="Requesting a +1" name={`plusOne-${seatId}`} />
      </div>
    </li>
  );
}
