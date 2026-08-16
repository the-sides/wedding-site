/*
 * The four destinations off the home page. Both the home page cards and the
 * interior header nav read from this list, so adding or renaming a page is a
 * one-line change here rather than an edit in two places that can drift.
 */

export interface NavLink {
  href: string;
  /** The link text, and the <h1> of the page it points at. */
  label: string;
  /** The small gold all-caps line above the heading. */
  eyebrow: string;
  /** One-line gloss, shown on the home page cards only. */
  blurb: string;
}

export const navLinks: Array<NavLink> = [
  {
    href: "/rsvp",
    label: "RSVP",
    eyebrow: "Invite",
    blurb: "Let us know who's coming — one line per guest.",
  },
  {
    href: "/schedule",
    label: "Schedule",
    eyebrow: "The day",
    blurb: "Ceremony and reception timing for October 30, 2027.",
  },
  {
    href: "/venue",
    label: "Venue",
    eyebrow: "The place",
    blurb: "Where the day happens, and how to get there.",
  },
  {
    href: "/extras",
    label: "Extras",
    eyebrow: "Notes",
    blurb: "Updates and everything else worth knowing.",
  },
];

/**
 * True when `href` is the page currently being rendered. Astro's default
 * `build.format` emits `/rsvp/index.html`, so the pathname can arrive with or
 * without a trailing slash depending on how the host serves it — compare the
 * trimmed forms rather than the raw strings.
 */
export function isCurrent(pathname: string, href: string) {
  const trim = (value: string) => value.replace(/\/+$/, "") || "/";
  return trim(pathname) === trim(href);
}
