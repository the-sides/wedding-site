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

// The sign-up stitched into the bottom of the notice, so a first-time visitor
// has a way to hear when the details are ready rather than having to remember
// to come back.
export const NOTICE_SUBSCRIBE_LABEL = "Email me when there’s news";
export const NOTICE_SUBSCRIBE_PLACEHOLDER = "your@email.com";
export const NOTICE_SUBSCRIBE_BUTTON = "Notify me";
export const NOTICE_SUBSCRIBE_HINT = "Leave an email and we’ll let you know.";
