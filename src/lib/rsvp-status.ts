import { NOTICE_ONLY } from "../../site.config";

/** The root site.config.ts switch controls both the site and submissions. */
export const RSVPS_OPEN = !NOTICE_ONLY;
export const RSVP_CLOSED_HEADING_LINES = [
  "Awkward...",
  "RSVPs are",
  "temporarily closed.",
] as const;
export const RSVP_CLOSED_TITLE = RSVP_CLOSED_HEADING_LINES.join(" ");
export const RSVP_CLOSED_DETAILS =
  "We’ll be in touch with more details shortly.";
export const RSVP_CLOSED_ASIDE = "(no, we didn’t break up)";
