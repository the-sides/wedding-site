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
}

export const navLinks: Array<NavLink> = [
  {
    href: "/rsvp",
    label: "RSVP",
    eyebrow: "Invite",
  },
  {
    href: "/schedule",
    label: "Schedule",
    eyebrow: "The day",
  },
  {
    href: "/venue",
    label: "Venue",
    eyebrow: "The place",
  },
  {
    href: "/extras",
    label: "Extras",
    eyebrow: "Notes",
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
