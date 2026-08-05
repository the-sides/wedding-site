import type { ComponentPropsWithRef } from "react";
import { inputClass, labelClass } from "./fieldStyles";

// React 19 made `ref` an ordinary prop, so ComponentPropsWithRef is enough —
// no forwardRef wrapper, and the ref rides along in the `...rest` spread.
type TextFieldProps = ComponentPropsWithRef<"input"> & {
  label: string;
};

/** A label stacked over an input, wrapped so the label needs no `htmlFor` id. */
export default function TextField({ label, ...rest }: TextFieldProps) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input className={inputClass} {...rest} />
    </label>
  );
}
