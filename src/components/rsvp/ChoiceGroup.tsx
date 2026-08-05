import { choiceClass, labelClass, radioClass } from "./fieldStyles";

export type Choice = "yes" | "no";

const OPTIONS: Array<{ label: string; value: Choice }> = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

type ChoiceGroupProps = {
  legend: string;
  /** Must be unique per group — radios sharing a name are one group. */
  name: string;
  value: Choice | null;
  onChange: (value: Choice) => void;
};

/**
 * A yes/no question. The radios are ordinary named inputs, so the answer
 * still arrives in FormData on submit; `value` is lifted out so the seat can
 * react to it and reveal the questions that only follow from a "yes".
 */
export default function ChoiceGroup({
  legend,
  name,
  value,
  onChange,
}: ChoiceGroupProps) {
  return (
    // <fieldset>/<legend> is what ties the question to its options for a
    // screen reader. A plain <p> beside the radios leaves them announced as
    // bare "Yes" / "No" with no idea what is being asked.
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 flex items-center gap-6">
        {OPTIONS.map((option) => (
          // The input sits inside the label, so the word is part of the hit
          // target rather than dead text next to it.
          <label key={option.value} className={choiceClass}>
            <input
              className={radioClass}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              required
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
