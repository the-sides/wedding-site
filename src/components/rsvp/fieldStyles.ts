/*
 * The RSVP field styling lives here rather than inline so the components read
 * as markup instead of class-name soup. The page paints itself with literal
 * wedding-palette hex values (see the note in global.css), so these strings
 * carry the hex too — this is the one file to edit when the palette moves.
 */

const SANS = "font-['Avenir_Next','Gill_Sans',sans-serif]";

/** Small gold all-caps line above a heading. */
export const eyebrowClass = `${SANS} text-xs uppercase tracking-[0.26em] text-[#9b6e38]`;

/** The label above a text field, and the <legend> of a radio group. */
export const labelClass = `${SANS} text-[11px] uppercase tracking-[0.22em] text-[#6f5a45]`;

export const inputClass =
  "mt-2 w-full border border-[#b0aaa3] bg-[#fff8ee]/60 px-3 py-2 text-base text-[#221812] transition outline-none focus:border-[#9b6e38] focus:bg-[#fff8ee]";

export const radioClass = "size-4 accent-[#9b6e38]";

/** The clickable "Yes" / "No" beside a radio. */
export const choiceClass = `${SANS} flex cursor-pointer items-center gap-2 text-sm text-[#221812]`;

export const buttonClass = `${SANS} border border-teal-900 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#221812] transition hover:bg-[#bbb6af] disabled:cursor-not-allowed disabled:opacity-40`;

/** Borderless secondary action — "Remove". */
export const ghostButtonClass = `${SANS} text-[11px] uppercase tracking-[0.18em] text-[#6f5a45] underline-offset-4 transition hover:text-[#221812] hover:underline disabled:invisible`;

export const helpTextClass = `${SANS} text-sm text-[#6f5a45]`;

/** Same size and weight as help text — only the colour carries the alarm. */
export const errorTextClass = `${SANS} text-sm text-[#9b3b2f]`;
