import { useState } from "react";
import { choiceClass, labelClass, radioClass } from "./fieldStyles";
import TextField from "./TextField";

const YES_NO = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

type ChoiceGroupProps = {
  legend: string;
  /** Must be unique per group — radios sharing a name are one group. */
  name: string;
  plus1?: boolean;
  options?: typeof YES_NO;
};

export default function ChoiceGroup({
  legend,
  name,
  plus1 = false,
  options = YES_NO,
}: ChoiceGroupProps) {
  const [val, setVal] = useState('No')
  return (
    // <fieldset>/<legend> is what ties the question to its options for a
    // screen reader. A plain <p> beside the radios leaves them announced as
    // bare "Yes" / "No" with no idea what is being asked.
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 flex items-center gap-6">
        {options.map((option) => (
          // The input sits inside the label, so the word is part of the hit
          // target rather than dead text next to it.
          <label key={option.value} className={choiceClass}>
            <input
              className={radioClass}
              type="radio"
              name={name}
              value={option.value}
              onChange={() => setVal(option.value)}
              required
            />
            {option.label}
          </label>
        ))}
      </div>
      {plus1 && val == 'yes' && <div className="mt-3">
        <TextField label={`${val}-plus1-name`}/>
      </div>
      }
    </fieldset>
  );
}
